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
import { Star, EmojiEvents } from '@mui/icons-material';
import { db } from '../database';

// Light theme for Si Gesit Standalone
const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#4caf50',
    },
    secondary: {
      main: '#ff9800',
    },
  },
});

const SiGesitStandalone = () => {
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
      console.log('🎭 Starting dramatic reveal animation (5→4→3→2→1)...');
      setAnimationStage(1);
      setVisibleCount(0);

      let i = 0;
      const interval = setInterval(() => {
        i++;
        setVisibleCount(i);
        console.log(`🎭 Revealing card ${i} of ${topFive.length}`);

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
    console.log('🔄 Starting calculation for SiGesit...');

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

      // Calculate scores for each person
      const personScores = allPeople.map(person => {
        const identifier = person.niy || person.nisn;

        const personAttendance = attendanceRecords.filter(record =>
          record.identifier === identifier
        );

        const personPerizinan = perizinanRecords.filter(record =>
          record.identifier === identifier
        );

        // Count attendance types
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

        // NEW RATING SYSTEM - Aturan Penilaian Si Gesit (Hierarki Baru)
        // 1. Tingkat Kehadiran paling tinggi (attendancePercentage * 100000)
        // 2. Tingkat Tepat Waktu Paling Banyak (tepatWaktu * 10000)
        // 3. Tingkat Tahap 1 Paling Sedikit (penalty -tahap1 * 1000)
        // 4. Tingkat Tahap 2 Paling Sedikit (penalty -tahap2 * 10000)
        // 5. Rata-Rata Waktu datang paling cepat (earlier time = higher score)

        // Calculate attendance percentage - count unique days with attendance or dinas luar
        const uniqueAttendanceDays = new Set();
        personAttendance.forEach(record => uniqueAttendanceDays.add(record.tanggal));
        const totalPresentDays = uniqueAttendanceDays.size + dinasLuar;
        const attendancePercentage = activeSchoolDaysCount > 0 ? (totalPresentDays / activeSchoolDaysCount) * 100 : 0;

        // NEW COMPOSITE SCORE - Mengikuti aturan penilaian baru
        const ratingScore =
          (attendancePercentage * 100000) +           // 1. Tingkat Kehadiran (bobot tertinggi)
          (tepatWaktu * 10000) +                     // 2. Jumlah Tepat Waktu (bobot tinggi)
          (-tahap1 * 1000) +                         // 3. Penalti Tahap 1 (sedikit = lebih baik)
          (-tahap2 * 10000) +                        // 4. Penalti Tahap 2 (sangat sedikit = lebih baik)
          ((9999 - avgCheckInTime) / 100);           // 5. Waktu datang (lebih cepat = skor lebih tinggi)

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
            tanpaKeterangan
          },
          ratingScore,
          avgCheckInTime,
          attendancePercentage
        };
      });

      // Sort by NEW rating score with UPDATED tiebreakers (descending)
      // Higher score = better performance according to new rules
      personScores.sort((a, b) => {
        // Primary: rating score (higher is better - follows new evaluation hierarchy)
        if (b.ratingScore !== a.ratingScore) {
          return b.ratingScore - a.ratingScore;
        }

        // Tiebreaker 1: attendance percentage (higher is better) - Rule #1
        const aAttendancePercent = a.attendancePercentage || 0;
        const bAttendancePercent = b.attendancePercentage || 0;
        if (bAttendancePercent !== aAttendancePercent) {
          return bAttendancePercent - aAttendancePercent;
        }

        // Tiebreaker 2: most punctual (more TW is better) - Rule #2
        if (b.attendance.tepatWaktu !== a.attendance.tepatWaktu) {
          return b.attendance.tepatWaktu - a.attendance.tepatWaktu;
        }

        // Tiebreaker 3: fewest Tahap 1 (lower T1 is better) - Rule #3
        if (a.attendance.tahap1 !== b.attendance.tahap1) {
          return a.attendance.tahap1 - b.attendance.tahap1; // Lower T1 first
        }

        // Tiebreaker 4: fewest Tahap 2 (lower T2 is better) - Rule #4
        if (a.attendance.tahap2 !== b.attendance.tahap2) {
          return a.attendance.tahap2 - b.attendance.tahap2; // Lower T2 first
        }

        // Tiebreaker 5: earliest average arrival time (lower minutes = better) - Rule #5
        const aAvgTime = a.avgCheckInTime || 9999;
        const bAvgTime = b.avgCheckInTime || 9999;
        if (aAvgTime !== bAvgTime) {
          return aAvgTime - bAvgTime; // Earlier time (lower minutes) first
        }

        // Final tiebreaker: alphabetical by name (A-Z)
        return a.nama.localeCompare(b.nama);
      });

      // Get top 5 performers
      const topFiveScores = personScores.slice(0, 5).map((p, i) => ({
        ...p,
        rank: i + 1,
        stars: 5 - i, // Higher rank = more stars (rank 1 = 5 stars, rank 5 = 1 star)
      }));

      setTopFive(topFiveScores);
      setAnimationStage(0); // Reset animation stage
      setVisibleCount(0); // Reset visible count
      setShowResult(true);
      setLoading(false); // Make sure loading is set to false

      console.log('✅ SiGesit calculation completed:', {
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
      <Star
        key={index}
        sx={{
          color: index < stars ? '#ffd700' : '#e0e0e0',
          fontSize: '2rem'
        }}
      />
    ));
  };

  if (showFilters) {
    return (
      <ThemeProvider theme={lightTheme}>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%)',
            p: 3
          }}
        >
          <Typography variant="h3" gutterBottom sx={{ color: '#4caf50', fontWeight: 'bold', textAlign: 'center' }}>
            🏆 Si Gesit Standalone
          </Typography>
          <Typography variant="h6" sx={{ color: '#666', textAlign: 'center', mb: 4 }}>
            Pilih periode dan kategori untuk melihat pemenang Si Gesit!
          </Typography>

          <Card sx={{ minWidth: 400, maxWidth: 600, mx: 'auto' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                🎯 Pengaturan Analisis
              </Typography>

              {/* Date Range Selection */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                  📅 Periode Analisis
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel>Bulan Mulai</InputLabel>
                    <Select
                      value={filters.startMonth}
                      label="Bulan Mulai"
                      onChange={(e) => handleFilterChange('startMonth', e.target.value)}
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <MenuItem key={i} value={i}>
                          {new Date(2000, i, 1).toLocaleDateString('id-ID', { month: 'long' })}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel>Tahun Mulai</InputLabel>
                    <Select
                      value={filters.startYear}
                      label="Tahun Mulai"
                      onChange={(e) => handleFilterChange('startYear', e.target.value)}
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                        <MenuItem key={year} value={year}>{year}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel>Bulan Akhir</InputLabel>
                    <Select
                      value={filters.endMonth}
                      label="Bulan Akhir"
                      onChange={(e) => handleFilterChange('endMonth', e.target.value)}
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <MenuItem key={i} value={i}>
                          {new Date(2000, i, 1).toLocaleDateString('id-ID', { month: 'long' })}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel>Tahun Akhir</InputLabel>
                    <Select
                      value={filters.endYear}
                      label="Tahun Akhir"
                      onChange={(e) => handleFilterChange('endYear', e.target.value)}
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
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                  👥 Kategori Peserta
                </Typography>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    label="Status"
                    onChange={(e) => handleFilterChange('status', e.target.value)}
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
                  background: 'linear-gradient(45deg, #4caf50 30%, #66bb6a 90%)',
                  fontSize: '1.1rem',
                  fontWeight: 'bold'
                }}
              >
                🚀 Mulai Analisis Si Gesit
              </Button>
            </CardContent>
          </Card>
        </Box>
      </ThemeProvider>
    );
  }


  if (showCountdown) {
    return (
      <ThemeProvider theme={lightTheme}>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%)',
            p: 3
          }}
        >
          <Typography variant="h3" gutterBottom sx={{ color: '#4caf50', fontWeight: 'bold' }}>
            ⏰ Countdown
          </Typography>

          <Box
            sx={{
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: 'linear-gradient(45deg, #4caf50 30%, #66bb6a 90%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
              boxShadow: '0 8px 32px rgba(76, 175, 80, 0.3)'
            }}
          >
            <Typography variant="h1" sx={{ color: 'white', fontWeight: 'bold' }}>
              {countdown}
            </Typography>
          </Box>

          <Typography variant="h6" sx={{ color: '#666', textAlign: 'center' }}>
            Menghitung pemenang Si Gesit...
          </Typography>

          <LinearProgress
            sx={{
              width: '300px',
              mt: 3,
              height: 8,
              borderRadius: 4,
              '& .MuiLinearProgress-bar': {
                background: 'linear-gradient(45deg, #4caf50 30%, #66bb6a 90%)'
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
      <ThemeProvider theme={lightTheme}>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%)',
            p: 3
          }}
        >
          <Typography variant="h3" gutterBottom sx={{ color: '#4caf50', fontWeight: 'bold', textAlign: 'center' }}>
            🎉 Pemenang Si Gesit (Aturan Baru) Bulan Ini!
          </Typography>

          {loading ? (
            <Box sx={{ textAlign: 'center' }}>
              <LinearProgress sx={{ width: 300, mb: 2 }} />
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
                {topFive.slice().reverse().slice(0, visibleCount).map((performer, index) => (
                    <Card
                      key={performer.identifier}
                      sx={{
                        width: 200,
                        height: 280,
                        opacity: 1,
                        transform: 'scale(1)',
                        transition: 'all 0.8s ease-out',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
                        border: '3px solid #4caf50',
                        boxShadow: '0 12px 40px rgba(76, 175, 80, 0.3)',
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
                            backgroundColor: performer.rank === 1 ? '#ffd700' : performer.rank === 2 ? '#c0c0c0' : performer.rank === 3 ? '#cd7f32' : performer.rank === 4 ? '#ff6b35' : '#2196f3',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                            color: '#333',
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
                              bgcolor: '#4caf50',
                              fontSize: '1.5rem',
                              fontWeight: 'bold',
                              boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
                            }}
                          >
                            {performer.nama.charAt(0).toUpperCase()}
                          </Avatar>

                          <Typography variant="h6" sx={{ color: '#333', fontWeight: 'bold', mb: 1 }}>
                            #{performer.rank}
                          </Typography>

                          <Typography variant="subtitle2" sx={{ color: '#333', fontWeight: 'bold', mb: 1 }}>
                            {performer.nama}
                          </Typography>

                          <Typography variant="caption" sx={{ color: '#666', mb: 2 }}>
                            {performer.jabatan}
                          </Typography>

                          {/* Star Rating */}
                          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                            {getStarRating(performer.stars)}
                          </Box>

                          {/* Special message for rank 1 */}
                          {performer.rank === 1 && animationStage === 2 && (
                            <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                              🏆 JUARA 1
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    )
                  )}
              </Box>

              {/* Show message when animation is complete */}
              {animationStage === 2 && (
                <Box sx={{ textAlign: 'center', mt: 4 }}>
                  <Typography variant="h6" sx={{ color: '#4caf50', fontWeight: 'bold', mb: 2 }}>
                    🎉 Pengumuman Selesai!
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#666', mb: 3 }}>
                    Selamat kepada semua pemenang Si Gesit! 🏆
                  </Typography>

                  {/* Reset Button */}
                  <Button
                    onClick={handleReset}
                    variant="outlined"
                    sx={{
                      borderColor: '#4caf50',
                      color: '#4caf50',
                      '&:hover': {
                        borderColor: '#66bb6a',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)'
                      }
                    }}
                  >
                    🔄 Cek Lagi
                  </Button>
                </Box>
              )}
            </Box>
          ) : (
            <Typography variant="h6" sx={{ color: '#666' }}>
              Tidak ada data kehadiran bulan ini
            </Typography>
          )}
        </Box>
      </ThemeProvider>
    );
  }
};

export default SiGesitStandalone;