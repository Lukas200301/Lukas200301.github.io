/**
 * Regex Tester Tool - JavaScript Implementation
 * Real-time regex testing with highlighting and match analysis
 */

class RegexTester {
    constructor() {
        this.regexInput = document.getElementById('regexInput');
        this.testString = document.getElementById('testString');
        this.testOverlay = document.getElementById('testOverlay');
        this.regexError = document.getElementById('regexError');
        this.errorMessage = document.getElementById('errorMessage');
        this.regexInfo = document.getElementById('regexInfo');
        this.currentPattern = document.getElementById('currentPattern');
        this.currentFlags = document.getElementById('currentFlags');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.resultsCount = document.getElementById('resultsCount');
        this.noResults = document.getElementById('noResults');
        
        this.globalFlag = document.getElementById('globalFlag');
        this.ignoreCase = document.getElementById('ignoreCase');
        this.multiline = document.getElementById('multiline');
        
        this.clearTest = document.getElementById('clearTest');
        this.pasteTest = document.getElementById('pasteTest');
        
        this.currentRegex = null;
        this.debounceTimeout = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateInfo();
        this.loadSampleData();
    }
    
    setupEventListeners() {
        // Real-time regex testing
        this.regexInput.addEventListener('input', () => this.debounceTest());
        this.testString.addEventListener('input', () => this.debounceTest());
        
        // Flag toggles
        this.globalFlag.addEventListener('change', () => this.debounceTest());
        this.ignoreCase.addEventListener('change', () => this.debounceTest());
        this.multiline.addEventListener('change', () => this.debounceTest());
        
        // Action buttons
        this.clearTest.addEventListener('click', () => this.clearTestString());
        this.pasteTest.addEventListener('click', () => this.pasteFromClipboard());
        
        // Scroll sync for overlay
        this.testString.addEventListener('scroll', () => this.syncOverlayScroll());
        this.testString.addEventListener('resize', () => this.syncOverlaySize());
        
        // Window resize handler
        window.addEventListener('resize', () => this.syncOverlaySize());
    }
    
    debounceTest() {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(() => {
            this.testRegex();
        }, 150);
    }
    
    testRegex() {
        this.updateInfo();
        this.clearError();
        
        const pattern = this.regexInput.value.trim();
        const testText = this.testString.value;
        
        if (!pattern) {
            this.clearResults();
            this.clearHighlights();
            return;
        }
        
        try {
            const flags = this.getFlags();
            this.currentRegex = new RegExp(pattern, flags);
            
            if (!testText) {
                this.clearResults();
                this.clearHighlights();
                return;
            }
            
            this.performMatching(testText);
            
        } catch (error) {
            this.showError(error.message);
            this.clearResults();
            this.clearHighlights();
        }
    }
    
    getFlags() {
        let flags = '';
        if (this.globalFlag.checked) flags += 'g';
        if (this.ignoreCase.checked) flags += 'i';
        if (this.multiline.checked) flags += 'm';
        return flags;
    }
    
    performMatching(testText) {
        const matches = [];
        let match;
        
        if (this.globalFlag.checked) {
            while ((match = this.currentRegex.exec(testText)) !== null) {
                matches.push({
                    match: match[0],
                    index: match.index,
                    groups: match.slice(1),
                    fullMatch: match
                });
                
                // Prevent infinite loop on zero-length matches
                if (match.index === this.currentRegex.lastIndex) {
                    this.currentRegex.lastIndex++;
                }
            }
        } else {
            match = this.currentRegex.exec(testText);
            if (match) {
                matches.push({
                    match: match[0],
                    index: match.index,
                    groups: match.slice(1),
                    fullMatch: match
                });
            }
        }
        
        this.displayResults(matches);
        this.highlightMatches(testText, matches);
        this.updateResultsCount(matches.length);
    }
    
    displayResults(matches) {
        if (matches.length === 0) {
            this.clearResults();
            return;
        }
        
        this.noResults.style.display = 'none';
        
        const resultsHTML = matches.map((matchData, index) => {
            const groupsHTML = matchData.groups.length > 0 && matchData.groups.some(g => g !== undefined) ? 
                `<div class="groups-container">
                    <div class="groups-title">Capture Groups:</div>
                    ${matchData.groups.map((group, groupIndex) => 
                        group !== undefined ? 
                        `<div class="group-item">
                            <span class="group-index">${groupIndex + 1}</span>
                            <span class="group-value">${this.escapeHtml(group)}</span>
                        </div>` : ''
                    ).join('')}
                </div>` : '';
            
            return `
                <div class="match-item">
                    <div class="match-header">
                        <span class="match-index">Match ${index + 1}</span>
                        <span class="match-position">Position: ${matchData.index}-${matchData.index + matchData.match.length}</span>
                    </div>
                    <div class="match-content">
                        <span class="match-text">${this.escapeHtml(matchData.match)}</span>
                    </div>
                    ${groupsHTML}
                </div>
            `;
        }).join('');
        
        this.resultsContainer.innerHTML = resultsHTML;
    }
    
