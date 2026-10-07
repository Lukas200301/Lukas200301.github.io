document.addEventListener('DOMContentLoaded', () => {
    // Initialize navigation dots
    initializeNavigation();
    
    // Initialize grid layouts
    initializeGridLayouts();
    
    // Initialize risk assessment
    updateRiskAssessment();
    
    // Update status indicator
    const statusIndicator = document.getElementById('analysisStatus');
    let analysisComplete = false;
    let completedAnalyses = 0;
    const totalAnalyses = 35; // Updated total number of fingerprint elements we're analyzing

    function updateProgress() {
        completedAnalyses++;
        if (completedAnalyses >= totalAnalyses && !analysisComplete) {
            analysisComplete = true;
            statusIndicator.innerHTML = '<i class="fas fa-check-circle"></i><span>Analysis complete!</span>';
            statusIndicator.classList.add('complete');
            calculateUniquenessScore();
        }
    }

    function setElementValue(id, value, type = 'default') {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            element.classList.remove('analyzing');
            
            // Add appropriate classes based on type
            if (type === 'boolean') {
                element.classList.add('boolean', value.toLowerCase().includes('yes') || value.toLowerCase().includes('available') || value.toLowerCase().includes('supported') ? 'true' : 'false');
            } else if (type === 'ip') {
                element.classList.add('ip-address');
            } else if (type === 'location') {
                element.classList.add('location');
            }
            
            updateProgress();
        }
    }

    // Browser Information
    setElementValue('userAgent', navigator.userAgent);
    setElementValue('browser', getBrowserInfo());
    setElementValue('os', getOSInfo());
    setElementValue('language', navigator.language || 'Unknown');

    // Screen Information
    setElementValue('screenResolution', `${window.screen.width}x${window.screen.height}`);
    setElementValue('colorDepth', `${window.screen.colorDepth} bit`);
    setElementValue('pixelRatio', window.devicePixelRatio.toString());
    setElementValue('availableScreen', `${window.screen.availWidth}x${window.screen.availHeight}`);
    setElementValue('colorGamut', getColorGamut());
    setElementValue('screenOrientation', getScreenOrientation());

    // Network Information
    setElementValue('connectionType', getConnectionType());
    
    // Fetch IPv4
    fetch('https://api.ipify.org?format=json')
        .then(response => response.json())
        .then(data => {
            setElementValue('ipv4', data.ip || 'Unknown', 'ip');
        })
        .catch(() => {
            setElementValue('ipv4', 'Unable to detect', 'ip');
        });

    // Fetch IPv6
    fetch('https://api64.ipify.org?format=json')
        .then(response => response.json())
        .then(data => {
            setElementValue('ipv6', data.ip || 'Not available', 'ip');
        })
        .catch(() => {
            setElementValue('ipv6', 'Not available', 'ip');
        });

    // Fetch location info
    fetch('https://ipapi.co/json/')
        .then(response => response.json())
        .then(data => {
            setElementValue('location', `${data.city || 'Unknown'}, ${data.region || 'Unknown'}`, 'location');
            setElementValue('country', `${data.country_name || 'Unknown'} (${data.country_code || 'XX'})`, 'location');
            setElementValue('isp', data.org || 'Unknown');
        })
        .catch(() => {
            setElementValue('location', 'Unable to detect', 'location');
            setElementValue('country', 'Unable to detect', 'location');
            setElementValue('isp', 'Unable to detect');
        });

    // Privacy Information
    setElementValue('cookiesEnabled', navigator.cookieEnabled ? 'Yes' : 'No', 'boolean');
    setElementValue('doNotTrack', navigator.doNotTrack || 'Not set');
    setElementValue('sessionStorage', isSessionStorageAvailable() ? 'Available' : 'Not available', 'boolean');
    setElementValue('indexedDB', isIndexedDBAvailable() ? 'Available' : 'Not available', 'boolean');
    setElementValue('timezone', getTimezone());
    setElementValue('platform', navigator.platform || 'Unknown');
    
    // WebRTC IP Leak Detection
    checkWebRTCIPLeak().then(result => {
        setElementValue('webrtcIPLeak', result, 'boolean');
    }).catch(() => {
        setElementValue('webrtcIPLeak', 'Unable to detect', 'boolean');
    });
    
    // Enhanced Local Storage Information
    if (isLocalStorageAvailable()) {
        try {
            // Test localStorage capacity
            const testKey = '__localStorage_test__';
            let data = '';
            let i = 0;
            
            // Estimate localStorage size
            while (i < 1000) { // Limit iterations to prevent hanging
                try {
                    data += '0123456789';
                    localStorage.setItem(testKey, data);
                    i++;
                } catch (e) {
                    break;
                }
            }
            localStorage.removeItem(testKey);
            
            const estimatedSize = Math.round(data.length / 1024);
            setElementValue('localStorage', `Available (~${estimatedSize}KB capacity tested)`, 'boolean');
        } catch (e) {
            setElementValue('localStorage', 'Available (capacity unknown)', 'boolean');
        }
    } else {
        setElementValue('localStorage', 'Not available', 'boolean');
    }

    // Hardware Information
    setElementValue('cpuCores', navigator.hardwareConcurrency ? navigator.hardwareConcurrency.toString() : 'Unknown');
    setElementValue('deviceMemory', navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'Unknown');
    setElementValue('hardwareConcurrency', navigator.hardwareConcurrency ? navigator.hardwareConcurrency.toString() : 'Unknown');
    
    if ('getBattery' in navigator) {
        navigator.getBattery().then(battery => {
            const level = Math.round(battery.level * 100);
            const charging = battery.charging ? 'Charging' : 'Not charging';
            setElementValue('batteryStatus', `${level}% (${charging})`);
        }).catch(() => {
            setElementValue('batteryStatus', 'Not available');
        });
    } else {
        setElementValue('batteryStatus', 'Not available');
    }

    // Graphics Information
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            setElementValue('webglVendor', gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'Unknown');
            setElementValue('webglRenderer', gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown');
        } else {
            setElementValue('webglVendor', 'Information masked');
            setElementValue('webglRenderer', 'Information masked');
        }
        setElementValue('webglVersion', gl.getParameter(gl.VERSION) || 'Unknown');
        setElementValue('webglExtensions', getWebGLExtensions(gl));
    } else {
        setElementValue('webglVendor', 'WebGL not supported');
        setElementValue('webglRenderer', 'WebGL not supported');
        setElementValue('webglVersion', 'WebGL not supported');
        setElementValue('webglExtensions', 'WebGL not supported');
    }

    // Canvas Fingerprint
    const canvasFingerprint = getCanvasFingerprint();
    setElementValue('canvasFingerprint', canvasFingerprint);

    // Audio Fingerprint
    getAudioFingerprint().then(fingerprint => {
        setElementValue('audioFingerprint', fingerprint);
    }).catch(() => {
        setElementValue('audioFingerprint', 'Unable to generate');
    });

    // Browser Capabilities
    setElementValue('webrtc', 'RTCPeerConnection' in window ? 'Available' : 'Not available', 'boolean');
    setElementValue('webp', checkWebPSupport() ? 'Supported' : 'Not supported', 'boolean');
    setElementValue('webm', checkWebMSupport() ? 'Supported' : 'Not supported', 'boolean');
    setElementValue('audioFormats', getSupportedAudioFormats());
    setElementValue('gamepadAPI', 'getGamepads' in navigator ? 'Available' : 'Not available', 'boolean');
    setElementValue('touchSupport', getTouchSupport(), 'boolean');
    setElementValue('speechRecognition', getSpeechRecognitionSupport(), 'boolean');
    setElementValue('geolocationAPI', 'geolocation' in navigator ? 'Available' : 'Not available', 'boolean');
    setElementValue('mediaDevices', getMediaDevicesSupport(), 'boolean');

    function calculateUniquenessScore() {
        // Simple uniqueness calculation based on available data
        let uniquenessFactors = 0;
        const maxFactors = 20;

        // Check various uniqueness factors
        if (navigator.userAgent && navigator.userAgent.length > 50) uniquenessFactors++;
        if (window.screen.width && window.screen.height) uniquenessFactors++;
        if (window.screen.colorDepth && window.screen.colorDepth > 16) uniquenessFactors++;
        if (window.devicePixelRatio && window.devicePixelRatio !== 1) uniquenessFactors++;
        if (navigator.language) uniquenessFactors++;
        if (navigator.hardwareConcurrency && navigator.hardwareConcurrency > 2) uniquenessFactors++;
        if (navigator.deviceMemory && navigator.deviceMemory > 2) uniquenessFactors++;
        if (navigator.cookieEnabled !== undefined) uniquenessFactors++;
        if (navigator.doNotTrack) uniquenessFactors++;
        if (isLocalStorageAvailable()) uniquenessFactors++;
        if (gl) uniquenessFactors += 2; // WebGL adds more uniqueness
        if (canvasFingerprint && canvasFingerprint.length > 10) uniquenessFactors += 2;
        if ('RTCPeerConnection' in window) uniquenessFactors++;
        if (checkWebPSupport()) uniquenessFactors++;
        if (checkWebMSupport()) uniquenessFactors++;
        if (navigator.connection) uniquenessFactors++;
        
        // Add timezone uniqueness
        try {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (timezone) uniquenessFactors++;
        } catch (e) {
            // Ignore errors
        }

        const uniquenessPercentage = Math.min(Math.round((uniquenessFactors / maxFactors) * 100), 99);
        
        const scoreElement = document.querySelector('.score-value');
        if (scoreElement) {
            scoreElement.textContent = `${uniquenessPercentage}%`;
        }

        // Update risk indicators based on findings
        updateRiskIndicators();
    }

    function updateRiskIndicators() {
        const indicators = document.querySelectorAll('.risk-indicator');
        indicators.forEach(indicator => {
            const text = indicator.querySelector('span').textContent;
            
            // Add visual feedback based on what was detected
            if (text.includes('Canvas') && canvasFingerprint && canvasFingerprint.length > 10) {
                indicator.style.opacity = '1';
                indicator.style.transform = 'scale(1.02)';
            } else if (text.includes('WebGL') && gl) {
                indicator.style.opacity = '1';
                indicator.style.transform = 'scale(1.02)';
            } else if (text.includes('Audio')) {
                indicator.style.opacity = '1';
                indicator.style.transform = 'scale(1.02)';
            } else if (text.includes('Screen')) {
                indicator.style.opacity = '1';
                indicator.style.transform = 'scale(1.02)';
            }
        });
    }
});

