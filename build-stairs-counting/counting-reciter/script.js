// Phaser config
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 400, // Shorter height
    backgroundColor: '#e0e7ef',
    parent: 'phaser-game',
    scene: { preload, create, update }
};

const SLOT_Y = 350; // Lowered by 30px
const SLOT_X_START = 200;
const SLOT_X_GAP = 100;
const TOWER_WIDTH = 50;
const TOWER_UNIT = 50;
const TOWER_COLOR = '#8ecae6';
const TOWER_COLOR_CORRECT = 0x4CAF50; // Green

let game = new Phaser.Game(config);

function preload() {
    this.load.image('kiki', 'kiki.png');
}

function create() {
    this.towers = [];
    this.slotLines = [];
    this.placed = [null, null, null, null, null];
    this.nextSlot = 0;
    this._fadeMsgTimeout = null;
    this.lastChoices = [];

    // Add on-screen instruction
    if (!document.getElementById('instruction-text')) {
        const instr = document.createElement('div');
        instr.id = 'instruction-text';
        instr.textContent = 'Choose the correct number to complete the staircase';
        instr.style.fontSize = '24px';
        instr.style.fontWeight = 'bold';
        instr.style.color = '#333';
        instr.style.marginTop = '20px';
        instr.style.marginBottom = '10px';
        instr.style.textAlign = 'center';
        document.querySelector('.game-container').insertBefore(instr, document.getElementById('phaser-game'));
    }

    // Center the slots
    const trayTotalWidth = (5 - 1) * SLOT_X_GAP;
    const trayStartX = config.width / 2 - trayTotalWidth / 2;

    // Create slots (as horizontal lines)
    for (let i = 0; i < 5; i++) {
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
    this.availableNumbers = [1,2,3,4,5];
    this.showNextChoices = () => {
        btnContainer.innerHTML = '';
        if (this.nextSlot >= 5) return;
        // Always show 4 choices: 1 correct, 3 incorrect (from unused numbers or, if not enough, from all except correct)
        let correct = this.nextSlot + 1;
        let unused = this.availableNumbers.filter(n => n !== correct);
        let pool = unused.length >= 3 ? unused : [1,2,3,4,5].filter(n => n !== correct);
        let incorrects = Phaser.Utils.Array.Shuffle(pool).slice(0, 3);
        let choices;
        // Ensure choices are not in the same order as last round
        do {
            choices = Phaser.Utils.Array.Shuffle([correct, ...incorrects]);
        } while (this.lastChoices.length && choices.every((v, i) => v === this.lastChoices[i]));
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
                    // Update slot colors: active slot is orange, others are blue and dimmed, placed slots are hidden
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
                    if (this.nextSlot === 5) {
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
        const trayTotalWidth = (5 - 1) * SLOT_X_GAP;
        const trayStartX = config.width / 2.1 - trayTotalWidth / 2;
        let group = this.add.container(0, 0);
        for (let j = 0; j < height; j++) {
            let block = this.add.rectangle(
                0,
                -j * TOWER_UNIT,
                TOWER_WIDTH,
                TOWER_UNIT,
                Phaser.Display.Color.HexStringToColor(TOWER_COLOR).color
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
        const kikiHeight = 40;
        const kikiY = -height * TOWER_UNIT - 5 - kikiHeight / 2 - 40; // original
        const kiki = this.add.image(0, kikiY + 40, 'kiki'); // move down 40px
        kiki.setOrigin(0.5, 0.5);
        kiki.setDisplaySize(65, 65);
        group.add(kiki);
        group.setData && group.setData('kikiSprite', kiki);
        // Make every tower green
        group.list.forEach(block => {
            if (block instanceof Phaser.GameObjects.Rectangle) {
                block.setFillStyle(TOWER_COLOR_CORRECT);
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
        if (type === 'success' && this.nextSlot < 5) {
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