import React from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Avatar,
  Paper
} from '@mui/material';
import {
  Login as LoginIcon,
  Logout as LogoutIcon,
  Schedule as ScheduleIcon,
  School as SchoolIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const Presensi = () => {
  const navigate = useNavigate();

  const handleAbsenDatang = () => {
    navigate('/absensi?type=datang');
  };

  const handleAbsenPulang = () => {
    navigate('/absensi?type=pulang');
  };

  const handleAbsenCepat = () => {
    navigate('/absensi?type=pulang_cepat');
  };

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4,
          background: 'linear-gradient(135deg, #36aec1 0%, #2d9aa8 100%)'
        }}
      >
        <Paper
          elevation={8}
          sx={{
            width: '100%',
            maxWidth: 600,
            borderRadius: 3,
            overflow: 'hidden'
          }}
        >
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  mb: 4
                }}
              >
                <Avatar
                  sx={{
                    m: 1,
                    bgcolor: 'primary.main',
                    width: 64,
                    height: 64
                  }}
                >
                  <ScheduleIcon fontSize="large" />
                </Avatar>
                <Typography component="h1" variant="h3" gutterBottom>
                  PRESENSI
                </Typography>
                <Typography variant="h6" color="text.secondary" align="center">
                  Sistem Absensi Sekolah
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                  Pilih jenis presensi yang akan dilakukan
                </Typography>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={4}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={handleAbsenDatang}
                    sx={{
                      py: 3,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      bgcolor: 'success.main',
                      '&:hover': {
                        bgcolor: 'success.dark'
                      }
                    }}
                  >
                    <LoginIcon sx={{ fontSize: 32 }} />
                    <Typography variant="h6">
                      ABSEN DATANG
                    </Typography>
                    <Typography variant="caption">
                      Check-in kehadiran
                    </Typography>
                  </Button>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={handleAbsenPulang}
                    sx={{
                      py: 3,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      bgcolor: 'warning.main',
                      '&:hover': {
                        bgcolor: 'warning.dark'
                      }
                    }}
                  >
                    <LogoutIcon sx={{ fontSize: 32 }} />
                    <Typography variant="h6">
                      ABSEN PULANG
                    </Typography>
                    <Typography variant="caption">
                      Check-out pulang
                    </Typography>
                  </Button>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={handleAbsenCepat}
                    sx={{
                      py: 3,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      bgcolor: 'info.main',
                      '&:hover': {
                        bgcolor: 'info.dark'
                      }
                    }}
                  >
                    <LogoutIcon sx={{ fontSize: 32 }} />
                    <Typography variant="h6">
                      PULANG CEPAT
                    </Typography>
                    <Typography variant="caption">
                      Izin pulang lebih awal
                    </Typography>
                  </Button>
                </Grid>
              </Grid>

              <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/')}
                  startIcon={<SchoolIcon />}
                  sx={{ mt: 2 }}
                >
                  Kembali ke Dashboard
                </Button>
              </Box>

              <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary" align="center">
                  <strong>Cara Penggunaan:</strong><br />
                  1. Pilih jenis presensi sesuai kebutuhan<br />
                  2. Sistem akan redirect ke halaman scan barcode<br />
                  3. Scan barcode/NIK yang terdaftar dalam sistem<br />
                  4. Data presensi akan tersimpan otomatis
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Paper>
      </Box>
    </Container>
  );
};

export default Presensi;