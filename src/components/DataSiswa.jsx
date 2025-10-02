import React, { useState, useEffect } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, TablePagination, InputAdornment } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import QRCode from 'qrcode';
import { db } from '../database';
import { DatabaseService, TABLES } from '../config/supabase';

const DataSiswa = ({ mode }) => {
  const [data, setData] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nama: '', nisn: '', jabatan: '', sebagai: '', email: '', wa: '' });
  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState('');
  const [selected, setSelected] = useState([]);
  const [exitDialog, setExitDialog] = useState(false);
  const [exitForm, setExitForm] = useState({ alasan: '', tanggal_keluar: '' });
  const [classFilter, setClassFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredData, setFilteredData] = useState([]);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  useEffect(() => {
    const loadSiswaData = async () => {
      try {
        const siswaData = await DatabaseService.getSiswa(true);
        setData(siswaData);
        setFilteredData(siswaData);
      } catch (error) {
        console.error('Error loading siswa data:', error);
        setData([]);
        setFilteredData([]);
      }
    };

    loadSiswaData();
  }, []);

  useEffect(() => {
    let filtered = data;

    // Apply class filter
    if (classFilter) {
      filtered = filtered.filter(item => item.jabatan === classFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.nama?.toLowerCase().includes(searchLower) ||
        item.nisn?.toLowerCase().includes(searchLower) ||
        item.jabatan?.toLowerCase().includes(searchLower) ||
        item.email?.toLowerCase().includes(searchLower) ||
        item.wa?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredData(filtered);
  }, [classFilter, searchTerm, data]);

  const handleOpen = (item = null) => {
    setEditing(item);
    setForm(item || { nama: '', nisn: '', jabatan: '', sebagai: 'Siswa', email: '', wa: '' });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditing(null);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await DatabaseService.update(TABLES.SISWA, editing.id, form);
        setData(data.map(item => item.id === editing.id ? { ...form, id: editing.id } : item));
      } else {
        const result = await DatabaseService.create(TABLES.SISWA, form);
        setData([...data, { ...form, id: result.id }]);
      }
      handleClose();
    } catch (error) {
      console.error('Error saving siswa:', error);
      alert('Error saving siswa: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await DatabaseService.delete(TABLES.SISWA, id);
      setData(data.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error deleting siswa:', error);
      alert('Error deleting siswa: ' + error.message);
    }
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelected(data.map(item => item.id));
    } else {
      setSelected([]);
    }
  };

  const handleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleExit = () => {
    if (selected.length === 0) return;
    setExitDialog(true);
  };

  const handleExitConfirm = async () => {
    try {
      const exitData = data.filter(item => selected.includes(item.id));
      const inactiveData = exitData.map(item => ({
        nama: item.nama,
        nisn: item.nisn,
        jabatan: item.jabatan,
        sebagai: item.sebagai,
        email: item.email,
        wa: item.wa,
        status: 'exit',
        tanggal_keluar: exitForm.tanggal_keluar,
        alasan: exitForm.alasan,
        created_at: item.created_at,
        updated_at: new Date().toISOString()
      }));

      // Update selected students to exit status and add to inactive table
      for (const id of selected) {
        await DatabaseService.update(TABLES.SISWA, id, { status: 'exit' });
      }

      // Add to inactive table using direct database access (since inactive tables aren't in Supabase)
      if (inactiveData.length > 0) {
        const { db } = await import('../database.js');
        await db.siswa_inactive.bulkAdd(inactiveData);
      }

      // Refresh data
      const siswaData = await DatabaseService.getSiswa(true);
      setData(siswaData);
      setSelected([]);
      setExitDialog(false);
      setExitForm({ alasan: '', tanggal_keluar: '' });
      alert(`${selected.length} siswa berhasil dipindahkan ke data tidak aktif`);
    } catch (error) {
      console.error('Error in exit operation:', error);
      alert('Error in exit operation: ' + error.message);
    }
  };

  const handleDeleteSelected = async () => {
    if (selected.length === 0) return;
    if (confirm(`Hapus ${selected.length} siswa yang dipilih?`)) {
      try {
        // Delete selected students
        for (const id of selected) {
          await DatabaseService.delete(TABLES.SISWA, id);
        }

        // Refresh data
        const siswaData = await DatabaseService.getSiswa(true);
        setData(siswaData);
        setSelected([]);
        alert(`${selected.length} siswa berhasil dihapus`);
      } catch (error) {
        console.error('Error deleting selected siswa:', error);
        alert('Error deleting siswa: ' + error.message);
      }
    }
  };

  const handleGenerateQR = async (nisn) => {
    try {
      const url = await QRCode.toDataURL(nisn);
      setQrData(url);
      setQrOpen(true);
    } catch (err) {
      console.error(err);
    }
  };


  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Data Siswa - Mode: {mode}
      </Typography>
      <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          label="🔍 Cari Siswa"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari nama, NISN, kelas, email..."
          sx={{ minWidth: 250 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          label="Filter Kelas"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">Semua Kelas</MenuItem>
          {[...new Set(data.map(item => item.jabatan))].map((kelas, index) => (
            <MenuItem key={`${kelas}-${index}`} value={kelas}>{kelas}</MenuItem>
          ))}
        </TextField>
        <Button
          variant="outlined"
          onClick={() => window.open('/data-mutasi', '_blank')}
          sx={{ ml: 2 }}
        >
          👁️ Lihat Data Mutasi
        </Button>
      </Box>
      <TableContainer component={Paper} sx={{ mb: 1, overflowX: 'auto' }}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <input type="checkbox" onChange={handleSelectAll} checked={filteredData.length > 0 && selected.length === filteredData.length} />
              </TableCell>
              <TableCell>Nama</TableCell>
              <TableCell>NISN</TableCell>
              <TableCell>Jabatan</TableCell>
              <TableCell>Sebagai</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>WA</TableCell>
              <TableCell>Actions</TableCell>
              <TableCell>QR</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((row) => (
                <TableRow key={row.id}>
                  <TableCell padding="checkbox">
                    <input type="checkbox" checked={selected.includes(row.id)} onChange={() => handleSelect(row.id)} />
                  </TableCell>
                  <TableCell>{row.nama}</TableCell>
                  <TableCell>{row.nisn}</TableCell>
                  <TableCell>{row.jabatan}</TableCell>
                  <TableCell>{row.sebagai}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.wa}</TableCell>
                  <TableCell>
                    <Button onClick={() => handleOpen(row)}>Edit</Button>
                    <Button onClick={() => handleDelete(row.id)}>Delete</Button>
                  </TableCell>
                  <TableCell>
                    <Button onClick={() => handleGenerateQR(row.nisn)}>Generate QR</Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={filteredData.length}
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
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editing ? 'Edit' : 'Add'} Siswa</DialogTitle>
        <DialogContent>
          <TextField label="Nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} fullWidth margin="normal" />
          <TextField label="NISN" value={form.nisn} onChange={(e) => setForm({ ...form, nisn: e.target.value })} fullWidth margin="normal" />
          <TextField label="Jabatan" value={form.jabatan} onChange={(e) => setForm({ ...form, jabatan: e.target.value })} fullWidth margin="normal" />
          <TextField label="Sebagai" value={form.sebagai} onChange={(e) => setForm({ ...form, sebagai: e.target.value })} fullWidth margin="normal" disabled />
          <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth margin="normal" />
          <TextField label="WA" value={form.wa} onChange={(e) => setForm({ ...form, wa: e.target.value })} fullWidth margin="normal" />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={qrOpen} onClose={() => setQrOpen(false)}>
        <DialogTitle>QR Code</DialogTitle>
        <DialogContent>
          <img src={qrData} alt="QR Code" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={exitDialog} onClose={() => setExitDialog(false)}>
        <DialogTitle>Keluar/Mutasi Siswa</DialogTitle>
        <DialogContent>
          <TextField
            label="Tanggal Keluar"
            type="date"
            value={exitForm.tanggal_keluar}
            onChange={(e) => setExitForm({ ...exitForm, tanggal_keluar: e.target.value })}
            fullWidth
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Alasan"
            value={exitForm.alasan}
            onChange={(e) => setExitForm({ ...exitForm, alasan: e.target.value })}
            fullWidth
            margin="normal"
            select
          >
            <MenuItem value="keluar">Keluar</MenuItem>
            <MenuItem value="mutasi">Mutasi</MenuItem>
            <MenuItem value="lulus">Lulus</MenuItem>
            <MenuItem value="lainnya">Lainnya</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExitDialog(false)}>Cancel</Button>
          <Button onClick={handleExitConfirm} color="error">Konfirmasi</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DataSiswa;