'use strict';

// Zentrio NSFW Filter patch for vendored Stremio Web.
//
// This patch injects the NSFW filter functionality directly into the main entrypoint
// instead of injecting it at runtime via DOM manipulation.

module.exports.applyPatch = async function applyPatch(ctx) {
  const { vendorRoot, fs, path, console } = ctx;

  console.log('[StremioPatcher] 040-nsfw-filter.js: starting');

  const targetFile = path.join(vendorRoot, 'src', 'index.js');
  if (!fs.existsSync(targetFile)) {
    console.warn('[StremioPatcher] 040-nsfw-filter.js: target not found, skipping');
    return;
  }

  let source = fs.readFileSync(targetFile, 'utf8');

  // Inject Zentrio NSFW Filter code after the downloads manager
  const nsfwFilterCode = `
// Zentrio NSFW Filter - patched in at build-time
(function() {
  // Resolve session safely from globals to avoid ReferenceError
  var __s = (typeof window !== 'undefined' ? (window['session'] || window['zentrioSession'] || null) : null);
  var currentProfile = __s && __s.profile && __s.profile.auth && __s.profile.auth.user;
  if (!currentProfile) return;

  // Settings from the resolved session
  var nsfwModeEnabled = (__s && __s.nsfwFilterEnabled) ? __s.nsfwFilterEnabled : false;
  var tmdbApiKey = __s && __s.tmdbApiKey;
  var ageRating = (__s && __s.ageRating) ? __s.ageRating : 0;

  if (ageRating === 0 || !tmdbApiKey || !nsfwModeEnabled) return;

  // NSFW Filter Service (embedded)
  class NSFWFilter {
    constructor() {
      this.cache = new Map();
      this.rateLimitDelay = 100; // TMDB allows 40 requests per 10 seconds
      this.lastApiCall = 0;
      this.tmdbApiKey = tmdbApiKey;
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
        cleanTitle = cleanTitle.replace(new RegExp('\\\\b' + year + '\\\\b|\\\\(' + year + '\\\\)'), '').trim();
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
      const cacheKey = title + (year ? '-' + year : '');
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        return cached ? { id: cached.id, type: cached.type } : null;
      }

      try {
        await this.rateLimit();

        const searchUrl = 'https://api.themoviedb.org/3/search/multi?api_key=' + this.tmdbApiKey + '&query=' + encodeURIComponent(title) + (year ? '&year=' + year : '');
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
        let detailUrl = 'https://api.themoviedb.org/3/' + endpoint + '/' + id + '?api_key=' + this.tmdbApiKey + '&append_to_response=release_dates';
        let response = await fetch(detailUrl);

        if (response.status === 404) {
          endpoint = type === 'movie' ? 'tv' : 'movie';
          detailUrl = 'https://api.themoviedb.org/3/' + endpoint + '/' + id + '?api_key=' + this.tmdbApiKey + '&append_to_response=release_dates';
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
      if (details && details.adult) {
        return true;
      }

      if (details.release_dates) {
          const usRelease = details.release_dates.results.find(r => r.iso_3166_1 === 'US');
          if (usRelease && usRelease.release_dates && usRelease.release_dates.length > 0) {
              const certification = usRelease.release_dates[0].certification;
              if (certification) {
                  let ratingValue = 0;
                  // Handle specific ratings like R, NC-17
                  if (certification.toUpperCase() === 'R') {
                      ratingValue = 17;
                  } else if (certification.toUpperCase() === 'NC-17') {
                      ratingValue = 18;
                  } else {
                      // Try to parse a number from ratings like "PG-13"
                      const ageMatch = certification.match(/\\d+/);
                      if (ageMatch) {
                          ratingValue = parseInt(ageMatch[0], 10);
                      }
                  }

                  // If we found a valid rating, check if it exceeds the user's limit
                  if (ratingValue > 0 && ratingValue > ageRating) {
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
      const cacheKey = 'nsfw-' + titleText;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey) || false;
      }

      try {
         const { title, year } = this.extractTitleInfo(titleText);

         const tmdbSearchResult = await this.searchTitle(title, year);

         let tmdbDetails = null;
         if (tmdbSearchResult) {
             tmdbDetails = await this.getDetails(tmdbSearchResult.id, tmdbSearchResult.type);
         }

         if (!tmdbDetails) {
             this.cache.set(cacheKey, false);
             return false;
         }

        const isNSFW = this.isNSFWContent(tmdbDetails);
        this.cache.set(cacheKey, isNSFW);
        return isNSFW;
      } catch (error) {
        this.cache.set(cacheKey, false);
        return false;
      }
    }

    async isNSFWById(id, type) {
      const cacheKey = 'nsfw-' + type + '-' + id;
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

    async convertImdbToTmdb(imdbId) {
      const cacheKey = 'imdb-' + imdbId;
      if (this.cache.has(cacheKey)) {
          const cached = this.cache.get(cacheKey);
          return cached ? { id: cached.id, type: cached.type } : null;
      }

      try {
          await this.rateLimit();
          const findUrl = 'https://api.themoviedb.org/3/find/' + imdbId + '?api_key=' + this.tmdbApiKey + '&external_source=imdb_id';
          const response = await fetch(findUrl);
          if (!response.ok) {
              this.cache.set(cacheKey, false);
              return null;
          }

          const data = await response.json();
          const results = [...(data.movie_results || []), ...(data.tv_results || [])];

          if (results.length > 0) {
              const bestMatch = results[0];
              const mediaType = bestMatch.media_type || (bestMatch.title ? 'movie' : 'tv');
              const result = { id: bestMatch.id, type: mediaType };
              this.cache.set(cacheKey, result);
              return result;
          }

          this.cache.set(cacheKey, false);
          return null;
      } catch (error) {
          this.cache.set(cacheKey, false);
          return null;
      }
    }
  }

  const filter = new NSFWFilter();
  const processedElements = new WeakSet();

  function extractIdInfo(element) {
      const href = element.getAttribute('href');
      if (href) {
          const tmdbMatch = href.match(/\\/detail\\/(movie|series)\\/tmdb%3A(\\d+)/);
          if (tmdbMatch) {
              return { source: 'tmdb', type: tmdbMatch[1] === 'series' ? 'tv' : 'movie', id: tmdbMatch[2] };
          }
          const imdbMatch = href.match(/\\/detail\\/(movie|series)\\/(tt\\d+)/);
          if (imdbMatch) {
              return { source: 'imdb', type: imdbMatch[1] === 'series' ? 'tv' : 'movie', id: imdbMatch[2] };
          }
      }

      const idAttr = element.getAttribute('id');
      if (idAttr) {
          const tmdbMatch = idAttr.match(/tmdb:(\\d+)/);
          if (tmdbMatch) {
              return { source: 'tmdb', id: tmdbMatch[1], type: null };
          }
          const imdbMatch = idAttr.match(/(tt\\d+)/);
          if (imdbMatch) {
              return { source: 'imdb', id: imdbMatch[1], type: null };
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

  function censorElement(element, reason) {
      if (processedElements.has(element)) return;
      processedElements.add(element);
      console.log('Censoring element:', element, 'Reason:', reason);

      // Make the item unclickable
      element.style.pointerEvents = 'none';

      const posterContainer = element.querySelector('.poster-image-layer-KimPZ');
      if (!posterContainer) return;

      const overlay = document.createElement('div');
      overlay.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.8); color: white; display: flex; justify-content: center; align-items: center; font-size: 24px; font-weight: bold; text-align: center; border-radius: 8px;';
      overlay.textContent = ageRating + '+';

      posterContainer.appendChild(overlay);
  }

  async function processContentItem(element) {
      if (processedElements.has(element) || !element.parentNode) return;

      const idInfo = extractIdInfo(element);
      let isNSFW = false;

      if (idInfo && idInfo.id) {
          let tmdbInfo = null;
          if (idInfo.source === 'tmdb' && idInfo.type) {
              tmdbInfo = { id: idInfo.id, type: idInfo.type };
          } else if (idInfo.source === 'imdb') {
              tmdbInfo = await filter.convertImdbToTmdb(idInfo.id);
          }

          if (tmdbInfo && tmdbInfo.id && tmdbInfo.type) {
              isNSFW = await filter.isNSFWById(tmdbInfo.id, tmdbInfo.type);
              if (isNSFW) {
                  const reason = idInfo.source === 'imdb' ? 'IMDB ID: ' + idInfo.id + ' -> TMDB ID: ' + tmdbInfo.id : 'TMDB ID: ' + tmdbInfo.id;
                  censorElement(element, reason);
                  return;
              }
          }
      }

      const title = extractTitle(element);
      if (!title || title.length < 2) return;

      try {
          isNSFW = await filter.isNSFW(title);
          if (isNSFW) {
              censorElement(element, 'Title: ' + title);
          }
      } catch (error) {
          // Do nothing
      }
  }

  function scanForContent() {
    // Target elements that are likely to be content items.
    // These are typically links to detail pages.
    const potentialItems = document.querySelectorAll('a[href*="/detail/"]');

    potentialItems.forEach(item => {
      // We process each item individually.
      // The processContentItem function is asynchronous, so we don't need to manage delays here.
      // The rate limiting is handled inside the NSFWFilter class.
      processContentItem(item);
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

`;

  // Insert the NSFW filter code after the downloads manager code
  const downloadsManagerEndIndex = source.indexOf('})();', source.indexOf('Downloads Manager - patched in at build-time'));
  if (downloadsManagerEndIndex !== -1) {
    source = source.slice(0, downloadsManagerEndIndex + 4) + nsfwFilterCode + source.slice(downloadsManagerEndIndex + 4);
  } else {
    // Fallback: insert before the first require statement
    const requireIndex = source.indexOf('const Bowser = require');
    if (requireIndex !== -1) {
      source = source.slice(0, requireIndex) + nsfwFilterCode + source.slice(requireIndex);
    } else {
      // Last resort: insert at the beginning
      source = nsfwFilterCode + source;
    }
  }

  fs.writeFileSync(targetFile, source, 'utf8');
  console.log('[StremioPatcher] 040-nsfw-filter.js: patched', targetFile);
  console.log('[StremioPatcher] 040-nsfw-filter.js: finished');
};