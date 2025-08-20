// YouTube Tag Generator App
// This file contains the main functionality for the YouTube Tag Generator tool

class YouTubeTagGenerator {
    constructor() {
        this.categoryKeywords = {
            gaming: ['gameplay', 'walkthrough', 'review', 'tutorial', 'let\'s play', 'gaming', 'video game', 'pc gaming', 'console', 'strategy', 'action', 'rpg', 'adventure'],
            education: ['tutorial', 'how to', 'learn', 'education', 'study', 'lesson', 'course', 'guide', 'tips', 'knowledge', 'academic', 'university', 'school'],
            entertainment: ['funny', 'comedy', 'entertainment', 'viral', 'trending', 'popular', 'fun', 'amazing', 'cool', 'awesome', 'epic', 'hilarious'],
            music: ['music', 'song', 'remix'],
            technology: ['tech', 'technology', 'gadget', 'review', 'unboxing', 'smartphone', 'computer', 'software', 'app', 'programming', 'coding', 'tutorial'],
            cooking: ['cooking', 'recipe', 'food', 'kitchen', 'chef', 'baking', 'meal', 'dish', 'ingredients', 'delicious', 'tasty', 'homemade'],
            fitness: ['fitness', 'workout', 'exercise', 'health', 'gym', 'training', 'bodybuilding', 'cardio', 'strength', 'wellness', 'diet', 'nutrition'],
            travel: ['travel', 'vacation', 'trip', 'adventure', 'explore', 'destination', 'tourism', 'journey', 'world', 'culture', 'backpacking'],
            diy: ['diy', 'craft', 'handmade', 'creative', 'project', 'art', 'design', 'make', 'build', 'tutorial', 'step by step'],
            business: ['business', 'entrepreneur', 'startup', 'marketing', 'money', 'finance', 'investment', 'success', 'tips', 'strategy'],
            lifestyle: ['lifestyle', 'vlog', 'daily', 'routine', 'life', 'personal', 'motivation', 'inspiration', 'wellness', 'self-care'],
            comedy: ['comedy', 'funny', 'humor', 'joke', 'laugh', 'hilarious', 'entertaining', 'sketch', 'parody', 'meme'],
            science: ['science', 'experiment', 'research', 'discovery', 'facts', 'knowledge', 'physics', 'chemistry', 'biology', 'space'],
            news: ['news', 'current events', 'politics', 'world', 'breaking', 'update', 'analysis', 'discussion', 'opinion'],
            sports: ['sports', 'game', 'match', 'team', 'player', 'competition', 'championship', 'training', 'fitness', 'athletics']
        };

        this.commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'];
        
        this.popularKeywords = {
            2025: ['2025', 'latest', 'new', 'updated', 'trending'],
            quality: ['best', 'top', 'ultimate', 'premium', 'professional', 'advanced'],
            engagement: ['how to', 'tutorial', 'guide', 'tips', 'tricks', 'secrets', 'hacks'],
            emotions: ['amazing', 'incredible', 'awesome', 'epic', 'mind-blowing', 'satisfying'],
            time: ['quick', 'easy', 'simple', 'fast', 'instant', 'step by step']
        };


        // Cache for MusicBrainz API results
        this.musicBrainzCache = this.loadMusicBrainzCache();
        
        // Load local artists database
        this.artistsDatabase = null;
        this.loadArtistsDatabase();
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateCharacterCounts();
        this.loadSavedData();
        }

    // Load local artists database from JSON file
    async loadArtistsDatabase() {
        // No longer loading local database - using only MusicBrainz API
        this.artistsDatabase = null;
    }

    // Load MusicBrainz cache from localStorage
    loadMusicBrainzCache() {
        try {
            const cached = localStorage.getItem('musicbrainz-cache');
            return cached ? JSON.parse(cached) : {};
        } catch (error) {
            return {};
        }
    }

    // Save MusicBrainz cache to localStorage
    saveMusicBrainzCache() {
        try {
            localStorage.setItem('musicbrainz-cache', JSON.stringify(this.musicBrainzCache));
        } catch (error) {
        }
    }

