/**
 * JAVASCRIPT FUNCTIONALITY
 * Lukas200301 
 * Enhanced interactions, animations, and dynamic content
 */

class PortfolioApp {
    constructor() {
        this.isLoaded = false;
        this.currentSection = 'home';
        this.repos = [];
        this.skills = [];
        this.scrollProgress = 0;
        this.mousePosition = { x: 0, y: 0 };
        this.neuralNodes = [];
        this.typewriterTexts = [
            'Full Stack Developer',
            'Creative Problem Solver',
            'Innovation Enthusiast',
            'Code Architect',
            'Digital Creator'
        ];
        this.currentTypewriterIndex = 0;
        this.gitHubCache = {
            data: null,
            timestamp: null,
            ttl: 5 * 60 * 1000 // 5 minutes cache
        };
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.initializeCursor();
        this.initializeNeuralNetwork();
        this.initializeScrollAnimations();
        this.initializeNavigation();
        this.initializeTypewriter();
        this.showLoadingScreen();
        
        // Load dynamic content
        await this.loadGitHubData();
        this.initializeStats();
        this.initializeSkillsAnimation();
        
        // Hide loading screen after everything is ready
        setTimeout(() => this.hideLoadingScreen(), 2000);
    }

    setupEventListeners() {
        // Window events
        window.addEventListener('load', () => this.handleWindowLoad());
        window.addEventListener('scroll', () => this.handleScroll());
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));

        // Navigation
        const navToggle = document.getElementById('navToggle');
        const navMenu = document.getElementById('navMenu');
        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => this.toggleNavigation());
        }

        // Navigation links
        document.querySelectorAll('.nav-link, .cta-button[data-section]').forEach(link => {
            link.addEventListener('click', (e) => this.handleNavigation(e));
        });

        // Back to top button
        const backToTop = document.getElementById('backToTop');
        if (backToTop) {
            backToTop.addEventListener('click', () => this.scrollToTop());
        }

        // Project filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.filterProjects(e));
        });

        // Skill items hover effects
        document.querySelectorAll('.skill-item').forEach(item => {
            item.addEventListener('mouseenter', () => this.animateSkillItem(item, true));
            item.addEventListener('mouseleave', () => this.animateSkillItem(item, false));
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Section navigation dots
        this.initializeSectionDots();
    }

    initializeCursor() {
        if (window.matchMedia('(pointer: coarse)').matches) return;

        const cursorFollower = document.getElementById('cursorFollower');
        const cursorDot = document.getElementById('cursorDot');

        if (!cursorFollower || !cursorDot) return;

        document.addEventListener('mousemove', (e) => {
            const { clientX: x, clientY: y } = e;
            
            cursorDot.style.left = `${x}px`;
            cursorDot.style.top = `${y}px`;
            cursorDot.style.transform = 'translate(-50%, -50%)';
            cursorDot.style.opacity = '1';
            
            setTimeout(() => {
                cursorFollower.style.left = `${x}px`;
                cursorFollower.style.top = `${y}px`;
                cursorFollower.style.transform = 'translate(-50%, -50%)';
                cursorFollower.style.opacity = '1';
            }, 50);
        });

        // Enhance cursor for interactive elements
        document.querySelectorAll('a, button, .skill-item, .contact-item').forEach(el => {
            el.addEventListener('mouseenter', () => {
                cursorFollower.style.transform = 'translate(-50%, -50%) scale(1.5)';
                cursorFollower.style.borderColor = 'var(--secondary-accent)';
            });
            
            el.addEventListener('mouseleave', () => {
                cursorFollower.style.transform = 'translate(-50%, -50%) scale(1)';
                cursorFollower.style.borderColor = 'var(--primary-accent)';
            });
        });
    }

    initializeNeuralNetwork() {
        const canvas = document.getElementById('neuralCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let animationId;

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            this.generateNeuralNodes();
        };

        this.generateNeuralNodes = () => {
            this.neuralNodes = [];
            const nodeCount = Math.min(100, Math.floor((canvas.width * canvas.height) / 15000));
            
            for (let i = 0; i < nodeCount; i++) {
                this.neuralNodes.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.5,
                    size: Math.random() * 2 + 1
                });
            }
        };

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Update and draw nodes
            this.neuralNodes.forEach((node, index) => {
                // Update position
                node.x += node.vx;
                node.y += node.vy;
                
                // Bounce off edges
                if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
                if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
                
                // Draw node
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(99, 102, 241, ${0.3 + Math.sin(Date.now() * 0.001 + index) * 0.2})`;
                ctx.fill();
                
                // Draw connections
                this.neuralNodes.slice(index + 1).forEach(otherNode => {
                    const distance = Math.hypot(node.x - otherNode.x, node.y - otherNode.y);
                    if (distance < 150) {
                        ctx.beginPath();
                        ctx.moveTo(node.x, node.y);
                        ctx.lineTo(otherNode.x, otherNode.y);
                        ctx.strokeStyle = `rgba(99, 102, 241, ${0.1 * (1 - distance / 150)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                });
            });
            
            animationId = requestAnimationFrame(animate);
        };

        resizeCanvas();
        animate();

        window.addEventListener('resize', resizeCanvas);

        // Cleanup function
        this.cleanupNeuralNetwork = () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
            window.removeEventListener('resize', resizeCanvas);
        };
    }

    initializeScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    
                    // Trigger specific animations based on section
                    const sectionId = entry.target.id;
                    if (sectionId === 'about') {
                        this.animateStats();
                    } else if (sectionId === 'skills') {
                        this.animateSkills();
                    }
                }
            });
        }, observerOptions);

        document.querySelectorAll('section').forEach(section => {
            observer.observe(section);
        });
    }

    initializeNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        
        // Update active nav link based on scroll position
        const updateActiveNav = () => {
            const sections = document.querySelectorAll('section');
            const navDots = document.querySelectorAll('.nav-dot');
            let currentSection = '';
            
            sections.forEach(section => {
                const rect = section.getBoundingClientRect();
                if (rect.top <= 100 && rect.bottom >= 100) {
                    currentSection = section.id;
                }
            });
            
            if (currentSection && currentSection !== this.currentSection) {
                this.currentSection = currentSection;
                
                // Update navigation links
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('data-section') === currentSection) {
                        link.classList.add('active');
                    }
                });

                // Update navigation dots
                navDots.forEach(dot => {
                    dot.classList.remove('active');
                    if (dot.getAttribute('data-section') === currentSection) {
                        dot.classList.add('active');
                    }
                });
            }
        };

        window.addEventListener('scroll', updateActiveNav);
        updateActiveNav(); // Initial call
    }

    initializeSectionDots() {
        const navDots = document.querySelectorAll('.nav-dot');
        
        // Add click handlers for navigation dots
        navDots.forEach(dot => {
            dot.addEventListener('click', () => {
                const targetSection = dot.getAttribute('data-section');
                const section = document.getElementById(targetSection);
                if (section) {
                    this.scrollToSection(section);
                }
            });
        });
    }

    initializeTypewriter() {
        const typewriterElement = document.querySelector('.typewriter-text');
        if (!typewriterElement) return;

        let currentText = '';
        let isDeleting = false;
        let textIndex = 0;
        let charIndex = 0;

        const type = () => {
            const fullText = this.typewriterTexts[textIndex];
            
            if (isDeleting) {
                currentText = fullText.substring(0, charIndex - 1);
                charIndex--;
            } else {
                currentText = fullText.substring(0, charIndex + 1);
                charIndex++;
            }
            
            typewriterElement.textContent = currentText;
            
            let typeSpeed = 100;
            
            if (isDeleting) {
                typeSpeed = 50;
            }
            
            if (!isDeleting && charIndex === fullText.length) {
                typeSpeed = 2000; // Pause at end
                isDeleting = true;
            } else if (isDeleting && charIndex === 0) {
                isDeleting = false;
                textIndex = (textIndex + 1) % this.typewriterTexts.length;
                typeSpeed = 500; // Pause before new text
            }
            
            setTimeout(type, typeSpeed);
        };

        type();
    }

    showLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.remove('hidden');
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                this.isLoaded = true;
            }, 800);
        }
    }

    async loadGitHubData() {
        // Check if we have valid cached data
        const now = Date.now();
        if (this.gitHubCache.data && 
            this.gitHubCache.timestamp && 
            (now - this.gitHubCache.timestamp) < this.gitHubCache.ttl) {
            console.log('Using cached GitHub data');
            this.repos = this.gitHubCache.data;
            this.displayProjects();
            return;
        }
        
        try {
            console.log('Fetching fresh GitHub data...');
            const response = await fetch('https://api.github.com/users/Lukas200301/repos?sort=updated&per_page=6');
            
            // Check if the response is ok before trying to parse JSON
            if (!response.ok) {
                throw new Error(`GitHub API responded with status: ${response.status} ${response.statusText}`);
            }
            
            const repos = await response.json();
            
            // Validate that we got a valid array response
            if (!Array.isArray(repos)) {
                throw new Error('Invalid response format from GitHub API');
            }
            
            // Add the Raspberry Pi project as a featured project
            const raspberryPiProject = {
                name: 'Raspberry Pi Control',
                description: 'A comprehensive application for controlling your Raspberry Pi from Android and Windows devices',
                language: 'Dart',
                stargazers_count: 3,
                forks_count: 0,
                html_url: 'https://github.com/Lukas200301/RaspberryPi-Control',
                isLocal: true,
                localUrl: 'pages/raspberry-pi-control.html'
            };
            
            // Combine featured project with GitHub repos
            const filteredRepos = repos.filter(repo => !repo.fork).slice(0, 5);
            this.repos = [raspberryPiProject, ...filteredRepos];
            
            // Cache the successful result
            this.gitHubCache.data = this.repos;
            this.gitHubCache.timestamp = now;
            
            console.log(`Successfully loaded ${this.repos.length} projects from GitHub API`);
            this.displayProjects();
            
            // Load commit data for this month (but don't let it fail the main load)
            try {
                await this.loadCommitData();
            } catch (commitError) {
                console.warn('Failed to load commit data, but projects loaded successfully:', commitError);
                // Set fallback commit count
                const commitCountElement = document.getElementById('commit-count');
                if (commitCountElement) {
                    commitCountElement.textContent = '20+';
                }
            }
            
        } catch (error) {
            console.error('Error loading GitHub data:', error);
            
            // Try to use stale cache data if available
            if (this.gitHubCache.data && this.gitHubCache.data.length > 3) {
                console.warn('Using stale cached data due to API error');
                this.repos = this.gitHubCache.data;
                this.displayProjects();
                return;
            }
            
            // Only fall back to hardcoded projects if we really can't get GitHub data
            // Try to provide more specific error handling
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                console.warn('Network error detected, falling back to cached/fallback projects');
            } else if (error.message.includes('403') || error.message.includes('rate limit')) {
                console.warn('Rate limit hit, falling back to cached/fallback projects');
            } else {
                console.warn('Unknown error occurred, falling back to cached/fallback projects');
            }
            
            this.displayFallbackProjects();
        }
    }

    async loadCommitData() {
        try {
            // Get the start of current month
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfMonthISO = startOfMonth.toISOString();
            
            // Fetch commits from all repos for this month
            let totalCommits = 0;
            const commitPromises = this.repos.slice(0, 10).map(async (repo) => {
                if (repo.isLocal) return 0; // Skip local projects
                
                try {
                    const commitsResponse = await fetch(
                        `https://api.github.com/repos/Lukas200301/${repo.name}/commits?since=${startOfMonthISO}&author=Lukas200301`
                    );
                    const commits = await commitsResponse.json();
                    return Array.isArray(commits) ? commits.length : 0;
                } catch (error) {
                    console.warn(`Failed to fetch commits for ${repo.name}:`, error);
                    return 0;
                }
            });

            const commitCounts = await Promise.all(commitPromises);
            totalCommits = commitCounts.reduce((sum, count) => sum + count, 0);
            
            const commitCountElement = document.getElementById('commit-count');
            if (commitCountElement) {
                commitCountElement.textContent = totalCommits;
            }
            
        } catch (error) {
            console.error('Error loading commit data:', error);
            // Fallback to estimated number
            const commitCountElement = document.getElementById('commit-count');
            if (commitCountElement) {
                commitCountElement.textContent = '20+';
            }
        }
    }

    displayProjects() {
        const projectsGrid = document.getElementById('projectsGrid');
        const projectsLoading = document.getElementById('projectsLoading');
        
        if (!projectsGrid || !projectsLoading) return;

        projectsLoading.style.display = 'none';
        
        if (this.repos.length === 0) {
            this.displayFallbackProjects();
            return;
        }

        projectsGrid.innerHTML = this.repos.map(repo => this.createProjectCard(repo)).join('');
        
        // Animate project cards
        setTimeout(() => {
            document.querySelectorAll('.project-card').forEach((card, index) => {
                setTimeout(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, index * 100);
            });
        }, 100);
    }

    createProjectCard(repo) {
        const language = repo.language || 'Code';
        // Handle both old and new property names for backwards compatibility
        const stars = repo.stargazers_count || repo.stars || 0;
        const forks = repo.forks_count || repo.forks || 0;
        const description = repo.description || 'No description available';
        
        const languageIcons = {
            'JavaScript': 'fab fa-js-square',
            'TypeScript': 'fab fa-js-square',
            'Python': 'fab fa-python',
            'Java': 'fab fa-java',
            'HTML': 'fab fa-html5',
            'CSS': 'fab fa-css3-alt',
            'PHP': 'fab fa-php',
            'C++': 'fas fa-code',
            'C#': 'fas fa-code',
            'Go': 'fas fa-code',
            'Dart': 'devicon-dart-plain'
        };
        
        const icon = languageIcons[language] || 'fas fa-code';
        
        // Determine the correct URL and target for the project
        const projectUrl = repo.isLocal ? repo.localUrl : repo.html_url;
        const target = repo.isLocal ? '_self' : '_blank';
        const linkText = repo.isLocal ? 'View Project' : 'View Code';
        const linkIcon = repo.isLocal ? 'fas fa-eye' : 'fab fa-github';
        
        return `
            <div class="project-card" data-category="${this.getProjectCategory(repo)}" style="opacity: 0; transform: translateY(20px); transition: all 0.5s ease;">
                <div class="project-header">
                    <div class="project-icon">
                        <i class="${icon}"></i>
                    </div>
                    <div class="project-stats">
                        <span class="stat">
                            <i class="fas fa-star"></i>
                            ${stars}
                        </span>
                        <span class="stat">
                            <i class="fas fa-code-branch"></i>
                            ${forks}
                        </span>
                    </div>
                </div>
                <div class="project-content">
                    <h3 class="project-title">${repo.name}</h3>
                    <p class="project-description">${description}</p>
                    <div class="project-tech">
                        <span class="tech-tag">${language}</span>
                    </div>
                </div>
                <div class="project-actions">
                    <a href="${projectUrl}" target="${target}" rel="noopener noreferrer" class="project-link">
                        <i class="${linkIcon}"></i>
                        ${linkText}
                    </a>
                    ${!repo.isLocal && repo.html_url ? `
                        <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" class="project-link">
                            <i class="fab fa-github"></i>
                            GitHub
                        </a>
                    ` : ''}
                </div>
            </div>
        `;
    }

    displayFallbackProjects() {
        const projectsGrid = document.getElementById('projectsGrid');
        const projectsLoading = document.getElementById('projectsLoading');
        
        if (!projectsGrid || !projectsLoading) return;

        projectsLoading.style.display = 'none';
        
        // Add a notice that we're showing fallback projects
        const fallbackNotice = document.createElement('div');
        fallbackNotice.className = 'fallback-notice';
        fallbackNotice.innerHTML = `
            <div class="notice-content">
                <i class="fas fa-info-circle"></i>
                <span>Unable to load latest projects from GitHub API. Showing cached projects.</span>
                <button class="retry-btn" onclick="window.portfolioApp.retryLoadGitHubData()">
                    <i class="fas fa-redo"></i>
                    Retry
                </button>
            </div>
        `;
        
        const fallbackProjects = [
            {
                name: 'Raspberry Pi Control',
                description: 'A comprehensive application for controlling your Raspberry Pi from Android and Windows devices',
                language: 'Dart',
                stargazers_count: 3, // Use consistent property names
                forks_count: 0,      // Use consistent property names
                html_url: 'https://github.com/Lukas200301/RaspberryPi-Control',
                category: 'tools',
                isLocal: true,
                localUrl: 'pages/raspberry-pi-control.html'
            },
            {
                name: 'Portfolio Website',
                description: 'A modern, responsive portfolio website built with HTML, CSS, and JavaScript',
                language: 'JavaScript',
                stargazers_count: 0, // Use consistent property names
                forks_count: 0,      // Use consistent property names
                html_url: 'https://github.com/Lukas200301',
                category: 'web'
            },
            {
                name: 'Coming Soon',
                description: 'Exciting projects are in development. Stay tuned for amazing creations!',
                language: 'Code',
                stargazers_count: 0, // Use consistent property names
                forks_count: 0,      // Use consistent property names
                html_url: 'https://github.com/Lukas200301',
                category: 'tools'
            }
        ];

        // Set the repos to fallback projects
        this.repos = fallbackProjects;

        // Clear the grid and add the notice first
        projectsGrid.innerHTML = '';
        projectsGrid.appendChild(fallbackNotice);
        
        // Add the fallback project cards
        const projectCardsHTML = fallbackProjects.map(project => this.createProjectCard(project)).join('');
        projectsGrid.innerHTML += projectCardsHTML;
        
        // Animate project cards
        setTimeout(() => {
            document.querySelectorAll('.project-card').forEach((card, index) => {
                setTimeout(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, index * 100);
            });
        }, 100);
    }

    // Add retry method
    async retryLoadGitHubData() {
        const retryBtn = document.querySelector('.retry-btn');
        if (retryBtn) {
            retryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Retrying...';
            retryBtn.disabled = true;
        }
        
        // Remove the fallback notice
        const fallbackNotice = document.querySelector('.fallback-notice');
        if (fallbackNotice) {
            fallbackNotice.remove();
        }
        
        // Show loading again
        const projectsLoading = document.getElementById('projectsLoading');
        if (projectsLoading) {
            projectsLoading.style.display = 'block';
        }
        
        // Try to load GitHub data again
        await this.loadGitHubData();
    }
    
    // Method to check if we're showing fallback projects
    isShowingFallbackProjects() {
        return this.repos.length <= 3 && this.repos.some(repo => repo.name === 'Coming Soon');
    }
    
    // Method to get GitHub API status for debugging
    async checkGitHubAPIStatus() {
        try {
            const response = await fetch('https://api.github.com/rate_limit');
            const data = await response.json();
            console.log('GitHub API Rate Limit Status:', data);
            return data;
        } catch (error) {
            console.error('Unable to check GitHub API status:', error);
            return null;
        }
    }

    getProjectCategory(repo) {
        const name = repo.name.toLowerCase();
        const language = (repo.language || '').toLowerCase();
        const description = (repo.description || '').toLowerCase();
        
        if (language.includes('javascript') || language.includes('typescript') || 
            language.includes('html') || language.includes('css') || 
            name.includes('web') || description.includes('web')) {
            return 'web';
        } else if (language.includes('java') || language.includes('kotlin') || 
                   language.includes('swift') || name.includes('app') || 
                   description.includes('mobile')) {
            return 'mobile';
        } else {
            return 'tools';
        }
    }

    initializeStats() {
        const statNumbers = document.querySelectorAll('.stat-number');
        
        // Set up stats with dynamic values
        const stats = [
            { element: statNumbers[0], target: this.repos.length, label: 'Projects' },
            { element: statNumbers[1], target: this.repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0), label: 'GitHub Stars' },
            { element: statNumbers[2], target: new Set(this.repos.map(repo => repo.language).filter(Boolean)).size || 5, label: 'Languages' },
            { element: statNumbers[3], target: 2020, label: 'Started' }
        ];

        stats.forEach(stat => {
            if (stat.element) {
                stat.element.setAttribute('data-target', stat.target);
            }
        });
    }

    animateStats() {
        const statNumbers = document.querySelectorAll('.stat-number');
        
        statNumbers.forEach(stat => {
            const target = parseInt(stat.getAttribute('data-target')) || 0;
            const duration = 2000;
            const increment = target / (duration / 16);
            let current = 0;
            
            const updateStat = () => {
                current += increment;
                if (current < target) {
                    stat.textContent = Math.floor(current);
                    requestAnimationFrame(updateStat);
                } else {
                    stat.textContent = target;
                }
            };
            
            updateStat();
        });
    }

    initializeSkillsAnimation() {
        const skillItems = document.querySelectorAll('.skill-item');
        
        skillItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            item.style.transition = `all 0.5s ease ${index * 0.1}s`;
        });
    }

    animateSkills() {
        const skillItems = document.querySelectorAll('.skill-item');
        
        skillItems.forEach(item => {
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
        });
    }

    animateSkillItem(item, isHovering) {
        const icon = item.querySelector('i');
        if (!icon) return;
        
        if (isHovering) {
            icon.style.transform = 'scale(1.2) rotate(10deg)';
            icon.style.color = 'var(--primary-accent)';
        } else {
            icon.style.transform = 'scale(1) rotate(0deg)';
            icon.style.color = '';
        }
    }

    handleWindowLoad() {
        // Additional setup after window load
        this.updateScrollProgress();
    }

    handleScroll() {
        this.updateScrollProgress();
        this.updateBackToTopButton();
    }

    handleResize() {
        // Handle responsive adjustments
        this.updateScrollProgress();
    }

    handleMouseMove(e) {
        this.mousePosition = { x: e.clientX, y: e.clientY };
        
        // Add subtle parallax effect to floating elements
        const floatingElements = document.querySelectorAll('.floating-code, .floating-brackets, .floating-semicolon, .floating-lambda');
        floatingElements.forEach((element, index) => {
            const speed = (index + 1) * 0.0005;
            const x = (window.innerWidth - e.clientX * speed);
            const y = (window.innerHeight - e.clientY * speed);
            element.style.transform = `translate(${x}px, ${y}px)`;
        });
    }

    handleNavigation(e) {
        e.preventDefault();
        
        const target = e.currentTarget.getAttribute('data-section');
        if (!target) return;
        
        const targetSection = document.getElementById(target);
        if (!targetSection) return;
        
        this.scrollToSection(targetSection);
        
        // Close mobile menu if open
        const navMenu = document.getElementById('navMenu');
        if (navMenu && navMenu.classList.contains('active')) {
            this.toggleNavigation();
        }
    }

    handleKeyboard(e) {
        // Add keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case '1':
                    e.preventDefault();
                    this.scrollToSection(document.getElementById('home'));
                    break;
                case '2':
                    e.preventDefault();
                    this.scrollToSection(document.getElementById('about'));
                    break;
                case '3':
                    e.preventDefault();
                    this.scrollToSection(document.getElementById('projects'));
                    break;
                case '4':
                    e.preventDefault();
                    this.scrollToSection(document.getElementById('skills'));
                    break;
                case '5':
                    e.preventDefault();
                    this.scrollToSection(document.getElementById('contact'));
                    break;
            }
        }
        
        if (e.key === 'Escape') {
            const navMenu = document.getElementById('navMenu');
            if (navMenu && navMenu.classList.contains('active')) {
                this.toggleNavigation();
            }
        }
    }

    toggleNavigation() {
        const navMenu = document.getElementById('navMenu');
        const navToggle = document.getElementById('navToggle');
        
        if (!navMenu || !navToggle) return;
        
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
        
        document.body.classList.toggle('no-scroll', navMenu.classList.contains('active'));
    }

    scrollToSection(section) {
        if (!section) return;
        
        const offsetTop = section.offsetTop - 80;
        
        window.scrollTo({
            top: offsetTop,
            behavior: 'smooth'
        });
    }

    scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    updateScrollProgress() {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrolled = (window.scrollY / scrollHeight) * 100;
        this.scrollProgress = Math.min(Math.max(scrolled, 0), 100);
        
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.style.width = `${this.scrollProgress}%`;
        }
    }

    updateBackToTopButton() {
        const backToTop = document.getElementById('backToTop');
        if (!backToTop) return;
        
        if (window.scrollY > 300) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
    }

    filterProjects(e) {
        const filterBtn = e.currentTarget;
        const filter = filterBtn.getAttribute('data-filter');
        
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        filterBtn.classList.add('active');
        
        // Filter project cards
        const projectCards = document.querySelectorAll('.project-card');
        projectCards.forEach(card => {
            const category = card.getAttribute('data-category');
            
            if (filter === 'all' || category === filter) {
                card.style.display = 'block';
                setTimeout(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, 100);
            } else {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    card.style.display = 'none';
                }, 300);
            }
        });
    }

    // Cleanup method
    destroy() {
        if (this.cleanupNeuralNetwork) {
            this.cleanupNeuralNetwork();
        }
        
        // Remove all event listeners
        window.removeEventListener('load', this.handleWindowLoad);
        window.removeEventListener('scroll', this.handleScroll);
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('mousemove', this.handleMouseMove);
    }
}

// Additional utility functions
class AnimationUtils {
    static easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    
    static easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    }
    
    static lerp(start, end, t) {
        return start + (end - start) * t;
    }
    
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
}

class PerformanceOptimizer {
    constructor() {
        this.rafId = null;
        this.isRafActive = false;
    }
    
    requestAnimationFrame(callback) {
        if (!this.isRafActive) {
            this.isRafActive = true;
            this.rafId = requestAnimationFrame(() => {
                callback();
                this.isRafActive = false;
            });
        }
    }
    
    cancelAnimationFrame() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.isRafActive = false;
        }
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.portfolioApp = new PortfolioApp();
});

// Handle page visibility changes for performance
document.addEventListener('visibilitychange', () => {
    if (window.portfolioApp) {
        if (document.hidden) {
            // Pause animations when page is hidden
            window.portfolioApp.isPageVisible = false;
        } else {
            // Resume animations when page is visible
            window.portfolioApp.isPageVisible = true;
        }
    }
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PortfolioApp, AnimationUtils, PerformanceOptimizer };
}