document.addEventListener("DOMContentLoaded", function() {
    const dots = document.querySelectorAll(".dot");
    
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
    
    if (window.location.pathname.includes('/guides/')) {
        const guideNavLinks = document.querySelectorAll('.guide-nav a');
        const sections = document.querySelectorAll('.guide-section');
        
        document.querySelectorAll('.step, .tab').forEach((element, index) => {
            element.style.setProperty('--index', index);
            element.style.animationDelay = `${0.1 + (index * 0.05)}s`;
            element.style.animationFillMode = 'forwards';
            element.style.opacity = '0';
            element.style.animation = 'fadeInUp 0.8s ease-out forwards';
        });
        
        const highlightNav = () => {
            let currentSectionId = '';
            const headerOffset = document.querySelector('.site-header').offsetHeight + 20;
            const scrollPosition = window.scrollY;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            
            const isNearBottom = scrollPosition + windowHeight >= documentHeight - 50;
            
            if (isNearBottom) {
                currentSectionId = sections[sections.length - 1].getAttribute('id');
            } else {
                sections.forEach(section => {
                    const sectionTop = section.offsetTop - headerOffset;
                    const sectionHeight = section.offsetHeight;
                    
                    if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                        currentSectionId = section.getAttribute('id');
                    }
                });
            }
            
            guideNavLinks.forEach(link => {
                link.classList.remove('active');
                
                if (link.getAttribute('href') === `#${currentSectionId}`) {
                    link.classList.add('active');
                }
            });
        };
        
        guideNavLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                const targetSection = document.querySelector(targetId);
                
                if (targetSection) {
                    const headerHeight = document.querySelector('.site-header').offsetHeight;
                    const scrollPosition = targetSection.offsetTop - headerHeight - 30;
                    
                    window.scrollTo({
                        top: scrollPosition,
                        behavior: 'smooth'
                    });
                    
                    history.pushState(null, null, targetId);
                    
                    guideNavLinks.forEach(navLink => {
                        navLink.classList.remove('active');
                    });
                    link.classList.add('active');
                }
            });
        });
        
        window.addEventListener('scroll', highlightNav);
        
        highlightNav();
    }
    
    const themeToggle = document.getElementById('theme-toggle');
    
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        themeToggle.checked = true;
    } else if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.checked = false;
    } else if (prefersDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.checked = false;
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        themeToggle.checked = true;
    }
    
    themeToggle.addEventListener('change', function() {
        const scrollPosition = window.scrollY;
        
        document.documentElement.classList.add('theme-transition');
        
        setTimeout(() => {
            if (this.checked) {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            }
            
            window.scrollTo(0, scrollPosition);
            
            setTimeout(() => {
                document.documentElement.classList.remove('theme-transition');
            }, 300);
        }, 10);
    });

    function adjustForScreenSize() {
        const width = window.innerWidth;
        let animationDuration = 1.5;
        if (width < 600) {
            animationDuration = 1;
        } else if (width > 1000) {
            animationDuration = 2;
        }

        dots.forEach(dot => {
            dot.style.animationDuration = `${animationDuration}s`;
        });
    }

    async function fetchRepos() {
        const repoList = document.getElementById("repo-list");
        const loadingIndicator = document.getElementById("loading-repos");
        const githubApiUrl = "https://api.github.com/users/Lukas200301/repos?sort=updated&direction=desc";
        
        try {
            loadingIndicator.style.display = "flex";
            const response = await fetch(githubApiUrl);
            
            if (!response.ok) {
                throw new Error(`GitHub API returned ${response.status}`);
            }
            
            const repos = await response.json();
            loadingIndicator.style.display = "none";
            
            repoList.innerHTML = "";
            
            if (repos.length === 0) {
                repoList.innerHTML = "<p>No repositories found.</p>";
                return;
            }

            const repoGuides = {
                "RaspberryPi-Control": "raspberry-pi-control.html"
            };

            repos.forEach((repo, index) => {
                if (repo.name === "Lukas200301") {
                    return;
                }

                const repoItem = document.createElement("div");
                repoItem.classList.add("repo-item");
                repoItem.style.setProperty('--index', index);

                repoItem.addEventListener('mouseenter', () => {
                    const actionButtons = repoItem.querySelectorAll('.repo-btn');
                    actionButtons.forEach((btn, i) => {
                        btn.style.transition = `transform 0.3s ease ${i * 0.1}s`;
                        btn.style.transform = 'translateY(-3px)';
                    });
                });
                
                repoItem.addEventListener('mouseleave', () => {
                    const actionButtons = repoItem.querySelectorAll('.repo-btn');
                    actionButtons.forEach(btn => {
                        btn.style.transform = 'translateY(0)';
                    });
                });

                const description = repo.description 
                    ? repo.description.slice(0, 100) + (repo.description.length > 100 ? "..." : "") 
                    : "No description available.";
                
                const updatedDate = new Date(repo.updated_at);
                const formattedDate = updatedDate.toLocaleDateString("en-US", {
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric'
                });
                
                const languageClass = repo.language ? `language-${repo.language.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}` : '';
                
                const hasGuide = repo.name in repoGuides;
                
                const guideFilename = hasGuide ? repoGuides[repo.name] : "404.html";
                
                repoItem.innerHTML = `
                    <h3>
                        <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer">
                            ${repo.name}
                        </a>
                    </h3>
                    <p class="repo-description">${description}</p>
                    <div class="repo-meta">
                        ${repo.language ? 
                            `<span class="repo-language">
                                <span class="language-dot ${languageClass}"></span>
                                ${repo.language}
                            </span>` : ''
                        }
                        <span class="repo-stars">
                            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16">
                                <path fill-rule="evenodd" d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"></path>
                            </svg>
                            ${repo.stargazers_count}
                        </span>
                        <span class="repo-updated">Updated on ${formattedDate}</span>
                    </div>
                    <div class="repo-actions">
                        <a href="${repo.html_url}" class="repo-btn repo-btn-github" target="_blank" rel="noopener noreferrer">
                            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" class="github-icon">
                                <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                            </svg>
                            GitHub Repo
                        </a>
                        <a href="guides/${guideFilename}" class="repo-btn ${hasGuide ? 'repo-btn-guide' : 'repo-btn-disabled'}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="guide-icon">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                            </svg>
                            ${hasGuide ? 'View Guide' : 'No Guide'}
                        </a>
                    </div>
                `;

                repoList.appendChild(repoItem);
                
                setTimeout(() => {
                    repoItem.style.opacity = "1";
                }, 50 * index);
            });
        } catch (error) {
            console.error("Error fetching repositories:", error);
            loadingIndicator.style.display = "none";
            repoList.innerHTML = `<p class="error-message">Failed to load repositories. ${error.message}</p>`;
        }
    }

    adjustForScreenSize();
    fetchRepos();
    window.addEventListener("resize", adjustForScreenSize);
    
    const anchorLinks = document.querySelectorAll('a[href^="#"]:not(.guide-nav a)');
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            if(this.getAttribute('href').length > 1) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if(target) {
                    window.scrollTo({
                        top: target.offsetTop - 80,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
});