    bindEvents() {
        // Input event listeners
        document.getElementById('videoTitle')?.addEventListener('input', () => {
            this.updateCharacterCounts();
            this.autoSave();
        });
        
        document.getElementById('videoDescription')?.addEventListener('input', () => {
            this.updateCharacterCounts();
            this.autoSave();
        });
        
        document.getElementById('targetKeywords')?.addEventListener('input', () => {
            this.autoSave();
        });
        
        // Generate button
        document.getElementById('generateTags')?.addEventListener('click', () => this.generateTags());
        
        // Action buttons
        document.getElementById('copyTags')?.addEventListener('click', () => this.copyTags());
        document.getElementById('clearTags')?.addEventListener('click', () => this.clearTags());
        
        // Category change
        document.getElementById('videoCategory')?.addEventListener('change', () => this.autoSave());
    }

    updateCharacterCounts() {
        const title = document.getElementById('videoTitle');
        const description = document.getElementById('videoDescription');
        
        if (!title || !description) return;
        
        const titleCount = title.value.length;
        const descCount = description.value.length;
        
        const titleCounter = title.nextElementSibling;
        const descCounter = description.nextElementSibling;
        
        if (titleCounter) {
            titleCounter.textContent = `${titleCount} characters`;
            titleCounter.style.color = 'var(--tertiary-text)';
        }
        
        if (descCounter) {
            descCounter.textContent = `${descCount}/500 characters`;
            descCounter.style.color = descCount > 400 ? 'var(--warning-color, #f59e0b)' : 'var(--tertiary-text)';
        }
    }

    async generateTags() {
        const title = document.getElementById('videoTitle')?.value.trim() || '';
        const description = document.getElementById('videoDescription')?.value.trim() || '';
        const keywords = document.getElementById('targetKeywords')?.value.trim() || '';
        const category = document.getElementById('videoCategory')?.value || '';
        
        if (!title) {
            this.showWarning('Please enter a video title to generate tags.');
            return;
        }
        
        const options = {
            includeVariations: document.getElementById('includeVariations')?.checked || false,
            includeLongTail: document.getElementById('includeLongTail')?.checked || false,
            includeRelated: document.getElementById('includeRelated')?.checked || false
        };
        
        // Show loading state
        const generateBtn = document.getElementById('generateTags');
        const originalText = generateBtn.innerHTML;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        generateBtn.disabled = true;
        
        const loadingNotification = this.showLoading('Generating tags... This may take a moment.');
        
        try {
            const tags = await this.createTags(title, description, keywords, category, options);
            this.displayTags(tags);
            
            // Remove loading notification
            if (loadingNotification.parentElement) {
                loadingNotification.remove();
            }
            
            this.showSuccess(`Successfully generated ${tags.length} tags!`);
        } catch (error) {
            console.error('Error generating tags:', error);
            
            // Remove loading notification
            if (loadingNotification.parentElement) {
                loadingNotification.remove();
            }
            
            this.showError('Failed to generate tags. Please try again.');
        } finally {
            // Restore button state
            generateBtn.innerHTML = originalText;
            generateBtn.disabled = false;
        }
    }

    async createTags(title, description, keywords, category, options) {
        let tags = new Set();
        let priorityTags = new Set(); // High priority tags that should always be included
        
        // Extract and process title words
        const titleWords = this.extractWords(title);
        titleWords.forEach(word => {
            if (this.isValidTag(word)) {
                tags.add(word.toLowerCase());
            }
        });
        
        // Add title as a tag
        if (options.includeVariations) {
            tags.add(title.toLowerCase());
            
            // Add shortened version for long titles
            if (title.length > 30) {
                const shortTitle = title.split(' ').slice(0, 4).join(' ');
                if (shortTitle.length > 5) {
                    tags.add(shortTitle.toLowerCase());
                }
            }
        }

        // Add artist-related tags for music content and collect priority tags
        if (category === 'music') {
            const { regularTags, artistTags } = await this.addArtistRelatedTagsWithPriority(title, tags, category);
            artistTags.forEach(tag => priorityTags.add(tag));
        } else {
            await this.addArtistRelatedTags(title, tags, category);
        }
        
        // Process description
        if (description) {
            const descWords = this.extractWords(description);
            descWords.forEach(word => {
                if (this.isValidTag(word, 3)) {
                    tags.add(word.toLowerCase());
                }
            });
        }
        
        // Add manual keywords
        if (keywords) {
            const keywordList = keywords.split(',')
                .map(k => k.trim().toLowerCase())
                .filter(k => k && k.length > 1);
            keywordList.forEach(keyword => tags.add(keyword));
        }
        
        // Add category-specific keywords
        if (category && this.categoryKeywords[category]) {
            this.categoryKeywords[category].forEach(tag => tags.add(tag));
        }
        
        // Add long-tail keywords
        if (options.includeLongTail) {
            this.generateLongTailKeywords(title, category).forEach(tag => tags.add(tag));
        }
        
        // Add related terms
        if (options.includeRelated) {
            this.generateRelatedTerms(title, category).forEach(tag => tags.add(tag));
        }
        
        // Clean and optimize tags with priority for artist tags
        return this.optimizeTags(Array.from(tags), Array.from(priorityTags));
    }