// Utility Functions
function getBrowserInfo() {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Firefox')) {
        return 'Firefox';
    } else if (userAgent.includes('Chrome')) {
        return 'Chrome';
    } else if (userAgent.includes('Safari')) {
        return 'Safari';
    } else if (userAgent.includes('Edge')) {
        return 'Edge';
    } else if (userAgent.includes('Opera')) {
        return 'Opera';
    } else {
        return 'Unknown';
    }
}

function getOSInfo() {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) {
        return 'Windows';
    } else if (userAgent.includes('Mac')) {
        return 'macOS';
    } else if (userAgent.includes('Linux')) {
        return 'Linux';
    } else if (userAgent.includes('Android')) {
        return 'Android';
    } else if (userAgent.includes('iOS')) {
        return 'iOS';
    } else {
        return 'Unknown';
    }
}

function getConnectionType() {
    if (navigator.connection) {
        return navigator.connection.effectiveType || 'Unknown';
    }
    return 'Not available';
}

function isLocalStorageAvailable() {
    try {
        const test = '__localStorage_test__';
        localStorage.setItem(test, 'test');
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

function getCanvasFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Create a unique canvas fingerprint
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Browser fingerprint test 🌐', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Privacy analysis', 4, 45);
        
        // Get the canvas data and create a hash-like identifier
        const imageData = canvas.toDataURL();
        let hash = 0;
        for (let i = 0; i < imageData.length; i++) {
            const char = imageData.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return Math.abs(hash).toString(16).substring(0, 8);
    } catch (e) {
        return 'Unable to generate';
    }
}

