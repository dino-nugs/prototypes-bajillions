// Phaser config
const config = {
    type: Phaser.AUTO,
    width: 1100, // Wider for 10 towers
    height: 500, // Taller to fit tallest tower
    backgroundColor: '#e0e7ef',
    parent: 'phaser-game',
    scene: { preload, create, update }
};

const SLOT_Y = 380; // Vertical positioning
const SLOT_X_START = 60;
const SLOT_X_GAP = 60; // Closer together
const TOWER_WIDTH = 36; // Narrower towers
const TOWER_UNIT = 32; // Shorter blocks
const TOWER_COLOR_1 = '#8ecae6'; // Blue
const TOWER_COLOR_2 = '#4CAF50'; // Green
const TOWER_COLOR_CORRECT = 0x4CAF50; // Green for win effect
const NUM_TOWERS = 10;
const SLOT_X_OFFSET = -150; // move left by 100px

let game = new Phaser.Game(config);

function preload() {
    this.load.image('kiki', 'kiki.png');
}

function create() {
    this.towers = [];
    this.slotLines = [];
    this.placed = Array(NUM_TOWERS).fill(null);
    this.nextSlot = 0;
    this._fadeMsgTimeout = null;
    this.lastChoices = [];

    // Add on-screen instruction
    if (!document.getElementById('instruction-text')) {
        const instr = document.createElement('div');
        instr.id = 'instruction-text';
        instr.textContent = 'Build a staircase that goes down to 1';
        instr.style.fontSize = '24px';
        instr.style.fontWeight = 'bold';
        instr.style.color = '#333';
        instr.style.marginTop = '20px';
        instr.style.marginBottom = '10px';
        instr.style.textAlign = 'center';
        document.querySelector('.game-container').insertBefore(instr, document.getElementById('phaser-game'));
    }

    // Center the slots
    const trayTotalWidth = (NUM_TOWERS - 1) * SLOT_X_GAP;
    const trayStartX = config.width / 2 - trayTotalWidth / 2 + SLOT_X_OFFSET;

    // Create slots (as horizontal lines)
    for (let i = 0; i < NUM_TOWERS; i++) {
        let color = (i === 0) ? 0xFFA500 : 0x2196f3; // First slot orange, others blue
        let alpha = (i === 0) ? 1 : 0.3;
        let slot = this.add.line(
            trayStartX + i * SLOT_X_GAP,
            SLOT_Y,
            -TOWER_WIDTH/2, 0,
            TOWER_WIDTH/2, 0,
            color,
            alpha
        ).setLineWidth(6);
        slot.setData('index', i);
        slot.setAlpha(alpha);
        slot.setStrokeStyle(6, color);
        this.slotLines.push(slot);
    }

    // Prepare the answer buttons container
    let btnContainer = document.getElementById('mc-buttons');
    if (!btnContainer) {
        btnContainer = document.createElement('div');
        btnContainer.id = 'mc-buttons';
        btnContainer.style.marginTop = '20px';
        btnContainer.style.display = 'flex';
        btnContainer.style.justifyContent = 'center';
        btnContainer.style.gap = '20px';
        document.querySelector('.game-container').appendChild(btnContainer);
    }
    btnContainer.innerHTML = '';

    // Start the game logic
    this.availableNumbers = [];
    for (let i = NUM_TOWERS; i >= 1; i--) this.availableNumbers.push(i);
    this.showNextChoices = () => {
        btnContainer.innerHTML = '';
        if (this.nextSlot >= NUM_TOWERS) return;
        
        let correct = NUM_TOWERS - this.nextSlot;
        let choices;
        
        if (correct === 1) {
            // Special case for when correct answer is 1
            choices = [1, 2, 3, 4, 5];
        } else {
            // For other cases, use N-2, N-1, N, N+1, N+2 pattern
            choices = [correct - 2, correct - 1, correct, correct + 1, correct + 2];
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
                if (num === correct) {
                    // Dim incorrect choices
                    btnRefs.forEach(b => {
                        if (b !== btn) {
                            b.classList.add('dim');
                        }
                    });
                    this.placeTower(this.nextSlot, num);
                    this.nextSlot++;
                    this.availableNumbers = this.availableNumbers.filter(n => n !== num);
                    // Update slot colors: active slot is orange, others are blue and dimmed
                    this.slotLines.forEach((slot, idx) => {
                        if (idx === this.nextSlot) {
                            slot.setStrokeStyle(6, 0xFFA500); // Orange
                            slot.setAlpha(1);
                        } else if (idx > this.nextSlot) {
                            slot.setStrokeStyle(6, 0x2196f3); // Blue
                            slot.setAlpha(0.3);
                        } else {
                            slot.setAlpha(0); // Hide slot where tower is placed
                        }
                    });
                    this.showMessage('Nice!', 'success');
                    // Disable all buttons after correct answer
                    btnRefs.forEach(b => b.onclick = null);
                    if (this.nextSlot === NUM_TOWERS) {
                        setTimeout(() => {
                            this.showMessage('Stairs completed!', 'success');
                            document.getElementById('reset-button').style.display = 'inline-block';
                            btnContainer.innerHTML = '';
                        }, 500);
                    } else {
                        setTimeout(() => this.showNextChoices(), 500);
                    }
                } else {
                    btn.classList.remove('shake');
                    // Force reflow to restart animation
                    void btn.offsetWidth;
                    btn.classList.add('shake');
                    this.showMessage('Try Again', 'error');
                }
            };
            btnRefs.push(btn);
            btnContainer.appendChild(btn);
        });
    };

    this.placeTower = (slotIndex, height) => {
        // Draw the tower at the slot
        const trayTotalWidth = (NUM_TOWERS - 1) * SLOT_X_GAP;
        const trayStartX = config.width / 2.066 - trayTotalWidth / 2 + SLOT_X_OFFSET;
        let group = this.add.container(0, 0);
        let color = (slotIndex % 2 === 0) ? Phaser.Display.Color.HexStringToColor(TOWER_COLOR_1).color : Phaser.Display.Color.HexStringToColor(TOWER_COLOR_2).color;
        for (let j = 0; j < height; j++) {
            let block = this.add.rectangle(
                0,
                -j * TOWER_UNIT,
                TOWER_WIDTH,
                TOWER_UNIT,
                color
            ).setStrokeStyle(2, 0x888888);
            group.add(block);
        }
        group.setSize(TOWER_WIDTH, TOWER_UNIT * height);
        group.setPosition(trayStartX + slotIndex * SLOT_X_GAP, SLOT_Y - 18);
        // Remove kiki.png from all previous towers
        this.placed.forEach(tower => {
            if (tower && tower.getData && tower.getData('kikiSprite')) {
                tower.getData('kikiSprite').destroy();
                tower.setData('kikiSprite', null);
            }
        });
        // Show kiki.png on the last placed correct tower (move down 40px)
        const kikiHeight = 10;
        const kikiY = -height * TOWER_UNIT - 5 - kikiHeight / 2 - 40;
        const kiki = this.add.image(0, kikiY + 40, 'kiki');
        kiki.setOrigin(0.5, 0.5);
        kiki.setDisplaySize(50, 50);
        group.add(kiki);
        group.setData && group.setData('kikiSprite', kiki);
        // Make every tower green (for win effect, keep this for now)
        group.list.forEach(block => {
            if (block instanceof Phaser.GameObjects.Rectangle) {
                // block.setFillStyle(TOWER_COLOR_CORRECT); // Comment out if you want only alternating colors
            }
        });
        this.placed[slotIndex] = group;
    };

    this.showMessage = (msg, type) => {
        const el = document.getElementById('message');
        el.textContent = msg;
        el.className = type;
        el.style.opacity = 1;
        if (this._fadeMsgTimeout) clearTimeout(this._fadeMsgTimeout);
        if (type === 'success' && this.nextSlot < NUM_TOWERS) {
            this._fadeMsgTimeout = setTimeout(() => {
                el.style.transition = 'opacity 0.3s';
                el.style.opacity = 0;
                setTimeout(() => {
                    el.textContent = '';
                    el.className = '';
                    el.style.opacity = 1;
                }, 300);
            }, 700);
        }
    };

    // Reset button
    document.getElementById('reset-button').onclick = () => {
        this.scene.restart();
        document.getElementById('message').textContent = '';
        document.getElementById('reset-button').style.display = 'none';
        btnContainer.innerHTML = '';
    };

    this.showNextChoices();
}

function update() {} 