    // Enhanced method that separates artist tags for priority handling
    async addArtistRelatedTagsWithPriority(title, tags, category) {
        const artistTags = new Set();
        const regularTags = new Set();
        
        if (category === 'music') {
            this.showInfo('Analyzing music content with enhanced processing...', 2000);
            const musicTags = await this.generateMusicTags(title);
            
            // Parse the title to identify which tags are artist-related
            const parsedTitle = this.parseTitle(title);
            const artistNames = parsedTitle.artists.map(artist => artist.toLowerCase());
            
            // Get all artist-related tags from the database/API
            const allArtistRelatedTags = new Set();
            
            // Add the artist names themselves
            artistNames.forEach(artist => allArtistRelatedTags.add(artist));
            
            // Add song name if present
            if (parsedTitle.song) {
                allArtistRelatedTags.add(parsedTitle.song.toLowerCase());
            }
            
            // Get all artist-related content (songs, genres, etc.)
            for (const artist of parsedTitle.artists) {
                const artistContent = await this.getTopSongsAndGenres(artist);
                artistContent.forEach(content => allArtistRelatedTags.add(content.toLowerCase()));
            }
            
            musicTags.forEach(tag => {
                // Check if this tag is artist-related
                const isArtistTag = allArtistRelatedTags.has(tag.toLowerCase()) ||
                    artistNames.some(artist => 
                        tag.toLowerCase() === artist || 
                        tag.toLowerCase().includes(artist) || 
                        artist.includes(tag.toLowerCase()) ||
                        // Check if tag contains song name
                        (parsedTitle.song && (tag.toLowerCase().includes(parsedTitle.song.toLowerCase()) || parsedTitle.song.toLowerCase().includes(tag.toLowerCase())))
                    );
                
                if (isArtistTag) {
                    artistTags.add(tag);
                } else {
                    regularTags.add(tag);
                }
                
                // Always add to main tags as well
                tags.add(tag);
            });
            
        }
        
        return { regularTags, artistTags };
    }

