import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Avatar,
  Chip
} from '@mui/material';
import { Star, EmojiEvents, TrendingUp, Whatshot } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const BintangKu = ({ mode }) => {
  const navigate = useNavigate();

  const handleSiGesitClick = () => {
    navigate('/si-gesit');
  };

  const handleSiSantuyClick = () => {
    navigate('/si-santuy');
  };

  const handleSiGesitStandalone = () => {
    window.open('/si-gesit-standalone', '_blank');
  };

  const handleSiSantuyStandalone = () => {
    window.open('/si-santuy-standalone', '_blank');
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        ⭐ BintangKu - Sistem Perangkingan Kehadiran
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Pilih jenis perangkingan kehadiran yang ingin Anda lihat
      </Typography>

      <Grid container spacing={4}>
        {/* Si Gesit Card */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: '100%',
              background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
              color: 'white',
              cursor: 'pointer',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: '0 12px 25px rgba(76, 175, 80, 0.3)'
              }
            }}
            onClick={handleSiGesitClick}
          >
            <CardContent sx={{ textAlign: 'center', p: 4 }}>
              <Avatar
                sx={{
                  width: 120,
                  height: 120,
                  mx: 'auto',
                  mb: 3,
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  fontSize: '3rem'
                }}
              >
                🏆
              </Avatar>

              <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                Si Gesit
              </Typography>

              <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
                🏅 Peringkat Terbaik Kehadiran
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Chip
                  label="✨ Kedisiplinan Tinggi"
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    mr: 1,
                    mb: 1
                  }}
                />
                <Chip
                  label="⏰ Tepat Waktu"
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    mr: 1,
                    mb: 1
                  }}
                />
                <Chip
                  label="📊 Performa Terbaik"
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    mb: 1
                  }}
                />
              </Box>

              <Typography variant="body1" sx={{ mb: 3, opacity: 0.8 }}>
                Peringkat untuk mereka yang paling disiplin dalam kehadiran,
                tepat waktu datang, dan memiliki performa kehadiran terbaik.
              </Typography>

              <Button
                variant="contained"
                size="large"
                sx={{
                  bgcolor: 'white',
                  color: '#4caf50',
                  fontWeight: 'bold',
                  px: 4,
                  py: 1.5,
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    transform: 'scale(1.05)'
                  }
                }}
                startIcon={<EmojiEvents />}
              >
                Lihat Si Gesit
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Si Santuy Card */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: '100%',
              background: 'linear-gradient(135deg, #424242 0%, #616161 100%)',
              color: 'white',
              cursor: 'pointer',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: '0 12px 25px rgba(66, 66, 66, 0.3)'
              }
            }}
            onClick={handleSiSantuyClick}
          >
            <CardContent sx={{ textAlign: 'center', p: 4 }}>
              <Avatar
                sx={{
                  width: 120,
                  height: 120,
                  mx: 'auto',
                  mb: 3,
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  fontSize: '3rem'
                }}
              >
                😎
              </Avatar>

              <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                Si Santuy
              </Typography>

              <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
                🌙 Peringkat Terburuk Kehadiran
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Chip
                  label="😴 Santai Banget"
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    mr: 1,
                    mb: 1
                  }}
                />
                <Chip
                  label="⏰ Datang Terlambat"
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    mr: 1,
                    mb: 1
                  }}
                />
                <Chip
                  label="📉 Performa Terendah"
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    mb: 1
                  }}
                />
              </Box>

              <Typography variant="body1" sx={{ mb: 3, opacity: 0.8 }}>
                Peringkat untuk mereka yang paling santai dalam kehadiran,
                sering izin/sakit, TK, atau datang terlambat.
              </Typography>

              <Button
                variant="contained"
                size="large"
                sx={{
                  bgcolor: '#ff6b35',
                  color: 'white',
                  fontWeight: 'bold',
                  px: 4,
                  py: 1.5,
                  '&:hover': {
                    bgcolor: '#ff5722',
                    transform: 'scale(1.05)'
                  }
                }}
                startIcon={<Whatshot />}
              >
                Lihat Si Santuy
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Standalone Links Section */}
      <Card sx={{ mt: 4, bgcolor: 'grey.50' }}>
        <CardContent>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            🔗 Link Standalone
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Link khusus untuk acara atau presentasi dengan efek surprise
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Button
                variant="outlined"
                fullWidth
                onClick={handleSiGesitStandalone}
                startIcon={<Star />}
                sx={{
                  py: 2,
                  borderColor: '#4caf50',
                  color: '#4caf50',
                  '&:hover': {
                    borderColor: '#66bb6a',
                    bgcolor: 'rgba(76, 175, 80, 0.1)'
                  }
                }}
              >
                🌟 Si Gesit Standalone
              </Button>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button
                variant="outlined"
                fullWidth
                onClick={handleSiSantuyStandalone}
                startIcon={<Star />}
                sx={{
                  py: 2,
                  borderColor: '#616161',
                  color: '#616161',
                  '&:hover': {
                    borderColor: '#757575',
                    bgcolor: 'rgba(97, 97, 97, 0.1)'
                  }
                }}
              >
                🌙 Si Santuy Standalone
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Information Cards */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: 'success.light', color: 'success.contrastText' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🏆 Aturan Si Gesit
              </Typography>
              <Typography variant="body2" component="div">
                <strong>1.</strong> Tingkat Kehadiran Tertinggi<br/>
                <strong>2.</strong> Tepat Waktu Paling Banyak<br/>
                <strong>3.</strong> Tahap 1 Paling Sedikit<br/>
                <strong>4.</strong> Tahap 2 Paling Sedikit<br/>
                <strong>5.</strong> Rata-rata Datang Paling Cepat
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: 'grey.700', color: 'white' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                😎 Aturan Si Santuy
              </Typography>
              <Typography variant="body2" component="div">
                <strong>1.</strong> Izin/Sakit Paling Banyak<br/>
                <strong>2.</strong> TK Paling Banyak<br/>
                <strong>3.</strong> T2 Paling Banyak<br/>
                <strong>4.</strong> T1 Paling Banyak<br/>
                <strong>5.</strong> Rata-rata Datang Paling Lama
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default BintangKu;