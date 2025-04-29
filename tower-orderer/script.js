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
            },
            physics: {
                default: 'arcade',
                arcade: {
                    debug: false
                }
            }
        };
        
        this.towers = [];
        this.selectedTower = null;
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
        
        // Setup input handling with improved drag functionality
        this.input = this.scene.input;
        
        this.input.on('dragstart', (pointer, gameObject) => {
            gameObject.setTint(0x999999);
            this.selectedTower = gameObject;
            this.scene.children.bringToTop(gameObject);
        });
        
        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            gameObject.x = dragX;
            gameObject.y = gameObject.getData('originalY');
        });
        
        this.input.on('dragend', (pointer, gameObject) => {
            gameObject.clearTint();
            
            // Snap to nearest valid position
            const positions = [150, 250, 350, 450, 550];
            const closestPosition = positions.reduce((prev, curr) => {
                return Math.abs(curr - gameObject.x) < Math.abs(prev - gameObject.x) ? curr : prev;
            });
            
            gameObject.x = closestPosition;
            this.selectedTower = null;
        });
    }
    
    update() {
        // Phaser's update loop - not needed for this simple game
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
        
        // Make the tower draggable
        this.scene.input.setDraggable(tower);
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