// Phaser config
const config = {
    type: Phaser.AUTO,
    width: 1000, // Adjusted for potentially wider layout
    height: 500,
    backgroundColor: '#e0e7ef',
    parent: 'phaser-game',
    scene: { preload, create, update }
};

// Game constants - some will be level-dependent
const BASE_SLOT_Y = 365; // Base Y before master offset
const MASTER_X_OFFSET = -100; // Controls X of the entire game group
const MASTER_Y_OFFSET = 0; // Controls Y of the entire game group
let SLOT_Y = BASE_SLOT_Y + MASTER_Y_OFFSET;
let SLOT_X_GAP = 60;
let TOWER_WIDTH = 36;
let TOWER_UNIT = 32;
const TOWER_COLOR_1 = '#8ecae6'; // Blue
const TOWER_COLOR_2 = '#4CAF50'; // Green
const ACTIVE_SLOT_COLOR = 0xFFA500; // Orange
const DIMMED_SLOT_COLOR = 0x2196f3; // Blue
const SLOT_X_OFFSET = 20; // Affects ONLY empty slot line positions (relative to towers)

// Level Configurations
const levels = [
    { range: 5, missing: 1, name: "Level 1" },        // Staircase 1-5, 1 missing
    { range: 7, missing: 2, name: "Level 2" },        // Staircase 1-7, 2 missing
    { range: 12, missing: 3, name: "Level 3" }       // Staircase 1-12, 3 missing
];

let game = new Phaser.Game(config);

function preload() {
    this.load.image('kiki', 'kiki.png');
}

function create() {
    this.currentLevelIndex = 0;
    this.layoutsCompletedThisLevel = 0;
    this.towers = [];
    this.slotLines = [];
    this.placedTowers = []; // GameObjects of towers on screen
    this.missingTowerIndices = [];
    this.currentMissingTowerIdxToFill = 0; // Index within this.missingTowerIndices
    this._fadeMsgTimeout = null;
    this.lastChoices = [];

    this.setupLevel();
}

function update() { /* Currently no dynamic updates needed */ }

// Define a common duration for the message display and layout transition
const messageDisplayDuration = 400; // Duration for displaying the success message
const layoutTransitionDuration = 500; // Duration for transitioning to the next layout

// --- Core Game Logic --- //

Phaser.Scene.prototype.setupLevel = function() {
    const level = levels[this.currentLevelIndex];
    const gameContainer = document.querySelector('.game-container');
    const phaserGameDiv = document.getElementById('phaser-game');

    // Clear previous level elements if any
    this.towers.forEach(t => t.destroy());
    this.towers = [];
    this.slotLines.forEach(s => s.destroy());
    this.slotLines = [];
    this.placedTowers.forEach(pt => pt.destroy());
    this.placedTowers = [];
    this.missingTowerIndices = [];
    this.currentMissingTowerIdxToFill = 0;

    const instructionId = 'instruction-text';
    let instr = document.getElementById(instructionId);
    if (!instr) {
        instr = document.createElement('div');
        instr.id = instructionId;
        instr.style.fontSize = '24px';
        instr.style.fontWeight = 'bold';
        instr.style.color = '#333';
        instr.style.marginTop = '20px';
        instr.style.marginBottom = '10px';
        instr.style.textAlign = 'center';
        gameContainer.insertBefore(instr, phaserGameDiv);
    }
    instr.textContent = `Fill in the missing tower(s) [${level.name}]`;

    // Generate the full staircase for this level (1 to N)
    this.fullStaircase = Array.from({ length: level.range }, (_, i) => i + 1);

    // Determine missing tower indices
    let allIndices = Array.from({ length: level.range }, (_, i) => i);
    this.missingTowerIndices = Phaser.Utils.Array.Shuffle(allIndices).slice(0, level.missing);
    this.missingTowerIndices.sort((a, b) => a - b); // Ensure left-to-right filling order

    // Adjust layout for wider staircases
    const maxTowers = levels[levels.length-1].range;
    SLOT_X_GAP = Math.max(30, 90 - (level.range * 3));
    TOWER_WIDTH = Math.max(20, 50 - (level.range * 2));
    TOWER_UNIT = Math.max(18, 40 - level.range);

    const trayTotalWidth = (level.range - 1) * SLOT_X_GAP;
    const towerBaseStartX = config.width / 2 - trayTotalWidth / 2 + MASTER_X_OFFSET; // Base X for towers, includes master offset
    const slotVisualStartX = towerBaseStartX + SLOT_X_OFFSET;    // Adjusted X for slot visuals

    // Create slots and initial towers
    for (let i = 0; i < level.range; i++) {
        const isMissing = this.missingTowerIndices.includes(i);
        if (isMissing) {
            let color = (i === this.missingTowerIndices[this.currentMissingTowerIdxToFill]) ? ACTIVE_SLOT_COLOR : DIMMED_SLOT_COLOR;
            let alpha = (i === this.missingTowerIndices[this.currentMissingTowerIdxToFill]) ? 1 : 0.3;
            let slot = this.add.line(
                slotVisualStartX + i * SLOT_X_GAP, // Use slotVisualStartX for slot lines
                SLOT_Y,
                -TOWER_WIDTH / 2, 0, TOWER_WIDTH / 2, 0,
                color, alpha
            ).setLineWidth(6);
            slot.setData('originalIndex', i);
            this.slotLines.push(slot);
        } else {
            // Place existing tower using towerBaseStartX (which includes MASTER_X_OFFSET)
            this.placeTower(i, this.fullStaircase[i], false, towerBaseStartX, level.range);
        }
    }
    this.updateSlotHighlights();
    this.showNextChoices();
};

