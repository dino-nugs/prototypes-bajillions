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
const SLOT_X_GAP = 50;
const TOWER_WIDTH = 50;
const TOWER_UNIT = 50;
const TOWER_COLOR = '#8ecae6';
const TOWER_COLOR_CORRECT = 0x4CAF50; // Green

// New variable for tray spacing
const TRAY_X_GAP = 100;

let game = new Phaser.Game(config);

function preload() {
    this.load.image('kiki', 'kiki.png');
}

function create() {
    this.towers = [];
    this.trayY = 250;
    this.placed = [null, null, null, null, null]; // towers in slots (null if empty)
    this.slotLines = [];
    this.stickySelected = null;
    this.stickyOffset = { x: 0, y: 0 };
    this.stickyActive = false;
    this._tryAgainTimeout = null;
    this._fadeMsgTimeout = null;
    this.locked = false; // lock all towers when win

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

    // Center the slot lines and drop zones
    const slotTotalWidth = (5 - 1) * SLOT_X_GAP;
    const slotStartX = config.width / 2 - slotTotalWidth / 2;
    // Center the tray towers
    const trayTotalWidth = (5 - 1) * TRAY_X_GAP;
    const trayStartX = config.width / 2 - trayTotalWidth / 2;

    // Create slots (as horizontal lines)
    for (let i = 0; i < 5; i++) {
        let slot = this.add.line(
            slotStartX + i * SLOT_X_GAP + 5,
            SLOT_Y,
            -25, 0,
            5, 0,
            0xCFCFCF,
            1
        ).setLineWidth(3);
        slot.setData('index', i);
        this.slotLines.push(slot);

        // Add visible drop zone rectangle
        let dropZone = this.add.rectangle(
            slotStartX + i * SLOT_X_GAP - 25, // Apply same offset as tower placement
            SLOT_Y - 60, // Center point between dropAreaTop and dropAreaBottom
            TOWER_WIDTH,  // Width matches the detection zone
            120,         // Height matches dropAreaBottom - dropAreaTop
            0x00ff00,    // Green color
            0            // Fully transparent
        );
        dropZone.setOrigin(0.5, 0.5);
    }

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
        group.setPosition(trayStartX + i * TRAY_X_GAP, this.trayY);
        group.setData('size', size);
        group.setData('fromTray', true);
        group.setData('index', i);
        group.setData('slot', null); // which slot it's in, or null for tray
        // Sticky click: pointerdown to pick up
        hitRect.on('pointerdown', (pointer) => {
            if (this.locked) return;
            this.stickySelected = group;
            this.stickyOffset.x = pointer.x - group.x;
            this.stickyOffset.y = pointer.y - group.y;
            this.children.bringToTop(group);
            this.stickyActive = true;
            // Fade out Try Again or Nice! message
            const msg = document.getElementById('message');
            if (msg.textContent === 'Try Again' || msg.textContent === 'Nice!' || msg.textContent === 'Stairs completed!') {
                msg.style.transition = 'opacity 0.3s';
                msg.style.opacity = 0;
                if (this._tryAgainTimeout) clearTimeout(this._tryAgainTimeout);
                if (this._fadeMsgTimeout) clearTimeout(this._fadeMsgTimeout);
                this._fadeMsgTimeout = setTimeout(() => {
                    msg.textContent = '';
                    msg.className = '';
                    msg.style.opacity = 1;
                }, 300);
            } else {
                msg.textContent = '';
                msg.className = '';
                msg.style.opacity = 1;
            }
        });
        this.towers.push(group);
    }

    // Enable input for sticky click
    this.input.on('pointermove', (pointer) => {
        if (this.stickySelected && !this.locked) {
            this.stickySelected.x = pointer.x - this.stickyOffset.x;
            this.stickySelected.y = pointer.y - this.stickyOffset.y;
        }
    });
    this.input.on('pointerup', (pointer) => {
        if (this.stickySelected && !this.locked) {
            this.tryStickyDrop(pointer);
        }
    });

    // Attach tryStickyDrop as a method on the scene
    this.tryStickyDrop = function(pointer) {
        let gameObject = this.stickySelected;
        if (!gameObject) return;
        // Check if dropped in a slot
        let droppedInSlot = false;
        for (let i = 0; i < 5; i++) {
            let slot = this.slotLines[i];
            let slotX = slot.x - 25; // Apply same offset as drop zone and tower placement
            let slotY = slot.y;
            // Drop zone bounds
            let dzLeft = slotX - TOWER_WIDTH / 2;
            let dzRight = slotX + TOWER_WIDTH / 2;
            let dzTop = slotY - 120;
            let dzBottom = slotY;
            // Tower bounds
            let towerLeft = gameObject.x - gameObject.width / 2;
            let towerRight = gameObject.x + gameObject.width / 2;
            let towerTop = gameObject.y - gameObject.height / 2;
            let towerBottom = gameObject.y + gameObject.height / 2;
            // Check for bounding box overlap
            let inSlot = (
                towerLeft < dzRight &&
                towerRight > dzLeft &&
                towerTop < dzBottom &&
                towerBottom > dzTop
            );
            if (inSlot) {
                if (!this.placed[i]) {
                    // Remove from previous slot if any
                    if (gameObject.getData('slot') !== null) {
                        this.placed[gameObject.getData('slot')] = null;
                    }
                    // Place in slot
                    gameObject.x = slotX;
                    gameObject.y = slotY - 38;
                    this.placed[i] = gameObject;
                    gameObject.setData('slot', i);
                    droppedInSlot = true;
                    break;
                } else if (this.placed[i] !== gameObject) {
                    // Swap towers
                    let otherTower = this.placed[i];
                    let prevSlot = gameObject.getData('slot');
                    // Move the other tower to the previous slot (or tray if none)
                    if (prevSlot !== null) {
                        let prevSlotLine = this.slotLines[prevSlot];
                        let prevSlotX = prevSlotLine.x - 25;
                        let prevSlotY = prevSlotLine.y;
                        otherTower.x = prevSlotX;
                        otherTower.y = prevSlotY - 38;
                        this.placed[prevSlot] = otherTower;
                        otherTower.setData('slot', prevSlot);
                    } else {
                        // Move to tray
                        let trayIndex = otherTower.getData('index');
                        otherTower.x = this.cameras.main.width / 2 - (5 - 1) * TRAY_X_GAP / 2 + trayIndex * TRAY_X_GAP;
                        otherTower.y = this.trayY;
                        otherTower.setData('slot', null);
                    }
                    // Place dragged tower in this slot
                    gameObject.x = slotX;
                    gameObject.y = slotY - 38;
                    this.placed[i] = gameObject;
                    gameObject.setData('slot', i);
                    droppedInSlot = true;
                    break;
                }
            }
        }
        if (!droppedInSlot) {
            // Return to tray
            if (gameObject.getData('slot') !== null) {
                this.placed[gameObject.getData('slot')] = null;
            }
            let trayIndex = gameObject.getData('index');
            gameObject.x = this.cameras.main.width / 2 - (5 - 1) * TRAY_X_GAP / 2 + trayIndex * TRAY_X_GAP;
            gameObject.y = this.trayY;
            gameObject.setData('slot', null);
        }
        this.stickySelected = null;
        this.stickyActive = false;
        updateDoneButton();
    };

    // Update done button state
    function updateDoneButton() {
        const doneBtn = document.getElementById('done-button');
        if (this.placed.every(t => t)) {
            doneBtn.disabled = false;
        } else {
            doneBtn.disabled = true;
        }
    }
    updateDoneButton = updateDoneButton.bind(this);

    // Done button logic
    const doneBtn = document.getElementById('done-button');
    doneBtn.onclick = () => {
        if (doneBtn.disabled) return;
        // Check if staircase is correct (ascending order left to right)
        let correct = true;
        for (let i = 0; i < 5; i++) {
            if (!this.placed[i] || this.placed[i].getData('size') !== i) {
                correct = false;
                break;
            }
        }
        if (correct) {
            // Lock towers
            this.locked = true;
            // Color towers green and show kiki on last
            for (let i = 0; i < 5; i++) {
                this.placed[i].list.forEach(block => block.setFillStyle(TOWER_COLOR_CORRECT));
                // Remove kiki from all
                if (this.placed[i].getData('kikiSprite')) {
                    this.placed[i].getData('kikiSprite').destroy();
                    this.placed[i].setData('kikiSprite', null);
                }
            }
            // Show kiki on last tower
            let last = this.placed[4];
            if (!last.getData('kikiSprite')) {
                const kikiHeight = 40;
                const size = last.getData('size');
                const kikiY = -size * TOWER_UNIT - 5 - kikiHeight / 2 - 40;
                const kiki = this.add.image(0, kikiY, 'kiki');
                kiki.setOrigin(0.5, 0.5);
                kiki.setDisplaySize(65, 65);
                last.add(kiki);
                last.setData('kikiSprite', kiki);
            }
            // Fade out slot lines
            this.slotLines.forEach(line => {
                this.tweens.add({
                    targets: line,
                    alpha: 0,
                    duration: 600,
                    ease: 'Cubic.easeInOut'
                });
            });
            document.getElementById('message').textContent = 'Stairs completed!';
            document.getElementById('message').className = 'success';
            doneBtn.style.display = 'none';
            document.getElementById('reset-button').style.display = 'inline-block';
        } else {
            document.getElementById('message').textContent = 'Not quite right. Try again!';
            document.getElementById('message').className = 'error';
        }
    };

    // Reset button
    document.getElementById('reset-button').onclick = () => {
        window.location.reload();
    };
}

function update() {} 