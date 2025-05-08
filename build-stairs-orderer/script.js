const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#e0e7ef',
    parent: 'phaser-game',
    scene: { preload, create, update }
};

const SLOT_Y = 565;
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
    this.trayY = 250;
    this.nextSlot = 0;
    this.placed = [null, null, null, null, null];
    this.locked = [false, false, false, false, false];
    this.slotLines = [];
    this.stickySelected = null;
    this.stickyOffset = { x: 0, y: 0 };
    this.stickyActive = false;
    this._tryAgainTimeout = null;
    this._fadeMsgTimeout = null;

    // Add on-screen instruction
    if (!document.getElementById('instruction-text')) {
        const instr = document.createElement('div');
        instr.id = 'instruction-text';
        instr.textContent = 'Build the staircase';
        instr.style.fontSize = '24px';
        instr.style.fontWeight = 'bold';
        instr.style.color = '#333';
        instr.style.marginTop = '20px';
        instr.style.marginBottom = '10px';
        instr.style.textAlign = 'center';
        document.querySelector('.game-container').insertBefore(instr, document.getElementById('phaser-game'));
    }

    // Center the tray towers
    const trayTotalWidth = (5 - 1) * SLOT_X_GAP;
    const trayStartX = config.width / 2 - trayTotalWidth / 2;

    // Create slots (as horizontal lines, only show the first)
    for (let i = 0; i < 5; i++) {
        let color = (i === 0) ? 0x2196f3 : 0x888888; // Blue for active slot
        let alpha = (i === 0) ? 1 : 0;
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
        this.slotLines.push(slot);
    }

    // Attach tryStickyDrop as a method on the scene
    this.tryStickyDrop = function(pointer) {
        let gameObject = this.stickySelected;
        if (!gameObject) return;
        let slot = this.slotLines[this.nextSlot];
        let slotX = slot.x;
        let slotY = slot.y;
        // Make drop area more forgiving: if any part of the tower overlaps the area above the slot line
        let towerTop = gameObject.y - (gameObject.height / 2);
        let towerBottom = gameObject.y + (gameObject.height / 2);
        let dropAreaTop = slotY - 120;
        let dropAreaBottom = slotY;
        let inSlot = Math.abs(gameObject.x - slotX) < TOWER_WIDTH/2 && (towerBottom > dropAreaTop && towerTop < dropAreaBottom);
        if (inSlot) {
            if (gameObject.getData('size') === this.nextSlot) {
                // Correct! Snap and lock
                gameObject.x = slotX;
                gameObject.y = slotY - 18; // Snap even higher
                this.placed[this.nextSlot] = gameObject;
                slot.setAlpha(0); // Hide this slot
                // Set next slot to blue and visible
                this.nextSlot++;
                if (this.nextSlot < 5) {
                    this.slotLines[this.nextSlot].setAlpha(1);
                    this.slotLines[this.nextSlot].setStrokeStyle(6, 0x2196f3); // Blue for active slot
                }
                // Turn tower green
                gameObject.list.forEach(block => block.setFillStyle(TOWER_COLOR_CORRECT));
                // Remove kiki.png from all towers
                this.placed.forEach(tower => {
                    if (tower && tower.getData('kikiSprite')) {
                        tower.getData('kikiSprite').destroy();
                        tower.setData('kikiSprite', null);
                    }
                });
                // Show kiki.png on top of the last correct tower
                if (!gameObject.getData('kikiSprite')) {
                    const kikiHeight = 40;
                    const size = gameObject.getData('size');
                    // The top edge of the tower is at y = -size * TOWER_UNIT
                    // Place kiki.png so its bottom is 5px above that, then move up by 30px
                    const kikiY = -size * TOWER_UNIT - 5 - kikiHeight / 2 - 40;
                    const kiki = this.add.image(0, kikiY, 'kiki');
                    kiki.setOrigin(0.5, 0.5);
                    kiki.setDisplaySize(65, 65);
                    gameObject.add(kiki);
                    gameObject.setData('kikiSprite', kiki);
                }
                this.stickySelected = null;
                this.stickyActive = false;
                // Show 'Nice!' message and fade it out
                const msg = document.getElementById('message');
                msg.textContent = 'Nice!';
                msg.className = 'success';
                msg.style.opacity = 1;
                if (this._fadeMsgTimeout) clearTimeout(this._fadeMsgTimeout);
                this._fadeMsgTimeout = setTimeout(() => {
                    msg.style.transition = 'opacity 0.3s';
                    msg.style.opacity = 0;
                    setTimeout(() => {
                        msg.textContent = '';
                        msg.className = '';
                        msg.style.opacity = 1;
                    }, 300);
                }, 700);
                if (this._tryAgainTimeout) {
                    clearTimeout(this._tryAgainTimeout);
                    this._tryAgainTimeout = null;
                }
                checkWin.call(this);
            } else {
                // Incorrect, return to tray
                let trayIndex = gameObject.getData('index');
                gameObject.x = this.cameras.main.width / 2 - (5 - 1) * SLOT_X_GAP / 2 + trayIndex * SLOT_X_GAP;
                gameObject.y = this.trayY;
                this.stickySelected = null;
                this.stickyActive = false;
                const msg = document.getElementById('message');
                msg.textContent = 'Try Again';
                msg.className = 'error';
                msg.style.opacity = 1;
                if (this._tryAgainTimeout) clearTimeout(this._tryAgainTimeout);
                this._tryAgainTimeout = null;
            }
        } else {
            // Not dropped in slot, return to tray
            let trayIndex = gameObject.getData('index');
            gameObject.x = this.cameras.main.width / 2 - (5 - 1) * SLOT_X_GAP / 2 + trayIndex * SLOT_X_GAP;
            gameObject.y = this.trayY;
            this.stickySelected = null;
            this.stickyActive = false;
        }
    };

    // Create towers in tray (random order, never sorted ascending or descending)
    let towerOrder;
    do {
        towerOrder = Phaser.Utils.Array.Shuffle([0,1,2,3,4]);
    } while (towerOrder.join() === '0,1,2,3,4' || towerOrder.join() === '4,3,2,1,0');
    for (let i = 0; i < 5; i++) {
        let size = towerOrder[i];
        let group = this.add.container(0, 0);
        // Add a transparent rectangle as a hit area
        let hitRect = this.add.rectangle(0, -size * TOWER_UNIT / 2, TOWER_WIDTH, TOWER_UNIT * (size + 1), 0x000000, 0.001);
        hitRect.setOrigin(0.5, 0.5);
        hitRect.setInteractive({ cursor: 'pointer' });
        group.add(hitRect);
        for (let j = 0; j <= size; j++) {
            let block = this.add.rectangle(
                0,
                -j * TOWER_UNIT,
                TOWER_WIDTH,
                TOWER_UNIT,
                Phaser.Display.Color.HexStringToColor(TOWER_COLOR).color
            ).setStrokeStyle(2, 0x888888);
            group.add(block);
        }
        group.setSize(TOWER_WIDTH, TOWER_UNIT * (size + 1));
        group.setPosition(trayStartX + i * SLOT_X_GAP, this.trayY);
        group.setData('size', size);
        group.setData('fromTray', true);
        group.setData('index', i);
        // Sticky click: pointerdown to pick up or drop
        hitRect.on('pointerdown', (pointer) => {
            if (group.scene.placed.includes(group)) return;
            if (!group.scene.stickyActive) {
                group.scene.stickySelected = group;
                group.scene.stickyOffset.x = pointer.x - group.x;
                group.scene.stickyOffset.y = pointer.y - group.y;
                group.scene.children.bringToTop(group);
                group.scene.stickyActive = true;
                // Fade out Try Again or Nice! message
                const msg = document.getElementById('message');
                if (msg.textContent === 'Try Again' || msg.textContent === 'Nice!') {
                    msg.style.transition = 'opacity 0.3s';
                    msg.style.opacity = 0;
                    if (group.scene._tryAgainTimeout) clearTimeout(group.scene._tryAgainTimeout);
                    if (group.scene._fadeMsgTimeout) clearTimeout(group.scene._fadeMsgTimeout);
                    group.scene._fadeMsgTimeout = setTimeout(() => {
                        msg.textContent = '';
                        msg.className = '';
                        msg.style.opacity = 1;
                    }, 300);
                } else {
                    msg.textContent = '';
                    msg.className = '';
                    msg.style.opacity = 1;
                }
            }
        });
        this.towers.push(group);
    }

    // Enable input for sticky click
    this.input.on('pointermove', (pointer) => {
        if (this.stickySelected) {
            this.stickySelected.x = pointer.x - this.stickyOffset.x;
            this.stickySelected.y = pointer.y - this.stickyOffset.y;
        }
    });
    this.input.on('pointerup', (pointer) => {
        if (this.stickySelected && typeof this.tryStickyDrop === 'function') {
            this.tryStickyDrop(pointer);
        }
    });

    // Reset button
    document.getElementById('reset-button').onclick = () => {
        this.scene.restart();
        document.getElementById('message').textContent = '';
        document.getElementById('reset-button').style.display = 'none';
    };
}

function update() {}

function checkWin() {
    if (this.nextSlot === 5) {
        document.getElementById('message').textContent = 'Stairs completed!';
        document.getElementById('message').className = 'success';
        document.getElementById('reset-button').style.display = 'inline-block';
    }
} 