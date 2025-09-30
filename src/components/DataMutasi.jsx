import React, { useState, useEffect } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Tabs, Tab } from '@mui/material';
import { db } from '../database';

const DataMutasi = ({ mode }) => {
  const [tabValue, setTabValue] = useState(0);
  const [guruInactive, setGuruInactive] = useState([]);
  const [siswaInactive, setSiswaInactive] = useState([]);

  useEffect(() => {
    db.guru_inactive.toArray().then(data => setGuruInactive(data));
    db.siswa_inactive.toArray().then(data => setSiswaInactive(data));
  }, []);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleRestore = (table, id) => {
    if (table === 'guru') {
      db.guru_inactive.get(id).then(item => {
        if (item) {
          const activeItem = { ...item };
          delete activeItem.tanggal_keluar;
          delete activeItem.alasan;
          activeItem.status = 'active';

          Promise.all([
            db.guru.add(activeItem),
            db.guru_inactive.delete(id)
          ]).then(() => {
            db.guru_inactive.toArray().then(data => setGuruInactive(data));
            alert('Guru berhasil dikembalikan ke data aktif');
          });
        }
      });
    } else {
      db.siswa_inactive.get(id).then(item => {
        if (item) {
          const activeItem = { ...item };
          delete activeItem.tanggal_keluar;
          delete activeItem.alasan;
          activeItem.status = 'active';

          Promise.all([
            db.siswa.add(activeItem),
            db.siswa_inactive.delete(id)
          ]).then(() => {
            db.siswa_inactive.toArray().then(data => setSiswaInactive(data));
            alert('Siswa berhasil dikembalikan ke data aktif');
          });
        }
      });
    }
  };

  const handleDelete = (table, id) => {
    if (confirm('Hapus data ini secara permanen?')) {
      if (table === 'guru') {
        db.guru_inactive.delete(id).then(() => {
          db.guru_inactive.toArray().then(data => setGuruInactive(data));
        });
      } else {
        db.siswa_inactive.delete(id).then(() => {
          db.siswa_inactive.toArray().then(data => setSiswaInactive(data));
        });
      }
    }
  };

  const renderGuruInactive = () => (
    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
      <Table sx={{ minWidth: 650 }}>
        <TableHead>
          <TableRow>
            <TableCell>Nama</TableCell>
            <TableCell>NIY</TableCell>
            <TableCell>Jabatan</TableCell>
            <TableCell>Tanggal Keluar</TableCell>
            <TableCell>Alasan</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {guruInactive.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.nama}</TableCell>
              <TableCell>{row.niy}</TableCell>
              <TableCell>{row.jabatan}</TableCell>
              <TableCell>{row.tanggal_keluar}</TableCell>
              <TableCell>{row.alasan}</TableCell>
              <TableCell>
                <Button onClick={() => handleRestore('guru', row.id)}>Kembalikan</Button>
                <Button onClick={() => handleDelete('guru', row.id)} color="error">Hapus</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderSiswaInactive = () => (
    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
      <Table sx={{ minWidth: 650 }}>
        <TableHead>
          <TableRow>
            <TableCell>Nama</TableCell>
            <TableCell>NISN</TableCell>
            <TableCell>Jabatan</TableCell>
            <TableCell>Tanggal Keluar</TableCell>
            <TableCell>Alasan</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {siswaInactive.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.nama}</TableCell>
              <TableCell>{row.nisn}</TableCell>
              <TableCell>{row.jabatan}</TableCell>
              <TableCell>{row.tanggal_keluar}</TableCell>
              <TableCell>{row.alasan}</TableCell>
              <TableCell>
                <Button onClick={() => handleRestore('siswa', row.id)}>Kembalikan</Button>
                <Button onClick={() => handleDelete('siswa', row.id)} color="error">Hapus</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Data Mutasi/Keluar - Mode: {mode}
      </Typography>
      <Tabs value={tabValue} onChange={handleTabChange}>
        <Tab label="Guru Tidak Aktif" />
        <Tab label="Siswa Tidak Aktif" />
      </Tabs>
      {tabValue === 0 && renderGuruInactive()}
      {tabValue === 1 && renderSiswaInactive()}
    </Box>
  );
};

export default DataMutasi;