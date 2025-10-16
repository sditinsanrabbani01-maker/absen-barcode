// ============================================================================
// NEW: Global Real-time Context - Simple & Clean Implementation
// ============================================================================
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, TABLES } from '../config/supabase';

const RealtimeContext = createContext();

// Global subscription manager
class GlobalRealtimeManager {
  constructor() {
    this.subscriptions = new Map();
    this.isOnline = navigator.onLine;
    this.callbacks = new Map(); // Store callbacks by table name
  }

  /**
    * Delete a record from a table
    * @param {string} tableName - Name of the table to delete from
    * @param {string|number} id - ID of the record to delete
    * @param {string} identifier - Unique identifier (niy for guru, nisn for siswa)
    * @returns {Promise} Promise that resolves when deletion is complete
    */
   async delete(tableName, id, identifier = null) {
     console.log(`🗑️ Deleting record with ID ${id} from table: ${tableName}`);

     try {
       let deleteQuery;

       // Use unique identifier field if provided, otherwise use id
       if (identifier) {
         const fieldName = tableName === 'guru' ? 'niy' : 'nisn';
         console.log(`🔍 Using ${fieldName} for deletion: ${identifier}`);
         deleteQuery = supabase
           .from(tableName)
           .delete()
           .eq(fieldName, identifier)
           .select();
       } else {
         // Fallback to id if no identifier provided (for backward compatibility)
         console.log(`⚠️ Using id for deletion: ${id}`);
         deleteQuery = supabase
           .from(tableName)
           .delete()
           .eq('id', id)
           .select();
       }

       const { data, error } = await deleteQuery;

       if (error) {
         console.error(`❌ Error deleting from ${tableName}:`, error);
         throw error;
       }

       console.log(`✅ Successfully deleted record ${identifier || id} from ${tableName}`);
       return data;
     } catch (error) {
       console.error(`❌ Failed to delete record ${identifier || id} from ${tableName}:`, error);
       throw error;
     }
   }

   /**
    * Subscribe to real-time changes for a specific table
    * @param {string} tableName - Name of the table to subscribe to
    * @param {Function} callback - Callback function for handling changes
    * @returns {Object} Subscription object with unsubscribe method
    */
   subscribeToTable(tableName, callback) {
    console.log(`📡 Setting up real-time subscription for table: ${tableName}`);

    // Store callback for this table
    if (!this.callbacks.has(tableName)) {
      this.callbacks.set(tableName, new Set());
    }
    this.callbacks.get(tableName).add(callback);

    // Create subscription if not exists
    if (!this.subscriptions.has(tableName)) {
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

            // Call all callbacks for this table
            const tableCallbacks = this.callbacks.get(tableName);
            if (tableCallbacks) {
              tableCallbacks.forEach(cb => {
                try {
                  cb({
                    eventType: payload.eventType,
                    tableName: tableName,
                    old: payload.old,
                    new: payload.new,
                    timestamp: new Date().toISOString()
                  });
                } catch (error) {
                  console.error('Error in real-time callback:', error);
                }
              });
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`✅ Successfully subscribed to ${tableName} real-time changes`);
          } else if (status === 'CHANNEL_ERROR') {
            console.error(`❌ Error subscribing to ${tableName} real-time changes`);
          }
        });

      this.subscriptions.set(tableName, subscription);
    }

    return {
      unsubscribe: () => {
        console.log(`🔌 Unsubscribing from ${tableName} real-time changes`);
        const tableCallbacks = this.callbacks.get(tableName);
        if (tableCallbacks) {
          tableCallbacks.delete(callback);
        }
      }
    };
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      online: this.isOnline,
      activeSubscriptions: this.subscriptions.size,
      subscriptionTables: Array.from(this.subscriptions.keys())
    };
  }
}

// Create global instance
const globalRealtimeManager = new GlobalRealtimeManager();

export const RealtimeProvider = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState(globalRealtimeManager.getConnectionStatus());

  useEffect(() => {
    // Setup network listeners
    const handleOnline = () => {
      globalRealtimeManager.isOnline = true;
      setConnectionStatus(globalRealtimeManager.getConnectionStatus());
    };

    const handleOffline = () => {
      globalRealtimeManager.isOnline = false;
      setConnectionStatus(globalRealtimeManager.getConnectionStatus());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const subscribeToTable = (tableName, callback) => {
    return globalRealtimeManager.subscribeToTable(tableName, callback);
  };

  const deleteRecord = async (tableName, id, identifier = null) => {
    return globalRealtimeManager.delete(tableName, id, identifier);
  };

  const getConnectionStatus = () => {
    return globalRealtimeManager.getConnectionStatus();
  };

  const value = {
    subscribeToTable,
    deleteRecord,
    getConnectionStatus,
    connectionStatus
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
};

export { globalRealtimeManager };