import { DatabaseService, TABLES, supabase } from '../config/supabase.js';

// ============================================================================
// NEW: Supabase Realtime Manager - Replaces old polling-based sync
// ============================================================================
export class RealtimeManager {
  constructor() {
    this.subscriptions = new Map(); // Track active subscriptions
    this.isOnline = navigator.onLine;
    this.realtimeStatusCallbacks = [];
    this.connectionStatusCallbacks = [];

    // Setup network status monitoring
    this.setupNetworkListeners();
  }

  // ============================================================================
  // Network Status Monitoring (Simplified - no more complex sync logic)
  // ============================================================================
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('🌐 Network connection restored');
      this.isOnline = true;
      this.notifyConnectionStatus({ online: true });
    });

    window.addEventListener('offline', () => {
      console.log('📴 Network connection lost');
      this.isOnline = false;
      this.notifyConnectionStatus({ online: false });
    });
  }

  // ============================================================================
  // Real-time Subscription Management
  // ============================================================================

  /**
   * Subscribe to real-time changes for a specific table
   * @param {string} tableName - Name of the table to subscribe to
   * @param {Function} callback - Callback function for handling changes
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribeToTable(tableName, callback) {
    console.log(`📡 Setting up real-time subscription for table: ${tableName}`);

    try {
      // Create subscription using Supabase Realtime
      const subscription = supabase
        .channel(`${tableName}_changes`)
        .on('postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: tableName
          },
          (payload) => {
            console.log(`🔄 Real-time ${payload.eventType} on ${tableName}:`, payload);

            // Call the callback with the change data
            callback({
              eventType: payload.eventType,
              tableName: tableName,
              old: payload.old,
              new: payload.new,
              timestamp: new Date().toISOString()
            });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`✅ Successfully subscribed to ${tableName} real-time changes`);
          } else if (status === 'CHANNEL_ERROR') {
            console.error(`❌ Error subscribing to ${tableName} real-time changes`);
          }
        });

      // Store subscription for cleanup
      this.subscriptions.set(tableName, subscription);

      return {
        unsubscribe: () => {
          console.log(`🔌 Unsubscribing from ${tableName} real-time changes`);
          subscription.unsubscribe();
          this.subscriptions.delete(tableName);
        }
      };

    } catch (error) {
      console.error(`❌ Failed to setup real-time subscription for ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to multiple tables at once
   * @param {Array} tables - Array of table names to subscribe to
   * @param {Function} callback - Callback function for handling changes
   * @returns {Array} Array of subscription objects
   */
  subscribeToTables(tables, callback) {
    console.log(`📡 Setting up real-time subscriptions for tables:`, tables);

    const subscriptions = tables.map(tableName =>
      this.subscribeToTable(tableName, callback)
    );

    return subscriptions;
  }

  /**
   * Unsubscribe from all active subscriptions
   */
  unsubscribeAll() {
    console.log(`🔌 Unsubscribing from all real-time subscriptions`);

    this.subscriptions.forEach((subscription, tableName) => {
      try {
        subscription.unsubscribe();
        console.log(`✅ Unsubscribed from ${tableName}`);
      } catch (error) {
        console.error(`❌ Error unsubscribing from ${tableName}:`, error);
      }
    });

    this.subscriptions.clear();
  }

  // ============================================================================
  // Real-time Status Management (Simplified - no more complex sync tracking)
  // ============================================================================

  /**
   * Register callback for real-time status updates
   * @param {Function} callback - Callback function for handling real-time changes
   * @returns {Function} Unsubscribe function
   */
  onRealtimeStatus(callback) {
    this.realtimeStatusCallbacks.push(callback);
    return () => {
      this.realtimeStatusCallbacks = this.realtimeStatusCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Register callback for connection status changes
   * @param {Function} callback - Callback function for handling connection changes
   * @returns {Function} Unsubscribe function
   */
  onConnectionStatus(callback) {
    this.connectionStatusCallbacks.push(callback);
    return () => {
      this.connectionStatusCallbacks = this.connectionStatusCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify real-time status listeners
   * @param {Object} change - Change data from Supabase
   */
  notifyRealtimeChange(change) {
    console.log(`📡 Real-time change detected:`, change);

    this.realtimeStatusCallbacks.forEach(callback => {
      try {
        callback(change);
      } catch (error) {
        console.error('Error in real-time status callback:', error);
      }
    });
  }

  /**
   * Notify connection status listeners
   * @param {Object} status - Connection status
   */
  notifyConnectionStatus(status) {
    console.log(`🌐 Connection status changed:`, status);

    this.connectionStatusCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in connection status callback:', error);
      }
    });
  }

  /**
   * Get current real-time status
   * @returns {Object} Status information
   */
  getRealtimeStatus() {
    return {
      isOnline: this.isOnline,
      activeSubscriptions: this.subscriptions.size,
      subscriptionTables: Array.from(this.subscriptions.keys()),
      connectionStatus: this.isOnline ? 'connected' : 'disconnected'
    };
  }

  /**
   * Get connection status
   * @returns {Object} Connection information
   */
  getConnectionStatus() {
    return {
      online: this.isOnline,
      realtimeEnabled: this.subscriptions.size > 0,
      lastUpdate: new Date().toISOString()
    };
  }
}

