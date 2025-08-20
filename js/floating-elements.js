/**
 * FLOATING ELEMENTS MANAGER
 * Generalized floating elements for all pages
 */

class FloatingElementsManager {
    constructor() {
        this.elements = [
            { class: 'floating-code', content: '&lt;/&gt;' },
            { class: 'floating-brackets', content: '{ }' },
            { class: 'floating-semicolon', content: ';' },
            { class: 'floating-lambda', content: 'λ' },
            { class: 'floating-function', content: 'f(x)' },
            { class: 'floating-arrow', content: '=>' },
            { class: 'floating-hash', content: '#' },
            { class: 'floating-dollar', content: '$' },
            { class: 'floating-binary', content: '101' },
            { class: 'floating-git', content: 'git' },
            { class: 'floating-equals', content: '===' },
            { class: 'floating-console', content: 'console.log()' }
        ];
        
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.createFloatingElements());
        } else {
            this.createFloatingElements();
        }
    }

    createFloatingElements() {
        // Find existing floating-elements container or create one
        let container = document.querySelector('.floating-elements');
        
        if (!container) {
            container = document.createElement('div');
            container.className = 'floating-elements';
            document.body.appendChild(container);
        }

        // Clear existing content
        container.innerHTML = '';

        // Create all floating elements
        this.elements.forEach(element => {
            const div = document.createElement('div');
            div.className = element.class;
            
            const span = document.createElement('span');
            span.innerHTML = element.content;
            div.appendChild(span);
            
            container.appendChild(div);
        });

    }
}

// Auto-initialize when script loads
new FloatingElementsManager();
