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
        this.selectedTower = null;
        this.dragging = false;
        this.game = new Phaser.Game(this.gameConfig);
        
        // Setup check button click listener outside of Phaser
        document.getElementById('check-button').addEventListener('click', () => {
            this.checkAnswer();
        });
    }
    
    preload() {
        // Load any assets if needed
    }
    
    create() {
        this.scene = this.game.scene.scenes[0];
        
        // Create towers at specific positions
        const positions = [150, 250, 350, 450, 550];
        const heights = [1, 2, 3, 4, 5];
        const shuffledHeights = [...heights].sort(() => Math.random() - 0.5);
        
        shuffledHeights.forEach((height, index) => {
            this.createTower(height, positions[index]);
        });
        
        // Simple mouse-based drag instead of Phaser's built-in drag
        this.input = this.scene.input;
        
        this.input.on('pointerdown', (pointer) => {
            if (this.dragging) return;
            
            // Find if we clicked on a tower
            for (let tower of this.towers) {
                const bounds = tower.getBounds();
                if (pointer.x >= bounds.left && pointer.x <= bounds.right && 
                    pointer.y >= bounds.top && pointer.y <= bounds.bottom) {
                    this.selectedTower = tower;
                    this.dragging = true;
                    
                    // Change appearance to indicate selection
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
        
        this.input.on('pointerup', () => {
            if (this.dragging && this.selectedTower) {
                // Snap to nearest valid position
                const positions = [150, 250, 350, 450, 550];
                const closestPosition = positions.reduce((prev, curr) => {
                    return Math.abs(curr - this.selectedTower.x) < Math.abs(prev - this.selectedTower.x) ? curr : prev;
                });
                
                this.selectedTower.x = closestPosition;
                
                // Remove highlight
                this.highlightTower(this.selectedTower, false);
                
                this.selectedTower = null;
                this.dragging = false;
            }
        });
    }
    
    highlightTower(tower, highlight) {
        // Change the color of all blocks in the tower
        tower.each((block) => {
            if (block.type === 'Rectangle') {
                if (highlight) {
                    block.fillColor = 0x666699; // Highlight color
                } else {
                    block.fillColor = 0x3f51b5; // Original color
                }
            }
        });
    }
    
    update() {
        // Not needed for this simple game
    }
    
    createTower(height, xPosition) {
        const blockSize = 50; // Uniform square size for blocks
        const yBase = this.game.config.height - 50;
        
        // Create a container for the tower
        const tower = this.scene.add.container(xPosition, yBase);
        tower.setSize(blockSize, height * blockSize);
        tower.setData('height', height);
        tower.setData('originalY', yBase);
        
        // Create blocks for the tower
        for (let i = 0; i < height; i++) {
            const block = this.scene.add.rectangle(
                0, 
                -i * blockSize - blockSize/2, // Center the block vertically within its position
                blockSize, 
                blockSize, 
                0x3f51b5
            );
            
            // Add shading/highlighting for 3D effect
            block.setStrokeStyle(2, 0x2a3990);
            
            tower.add(block);
        }
        
        this.towers.push(tower);
        return tower;
    }
    
    checkAnswer() {
        const messageElement = document.getElementById('message');
        const currentOrder = this.towers
            .slice()
            .sort((a, b) => a.x - b.x)
            .map(tower => tower.getData('height'));
        
        const isCorrect = currentOrder.every((height, index) => height === index + 1);
        
        if (isCorrect) {
            messageElement.textContent = 'Correct! Well done!';
            messageElement.className = 'success';
        } else {
            messageElement.textContent = 'Not quite right. Try again!';
            messageElement.className = 'error';
        }
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new TowerGame();
}); 