// ============================================================================
// BACKWARD COMPATIBILITY: Keep old syncManager export for existing code
// ============================================================================

/**
 * @deprecated This is the old SyncManager. Use RealtimeManager instead.
 * This is kept for backward compatibility and will be removed in future versions.
 */
export class SyncManager {
  constructor() {
    console.warn('⚠️ SyncManager is deprecated. Use RealtimeManager for real-time subscriptions instead.');
    this.realtimeManager = new RealtimeManager();
  }

  // Delegate all calls to RealtimeManager
  subscribeToTable(tableName, callback) {
    return this.realtimeManager.subscribeToTable(tableName, callback);
  }

  subscribeToTables(tables, callback) {
    return this.realtimeManager.subscribeToTables(tables, callback);
  }

  unsubscribeAll() {
    return this.realtimeManager.unsubscribeAll();
  }

  onRealtimeStatus(callback) {
    return this.realtimeManager.onRealtimeStatus(callback);
  }

  onConnectionStatus(callback) {
    return this.realtimeManager.onConnectionStatus(callback);
  }

  notifyRealtimeChange(change) {
    return this.realtimeManager.notifyRealtimeChange(change);
  }

  notifyConnectionStatus(status) {
    return this.realtimeManager.notifyConnectionStatus(status);
  }

  getRealtimeStatus() {
    return this.realtimeManager.getRealtimeStatus();
  }

  getConnectionStatus() {
    return this.realtimeManager.getConnectionStatus();
  }

  // Deprecated methods (return warnings)
  async performSmartSync() {
    console.warn('⚠️ performSmartSync() is deprecated. Real-time subscriptions are now used instead.');
    return Promise.resolve();
  }

  async syncUserData() {
    console.warn('⚠️ syncUserData() is deprecated. Real-time subscriptions are now used instead.');
    return Promise.resolve();
  }

  async syncAttendanceData() {
    console.warn('⚠️ syncAttendanceData() is deprecated. Real-time subscriptions are now used instead.');
    return Promise.resolve();
  }

  async syncPermissionData() {
    console.warn('⚠️ syncPermissionData() is deprecated. Real-time subscriptions are now used instead.');
    return Promise.resolve();
  }

  async triggerManualSync() {
    console.warn('⚠️ triggerManualSync() is deprecated. Real-time subscriptions are now used instead.');
    return Promise.resolve();
  }

  async syncFromRemote() {
    console.warn('⚠️ syncFromRemote() is deprecated. Real-time subscriptions are now used instead.');
    return Promise.resolve();
  }

  getSyncStatus() {
    console.warn('⚠️ getSyncStatus() is deprecated. Use getRealtimeStatus() instead.');
    return this.realtimeManager.getRealtimeStatus();
  }
}

// Create singleton instances
export const realtimeManager = new RealtimeManager();
export const syncManager = new SyncManager(); // Backward compatibility