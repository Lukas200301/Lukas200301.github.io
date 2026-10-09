// Tetris Game Logic
document.addEventListener('DOMContentLoaded', function() {
    const BOARD_WIDTH = 10;
    const BOARD_HEIGHT = 20;
    const TETROMINOS = {
        'I': { shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: 'i' },
        'O': { shape: [[1, 1], [1, 1]], color: 'o' },
        'T': { shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: 't' },
        'S': { shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: 's' },
        'Z': { shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: 'z' },
        'J': { shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: 'j' },
        'L': { shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: 'l' }
    };

    let board = [];
    let currentPiece = null;
    let nextPiece = null;
    let holdPiece = null;
    let canHold = true;
    let state = 'idle';            // idle | running | paused | over
    let score = 0;
    let level = 1;
    let lines = 0;
    let dropInterval = null;
    let dropSpeed = 1000;
    let pieceBag = [];
    let pieceHistory = [];
    let highScore = 0;
    try { highScore = parseInt(localStorage.getItem('tetris-high-score'), 10) || 0; } catch (e) {}
    let keyStates = { left: false, right: false, down: false };
    let moveInterval = null;
    const moveDelay = 170;
    const moveRepeat = 50;
    let initialMoveDone = { left: false, right: false, down: false };
    let showGhost = true;

    const $ = (id) => document.getElementById(id);
    const gameBoard = $('gameBoard');
    const wrap = $('wrap');
    const nextPieceBoard = $('nextPiece');
    const holdPieceBoard = $('holdPiece');
    const ghostToggle = $('ghostToggle');
    const highScoreDisplay = $('highScore');
    const newGameBtn = $('newGame');
    const pauseBtn = $('pauseBtn');
    const msg = $('msg'), msgTitle = $('msgTitle'), msgText = $('msgText'), msgBtn = $('msgBtn');

    // ---------- stats ----------
    function setStat(id, value, pop) {
        const b = $(id);
        if (!b || b.textContent === String(value)) return;
        b.textContent = value;
        if (pop) {
            const tile = b.parentElement;
            tile.classList.remove('pop'); void tile.offsetWidth; tile.classList.add('pop');
        }
    }
    function updateStats(pop) {
        setStat('score', score, pop);
        setStat('level', level, pop);
        setStat('lines', lines, pop);
        setStat('best', highScore, false);
        if (highScoreDisplay) highScoreDisplay.textContent = highScore;
    }
    function bumpHighScore() {
        if (score > highScore) {
            highScore = score;
            try { localStorage.setItem('tetris-high-score', highScore); } catch (e) {}
        }
    }

    // ---------- overlay ----------
    function showMsg(title, text, btnIcon, btnText) {
        msgTitle.textContent = title;
        msgText.textContent = text;
        msgBtn.innerHTML = `<i class="fas fa-${btnIcon}"></i>${btnText}`;
        msg.hidden = false;
    }
    function hideMsg() { msg.hidden = true; }

    // ---------- piece bag ----------
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function getNextPieceFromBag() {
        if (pieceBag.length === 0) {
            pieceBag = shuffleArray(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);
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
        if (pieceHistory.length > 7) pieceHistory.shift();
        return piece;
    }

    function makePiece(type) {
        return { shape: TETROMINOS[type].shape, color: TETROMINOS[type].color, x: 0, y: 0 };
    }
    function placeAtTop(piece) {
        return {
            shape: piece.shape,
            color: piece.color,
            x: Math.floor(BOARD_WIDTH / 2) - Math.floor(piece.shape[0].length / 2),
            y: 0
        };
    }

    // ---------- input ----------
    const KEYMAP = {
        a: 'left', arrowleft: 'left',
        d: 'right', arrowright: 'right',
        s: 'down', arrowdown: 'down',
        w: 'rotate', arrowup: 'rotate',
        c: 'hold', ' ': 'drop'
    };
    const STEP = { left: [-1, 0], right: [1, 0], down: [0, 1] };

    function repeatTick() {
        if (state !== 'running') return;
        if (keyStates.left) movePiece(-1, 0);
        if (keyStates.right) movePiece(1, 0);
        if (keyStates.down) movePiece(0, 1);
    }

    function handleKeyDown(e) {
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'checkbox') return;
        if (document.documentElement.classList.contains('cli-open')) return;
        const key = e.key.toLowerCase();

        if (key === 'p' || key === 'escape') {
            if (state === 'running' || state === 'paused') { e.preventDefault(); togglePause(); }
            return;
        }
        if (key === 'enter' && state !== 'running') {
            if (state === 'paused') togglePause(); else startGame();
            e.preventDefault();
            return;
        }

        const action = KEYMAP[key];
        if (!action) return;
        if (state === 'running' || key.startsWith('arrow') || key === ' ') {
            // keep arrows / space from scrolling the page while the game is on screen
            if (state !== 'idle' && state !== 'over') e.preventDefault();
        }
        if (state !== 'running') return;

        if (STEP[action]) {
            keyStates[action] = true;
            if (!initialMoveDone[action]) {
                movePiece(STEP[action][0], STEP[action][1]);
                initialMoveDone[action] = true;
                setTimeout(() => {
                    if (keyStates[action] && !moveInterval) moveInterval = setInterval(repeatTick, moveRepeat);
                }, moveDelay);
            }
        } else if (action === 'rotate') {
            if (!e.repeat) rotatePiece();
        } else if (action === 'hold') {
            holdCurrentPiece();
        } else if (action === 'drop') {
            if (!e.repeat) hardDrop();
        }
    }

    function handleKeyUp(e) {
        const action = KEYMAP[e.key.toLowerCase()];
        if (STEP[action]) {
            keyStates[action] = false;
            initialMoveDone[action] = false;
        }
        if (!keyStates.left && !keyStates.right && !keyStates.down) stopRepeat();
    }

    function stopRepeat() {
        clearInterval(moveInterval);
        moveInterval = null;
    }
    function resetKeys() {
        keyStates = { left: false, right: false, down: false };
        initialMoveDone = { left: false, right: false, down: false };
        stopRepeat();
    }

    // ---------- board ----------
    function buildCells() {
        gameBoard.innerHTML = '';
        const frag = document.createDocumentFragment();
        for (let i = 0; i < BOARD_WIDTH * BOARD_HEIGHT; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            frag.appendChild(cell);
        }
        gameBoard.appendChild(frag);
    }

    function renderPreview(target, piece) {
        target.innerHTML = '';
        if (!piece) return;
        // trim empty rows / cols so the preview is centred
        const rows = piece.shape.map((r, i) => r.some(Boolean) ? i : -1).filter(i => i >= 0);
        const cols = piece.shape[0].map((_, c) => piece.shape.some(r => r[c]) ? c : -1).filter(c => c >= 0);
        target.style.gridTemplateColumns = `repeat(${cols.length}, var(--cs))`;
        target.style.gridTemplateRows = `repeat(${rows.length}, var(--cs))`;
        rows.forEach(r => cols.forEach(c => {
            const cell = document.createElement('div');
            cell.className = 'cell';
            if (piece.shape[r][c]) cell.classList.add(piece.color);
            target.appendChild(cell);
        }));
    }
    function updateNextPiece() { renderPreview(nextPieceBoard, nextPiece); }
    function updateHoldPiece() { renderPreview(holdPieceBoard, holdPiece); }

    function resetState() {
        board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
        score = 0;
        level = 1;
        lines = 0;
        dropSpeed = 1000;
        holdPiece = null;
        canHold = true;
        currentPiece = null;
        nextPiece = null;
        pieceBag = [];
        pieceHistory = [];
        showGhost = ghostToggle.checked;
        resetKeys();
        clearInterval(dropInterval);
        gameBoard.classList.remove('is-over');
        buildCells();
        updateHoldPiece();
        updateStats(false);
    }

    function spawnPiece() {
        if (nextPiece) {
            currentPiece = placeAtTop(nextPiece);
        } else {
            currentPiece = placeAtTop(makePiece(getNextPieceFromBag()));
        }
        nextPiece = makePiece(getNextPieceFromBag());
        canHold = true;
        updateNextPiece();
    }

    function getGhostPosition() {
        if (!currentPiece) return null;
        let ghostY = currentPiece.y;
        while (!checkCollisionAt(currentPiece.x, ghostY + 1)) ghostY++;
        return { x: currentPiece.x, y: ghostY };
    }

    function checkCollisionAt(x, y, shape) {
        shape = shape || currentPiece.shape;
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[0].length; col++) {
                if (shape[row][col]) {
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
    function checkCollision() { return checkCollisionAt(currentPiece.x, currentPiece.y); }

    function updateBoard() {
        const cells = gameBoard.children;
        const temp = board.map(r => r.slice());

        if (currentPiece && showGhost && state !== 'over') {
            const ghost = getGhostPosition();
            currentPiece.shape.forEach((r, row) => r.forEach((v, col) => {
                const gr = ghost.y + row, gc = ghost.x + col;
                if (v && gr >= 0 && gr < BOARD_HEIGHT && !temp[gr][gc]) temp[gr][gc] = 'ghost-' + currentPiece.color;
            }));
        }
        if (currentPiece) {
            currentPiece.shape.forEach((r, row) => r.forEach((v, col) => {
                const br = currentPiece.y + row, bc = currentPiece.x + col;
                if (v && br >= 0 && br < BOARD_HEIGHT && bc >= 0 && bc < BOARD_WIDTH) temp[br][bc] = currentPiece.color;
            }));
        }

        for (let row = 0; row < BOARD_HEIGHT; row++) {
            for (let col = 0; col < BOARD_WIDTH; col++) {
                const content = temp[row][col];
                let cls = 'cell';
                if (content) cls += content.startsWith('ghost-') ? ' ghost ' + content.substring(6) : ' ' + content;
                const cell = cells[row * BOARD_WIDTH + col];
                if (cell.className !== cls) cell.className = cls;
            }
        }
    }

    function movePiece(dx, dy) {
        if (state !== 'running' || !currentPiece) return false;

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
                resetKeys();
                updateBoard();
            }
            return false;
        }

        updateBoard();
        return true;
    }

    function rotatePiece() {
        if (state !== 'running' || !currentPiece) return;
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
        // wall kicks
        const kicks = [0, -1, 1, -2, 2];
        for (const k of kicks) {
            currentPiece.x += k;
            if (!checkCollision()) { updateBoard(); return; }
            currentPiece.x -= k;
        }
        currentPiece.shape = originalShape;
    }

    function lockPiece() {
        currentPiece.shape.forEach((r, row) => r.forEach((v, col) => {
            const br = currentPiece.y + row;
            if (v && br >= 0) board[br][currentPiece.x + col] = currentPiece.color;
        }));
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
            lines += linesCleared;
            bumpHighScore();
            if (score >= level * 1000) {
                level++;
                dropSpeed = Math.max(50, Math.floor(1000 * Math.pow(0.8, level - 1)));
                clearInterval(dropInterval);
                startDrop();
            }
            updateStats(true);
            wrap.classList.remove('flash'); void wrap.offsetWidth; wrap.classList.add('flash');
        }
    }

    function startDrop() {
        clearInterval(dropInterval);
        dropInterval = setInterval(() => movePiece(0, 1), dropSpeed);
    }

    function holdCurrentPiece() {
        if (!canHold || state !== 'running') return;
        const current = { shape: TETROMINOS[currentPiece.color.toUpperCase()].shape, color: currentPiece.color, x: 0, y: 0 };
        if (holdPiece) {
            currentPiece = placeAtTop(holdPiece);
        } else {
            currentPiece = placeAtTop(nextPiece);
            nextPiece = makePiece(getNextPieceFromBag());
            updateNextPiece();
        }
        holdPiece = current;
        canHold = false;
        updateHoldPiece();
        updateBoard();
    }

    function hardDrop() {
        if (state !== 'running') return;
        let dropDistance = 0;
        while (movePiece(0, 1)) dropDistance++;
        if (dropDistance > 0) {
            score += dropDistance;
            bumpHighScore();
            updateStats(false);
        }
    }

    function checkGameOver() {
        if (checkCollision()) {
            state = 'over';
            clearInterval(dropInterval);
            resetKeys();
            gameBoard.classList.add('is-over');
            pauseBtn.disabled = true;
            const record = score > 0 && score >= highScore;
            showMsg(record ? 'New high score!' : 'Game over', `Final score ${score} · level ${level} · ${lines} line${lines === 1 ? '' : 's'}`, 'rotate', 'Try again');
            if (record && score >= 500 && window.Site && Site.party) Site.party(false);
        }
    }

    // ---------- game flow ----------
    function startGame() {
        resetState();
        state = 'running';
        spawnPiece();
        updateBoard();
        hideMsg();
        pauseBtn.disabled = false;
        setPauseLabel();
        startDrop();
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }

    function togglePause() {
        if (state === 'running') {
            state = 'paused';
            clearInterval(dropInterval);
            resetKeys();
            showMsg('Paused', 'Take a breath.', 'play', 'Resume');
        } else if (state === 'paused') {
            state = 'running';
            hideMsg();
            startDrop();
        }
        setPauseLabel();
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }
    function setPauseLabel() {
        pauseBtn.innerHTML = state === 'paused'
            ? '<i class="fas fa-play"></i><span>Resume</span>'
            : '<i class="fas fa-pause"></i><span>Pause</span>';
    }

    msgBtn.addEventListener('click', () => {
        if (state === 'paused') togglePause(); else startGame();
    });
    newGameBtn.addEventListener('click', startGame);
    pauseBtn.addEventListener('click', togglePause);
    ghostToggle.addEventListener('change', () => {
        showGhost = ghostToggle.checked;
        if (currentPiece) updateBoard();
    });

    // touch pad
    const pad = $('pad');
    if (pad) {
        pad.addEventListener('pointerdown', (e) => {
            const btn = e.target.closest('button[data-a]');
            if (!btn) return;
            e.preventDefault();
            if (state !== 'running') return;
            const a = btn.dataset.a;
            if (a === 'left') movePiece(-1, 0);
            else if (a === 'right') movePiece(1, 0);
            else if (a === 'down') movePiece(0, 1);
            else if (a === 'rotate') rotatePiece();
            else if (a === 'drop') hardDrop();
            else if (a === 'hold') holdCurrentPiece();
        });
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', () => { resetKeys(); if (state === 'running') togglePause(); });

    // empty board + start overlay
    resetState();
    updateNextPiece();
});