    isValidTag(word, minLength = 2) {
        return word && 
               word.length >= minLength && 
               word.length <= 50 && 
               !this.commonWords.includes(word.toLowerCase()) &&
               /^[a-zA-Z0-9\s\-_']+$/.test(word);
    }

    extractWords(text) {
        // Extract words while preserving meaningful phrases
        const words = [];
        
        // Single words
        const singleWords = text.match(/\b\w+\b/g) || [];
        words.push(...singleWords);
        
        // Two-word phrases
        const phrases = text.match(/\b\w+\s+\w+\b/g) || [];
        words.push(...phrases);
        
        return words;
    }

    // Enhanced music tag generation for music category
    async addArtistRelatedTags(title, tags, category) {
        if (category === 'music') {
            const musicTags = await this.generateMusicTags(title);
            musicTags.forEach(tag => tags.add(tag));
        } else {
            // Fallback to old method for non-music categories
            const musicIndicators = ['-', 'ft.', 'feat.', 'featuring', 'vs', 'vs.', 'x', '&'];
            const titleLower = title.toLowerCase();
            
            if (musicIndicators.some(indicator => titleLower.includes(indicator))) {
                const artistSeparators = /[-,&x]|\bft\.?\b|\bfeat\.?\b|\bfeaturing\b|\bvs\.?\b/gi;
                const potentialArtists = title.split(artistSeparators)
                    .map(name => name.trim())
                    .filter(name => name.length > 1);

                if (potentialArtists.length > 1) {
                    tags.add('collaboration');
                    tags.add('collab');
                    tags.add('featuring');
                }
            }
        }
    }

    // Main function for comprehensive music tag generation
    async generateMusicTags(title) {
        try {
            
            const parsedTitle = this.parseTitle(title);
            
            if (!parsedTitle.artists.length && !parsedTitle.song) {
                return this.generateBasicMusicTags(title);
            }

            const baseTags = this.generateBaseTags(parsedTitle);
            
            const artistTags = await this.getTagsForAllArtists(parsedTitle.artists);
            
            const variationTags = this.generateTagVariations(baseTags, parsedTitle);

            const allTags = [...new Set([...baseTags, ...artistTags, ...variationTags])];
            
            // Store artist info for priority handling
            allTags.parsedTitle = parsedTitle;
            
            return allTags;
        } catch (error) {
            return this.generateBasicMusicTags(title);
        }
    }

    // Parse YouTube title to extract artists and song
    parseTitle(title) {
        const result = { artists: [], song: '', originalTitle: title };
        
        // Common separators for "Artist - Song" format
        const mainSeparators = [' - ', ' – ', ' — ', ' | '];
        let titleParts = null;
        let usedSeparator = null;

        // Find the main separator
        for (const separator of mainSeparators) {
            if (title.includes(separator)) {
                titleParts = title.split(separator);
                usedSeparator = separator;
                break;
            }
        }

        if (!titleParts || titleParts.length < 2) {
            // No main separator found, try to extract artists anyway
            const featPatterns = /\b(?:feat\.?|featuring|ft\.?|with)\s+([^()]+)/gi;
            const featMatch = featPatterns.exec(title);
            if (featMatch) {
                result.artists = this.parseArtists(featMatch[1]);
                result.song = title.replace(featPatterns, '').trim();
            }
            return result;
        }

        // Extract artists from the first part
        const artistPart = titleParts[0].trim();
        result.artists = this.parseArtists(artistPart);

        // Extract song from the second part
        let songPart = titleParts.slice(1).join(usedSeparator).trim();
        
        // Check for featured artists in the song part
        const featInSong = /(.+?)\s+(?:feat\.?|featuring|ft\.?|with)\s+([^()]+)/i;
        const featMatch = featInSong.exec(songPart);
        
        if (featMatch) {
            result.song = featMatch[1].trim();
            const featuredArtists = this.parseArtists(featMatch[2]);
            result.artists = [...result.artists, ...featuredArtists];
        } else {
            result.song = songPart;
        }

        return result;
    }

    // Parse multiple artists from a string
    parseArtists(artistString) {
        if (!artistString) return [];
        
        // Common artist separators
        const separators = /[,&]|\sand\s|\bfeat\.?\b|\bfeaturing\b|\bft\.?\b|\bwith\b|\bvs\.?\b|\bx\b/gi;
        
        return artistString
            .split(separators)
            .map(artist => artist.trim())
            .filter(artist => artist && artist.length > 1)
            .map(artist => artist.replace(/^(the|a|an)\s+/i, '').trim()) // Remove articles
            .filter(artist => artist.length > 1);
    }

    // Generate base tags from parsed title
    generateBaseTags(parsedTitle) {
        const tags = [];
        
        // Add song name (high priority)
        if (parsedTitle.song) {
            tags.push(parsedTitle.song.toLowerCase());
        }
        
        // Add each artist name (high priority)
        parsedTitle.artists.forEach(artist => {
            tags.push(artist.toLowerCase());
        });
        
        // Add original title (medium priority)
        tags.push(parsedTitle.originalTitle.toLowerCase());
        
        // Mark the first few tags as priority (song + artists)
        const priorityCount = (parsedTitle.song ? 1 : 0) + parsedTitle.artists.length;
        tags.priorityCount = priorityCount;
        
        return tags;
    }

    // Get tags for all artists (from local DB or MusicBrainz)
    async getTagsForAllArtists(artists) {
        const allTags = [];
        
        for (const artist of artists) {
            const artistTags = await this.getTopSongsAndGenres(artist);
            allTags.push(...artistTags);
        }
        
        return [...new Set(allTags)];
    }

    // Get top songs and genres for an artist (hybrid approach)
    async getTopSongsAndGenres(artist) {
        const tags = [];
        
        // Try local database first
        const localTags = this.getTopSongsLocal(artist);
        if (localTags.length > 0) {
            tags.push(...localTags);
        }
        
        // Try MusicBrainz as fallback
        try {
            const musicBrainzTags = await this.getTopSongsMusicBrainz(artist);
            tags.push(...musicBrainzTags);
        } catch (error) {
        }
        
        return [...new Set(tags)];
    }

    // Get data from local artists.json
    getTopSongsLocal(artist) {
        const tags = [];
        
        if (!this.artistsDatabase) return tags;
        
        // Try exact match first
        let artistData = this.artistsDatabase[artist];
        
        // Try case-insensitive match
        if (!artistData) {
            const artistKey = Object.keys(this.artistsDatabase).find(
                key => key.toLowerCase() === artist.toLowerCase()
            );
            artistData = artistKey ? this.artistsDatabase[artistKey] : null;
        }
        
        if (artistData) {
            // Add top songs
            if (artistData.songs) {
                tags.push(...artistData.songs.map(song => song.toLowerCase()));
            }
            
            // Add genres
            if (artistData.genres) {
                tags.push(...artistData.genres.map(genre => genre.toLowerCase()));
            }
        }
        
        return tags;
    }

    // Get data from MusicBrainz API
    async getTopSongsMusicBrainz(artist) {
        const cacheKey = `mb_${artist.toLowerCase()}`;
        
        // Check cache first
        if (this.musicBrainzCache[cacheKey]) {
            const cached = this.musicBrainzCache[cacheKey];
            if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) { // 24 hours
                return cached.tags;
            }
        }
        
        try {
            const tags = [];
            
            // Search for artist
            const artistSearch = await this.fetchMusicBrainz(
                `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(artist)}&fmt=json&limit=1`
            );
            
            if (artistSearch.artists && artistSearch.artists.length > 0) {
                const foundArtist = artistSearch.artists[0];
                
                // Add genre tags
                if (foundArtist.tags) {
                    foundArtist.tags.forEach(tag => {
                        tags.push(tag.name.toLowerCase());
                    });
                }
                
                // Get artist's releases
                const releases = await this.fetchMusicBrainz(
                    `https://musicbrainz.org/ws/2/release?artist=${foundArtist.id}&fmt=json&limit=10&status=official`
                );
                
                if (releases.releases) {
                    releases.releases
                        .filter(release => release.date) // Only releases with dates
                        .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by newest first
                        .slice(0, 10) // Take top 10
                        .forEach(release => {
                            tags.push(release.title.toLowerCase());
                        });
                }
            }
            
            // Cache the results
            this.musicBrainzCache[cacheKey] = {
                tags: tags,
                timestamp: Date.now()
            };
            this.saveMusicBrainzCache();
            
            return tags;
        } catch (error) {
            return [];
        }
    }

