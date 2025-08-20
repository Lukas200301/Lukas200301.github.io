/**
 * GLOBLE GAME
 * Geography guessing game with interactive 3D globe
 */

class GlobleGame {
    constructor() {
        this.globe = null;
        this.countriesData = [];
        this.mysteryCountry = null;
        this.guesses = [];
        this.currentRound = 1;
        this.gameState = 'waiting'; 
        this.isAutoRotating = false;
        this.bestScore = localStorage.getItem('globle-best-score') || null;
        this.closestGuess = null; // Track the closest guess
        this.currentGuessTimeout = null; // Track timeout for temporary cards
        
        // Game configuration
        this.maxDistance = 20000; // Maximum distance in km for color scaling
        this.distanceThresholds = {
            'very-close': 1000,
            'close': 3000,
            'medium': 6000,
            'far': 12000,
            'very-far': 20000
        };
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.updateStats();
        
        try {
            await this.waitForLibraries();
            await this.loadCountriesData();
            this.initializeGlobe();
            this.startNewRound();
        } catch (error) {
            this.showError('Failed to load game. Please refresh the page.');
        }
    }

    async waitForLibraries() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50;
            
            const checkLibraries = () => {
                attempts++;
                if (typeof Globe !== 'undefined') {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('Globe.gl library failed to load'));
                } else {
                    setTimeout(checkLibraries, 100);
                }
            };
            
            checkLibraries();
        });
    }

    async loadCountriesData() {
        try {
            // Load both independent and non-independent countries
            const [independentResponse, nonIndependentResponse] = await Promise.all([
                fetch('https://restcountries.com/v3.1/independent?status=true'),
                fetch('https://restcountries.com/v3.1/independent?status=false')
            ]);
            
            if (!independentResponse.ok) {
                throw new Error(`Failed to load independent countries: ${independentResponse.status} ${independentResponse.statusText}`);
            }
            
            if (!nonIndependentResponse.ok) {
                throw new Error(`Failed to load non-independent countries: ${nonIndependentResponse.status} ${nonIndependentResponse.statusText}`);
            }
            
            const [independentData, nonIndependentData] = await Promise.all([
                independentResponse.json(),
                nonIndependentResponse.json()
            ]);
            
            // Combine both datasets
            const data = [...independentData, ...nonIndependentData];
            
            this.countriesData = data
                .filter(country => country.latlng && country.latlng.length === 2)
                .map(country => ({
                    name: country.name.common,
                    code: country.cca3,
                    lat: country.latlng[0],
                    lng: country.latlng[1],
                    flag: country.flags?.svg || country.flag,
                    population: country.population || 0,
                    area: country.area || 0,
                    region: country.region || 'Unknown',
                    subregion: country.subregion || 'Unknown',
                    capital: country.capital?.[0] || 'Unknown',
                    languages: country.languages ? Object.values(country.languages).join(', ') : 'Unknown',
                    currencies: country.currencies ? Object.values(country.currencies).map(c => c.name).join(', ') : 'Unknown',
                    callingCode: country.idd?.root ? `${country.idd.root}${country.idd.suffixes?.[0] || ''}` : 'Unknown'
                }))
                .sort((a, b) => a.name.localeCompare(b.name));
            
            this.setupCountrySearch();
        } catch (error) {
            throw error;
        }
    }

    initializeGlobe() {
        const globeElement = document.getElementById('globeViz');
        if (!globeElement) {
            throw new Error('Globe container not found');
        }

        try {
            this.globe = Globe()
                .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
                .showGlobe(true)
                .showAtmosphere(true)
                .atmosphereColor('#3b82f6')
                .atmosphereAltitude(0.2)
                .enablePointerInteraction(true)
                .pointOfView({ altitude: 2.5 })
                .width(globeElement.clientWidth)
                .height(globeElement.clientHeight)
                (globeElement);

            // Set up points data
            this.globe
                .pointsData(this.countriesData)
                .pointAltitude(0.01)
                .pointRadius(0.6)
                .pointColor(d => this.getCountryColor(d))
                .pointLabel(d => `
                    <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px 12px; border-radius: 6px; font-size: 12px; max-width: 200px;">
                        <strong>${d.name}</strong><br>
                        <small>${d.region}</small>
                    </div>
                `)
                .onPointClick(this.handleCountryClick.bind(this))
                .onPointHover(this.handleCountryHover.bind(this));

            // Handle globe resize
            window.addEventListener('resize', () => {
                if (this.globe && globeElement) {
                    this.globe
                        .width(globeElement.clientWidth)
                        .height(globeElement.clientHeight);
                }
            });

        } catch (error) {
            throw error;
        }
    }

    setupEventListeners() {
        // Input and guess submission
        const countryInput = document.getElementById('countryInput');
        const submitButton = document.getElementById('submitGuess');
        
        if (countryInput && submitButton) {
            countryInput.addEventListener('input', this.handleInput.bind(this));
            countryInput.addEventListener('keydown', this.handleInputKeydown.bind(this));
            submitButton.addEventListener('click', this.submitGuess.bind(this));
        }

        // Game controls
        const newRoundBtn = document.getElementById('newRound');
        const giveUpBtn = document.getElementById('giveUp');
        const showRulesBtn = document.getElementById('showRules');
        const clearHistoryBtn = document.getElementById('clearHistory');

        if (newRoundBtn) newRoundBtn.addEventListener('click', this.startNewRound.bind(this));
        if (giveUpBtn) giveUpBtn.addEventListener('click', this.giveUp.bind(this));
        if (showRulesBtn) showRulesBtn.addEventListener('click', this.showRules.bind(this));
        if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', this.clearHistory.bind(this));

        // Globe controls
        const resetViewBtn = document.getElementById('resetView');
        const autoRotateBtn = document.getElementById('autoRotate');
        const giveUpGlobeBtn = document.getElementById('giveUpGlobe');

        if (resetViewBtn) resetViewBtn.addEventListener('click', this.resetGlobeView.bind(this));
        if (autoRotateBtn) autoRotateBtn.addEventListener('click', this.toggleAutoRotate.bind(this));
        if (giveUpGlobeBtn) giveUpGlobeBtn.addEventListener('click', this.giveUp.bind(this));

        // Modal controls
        const closeRulesBtn = document.getElementById('closeRules');
        const closeSuccessBtn = document.getElementById('closeSuccess');
        const playAgainBtn = document.getElementById('playAgain');

        if (closeRulesBtn) closeRulesBtn.addEventListener('click', this.hideRules.bind(this));
        if (closeSuccessBtn) closeSuccessBtn.addEventListener('click', this.hideSuccess.bind(this));
        if (playAgainBtn) playAgainBtn.addEventListener('click', () => {
            this.hideSuccess();
            this.startNewRound();
        });

        // Close modals on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideRules();
                this.hideSuccess();
            }
        });

        // Section navigation
        this.setupSectionNavigation();
    }

    setupSectionNavigation() {
        const navDots = document.querySelectorAll('.nav-dot');
        navDots.forEach(dot => {
            dot.addEventListener('click', (e) => {
                const sectionId = e.currentTarget.dataset.section;
                this.scrollToSection(sectionId);
            });
        });

        // Update active section on scroll
        window.addEventListener('scroll', () => this.updateActiveSection());
    }

    scrollToSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth' });
        }
    }

    updateActiveSection() {
        const sections = document.querySelectorAll('section');
        const navDots = document.querySelectorAll('.nav-dot');
        const scrollPos = window.scrollY + 100;

        sections.forEach((section, index) => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.id;

            if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                navDots.forEach(dot => dot.classList.remove('active'));
                const activeDot = document.querySelector(`[data-section="${sectionId}"]`);
                if (activeDot) activeDot.classList.add('active');
            }
        });
    }

    setupCountrySearch() {
        const input = document.getElementById('countryInput');
        const suggestions = document.getElementById('suggestions');
        
        if (!input || !suggestions) return;

        let selectedIndex = -1;

        input.addEventListener('focus', () => {
            if (input.value.trim()) {
                this.showSuggestions(input.value);
            }
        });

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !suggestions.contains(e.target)) {
                this.hideSuggestions();
            }
        });
    }

    handleInput(e) {
        const query = e.target.value.trim();
        if (query.length >= 2) {
            this.showSuggestions(query);
        } else {
            this.hideSuggestions();
        }
    }

    handleInputKeydown(e) {
        const suggestions = document.getElementById('suggestions');
        const suggestionItems = suggestions.querySelectorAll('.suggestion-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = Math.min(this.selectedIndex + 1, suggestionItems.length - 1);
            this.updateSuggestionHighlight();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
            this.updateSuggestionHighlight();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.selectedIndex >= 0 && suggestionItems[this.selectedIndex]) {
                const countryName = suggestionItems[this.selectedIndex].textContent;
                e.target.value = countryName;
                this.hideSuggestions();
            }
            this.submitGuess();
        } else if (e.key === 'Escape') {
            this.hideSuggestions();
        }
    }

    showSuggestions(query) {
        const suggestions = document.getElementById('suggestions');
        if (!suggestions) return;

        const matches = this.countriesData
            .filter(country => 
                country.name.toLowerCase().includes(query.toLowerCase()) &&
                !this.guesses.some(guess => guess.name === country.name)
            )
            .slice(0, 8);

        if (matches.length > 0) {
            suggestions.innerHTML = matches
                .map(country => `<div class="suggestion-item">${country.name}</div>`)
                .join('');
            
            suggestions.classList.add('visible');
            this.selectedIndex = -1;

            // Add click handlers
            suggestions.querySelectorAll('.suggestion-item').forEach((item, index) => {
                item.addEventListener('click', () => {
                    document.getElementById('countryInput').value = item.textContent;
                    this.hideSuggestions();
                    this.submitGuess();
                });
            });
        } else {
            this.hideSuggestions();
        }
    }

    hideSuggestions() {
        const suggestions = document.getElementById('suggestions');
        if (suggestions) {
            suggestions.classList.remove('visible');
            suggestions.innerHTML = '';
        }
        this.selectedIndex = -1;
    }

    updateSuggestionHighlight() {
        const suggestions = document.getElementById('suggestions');
        const items = suggestions.querySelectorAll('.suggestion-item');
        
        items.forEach((item, index) => {
            item.classList.toggle('highlighted', index === this.selectedIndex);
        });
    }

    startNewRound() {
        // Reset game state
        this.guesses = [];
        this.gameState = 'playing';
        this.closestGuess = null;
        
        // Clear any existing timeout
        if (this.currentGuessTimeout) {
            clearTimeout(this.currentGuessTimeout);
        }
        
        // Hide guess cards
        this.hideCurrentGuessCard();
        this.updateClosestGuessCard();
        
        // Choose random mystery country
        this.mysteryCountry = this.countriesData[Math.floor(Math.random() * this.countriesData.length)];
        
        // Update UI
        this.updateStats();
        this.clearGuessHistory();
        this.resetGlobeView();
        
        // Clear input
        const input = document.getElementById('countryInput');
        if (input) {
            input.value = '';
            input.focus();
        }

        // Update globe colors
        if (this.globe) {
            this.globe.pointColor(d => this.getCountryColor(d));
        }

    }

    submitGuess() {
        if (this.gameState !== 'playing') return;

        const input = document.getElementById('countryInput');
        const guessName = input.value.trim();
        
        if (!guessName) return;

        // Find the country
        const country = this.countriesData.find(c => 
            c.name.toLowerCase() === guessName.toLowerCase()
        );

        if (!country) {
            this.showError('Country not found. Please check the spelling or use the autocomplete suggestions.');
            return;
        }

        // Check if already guessed
        if (this.guesses.some(g => g.name === country.name)) {
            this.showError('You already guessed this country!');
            return;
        }

        // Calculate distance
        const distance = this.calculateDistance(
            this.mysteryCountry.lat, this.mysteryCountry.lng,
            country.lat, country.lng
        );

        // Create guess object
        const guess = {
            ...country,
            distance: distance,
            distanceCategory: this.getDistanceCategory(distance),
            isCorrect: country.name === this.mysteryCountry.name,
            guessNumber: this.guesses.length + 1
        };

        this.guesses.push(guess);
        
        // Clear input and hide suggestions
        input.value = '';
        this.hideSuggestions();

        // Update UI
        this.updateStats();
        this.addGuessToHistory(guess);
        this.updateGlobeColors();

        // Check if won
        if (guess.isCorrect) {
            this.gameWon();
        } else {
            // Focus on the guessed country
            this.focusOnCountry(country);
        }
    }

    gameWon() {
        this.gameState = 'won';
        
        // Update best score
        const currentScore = this.guesses.length;
        if (!this.bestScore || currentScore < this.bestScore) {
            this.bestScore = currentScore;
            localStorage.setItem('globle-best-score', this.bestScore);
            this.updateStats();
        }

        // Show success modal
        setTimeout(() => {
            this.showSuccess();
        }, 1000);

        // Prepare for next round
        this.currentRound++;
    }

    giveUp() {
        if (this.gameState !== 'playing') return;

        // Clear guess cards since game is ending
        this.hideCurrentGuessCard();
        this.updateClosestGuessCard();
        this.closestGuess = null;

        // Show the mystery country
        this.focusOnCountry(this.mysteryCountry);
        
        // Add to guess history as a special entry
        const giveUpGuess = {
            ...this.mysteryCountry,
            distance: 0,
            distanceCategory: 'correct',
            isCorrect: true,
            guessNumber: this.guesses.length + 1,
            isGiveUp: true
        };

        this.guesses.push(giveUpGuess);
        this.addGuessToHistory(giveUpGuess);
        
        this.gameState = 'won';
        this.updateStats();
        this.updateGlobeColors();
        
        // Prepare for next round
        this.currentRound++;
        
        setTimeout(() => {
            this.showSuccess(true);
        }, 1000);
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
                Math.sin(dLng/2) * Math.sin(dLng/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    getDistanceCategory(distance) {
        if (distance <= this.distanceThresholds['very-close']) return 'very-close';
        if (distance <= this.distanceThresholds['close']) return 'close';
        if (distance <= this.distanceThresholds['medium']) return 'medium';
        if (distance <= this.distanceThresholds['far']) return 'far';
        return 'very-far';
    }

    getCountryColor(country) {
        if (!this.mysteryCountry || this.gameState === 'waiting') {
            return '#3b82f6'; // Default blue
        }

        // If it's the mystery country and game is won, show it in gold
        if (country.name === this.mysteryCountry.name && this.gameState === 'won') {
            return '#ffd700'; // Gold
        }

        // If it's been guessed, show distance color
        const guess = this.guesses.find(g => g.name === country.name);
        if (guess) {
            if (guess.isCorrect) return '#22c55e'; // Green for correct
            
            switch (guess.distanceCategory) {
                case 'very-close': return '#dc2626'; // Dark red
                case 'close': return '#f97316'; // Orange
                case 'medium': return '#eab308'; // Yellow
                case 'far': return '#22c55e'; // Green
                case 'very-far': return '#3b82f6'; // Blue
                default: return '#6b7280'; // Gray
            }
        }

        return '#6b7280'; // Gray for unguessed
    }

    updateGlobeColors() {
        if (this.globe) {
            this.globe.pointColor(d => this.getCountryColor(d));
        }
    }

    handleCountryClick(country) {
        if (!country || this.gameState !== 'playing') return;
        
        // Set the country name in input and submit
        const input = document.getElementById('countryInput');
        if (input) {
            input.value = country.name;
            this.submitGuess();
        }
    }

    handleCountryHover(country, prevCountry) {
        if (!this.globe || this.gameState !== 'playing') return;
        
        // Highlight hovered country
        this.globe.pointRadius(d => d === country ? 1.2 : 0.6);
    }

    focusOnCountry(country) {
        if (this.globe && country) {
            this.globe.pointOfView({
                lat: country.lat,
                lng: country.lng,
                altitude: 1.5
            }, 2000);
        }
    }

    resetGlobeView() {
        if (this.globe) {
            this.globe.pointOfView({ altitude: 2.5 }, 1000);
        }
    }

    toggleAutoRotate() {
        this.isAutoRotating = !this.isAutoRotating;
        const btn = document.getElementById('autoRotate');
        
        if (this.globe) {
            this.globe.controls().autoRotate = this.isAutoRotating;
            this.globe.controls().autoRotateSpeed = 0.5;
        }
        
        if (btn) {
            btn.classList.toggle('active', this.isAutoRotating);
        }
    }

    updateStats() {
        const elements = {
            roundNumber: this.currentRound,
            guessCount: this.guesses.length,
            bestScore: this.bestScore || '-'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });

        // Update Give Up button based on game state
        this.updateGiveUpButton();
    }

    updateGiveUpButton() {
        const giveUpBtn = document.getElementById('giveUpGlobe');
        if (!giveUpBtn) return;

        if (this.gameState === 'playing') {
            // Game is active - show Give Up
            giveUpBtn.innerHTML = '<i class="fas fa-flag"></i><span>Give Up</span>';
            giveUpBtn.title = 'Give Up';
            giveUpBtn.className = 'globe-btn danger';
            giveUpBtn.onclick = this.giveUp.bind(this);
        } else {
            // Game is not active - show New Game
            giveUpBtn.innerHTML = '<i class="fas fa-play"></i><span>New Game</span>';
            giveUpBtn.title = 'Start New Game';
            giveUpBtn.className = 'globe-btn primary';
            giveUpBtn.onclick = this.startNewRound.bind(this);
        }
    }

    addGuessToHistory(guess) {
        const guessList = document.getElementById('guessList');
        if (!guessList) return;

        // Remove empty state
        const emptyState = guessList.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        // Create guess item
        const guessItem = document.createElement('div');
        guessItem.className = `guess-item ${guess.isCorrect ? 'correct' : ''}`;
        guessItem.setAttribute('data-distance', guess.distanceCategory);
        
        const distanceText = guess.isCorrect ? 'Correct!' : `${Math.round(guess.distance)} km away`;
        const categoryText = guess.isCorrect ? 'FOUND IT!' : 
            guess.distanceCategory.replace('-', ' ').toUpperCase();

        guessItem.innerHTML = `
            <div class="guess-number">${guess.guessNumber}</div>
            <div class="guess-country">
                <img src="${guess.flag}" alt="${guess.name} flag" class="guess-flag">
                <span class="guess-name">${guess.name}</span>
            </div>
            <div class="guess-distance">${distanceText}</div>
            <div class="distance-indicator">
                <div class="distance-dot"></div>
                <span>${categoryText}</span>
            </div>
            ${guess.isGiveUp ? '<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem;">🏳️ Given up</div>' : ''}
        `;

        // Add to top of list
        guessList.insertBefore(guessItem, guessList.firstChild);
        
        // Handle closest guess tracking and overlays
        this.handleGuessOverlays(guess);
    }

    handleGuessOverlays(guess) {
        // Always show the current guess (most recent guess)
        this.showPersistentGuessCard(guess);
        
        // Check if this is the closest guess so far (excluding correct guesses)
        if (!guess.isCorrect) {
            const isNewClosest = !this.closestGuess || guess.distance < this.closestGuess.distance;
            
            if (isNewClosest) {
                // Update closest guess
                this.closestGuess = guess;
                
                // Update closest guess card
                this.updateClosestGuessCard(guess);
            }
        } else {
            // If guess is correct, clear closest guess
            this.closestGuess = null;
            this.updateClosestGuessCard();
        }
    }

    showPersistentGuessCard(guess) {
        const currentGuessCard = document.querySelector('.current-guess-card');
        if (!currentGuessCard) return;

        // Clear any existing timeout since we're keeping it persistent now
        if (this.currentGuessTimeout) {
            clearTimeout(this.currentGuessTimeout);
            this.currentGuessTimeout = null;
        }

        // Update card content
        this.updateGuessCard(currentGuessCard, guess);
        
        // Show the card persistently
        currentGuessCard.style.display = 'block';
    }

    hideCurrentGuessCard() {
        const currentGuessCard = document.querySelector('.current-guess-card');
        if (currentGuessCard) {
            currentGuessCard.style.display = 'none';
        }
    }

    updateClosestGuessCard(guess = null) {
        const closestGuessCard = document.querySelector('.closest-guess-card');
        if (!closestGuessCard) return;

        if (guess && !guess.isCorrect) {
            this.updateGuessCard(closestGuessCard, guess);
            closestGuessCard.style.display = 'block';
        } else {
            closestGuessCard.style.display = 'none';
        }
    }

    updateGuessCard(cardElement, guess) {
        if (!cardElement || !guess) return;

        // Set distance attribute for styling
        cardElement.setAttribute('data-distance', guess.distanceCategory);
        if (guess.isCorrect) {
            cardElement.classList.add('correct');
        } else {
            cardElement.classList.remove('correct');
        }

        // Update content
        const numberElement = cardElement.querySelector('.guess-card-number');
        const flagElement = cardElement.querySelector('.guess-card-flag');
        const nameElement = cardElement.querySelector('.guess-card-name');
        const distanceElement = cardElement.querySelector('.guess-card-distance');
        const categoryElement = cardElement.querySelector('.guess-card-category');

        if (numberElement) numberElement.textContent = guess.guessNumber;
        if (flagElement) {
            flagElement.src = guess.flag;
            flagElement.alt = `${guess.name} flag`;
        }
        if (nameElement) nameElement.textContent = guess.name;
        if (distanceElement) {
            distanceElement.textContent = guess.isCorrect ? 'Correct!' : `${Math.round(guess.distance)} km away`;
        }
        if (categoryElement) {
            categoryElement.textContent = guess.isCorrect ? 'FOUND IT!' : 
                guess.distanceCategory.replace('-', ' ').toUpperCase();
        }
    }

    removeClosestGuessCard() {
        this.updateClosestGuessCard();
    }

    getDistanceColor(category) {
        const colors = {
            'very-close': '#dc2626',
            'close': '#f97316',
            'medium': '#eab308',
            'far': '#22c55e',
            'very-far': '#3b82f6'
        };
        return colors[category] || '#6b7280';
    }

    clearGuessHistory() {
        const guessList = document.getElementById('guessList');
        if (!guessList) return;

        guessList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-map-marked-alt"></i>
                <p>Start guessing countries to see your progress here!</p>
            </div>
        `;
    }

    clearHistory() {
        this.clearGuessHistory();
    }

    showRules() {
        const modal = document.getElementById('rulesModal');
        if (modal) {
            modal.classList.add('visible');
            document.body.style.overflow = 'hidden';
        }
    }

    hideRules() {
        const modal = document.getElementById('rulesModal');
        if (modal) {
            modal.classList.remove('visible');
            document.body.style.overflow = '';
        }
    }

    showSuccess(isGiveUp = false) {
        const modal = document.getElementById('successModal');
        const countryElement = document.getElementById('successCountry');
        const flagElement = document.getElementById('successFlag');
        const guessesElement = document.getElementById('finalGuesses');
        const roundElement = document.getElementById('finalRound');
        
        if (modal && this.mysteryCountry) {
            countryElement.textContent = this.mysteryCountry.name;
            flagElement.src = this.mysteryCountry.flag;
            flagElement.alt = `${this.mysteryCountry.name} flag`;
            guessesElement.textContent = this.guesses.length;
            roundElement.textContent = this.currentRound - 1;
            
            // Update header for give up
            const header = modal.querySelector('.modal-header h2');
            if (header && isGiveUp) {
                header.innerHTML = '<i class="fas fa-flag"></i> Game Over';
            } else if (header) {
                header.innerHTML = '<i class="fas fa-trophy"></i> Congratulations!';
            }
            
            modal.classList.add('visible');
            document.body.style.overflow = 'hidden';
        }
    }

    hideSuccess() {
        const modal = document.getElementById('successModal');
        if (modal) {
            modal.classList.remove('visible');
            document.body.style.overflow = '';
        }
    }

    showError(message) {
        // Create or update error message
        let errorElement = document.querySelector('.error-message');
        
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            errorElement.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ef4444;
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 14px;
                z-index: 1001;
                max-width: 300px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                transform: translateX(100%);
                transition: transform 0.3s ease;
            `;
            document.body.appendChild(errorElement);
        }
        
        errorElement.textContent = message;
        
        // Show error
        setTimeout(() => {
            errorElement.style.transform = 'translateX(0)';
        }, 100);
        
        // Hide error after 3 seconds
        setTimeout(() => {
            errorElement.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (errorElement.parentNode) {
                    errorElement.parentNode.removeChild(errorElement);
                }
            }, 300);
        }, 3000);
    }

    // Cleanup method
    destroy() {
        if (this.globe) {
            // Clean up globe
            this.globe = null;
        }
        
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeydown);
        window.removeEventListener('scroll', this.updateActiveSection);
        window.removeEventListener('resize', this.handleResize);
    }
}

// Initialize the game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for other scripts to load
    setTimeout(() => {
        window.globleGame = new GlobleGame();
    }, 500);
});

// Handle page visibility changes for performance
document.addEventListener('visibilitychange', () => {
    if (window.globleGame && window.globleGame.globe) {
        if (document.hidden) {
            // Pause animations when page is hidden
            window.globleGame.globe.pauseAnimation();
        } else {
            // Resume animations when page is visible
            window.globleGame.globe.resumeAnimation();
        }
    }
});
