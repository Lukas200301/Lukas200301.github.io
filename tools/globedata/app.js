/**
 * GlobeData 
 * 3D globe visualization with country data
 */

class InteractiveGlobe {
    constructor() {
        this.globe = null;
        this.countriesData = [];
        this.isAutoRotating = false;
        this.loadingProgress = 0;
        this.tooltip = null;
        this.libraryLoadAttempts = 0;
        this.maxLoadAttempts = 3;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        
        try {
            // Wait for libraries to load
            await this.waitForLibraries();
            
            // Load countries data
            await this.loadCountriesData();
            
            // Initialize globe
            this.initializeGlobe();
            
            // Setup controls
            this.setupControls();
            
        } catch (error) {
            console.error('Error initializing globe:', error);
            this.showError(error.message || 'Failed to load globe data. Please refresh the page.');
        }
    }

    async waitForLibraries() {
        return new Promise((resolve, reject) => {
            const checkLibraries = () => {
                console.log('Checking for Globe library...', typeof Globe);
                console.log('Window object keys:', Object.keys(window).filter(k => k.includes('Globe') || k.includes('THREE')));
                
                if (typeof Globe !== 'undefined') {
                    console.log('Globe.gl library loaded successfully');
                    resolve();
                    return;
                }

                this.libraryLoadAttempts++;
                if (this.libraryLoadAttempts >= this.maxLoadAttempts) {
                    reject(new Error('Globe.gl library failed to load after multiple attempts. Please check your internet connection and try again.'));
                    return;
                }

                console.log(`Waiting for libraries... Attempt ${this.libraryLoadAttempts}/${this.maxLoadAttempts}`);
                setTimeout(checkLibraries, 1000);
            };

            // Start checking immediately
            checkLibraries();
        });
    }

    async loadCountriesData() {
        try {
            console.log('Loading countries data...');
            
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
            const allCountries = [...independentData, ...nonIndependentData];
            console.log(`Loaded ${independentData.length} independent and ${nonIndependentData.length} non-independent countries`);
            
            // Process and filter countries with valid coordinates
            this.countriesData = allCountries
                .filter(country => country.latlng && country.latlng.length === 2)
                .map(country => ({
                    name: country.name.common,
                    capital: country.capital ? country.capital[0] : 'N/A',
                    population: country.population || 0,
                    region: country.region || 'N/A',
                    subregion: country.subregion || 'N/A',
                    area: country.area || 0,
                    languages: country.languages ? Object.values(country.languages).join(', ') : 'N/A',
                    currencies: country.currencies ? Object.values(country.currencies).map(curr => curr.name).join(', ') : 'N/A',
                    callingCode: country.idd && country.idd.root && country.idd.suffixes ? 
                        country.idd.root + (country.idd.suffixes[0] || '') : 'N/A',
                    flag: country.flags.png || country.flags.svg,
                    lat: country.latlng[0],
                    lng: country.latlng[1],
                    code: country.cca3,
                    independent: country.independent || false
                }));
            
            console.log(`Total processed countries: ${this.countriesData.length}`);
        } catch (error) {
            console.error('Error loading countries data:', error);
            throw new Error('Failed to load country data. Please check your internet connection.');
        }
    }