Phaser.Scene.prototype.showNextChoices = function() {
    const level = levels[this.currentLevelIndex];
    const btnContainer = document.getElementById('mc-buttons') || this.createButtonContainer();
    btnContainer.innerHTML = '';

    // Check if the current layout is complete FIRST
    if (this.currentMissingTowerIdxToFill >= this.missingTowerIndices.length) {
        this.layoutsCompletedThisLevel++;
        if (this.layoutsCompletedThisLevel < 2) {
            // Stay on the same difficulty level, generate a new layout
            setTimeout(() => {
                this.setupLevel();
            }, layoutTransitionDuration);
        } else {
            // Two layouts for this difficulty completed, try to advance to next difficulty
            this.layoutsCompletedThisLevel = 0;
            this.currentLevelIndex++;
            if (this.currentLevelIndex >= levels.length) {
                this.showMessage('All levels completed!', 'success');
                document.getElementById('reset-button').style.display = 'inline-block';
            } else {
                setTimeout(() => this.setupLevel(), layoutTransitionDuration);
            }
        }
        return;
    }

    // If the layout is NOT complete, proceed to show choices for the next missing tower
    const targetSlotIndex = this.missingTowerIndices[this.currentMissingTowerIdxToFill];
    const correctAnswer = this.fullStaircase[targetSlotIndex];

    let choices;
    if (correctAnswer === 1) {
        // Special case for when correct answer is 1
        choices = [1, 2, 3, 4, 5];
    } else {
        // For other cases, use N-2, N-1, N, N+1, N+2 pattern
        choices = [correctAnswer - 2, correctAnswer - 1, correctAnswer, correctAnswer + 1, correctAnswer + 2];
    }

    // Shuffle choices ensuring no number stays in the same position
    let shuffled;
    do {
        shuffled = Phaser.Utils.Array.Shuffle(choices);
        // Check if any number is in the same position as last time
        let hasSamePosition = false;
        if (this.lastChoices.length) {
            for (let i = 0; i < shuffled.length; i++) {
                if (shuffled[i] === this.lastChoices[i]) {
                    hasSamePosition = true;
                    break;
                }
            }
        }
        if (!hasSamePosition) {
            choices = shuffled;
            break;
        }
    } while (true);

    this.lastChoices = choices.slice();

    const btnRefs = [];
    choices.forEach(num => {
        let btn = document.createElement('button');
        btn.textContent = num;
        btn.onclick = () => {
            if (num === correctAnswer) {
                btnRefs.forEach(b => { if (b !== btn) b.classList.add('dim'); });
                this.placeTower(targetSlotIndex, correctAnswer, true, null, level.range);
                this.currentMissingTowerIdxToFill++;
                this.showMessage('Nice!', 'success');
                btnRefs.forEach(b => b.onclick = null);

                setTimeout(() => this.showNextChoices(), layoutTransitionDuration);
            } else {
                btn.classList.remove('shake');
                void btn.offsetWidth;
                btn.classList.add('shake');
                this.showMessage('Try Again', 'error');
            }
        };
        btnRefs.push(btn);
        btnContainer.appendChild(btn);
    });
};

