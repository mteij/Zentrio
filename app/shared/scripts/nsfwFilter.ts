export const getNsfwFilterScript = () => `
<script>
  // NSFW Content Filter
  (function() {
    // Check if current profile has NSFW filtering enabled
    const currentProfile = session?.profile?.auth?.user;
    if (!currentProfile) return;

    // This will be set by the session data if NSFW mode is enabled for the profile
    const nsfwModeEnabled = session?.nsfwModeEnabled || false;
    const tmdbApiKey = session?.tmdbApiKey;
    const ageRating = session?.ageRating || 0;

    if (ageRating === 0 || !tmdbApiKey) return;

    // NSFW Filter Service (embedded)
    class NSFWFilter {
      constructor() {
        this.cache = new Map();
        this.rateLimitDelay = 100; // TMDB allows 40 requests per 10 seconds
        this.lastApiCall = 0;
        this.apiKey = tmdbApiKey;
      }

      extractTitleInfo(text) {
        let cleanTitle = text
          .replace(/^(HD|4K|3D|CAM|TS|TC|DVDRip|BRRip|WEB-DL|WEBRip)\\\\s*/i, '')
          .replace(/\\\\s*(HD|4K|3D|CAM|TS|TC|DVDRip|BRRip|WEB-DL|WEBRip)$/i, '')
          .replace(/\\\\s*\\\\([^)]*\\\\)$/, '')
          .trim();

        const yearMatch = text.match(/\\\\((\\\\d{4})\\\\)|\\\\b(\\\\d{4})\\\\b/);
        const year = yearMatch ? (yearMatch[1] || yearMatch[2]) : undefined;

        if (year) {
          cleanTitle = cleanTitle.replace(new RegExp(\`\\\\b\${year}\\\\b|\\\\(\${year}\\\\)\`), '').trim();
        }

        return { title: cleanTitle, year };
      }

      async rateLimit() {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastApiCall;
        if (timeSinceLastCall < this.rateLimitDelay) {
          await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastCall));
        }
        this.lastApiCall = Date.now();
      }

      async searchTitle(title, year) {
        const cacheKey = \`\${title}\${year ? \`-\${year}\` : ''}\`;
        if (this.cache.has(cacheKey)) {
          const cached = this.cache.get(cacheKey);
          return cached ? { id: cached.id, type: cached.type } : null;
        }

        try {
          await this.rateLimit();
          
          const searchUrl = \`https://api.themoviedb.org/3/search/multi?api_key=\${this.apiKey}&query=\${encodeURIComponent(title)}\${year ? \`&year=\${year}\` : ''}\`;
          const response = await fetch(searchUrl);
          
          if (!response.ok) {
            return null;
          }

          const data = await response.json();
          
          if (data.results && data.results.length > 0) {
            let bestMatch = data.results[0];
            
            if (year) {
              const yearMatch = data.results.find(result => {
                const releaseYear = result.release_date?.substring(0, 4) || result.first_air_date?.substring(0, 4);
                return releaseYear === year;
              });
              if (yearMatch) bestMatch = yearMatch;
            }

            const mediaType = bestMatch.media_type || (bestMatch.title ? 'movie' : 'tv');
            const result = { id: bestMatch.id, type: mediaType };
            this.cache.set(cacheKey, result);
            return result;
          }

          this.cache.set(cacheKey, false);
          return null;
        } catch (error) {
          return null;
        }
      }

      async getDetails(id, type) {
        try {
          await this.rateLimit();
          
          let endpoint = type;
          let detailUrl = \`https://api.themoviedb.org/3/\${endpoint}/\${id}?api_key=\${this.apiKey}&append_to_response=release_dates\`;
          let response = await fetch(detailUrl);
          
          if (response.status === 404) {
            endpoint = type === 'movie' ? 'tv' : 'movie';
            detailUrl = \`https://api.themoviedb.org/3/\${endpoint}/\${id}?api_key=\${this.apiKey}&append_to_response=release_dates\`;
            await this.rateLimit();
            response = await fetch(detailUrl);
          }
          
          if (!response.ok) {
            return null;
          }

          const data = await response.json();
          return data;
        } catch (error) {
          return null;
        }
      }

      isNSFWContent(details) {
        if (details.adult) {
          return true;
        }

        if (details.release_dates) {
            const usRelease = details.release_dates.results.find(r => r.iso_3166_1 === 'US');
            if (usRelease) {
                const rating = usRelease.release_dates[0].certification;
                if (rating) {
                    const ratingAge = parseInt(rating.replace('R', '17').replace('NC-', ''));
                    if (!isNaN(ratingAge) && ratingAge > ageRating) {
                        return true;
                    }
                }
            }
        }

        if (details.genres && details.genres.length > 0) {
          const nsfwGenreNames = [
            'adult', 'erotica', 'erotic', 'pornographic', 'sex', 'adult entertainment'
          ];
          
          const hasNSFWGenre = details.genres.some(genre => 
            nsfwGenreNames.some(nsfwGenre => 
              genre.name.toLowerCase().includes(nsfwGenre.toLowerCase())
            )
          );
          
          if (hasNSFWGenre) {
            return true;
          }
        }

        if (details.overview) {
          const nsfwKeywords = [
            'adult film', 'pornographic', 'explicit', 'erotic', 'sexual content',
            'nude', 'naked', 'strip club', 'prostitute', 'brothel', 'escort',
            'adult entertainment', 'xxx', 'sex industry', 'adult performer'
          ];
          
          const overviewLower = details.overview.toLowerCase();
          if (nsfwKeywords.some(keyword => overviewLower.includes(keyword.toLowerCase()))) {
            return true;
          }
        }

        if (details.vote_average > 0 && details.vote_average < 3.0) {
          const title = details.title || details.name || '';
          const titleLower = title.toLowerCase();
          
          const suspiciousKeywords = [
            'adult', 'erotic', 'sexy', 'nude', 'naked', 'hot', 'sensual'
          ];
          
          if (suspiciousKeywords.some(keyword => titleLower.includes(keyword))) {
            return true;
          }
        }

        return false;
      }

      async isNSFW(titleText) {
        const cacheKey = \`nsfw-\${titleText}\`;
        if (this.cache.has(cacheKey)) {
          return this.cache.get(cacheKey) || false;
        }

        try {
          const { title, year } = this.extractTitleInfo(titleText);
          
          const searchResult = await this.searchTitle(title, year);
          if (!searchResult) {
            this.cache.set(cacheKey, false);
            return false;
          }

          const details = await this.getDetails(searchResult.id, searchResult.type);
          if (!details) {
            this.cache.set(cacheKey, false);
            return false;
          }

          const isNSFW = this.isNSFWContent(details);
          this.cache.set(cacheKey, isNSFW);
          return isNSFW;
        } catch (error) {
          this.cache.set(cacheKey, false);
          return false;
        }
      }

      async isNSFWById(id, type) {
        const cacheKey = \`nsfw-\${type}-\${id}\`;
        if (this.cache.has(cacheKey)) {
          return this.cache.get(cacheKey) || false;
        }

        try {
          const details = await this.getDetails(id, type);
          if (!details) {
            this.cache.set(cacheKey, false);
            return false;
          }

          const isNSFW = this.isNSFWContent(details);
          this.cache.set(cacheKey, isNSFW);
          return isNSFW;
        } catch (error) {
          this.cache.set(cacheKey, false);
          return false;
        }
      }
    }

    const filter = new NSFWFilter();
    const processedElements = new WeakSet();

    function extractTmdbInfo(element) {
        const href = element.getAttribute('href');
        if (href) {
            const match = href.match(/\\/detail\\/(movie|series)\\/tmdb%3A(\\d+)/);
            if (match) {
                return { type: match[1] === 'series' ? 'tv' : 'movie', id: match[2] };
            }
        }

        const idAttr = element.getAttribute('id');
        if (idAttr) {
            const match = idAttr.match(/tmdb:(\\d+)/);
            if (match) {
                return { id: match[1], type: null };
            }
        }
        
        return null;
    }

    function extractTitle(element) {
      const titleSelectors = [
        '.title-label-VnEAc',
        '.title',
        '[class*="title"]',
        '.name',
        '[class*="name"]',
        'h1', 'h2', 'h3', 'h4',
        '.item-title',
        '[class*="item-title"]'
      ];

      for (const selector of titleSelectors) {
        const titleEl = element.querySelector(selector) || (element.matches(selector) ? element : null);
        if (titleEl && titleEl.textContent?.trim()) {
          return titleEl.textContent.trim();
        }
      }

      return element.textContent?.trim() || '';
    }

    function censorElement(element) {
        if (processedElements.has(element)) return;
        processedElements.add(element);

        // Make the item unclickable
        element.style.pointerEvents = 'none';

        const posterContainer = element.querySelector('.poster-image-layer-KimPZ');
        if (!posterContainer) return;

        const overlay = document.createElement('div');
        overlay.style.cssText = \`
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 24px;
            font-weight: bold;
            text-align: center;
            border-radius: 8px;
        \`;
        overlay.textContent = \`\${ageRating}+\`;
        
        posterContainer.appendChild(overlay);
    }

    async function processContentItem(element) {
      if (processedElements.has(element) || !element.parentNode) return;

      const tmdbInfo = extractTmdbInfo(element);
      let isNSFW = false;

      if (tmdbInfo && tmdbInfo.id && tmdbInfo.type) {
        isNSFW = await filter.isNSFWById(tmdbInfo.id, tmdbInfo.type);
        if (isNSFW) {
            censorElement(element);
            return;
        }
      }

      const title = extractTitle(element);
      if (!title || title.length < 2) return;

      try {
        isNSFW = await filter.isNSFW(title);
        if (isNSFW) {
          censorElement(element);
        }
      } catch (error) {
        // Do nothing
      }
    }

    function scanForContent() {
      const contentSelectors = [
        '[class*="board-item"]',
        '[class*="item-"]',
        '[class*="poster"]',
        '[class*="movie"]',
        '[class*="series"]',
        '[class*="video"]',
        '[class*="stream"]',
        '.item',
        '[class*="content-item"]'
      ];

      const items = new Set();
      
      contentSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          if (!processedElements.has(el) && el.textContent?.trim()) {
            items.add(el);
          }
        });
      });

      let delay = 0;
      items.forEach(item => {
        setTimeout(() => processContentItem(item), delay);
        delay += 100;
      });
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    const debouncedScanForContent = debounce(scanForContent, 500);

    // Initial scan
    setTimeout(scanForContent, 2000);

    // Set up observer for dynamic content
    const observer = new MutationObserver(() => {
        debouncedScanForContent();
    });

    // Start observing
    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }

    // Periodic scan for missed content
    setInterval(scanForContent, 5000);
  })();
</script>
`;