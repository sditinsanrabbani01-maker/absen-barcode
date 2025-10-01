import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Avatar,
  Chip,
  Grid,
  LinearProgress,
  ThemeProvider,
  createTheme
} from '@mui/material';
import { Whatshot } from '@mui/icons-material';
import { db } from '../database';

// Dark theme for Si Santuy Standalone
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ff6b35',
    },
    secondary: {
      main: '#424242',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0b0b0',
    },
  },
});

const SiSantuyStandalone = () => {
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [showResult, setShowResult] = useState(false);
  const [topPerformer, setTopPerformer] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showCountdown && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showCountdown && countdown === 0) {
      // Countdown finished, calculate the result
      calculateTopPerformer();
    }
  }, [showCountdown, countdown]);

  const handleStarClick = () => {
    setShowCountdown(true);
  };

  const calculateTopPerformer = async () => {
    setLoading(true);
    try {
      // Calculate for current month
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const startDateStr = startDate.getFullYear() + '-' +
        String(startDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(startDate.getDate()).padStart(2, '0');
      const endDateStr = endDate.getFullYear() + '-' +
        String(endDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(endDate.getDate()).padStart(2, '0');

      // Get all attendance records for the current month
      const attendanceRecords = await db.attendance
        .where('tanggal')
        .between(startDateStr, endDateStr, true, true)
        .toArray();

      // Get all perizinan records for the current month
      const perizinanRecords = await db.perizinan
        .where('tanggal')
        .between(startDateStr, endDateStr, true, true)
        .toArray();

      // Calculate active school days
      const uniqueDates = new Set();
      attendanceRecords.forEach(record => uniqueDates.add(record.tanggal));
      perizinanRecords.forEach(record => {
        const jenisIzin = (record.jenis_izin || '').toLowerCase().trim();
        if (jenisIzin === 'dinas luar') {
          uniqueDates.add(record.tanggal);
        }
      });
      const activeSchoolDaysCount = uniqueDates.size;

      // Get all people
      const guru = await db.guru.where('status').equals('active').toArray();
      const siswa = await db.siswa.where('status').equals('active').toArray();
      const allPeople = [...guru, ...siswa];

      // Calculate scores for each person - INVERTED LOGIC FOR SI SANTUY
      const personScores = allPeople.map(person => {
        const identifier = person.niy || person.nisn;

        const personAttendance = attendanceRecords.filter(record =>
          record.identifier === identifier
        );

        const personPerizinan = perizinanRecords.filter(record =>
          record.identifier === identifier
        );

        // Count attendance types - INVERTED: focus on negative indicators
        let tepatWaktu = 0;
        let tahap1 = 0;
        let tahap2 = 0;
        let hadir = 0;
        let dinasLuar = 0;
        let izin = 0;
        let sakit = 0;
        let cuti = 0;
        let tanpaKeterangan = 0;

        // Group attendance records by date
        const attendanceByDate = {};
        personAttendance.forEach(record => {
          const date = record.tanggal;
          if (!attendanceByDate[date]) {
            attendanceByDate[date] = { datang: null, pulang: null };
          }

          if (record.att === 'Datang') {
            attendanceByDate[date].datang = record;
          } else if (record.att === 'Pulang') {
            attendanceByDate[date].pulang = record;
          }
        });

        // Count attendance records
        Object.values(attendanceByDate).forEach(dayRecords => {
          if (dayRecords.datang) {
            const status = dayRecords.datang.status;
            if (status === 'TW') tepatWaktu++;
            else if (status === 'T1') tahap1++;
            else if (status === 'T2') tahap2++;
            else if (status === 'H') hadir++;
          } else if (dayRecords.pulang) {
            tanpaKeterangan++;
          }
        });

        // Count perizinan records
        personPerizinan.forEach(record => {
          const jenisIzin = (record.jenis_izin || '').toLowerCase().trim();
          if (jenisIzin === 'dinas luar') dinasLuar++;
          else if (jenisIzin === 'izin') izin++;
          else if (jenisIzin === 'sakit') sakit++;
          else if (jenisIzin === 'cuti') cuti++;
          else tanpaKeterangan++;
        });

        // Count TK for active school days
        uniqueDates.forEach(activeDate => {
          const hasAttendance = personAttendance.some(r => r.tanggal === activeDate);
          const hasPerizinan = personPerizinan.some(r => r.tanggal === activeDate);

          if (!hasAttendance && !hasPerizinan) {
            tanpaKeterangan++;
          }
        });

        // Calculate average check-in time
        const avgCheckInTime = calculateAverageCheckInTime(identifier, attendanceRecords) || 9999;

        // INVERTED SCORING FOR SI SANTUY
        const totalAbsences = izin + sakit + cuti + tanpaKeterangan;
        const santuyScore = (totalAbsences * 10000) + (tanpaKeterangan * 1000) + (tahap2 * 100) + (tahap1 * 10) + (avgCheckInTime / 10);

        return {
          identifier,
          nama: person.nama,
          jabatan: person.jabatan,
          sebagai: person.sebagai,
          attendance: {
            tepatWaktu,
            tahap1,
            tahap2,
            dinasLuar,
            izin,
            sakit,
            cuti,
            tanpaKeterangan,
            totalAbsences
          },
          santuyScore,
          avgCheckInTime
        };
      });

      // Sort by santuy score DESCENDING - HIGHER SCORE = BETTER RANKING (more "santuy")
      personScores.sort((a, b) => b.santuyScore - a.santuyScore);

      // Get top performer
      const top = personScores[0];
      if (top) {
        setTopPerformer({
          ...top,
          rank: 1,
          stars: 5
        });
      }

      setShowResult(true);
    } catch (error) {
      console.error('Error calculating top performer:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAverageCheckInTime = (identifier, attendanceRecords) => {
    const personRecords = attendanceRecords.filter(record =>
      record.identifier === identifier && record.jam
    );

    if (personRecords.length === 0) return null;

    let totalMinutes = 0;
    let validRecords = 0;

    personRecords.forEach(record => {
      const timeStr = record.jam;
      if (timeStr && timeStr.includes(':')) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          const minutesSinceMidnight = hours * 60 + minutes;
          totalMinutes += minutesSinceMidnight;
          validRecords++;
        }
      }
    });

    if (validRecords === 0) return null;

    return totalMinutes / validRecords;
  };

  const getStarRating = (stars) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Whatshot
        key={index}
        sx={{
          color: index < stars ? '#ff6b35' : '#424242',
          fontSize: '2rem'
        }}
      />
    ));
  };

  if (!showCountdown && !showResult) {
    return (
      <ThemeProvider theme={darkTheme}>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #2a2a2a 100%)',
            p: 3
          }}
        >
          <Typography variant="h3" gutterBottom sx={{ color: '#ff6b35', fontWeight: 'bold', textAlign: 'center' }}>
            😎 Si Santuy Standalone
          </Typography>
          <Typography variant="h6" sx={{ color: '#b0b0b0', textAlign: 'center', mb: 4 }}>
            Klik bintang untuk melihat pemenang Si Santuy bulan ini!
          </Typography>

          <Button
            onClick={handleStarClick}
            sx={{
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: 'linear-gradient(45deg, #ff6b35 30%, #ff5722 90%)',
              color: 'white',
              fontSize: '4rem',
              fontWeight: 'bold',
              boxShadow: '0 8px 32px rgba(255, 107, 53, 0.3)',
              '&:hover': {
                background: 'linear-gradient(45deg, #ff5722 30%, #f44336 90%)',
                transform: 'scale(1.1)',
                boxShadow: '0 12px 40px rgba(255, 107, 53, 0.4)'
              },
              transition: 'all 0.3s ease'
            }}
          >
            🌟
          </Button>

          <Typography variant="body1" sx={{ color: '#b0b0b0', textAlign: 'center', mt: 3 }}>
            Pemenang akan muncul setelah countdown 10 detik
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  if (showCountdown) {
    return (
      <ThemeProvider theme={darkTheme}>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #2a2a2a 100%)',
            p: 3
          }}
        >
          <Typography variant="h3" gutterBottom sx={{ color: '#ff6b35', fontWeight: 'bold' }}>
            ⏰ Countdown
          </Typography>

          <Box
            sx={{
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: 'linear-gradient(45deg, #ff6b35 30%, #ff5722 90%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
              boxShadow: '0 8px 32px rgba(255, 107, 53, 0.3)'
            }}
          >
            <Typography variant="h1" sx={{ color: 'white', fontWeight: 'bold' }}>
              {countdown}
            </Typography>
          </Box>

          <Typography variant="h6" sx={{ color: '#b0b0b0', textAlign: 'center' }}>
            Menghitung pemenang Si Santuy...
          </Typography>

          <LinearProgress
            sx={{
              width: '300px',
              mt: 3,
              height: 8,
              borderRadius: 4,
              '& .MuiLinearProgress-bar': {
                background: 'linear-gradient(45deg, #ff6b35 30%, #ff5722 90%)'
              }
            }}
            variant="determinate"
            value={(10 - countdown) * 10}
          />
        </Box>
      </ThemeProvider>
    );
  }

  if (showResult) {
    return (
      <ThemeProvider theme={darkTheme}>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #2a2a2a 100%)',
            p: 3
          }}
        >
          <Typography variant="h3" gutterBottom sx={{ color: '#ff6b35', fontWeight: 'bold', textAlign: 'center' }}>
            🔥 Pemenang Si Santuy Bulan Ini!
          </Typography>

          {loading ? (
            <Box sx={{ textAlign: 'center' }}>
              <LinearProgress sx={{ width: 300, mb: 2, '& .MuiLinearProgress-bar': { bgcolor: '#ff6b35' } }} />
              <Typography variant="h6">Menghitung...</Typography>
            </Box>
          ) : topPerformer ? (
            <Card
              sx={{
                maxWidth: 600,
                width: '100%',
                background: 'linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%)',
                border: '3px solid #ff6b35',
                boxShadow: '0 12px 40px rgba(255, 107, 53, 0.3)',
                position: 'relative'
              }}
            >
              {/* Rank Badge */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  backgroundColor: '#ff6b35',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: 'white',
                  boxShadow: 3
                }}
              >
                🔥
              </Box>

              <CardContent sx={{ textAlign: 'center', p: 4 }}>
                <Avatar
                  sx={{
                    width: 120,
                    height: 120,
                    mx: 'auto',
                    mb: 3,
                    bgcolor: '#ff6b35',
                    fontSize: '3rem',
                    fontWeight: 'bold',
                    boxShadow: '0 8px 24px rgba(255, 107, 53, 0.3)'
                  }}
                >
                  {topPerformer.nama.charAt(0).toUpperCase()}
                </Avatar>

                <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'white' }}>
                  {topPerformer.nama}
                </Typography>
                <Typography variant="h6" sx={{ color: '#b0b0b0', mb: 3 }}>
                  {topPerformer.jabatan}
                </Typography>

                {/* Star Rating */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                  {getStarRating(topPerformer.stars)}
                </Box>

                {/* Stats */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Total Absen
                    </Typography>
                    <Typography variant="h5" sx={{ color: '#ff6b35', fontWeight: 'bold' }}>
                      {topPerformer.attendance.totalAbsences}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Skor Santuy
                    </Typography>
                    <Typography variant="h5" sx={{ color: '#ff9800', fontWeight: 'bold' }}>
                      {topPerformer.santuyScore}
                    </Typography>
                  </Grid>
                </Grid>

                {/* Achievement Message */}
                <Typography variant="h6" sx={{ color: '#ff6b35', fontWeight: 'bold', mb: 2 }}>
                  🔥 Selamat! Anda adalah yang paling santai bulan ini!
                </Typography>

                <Typography variant="body1" sx={{ color: '#b0b0b0' }}>
                  Terus jaga "santai" Anda! 😎
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Typography variant="h6" sx={{ color: '#b0b0b0' }}>
              Tidak ada data kehadiran bulan ini
            </Typography>
          )}
        </Box>
      </ThemeProvider>
    );
  }
};

export default SiSantuyStandalone;