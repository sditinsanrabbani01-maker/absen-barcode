import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Badge,
  Snackbar,
  Alert,
  LinearProgress,
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
import { syncManager } from '../services/SyncManager';

const SyncStatus = () => {
  const [syncStatus, setSyncStatus] = useState(syncManager.getSyncStatus());
  const [showProgress, setShowProgress] = useState(false);
  const [snackbar, setSnackbar] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [historyDialog, setHistoryDialog] = useState(false);

  useEffect(() => {
    // Listen for sync status updates
    const unsubscribe = syncManager.onSyncStatus((status) => {
      setSyncStatus(syncManager.getSyncStatus());

      // Handle different status types
      switch (status.type) {
        case 'sync_started':
          setShowProgress(true);
          setSnackbar({ type: 'info', message: 'Sinkronisasi dimulai...' });
          break;
        case 'sync_completed':
          setShowProgress(false);
          setSnackbar({ type: 'success', message: 'Sinkronisasi berhasil' });
          break;
        case 'sync_error':
          setShowProgress(false);
          setSnackbar({ type: 'error', message: `Error sinkronisasi: ${status.error}` });
          break;
        case 'remote_sync_started':
          setSnackbar({ type: 'info', message: 'Mengunduh data dari cloud...' });
          break;
        case 'remote_sync_completed':
          setSnackbar({ type: 'success', message: 'Data cloud berhasil diunduh' });
          break;
        case 'remote_sync_error':
          setSnackbar({ type: 'error', message: `Error mengunduh data: ${status.error}` });
          break;
        case 'offline_queued':
          setSnackbar({ type: 'warning', message: `${status.count} operasi menunggu sinkronisasi` });
          break;
        case 'offline_queue_cleared':
          setSnackbar({ type: 'success', message: 'Semua operasi offline telah disinkronisasi' });
          break;
        case 'manual_sync_started':
          setShowProgress(true);
          setSnackbar({ type: 'info', message: 'Sinkronisasi manual dimulai...' });
          break;
        default:
          break;
      }
    });

    return unsubscribe;
  }, []);

  // Update status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncStatus(syncManager.getSyncStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    try {
      await syncManager.triggerManualSync();
    } catch (error) {
      setSnackbar({ type: 'error', message: `Manual sync failed: ${error.message}` });
    }
  };

  const handleRemoteSync = async () => {
    try {
      await syncManager.syncFromRemote();
    } catch (error) {
      setSnackbar({ type: 'error', message: `Remote sync failed: ${error.message}` });
    }
  };

  const handlePopoverOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
  };

  const getSyncIcon = () => {
    if (!syncStatus.isOnline) {
      return <CloudOffIcon color="error" />;
    }

    if (syncStatus.syncInProgress) {
      return <SyncIcon className="spinning" color="primary" />;
    }

    if (syncStatus.offlineQueueLength > 0) {
      return <SyncProblemIcon color="warning" />;
    }

    return <CloudDoneIcon color="success" />;
  };

  const getSyncTooltip = () => {
    if (!syncStatus.isOnline) {
      return 'Tidak ada koneksi internet';
    }

    if (syncStatus.syncInProgress) {
      return 'Sinkronisasi sedang berlangsung...';
    }

    if (syncStatus.offlineQueueLength > 0) {
      return `${syncStatus.offlineQueueLength} operasi menunggu sinkronisasi`;
    }

    return 'Sinkronisasi aktif';
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Sync Status Icon */}
        <Tooltip title={getSyncTooltip()}>
          <IconButton
            onClick={handlePopoverOpen}
            size="small"
            sx={{
              animation: syncStatus.syncInProgress ? 'spin 1s linear infinite' : 'none',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' }
              }
            }}
          >
            <Badge
              badgeContent={syncStatus.offlineQueueLength}
              color="error"
              max={99}
            >
              {getSyncIcon()}
            </Badge>
          </IconButton>
        </Tooltip>

        {/* Manual Sync Button */}
        <Tooltip title="Sinkronisasi Manual">
          <IconButton
            onClick={handleManualSync}
            disabled={!syncStatus.isOnline || syncStatus.syncInProgress}
            size="small"
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>

        {/* Remote Sync Button */}
        <Tooltip title="Sinkronisasi dari Cloud">
          <IconButton
            onClick={handleRemoteSync}
            disabled={!syncStatus.isOnline || syncStatus.syncInProgress}
            size="small"
          >
            <CloudDoneIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Sync Progress Bar */}
      {showProgress && (
        <Box sx={{ width: '100%', mt: 1 }}>
          <LinearProgress />
          <Typography variant="caption" sx={{ mt: 0.5 }}>
            Sinkronisasi sedang berlangsung...
          </Typography>
        </Box>
      )}

      {/* Status Popover */}
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
        <Box sx={{ p: 2, minWidth: 250 }}>
          <Typography variant="h6" gutterBottom>
            Status Sinkronisasi
          </Typography>

          <List dense>
            <ListItem>
              <ListItemText
                primary="Status Koneksi"
                secondary={syncStatus.isOnline ? 'Online - Sinkronisasi aktif' : 'Offline - Mode lokal aktif'}
              />
            </ListItem>

            <ListItem>
              <ListItemText
                primary="Operasi Offline"
                secondary={syncStatus.offlineQueueLength > 0 ?
                  `${syncStatus.offlineQueueLength} menunggu sinkronisasi` :
                  'Tidak ada operasi offline'
                }
              />
            </ListItem>

            <ListItem>
              <ListItemText
                primary="Sinkronisasi Terakhir"
                secondary={syncStatus.lastSyncTime ?
                  new Date(syncStatus.lastSyncTime).toLocaleString('id-ID') :
                  'Belum pernah'
                }
              />
            </ListItem>

            <ListItem>
              <ListItemText
                primary="Riwayat Sinkronisasi"
                secondary={`${syncStatus.totalHistoryCount} operasi tersimpan`}
              />
            </ListItem>

            {syncStatus.conflictCount > 0 && (
              <ListItem>
                <ListItemText
                  primary="Konflik Data"
                  secondary={`${syncStatus.conflictCount} konflik terselesaikan`}
                />
              </ListItem>
            )}
          </List>

          {/* Offline Mode Explanation */}
          {!syncStatus.isOnline && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
              <Typography variant="subtitle2" color="warning.dark" gutterBottom>
                📴 Mode Offline Aktif
              </Typography>
              <Typography variant="body2" color="warning.dark">
                • Semua input absensi tetap tersimpan di lokal<br/>
                • Data akan otomatis tersinkronisasi ketika online<br/>
                • Tidak ada data yang hilang selama offline
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 1 }} />

          {/* Recent Sync History */}
          {syncStatus.syncHistory && syncStatus.syncHistory.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Riwayat Terbaru:
              </Typography>
              <Box sx={{ maxHeight: 150, overflow: 'auto' }}>
                {syncStatus.syncHistory.slice(0, 5).map((item) => (
                  <Box key={item.id} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      {new Date(item.timestamp).toLocaleTimeString('id-ID')}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 'medium' }}>
                      {item.message}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 1 }} />

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={syncStatus.isOnline ? 'Online' : 'Offline'}
                color={syncStatus.isOnline ? 'success' : 'error'}
                size="small"
              />

              {syncStatus.syncInProgress && (
                <Chip
                  label="Sinkronisasi..."
                  color="primary"
                  size="small"
                />
              )}

              {syncStatus.offlineQueueLength > 0 && (
                <Chip
                  label={`${syncStatus.offlineQueueLength} Queue`}
                  color="warning"
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
              Riwayat
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

      {/* Sync History Dialog */}
      <Dialog
        open={historyDialog}
        onClose={() => setHistoryDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon /> Riwayat Sinkronisasi
        </DialogTitle>
        <DialogContent>
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {syncStatus.syncHistory && syncStatus.syncHistory.length > 0 ? (
              syncStatus.syncHistory.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    p: 2,
                    mb: 1,
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    bgcolor: item.type.includes('error') ? 'error.light' : 'background.paper'
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2">
                      {new Date(item.timestamp).toLocaleString('id-ID')}
                    </Typography>
                    <Chip
                      label={item.type.replace('_', ' ').toUpperCase()}
                      size="small"
                      color={item.type.includes('error') ? 'error' : item.type.includes('sync') ? 'primary' : 'default'}
                    />
                  </Box>
                  <Typography variant="body2">
                    {item.message}
                  </Typography>
                  {item.details.error && (
                    <Typography variant="body2" color="error" sx={{ mt: 1, fontFamily: 'monospace' }}>
                      {item.details.error}
                    </Typography>
                  )}
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                Belum ada riwayat sinkronisasi
              </Typography>
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SyncStatus;