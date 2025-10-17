// Performance optimization service for faster scanning and data access

export class PerformanceService {
  // Cache configuration
  static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  static MAX_CACHE_SIZE = 1000; // Maximum cached records

  // User data cache
  static userCache = new Map();
  static cacheTimestamps = new Map();

  /**
   * Get user data with caching for faster lookups
   * @param {string} identifier - NIY or NISN
   * @returns {Promise<Object|null>} User data or null if not found
   */
  static async getCachedUser(identifier) {
    try {
      // Check cache first
      const cacheKey = identifier.toString();
      const cachedData = this.userCache.get(cacheKey);
      const cacheTime = this.cacheTimestamps.get(cacheKey);

      // Return cached data if still valid
      if (cachedData && cacheTime && (Date.now() - cacheTime) < this.CACHE_DURATION) {
        console.log('⚡ Cache hit for user:', identifier);
        return cachedData;
      }

      // Cache miss - fetch from Supabase first (faster for real-time data)
      const { supabase } = await import('../config/supabase');
      const { TABLES } = await import('../config/supabase');

      const { data: supabaseGuru, error: guruError } = await supabase
        .from(TABLES.GURU)
        .select('*')
        .eq('niy', identifier)
        .single();

      if (!guruError && supabaseGuru) {
        this.setCache(cacheKey, supabaseGuru);
        console.log('⚡ User found in Supabase:', identifier);
        return supabaseGuru;
      }

      const { data: supabaseSiswa, error: siswaError } = await supabase
        .from(TABLES.SISWA)
        .select('*')
        .eq('nisn', identifier)
        .single();

      if (!siswaError && supabaseSiswa) {
        this.setCache(cacheKey, supabaseSiswa);
        console.log('⚡ User found in Supabase (Siswa):', identifier);
        return supabaseSiswa;
      }

      // Fallback to local database
      const { db } = await import('../database');

      const [guru, siswa] = await Promise.all([
        db.guru.where('niy').equals(identifier).first(),
        db.siswa.where('nisn').equals(identifier).first()
      ]);

      const user = guru || siswa;
      if (user) {
        this.setCache(cacheKey, user);
        console.log('⚡ User found in local database:', identifier);
      }

      return user;

    } catch (error) {
      console.error('Error in cached user lookup:', error);
      return null;
    }
  }

  /**
   * Cache user data with timestamp
   * @param {string} key - Cache key
   * @param {Object} data - User data to cache
   */
  static setCache(key, data) {
    // Manage cache size
    if (this.userCache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entries (simple FIFO)
      const firstKey = this.userCache.keys().next().value;
      this.userCache.delete(firstKey);
      this.cacheTimestamps.delete(firstKey);
    }

    this.userCache.set(key, data);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * Clear user cache
   */
  static clearCache() {
    this.userCache.clear();
    this.cacheTimestamps.clear();
    console.log('🗑️ User cache cleared');
  }

  /**
   * Preload frequently used user data for faster scanning
   * @param {Array} identifiers - Array of user identifiers to preload
   */
  static async preloadUserData(identifiers) {
    console.log('⚡ Preloading user data for faster scanning...');

    const preloadPromises = identifiers.map(async (identifier) => {
      try {
        await this.getCachedUser(identifier);
      } catch (error) {
        console.warn(`Failed to preload user ${identifier}:`, error);
      }
    });

    await Promise.allSettled(preloadPromises);
    console.log(`✅ Preloaded ${identifiers.length} user records`);
  }

  /**
   * Get attendance cache for faster duplicate checking
   * @param {string} identifier - User identifier
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Array>} Attendance records for the date
   */
  static async getCachedAttendance(identifier, date) {
    try {
      const { supabase } = await import('../config/supabase');
      const { TABLES } = await import('../config/supabase');

      // Check Supabase first for real-time data
      const { data: supabaseAttendance, error } = await supabase
        .from(TABLES.ATTENDANCE)
        .select('*')
        .eq('identifier', identifier)
        .eq('tanggal', date);

      if (!error && supabaseAttendance) {
        return supabaseAttendance;
      }

      // Fallback to local database
      const { db } = await import('../database');
      return await db.attendance
        .where('identifier').equals(identifier)
        .and(a => a.tanggal === date)
        .toArray();

    } catch (error) {
      console.error('Error in cached attendance lookup:', error);
      return [];
    }
  }

  /**
   * Batch preload all active users for optimal scanning performance
   */
  static async preloadAllActiveUsers() {
    try {
      console.log('⚡ Preloading all active users for optimal scanning performance...');

      const { db } = await import('../database');

      const [guru, siswa] = await Promise.all([
        db.guru.where('status').equals('active').toArray(),
        db.siswa.where('status').equals('active').toArray()
      ]);

      const allUsers = [...guru, ...siswa];
      const identifiers = allUsers.map(user => user.niy || user.nisn).filter(Boolean);

      await this.preloadUserData(identifiers);
      console.log(`✅ Preloaded ${identifiers.length} active users for fast scanning`);

      return identifiers.length;

    } catch (error) {
      console.error('Error preloading users:', error);
      return 0;
    }
  }

  /**
   * Performance monitoring
   */
  static performanceMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    supabaseLookups: 0,
    localLookups: 0,
    averageLookupTime: 0
  };

  /**
   * Get performance metrics
   */
  static getPerformanceMetrics() {
    const totalLookups = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses;
    const cacheHitRate = totalLookups > 0 ? (this.performanceMetrics.cacheHits / totalLookups * 100).toFixed(1) : 0;

    return {
      ...this.performanceMetrics,
      cacheHitRate: `${cacheHitRate}%`,
      totalLookups,
      cacheSize: this.userCache.size
    };
  }

  /**
   * Reset performance metrics
   */
  static resetPerformanceMetrics() {
    this.performanceMetrics = {
      cacheHits: 0,
      cacheMisses: 0,
      supabaseLookups: 0,
      localLookups: 0,
      averageLookupTime: 0
    };
  }
}

export default PerformanceService;