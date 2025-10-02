import { DatabaseService, TABLES, supabase } from '../config/supabase.js';

export class SyncManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncInterval = null;
    this.syncInProgress = false;
    this.offlineQueue = [];
    this.syncStatusCallbacks = [];
    this.conflictResolutions = new Map();
    this.syncHistory = [];
    this.maxHistorySize = 100;

    // Sync intervals (in milliseconds)
    this.SYNC_INTERVALS = {
      FAST: 30000,      // 30 seconds for active data (attendance)
      NORMAL: 300000,   // 5 minutes for regular data
      SLOW: 1800000,    // 30 minutes for settings
      MANUAL: 0         // Immediate for manual sync
    };

    this.setupEventListeners();
    this.loadOfflineQueue();
    this.loadSyncHistory();
  }

  // Setup network event listeners
  setupEventListeners() {
    window.addEventListener('online', () => {
      console.log('🌐 Network connection restored');
      this.isOnline = true;
      this.onNetworkRestore();
    });

    window.addEventListener('offline', () => {
      console.log('📴 Network connection lost');
      this.isOnline = false;
    });

    // Listen for visibility changes to sync when app becomes active
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline) {
        this.performSmartSync();
      }
    });
  }

  // Load offline queue from localStorage
  loadOfflineQueue() {
    try {
      const queue = localStorage.getItem('sync_offline_queue');
      this.offlineQueue = queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('Error loading offline queue:', error);
      this.offlineQueue = [];
    }
  }

  // Save offline queue to localStorage
  saveOfflineQueue() {
    try {
      localStorage.setItem('sync_offline_queue', JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }

  // Add operation to offline queue
  addToOfflineQueue(operation) {
    const queueItem = {
      id: Date.now() + Math.random(),
      operation,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };

    this.offlineQueue.push(queueItem);
    this.saveOfflineQueue();
    console.log('📋 Added to offline queue:', operation);

    // Notify listeners
    this.notifySyncStatus({
      type: 'offline_queued',
      operation: operation.type,
      count: this.offlineQueue.length
    });
  }

  // Register sync status callback
  onSyncStatus(callback) {
    this.syncStatusCallbacks.push(callback);
    return () => {
      this.syncStatusCallbacks = this.syncStatusCallbacks.filter(cb => cb !== callback);
    };
  }

  // Notify all sync status listeners
  notifySyncStatus(status) {
    // Add to sync history
    this.addToSyncHistory(status);

    this.syncStatusCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in sync status callback:', error);
      }
    });
  }

  // Add operation to sync history
  addToSyncHistory(status) {
    const historyItem = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      type: status.type,
      message: this.getStatusMessage(status),
      details: status
    };

    this.syncHistory.unshift(historyItem);

    // Keep only recent history
    if (this.syncHistory.length > this.maxHistorySize) {
      this.syncHistory = this.syncHistory.slice(0, this.maxHistorySize);
    }

    // Save to localStorage
    this.saveSyncHistory();
  }

  // Get user-friendly message for status
  getStatusMessage(status) {
    const messages = {
      sync_started: 'Sinkronisasi dimulai',
      sync_completed: 'Sinkronisasi berhasil',
      sync_error: `Error: ${status.error}`,
      remote_sync_started: 'Mengunduh dari cloud',
      remote_sync_completed: 'Download dari cloud berhasil',
      remote_sync_error: `Error download: ${status.error}`,
      offline_queued: 'Operasi offline ditambahkan',
      offline_queue_cleared: 'Antrian offline selesai',
      manual_sync_started: 'Sinkronisasi manual dimulai'
    };

    return messages[status.type] || status.type;
  }

  // Save sync history to localStorage
  saveSyncHistory() {
    try {
      localStorage.setItem('sync_history', JSON.stringify(this.syncHistory));
    } catch (error) {
      console.error('Error saving sync history:', error);
    }
  }

  // Load sync history from localStorage
  loadSyncHistory() {
    try {
      const history = localStorage.getItem('sync_history');
      this.syncHistory = history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Error loading sync history:', error);
      this.syncHistory = [];
    }
  }

  // Get sync history
  getSyncHistory(limit = 50) {
    return this.syncHistory.slice(0, limit);
  }

  // Clear sync history
  clearSyncHistory() {
    this.syncHistory = [];
    localStorage.removeItem('sync_history');
  }

  // Start automatic sync
  startAutoSync() {
    console.log('🚀 Starting automatic sync...');

    // Initial sync
    this.performSmartSync();

    // Set up periodic sync
    this.syncInterval = setInterval(() => {
      this.performSmartSync();
    }, this.SYNC_INTERVALS.NORMAL);

    // Fast sync for attendance data every 30 seconds
    setInterval(() => {
      this.syncAttendanceData();
    }, this.SYNC_INTERVALS.FAST);
  }

  // Stop automatic sync
  stopAutoSync() {
    console.log('⏹️ Stopping automatic sync...');
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Perform smart sync based on data priority
  async performSmartSync() {
    if (!this.isOnline || this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;
    console.log('🔄 Performing smart sync...');

    try {
      // Notify start
      this.notifySyncStatus({ type: 'sync_started' });

      // Sync settings first (critical data)
      await this.syncSettings();

      // Sync user data (teachers/students)
      await this.syncUserData();

      // Sync attendance data (frequent changes)
      await this.syncAttendanceData();

      // Sync permissions
      await this.syncPermissionData();

      // Process offline queue if any
      await this.processOfflineQueue();

      // Save last sync time
      localStorage.setItem('last_sync_time', new Date().toISOString());

      // Notify success
      this.notifySyncStatus({
        type: 'sync_completed',
        timestamp: new Date().toISOString()
      });

      console.log('✅ Smart sync completed successfully');

    } catch (error) {
      console.error('❌ Smart sync failed:', error);
      this.notifySyncStatus({
        type: 'sync_error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      this.syncInProgress = false;
    }
  }

  // Sync settings data (school settings, attendance settings, reminder settings)
  async syncSettings() {
    try {
      console.log('🔄 Syncing settings...');

      // Get local settings
      const { db } = await import('../database.js');
      const [attendanceSettings, schoolSettings, reminderSettings] = await Promise.all([
        db.attendance_settings.toArray(),
        db.school_settings.toCollection().first(),
        db.reminder_settings.toCollection().first()
      ]);

      // Sync attendance settings - check if exists first
      if (attendanceSettings.length > 0) {
        for (const setting of attendanceSettings) {
          try {
            // Check if setting already exists in Supabase by type, start_time, end_time
            const { data: existingSettings } = await supabase
              .from(TABLES.ATTENDANCE_SETTINGS)
              .select('id')
              .eq('type', setting.type)
              .eq('start_time', setting.start_time)
              .eq('end_time', setting.end_time)
              .eq('att', setting.att);

            if (!existingSettings || existingSettings.length === 0) {
              await DatabaseService.create(TABLES.ATTENDANCE_SETTINGS, setting);
              console.log('✅ Created new attendance setting:', setting.label);
            } else {
              console.log('ℹ️ Attendance setting already exists:', setting.label);
            }
          } catch (error) {
            console.error('Error syncing attendance setting:', error);
          }
        }
      }

      // Sync school settings - check if exists first
      if (schoolSettings) {
        try {
          const { data: existingSchoolSettings } = await supabase
            .from(TABLES.SCHOOL_SETTINGS)
            .select('id')
            .limit(1);

          if (!existingSchoolSettings || existingSchoolSettings.length === 0) {
            await DatabaseService.create(TABLES.SCHOOL_SETTINGS, schoolSettings);
            console.log('✅ Created school settings');
          } else {
            console.log('ℹ️ School settings already exist');
          }
        } catch (error) {
          console.error('Error syncing school settings:', error);
        }
      }

      // Sync reminder settings - check if exists first
      if (reminderSettings) {
        try {
          const { data: existingReminderSettings } = await supabase
            .from(TABLES.REMINDER_SETTINGS)
            .select('id')
            .limit(1);

          if (!existingReminderSettings || existingReminderSettings.length === 0) {
            await DatabaseService.create(TABLES.REMINDER_SETTINGS, reminderSettings);
            console.log('✅ Created reminder settings');
          } else {
            console.log('ℹ️ Reminder settings already exist');
          }
        } catch (error) {
          console.error('Error syncing reminder settings:', error);
        }
      }

      console.log('✅ Settings synced');
    } catch (error) {
      console.error('❌ Error syncing settings:', error);
      throw error;
    }
  }

  // Sync user data (teachers and students)
  async syncUserData() {
    try {
      console.log('🔄 Syncing user data...');

      const results = await DatabaseService.syncLocalToSupabase();
      console.log('✅ User data synced:', results);

      return results;
    } catch (error) {
      console.error('❌ Error syncing user data:', error);
      throw error;
    }
  }

  // Real-time sync for immediate synchronization
  async syncImmediately(tableName, operation, data, id = null) {
    if (!this.isOnline) {
      // Queue for offline sync
      this.addToOfflineQueue({ type: operation, table: tableName, data, id });
      return { queued: true };
    }

    try {
      console.log(`🔄 Real-time sync: ${operation} ${tableName}`, data);

      let result;
      switch (operation) {
        case 'create':
          result = await DatabaseService.create(tableName, data);
          break;
        case 'update':
          result = await DatabaseService.update(tableName, id, data);
          break;
        case 'delete':
          result = await DatabaseService.delete(tableName, id);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      // Notify success
      this.notifySyncStatus({
        type: 'realtime_sync_completed',
        operation,
        table: tableName,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Real-time sync completed: ${operation} ${tableName}`);
      return { success: true, result };

    } catch (error) {
      console.error(`❌ Real-time sync failed: ${operation} ${tableName}`, error);

      // Queue for retry if online sync fails
      this.addToOfflineQueue({ type: operation, table: tableName, data, id });

      this.notifySyncStatus({
        type: 'realtime_sync_error',
        operation,
        table: tableName,
        error: error.message
      });

      return { success: false, error: error.message, queued: true };
    }
  }

  // Sync attendance data specifically (enhanced for real-time)
  async syncAttendanceData() {
    if (!this.isOnline) return;

    try {
      console.log('🔄 Syncing attendance data...');

      // Get recent attendance data from local (last 24 hours)
      const { db } = await import('../database.js');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const recentAttendance = await db.attendance
        .where('created_at')
        .above(yesterday.toISOString())
        .toArray();

      if (recentAttendance.length > 0) {
        await DatabaseService.bulkCreate(TABLES.ATTENDANCE, recentAttendance);
        console.log(`✅ Synced ${recentAttendance.length} attendance records`);
      }
    } catch (error) {
      console.error('❌ Error syncing attendance data:', error);
    }
  }

  // Sync permission data
  async syncPermissionData() {
    try {
      console.log('🔄 Syncing permission data...');

      const { db } = await import('../database.js');
      const localPermissions = await db.perizinan.toArray();

      if (localPermissions.length > 0) {
        for (const permission of localPermissions) {
          try {
            await DatabaseService.create(TABLES.PERIZINAN, permission);
          } catch (error) {
            console.error('Error syncing permission:', error);
          }
        }
      }

      console.log('✅ Permission data synced');
    } catch (error) {
      console.error('❌ Error syncing permission data:', error);
    }
  }

  // Process offline queue when back online
  async processOfflineQueue() {
    if (this.offlineQueue.length === 0) return;

    console.log(`📋 Processing ${this.offlineQueue.length} queued operations...`);

    const remainingQueue = [];

    for (const item of this.offlineQueue) {
      try {
        await this.executeQueuedOperation(item.operation);
        console.log('✅ Processed queued operation:', item.operation.type);
      } catch (error) {
        console.error('❌ Failed to process queued operation:', error);
        item.retryCount++;

        // Keep in queue if under retry limit
        if (item.retryCount < 3) {
          remainingQueue.push(item);
        } else {
          console.error('🚫 Dropping operation after max retries:', item.operation);
        }
      }
    }

    this.offlineQueue = remainingQueue;
    this.saveOfflineQueue();

    if (remainingQueue.length === 0) {
      this.notifySyncStatus({ type: 'offline_queue_cleared' });
    }
  }

  // Execute a queued operation
  async executeQueuedOperation(operation) {
    switch (operation.type) {
      case 'create':
        await DatabaseService.create(operation.table, operation.data);
        break;
      case 'update':
        await DatabaseService.update(operation.table, operation.id, operation.data);
        break;
      case 'delete':
        await DatabaseService.delete(operation.table, operation.id);
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  // Manual sync trigger
  async triggerManualSync() {
    console.log('🔄 Manual sync triggered');
    this.notifySyncStatus({ type: 'manual_sync_started' });
    await this.performSmartSync();
  }

  // Sync from remote to local (bidirectional)
  async syncFromRemote() {
    if (!this.isOnline) {
      throw new Error('Cannot sync from remote while offline');
    }

    try {
      console.log('⬇️ Syncing from remote to local...');
      this.notifySyncStatus({ type: 'remote_sync_started' });

      const results = await DatabaseService.autoSyncFromSupabase();

      this.notifySyncStatus({
        type: 'remote_sync_completed',
        results,
        timestamp: new Date().toISOString()
      });

      console.log('✅ Remote sync completed:', results);
      return results;
    } catch (error) {
      console.error('❌ Remote sync failed:', error);
      this.notifySyncStatus({
        type: 'remote_sync_error',
        error: error.message
      });
      throw error;
    }
  }

  // Handle network restoration
  async onNetworkRestore() {
    console.log('🔄 Handling network restoration...');

    // Wait a bit for connection to stabilize
    setTimeout(async () => {
      try {
        // First sync from remote to get latest changes
        await this.syncFromRemote();

        // Then process offline queue
        await this.processOfflineQueue();

        console.log('✅ Network restoration handled');
      } catch (error) {
        console.error('❌ Error handling network restoration:', error);
      }
    }, 2000);
  }

  // Get sync status
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      offlineQueueLength: this.offlineQueue.length,
      lastSyncTime: localStorage.getItem('last_sync_time'),
      conflictCount: this.conflictResolutions.size,
      syncHistory: this.getSyncHistory(10), // Last 10 operations
      totalHistoryCount: this.syncHistory.length
    };
  }

  // Queue operation when offline
  async queueOperationWhenOffline(operation) {
    if (!this.isOnline) {
      this.addToOfflineQueue(operation);
      return { queued: true, id: Date.now() };
    } else {
      // Execute immediately if online
      await this.executeQueuedOperation(operation);
      return { queued: false, executed: true };
    }
  }

  // Resolve data conflicts
  resolveConflict(localData, remoteData, strategy = 'remote_wins') {
    switch (strategy) {
      case 'remote_wins':
        return remoteData;
      case 'local_wins':
        return localData;
      case 'merge':
        return { ...localData, ...remoteData };
      default:
        return remoteData;
    }
  }

  // Get conflict resolution strategy for a table
  getConflictStrategy(tableName) {
    const strategies = {
      [TABLES.ATTENDANCE]: 'local_wins',      // Local attendance is more current
      [TABLES.PERIZINAN]: 'local_wins',       // Local permissions are more current
      [TABLES.GURU]: 'merge',                 // Merge teacher data
      [TABLES.SISWA]: 'merge',                // Merge student data
      [TABLES.ATTENDANCE_SETTINGS]: 'remote_wins', // Settings should be consistent
      [TABLES.SCHOOL_SETTINGS]: 'remote_wins' // School settings should be consistent
    };

    return strategies[tableName] || 'remote_wins';
  }
}

// Create singleton instance
export const syncManager = new SyncManager();