async function getAudioFingerprint() {
    try {
        if (!window.AudioContext && !window.webkitAudioContext) {
            return 'Audio API not available';
        }
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const analyser = audioContext.createAnalyser();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(10000, audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime); // Silent
        
        oscillator.connect(analyser);
        analyser.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(frequencyData);
        
        oscillator.stop();
        audioContext.close();
        
        // Create a simple hash from the frequency data
        let hash = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            hash = ((hash << 5) - hash) + frequencyData[i];
            hash = hash & hash;
        }
        
        return Math.abs(hash).toString(16).substring(0, 8);
    } catch (e) {
        return 'Unable to generate';
    }
}

function checkWebPSupport() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

function checkWebMSupport() {
    const video = document.createElement('video');
    return video.canPlayType('video/webm') !== '';
}

// Navigation functionality
function initializeNavigation() {
    const navDots = document.querySelectorAll('.nav-dot');
    const sections = document.querySelectorAll('.fingerprint-section, .tool-hero');
    
    // Add click handlers to navigation dots
    navDots.forEach(dot => {
        dot.addEventListener('click', () => {
            const targetSection = document.getElementById(dot.dataset.section);
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Update active dot on scroll
    const updateActiveSection = () => {
        const scrollPosition = window.scrollY + window.innerHeight / 2;
        
        sections.forEach((section, index) => {
            const sectionTop = section.offsetTop;
            const sectionBottom = sectionTop + section.offsetHeight;
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
                // Remove active class from all dots
                navDots.forEach(dot => dot.classList.remove('active'));
                
                // Add active class to current dot
                const currentDot = document.querySelector(`[data-section="${section.id}"]`);
                if (currentDot) {
                    currentDot.classList.add('active');
                }
            }
        });
    };
    
    // Listen for scroll events
    window.addEventListener('scroll', updateActiveSection);
    
    // Initialize on load
    updateActiveSection();
}

function getColorGamut() {
    if (window.matchMedia) {
        if (window.matchMedia('(color-gamut: rec2020)').matches) {
            return 'rec2020';
        } else if (window.matchMedia('(color-gamut: p3)').matches) {
            return 'p3';
        } else if (window.matchMedia('(color-gamut: srgb)').matches) {
            return 'srgb';
        }
    }
    return 'Unknown';
}

function getScreenOrientation() {
    if (screen.orientation) {
        return `${screen.orientation.type} (${screen.orientation.angle}°)`;
    } else if (screen.mozOrientation) {
        return screen.mozOrientation;
    } else if (screen.msOrientation) {
        return screen.msOrientation;
    }
    return 'Unknown';
}

function isSessionStorageAvailable() {
    try {
        const test = '__sessionStorage_test__';
        sessionStorage.setItem(test, 'test');
        sessionStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

function isIndexedDBAvailable() {
    return 'indexedDB' in window;
}

function getTimezone() {
    try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const offset = new Date().getTimezoneOffset();
        const offsetHours = Math.abs(Math.floor(offset / 60));
        const offsetMinutes = Math.abs(offset % 60);
        const offsetSign = offset <= 0 ? '+' : '-';
        return `${timezone} (UTC${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')})`;
    } catch (e) {
        return 'Unknown';
    }
}

function getWebGLExtensions(gl) {
    try {
        const extensions = gl.getSupportedExtensions();
        if (extensions && extensions.length > 0) {
            return `${extensions.length} extensions`;
        }
        return 'None detected';
    } catch (e) {
        return 'Unable to detect';
    }
}

function getSupportedAudioFormats() {
    const audio = document.createElement('audio');
    const formats = [];
    
    if (audio.canPlayType('audio/mpeg')) formats.push('MP3');
    if (audio.canPlayType('audio/wav')) formats.push('WAV');
    if (audio.canPlayType('audio/ogg')) formats.push('OGG');
    if (audio.canPlayType('audio/aac')) formats.push('AAC');
    if (audio.canPlayType('audio/webm')) formats.push('WebM');
    if (audio.canPlayType('audio/flac')) formats.push('FLAC');
    
    return formats.length > 0 ? formats.join(', ') : 'None detected';
}

function getTouchSupport() {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0) {
        const maxPoints = navigator.maxTouchPoints || navigator.msMaxTouchPoints || 'Unknown';
        return `Available (${maxPoints} points)`;
    }
    return 'Not available';
}

function getSpeechRecognitionSupport() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        return 'Available';
    }
    return 'Not available';
}

function getMediaDevicesSupport() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        return 'Available';
    }
    return 'Not available';
}

