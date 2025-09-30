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
  Checkbox
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { db } from '../database';

const DataPerizinan = ({ mode }) => {
  const [perizinanData, setPerizinanData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState(false);
  const [editingPerizinan, setEditingPerizinan] = useState(null);
  const [selectedPerizinan, setSelectedPerizinan] = useState([]);

  useEffect(() => {
    // Register global refresh function
    window.refreshPerizinanData = loadPerizinanData;

    // Wait for database to be ready
    const checkDatabaseReady = () => {
      if (typeof db !== 'undefined' && db.perizinan) {
        loadPerizinanData();
      } else {
        setTimeout(checkDatabaseReady, 500);
      }
    };

    // Start checking after a short delay to ensure db is initialized
    setTimeout(checkDatabaseReady, 100);

    // Cleanup
    return () => {
      delete window.refreshPerizinanData;
    };
  }, []);

  const loadPerizinanData = () => {
    if (db && db.perizinan) {
      db.perizinan.orderBy('tanggal').reverse().toArray().then(data => {
        setPerizinanData(data);
        setLoading(false);
        setSelectedPerizinan([]); // Clear selections when data is refreshed
      }).catch(error => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  };

  const handleDeletePerizinan = (id) => {
    if (confirm('Hapus data perizinan ini?')) {
      db.perizinan.delete(id).then(() => {
        loadPerizinanData();

        // Trigger refresh in RekapAbsen if available
        if (window.refreshRekapAbsen) {
          window.refreshRekapAbsen();
        }
      });
    }
  };

  const handleEditPerizinan = (perizinan) => {
    setEditingPerizinan({ ...perizinan });
    setEditDialog(true);
  };

  const handleUpdatePerizinan = () => {
    if (!editingPerizinan) return;

    // Validate required fields
    if (!editingPerizinan.tanggal || !editingPerizinan.nama || !editingPerizinan.identifier || !editingPerizinan.sebagai || !editingPerizinan.jenis_izin) {
      alert('Semua field harus diisi!');
      return;
    }

    db.perizinan.update(editingPerizinan.id, editingPerizinan).then(() => {
      loadPerizinanData();
      setEditDialog(false);
      setEditingPerizinan(null);
      alert('Data perizinan berhasil diupdate!');

      // Trigger refresh in RekapAbsen if available
      if (window.refreshRekapAbsen) {
        window.refreshRekapAbsen();
      }
    }).catch(error => {
      console.error('Error updating perizinan:', error);
      alert('Gagal mengupdate data perizinan: ' + error.message);
    });
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

  const handleDeleteSelectedPerizinan = () => {
    if (selectedPerizinan.length === 0) return;
    if (confirm(`Hapus ${selectedPerizinan.length} data perizinan yang dipilih?`)) {
      Promise.all(selectedPerizinan.map(id => db.perizinan.delete(id))).then(() => {
        loadPerizinanData();
        setSelectedPerizinan([]);

        // Trigger refresh in RekapAbsen if available
        if (window.refreshRekapAbsen) {
          window.refreshRekapAbsen();
        }
      });
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

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
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
            {perizinanData.map((row) => (
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
                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Belum ada data perizinan
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

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