    highlightMatches(testText, matches) {
        if (matches.length === 0) {
            this.clearHighlights();
            return;
        }
        
        let highlightedText = testText;
        let offset = 0;
        
        // Sort matches by index to process them in order
        const sortedMatches = [...matches].sort((a, b) => a.index - b.index);
        
        sortedMatches.forEach((matchData, matchIndex) => {
            const start = matchData.index + offset;
            const end = start + matchData.match.length;
            const matchText = highlightedText.substring(start, end);
            
            const highlightedMatch = `<span class="highlight group-0">${this.escapeHtml(matchText)}</span>`;
            
            highlightedText = highlightedText.substring(0, start) + 
                            highlightedMatch + 
                            highlightedText.substring(end);
                            
            offset += highlightedMatch.length - matchText.length;
        });
        
        this.testOverlay.innerHTML = highlightedText;
        this.syncOverlayScroll();
    }
    
    clearHighlights() {
        this.testOverlay.innerHTML = '';
    }
    
    clearResults() {
        this.resultsContainer.innerHTML = '';
        this.noResults.style.display = 'block';
        this.updateResultsCount(0);
    }
    
    updateResultsCount(count) {
        this.resultsCount.textContent = `${count} match${count !== 1 ? 'es' : ''}`;
    }
    
    updateInfo() {
        const pattern = this.regexInput.value.trim() || 'No pattern';
        const flags = this.getFlags() || 'None';
        
        this.currentPattern.textContent = pattern;
        this.currentFlags.textContent = flags;
    }
    
    showError(message) {
        this.errorMessage.textContent = message;
        this.regexError.style.display = 'flex';
    }
    
    clearError() {
        this.regexError.style.display = 'none';
        this.errorMessage.textContent = '';
    }
    
    clearTestString() {
        this.testString.value = '';
        this.testRegex();
        this.testString.focus();
    }
    
    async pasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            this.testString.value = text;
            this.testRegex();
            this.testString.focus();
        } catch (error) {
            console.warn('Could not paste from clipboard:', error);
            // Fallback: focus the textarea so user can paste manually
            this.testString.focus();
        }
    }
    
    syncOverlayScroll() {
        this.testOverlay.scrollTop = this.testString.scrollTop;
        this.testOverlay.scrollLeft = this.testString.scrollLeft;
    }
    
    syncOverlaySize() {
        const textareaStyle = window.getComputedStyle(this.testString);
        this.testOverlay.style.height = this.testString.style.height || textareaStyle.height;
        this.testOverlay.style.width = this.testString.style.width || textareaStyle.width;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    loadSampleData() {
        // Load sample regex and test string for demonstration
        const sampleRegex = '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b';
        const sampleText = `Contact us at:
- support@example.com
- admin@company.org  
- user.name+tag@domain.co.uk
- Invalid emails: @invalid.com, user@, not-an-email

Phone numbers: +1-555-123-4567, (555) 987-6543
Website: https://www.example.com`;

        this.regexInput.value = sampleRegex;
        this.testString.value = sampleText;
        this.globalFlag.checked = true;
        this.ignoreCase.checked = true;
        
        // Test the sample data after a short delay
        setTimeout(() => {
            this.testRegex();
        }, 100);
    }
}

// Advanced regex patterns for quick testing
const REGEX_SAMPLES = {
    email: {
        pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b',
        description: 'Email addresses',
        flags: ['g', 'i']
    },
    phone: {
        pattern: '(\\+?1[-\\s]?)?\\(?([0-9]{3})\\)?[-\\s]?([0-9]{3})[-\\s]?([0-9]{4})',
        description: 'US phone numbers',
        flags: ['g']
    },
    url: {
        pattern: 'https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)',
        description: 'URLs',
        flags: ['g', 'i']
    },
    ipv4: {
        pattern: '\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b',
        description: 'IPv4 addresses',
        flags: ['g']
    },
    date: {
        pattern: '\\b(0?[1-9]|1[0-2])[\\/\\-](0?[1-9]|[12][0-9]|3[01])[\\/\\-](19|20)\\d{2}\\b',
        description: 'Dates (MM/DD/YYYY or MM-DD-YYYY)',
        flags: ['g']
    },
    hexColor: {
        pattern: '#(?:[0-9a-fA-F]{3}){1,2}\\b',
        description: 'Hex color codes',
        flags: ['g', 'i']
    }
};

// Utility functions for sample patterns
function insertSamplePattern(patternKey) {
    const sample = REGEX_SAMPLES[patternKey];
    if (sample && window.regexTester) {
        window.regexTester.regexInput.value = sample.pattern;
        
        // Set flags
        window.regexTester.globalFlag.checked = sample.flags.includes('g');
        window.regexTester.ignoreCase.checked = sample.flags.includes('i');
        window.regexTester.multiline.checked = sample.flags.includes('m');
        
        window.regexTester.testRegex();
    }
}

// Initialize the regex tester when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.regexTester = new RegexTester();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + Enter to test regex
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            window.regexTester.testRegex();
            e.preventDefault();
        }
        
        // Ctrl/Cmd + K to clear test string
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            window.regexTester.clearTestString();
            e.preventDefault();
        }
        
        // Ctrl/Cmd + V to paste (when regex input is focused)
        if ((e.ctrlKey || e.metaKey) && e.key === 'v' && document.activeElement === window.regexTester.regexInput) {
            setTimeout(() => window.regexTester.testRegex(), 10);
        }
    });
    
    // Add escape key handler to clear error
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && window.regexTester.regexError.style.display !== 'none') {
            window.regexTester.clearError();
        }
    });
});

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RegexTester, REGEX_SAMPLES, insertSamplePattern };
}