Phaser.Scene.prototype.placeTower = function(slotIndex, height, isFillingMissing, trayStartXOverride = null, numTowersOverride = null) {
    const level = levels[this.currentLevelIndex];
    const currentNumTowers = numTowersOverride !==null ? numTowersOverride : level.range;
    // Player-placed towers use the base X calculation, including MASTER_X_OFFSET
    const currentTowerBaseX = trayStartXOverride !== null ? trayStartXOverride :
                              (config.width / 2 - ((currentNumTowers - 1) * SLOT_X_GAP) / 2 + MASTER_X_OFFSET);

    let towerGroup = this.add.container(0, 0);
    let fillColorValue; // Will store the numeric color
    if (isFillingMissing) {
        fillColorValue = ACTIVE_SLOT_COLOR; // Orange (already a number 0xFFA500)
    } else {
        fillColorValue = Phaser.Display.Color.HexStringToColor(TOWER_COLOR_1).color; // Blue (TOWER_COLOR_1 is '#8ecae6')
    }

    for (let j = 0; j < height; j++) {
        let block = this.add.rectangle(0, -j * TOWER_UNIT, TOWER_WIDTH, TOWER_UNIT,
            fillColorValue) // Use the determined numeric color value
            .setStrokeStyle(2, 0x888888);
        towerGroup.add(block);
    }
    towerGroup.setSize(TOWER_WIDTH, TOWER_UNIT * height);
    towerGroup.setPosition(currentTowerBaseX + slotIndex * SLOT_X_GAP, SLOT_Y - TOWER_UNIT / 2);

    this.placedTowers.push(towerGroup);

    if (isFillingMissing) {
      // Remove kiki from other towers if any
        this.placedTowers.forEach(t => {
            if (t.getData && t.getData('kikiSprite')) {
                t.getData('kikiSprite').destroy();
                t.setData('kikiSprite', null);
            }
        });

        const kikiHeight = TOWER_UNIT * 1.5;
        const kikiY = -height * TOWER_UNIT - kikiHeight / 2 + TOWER_UNIT /2 ;
        const kiki = this.add.image(0, kikiY, 'kiki');
        kiki.setOrigin(0.5, 0.5);
        kiki.setDisplaySize(TOWER_WIDTH * 1.5, TOWER_WIDTH * 1.5);
        towerGroup.add(kiki);
        towerGroup.setData('kikiSprite', kiki);
    }

    // Hide the slot line that was just filled
    const slotToHide = this.slotLines.find(s => s.getData('originalIndex') === slotIndex);
    if (slotToHide) slotToHide.setAlpha(0);
};

Phaser.Scene.prototype.updateSlotHighlights = function() {
    if (this.currentMissingTowerIdxToFill >= this.missingTowerIndices.length) return;
    const nextActiveOriginalIndex = this.missingTowerIndices[this.currentMissingTowerIdxToFill];
    this.slotLines.forEach(slot => {
        const originalIndex = slot.getData('originalIndex');
        if (slot.alpha > 0) { // Only update visible slots
            if (originalIndex === nextActiveOriginalIndex) {
                slot.setStrokeStyle(6, ACTIVE_SLOT_COLOR).setAlpha(1);
            } else {
                slot.setStrokeStyle(6, DIMMED_SLOT_COLOR).setAlpha(0.3);
            }
        }
    });
};

Phaser.Scene.prototype.createButtonContainer = function() {
    let btnContainer = document.createElement('div');
    btnContainer.id = 'mc-buttons';
    btnContainer.style.marginTop = '30px'; // Increased margin
    btnContainer.style.display = 'flex';
    btnContainer.style.justifyContent = 'center';
    btnContainer.style.gap = '20px';
    document.querySelector('.game-container').appendChild(btnContainer);
    return btnContainer;
};

Phaser.Scene.prototype.showMessage = function(msgText, type) {
    const el = document.getElementById('message');
    el.textContent = msgText;
    el.className = type;
    el.style.opacity = 1;
    if (this._fadeMsgTimeout) clearTimeout(this._fadeMsgTimeout);
    
    if (type === 'success' && !(this.currentLevelIndex >= levels.length && this.currentMissingTowerIdxToFill >= this.missingTowerIndices.length)) {
        this._fadeMsgTimeout = setTimeout(() => {
            el.style.transition = 'opacity 0.3s';
            el.style.opacity = 0;
            setTimeout(() => {
                el.textContent = '';
                el.className = '';
                el.style.opacity = 1;
            }, 300); // Fade out duration
        }, messageDisplayDuration); // Use the common display duration
    }
};

// Reset button setup (assuming it's in your HTML, initially hidden)
document.addEventListener('DOMContentLoaded', () => {
    const resetButton = document.getElementById('reset-button');
    if (resetButton) {
        resetButton.onclick = () => {
            location.reload(); // Reload the page to reset the game
        };
    }
});