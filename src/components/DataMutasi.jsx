import React, { useState, useEffect } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Tabs, Tab, TablePagination } from '@mui/material';
import { db } from '../database';
import { DatabaseService, TABLES } from '../config/supabase';

const DataMutasi = ({ mode }) => {
  const [tabValue, setTabValue] = useState(0);
  const [guruInactive, setGuruInactive] = useState([]);
  const [siswaInactive, setSiswaInactive] = useState([]);

  // Pagination states
  const [guruPage, setGuruPage] = useState(0);
  const [guruRowsPerPage, setGuruRowsPerPage] = useState(20);
  const [siswaPage, setSiswaPage] = useState(0);
  const [siswaRowsPerPage, setSiswaRowsPerPage] = useState(20);

  useEffect(() => {
    const loadInactiveData = async () => {
      try {
        // For inactive data, we'll use direct database access since these are not in main Supabase tables
        const guruData = await db.guru_inactive.toArray();
        const siswaData = await db.siswa_inactive.toArray();
        setGuruInactive(guruData);
        setSiswaInactive(siswaData);
      } catch (error) {
        console.error('Error loading inactive data:', error);
      }
    };

    loadInactiveData();
  }, []);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleRestore = async (table, id) => {
    try {
      if (table === 'guru') {
        const item = await db.guru_inactive.get(id);
        if (item) {
          const activeItem = { ...item };
          delete activeItem.tanggal_keluar;
          delete activeItem.alasan;
          activeItem.status = 'active';

          // Add back to active table and remove from inactive
          await DatabaseService.create(TABLES.GURU, activeItem);
          await db.guru_inactive.delete(id);

          // Refresh data
          const data = await db.guru_inactive.toArray();
          setGuruInactive(data);
          alert('Guru berhasil dikembalikan ke data aktif');
        }
      } else {
        const item = await db.siswa_inactive.get(id);
        if (item) {
          const activeItem = { ...item };
          delete activeItem.tanggal_keluar;
          delete activeItem.alasan;
          activeItem.status = 'active';

          // Add back to active table and remove from inactive
          await DatabaseService.create(TABLES.SISWA, activeItem);
          await db.siswa_inactive.delete(id);

          // Refresh data
          const data = await db.siswa_inactive.toArray();
          setSiswaInactive(data);
          alert('Siswa berhasil dikembalikan ke data aktif');
        }
      }
    } catch (error) {
      console.error('Error restoring record:', error);
      alert('Error restoring record: ' + error.message);
    }
  };

  const handleDelete = async (table, id) => {
    try {
      if (confirm('Hapus data ini secara permanen?')) {
        if (table === 'guru') {
          await db.guru_inactive.delete(id);
          const data = await db.guru_inactive.toArray();
          setGuruInactive(data);
        } else {
          await db.siswa_inactive.delete(id);
          const data = await db.siswa_inactive.toArray();
          setSiswaInactive(data);
        }
      }
    } catch (error) {
      console.error('Error deleting inactive record:', error);
      alert('Error deleting record: ' + error.message);
    }
  };

  const renderGuruInactive = () => (
    <Box>
      <TableContainer component={Paper} sx={{ mb: 1, overflowX: 'auto' }}>
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
            {guruInactive
              .slice(guruPage * guruRowsPerPage, guruPage * guruRowsPerPage + guruRowsPerPage)
              .map((row) => (
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
      <TablePagination
        component="div"
        count={guruInactive.length}
        page={guruPage}
        onPageChange={(event, newPage) => setGuruPage(newPage)}
        rowsPerPage={guruRowsPerPage}
        onRowsPerPageChange={(event) => {
          setGuruRowsPerPage(parseInt(event.target.value, 10));
          setGuruPage(0);
        }}
        rowsPerPageOptions={[10, 20, 50, 100]}
        labelRowsPerPage="Baris per halaman:"
        labelDisplayedRows={({ from, to, count }) =>
          `${from}-${to} dari ${count !== -1 ? count : `lebih dari ${to}`}`
        }
      />
    </Box>
  );

  const renderSiswaInactive = () => (
    <Box>
      <TableContainer component={Paper} sx={{ mb: 1, overflowX: 'auto' }}>
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
            {siswaInactive
              .slice(siswaPage * siswaRowsPerPage, siswaPage * siswaRowsPerPage + siswaRowsPerPage)
              .map((row) => (
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
      <TablePagination
        component="div"
        count={siswaInactive.length}
        page={siswaPage}
        onPageChange={(event, newPage) => setSiswaPage(newPage)}
        rowsPerPage={siswaRowsPerPage}
        onRowsPerPageChange={(event) => {
          setSiswaRowsPerPage(parseInt(event.target.value, 10));
          setSiswaPage(0);
        }}
        rowsPerPageOptions={[10, 20, 50, 100]}
        labelRowsPerPage="Baris per halaman:"
        labelDisplayedRows={({ from, to, count }) =>
          `${from}-${to} dari ${count !== -1 ? count : `lebih dari ${to}`}`
        }
      />
    </Box>
  );

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>
          Data Mutasi/Keluar - Mode: {mode}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => window.open('/database', '_blank')}
          sx={{ ml: 2 }}
        >
          👁️ Lihat Database Utama
        </Button>
      </Box>
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