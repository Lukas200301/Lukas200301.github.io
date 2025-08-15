document.addEventListener('DOMContentLoaded', () => {
    let currentLanguage = 'javascript';
    
    const codeEditor = CodeMirror.fromTextArea(document.getElementById('codeEditor'), {
        mode: 'javascript',
        theme: 'dracula',
        lineNumbers: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        indentUnit: 4,
        tabSize: 4,
        lineWrapping: true,
        foldGutter: true,
        gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
        styleActiveLine: true,
        cursorBlinkRate: 530,
        viewportMargin: Infinity,
        extraKeys: {
            'Ctrl-Space': 'autocomplete'
        }
    });
    
    // Force CodeMirror to refresh and set proper size
    setTimeout(() => {
        codeEditor.refresh();
        codeEditor.setSize('100%', '100%');
    }, 100);

    const statusMessage = document.getElementById('statusMessage');
    const runButton = document.getElementById('runButton');
    const clearCodeButton = document.getElementById('clearCode');
    const clearConsoleButton = document.getElementById('clearConsole');
    const loadExampleButton = document.getElementById('loadExample');
    const currentLanguageSpan = document.getElementById('currentLanguage');
    const consoleOutput = document.getElementById('consoleOutput');
    
    // Tab switching
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const lang = tab.getAttribute('data-lang');
            switchLanguage(lang);
        });
    });
    
    function switchLanguage(lang) {
        currentLanguage = lang;
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-lang="${lang}"]`).classList.add('active');
        
        if (lang === 'typescript') {
            codeEditor.setOption('mode', 'text/typescript');
            currentLanguageSpan.textContent = 'TypeScript';
        } else {
            codeEditor.setOption('mode', 'javascript');
            currentLanguageSpan.textContent = 'JavaScript';
        }
        
        // Refresh editor after mode change
        setTimeout(() => {
            codeEditor.refresh();
        }, 50);
        
        showStatus(`Switched to ${lang === 'typescript' ? 'TypeScript' : 'JavaScript'} mode`, 'success');
    }

    const jsExampleCode = `// JavaScript Example: Basic Programming Concepts
const greeting = "Hello, JavaScript World!";
console.log(greeting);

// Working with numbers and basic operations
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(num => num * 2);
const sum = numbers.reduce((total, current) => total + current, 0);

console.log('Original numbers:', numbers);
console.log('Doubled:', doubled);
console.log('Sum:', sum);

// Simple object creation and manipulation
const person = {
    name: 'Alice',
    age: 25,
    hobbies: ['reading', 'coding', 'music']
};

console.log('Person:', person);
console.log('Name:', person.name);
console.log('Hobbies:', person.hobbies.join(', '));

// Basic functions and calculations
const add = (a, b) => a + b;
const multiply = (x, y) => x * y;
const isEven = n => n % 2 === 0;

console.log('5 + 3 =', add(5, 3));
console.log('4 * 7 =', multiply(4, 7));
console.log('Is 6 even?', isEven(6));

// Simple loop and array processing
const colors = ['red', 'blue', 'green', 'yellow'];
const uppercaseColors = [];

for (let i = 0; i < colors.length; i++) {
    uppercaseColors.push(colors[i].toUpperCase());
}

console.log('Original colors:', colors);
console.log('Uppercase colors:', uppercaseColors);`;

    const tsExampleCode = `// TypeScript Example: Type Safety and Object Creation
// Note: The following TypeScript code works best when the TypeScript tab is selected

// Creating objects with type-like structure (works in both JS and TS)
const createPerson = (name, age, city) => {
    return {
        name: name,
        age: age,
        city: city,
        isStudent: age < 25
    };
};

// Sample data
const people = [
    createPerson("Emma", 22, "New York"),
    createPerson("James", 28, "London"),
    createPerson("Sofia", 20, "Madrid")
];

const books = [
    { title: "Clean Code", author: "Robert Martin", pages: 464, genre: "Programming" },
    { title: "The Hobbit", author: "J.R.R. Tolkien", pages: 310, genre: "Fantasy" },
    { title: "1984", author: "George Orwell", pages: 328, genre: "Dystopian" }
];

console.log('People:', people);
console.log('Books:', books);

// Utility methods for data processing
const findStudents = (peopleList) => {
    return peopleList.filter(person => person.isStudent);
};

const getBookTitles = (bookList) => {
    return bookList.map(book => book.title);
};

const findBooksByGenre = (bookList, targetGenre) => {
    return bookList.filter(book => book.genre === targetGenre);
};

// Using the methods
const students = findStudents(people);
const bookTitles = getBookTitles(books);
const fantasyBooks = findBooksByGenre(books, 'Fantasy');

console.log('Students:', students);
console.log('Book titles:', bookTitles);
console.log('Fantasy books:', fantasyBooks);

// Mathematical operations
const calculateAverage = (numbers) => {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((total, num) => total + num, 0);
    return sum / numbers.length;
};

const ages = people.map(person => person.age);
const avgAge = calculateAverage(ages);

