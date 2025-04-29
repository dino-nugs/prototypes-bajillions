class TowerGame {
    constructor() {
        this.gameConfig = {
            type: Phaser.AUTO,
            width: 800,
            height: 400,
            parent: 'phaser-game',
            backgroundColor: '#f0f0f0',
            scene: {
                preload: this.preload.bind(this),
                create: this.create.bind(this),
                update: this.update.bind(this)
            }
        };
        
        this.towers = [];
        this.slots = []; // Stores the x-coordinates of the slots
        this.towerSlotMap = new Map(); // Maps tower object to its current slot index
        this.slotOccupancy = new Map(); // Maps slot index to the tower occupying it (or null)
        
        this.selectedTower = null;
        this.originalSlotIndex = -1;
        this.dragging = false;
        this.gameOver = false; // Flag to disable interaction
        this.sortDirection = 'asc'; // Default, will be randomized
        this.animal = null;
        this.game = new Phaser.Game(this.gameConfig);
        
        // Button references
        this.checkButton = document.getElementById('check-button');
        this.restartButton = document.getElementById('restart-button');
        this.messageElement = document.getElementById('message');
        this.promptElement = document.getElementById('prompt-text'); // Reference prompt element

        // Updated button listener
        this.checkButton.addEventListener('click', () => {
            if (this.gameOver) {
                this.restartGame();
            } else {
                this.checkAnswer();
            }
        });
    }
    
    preload() {
        this.scene = this.game.scene.scenes[0];
    }
    
    create() {
        this.scene = this.game.scene.scenes[0];
        
        // Define slot positions
        this.slots = [150, 250, 350, 450, 550];
        this.slots.forEach((_, index) => this.slotOccupancy.set(index, null));
        
        this.initializeGame(); // Call initializeGame which now handles randomization
        this.createAnimal();
        
        this.setupInputListeners(); // Keep input setup separate
    }
    
    initializeGame() {
        this.towers.forEach(tower => tower.destroy());
        this.towers = [];
        this.towerSlotMap.clear();
        this.slotOccupancy.clear();
        this.slots.forEach((_, index) => this.slotOccupancy.set(index, null));

        // Randomize sort direction
        this.sortDirection = (Math.random() < 0.5) ? 'asc' : 'desc';
        console.log("Sorting direction:", this.sortDirection);

        // Update prompt text
        this.promptElement.textContent = `Sort: ${this.sortDirection === 'asc' ? 'Smallest to Largest' : 'Largest to Smallest'}`;

        const heights = [1, 2, 3, 4, 5];
        let shuffledHeights;
        let isSortedInitially = false;

        // Shuffle until not initially sorted correctly
        do {
            shuffledHeights = [...heights].sort(() => Math.random() - 0.5);
            // Check if it matches the CURRENT required sort order
            const expectedOrder = this.sortDirection === 'asc' ? heights : [...heights].reverse();
            isSortedInitially = shuffledHeights.every((h, i) => h === expectedOrder[i]);
            if (isSortedInitially) {
                 console.log("Initial shuffle was already solved, reshuffling...");
            }
        } while (isSortedInitially);

        shuffledHeights.forEach((height, index) => {
            const xPosition = this.slots[index];
            const tower = this.createTower(height, xPosition);
            this.towerSlotMap.set(tower, index);
            this.slotOccupancy.set(index, tower);
        });

        this.gameOver = false;
        this.messageElement.textContent = '';
        this.messageElement.className = '';
        this.checkButton.textContent = 'Check Answer';
        if (this.animal) {
            this.animal.setVisible(false);
            this.scene.tweens.killTweensOf(this.animal);
        }
    }
    
    setupInputListeners() {
        this.input = this.scene.input;
        
        this.input.on('pointerdown', (pointer) => {
            if (this.dragging || this.gameOver) return; // Prevent interaction if game is over
            
            for (let tower of this.towers) {
                // Check bounds including children
                 const bounds = tower.getBounds(); // Simple check, might need refinement for complex shapes
                if (pointer.x >= bounds.left && pointer.x <= bounds.right && 
                    pointer.y >= bounds.top && pointer.y <= bounds.bottom) {
                    
                    this.selectedTower = tower;
                    this.originalSlotIndex = this.towerSlotMap.get(tower);
                    this.dragging = true;
                    this.highlightTower(tower, true);
                    this.scene.children.bringToTop(tower);
                    break;
                }
            }
        });
        
        this.input.on('pointermove', (pointer) => {
            if (this.dragging && this.selectedTower) {
                this.selectedTower.x = pointer.x;
            }
        });
        
        this.input.on('pointerup', (pointer) => {
            if (this.dragging && this.selectedTower) {
                const dropX = pointer.x;
                let targetSlotIndex = -1;
                let minDistance = Number.MAX_VALUE;

                this.slots.forEach((slotX, index) => {
                    const distance = Math.abs(dropX - slotX);
                    if (distance < minDistance) {
                        minDistance = distance;
                        targetSlotIndex = index;
                    }
                });

                const towerInTargetSlot = this.slotOccupancy.get(targetSlotIndex);
                const originalTowerX = this.slots[this.originalSlotIndex];

                if (targetSlotIndex !== this.originalSlotIndex) {
                    if (towerInTargetSlot) {
                        const targetTowerX = this.slots[targetSlotIndex];
                        this.towerSlotMap.set(this.selectedTower, targetSlotIndex);
                        this.slotOccupancy.set(targetSlotIndex, this.selectedTower);
                        this.towerSlotMap.set(towerInTargetSlot, this.originalSlotIndex);
                        this.slotOccupancy.set(this.originalSlotIndex, towerInTargetSlot);
                        this.animateTowerMove(this.selectedTower, targetTowerX);
                        this.animateTowerMove(towerInTargetSlot, originalTowerX);
                    } else {
                        const targetTowerX = this.slots[targetSlotIndex];
                        this.towerSlotMap.set(this.selectedTower, targetSlotIndex);
                        this.slotOccupancy.set(targetSlotIndex, this.selectedTower);
                        this.slotOccupancy.set(this.originalSlotIndex, null);
                        this.animateTowerMove(this.selectedTower, targetTowerX);
                    }
                } else {
                    this.animateTowerMove(this.selectedTower, originalTowerX);
                }
                
                this.highlightTower(this.selectedTower, false);
                this.selectedTower = null;
                this.dragging = false;
                this.originalSlotIndex = -1;
            }
        });
    }
    
    animateTowerMove(tower, targetX) {
        this.scene.tweens.add({
            targets: tower,
            x: targetX,
            y: tower.getData('originalY'),
            duration: 200,
            ease: 'Power2'
        });
    }
    
    createAnimal() {
        const squirrelGroup = this.scene.add.container(0, 0);
        const body = this.scene.add.circle(0, 0, 15, 0x8B4513);
        const head = this.scene.add.circle(5, -18, 12, 0x8B4513);
        const tail = this.scene.add.graphics();
        tail.fillStyle(0x8B4513, 1);
        tail.beginPath();
        tail.moveTo(-5, 0);
        tail.lineTo(-30, -15);
        tail.lineTo(-25, 5);
        tail.lineTo(-5, 0);
        tail.closePath();
        tail.fill();
        const eye = this.scene.add.circle(10, -20, 3, 0x000000);
        squirrelGroup.add([tail, body, head, eye]);
        squirrelGroup.setVisible(false);
        this.animal = squirrelGroup;
    }
    
    runVictoryAnimation() {
        this.gameOver = true;
        this.messageElement.textContent = 'Correct! Well done!';
        this.messageElement.className = 'success';

        if (!this.animal) return;

        const slideDuration = 1200;
        const blockSize = 50;
        const yBase = this.game.config.height - 50;
        const squirrelOffsetY = 65; // How much higher the squirrel is above the tower's top-center

        let startX, startY, endX, endY;

        if (this.sortDirection === 'asc') {
            // Slide UP (Smallest to Largest)
            const firstTowerHeight = 1;
            const firstTowerTopCenterY = yBase - (firstTowerHeight - 1) * blockSize - blockSize / 2;
            startX = this.slots[0];
            startY = firstTowerTopCenterY - squirrelOffsetY;

            const lastTowerHeight = 5;
            const lastTowerTopCenterY = yBase - (lastTowerHeight - 1) * blockSize - blockSize / 2;
            endX = this.slots[4];
            endY = lastTowerTopCenterY - squirrelOffsetY;
        } else {
            // Slide DOWN (Largest to Smallest)
            const firstTowerHeight = 5; // Descending starts at tallest
            const firstTowerTopCenterY = yBase - (firstTowerHeight - 1) * blockSize - blockSize / 2;
            startX = this.slots[0]; // Still starts at the leftmost slot
            startY = firstTowerTopCenterY - squirrelOffsetY; // Start high

            const lastTowerHeight = 1; // Descending ends at shortest
            const lastTowerTopCenterY = yBase - (lastTowerHeight - 1) * blockSize - blockSize / 2;
            endX = this.slots[4]; // Still ends at the rightmost slot
            endY = lastTowerTopCenterY - squirrelOffsetY; // End low
        }

        this.animal.setPosition(startX, startY); // Set initial position correctly
        this.animal.setVisible(true);
        this.animal.setAngle(0);

        this.scene.tweens.add({
            targets: this.animal,
            x: endX,
            y: endY,
            duration: slideDuration,
            ease: 'Power2',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: this.animal,
                    angle: { from: -25, to: 25 },
                    duration: 70,
                    ease: 'Linear',
                    yoyo: true,
                    repeat: 7,
                    delay: 50,
                    onComplete: () => {
                        this.checkButton.textContent = 'Play Again';
                    }
                });
            }
        });
    }
    
    highlightTower(tower, highlight) {
        tower.each((block) => {
            if (block.type === 'Rectangle') {
                block.fillColor = highlight ? 0x666699 : 0x3f51b5;
            }
        });
    }
    
    update() {}
    
    createTower(height, xPosition) {
        const blockSize = 50;
        const yBase = this.game.config.height - 50;
        const tower = this.scene.add.container(xPosition, yBase);
        tower.setSize(blockSize, height * blockSize);
        tower.setInteractive(); // Make container interactive for bounds check
        tower.setData('height', height);
        tower.setData('originalY', yBase);
        
        for (let i = 0; i < height; i++) {
            const block = this.scene.add.rectangle(0, -i * blockSize - blockSize/2, blockSize, blockSize, 0x3f51b5);
            block.setStrokeStyle(2, 0x2a3990);
            tower.add(block);
        }
        
        this.towers.push(tower);
        return tower;
    }
    
    checkAnswer() {
        if (this.gameOver) return;

        const currentOrderHeights = this.slots.map((_, index) => {
            const tower = this.slotOccupancy.get(index);
            return tower ? tower.getData('height') : 0;
        });

        // Determine the expected order based on the current sortDirection
        const expectedOrder = this.sortDirection === 'asc'
            ? [1, 2, 3, 4, 5]
            : [5, 4, 3, 2, 1];

        // Check if the current order matches the expected order
        const isCorrect = currentOrderHeights.every((height, index) => height === expectedOrder[index]);

        if (isCorrect) {
            this.runVictoryAnimation();
        } else {
            this.messageElement.textContent = 'Not quite right. Try again!';
            this.messageElement.className = 'error';
        }
    }

    restartGame() {
        console.log("Restarting game...");
        this.initializeGame();
    }
}

window.addEventListener('load', () => {
    new TowerGame();
}); 