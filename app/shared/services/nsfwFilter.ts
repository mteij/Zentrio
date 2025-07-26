/**
 * NSFW Content Filtering Service
 * Uses TMDB API to identify and filter adult content from Stremio interface
 */

interface TMDBSearchResult {
  page: number;
  results: Array<{
    id: number;
    title?: string; // For movies
    name?: string; // For TV shows
    release_date?: string;
    first_air_date?: string;
    overview: string;
    poster_path: string;
    adult: boolean;
    genre_ids: number[];
    media_type?: string;
  }>;
  total_pages: number;
  total_results: number;
}

interface TMDBMovieDetails {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  genres: Array<{
    id: number;
    name: string;
  }>;
  adult: boolean;
  vote_average: number;
  poster_path: string;
  backdrop_path: string;
  runtime: number;
  production_companies: Array<{
    id: number;
    name: string;
  }>;
}

interface TMDBTVDetails {
  id: number;
  name: string;
  overview: string;
  first_air_date: string;
  genres: Array<{
    id: number;
    name: string;
  }>;
  adult: boolean;
  vote_average: number;
  poster_path: string;
  backdrop_path: string;
  number_of_episodes: number;
  number_of_seasons: number;
}

class NSFWFilterService {
  private apiKey: string | null = null;
  private cache: Map<string, boolean> = new Map();
  private rateLimitDelay = 100; // ms between API calls
  private lastApiCall = 0;

  constructor() {
    this.loadApiKey();
  }

  private loadApiKey() {
    if (typeof window !== 'undefined') {
      this.apiKey = localStorage.getItem('tmdbApiKey');
    }
  }

  /**
   * Check if content filtering is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Extract title and year from various formats
   */
  private extractTitleInfo(text: string): { title: string; year?: string } {
    // Remove common prefixes and suffixes
    let cleanTitle = text
      .replace(/^(HD|4K|3D|CAM|TS|TC|DVDRip|BRRip|WEB-DL|WEBRip)\s*/i, '')
      .replace(/\s*(HD|4K|3D|CAM|TS|TC|DVDRip|BRRip|WEB-DL|WEBRip)$/i, '')
      .replace(/\s*\([^)]*\)$/, '') // Remove parenthetical info at end
      .trim();

    // Extract year if present
    const yearMatch = text.match(/\((\d{4})\)|\b(\d{4})\b/);
    const year = yearMatch ? (yearMatch[1] || yearMatch[2]) : undefined;

    // Remove year from title if found
    if (year) {
      cleanTitle = cleanTitle.replace(new RegExp(`\\b${year}\\b|\\(${year}\\)`), '').trim();
    }

    return { title: cleanTitle, year };
  }

  /**
   * Rate limit API calls (TMDB allows 40 requests per 10 seconds)
   */
  private async rateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    if (timeSinceLastCall < this.rateLimitDelay) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastCall));
    }
    this.lastApiCall = Date.now();
  }

  /**
   * Search for a title using TMDB API (multi-search)
   */
  private async searchTitle(title: string, year?: string): Promise<{ id: number; type: string } | null> {
    if (!this.apiKey) return null;

    const cacheKey = `${title}${year ? `-${year}` : ''}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      return cached ? { id: this.cache.get(cacheKey) as unknown as number, type: 'movie' } : null;
    }

    try {
      await this.rateLimit();
      
      const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${this.apiKey}&query=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}`;
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        console.warn('TMDB API request failed:', response.statusText);
        return null;
      }

      const data: TMDBSearchResult = await response.json();
      
      if (data.results && data.results.length > 0) {
        // Find the best match, preferring exact year matches
        let bestMatch = data.results[0];
        
        if (year) {
          const yearMatch = data.results.find(result => {
            const releaseYear = result.release_date?.substring(0, 4) || result.first_air_date?.substring(0, 4);
            return releaseYear === year;
          });
          if (yearMatch) bestMatch = yearMatch;
        }

        const mediaType = bestMatch.media_type || (bestMatch.title ? 'movie' : 'tv');
        return { id: bestMatch.id, type: mediaType };
      }

      this.cache.set(cacheKey, false);
      return null;
    } catch (error) {
      console.warn('Error searching TMDB:', error);
      return null;
    }
  }

  /**
   * Get detailed information for a specific TMDB ID
   */
  private async getDetails(id: number, type: string): Promise<TMDBMovieDetails | TMDBTVDetails | null> {
    if (!this.apiKey) return null;

    try {
      await this.rateLimit();
      
      const endpoint = type === 'movie' ? 'movie' : 'tv';
      const detailUrl = `https://api.themoviedb.org/3/${endpoint}/${id}?api_key=${this.apiKey}`;
      const response = await fetch(detailUrl);
      
      if (!response.ok) {
        console.warn('TMDB API details request failed:', response.statusText);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.warn('Error fetching TMDB details:', error);
      return null;
    }
  }

  /**
   * Determine if content is NSFW based on TMDB data
   */
  private isNSFWContent(details: TMDBMovieDetails | TMDBTVDetails): boolean {
    // TMDB has an explicit 'adult' flag - this is the most reliable indicator
    if (details.adult) {
      return true;
    }

    // Check genres by ID (TMDB uses numeric IDs for genres)
    // Adult/erotic genres typically don't have specific IDs in TMDB, but we can check by name
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

    // Check overview/plot for adult keywords
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

    // Additional check for very low-rated content that might be adult
    if (details.vote_average > 0 && details.vote_average < 3.0) {
      // If it has adult keywords AND very low rating, it might be adult content
      const title = 'title' in details ? details.title : details.name;
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

  /**
   * Check if a title is NSFW
   */
  async isNSFW(titleText: string): Promise<boolean> {
    if (!this.apiKey) {
      return false; // If no API key, don't filter anything
    }

    const cacheKey = `nsfw-${titleText}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) || false;
    }

    try {
      const { title, year } = this.extractTitleInfo(titleText);
      
      // Search for the title
      const searchResult = await this.searchTitle(title, year);
      if (!searchResult) {
        this.cache.set(cacheKey, false);
        return false;
      }

      // Get detailed information
      const details = await this.getDetails(searchResult.id, searchResult.type);
      if (!details) {
        this.cache.set(cacheKey, false);
        return false;
      }

      // Check if it's NSFW
      const isNSFW = this.isNSFWContent(details);
      
      // Cache the result
      this.cache.set(cacheKey, isNSFW);
      
      return isNSFW;
    } catch (error) {
      console.warn('Error checking NSFW status:', error);
      this.cache.set(cacheKey, false);
      return false;
    }
  }

  /**
   * Update API key
   */
  updateApiKey(apiKey: string) {
    this.apiKey = apiKey;
    this.cache.clear(); // Clear cache when API key changes
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
export const nsfwFilter = new NSFWFilterService();