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
  createTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem
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
  const [showFilters, setShowFilters] = useState(true);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [showResult, setShowResult] = useState(false);
  const [topFive, setTopFive] = useState([]);
  const [animationStage, setAnimationStage] = useState(0); // 0: initial, 1: animating, 2: complete
  const [visibleCount, setVisibleCount] = useState(0); // Track how many cards are visible
  const [loading, setLoading] = useState(false);

  // Filter state
  const [filters, setFilters] = useState({
    startMonth: new Date().getMonth(),
    startYear: new Date().getFullYear(),
    endMonth: new Date().getMonth(),
    endYear: new Date().getFullYear(),
    status: 'all' // 'all', 'guru', 'siswa'
  });

  // Reset function to go back to initial state
  const handleReset = () => {
    setShowFilters(true);
    setShowCountdown(false);
    setCountdown(10);
    setShowResult(false);
    setTopFive([]);
    setAnimationStage(0);
    setVisibleCount(0);
    setLoading(false);
  };

  // Handle filter form submission
  const handleFilterSubmit = () => {
    setShowFilters(false);
    setShowCountdown(true);
  };

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  useEffect(() => {
    let timer;
    if (showCountdown && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (showCountdown && countdown === 0) {
      // Countdown finished, transition to results and calculate
      console.log('⏰ Countdown finished, transitioning to results...');
      setShowCountdown(false);
      setShowResult(true);
      calculateTopPerformerWithTimeout();
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showCountdown, countdown]);

  // Animation effect for dramatic reveal (5→4→3→2→1) with 2-second intervals
  useEffect(() => {
    if (showResult && topFive.length > 0) {
      console.log('🔥 Starting dramatic reveal animation (5→4→3→2→1)...');
      setAnimationStage(1);
      setVisibleCount(0);

      let i = 0;
      const interval = setInterval(() => {
        i++;
        setVisibleCount(i);
        console.log(`🔥 Revealing card ${i} of ${topFive.length}`);

        if (i >= topFive.length) {
          clearInterval(interval);
          setAnimationStage(2);
          console.log('✅ Dramatic reveal complete - All cards revealed!');
        }
      }, 2000); // ⬅️ setiap 2 detik kartu muncul

      return () => clearInterval(interval);
    }
  }, [showResult, topFive]);

  const handleStarClick = () => {
    setShowCountdown(true);
  };

  const calculateTopPerformer = async () => {
    setLoading(true);
    console.log('🔄 Starting calculation for SiSantuy...');

    try {
      // Calculate using selected filters
      const startDate = new Date(filters.startYear, filters.startMonth, 1);
      const endDate = new Date(filters.endYear, filters.endMonth + 1, 0);

      const startDateStr = startDate.getFullYear() + '-' +
        String(startDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(startDate.getDate()).padStart(2, '0');
      const endDateStr = endDate.getFullYear() + '-' +
        String(endDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(endDate.getDate()).padStart(2, '0');

      console.log('📅 Filter applied:', {
        startDate: startDateStr,
        endDate: endDateStr,
        status: filters.status
      });

      // Get all attendance records for the current month
      console.log('📊 Fetching attendance records...');
      const attendanceRecords = await db.attendance
        .where('tanggal')
        .between(startDateStr, endDateStr, true, true)
        .toArray();
      console.log(`✅ Found ${attendanceRecords.length} attendance records`);

      // Get all perizinan records for the current month
      console.log('📊 Fetching perizinan records...');
      const perizinanRecords = await db.perizinan
        .where('tanggal')
        .between(startDateStr, endDateStr, true, true)
        .toArray();
      console.log(`✅ Found ${perizinanRecords.length} perizinan records`);

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

      // Get all people based on filter
      console.log('👥 Fetching people data...');
      let allPeople = [];

      if (filters.status === 'all' || filters.status === 'guru') {
        const guru = await db.guru.where('status').equals('active').toArray();
        allPeople.push(...guru);
        console.log(`✅ Found ${guru.length} active guru`);
      }

      if (filters.status === 'all' || filters.status === 'siswa') {
        const siswa = await db.siswa.where('status').equals('active').toArray();
        allPeople.push(...siswa);
        console.log(`✅ Found ${siswa.length} active siswa`);
      }

      console.log(`✅ Total people for analysis: ${allPeople.length}`);

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

        // NEW INVERTED SCORING FOR SI SANTUY - Kebalikan dari Si Gesit
        // 1. Tingkat Kehadiran paling rendah (totalAbsences * 100000) - semakin banyak absen, semakin tinggi skor
        // 2. Tingkat Tepat Waktu Paling Sedikit (penalty -tepatWaktu * 10000) - semakin sedikit TW, semakin tinggi skor
        // 3. Tingkat Tahap 1 Paling Banyak (tahap1 * 1000) - semakin banyak T1, semakin tinggi skor
        // 4. Tingkat Tahap 2 Paling Banyak (tahap2 * 10000) - semakin banyak T2, semakin tinggi skor
        // 5. Rata-Rata Waktu datang paling lambat (avgCheckInTime / 10) - semakin telat, semakin tinggi skor

        const totalAbsences = izin + sakit + cuti + tanpaKeterangan;
        const santuyScore =
          (totalAbsences * 100000) +           // 1. Semakin banyak absen = skor lebih tinggi
          (-tepatWaktu * 10000) +              // 2. Semakin sedikit TW = skor lebih tinggi
          (tahap1 * 1000) +                    // 3. Semakin banyak T1 = skor lebih tinggi
          (tahap2 * 10000) +                   // 4. Semakin banyak T2 = skor lebih tinggi
          (avgCheckInTime / 10);               // 5. Semakin telat = skor lebih tinggi

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
      // Following INVERTED hierarchy: more absences, less punctual, more violations = higher rank
      personScores.sort((a, b) => {
        // Primary: santuy score (higher is better - follows inverted evaluation hierarchy)
        if (b.santuyScore !== a.santuyScore) {
          return b.santuyScore - a.santuyScore;
        }

        // Tiebreaker 1: more total absences (higher is better) - Inverted rule #1
        const aAbsences = a.attendance.totalAbsences;
        const bAbsences = b.attendance.totalAbsences;
        if (aAbsences !== bAbsences) {
          return bAbsences - aAbsences; // More absences first
        }

        // Tiebreaker 2: fewer TW (less punctual is better) - Inverted rule #2
        if (b.attendance.tepatWaktu !== a.attendance.tepatWaktu) {
          return a.attendance.tepatWaktu - b.attendance.tepatWaktu; // Fewer TW first
        }

        // Tiebreaker 3: more T1 (more violations is better) - Inverted rule #3
        if (a.attendance.tahap1 !== b.attendance.tahap1) {
          return b.attendance.tahap1 - a.attendance.tahap1; // More T1 first
        }

        // Tiebreaker 4: more T2 (more violations is better) - Inverted rule #4
        if (a.attendance.tahap2 !== b.attendance.tahap2) {
          return b.attendance.tahap2 - a.attendance.tahap2; // More T2 first
        }

        // Tiebreaker 5: later average arrival time (slower is better) - Inverted rule #5
        const aAvgTime = a.avgCheckInTime || 0;
        const bAvgTime = b.avgCheckInTime || 0;
        if (aAvgTime !== bAvgTime) {
          return bAvgTime - aAvgTime; // Later time (higher minutes) first
        }

        // Final tiebreaker: alphabetical by name (A-Z)
        return a.nama.localeCompare(b.nama);
      });

      // Get top 5 performers
      const topFiveScores = personScores.slice(0, 5).map((p, i) => ({
        ...p,
        rank: i + 1,
        stars: 5 - i, // Higher rank = more fire (rank 1 = 5 fire, rank 5 = 1 fire)
      }));

      setTopFive(topFiveScores);
      setAnimationStage(0); // Reset animation stage
      setVisibleCount(0); // Reset visible count
      setShowResult(true);
      setLoading(false); // Make sure loading is set to false

      console.log('✅ SiSantuy calculation completed:', {
        totalPeople: allPeople.length,
        topFiveCount: topFiveScores.length,
        topPerformer: topFiveScores[0]?.nama
      });
    } catch (error) {
      console.error('❌ Error calculating top performer:', error);
      alert('Error menghitung peringkat: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Timeout wrapper for calculation
  const calculateTopPerformerWithTimeout = async () => {
    try {
      console.log('🔄 Starting calculation with timeout...');
      await Promise.race([
        calculateTopPerformer(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Calculation timeout after 30 seconds')), 30000)
        )
      ]);
      console.log('✅ Calculation completed successfully');
    } catch (error) {
      console.error('❌ Calculation failed or timed out:', error);
      alert('Perhitungan gagal: ' + error.message);
      // Reset to initial state on error
      handleReset();
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

  if (showFilters) {
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
            Pilih periode dan kategori untuk melihat pemenang Si Santuy!
          </Typography>

          <Card sx={{ minWidth: 400, maxWidth: 600, mx: 'auto', background: 'rgba(255, 255, 255, 0.05)' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#ff6b35', fontWeight: 'bold' }}>
                🎯 Pengaturan Analisis
              </Typography>

              {/* Date Range Selection */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: '#ff6b35' }}>
                  📅 Periode Analisis
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: '#b0b0b0' }}>Bulan Mulai</InputLabel>
                    <Select
                      value={filters.startMonth}
                      label="Bulan Mulai"
                      onChange={(e) => handleFilterChange('startMonth', e.target.value)}
                      sx={{
                        color: 'white',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255, 107, 53, 0.3)'
                        }
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <MenuItem key={i} value={i}>
                          {new Date(2000, i, 1).toLocaleDateString('id-ID', { month: 'long' })}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: '#b0b0b0' }}>Tahun Mulai</InputLabel>
                    <Select
                      value={filters.startYear}
                      label="Tahun Mulai"
                      onChange={(e) => handleFilterChange('startYear', e.target.value)}
                      sx={{
                        color: 'white',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255, 107, 53, 0.3)'
                        }
                      }}
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                        <MenuItem key={year} value={year}>{year}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: '#b0b0b0' }}>Bulan Akhir</InputLabel>
                    <Select
                      value={filters.endMonth}
                      label="Bulan Akhir"
                      onChange={(e) => handleFilterChange('endMonth', e.target.value)}
                      sx={{
                        color: 'white',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255, 107, 53, 0.3)'
                        }
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <MenuItem key={i} value={i}>
                          {new Date(2000, i, 1).toLocaleDateString('id-ID', { month: 'long' })}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: '#b0b0b0' }}>Tahun Akhir</InputLabel>
                    <Select
                      value={filters.endYear}
                      label="Tahun Akhir"
                      onChange={(e) => handleFilterChange('endYear', e.target.value)}
                      sx={{
                        color: 'white',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255, 107, 53, 0.3)'
                        }
                      }}
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                        <MenuItem key={year} value={year}>{year}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Box>

              {/* Status Selection */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: '#ff6b35' }}>
                  👥 Kategori Peserta
                </Typography>
                <FormControl fullWidth>
                  <InputLabel sx={{ color: '#b0b0b0' }}>Status</InputLabel>
                  <Select
                    value={filters.status}
                    label="Status"
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    sx={{
                      color: 'white',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 107, 53, 0.3)'
                      }
                    }}
                  >
                    <MenuItem value="all">Semua (Guru & Siswa)</MenuItem>
                    <MenuItem value="guru">Hanya Guru</MenuItem>
                    <MenuItem value="siswa">Hanya Siswa</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Button
                onClick={handleFilterSubmit}
                variant="contained"
                size="large"
                fullWidth
                sx={{
                  mt: 2,
                  py: 2,
                  background: 'linear-gradient(45deg, #ff6b35 30%, #ff5722 90%)',
                  fontSize: '1.1rem',
                  fontWeight: 'bold'
                }}
              >
                🔥 Mulai Analisis Si Santuy
              </Button>
            </CardContent>
          </Card>
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
            🔥 Pemenang Si Santuy (Aturan Terbalik) Bulan Ini!
          </Typography>

          {loading ? (
            <Box sx={{ textAlign: 'center' }}>
              <LinearProgress sx={{ width: 300, mb: 2, '& .MuiLinearProgress-bar': { bgcolor: '#ff6b35' } }} />
              <Typography variant="h6">Menghitung...</Typography>
            </Box>
          ) : topFive.length > 0 ? (
            <Box sx={{ width: '100%', maxWidth: 1200 }}>
              {/* Clean Flex Layout */}
              <Box
                sx={{
                  display: 'flex',
                  gap: 4,
                  justifyContent: 'center',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  minHeight: 400
                }}
              >
                {topFive
                  .slice()                     // copy array
                  .reverse()                   // urutan jadi 5,4,3,2,1
                  .slice(0, visibleCount)      // batasi sesuai counter
                  .map((performer, index) => (
                    <Card
                      key={performer.identifier}
                      sx={{
                        width: 200,
                        height: 280,
                        opacity: 1,
                        transform: 'scale(1)',
                        transition: 'all 0.8s ease-out',
                        background: 'linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%)',
                        border: '3px solid #ff6b35',
                        boxShadow: '0 12px 40px rgba(255, 107, 53, 0.3)',
                        zIndex: 5 - index
                      }}
                    >
                      {/* Rank Badge */}
                      <Box
                        sx={{
                          position: 'absolute',
                          top: -15,
                          right: -15,
                          width: 50,
                          height: 50,
                          borderRadius: '50%',
                          backgroundColor: performer.rank === 1 ? '#ff6b35' : performer.rank === 2 ? '#ff5722' : performer.rank === 3 ? '#f44336' : performer.rank === 4 ? '#9c27b0' : '#607d8b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                          fontWeight: 'bold',
                          color: 'white',
                          boxShadow: 2,
                          zIndex: 10
                        }}
                      >
                        {performer.rank}
                      </Box>

                      <CardContent sx={{ textAlign: 'center', p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Avatar
                          sx={{
                            width: 60,
                            height: 60,
                            mx: 'auto',
                            mb: 1,
                            bgcolor: '#ff6b35',
                            fontSize: '1.5rem',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)'
                          }}
                        >
                          {performer.nama.charAt(0).toUpperCase()}
                        </Avatar>

                        <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold', mb: 1 }}>
                          #{performer.rank}
                        </Typography>

                        <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold', mb: 1 }}>
                          {performer.nama}
                        </Typography>

                        <Typography variant="caption" sx={{ color: '#b0b0b0', mb: 2 }}>
                          {performer.jabatan}
                        </Typography>

                        {/* Fire Rating */}
                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                          {getStarRating(performer.stars)}
                        </Box>

                        {/* Special message for rank 1 */}
                        {performer.rank === 1 && animationStage === 2 && (
                          <Typography variant="caption" sx={{ color: '#ff6b35', fontWeight: 'bold' }}>
                            🔥 JUARA 1
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  ))}
              </Box>

              {/* Show message when animation is complete */}
              {animationStage === 2 && (
                <Box sx={{ textAlign: 'center', mt: 4 }}>
                  <Typography variant="h6" sx={{ color: '#ff6b35', fontWeight: 'bold', mb: 2 }}>
                    🔥 Pengumuman Selesai!
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#b0b0b0', mb: 3 }}>
                    Selamat kepada yang "paling santai"! 😎
                  </Typography>

                  {/* Reset Button */}
                  <Button
                    onClick={handleReset}
                    variant="outlined"
                    sx={{
                      mt: 3,
                      borderColor: '#ff6b35',
                      color: '#ff6b35',
                      '&:hover': {
                        borderColor: '#ff5722',
                        backgroundColor: 'rgba(255, 107, 53, 0.1)'
                      }
                    }}
                  >
                    🔄 Cek Lagi
                  </Button>
                </Box>
              )}
            </Box>
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