async function checkWebRTCIPLeak() {
    return new Promise((resolve) => {
        if (!window.RTCPeerConnection) {
            resolve('WebRTC not supported');
            return;
        }

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        const noop = () => {};
        let localIPs = new Set();
        let timeout;

        pc.createDataChannel('');
        
        pc.onicecandidate = (ice) => {
            if (!ice || !ice.candidate || !ice.candidate.candidate) return;
            
            const candidate = ice.candidate.candidate;
            const match = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
            
            if (match) {
                const ip = match[1];
                if (!ip.startsWith('0.') && !ip.startsWith('255.')) {
                    localIPs.add(ip);
                }
            }
        };

        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .catch(noop);

        timeout = setTimeout(() => {
            pc.close();
            if (localIPs.size > 0) {
                resolve(`Potential leak: ${localIPs.size} local IP(s) exposed`);
            } else {
                resolve('No local IPs detected');
            }
        }, 2000);
    });
}

// Grid Layout Management
function initializeGridLayouts() {
    // Apply grid layouts to all masonry containers
    const masonryContainers = document.querySelectorAll('.fingerprint-masonry');
    
    masonryContainers.forEach(container => {
        const cards = container.querySelectorAll('.fingerprint-card');
        const cardCount = cards.length;
        
        // Remove any existing grid classes
        container.classList.remove('grid-2-cols', 'grid-3-cols', 'center-last-row');
        
        if (cardCount === 3) {
            container.style.gridTemplateColumns = 'repeat(3, 1fr)';
        } else if (cardCount === 4) {
            container.style.gridTemplateColumns = 'repeat(2, 1fr)';
        } else if (cardCount === 5) {
            container.style.gridTemplateColumns = 'repeat(4, 1fr)';
            container.style.gridTemplateRows = 'auto auto';
            container.classList.add('center-last-row');
            
            // First row: 3 cards
            cards[0].style.gridColumn = '1 / 2';
            cards[0].style.gridRow = '1';
            cards[1].style.gridColumn = '2 / 3';
            cards[1].style.gridRow = '1';
            cards[2].style.gridColumn = '3 / 4';
            cards[2].style.gridRow = '1';
            
            // Second row: 2 cards centered
            cards[3].style.gridColumn = '2 / 3';
            cards[3].style.gridRow = '2';
            cards[3].style.justifySelf = 'center';
            
            cards[4].style.gridColumn = '3 / 4';
            cards[4].style.gridRow = '2';
            cards[4].style.justifySelf = 'center';
        } else if (cardCount === 6) {
            container.style.gridTemplateColumns = 'repeat(3, 1fr)';
        } else if (cardCount >= 7) {
            container.style.gridTemplateColumns = 'repeat(3, 1fr)';
        } else {
            container.style.gridTemplateColumns = 'repeat(3, 1fr)';
        }
    });
    
    // Handle responsive design
    function updateResponsiveGrids() {
        const isMobile = window.innerWidth <= 768;
        const isTablet = window.innerWidth <= 1200 && window.innerWidth > 768;
        
        masonryContainers.forEach(container => {
            const cards = container.querySelectorAll('.fingerprint-card');
            
            if (isMobile) {
                container.style.gridTemplateColumns = '1fr';
                // Reset any centering styles on mobile
                cards.forEach(card => {
                    card.style.gridColumn = 'auto';
                    card.style.gridRow = 'auto';
                    card.style.justifySelf = 'stretch';
                    card.style.transform = 'none';
                    card.style.marginLeft = '0';
                    card.style.marginRight = '0';
                });
                
                // Reset container grid
                container.style.gridTemplateRows = 'auto';
            } else if (isTablet) {
                container.style.gridTemplateColumns = 'repeat(2, 1fr)';
                // Reset any centering styles on tablet
                cards.forEach(card => {
                    card.style.gridColumn = 'auto';
                    card.style.gridRow = 'auto';
                    card.style.justifySelf = 'stretch';
                    card.style.transform = 'none';
                    card.style.marginLeft = '0';
                    card.style.marginRight = '0';
                });
                
                // Reset container grid
                container.style.gridTemplateRows = 'auto';
            } else {
                // Reapply desktop grid layout
                initializeGridLayouts();
            }
        });
    }
    
    // Update grids on window resize
    window.addEventListener('resize', updateResponsiveGrids);
}