    initializeGlobe() {
        const globeElement = document.getElementById('globeViz');
        if (!globeElement) {
            throw new Error('Globe container element not found');
        }

        try {
            console.log('Creating Globe instance...');
            console.log('Globe element dimensions:', globeElement.clientWidth, 'x', globeElement.clientHeight);
            console.log('Countries data count:', this.countriesData.length);
            
            // Create globe instance with simpler configuration first
            this.globe = Globe()
                (globeElement)
                .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
                .backgroundColor('rgba(0,0,0,0)')
                .width(globeElement.clientWidth)
                .height(globeElement.clientHeight);

            console.log('Basic globe created, adding points...');

            // Add points data
            this.globe
                .pointsData(this.countriesData)
                .pointAltitude(0.02)
                .pointRadius(0.8)
                .pointColor(() => '#3b82f6')
                .pointLabel(d => `
                    <div style="
                        background: rgba(15, 23, 42, 0.95);
                        border: 1px solid rgba(59, 130, 246, 0.3);
                        border-radius: 8px;
                        padding: 12px 16px;
                        font-size: 14px;
                        font-weight: 500;
                        color: white;
                        pointer-events: none;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                        backdrop-filter: blur(8px);
                        max-width: 200px;
                    ">
                        <div style="font-weight: 600; margin-bottom: 4px; color: #3b82f6;">${d.name}</div>
                        <div style="font-size: 12px; opacity: 0.9;">Capital: ${d.capital}</div>
                        <div style="font-size: 12px; opacity: 0.9;">Population: ${this.formatNumber(d.population)}</div>
                    </div>
                `)
                .onPointClick(this.handleCountryClick.bind(this))
                .onPointHover(this.handleCountryHover.bind(this));

            // Set initial camera position
            this.globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 });

            // Add atmosphere after globe is created
            setTimeout(() => {
                if (this.globe) {
                    this.globe.atmosphereColor('#3b82f6');
                    this.globe.atmosphereAltitude(0.15);
                }
            }, 100);

            // Handle resize
            this.handleResize = () => {
                if (this.globe && globeElement) {
                    this.globe.width(globeElement.clientWidth);
                    this.globe.height(globeElement.clientHeight);
                }
            };
            
            window.addEventListener('resize', this.handleResize);

