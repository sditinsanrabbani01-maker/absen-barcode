import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Checkbox,
  TablePagination
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { db } from '../database';
import { DatabaseService, TABLES } from '../config/supabase';
import { realtimeManager } from '../services/SyncManager';

const DataPerizinan = ({ mode }) => {
  const [perizinanData, setPerizinanData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState(false);
  const [editingPerizinan, setEditingPerizinan] = useState(null);
  const [selectedPerizinan, setSelectedPerizinan] = useState([]);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  useEffect(() => {
    // ============================================================================
    // NEW: Real-time subscriptions for perizinan data
    // ============================================================================

    // Initial load
    loadPerizinanData();

    // Setup real-time subscription for perizinan table
    const subscription = realtimeManager.subscribeToTable('perizinan', (change) => {
      console.log(`🔄 Real-time perizinan change in DataPerizinan:`, change);

      // Reload data when any change occurs
      loadPerizinanData();

      // Show notification for real-time updates
      if (change.eventType === 'INSERT') {
        console.log(`✅ New perizinan record added`);
      } else if (change.eventType === 'UPDATE') {
        console.log(`📝 Perizinan record updated`);
      } else if (change.eventType === 'DELETE') {
        console.log(`🗑️ Perizinan record deleted`);
      }
    });

    // Listen for connection status changes
    const connectionUnsubscribe = realtimeManager.onConnectionStatus((status) => {
      console.log('🌐 DataPerizinan connection status:', status);
      if (status.online) {
        // Reload data when coming back online
        loadPerizinanData();
      }
    });

    // Cleanup function
    return () => {
      console.log('🔌 Cleaning up DataPerizinan subscriptions');
      subscription.unsubscribe();
      connectionUnsubscribe();
    };
  }, []);

  const loadPerizinanData = async () => {
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3); // Last 3 months
      const endDate = new Date();

      const data = await DatabaseService.getPerizinanByDateRange(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      setPerizinanData(data || []);
      setLoading(false);
      setSelectedPerizinan([]);
    } catch (error) {
      console.error('Error loading perizinan data:', error);
      setLoading(false);
    }
  };

  const handleDeletePerizinan = async (id) => {
    try {
      if (confirm('Hapus data perizinan ini?')) {
        await DatabaseService.delete(TABLES.PERIZINAN, id);
        loadPerizinanData();

        // Trigger refresh in RekapAbsen if available
        if (window.refreshRekapAbsen) {
          window.refreshRekapAbsen();
        }
      }
    } catch (error) {
      console.error('Error deleting perizinan:', error);
      alert('Error deleting perizinan: ' + error.message);
    }
  };

  const handleEditPerizinan = (perizinan) => {
    setEditingPerizinan({ ...perizinan });
    setEditDialog(true);
  };

  const handleUpdatePerizinan = async () => {
    if (!editingPerizinan) return;

    // Validate required fields
    if (!editingPerizinan.tanggal || !editingPerizinan.nama || !editingPerizinan.identifier || !editingPerizinan.sebagai || !editingPerizinan.jenis_izin) {
      alert('Semua field harus diisi!');
      return;
    }

    try {
      await DatabaseService.update(TABLES.PERIZINAN, editingPerizinan.id, editingPerizinan);
      loadPerizinanData();
      setEditDialog(false);
      setEditingPerizinan(null);
      alert('Data perizinan berhasil diupdate!');

      // Trigger refresh in RekapAbsen if available
      if (window.refreshRekapAbsen) {
        window.refreshRekapAbsen();
      }
    } catch (error) {
      console.error('Error updating perizinan:', error);
      alert('Gagal mengupdate data perizinan: ' + error.message);
    }
  };

  const handleCloseEditDialog = () => {
    setEditDialog(false);
    setEditingPerizinan(null);
  };

  const handleSelectPerizinan = (id) => {
    setSelectedPerizinan(prev =>
      prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
    );
  };

  const handleSelectAllPerizinan = () => {
    if (selectedPerizinan.length === perizinanData.length) {
      setSelectedPerizinan([]);
    } else {
      setSelectedPerizinan(perizinanData.map(item => item.id));
    }
  };

  const handleDeleteSelectedPerizinan = async () => {
    if (selectedPerizinan.length === 0) return;
    if (confirm(`Hapus ${selectedPerizinan.length} data perizinan yang dipilih?`)) {
      try {
        // Delete selected perizinan records
        for (const id of selectedPerizinan) {
          await DatabaseService.delete(TABLES.PERIZINAN, id);
        }

        loadPerizinanData();
        setSelectedPerizinan([]);

        // Trigger refresh in RekapAbsen if available
        if (window.refreshRekapAbsen) {
          window.refreshRekapAbsen();
        }
      } catch (error) {
        console.error('Error deleting selected perizinan:', error);
        alert('Error deleting perizinan: ' + error.message);
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <Typography>Loading data perizinan...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Data Perizinan ({perizinanData.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {selectedPerizinan.length > 0 && (
            <Button
              variant="contained"
              color="error"
              size="small"
              onClick={handleDeleteSelectedPerizinan}
            >
              Hapus ({selectedPerizinan.length})
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            onClick={() => loadPerizinanData()}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper} sx={{ mb: 1, overflowX: 'auto' }}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={perizinanData.length > 0 && selectedPerizinan.length === perizinanData.length}
                  indeterminate={selectedPerizinan.length > 0 && selectedPerizinan.length < perizinanData.length}
                  onChange={handleSelectAllPerizinan}
                />
              </TableCell>
              <TableCell>Tanggal</TableCell>
              <TableCell>Tanggal Mulai</TableCell>
              <TableCell>Tanggal Selesai</TableCell>
              <TableCell>Nama</TableCell>
              <TableCell>Identifier</TableCell>
              <TableCell>Sebagai</TableCell>
              <TableCell>Jenis Izin</TableCell>
              <TableCell>Keterangan</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {perizinanData
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((row) => (
                <TableRow key={row.id}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedPerizinan.includes(row.id)}
                      onChange={() => handleSelectPerizinan(row.id)}
                    />
                  </TableCell>
                  <TableCell>{row.tanggal}</TableCell>
                  <TableCell>{row.tanggal_mulai || row.tanggal}</TableCell>
                  <TableCell>{row.tanggal_selesai || row.tanggal}</TableCell>
                  <TableCell>{row.nama}</TableCell>
                  <TableCell>{row.identifier}</TableCell>
                  <TableCell>{row.sebagai}</TableCell>
                  <TableCell>{row.jenis_izin}</TableCell>
                  <TableCell>{row.keterangan}</TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleEditPerizinan(row)}
                      sx={{ mr: 1 }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeletePerizinan(row.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            {perizinanData.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Belum ada data perizinan
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={perizinanData.length}
        page={page}
        onPageChange={(event, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(parseInt(event.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[10, 20, 50, 100]}
        labelRowsPerPage="Baris per halaman:"
        labelDisplayedRows={({ from, to, count }) =>
          `${from}-${to} dari ${count !== -1 ? count : `lebih dari ${to}`}`
        }
      />

      {/* Edit Dialog */}
      <Dialog open={editDialog} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Data Perizinan</DialogTitle>
        <DialogContent>
          <TextField
            label="Tanggal"
            type="date"
            value={editingPerizinan?.tanggal || ''}
            onChange={(e) => setEditingPerizinan({ ...editingPerizinan, tanggal: e.target.value })}
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Tanggal Mulai"
            type="date"
            value={editingPerizinan?.tanggal_mulai || editingPerizinan?.tanggal || ''}
            onChange={(e) => setEditingPerizinan({ ...editingPerizinan, tanggal_mulai: e.target.value })}
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
            helperText="Tanggal mulai izin/sakit/cuti"
          />
          <TextField
            label="Tanggal Selesai"
            type="date"
            value={editingPerizinan?.tanggal_selesai || editingPerizinan?.tanggal || ''}
            onChange={(e) => setEditingPerizinan({ ...editingPerizinan, tanggal_selesai: e.target.value })}
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
            helperText="Tanggal selesai izin/sakit/cuti"
          />
          <TextField
            label="Nama"
            value={editingPerizinan?.nama || ''}
            onChange={(e) => setEditingPerizinan({ ...editingPerizinan, nama: e.target.value })}
            fullWidth
            margin="dense"
          />
          <TextField
            label="Identifier"
            value={editingPerizinan?.identifier || ''}
            onChange={(e) => setEditingPerizinan({ ...editingPerizinan, identifier: e.target.value })}
            fullWidth
            margin="dense"
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Sebagai</InputLabel>
            <Select
              value={editingPerizinan?.sebagai || ''}
              onChange={(e) => setEditingPerizinan({ ...editingPerizinan, sebagai: e.target.value })}
              label="Sebagai"
            >
              <MenuItem value="Guru">Guru</MenuItem>
              <MenuItem value="Siswa">Siswa</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Jenis Izin</InputLabel>
            <Select
              value={editingPerizinan?.jenis_izin || ''}
              onChange={(e) => setEditingPerizinan({ ...editingPerizinan, jenis_izin: e.target.value })}
              label="Jenis Izin"
            >
              <MenuItem value="Izin">Izin</MenuItem>
              <MenuItem value="Sakit">Sakit</MenuItem>
              <MenuItem value="Dinas Luar">Dinas Luar</MenuItem>
              <MenuItem value="Cuti">Cuti</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Keterangan"
            value={editingPerizinan?.keterangan || ''}
            onChange={(e) => setEditingPerizinan({ ...editingPerizinan, keterangan: e.target.value })}
            fullWidth
            margin="dense"
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog}>Batal</Button>
          <Button onClick={handleUpdatePerizinan} variant="contained">Update</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DataPerizinan;