console.log('Average age:', avgAge.toFixed(1));

// When using TypeScript mode, you can add type annotations:
// const createPerson = (name: string, age: number, city: string): Person => { ... }
// const people: Person[] = [ ... ]
// const calculateAverage = (numbers: number[]): number => { ... }`;

    const forbiddenKeywords = [
        'eval', 'Function', 'setTimeout', 'setInterval', 'fetch', 'XMLHttpRequest',
        'WebSocket', 'Worker', 'importScripts', 'document.write', 'localStorage',
        'sessionStorage', 'indexedDB', 'crypto', 'atob', 'btoa', 'import', 'export',
        'require', 'process', 'window', 'global', 'this', 'self', 'top', 'parent',
        'frames', 'opener', 'navigator', 'location', 'history', 'screen', 'alert',
        'confirm', 'prompt', 'print', 'debugger', 'console.clear', 'console.profile',
        'console.profileEnd', 'console.time', 'console.timeEnd', 'console.timeLog',
        'console.trace', 'console.warn', 'console.error', 'console.info',
        'console.debug', 'console.dir', 'console.dirxml', 'console.group',
        'console.groupCollapsed', 'console.groupEnd', 'console.table', 'console.count',
        'console.countReset', 'console.assert', 'console.timeStamp', 'console.memory',
        'github', 'github.io', 'githubusercontent', 'raw.githubusercontent',
        'blob', 'raw', 'api.github', 'gist', 'gist.github', 'github.com',
        'postMessage', 'message', 'origin', 'domain', 'referrer', 'referer',
        'cookie', 'document.cookie', 'document.domain', 'document.referrer',
        'performance', 'performance.now', 'performance.memory',
        'requestAnimationFrame', 'cancelAnimationFrame',
        'requestIdleCallback', 'cancelIdleCallback',
        'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
        'CustomEvent', 'EventSource', 'BroadcastChannel',
        'SharedWorker', 'ServiceWorker', 'Cache', 'CacheStorage',
        'Notification', 'PushManager', 'PushSubscription',
        'getUserMedia', 'mediaDevices', 'RTCPeerConnection',
        'webkit', 'moz', 'ms', '__proto__', 'prototype', 'constructor',
        'declare', 'module', 'namespace', 'ambient', 'globalThis',
        'Reflect', 'Proxy', 'WeakRef', 'FinalizationRegistry',
        'SharedArrayBuffer', 'Atomics', 'Buffer', '__dirname', '__filename',
        'clearImmediate', 'setImmediate', 'queueMicrotask',
        'MessageChannel', 'MessagePort', 'AbortController', 'AbortSignal',
        'FileReader', 'Blob', 'File', 'FormData', 'URLSearchParams',
        'TextEncoder', 'TextDecoder', 'CompressionStream', 'DecompressionStream',
        'ReadableStream', 'WritableStream', 'TransformStream',
        'document.createElement', 'document.getElementById', 'document.querySelector',
        'document.querySelectorAll', 'document.body', 'document.head',
        'addEventListener', 'removeEventListener', 'dispatchEvent',
        'innerHTML', 'outerHTML', 'textContent', 'innerText',
        'appendChild', 'removeChild', 'insertBefore', 'replaceChild',
        'cloneNode', 'setAttribute', 'getAttribute', 'removeAttribute',
        'classList', 'className', 'style', 'offsetWidth', 'offsetHeight',
        'scrollTop', 'scrollLeft', 'clientWidth', 'clientHeight',
        'getBoundingClientRect', 'getComputedStyle',
        'encodeURI', 'encodeURIComponent', 'decodeURI', 'decodeURIComponent',
        'escape', 'unescape', 'isNaN', 'isFinite', 'parseFloat', 'parseInt'
    ];

    const MAX_EXECUTION_TIME = 2000; 
    const MAX_CODE_LENGTH = 10000; 
    const MAX_CONSOLE_LINES = 100;
    let consoleLineCount = 0;

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.style.display = 'block';
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 3000);
    }

    function checkCodeLength(code) {
        if (code.length > MAX_CODE_LENGTH) {
            throw new Error(`Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`);
        }
    }

    function resetConsoleLineCount() {
        consoleLineCount = 0;
    }

    function addConsoleLine(content, type = 'log') {
        if (consoleLineCount >= MAX_CONSOLE_LINES) {
            addConsoleLine('Console output limit reached. Clearing console...', 'warn');
            clearConsole();
            return;
        }
        consoleLineCount++;

        const line = document.createElement('div');
        line.className = `console-line ${type}`;
        
        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = new Date().toLocaleTimeString();
        
        const contentSpan = document.createElement('span');
        contentSpan.className = 'content';
        
        if (typeof content === 'object') {
            try {
                const safeStringify = (obj, depth = 0) => {
                    if (depth > 3) return '[Object]';
                    if (Array.isArray(obj)) {
                        if (obj.length > 100) return `[Array(${obj.length})]`;
                        return `[${obj.slice(0, 100).map(item => safeStringify(item, depth + 1)).join(', ')}]`;
                    }
                    if (obj === null) return 'null';
                    if (typeof obj === 'object') {
                        const entries = Object.entries(obj).slice(0, 10);
                        return `{${entries.map(([k, v]) => `${k}: ${safeStringify(v, depth + 1)}`).join(', ')}}`;
                    }
                    return String(obj);
                };
                contentSpan.textContent = safeStringify(content);
            } catch (e) {
                contentSpan.textContent = '[Object]';
            }
        } else {
            const str = String(content);
            contentSpan.textContent = str.length > 1000 ? str.slice(0, 1000) + '...' : str;
        }
        
        line.appendChild(timestamp);
        line.appendChild(contentSpan);
        consoleOutput.appendChild(line);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    function checkForbiddenKeywords(code) {
        const regex = new RegExp(`\\b(${forbiddenKeywords.join('|')})\\b`, 'gi');
        const matches = code.match(regex);
        if (matches) {
            throw new Error(`Forbidden keywords detected: ${matches.join(', ')}`);
        }
    }

    function createSafeConsole() {
        const safeConsole = {
            log: (...args) => {
                args.forEach(arg => addConsoleLine(arg, 'log'));
            },
            info: (...args) => {
                args.forEach(arg => addConsoleLine(arg, 'info'));
            },
            warn: (...args) => {
                args.forEach(arg => addConsoleLine(arg, 'warn'));
            },
            error: (...args) => {
                args.forEach(arg => addConsoleLine(arg, 'error'));
            }
        };

        Object.defineProperties(safeConsole, {
            log: { configurable: false, writable: false },
            info: { configurable: false, writable: false },
            warn: { configurable: false, writable: false },
            error: { configurable: false, writable: false }
        });

        return Object.freeze(safeConsole);
    }

    function runCode() {
        const code = codeEditor.getValue();
        if (!code.trim()) {
            showStatus('Please enter some code to run', 'error');
            return;
        }

        try {
            checkCodeLength(code);
            checkForbiddenKeywords(code);
            resetConsoleLineCount();
            
            const safeConsole = createSafeConsole();
            
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Execution timeout')), MAX_EXECUTION_TIME);
            });

            const sandbox = {
                console: safeConsole,
                Math: Object.freeze(Math),
                JSON: Object.freeze(JSON),
                Array: Object.freeze(Array),
                String: Object.freeze(String),
                Number: Object.freeze(Number),
                Boolean: Object.freeze(Boolean),
                Date: Object.freeze(Date),
                RegExp: Object.freeze(RegExp),
                Object: Object.freeze(Object),
                Symbol: Object.freeze(Symbol),
                Map: Object.freeze(Map),
                Set: Object.freeze(Set),
                WeakMap: Object.freeze(WeakMap),
                WeakSet: Object.freeze(WeakSet),
                Promise: Object.freeze(Promise),
                Error: Object.freeze(Error),
                TypeError: Object.freeze(TypeError),
                ReferenceError: Object.freeze(ReferenceError),
                SyntaxError: Object.freeze(SyntaxError),
                RangeError: Object.freeze(RangeError),
                EvalError: Object.freeze(EvalError),
                URIError: Object.freeze(URIError)
            };

            const executionPromise = new Promise((resolve) => {
                const safeEval = new Function('sandbox', `
                    with (sandbox) {
                        try {
                            ${code}
                        } catch (e) {
                            console.error(e.message);
                        }
                    }
                `);
                safeEval(sandbox);
                resolve();
            });

            Promise.race([executionPromise, timeoutPromise])
                .then(() => {
                    showStatus(' Code executed successfully!', 'success');
                })
                .catch((error) => {
                    addConsoleLine(error.message, 'error');
                    showStatus('Error during execution', 'error');
                });

        } catch (error) {
            addConsoleLine(error.message, 'error');
            showStatus('Error during execution', 'error');
        }
    }

    function clearCode() {
        codeEditor.setValue('');
        showStatus(' Code editor cleared', 'success');
    }

    function clearConsole() {
        consoleOutput.innerHTML = '<div class="console-welcome"></div>';
        resetConsoleLineCount();
        showStatus(' Console cleared', 'success');
    }

    function loadExample() {
        const exampleCode = currentLanguage === 'typescript' ? tsExampleCode : jsExampleCode;
        codeEditor.setValue(exampleCode);
        showStatus(`${currentLanguage === 'typescript' ? 'TypeScript' : 'JavaScript'} example loaded`, 'success');
    }

    runButton.addEventListener('click', runCode);
    clearCodeButton.addEventListener('click', clearCode);
    clearConsoleButton.addEventListener('click', clearConsole);
    loadExampleButton.addEventListener('click', loadExample);

    codeEditor.setOption('extraKeys', {
        'Ctrl-Enter': runCode,
        'Ctrl-Space': 'autocomplete'
    });
        
    // Handle window resize
    window.addEventListener('resize', () => {
        setTimeout(() => {
            codeEditor.refresh();
        }, 100);
    });
}); 