    // Fetch data from MusicBrainz with rate limiting
    async fetchMusicBrainz(url) {
        // Rate limiting: wait 1 second between requests
        if (this.lastMusicBrainzRequest) {
            const timeSinceLastRequest = Date.now() - this.lastMusicBrainzRequest;
            if (timeSinceLastRequest < 1000) {
                await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
            }
        }
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'YouTubeTagGenerator'
            }
        });
        
        this.lastMusicBrainzRequest = Date.now();
        
        if (!response.ok) {
            throw new Error(`MusicBrainz API error: ${response.status}`);
        }
        
        return response.json();
    }

    // Generate tag variations
    generateTagVariations(baseTags, parsedTitle) {
        const variations = [];
        const { artists, song } = parsedTitle;
        
        // Artist-song combinations
        if (song && artists.length > 0) {
            artists.forEach(artist => {
                variations.push(`${artist.toLowerCase()} ${song.toLowerCase()}`);
                variations.push(`${song.toLowerCase()} by ${artist.toLowerCase()}`);
                variations.push(`${artist.toLowerCase()} hits`);
                variations.push(`${song.toLowerCase()} remix`);
            });
        }
        
        // Collaboration tags
        if (artists.length > 1) {
            variations.push('collaboration', 'collab', 'featuring', 'feat');
        }
        
        return variations;
    }

    // Fallback for basic music tags
    generateBasicMusicTags(title) {
        const tags = [title.toLowerCase()];
        const musicTerms = ['music', 'song', 'audio', 'lyrics', 'live', 'official', 'video'];
        
        musicTerms.forEach(term => {
            tags.push(`${title.toLowerCase()} ${term}`);
        });
        
        return tags;
    }

    generateLongTailKeywords(title, category) {
        const longTail = [];
        const words = this.extractWords(title).filter(word => this.isValidTag(word));
        
        if (words.length > 0) {
            const primaryWord = words[0].toLowerCase();
            
            // How-to variations
            longTail.push(`how to ${primaryWord}`);
            longTail.push(`${primaryWord} tutorial`);
            longTail.push(`${primaryWord} guide`);
            longTail.push(`learn ${primaryWord}`);
            longTail.push(`${primaryWord} tips`);
            
            // Best practices
            longTail.push(`best ${primaryWord}`);
            longTail.push(`top ${primaryWord}`);
            longTail.push(`${primaryWord} review`);
        }
        
        // Category-specific long-tail
        if (category) {
            longTail.push(`${category} tips`);
            longTail.push(`best ${category}`);
            longTail.push(`${category} for beginners`);
            longTail.push(`${category} tutorial`);
            longTail.push(`how to ${category}`);
        }
        
        return longTail;
    }

    generateRelatedTerms(title, category) {
        const related = [];
        
        // Add popular engagement terms
        related.push(...this.popularKeywords.engagement);
        related.push(...this.popularKeywords.quality);
        related.push(...this.popularKeywords['2025']);
        
        // Add category-specific related terms
        if (category) {
            const categoryRelated = {
                gaming: ['gameplay', 'review', 'walkthrough', 'guide'],
                technology: ['review', 'unboxing', 'comparison', 'specs'],
                cooking: ['recipe', 'ingredients', 'step by step', 'delicious'],
                fitness: ['workout', 'exercise', 'training', 'health'],
                education: ['learn', 'tutorial', 'course', 'study']
            };
            
            if (categoryRelated[category]) {
                related.push(...categoryRelated[category]);
            }
        }
        
        return related;
    }

    optimizeTags(tags, priorityTags = []) {
        // Remove duplicates and empty tags
        const uniqueTags = [...new Set(tags)]
            .filter(tag => tag && tag.trim().length > 1)
            .map(tag => tag.trim().toLowerCase());
        
        const uniquePriorityTags = [...new Set(priorityTags)]
            .filter(tag => tag && tag.trim().length > 1)
            .map(tag => tag.trim().toLowerCase());
        
        // Sort regular tags by relevance (shorter, more common terms first)
        const regularTags = uniqueTags.filter(tag => !uniquePriorityTags.includes(tag));
        const sortedRegularTags = regularTags.sort((a, b) => {
            // Prioritize shorter tags
            if (a.length !== b.length) {
                return a.length - b.length;
            }
            // Then alphabetically
            return a.localeCompare(b);
        });
        
        // ALWAYS include ALL priority tags (artist tags) regardless of 500 character limit
        const finalTags = [...uniquePriorityTags];
        let totalLength = finalTags.join(', ').length;
        
        
        // Add regular tags until we reach 500 characters (only for non-priority tags)
        for (const tag of sortedRegularTags) {
            // Calculate length including comma and space separator
            const additionalLength = finalTags.length > 0 ? tag.length + 2 : tag.length;
            
            // Only check 500 char limit for non-priority tags
            if (totalLength + additionalLength <= 500) {
                finalTags.push(tag);
                totalLength += additionalLength;
            } else {
                // If we exceed 500 chars with regular tags, stop adding them
                break;
            }
        }
        
        
        return finalTags;
    }

    displayTags(tags) {
        const tagsTextarea = document.getElementById('generatedTags');
        const tagPreview = document.getElementById('tagPreview');
        const tagCount = document.getElementById('tagCount');
        const strengthFill = document.getElementById('tagStrengthFill');
        const strengthText = document.getElementById('tagStrengthText');
        
        if (!tagsTextarea) return;
        
        // Update textarea
        tagsTextarea.value = tags.join(', ');
        
        // Update tag count
        if (tagCount) {
            const totalChars = tagsTextarea.value.length;
            tagCount.textContent = `${tags.length} tags (${totalChars} characters)`;
            tagCount.style.color = totalChars > 450 ? 'var(--warning-color, #f59e0b)' : 'var(--accent-text)';
        }
        
        // Update strength indicator
        if (strengthFill && strengthText) {
            const strength = Math.min(100, (tags.length / 20) * 100);
            strengthFill.style.width = `${strength}%`;
            
            let strengthLabel = 'Poor';
            let color = '#ef4444';
            
            if (strength > 80) {
                strengthLabel = 'Excellent';
                color = '#22c55e';
            } else if (strength > 60) {
                strengthLabel = 'Good';
                color = '#3b82f6';
            } else if (strength > 40) {
                strengthLabel = 'Fair';
                color = '#f59e0b';
            }
            
            strengthFill.style.background = color;
            strengthText.textContent = `${strengthLabel} (${tags.length} tags)`;
        }
        
        // Update tag preview
        if (tagPreview) {
            if (tags.length > 0) {
                tagPreview.innerHTML = tags.map((tag, index) => 
                    `<div class="tag-item" data-index="${index}">
                        ${this.escapeHtml(tag)}
                        <button class="tag-remove" onclick="window.youtubeGenerator?.removeTag(${index})" title="Remove tag" type="button">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>`
                ).join('');
            } else {
                tagPreview.innerHTML = '<p class="no-tags">Generate tags to see preview</p>';
            }
        }
    }

    removeTag(index) {
        const tagsTextarea = document.getElementById('generatedTags');
        if (!tagsTextarea) return;
        
        const tags = tagsTextarea.value.split(', ').filter(tag => tag.trim());
        tags.splice(index, 1);
        this.displayTags(tags);
        this.showInfo('Tag removed');
    }

    copyTags() {
        const tagsTextarea = document.getElementById('generatedTags');
        if (!tagsTextarea || !tagsTextarea.value.trim()) {
            this.showWarning('No tags to copy. Please generate tags first.');
            return;
        }
        
        navigator.clipboard.writeText(tagsTextarea.value).then(() => {
            this.showSuccess('Tags copied to clipboard!');
            
            // Visual feedback
            const copyBtn = document.getElementById('copyTags');
            if (copyBtn) {
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                copyBtn.style.background = 'var(--success-color, #22c55e)';
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalHTML;
                    copyBtn.style.background = '';
                }, 2000);
            }
        }).catch(() => {
            this.showError('Failed to copy tags to clipboard.');
        });
    }

    clearTags() {
        const tagsTextarea = document.getElementById('generatedTags');
        const tagPreview = document.getElementById('tagPreview');
        const tagCount = document.getElementById('tagCount');
        const strengthFill = document.getElementById('tagStrengthFill');
        const strengthText = document.getElementById('tagStrengthText');
        
        if (tagsTextarea) tagsTextarea.value = '';
        if (tagPreview) tagPreview.innerHTML = '<p class="no-tags">Generate tags to see preview</p>';
        if (tagCount) tagCount.textContent = '0 tags';
        if (strengthFill) strengthFill.style.width = '0%';
        if (strengthText) strengthText.textContent = 'No tags generated';
        
        this.showInfo('Tags cleared');
    }

    autoSave() {
        // Save form data to localStorage
        const data = {
            title: document.getElementById('videoTitle')?.value || '',
            description: document.getElementById('videoDescription')?.value || '',
            keywords: document.getElementById('targetKeywords')?.value || '',
            category: document.getElementById('videoCategory')?.value || ''
        };
        
        localStorage.setItem('youtube-tag-generator-data', JSON.stringify(data));
    }

    loadSavedData() {
        try {
            const saved = localStorage.getItem('youtube-tag-generator-data');
            if (saved) {
                const data = JSON.parse(saved);
                
                if (document.getElementById('videoTitle')) document.getElementById('videoTitle').value = data.title || '';
                if (document.getElementById('videoDescription')) document.getElementById('videoDescription').value = data.description || '';
                if (document.getElementById('targetKeywords')) document.getElementById('targetKeywords').value = data.keywords || '';
                if (document.getElementById('videoCategory')) document.getElementById('videoCategory').value = data.category || '';
                
                this.updateCharacterCounts();
                
                // Only show notification if there's actual data
                if (data.title || data.description || data.keywords) {
                    setTimeout(() => {
                        this.showInfo('Previous form data restored from your last session.', 3000);
                    }, 1000);
                }
            }
        } catch (error) {
            console.warn('Failed to load saved data:', error);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Comprehensive notification system
    showNotification(message, type = 'info', duration = 5000) {
        // Create notification container if it doesn't exist
        let notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            notificationContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 400px;
                pointer-events: none;
            `;
            document.body.appendChild(notificationContainer);
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            padding: 16px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            font-size: 14px;
            line-height: 1.4;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transform: translateX(100%);
            transition: all 0.3s ease;
            pointer-events: auto;
            cursor: pointer;
            position: relative;
            overflow: hidden;
            word-wrap: break-word;
            display: flex;
            align-items: center;
            gap: 12px;
        `;

        // Set colors and icons based on type
        const typeConfig = {
            success: { 
                bg: '#22c55e', 
                icon: 'fas fa-check-circle',
                duration: 4000 
            },
            error: { 
                bg: '#ef4444', 
                icon: 'fas fa-exclamation-circle',
                duration: 6000 
            },
            warning: { 
                bg: '#f59e0b', 
                icon: 'fas fa-exclamation-triangle',
                duration: 5000 
            },
            info: { 
                bg: '#3b82f6', 
                icon: 'fas fa-info-circle',
                duration: 4000 
            },
            loading: { 
                bg: '#6366f1', 
                icon: 'fas fa-spinner fa-spin',
                duration: 0 // Don't auto-hide loading notifications
            }
        };

        const config = typeConfig[type] || typeConfig.info;
        notification.style.background = config.bg;
        
        // Use custom duration or type-specific duration
        const notificationDuration = duration > 0 ? duration : config.duration;

        // Add icon and message
        notification.innerHTML = `
            <i class="${config.icon}" style="flex-shrink: 0;"></i>
            <span style="flex: 1;">${this.escapeHtml(message)}</span>
            ${type !== 'loading' ? '<i class="fas fa-times" style="flex-shrink: 0; opacity: 0.7; cursor: pointer;" onclick="this.parentElement.remove()"></i>' : ''}
        `;

        // Add progress bar for timed notifications
        if (notificationDuration > 0) {
            const progressBar = document.createElement('div');
            progressBar.style.cssText = `
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: rgba(255, 255, 255, 0.3);
                width: 100%;
                transform-origin: left;
                animation: notificationProgress ${notificationDuration}ms linear;
            `;
            notification.appendChild(progressBar);
        }

        // Add to container
        notificationContainer.appendChild(notification);

        // Animate in
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });

        // Auto-remove for non-loading notifications
        if (notificationDuration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.style.transform = 'translateX(100%)';
                    setTimeout(() => {
                        if (notification.parentElement) {
                            notification.remove();
                        }
                    }, 300);
                }
            }, notificationDuration);
        }

        // Click to dismiss
        notification.addEventListener('click', (e) => {
            if (e.target.classList.contains('fa-times')) {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }
        });

        // Return notification element for manual control
        return notification;
    }

    // Helper methods for common notification types
    showSuccess(message, duration = 4000) {
        return this.showNotification(message, 'success', duration);
    }

    showError(message, duration = 6000) {
        return this.showNotification(message, 'error', duration);
    }

    showWarning(message, duration = 5000) {
        return this.showNotification(message, 'warning', duration);
    }

    showInfo(message, duration = 4000) {
        return this.showNotification(message, 'info', duration);
    }

    showLoading(message) {
        return this.showNotification(message, 'loading', 0);
    }

    // Remove all notifications
    clearNotifications() {
        const container = document.getElementById('notification-container');
        if (container) {
            container.remove();
        }
    }
}

// Auto-initialize when DOM is ready
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.youtubeGenerator = new YouTubeTagGenerator();
    });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = YouTubeTagGenerator;
}
