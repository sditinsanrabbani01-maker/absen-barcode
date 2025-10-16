import React, { useState, useEffect } from 'react';
import { Box, Grid, Card, CardContent, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem, Tabs, Tab } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import EventIcon from '@mui/icons-material/Event';
import SchoolIcon from '@mui/icons-material/School';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SettingsIcon from '@mui/icons-material/Settings';
import { db } from '../database';

const Dashboard = ({ mode }) => {
  const [stats, setStats] = useState([
    { title: 'Total Users', value: '0', icon: <PeopleIcon />, color: '#1976d2' },
    { title: 'Students', value: '0', icon: <SchoolIcon />, color: '#2e7d32' },
    { title: 'Teachers', value: '0', icon: <SchoolIcon />, color: '#f57c00' },
    { title: 'Today\'s Attendance', value: '0', icon: <EventIcon />, color: '#388e3c' },
    { title: 'Payroll Items', value: '0', icon: <AccountBalanceIcon />, color: '#7b1fa2' },
  ]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState({
    nama_sekolah: '',
    npsn: '',
    alamat_desa: '',
    alamat_kecamatan: '',
    alamat_kabupaten: '',
    alamat_provinsi: '',
    alamat_negara: '',
    nama_kepala_sekolah: '',
    niy_kepala_sekolah: ''
  });

  useEffect(() => {
    loadDashboardData();
    loadSchoolSettings();
  }, []);

  const loadDashboardData = () => {
    const today = new Date().toISOString().split('T')[0];

    Promise.all([
      db.guru.where('status').equals('active').count(),
      db.siswa.where('status').equals('active').count(),
      db.attendance.where('tanggal').equals(today).count(),
      db.penggajian.count()
    ]).then(([guruCount, siswaCount, attendanceCount, payrollCount]) => {
      const totalUsers = guruCount + siswaCount;
      setStats([
        { title: 'Total Users', value: totalUsers.toString(), icon: <PeopleIcon />, color: '#1976d2' },
        { title: 'Students', value: siswaCount.toString(), icon: <SchoolIcon />, color: '#2e7d32' },
        { title: 'Teachers', value: guruCount.toString(), icon: <SchoolIcon />, color: '#f57c00' },
        { title: 'Today\'s Attendance', value: attendanceCount.toString(), icon: <EventIcon />, color: '#388e3c' },
        { title: 'Payroll Items', value: payrollCount.toString(), icon: <AccountBalanceIcon />, color: '#7b1fa2' },
      ]);
    });
  };

  const loadSchoolSettings = () => {
    db.school_settings.toCollection().first().then(settings => {
      if (settings) {
        setSchoolSettings(settings);
      }
    });
  };

  const saveSchoolSettings = () => {
    db.school_settings.toCollection().first().then(existing => {
      if (existing) {
        db.school_settings.update(existing.id, schoolSettings).then(() => {
          setSettingsOpen(false);
          alert('Pengaturan sekolah berhasil disimpan!');
        });
      } else {
        db.school_settings.add(schoolSettings).then(() => {
          setSettingsOpen(false);
          alert('Pengaturan sekolah berhasil disimpan!');
        });
      }
    });
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 3,
        backgroundColor: 'white',
        p: 2,
        borderRadius: 2,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <Box sx={{ textAlign: 'center', flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#36aec1' }}>
            Dashboard - Mode: {mode}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Sistem INGAT WAKTU - Ringkasan Data Real-time
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<SettingsIcon />}
          onClick={() => setSettingsOpen(true)}
          sx={{
            borderColor: '#36aec1',
            color: '#36aec1',
            '&:hover': {
              borderColor: '#2d9aa8',
              backgroundColor: '#e0f7fa'
            }
          }}
        >
          Pengaturan Sekolah
        </Button>
      </Box>

      <Grid container spacing={3}>
        {stats.map((stat, index) => (
          <Grid item key={index} xs={12} sm={6} md={4} lg={2.4}>
            <Card
              sx={{
                height: '100%',
                backgroundColor: 'white',
                borderRadius: 3,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
                },
                border: `2px solid ${stat.color}20`,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  backgroundColor: stat.color
                }}
              />
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography
                      variant="h4"
                      component="div"
                      sx={{
                        fontWeight: 'bold',
                        color: stat.color,
                        mb: 0.5
                      }}
                    >
                      {stat.value}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: '#666',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        fontSize: '0.75rem'
                      }}
                    >
                      {stat.title}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      backgroundColor: `${stat.color}15`,
                      borderRadius: '50%',
                      p: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Box sx={{ color: stat.color, fontSize: 28 }}>
                      {stat.icon}
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 4, backgroundColor: 'white', p: 3, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#36aec1' }}>
          📊 Quick Stats Summary
        </Typography>
        <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {stats.slice(0, 3).map((stat, index) => (
            <Box key={index} sx={{ textAlign: 'center', minWidth: 120 }}>
              <Typography variant="h6" sx={{ color: stat.color, fontWeight: 'bold' }}>
                {stat.value}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stat.title}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* School Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#36aec1', color: 'white', fontWeight: 'bold' }}>
          🏫 Pengaturan Identitas Sekolah
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Nama Sekolah"
              value={schoolSettings.nama_sekolah}
              onChange={(e) => setSchoolSettings({ ...schoolSettings, nama_sekolah: e.target.value })}
              placeholder="Contoh: SMA Negeri 1 Makassar"
            />

            <TextField
              fullWidth
              label="NPSN (Nomor Pokok Sekolah Nasional)"
              value={schoolSettings.npsn}
              onChange={(e) => setSchoolSettings({ ...schoolSettings, npsn: e.target.value })}
              placeholder="Contoh: 40300123"
            />

            <Typography variant="h6" sx={{ mt: 2, mb: 1, color: '#36aec1' }}>
              📍 Alamat Lengkap
            </Typography>

            <TextField
              fullWidth
              label="Desa/Kelurahan"
              value={schoolSettings.alamat_desa}
              onChange={(e) => setSchoolSettings({ ...schoolSettings, alamat_desa: e.target.value })}
              placeholder="Contoh: Bontoala"
            />

            <TextField
              fullWidth
              label="Kecamatan"
              value={schoolSettings.alamat_kecamatan}
              onChange={(e) => setSchoolSettings({ ...schoolSettings, alamat_kecamatan: e.target.value })}
              placeholder="Contoh: Bontoala"
            />

            <TextField
              fullWidth
              label="Kabupaten/Kota"
              value={schoolSettings.alamat_kabupaten}
              onChange={(e) => setSchoolSettings({ ...schoolSettings, alamat_kabupaten: e.target.value })}
              placeholder="Contoh: Kota Makassar"
            />

            <FormControl fullWidth>
              <InputLabel>Provinsi</InputLabel>
              <Select
                value={schoolSettings.alamat_provinsi}
                onChange={(e) => setSchoolSettings({ ...schoolSettings, alamat_provinsi: e.target.value })}
                label="Provinsi"
              >
                <MenuItem value="Aceh">Aceh</MenuItem>
                <MenuItem value="Sumatera Utara">Sumatera Utara</MenuItem>
                <MenuItem value="Sumatera Barat">Sumatera Barat</MenuItem>
                <MenuItem value="Riau">Riau</MenuItem>
                <MenuItem value="Jambi">Jambi</MenuItem>
                <MenuItem value="Sumatera Selatan">Sumatera Selatan</MenuItem>
                <MenuItem value="Bengkulu">Bengkulu</MenuItem>
                <MenuItem value="Lampung">Lampung</MenuItem>
                <MenuItem value="Kepulauan Bangka Belitung">Kepulauan Bangka Belitung</MenuItem>
                <MenuItem value="Kepulauan Riau">Kepulauan Riau</MenuItem>
                <MenuItem value="DKI Jakarta">DKI Jakarta</MenuItem>
                <MenuItem value="Jawa Barat">Jawa Barat</MenuItem>
                <MenuItem value="Jawa Tengah">Jawa Tengah</MenuItem>
                <MenuItem value="DI Yogyakarta">DI Yogyakarta</MenuItem>
                <MenuItem value="Jawa Timur">Jawa Timur</MenuItem>
                <MenuItem value="Banten">Banten</MenuItem>
                <MenuItem value="Bali">Bali</MenuItem>
                <MenuItem value="Nusa Tenggara Timur">Nusa Tenggara Timur</MenuItem>
                <MenuItem value="Nusa Tenggara Barat">Nusa Tenggara Barat</MenuItem>
                <MenuItem value="Kalimantan Barat">Kalimantan Barat</MenuItem>
                <MenuItem value="Kalimantan Tengah">Kalimantan Tengah</MenuItem>
                <MenuItem value="Kalimantan Selatan">Kalimantan Selatan</MenuItem>
                <MenuItem value="Kalimantan Timur">Kalimantan Timur</MenuItem>
                <MenuItem value="Kalimantan Utara">Kalimantan Utara</MenuItem>
                <MenuItem value="Sulawesi Utara">Sulawesi Utara</MenuItem>
                <MenuItem value="Sulawesi Tengah">Sulawesi Tengah</MenuItem>
                <MenuItem value="Sulawesi Selatan">Sulawesi Selatan</MenuItem>
                <MenuItem value="Sulawesi Tenggara">Sulawesi Tenggara</MenuItem>
                <MenuItem value="Gorontalo">Gorontalo</MenuItem>
                <MenuItem value="Sulawesi Barat">Sulawesi Barat</MenuItem>
                <MenuItem value="Maluku">Maluku</MenuItem>
                <MenuItem value="Maluku Utara">Maluku Utara</MenuItem>
                <MenuItem value="Papua Barat">Papua Barat</MenuItem>
                <MenuItem value="Papua">Papua</MenuItem>
                <MenuItem value="Papua Tengah">Papua Tengah</MenuItem>
                <MenuItem value="Papua Pegunungan">Papua Pegunungan</MenuItem>
                <MenuItem value="Papua Selatan">Papua Selatan</MenuItem>
                <MenuItem value="Papua Barat Daya">Papua Barat Daya</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Negara</InputLabel>
              <Select
                value={schoolSettings.alamat_negara}
                onChange={(e) => setSchoolSettings({ ...schoolSettings, alamat_negara: e.target.value })}
                label="Negara"
              >
                <MenuItem value="Indonesia">Indonesia</MenuItem>
                <MenuItem value="Malaysia">Malaysia</MenuItem>
                <MenuItem value="Singapura">Singapura</MenuItem>
                <MenuItem value="Brunei">Brunei</MenuItem>
                <MenuItem value="Filipina">Filipina</MenuItem>
                <MenuItem value="Thailand">Thailand</MenuItem>
                <MenuItem value="Vietnam">Vietnam</MenuItem>
                <MenuItem value="Myanmar">Myanmar</MenuItem>
                <MenuItem value="Kamboja">Kamboja</MenuItem>
                <MenuItem value="Laos">Laos</MenuItem>
              </Select>
            </FormControl>

            <Typography variant="h6" sx={{ mt: 2, mb: 1, color: '#36aec1' }}>
              👨‍🏫 Kepala Sekolah
            </Typography>

            <TextField
              fullWidth
              label="Nama Kepala Sekolah"
              value={schoolSettings.nama_kepala_sekolah}
              onChange={(e) => setSchoolSettings({ ...schoolSettings, nama_kepala_sekolah: e.target.value })}
              placeholder="Contoh: Dr. H. Ahmad Yani, M.Pd."
            />

            <TextField
              fullWidth
              label="NIY Kepala Sekolah"
              value={schoolSettings.niy_kepala_sekolah}
              onChange={(e) => setSchoolSettings({ ...schoolSettings, niy_kepala_sekolah: e.target.value })}
              placeholder="Contoh: 197001011990011001"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Batal</Button>
          <Button onClick={saveSchoolSettings} variant="contained" color="primary">
            Simpan Pengaturan
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;