// Tetris Game Logic
document.addEventListener('DOMContentLoaded', function() {
    const BOARD_WIDTH = 10;
    const BOARD_HEIGHT = 20;
    const TETROMINOS = {
        'I': {
            shape: [
                [0, 0, 0, 0],
                [1, 1, 1, 1],
                [0, 0, 0, 0],
                [0, 0, 0, 0]
            ],
            color: 'i'
        },
        'O': {
            shape: [
                [1, 1],
                [1, 1]
            ],
            color: 'o'
        },
        'T': {
            shape: [
                [0, 1, 0],
                [1, 1, 1],
                [0, 0, 0]
            ],
            color: 't'
        },
        'S': {
            shape: [
                [0, 1, 1],
                [1, 1, 0],
                [0, 0, 0]
            ],
            color: 's'
        },
        'Z': {
            shape: [
                [1, 1, 0],
                [0, 1, 1],
                [0, 0, 0]
            ],
            color: 'z'
        },
        'J': {
            shape: [
                [1, 0, 0],
                [1, 1, 1],
                [0, 0, 0]
            ],
            color: 'j'
        },
        'L': {
            shape: [
                [0, 0, 1],
                [1, 1, 1],
                [0, 0, 0]
            ],
            color: 'l'
        }
    };

    let board = [];
    let currentPiece = null;
    let nextPiece = null;
    let holdPiece = null;
    let canHold = true;
    let gameOver = false;
    let score = 0;
    let level = 1;
    let dropInterval;
    let dropSpeed = 1000;
    let pieceBag = [];
    let pieceHistory = [];
    let highScore = localStorage.getItem('tetris-high-score') || 0;
    let keyStates = {
        left: false,
        right: false,
        down: false
    };
    let moveInterval;
    let moveDelay = 170;
    let moveRepeat = 50;
    let initialMoveDone = {
        left: false,
        right: false,
        down: false
    };
    let showGhost = true;

    const gameBoard = document.getElementById('gameBoard');
    const nextPieceBoard = document.getElementById('nextPiece');
    const holdPieceBoard = document.getElementById('holdPiece');
    const scoreDisplay = document.getElementById('score');
    const levelDisplay = document.getElementById('level');
    const newGameBtn = document.getElementById('newGame');
    const gameOverScreen = document.getElementById('gameOver');
    const tryAgainBtn = document.getElementById('tryAgain');
    const ghostToggle = document.getElementById('ghostToggle');
    const highScoreDisplay = document.getElementById('highScore');

    highScoreDisplay.textContent = highScore;

    ghostToggle.addEventListener('change', () => {
        showGhost = ghostToggle.checked;
        updateBoard();
    });

    // Set up initial event listener for new game button
    newGameBtn.addEventListener('click', startGame);

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function getNextPieceFromBag() {
        if (pieceBag.length === 0) {
            const allPieces = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
            pieceBag = shuffleArray([...allPieces]);
            
            if (pieceHistory.length > 0) {
                const lastPiece = pieceHistory[pieceHistory.length - 1];
                if (pieceBag[0] === lastPiece) {
                    const randomIndex = Math.floor(Math.random() * (pieceBag.length - 1)) + 1;
                    [pieceBag[0], pieceBag[randomIndex]] = [pieceBag[randomIndex], pieceBag[0]];
                }
            }
        }
        const piece = pieceBag.pop();
        pieceHistory.push(piece);
        if (pieceHistory.length > 7) {
            pieceHistory.shift();
        }
        return piece;
    }

    function handleKeyDown(e) {
        if (gameOver) return;
        const now = Date.now();

        switch (e.key.toLowerCase()) {
            case 'a':
                keyStates.left = true;
                if (!initialMoveDone.left) {
                    movePiece(-1, 0);
                    initialMoveDone.left = true;
                    setTimeout(() => {
                        if (keyStates.left) {
                            moveInterval = setInterval(() => {
                                if (keyStates.left) movePiece(-1, 0);
                                if (keyStates.right) movePiece(1, 0);
                                if (keyStates.down) movePiece(0, 1);
                            }, moveRepeat);
                        }
                    }, moveDelay);
                }
                break;
            case 'd':
                keyStates.right = true;
                if (!initialMoveDone.right) {
                    movePiece(1, 0);
                    initialMoveDone.right = true;
                    setTimeout(() => {
                        if (keyStates.right) {
                            moveInterval = setInterval(() => {
                                if (keyStates.left) movePiece(-1, 0);
                                if (keyStates.right) movePiece(1, 0);
                                if (keyStates.down) movePiece(0, 1);
                            }, moveRepeat);
                        }
                    }, moveDelay);
                }
                break;
            case 's':
                keyStates.down = true;
                if (!initialMoveDone.down) {
                    movePiece(0, 1);
                    initialMoveDone.down = true;
                    setTimeout(() => {
                        if (keyStates.down) {
                            moveInterval = setInterval(() => {
                                if (keyStates.left) movePiece(-1, 0);
                                if (keyStates.right) movePiece(1, 0);
                                if (keyStates.down) movePiece(0, 1);
                            }, moveRepeat);
                        }
                    }, moveDelay);
                }
                break;
            case 'w':
                rotatePiece();
                break;
            case 'c':
                holdCurrentPiece();
                break;
            case ' ':
                hardDrop();
                break;
        }
    }

    function handleKeyUp(e) {
        switch (e.key.toLowerCase()) {
            case 'a':
                keyStates.left = false;
                initialMoveDone.left = false;
                break;
            case 'd':
                keyStates.right = false;
                initialMoveDone.right = false;
                break;
            case 's':
                keyStates.down = false;
                initialMoveDone.down = false;
                break;
        }

        if (!keyStates.left && !keyStates.right && !keyStates.down) {
            clearInterval(moveInterval);
            moveInterval = null;
        }
    }

    function initBoard() {
        board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
        gameOver = false;
        score = 0;
        level = 1;
        dropSpeed = 1000;
        holdPiece = null;
        canHold = true;
        currentPiece = null;
        nextPiece = null;
        pieceBag = [];
        pieceHistory = [];
        keyStates = { left: false, right: false, down: false };
        initialMoveDone = { left: false, right: false, down: false };
        showGhost = true;
        ghostToggle.checked = true;
        
        clearInterval(dropInterval);
        clearInterval(moveInterval);
        moveInterval = null;
        scoreDisplay.textContent = '0';
        levelDisplay.textContent = '1';
        
        gameBoard.innerHTML = '';
        gameOverScreen.className = 'game-over';
        holdPieceBoard.innerHTML = '';
        nextPieceBoard.innerHTML = '';

        for (let row = 0; row < BOARD_HEIGHT; row++) {
            for (let col = 0; col < BOARD_WIDTH; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                gameBoard.appendChild(cell);
            }
        }

        gameBoard.appendChild(gameOverScreen);
        tryAgainBtn.addEventListener('click', initBoard);

        spawnPiece();
        updateBoard();
        
        // Remove focus from any buttons to prevent spacebar interference
        const buttonElement = document.getElementById('newGame');
        if (buttonElement) {
            buttonElement.blur();
        }
        
        startDrop();
    }

    function spawnPiece() {
        const pieceType = getNextPieceFromBag();
        
        if (nextPiece) {
            currentPiece = {
                shape: nextPiece.shape,
                color: nextPiece.color,
                x: Math.floor(BOARD_WIDTH / 2) - Math.floor(nextPiece.shape[0].length / 2),
                y: 0
            };
        } else {
            currentPiece = {
                shape: TETROMINOS[pieceType].shape,
                color: TETROMINOS[pieceType].color,
                x: Math.floor(BOARD_WIDTH / 2) - Math.floor(TETROMINOS[pieceType].shape[0].length / 2),
                y: 0
            };
        }

        const nextPieceType = getNextPieceFromBag();
        nextPiece = {
            shape: TETROMINOS[nextPieceType].shape,
            color: TETROMINOS[nextPieceType].color,
            x: 0,
            y: 0
        };

        canHold = true;
        updateNextPiece();
    }

    function updateNextPiece() {
        nextPieceBoard.innerHTML = '';
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                if (row < nextPiece.shape.length && col < nextPiece.shape[0].length && nextPiece.shape[row][col]) {
                    cell.classList.add(nextPiece.color);
                }
                nextPieceBoard.appendChild(cell);
            }
        }
    }

    function updateHoldPiece() {
        holdPieceBoard.innerHTML = '';
        if (holdPiece) {
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col < 4; col++) {
                    const cell = document.createElement('div');
                    cell.className = 'cell';
                    if (row < holdPiece.shape.length && col < holdPiece.shape[0].length && holdPiece.shape[row][col]) {
                        cell.classList.add(holdPiece.color);
                    }
                    holdPieceBoard.appendChild(cell);
                }
            }
        }
    }

    function getGhostPosition() {
        if (!currentPiece) return null;
        
        let ghostY = currentPiece.y;
        while (!checkCollisionAt(currentPiece.x, ghostY + 1)) {
            ghostY++;
        }
        return { x: currentPiece.x, y: ghostY };
    }

    function checkCollisionAt(x, y) {
        for (let row = 0; row < currentPiece.shape.length; row++) {
            for (let col = 0; col < currentPiece.shape[0].length; col++) {
                if (currentPiece.shape[row][col]) {
                    const boardRow = y + row;
                    const boardCol = x + col;
                    if (boardRow >= BOARD_HEIGHT || boardCol < 0 || boardCol >= BOARD_WIDTH || 
                        (boardRow >= 0 && board[boardRow][boardCol])) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function updateBoard() {
        const cells = gameBoard.getElementsByClassName('cell');
        const tempBoard = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(null));
        
        // First, mark all placed pieces
        for (let row = 0; row < BOARD_HEIGHT; row++) {
            for (let col = 0; col < BOARD_WIDTH; col++) {
                if (board[row][col]) {
                    tempBoard[row][col] = board[row][col];
                }
            }
        }

        // Then mark ghost piece positions if enabled
        if (currentPiece && showGhost) {
            const ghost = getGhostPosition();
            if (ghost) {
                for (let row = 0; row < currentPiece.shape.length; row++) {
                    for (let col = 0; col < currentPiece.shape[0].length; col++) {
                        if (currentPiece.shape[row][col]) {
                            const ghostRow = ghost.y + row;
                            const ghostCol = ghost.x + col;
                            if (ghostRow >= 0 && ghostRow < BOARD_HEIGHT && ghostCol >= 0 && ghostCol < BOARD_WIDTH) {
                                if (!tempBoard[ghostRow][ghostCol]) {
                                    tempBoard[ghostRow][ghostCol] = 'ghost-' + currentPiece.color;
                                }
                            }
                        }
                    }
                }
            }
        }

        // Finally mark current piece positions
        if (currentPiece) {
            for (let row = 0; row < currentPiece.shape.length; row++) {
                for (let col = 0; col < currentPiece.shape[0].length; col++) {
                    if (currentPiece.shape[row][col]) {
                        const boardRow = currentPiece.y + row;
                        const boardCol = currentPiece.x + col;
                        if (boardRow >= 0 && boardRow < BOARD_HEIGHT && boardCol >= 0 && boardCol < BOARD_WIDTH) {
                            tempBoard[boardRow][boardCol] = currentPiece.color;
                        }
                    }
                }
            }
        }

        // Now render everything in one pass
        for (let row = 0; row < BOARD_HEIGHT; row++) {
            for (let col = 0; col < BOARD_WIDTH; col++) {
                const cell = cells[row * BOARD_WIDTH + col];
                cell.className = 'cell';
                const cellContent = tempBoard[row][col];
                if (cellContent) {
                    if (cellContent.startsWith('ghost-')) {
                        cell.classList.add('ghost', cellContent.substring(6));
                    } else {
                        cell.classList.add(cellContent);
                    }
                }
            }
        }
    }

    function movePiece(dx, dy) {
        if (gameOver) return;

        currentPiece.x += dx;
        currentPiece.y += dy;

        if (checkCollision()) {
            currentPiece.x -= dx;
            currentPiece.y -= dy;
            if (dy > 0) {
                lockPiece();
                clearLines();
                spawnPiece();
                checkGameOver();
                keyStates = { left: false, right: false, down: false };
                initialMoveDone = { left: false, right: false, down: false };
                clearInterval(moveInterval);
                moveInterval = null;
            }
            return false;
        }

        updateBoard();
        return true;
    }

    function rotatePiece() {
        if (gameOver) return;

        const originalShape = currentPiece.shape;
        const rows = originalShape.length;
        const cols = originalShape[0].length;
        const newShape = Array(cols).fill().map(() => Array(rows).fill(0));

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                newShape[col][rows - 1 - row] = originalShape[row][col];
            }
        }

        currentPiece.shape = newShape;

        // Try wall kicks
        const kicks = [
            { x: 0, y: 0 },  // No kick
            { x: -1, y: 0 }, // Left kick
            { x: 1, y: 0 },  // Right kick
            { x: 0, y: -1 }, // Up kick
            { x: -2, y: 0 }, // Double left kick
            { x: 2, y: 0 }   // Double right kick
        ];

        let success = false;
        for (const kick of kicks) {
            currentPiece.x += kick.x;
            if (!checkCollision()) {
                success = true;
                break;
            }
            currentPiece.x -= kick.x;
        }

        if (!success) {
            currentPiece.shape = originalShape;
        } else {
            updateBoard();
        }
    }

    function checkCollision() {
        for (let row = 0; row < currentPiece.shape.length; row++) {
            for (let col = 0; col < currentPiece.shape[0].length; col++) {
                if (currentPiece.shape[row][col]) {
                    const boardRow = currentPiece.y + row;
                    const boardCol = currentPiece.x + col;
                    if (boardRow >= BOARD_HEIGHT || boardCol < 0 || boardCol >= BOARD_WIDTH || 
                        (boardRow >= 0 && board[boardRow][boardCol])) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function lockPiece() {
        for (let row = 0; row < currentPiece.shape.length; row++) {
            for (let col = 0; col < currentPiece.shape[0].length; col++) {
                if (currentPiece.shape[row][col]) {
                    const boardRow = currentPiece.y + row;
                    const boardCol = currentPiece.x + col;
                    if (boardRow >= 0) {
                        board[boardRow][boardCol] = currentPiece.color;
                    }
                }
            }
        }
    }

    function clearLines() {
        let linesCleared = 0;
        for (let row = BOARD_HEIGHT - 1; row >= 0; row--) {
            if (board[row].every(cell => cell !== 0)) {
                board.splice(row, 1);
                board.unshift(Array(BOARD_WIDTH).fill(0));
                linesCleared++;
                row++;
            }
        }

        if (linesCleared > 0) {
            score += linesCleared * 100 * level;
            scoreDisplay.textContent = score;

            if (score > highScore) {
                highScore = score;
                highScoreDisplay.textContent = highScore;
                localStorage.setItem('tetris-high-score', highScore);
            }

            if (score >= level * 1000) {
                level++;
                levelDisplay.textContent = level;
                dropSpeed = Math.max(50, Math.floor(1000 * Math.pow(0.8, level - 1)));
                clearInterval(dropInterval);
                startDrop();
            }
        }
    }

    function startDrop() {
        dropInterval = setInterval(() => {
            movePiece(0, 1);
        }, dropSpeed);
    }

    function holdCurrentPiece() {
        if (!canHold || gameOver) return;
        
        if (holdPiece) {
            const temp = currentPiece;
            currentPiece = {
                shape: holdPiece.shape,
                color: holdPiece.color,
                x: Math.floor(BOARD_WIDTH / 2) - Math.floor(holdPiece.shape[0].length / 2),
                y: 0
            };
            holdPiece = {
                shape: temp.shape,
                color: temp.color,
                x: 0,
                y: 0
            };
        } else {
            holdPiece = {
                shape: currentPiece.shape,
                color: currentPiece.color,
                x: 0,
                y: 0
            };
            currentPiece = {
                shape: nextPiece.shape,
                color: nextPiece.color,
                x: Math.floor(BOARD_WIDTH / 2) - Math.floor(nextPiece.shape[0].length / 2),
                y: 0
            };
            const nextPieceType = getNextPieceFromBag();
            nextPiece = {
                shape: TETROMINOS[nextPieceType].shape,
                color: TETROMINOS[nextPieceType].color,
                x: 0,
                y: 0
            };
            updateNextPiece();
        }

        canHold = false;
        updateHoldPiece();
        updateBoard();
    }

    function hardDrop() {
        if (gameOver) return;
        let dropDistance = 0;
        while (movePiece(0, 1)) {
            dropDistance++;
        }
        if (dropDistance > 0) {
            score += dropDistance;
            scoreDisplay.textContent = score;
            
            if (score > highScore) {
                highScore = score;
                highScoreDisplay.textContent = highScore;
                localStorage.setItem('tetris-high-score', highScore);
            }
        }
    }

    function checkGameOver() {
        if (checkCollision()) {
            gameOver = true;
            clearInterval(dropInterval);
            document.getElementById('finalScore').textContent = score;
            gameOverScreen.classList.add('show');
        }
    }

    function getRandomPiece() {
        const pieces = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
        const randomPiece = pieces[Math.floor(Math.random() * pieces.length)];
        return {
            shape: TETROMINOS[randomPiece].shape,
            color: TETROMINOS[randomPiece].color,
            x: 0,
            y: 0
        };
    }

    function renderBoard() {
        gameBoard.innerHTML = '';
        for (let row = 0; row < BOARD_HEIGHT; row++) {
            for (let col = 0; col < BOARD_WIDTH; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                gameBoard.appendChild(cell);
            }
        }
        gameBoard.appendChild(gameOverScreen);
    }

    function renderNext() {
        nextPieceBoard.innerHTML = '';
        if (nextPiece) {
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col < 4; col++) {
                    const cell = document.createElement('div');
                    cell.className = 'cell';
                    if (row < nextPiece.shape.length && col < nextPiece.shape[0].length && nextPiece.shape[row][col]) {
                        cell.classList.add(nextPiece.color);
                    }
                    nextPieceBoard.appendChild(cell);
                }
            }
        }
    }

    function renderHold() {
        holdPieceBoard.innerHTML = '';
    }

    function initBoardOnly() {
        // Initialize board without starting the game
        board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
        gameOver = false;
        score = 0;
        level = 1;
        dropSpeed = 1000;
        holdPiece = null;
        canHold = true;
        currentPiece = null;
        nextPiece = null;
        pieceBag = [];
        pieceHistory = [];
        keyStates = { left: false, right: false, down: false };
        initialMoveDone = { left: false, right: false, down: false };
        showGhost = true;
        
        // Update displays
        document.getElementById('score').textContent = score;
        document.getElementById('level').textContent = level;
        if (document.getElementById('lines')) {
            document.getElementById('lines').textContent = 0;
        }
        
        // Generate initial next piece for display
        nextPiece = getRandomPiece();
        
        // Clear displays
        renderBoard();
        renderNext();
        renderHold();
        
        // Update button text to "Start Game" - force the change
        const buttonElement = document.getElementById('newGame');
        if (buttonElement) {
            buttonElement.innerHTML = '<i class="fas fa-play"></i><span>Start Game</span>';
            
            // Remove any existing event listeners and add start game listener
            buttonElement.removeEventListener('click', initBoard);
            buttonElement.addEventListener('click', startGame);
        } else {
        }
    }

    function startGame() {
        // Start the actual game
        initBoard();
        
        // Change button back to "New Game"
        const buttonElement = document.getElementById('newGame');
        if (buttonElement) {
            buttonElement.innerHTML = '<i class="fas fa-redo"></i><span>New Game</span>';
            
            // Remove focus from button to prevent spacebar from triggering it
            buttonElement.blur();
            
            // Change button behavior back to restart
            buttonElement.removeEventListener('click', startGame);
            buttonElement.addEventListener('click', initBoard);
        }
    }

    // Setup initial event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Initialize empty board but don't start the game
    initBoardOnly();
});
