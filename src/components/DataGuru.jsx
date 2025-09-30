import React, { useState, useEffect } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem } from '@mui/material';
import QRCode from 'qrcode';
import { db } from '../database';

const DataGuru = ({ mode }) => {
  const [data, setData] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nama: '', niy: '', jabatan: '', sebagai: '', email: '', wa: '' });
  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState('');
  const [selected, setSelected] = useState([]);
  const [exitDialog, setExitDialog] = useState(false);
  const [exitForm, setExitForm] = useState({ alasan: '', tanggal_keluar: '' });
  const [subjectFilter, setSubjectFilter] = useState('');
  const [filteredData, setFilteredData] = useState([]);

  useEffect(() => {
    db.guru.where('status').equals('active').sortBy('nama').then(guruData => {
      setData(guruData);
      setFilteredData(guruData);
    }).catch(err => {
      console.error('Error loading guru data:', err);
      setData([]);
      setFilteredData([]);
    });
  }, []);

  useEffect(() => {
    if (subjectFilter) {
      setFilteredData(data.filter(item => item.jabatan === subjectFilter));
    } else {
      setFilteredData(data);
    }
  }, [subjectFilter, data]);

  const handleOpen = (item = null) => {
    setEditing(item);
    setForm(item || { nama: '', niy: '', jabatan: '', sebagai: 'Guru', email: '', wa: '' });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (editing) {
      db.guru.update(editing.id, form).then(() => {
        setData(data.map(item => item.id === editing.id ? { ...form, id: editing.id } : item));
      });
    } else {
      db.guru.add(form).then(id => {
        setData([...data, { ...form, id }]);
      });
    }
    handleClose();
  };

  const handleDelete = (id) => {
    db.guru.delete(id).then(() => {
      setData(data.filter(item => item.id !== id));
    });
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelected(filteredData.map(item => item.id));
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

  const handleExitConfirm = () => {
    const exitData = data.filter(item => selected.includes(item.id));
    const inactiveData = exitData.map(item => ({
      ...item,
      status: 'exit',
      tanggal_keluar: exitForm.tanggal_keluar,
      alasan: exitForm.alasan
    }));

    Promise.all([
      db.guru.where('id').anyOf(selected).modify({ status: 'exit' }),
      db.guru_inactive.bulkAdd(inactiveData)
    ]).then(() => {
      db.guru.where('status').equals('active').sortBy('nama').then(guruData => setData(guruData));
      setSelected([]);
      setExitDialog(false);
      setExitForm({ alasan: '', tanggal_keluar: '' });
      alert(`${selected.length} guru berhasil dipindahkan ke data tidak aktif`);
    });
  };

  const handleDeleteSelected = () => {
    if (selected.length === 0) return;
    if (confirm(`Hapus ${selected.length} guru yang dipilih?`)) {
      db.guru.where('id').anyOf(selected).delete().then(() => {
        db.guru.where('status').equals('active').sortBy('nama').then(guruData => setData(guruData));
        setSelected([]);
        alert(`${selected.length} guru berhasil dihapus`);
      });
    }
  };

  const handleGenerateQR = async (niy) => {
    try {
      const url = await QRCode.toDataURL(niy);
      setQrData(url);
      setQrOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Data Guru - Mode: {mode}
      </Typography>
      <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          select
          label="Filter Mata Pelajaran"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">Semua Mata Pelajaran</MenuItem>
          {[...new Set(data.map(item => item.jabatan))].map((subject, index) => (
            <MenuItem key={`${subject}-${index}`} value={subject}>{subject}</MenuItem>
          ))}
        </TextField>
        {selected.length > 0 && (
          <>
            <Button variant="contained" color="error" onClick={handleExit}>
              Keluar/Mutasi ({selected.length})
            </Button>
            <Button variant="outlined" color="error" onClick={handleDeleteSelected}>
              Hapus ({selected.length})
            </Button>
          </>
        )}
      </Box>
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <input type="checkbox" onChange={handleSelectAll} checked={filteredData.length > 0 && selected.length === filteredData.length} />
              </TableCell>
              <TableCell>Nama</TableCell>
              <TableCell>NIY</TableCell>
              <TableCell>Jabatan</TableCell>
              <TableCell>Sebagai</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>WA</TableCell>
              <TableCell>Actions</TableCell>
              <TableCell>QR</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData.map((row) => (
              <TableRow key={row.id}>
                <TableCell padding="checkbox">
                  <input type="checkbox" checked={selected.includes(row.id)} onChange={() => handleSelect(row.id)} />
                </TableCell>
                <TableCell>{row.nama}</TableCell>
                <TableCell>{row.niy}</TableCell>
                <TableCell>{row.jabatan}</TableCell>
                <TableCell>{row.sebagai}</TableCell>
                <TableCell>{row.email}</TableCell>
                <TableCell>{row.wa}</TableCell>
                <TableCell>
                  <Button onClick={() => handleOpen(row)}>Edit</Button>
                  <Button onClick={() => handleDelete(row.id)}>Delete</Button>
                </TableCell>
                <TableCell>
                  <Button onClick={() => handleGenerateQR(row.niy)}>Generate QR</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editing ? 'Edit' : 'Add'} Guru</DialogTitle>
        <DialogContent>
          <TextField label="Nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} fullWidth margin="normal" />
          <TextField label="NIY" value={form.niy} onChange={(e) => setForm({ ...form, niy: e.target.value })} fullWidth margin="normal" />
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
        <DialogTitle>Keluar/Mutasi Guru</DialogTitle>
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
            <MenuItem value="pensiun">Pensiun</MenuItem>
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

export default DataGuru;