            console.log('Globe initialized successfully with', this.countriesData.length, 'countries');
        } catch (error) {
            console.error('Error initializing globe:', error);
            throw new Error('Failed to initialize 3D globe. Your browser might not support WebGL.');
        }
    }

    handleCountryClick(country) {
        if (!country) return;
        
        console.log('Country clicked:', country.name);
        this.showCountryOverlay(country);
        
        // Focus on the country
        if (this.globe) {
            this.globe.pointOfView({
                lat: country.lat,
                lng: country.lng,
                altitude: 1.5
            }, 1000);
        }
    }

    handleCountryHover(country, prevCountry) {
        if (!this.globe) return;
        
        // Update point colors on hover
        this.globe
            .pointColor(d => d === country ? '#f59e0b' : '#3b82f6')
            .pointRadius(d => d === country ? 1.2 : 0.6);
    }

    showCountryOverlay(country) {
        const overlay = document.getElementById('countryOverlay');
        if (!overlay) return;

        // Populate country data
        const elements = {
            'countryName': country.name,
            'countryCapital': country.capital,
            'countryPopulation': this.formatNumber(country.population),
            'countryRegion': country.region,
            'countrySubregion': country.subregion,
            'countryArea': this.formatArea(country.area),
            'countryLanguages': country.languages,
            'countryCurrencies': country.currencies,
            'countryCallingCode': country.callingCode
        };

        // Update text elements
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
        
        // Set flag
        const flagImg = document.getElementById('countryFlag');
        if (flagImg) {
            flagImg.src = country.flag;
            flagImg.alt = `Flag of ${country.name}`;
            flagImg.onerror = () => {
                flagImg.style.display = 'none';
            };
        }

        // Show overlay
        overlay.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    hideCountryOverlay() {
        const overlay = document.getElementById('countryOverlay');
        if (overlay) {
            overlay.classList.remove('visible');
            document.body.style.overflow = '';
        }
    }

    setupControls() {
        // Reset view button
        const resetBtn = document.getElementById('resetView');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (this.globe) {
                    this.globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 1000);
                }
                resetBtn.classList.add('active');
                setTimeout(() => resetBtn.classList.remove('active'), 300);
            });
        }

        // Auto rotate button
        const autoRotateBtn = document.getElementById('autoRotate');
        if (autoRotateBtn) {
            autoRotateBtn.addEventListener('click', () => {
                this.toggleAutoRotate();
                autoRotateBtn.classList.toggle('active', this.isAutoRotating);
            });
        }

        // Close overlay button
        const closeBtn = document.getElementById('closeOverlay');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideCountryOverlay();
            });
        }

        // Close overlay on escape key
        this.handleKeydown = (e) => {
            if (e.key === 'Escape') {
                this.hideCountryOverlay();
            }
        };
        document.addEventListener('keydown', this.handleKeydown);

        // Close overlay on backdrop click
        const overlay = document.getElementById('countryOverlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.hideCountryOverlay();
                }
            });
        }
    }

    toggleAutoRotate() {
        if (!this.globe) return;
        
        this.isAutoRotating = !this.isAutoRotating;
        
        if (this.isAutoRotating) {
            this.globe.controls().autoRotate = true;
            this.globe.controls().autoRotateSpeed = 0.5;
        } else {
            this.globe.controls().autoRotate = false;
        }
    }

    setupEventListeners() {
        // Handle section navigation
        document.addEventListener('DOMContentLoaded', () => {
            // Initialize section dots if they exist
            const sectionDots = document.querySelectorAll('.nav-dot');
            sectionDots.forEach(dot => {
                dot.addEventListener('click', (e) => {
                    const section = dot.dataset.section;
                    this.scrollToSection(section);
                    
                    // Update active state
                    sectionDots.forEach(d => d.classList.remove('active'));
                    dot.classList.add('active');
                });
            });
        });

        // Handle scroll for section navigation
        window.addEventListener('scroll', () => {
            this.updateActiveSection();
        });
    }

    scrollToSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    updateActiveSection() {
        const sections = ['overview', 'globe'];
        const scrollPosition = window.scrollY + 100;

        for (const sectionId of sections) {
            const section = document.getElementById(sectionId);
            const dot = document.querySelector(`[data-section="${sectionId}"]`);
            
            if (section && dot) {
                const sectionTop = section.offsetTop;
                const sectionBottom = sectionTop + section.offsetHeight;
                
                if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
                    document.querySelectorAll('.nav-dot').forEach(d => d.classList.remove('active'));
                    dot.classList.add('active');
                }
            }
        }
    }

    formatNumber(num) {
        if (!num || num === 0) return 'N/A';
        return new Intl.NumberFormat().format(num);
    }

    formatArea(area) {
        if (!area || area === 0) return 'N/A';
        return `${this.formatNumber(area)} km²`;
    }

    showError(message) {
        console.error(message);
        
        // Show error in globe container
        const globeContainer = document.getElementById('globeViz');
        if (globeContainer) {
            globeContainer.innerHTML = `
                <div style="
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    height: 100%; 
                    flex-direction: column; 
                    color: var(--text-secondary);
                    padding: 2rem;
                    text-align: center;
                ">
                    <i class="fas fa-exclamation-triangle" style="
                        font-size: 48px; 
                        margin-bottom: 16px; 
                        color: #ef4444;
                    "></i>
                    <h3 style="
                        margin: 0 0 8px 0; 
                        color: var(--text-primary);
                        font-size: 1.25rem;
                    ">Unable to Load Globe</h3>
                    <p style="
                        margin: 0 0 16px 0; 
                        max-width: 400px;
                        line-height: 1.5;
                    ">${message}</p>
                    <button onclick="location.reload()" style="
                        margin-top: 16px; 
                        padding: 12px 24px; 
                        background: var(--primary); 
                        color: white; 
                        border: none; 
                        border-radius: 8px; 
                        cursor: pointer;
                        font-weight: 500;
                        transition: all 0.2s ease;
                    " onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                        <i class="fas fa-redo" style="margin-right: 8px;"></i>
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    // Cleanup method
    destroy() {
        if (this.globe) {
            // Clean up globe instance if needed
            this.globe = null;
        }
        
        // Remove event listeners
        if (this.handleResize) {
            window.removeEventListener('resize', this.handleResize);
        }
        if (this.handleKeydown) {
            document.removeEventListener('keydown', this.handleKeydown);
        }
    }
}

// Initialize the globe when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for other scripts to load, then try multiple times if needed
    let initAttempts = 0;
    const maxAttempts = 10;
    
    const tryInitialize = () => {
        initAttempts++;
        console.log(`Globe initialization attempt ${initAttempts}/${maxAttempts}`);
        console.log('Available window properties:', Object.keys(window).filter(k => k.toLowerCase().includes('globe')));
        
        if (typeof Globe !== 'undefined') {
            console.log('Globe.gl library detected, initializing...');
            
            // Test basic globe creation first
            const testElement = document.getElementById('globeViz');
            if (testElement) {
                console.log('Test element found, dimensions:', testElement.clientWidth, 'x', testElement.clientHeight);
                
                try {
                    // Quick test
                    const testGlobe = Globe()(testElement);
                    console.log('Basic Globe creation successful');
                    
                    // If test works, initialize full app
                    window.interactiveGlobe = new InteractiveGlobe();
                } catch (testError) {
                    console.error('Basic Globe creation failed:', testError);
                    
                    // Show error
                    testElement.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; color: var(--text-secondary); padding: 2rem; text-align: center;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; color: #ef4444;"></i>
                            <h3 style="margin: 0 0 8px 0; color: var(--text-primary); font-size: 1.25rem;">WebGL Not Supported</h3>
                            <p style="margin: 0 0 16px 0; max-width: 400px; line-height: 1.5;">Your browser doesn't support WebGL or 3D graphics. Please try a different browser.</p>
                            <p style="font-size: 12px; opacity: 0.7;">Error: ${testError.message}</p>
                        </div>
                    `;
                    
                    // Hide loading
                    const loadingScreen = document.getElementById('globeLoading');
                    if (loadingScreen) loadingScreen.classList.add('hidden');
                }
            }
        } else if (initAttempts < maxAttempts) {
            console.log('Globe.gl library not ready, retrying...');
            setTimeout(tryInitialize, 1000);
        } else {
            console.error('Globe.gl library failed to load after multiple attempts');
            // Show error message
            const globeContainer = document.getElementById('globeViz');
            if (globeContainer) {
                globeContainer.innerHTML = `
                    <div style="
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        height: 100%; 
                        flex-direction: column; 
                        color: var(--text-secondary);
                        padding: 2rem;
                        text-align: center;
                    ">
                        <i class="fas fa-exclamation-triangle" style="
                            font-size: 48px; 
                            margin-bottom: 16px; 
                            color: #ef4444;
                        "></i>
                        <h3 style="
                            margin: 0 0 8px 0; 
                            color: var(--text-primary);
                            font-size: 1.25rem;
                        ">Library Loading Error</h3>
                        <p style="
                            margin: 0 0 16px 0; 
                            max-width: 400px;
                            line-height: 1.5;
                        ">Globe.gl library failed to load. This might be due to network issues or browser compatibility.</p>
                        <button onclick="location.reload()" style="
                            margin-top: 16px; 
                            padding: 12px 24px; 
                            background: var(--primary); 
                            color: white; 
                            border: none; 
                            border-radius: 8px; 
                            cursor: pointer;
                            font-weight: 500;
                        ">
                            <i class="fas fa-redo" style="margin-right: 8px;"></i>
                            Reload Page
                        </button>
                    </div>
                `;
            }
            
            // Hide loading screen
            const loadingScreen = document.getElementById('globeLoading');
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
            }
        }
    };
    
    // Start trying to initialize
    setTimeout(tryInitialize, 500);
});

// Handle page visibility changes for performance
document.addEventListener('visibilitychange', () => {
    if (window.interactiveGlobe && window.interactiveGlobe.globe) {
        if (document.hidden) {
            // Pause globe rendering when tab is not visible
            if (window.interactiveGlobe.globe.pauseAnimation) {
                window.interactiveGlobe.globe.pauseAnimation();
            }
        } else {
            // Resume globe rendering when tab becomes visible
            if (window.interactiveGlobe.globe.resumeAnimation) {
                window.interactiveGlobe.globe.resumeAnimation();
            }
        }
    }
});
