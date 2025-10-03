import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Badge,
  Snackbar,
  Alert,
  Chip,
  Typography,
  Popover,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import SyncIcon from '@mui/icons-material/Sync';
import SyncDisabledIcon from '@mui/icons-material/SyncDisabled';
import SyncProblemIcon from '@mui/icons-material/SyncProblem';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { realtimeManager } from '../services/SyncManager';

const SyncStatus = () => {
  // ============================================================================
  // NEW: Real-time status instead of polling-based sync status
  // ============================================================================
  const [realtimeStatus, setRealtimeStatus] = useState(realtimeManager.getRealtimeStatus());
  const [connectionStatus, setConnectionStatus] = useState(realtimeManager.getConnectionStatus());
  const [snackbar, setSnackbar] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [historyDialog, setHistoryDialog] = useState(false);

  useEffect(() => {
    // ============================================================================
    // NEW: Listen for real-time changes instead of sync status
    // ============================================================================
    const unsubscribeRealtime = realtimeManager.onRealtimeStatus((change) => {
      console.log('📡 Real-time change detected in SyncStatus:', change);

      // Show notification for real-time changes
      switch (change.eventType) {
        case 'INSERT':
          setSnackbar({ type: 'success', message: `✅ Data baru ditambahkan: ${change.tableName}` });
          break;
        case 'UPDATE':
          setSnackbar({ type: 'info', message: `📝 Data diperbarui: ${change.tableName}` });
          break;
        case 'DELETE':
          setSnackbar({ type: 'warning', message: `🗑️ Data dihapus: ${change.tableName}` });
          break;
        default:
          break;
      }

      // Update status
      setRealtimeStatus(realtimeManager.getRealtimeStatus());
    });

    // Listen for connection status changes
    const unsubscribeConnection = realtimeManager.onConnectionStatus((status) => {
      console.log('🌐 Connection status changed in SyncStatus:', status);
      setConnectionStatus(realtimeManager.getConnectionStatus());

      if (status.online) {
        setSnackbar({ type: 'success', message: '🌐 Koneksi internet tersambung - Real-time sync aktif' });
      } else {
        setSnackbar({ type: 'warning', message: '📴 Koneksi internet terputus - Mode offline aktif' });
      }
    });

    return () => {
      unsubscribeRealtime();
      unsubscribeConnection();
    };
  }, []);

  // Update status periodically (simplified)
  useEffect(() => {
    const interval = setInterval(() => {
      setRealtimeStatus(realtimeManager.getRealtimeStatus());
      setConnectionStatus(realtimeManager.getConnectionStatus());
    }, 5000); // Reduced frequency since we have real-time updates

    return () => clearInterval(interval);
  }, []);

  const handlePopoverOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
  };

  const getRealtimeIcon = () => {
    if (!realtimeStatus.isOnline) {
      return <WifiOffIcon color="error" />;
    }

    if (realtimeStatus.activeSubscriptions > 0) {
      return <WifiIcon color="success" />;
    }

    return <CloudOffIcon color="warning" />;
  };

  const getRealtimeTooltip = () => {
    if (!realtimeStatus.isOnline) {
      return 'Tidak ada koneksi internet - Mode offline';
    }

    if (realtimeStatus.activeSubscriptions > 0) {
      return `Real-time sync aktif - ${realtimeStatus.activeSubscriptions} tabel tersambung`;
    }

    return 'Real-time sync tidak aktif';
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Real-time Status Icon */}
        <Tooltip title={getRealtimeTooltip()}>
          <IconButton
            onClick={handlePopoverOpen}
            size="small"
          >
            <Badge
              badgeContent={realtimeStatus.activeSubscriptions}
              color="primary"
              max={99}
            >
              {getRealtimeIcon()}
            </Badge>
          </IconButton>
        </Tooltip>

        {/* Real-time Status Indicator */}
        <Tooltip title="Status Real-time">
          <IconButton
            size="small"
            disabled
          >
            {realtimeStatus.isOnline ? <WifiIcon color="success" /> : <WifiOffIcon color="error" />}
          </IconButton>
        </Tooltip>
      </Box>


      {/* Real-time Status Popover */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handlePopoverClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        <Box sx={{ p: 2, minWidth: 300 }}>
          <Typography variant="h6" gutterBottom>
            ⚡ Status Real-time
          </Typography>

          <List dense>
            <ListItem>
              <ListItemText
                primary="Status Koneksi"
                secondary={realtimeStatus.isOnline ? '🌐 Online - Real-time aktif' : '📴 Offline - Mode lokal aktif'}
              />
            </ListItem>

            <ListItem>
              <ListItemText
                primary="Subscriptions Aktif"
                secondary={`${realtimeStatus.activeSubscriptions} tabel tersambung untuk real-time updates`}
              />
            </ListItem>

            <ListItem>
              <ListItemText
                primary="Tabel Real-time"
                secondary={realtimeStatus.subscriptionTables.length > 0 ?
                  realtimeStatus.subscriptionTables.join(', ') :
                  'Belum ada tabel tersambung'
                }
              />
            </ListItem>

            <ListItem>
              <ListItemText
                primary="Mode Operasi"
                secondary={realtimeStatus.isOnline ?
                  '⚡ Real-time sync dengan Supabase' :
                  '💾 Mode offline - auto sync saat online'
                }
              />
            </ListItem>
          </List>

          {/* Offline Mode Explanation */}
          {!realtimeStatus.isOnline && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
              <Typography variant="subtitle2" color="warning.dark" gutterBottom>
                📴 Mode Offline Aktif
              </Typography>
              <Typography variant="body2" color="warning.dark">
                • Semua input tetap tersimpan di lokal<br/>
                • Real-time subscriptions akan aktif otomatis saat online<br/>
                • Tidak ada data yang hilang selama offline
              </Typography>
            </Box>
          )}

          {/* Real-time Mode Explanation */}
          {realtimeStatus.isOnline && realtimeStatus.activeSubscriptions > 0 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 1, border: '1px solid', borderColor: 'success.main' }}>
              <Typography variant="subtitle2" color="success.dark" gutterBottom>
                ⚡ Real-time Mode Aktif
              </Typography>
              <Typography variant="body2" color="success.dark">
                • {realtimeStatus.activeSubscriptions} tabel tersambung untuk real-time updates<br/>
                • Perubahan data langsung terlihat di semua device<br/>
                • Tidak perlu refresh manual
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 1 }} />

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={realtimeStatus.isOnline ? 'Online' : 'Offline'}
                color={realtimeStatus.isOnline ? 'success' : 'error'}
                size="small"
              />

              {realtimeStatus.activeSubscriptions > 0 && (
                <Chip
                  label={`${realtimeStatus.activeSubscriptions} Real-time`}
                  color="success"
                  size="small"
                />
              )}
            </Box>

            <Button
              size="small"
              startIcon={<HistoryIcon />}
              onClick={() => setHistoryDialog(true)}
              sx={{ fontSize: '0.75rem' }}
            >
              Detail
            </Button>
          </Box>
        </Box>
      </Popover>

      {/* Snackbar Notifications */}
      <Snackbar
        open={!!snackbar}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {snackbar && (
          <Alert
            onClose={() => setSnackbar(null)}
            severity={snackbar.type}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        )}
      </Snackbar>

      {/* Real-time Status Dialog */}
      <Dialog
        open={historyDialog}
        onClose={() => setHistoryDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon /> Status Real-time
        </DialogTitle>
        <DialogContent>
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                📊 Informasi Real-time
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 1, color: 'white' }}>
                  <Typography variant="h6">🌐 Koneksi</Typography>
                  <Typography variant="body2">
                    {realtimeStatus.isOnline ? 'Online - Real-time aktif' : 'Offline - Mode lokal'}
                  </Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1, color: 'white' }}>
                  <Typography variant="h6">📡 Subscriptions</Typography>
                  <Typography variant="body2">
                    {realtimeStatus.activeSubscriptions} tabel tersambung
                  </Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1, color: 'white' }}>
                  <Typography variant="h6">⚡ Mode</Typography>
                  <Typography variant="body2">
                    {realtimeStatus.isOnline ? 'Real-time sync aktif' : 'Siap sync otomatis'}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box>
              <Typography variant="h6" gutterBottom>
                📋 Tabel Real-time
              </Typography>
              {realtimeStatus.subscriptionTables.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {realtimeStatus.subscriptionTables.map((table) => (
                    <Chip
                      key={table}
                      label={table}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Belum ada tabel tersambung untuk real-time updates
                </Typography>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box>
              <Typography variant="h6" gutterBottom>
                💡 Cara Kerja Real-time
              </Typography>
              <Typography variant="body2" component="div">
                • <strong>Insert:</strong> Data baru otomatis muncul di semua device<br/>
                • <strong>Update:</strong> Perubahan data langsung terlihat di UI<br/>
                • <strong>Delete:</strong> Data langsung hilang dari list<br/>
                • <strong>Offline:</strong> Data tetap tersimpan lokal, sync otomatis saat online<br/>
                • <strong>Cross-device:</strong> Semua perubahan tersinkronisasi antar device
              </Typography>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SyncStatus;