function updateRiskAssessment() {
    const riskIndicators = document.querySelectorAll('.risk-indicator');
    
    // Collect fingerprint data for risk assessment
    const fingerprintData = {
        canvasSupported: !!document.createElement('canvas').getContext,
        webglSupported: !!document.createElement('canvas').getContext('webgl'),
        audioContextSupported: !!(window.AudioContext || window.webkitAudioContext),
        webrtcSupported: !!window.RTCPeerConnection,
        cookiesEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack === '1',
        javaEnabled: navigator.javaEnabled ? navigator.javaEnabled() : false,
        pluginsCount: navigator.plugins ? navigator.plugins.length : 0,
        fontsDetectable: true, // Assume fonts can be detected
        timezoneDetectable: !!Intl.DateTimeFormat().resolvedOptions().timeZone,
        screenFingerprint: window.screen.width && window.screen.height,
        hardwareInfo: navigator.hardwareConcurrency || navigator.deviceMemory,
        localStorageAvailable: isLocalStorageAvailable(),
        geolocationAPI: 'geolocation' in navigator
    };
    
    // Risk assessment logic - sorted by severity (High -> Medium -> Low)
    const risks = [];
    
    // HIGH RISK (Critical tracking vectors)
    if (fingerprintData.canvasSupported) {
        risks.push({ level: 'high', name: 'Canvas Fingerprinting', icon: 'fas fa-exclamation-circle', severity: 1 });
    }
    
    if (fingerprintData.webglSupported) {
        risks.push({ level: 'high', name: 'WebGL Fingerprinting', icon: 'fas fa-exclamation-circle', severity: 2 });
    }
    
    if (fingerprintData.webrtcSupported) {
        risks.push({ level: 'high', name: 'WebRTC IP Exposure', icon: 'fas fa-exclamation-circle', severity: 3 });
    }
    
    // MEDIUM RISK (Moderate tracking vectors)
    if (fingerprintData.audioContextSupported) {
        risks.push({ level: 'medium', name: 'Audio Context Fingerprinting', icon: 'fas fa-warning', severity: 4 });
    }
    
    if (fingerprintData.hardwareInfo) {
        risks.push({ level: 'medium', name: 'Hardware Information Leak', icon: 'fas fa-warning', severity: 5 });
    }
    
    if (fingerprintData.screenFingerprint) {
        risks.push({ level: 'medium', name: 'Screen Resolution Tracking', icon: 'fas fa-warning', severity: 6 });
    }
    
    if (fingerprintData.pluginsCount > 0) {
        risks.push({ level: 'medium', name: 'Browser Plugins Detectable', icon: 'fas fa-warning', severity: 7 });
    }
    
    if (fingerprintData.geolocationAPI) {
        risks.push({ level: 'medium', name: 'Geolocation API Available', icon: 'fas fa-warning', severity: 8 });
    }
    
    // LOW RISK (Minor tracking vectors)
    if (fingerprintData.timezoneDetectable) {
        risks.push({ level: 'low', name: 'Timezone Detection', icon: 'fas fa-info-circle', severity: 9 });
    }
    
    if (fingerprintData.localStorageAvailable) {
        risks.push({ level: 'low', name: 'Local Storage Tracking', icon: 'fas fa-info-circle', severity: 10 });
    }
    
    if (!fingerprintData.doNotTrack) {
        risks.push({ level: 'low', name: 'Do Not Track Disabled', icon: 'fas fa-info-circle', severity: 11 });
    }
    
    if (fingerprintData.fontsDetectable) {
        risks.push({ level: 'low', name: 'Font Enumeration Possible', icon: 'fas fa-info-circle', severity: 12 });
    }
    
    // Sort risks by severity (already ordered by importance)
    risks.sort((a, b) => a.severity - b.severity);
    
    // Update the risk indicators
    const riskContainer = document.querySelector('.risk-indicators');
    if (riskContainer) {
        riskContainer.innerHTML = '';
        
        risks.forEach(risk => {
            const riskElement = document.createElement('div');
            riskElement.className = 'risk-indicator';
            riskElement.setAttribute('data-risk', risk.level);
            riskElement.innerHTML = `
                <i class="${risk.icon}"></i>
                <span>${risk.name}</span>
            `;
            riskContainer.appendChild(riskElement);
        });
    }
    
    // Update overall risk level
    const highRisks = risks.filter(r => r.level === 'high').length;
    const mediumRisks = risks.filter(r => r.level === 'medium').length;
    const lowRisks = risks.filter(r => r.level === 'low').length;
    
    let overallRisk = 'Low';
    let riskColor = '#00f2c3';
    
    if (highRisks >= 2) {
        overallRisk = 'High';
        riskColor = '#ff6b6b';
    } else if (highRisks >= 1 || mediumRisks >= 3) {
        overallRisk = 'Medium';
        riskColor = '#ffc107';
    }
    
    // Update assessment header if needed
    const assessmentHeader = document.querySelector('.assessment-header h3');
    if (assessmentHeader) {
        assessmentHeader.innerHTML = `Tracking Risks - Overall: <span style="color: ${riskColor}">${overallRisk}</span>`;
    }
}
