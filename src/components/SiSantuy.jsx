import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Avatar,
  Chip,
  LinearProgress,
  Alert,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  ThemeProvider,
  createTheme
} from '@mui/material';
import { Whatshot, EmojiEvents, TrendingDown, AccessTime } from '@mui/icons-material';
import { db } from '../database';

// Dark theme for Si Santuy
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
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%)',
          border: '1px solid #333',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 107, 53, 0.2)',
          color: '#ff6b35',
          border: '1px solid #ff6b35',
        },
      },
    },
  },
});

const SiSantuy = ({ mode }) => {
  const [rankingData, setRankingData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState('guru'); // 'guru' or 'siswa'
  const [topPerformers, setTopPerformers] = useState([]);
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1 - 2); // 3 months ago (1-indexed)
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1); // Current month (1-indexed)
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [activeSchoolDays, setActiveSchoolDays] = useState(0);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const months = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' }
  ];

  useEffect(() => {
    calculateRanking();
  }, [selectedType, startMonth, startYear, endMonth, endYear]);

  const calculateRanking = async () => {
    setLoading(true);
    try {
      // Calculate date range based on user input (convert 1-indexed to 0-indexed for Date constructor)
      const startDate = new Date(startYear, startMonth - 1, 1);
      const endDate = new Date(endYear, endMonth, 0); // Last day of end month

      // Use local date formatting to avoid timezone conversion issues
      const startDateStr = startDate.getFullYear() + '-' +
        String(startDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(startDate.getDate()).padStart(2, '0');
      const endDateStr = endDate.getFullYear() + '-' +
        String(endDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(endDate.getDate()).padStart(2, '0');

      // Get all attendance records for the period
      const attendanceRecords = await db.attendance
        .where('tanggal')
        .between(startDateStr, endDateStr, true, true)
        .toArray();

      // Get all perizinan records for the period
      const perizinanRecords = await db.perizinan
        .where('tanggal')
        .between(startDateStr, endDateStr, true, true)
        .toArray();

      // Calculate active school days (days when attendance or dinas luar was recorded, excluding holidays)
      const uniqueDates = new Set();
      attendanceRecords.forEach(record => uniqueDates.add(record.tanggal));
      perizinanRecords.forEach(record => {
        const jenisIzin = (record.jenis_izin || '').toLowerCase().trim();
        if (jenisIzin === 'dinas luar') {
          uniqueDates.add(record.tanggal);
        }
      });
      const activeSchoolDaysCount = uniqueDates.size;

      setActiveSchoolDays(activeSchoolDaysCount);

      // Get all people based on selected type
      let allPeople = [];
      if (selectedType === 'guru') {
        allPeople = await db.guru.where('status').equals('active').toArray();
      } else {
        allPeople = await db.siswa.where('status').equals('active').toArray();
      }

      // Calculate scores for each person - INVERTED LOGIC FOR SI SANTUY
      const personScores = allPeople.map(person => {
        const identifier = person.niy || person.nisn;

        // Get attendance records for this person
        const personAttendance = attendanceRecords.filter(record =>
          record.identifier === identifier
        );

        // Get perizinan records for this person
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

        // Group attendance records by date to check for each day
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

        // Count attendance records - only "Datang" statuses count as TW/T1/T2
        // If someone only has "Pulang" without "Datang", count as TK
        Object.values(attendanceByDate).forEach(dayRecords => {
          if (dayRecords.datang) {
            // Has "Datang" record - count the quality metrics
            const status = dayRecords.datang.status;
            if (status === 'TW') tepatWaktu++;
            else if (status === 'T1') tahap1++;
            else if (status === 'T2') tahap2++;
            else if (status === 'H') hadir++;
          } else if (dayRecords.pulang) {
            // Only has "Pulang" without "Datang" - count as TK
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

        // Count TK for active school days with no attendance or perizinan records
        const attendanceDateSet = new Set(personAttendance.map(r => r.tanggal));
        const perizinanDateSet = new Set(personPerizinan.map(r => r.tanggal));

        uniqueDates.forEach(activeDate => {
          const hasAttendance = attendanceDateSet.has(activeDate);
          const hasPerizinan = perizinanDateSet.has(activeDate);

          if (!hasAttendance && !hasPerizinan) {
            tanpaKeterangan++;
          }
        });

        // Calculate unique present days
        const personAttendanceDates = new Set();
        const personPerizinanDates = new Set();

        personAttendance.forEach(record => {
          personAttendanceDates.add(record.tanggal);
        });

        personPerizinan.forEach(record => {
          const jenisIzin = (record.jenis_izin || '').toLowerCase().trim();
          if (jenisIzin === 'dinas luar') {
            personPerizinanDates.add(record.tanggal);
          }
        });

        const totalPresentDays = personAttendanceDates.size + personPerizinanDates.size;

        // Calculate attendance percentage
        const attendancePercentage = activeSchoolDaysCount > 0 ?
          Math.min((totalPresentDays / activeSchoolDaysCount) * 100, 100) : 0;

        // Calculate average check-in time (in minutes since midnight)
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

        // INVERTED color logic - worse performance gets "better" colors for Si Santuy
        let performanceColor = 'error'; // Red - worst performance (best for Si Santuy)
        if (totalAbsences >= 10 || tanpaKeterangan >= 5) performanceColor = 'error'; // Many absences = best
        else if (tahap2 >= 3 || tahap1 >= 5) performanceColor = 'warning'; // Some violations = good
        else if (attendancePercentage >= 80) performanceColor = 'grey'; // Good attendance = bad for Si Santuy
        else performanceColor = 'success'; // Perfect attendance = worst for Si Santuy

        return {
          identifier,
          nama: person.nama,
          jabatan: person.jabatan,
          sebagai: person.sebagai,
          attendance: {
            tepatWaktu,
            tahap1,
            tahap2,
            hadir,
            dinasLuar,
            izin,
            sakit,
            cuti,
            tanpaKeterangan,
            totalPresentDays,
            attendancePercentage,
            totalAbsences
          },
          santuyScore,
          performanceColor,
          activeSchoolDays: activeSchoolDaysCount
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
        const aAvgTime = calculateAverageCheckInTime(a.identifier, attendanceRecords) || 0;
        const bAvgTime = calculateAverageCheckInTime(b.identifier, attendanceRecords) || 0;
        if (aAvgTime !== bAvgTime) {
          return bAvgTime - aAvgTime; // Later time (higher minutes) first
        }

        // Final tiebreaker: alphabetical by name (A-Z)
        return a.nama.localeCompare(b.nama);
      });

      // Take top 5 performers
      const top5 = personScores.slice(0, 5);

      // Assign star ratings based on ranking
      const rankedPerformers = top5.map((person, index) => ({
        ...person,
        rank: index + 1,
        stars: Math.max(1, 6 - index) // 5 stars for 1st, 4 for 2nd, etc., minimum 1 star
      }));

      setRankingData(personScores);
      setTopPerformers(rankedPerformers);

    } catch (error) {
      console.error('Error calculating ranking:', error);
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
      const timeStr = record.jam; // Assuming format "HH:MM"
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

    return totalMinutes / validRecords; // Average minutes since midnight
  };

  const getStarRating = (stars) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Whatshot
        key={index}
        sx={{
          color: index < stars ? '#ff6b35' : '#424242',
          fontSize: '1.2rem'
        }}
      />
    ));
  };

  const getRankColor = (rank) => {
    switch (rank) {
      case 1: return '#ff6b35'; // Orange - hottest
      case 2: return '#ff5722'; // Deep orange
      case 3: return '#f44336'; // Red
      default: return '#9c27b0'; // Purple
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return '🔥';
      case 2: return '🌶️';
      case 3: return '💥';
      default: return `⭐`;
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{
        flexGrow: 1,
        p: 3,
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #2a2a2a 100%)'
      }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#ff6b35' }}>
          🔥 Si Santuy - Kebalikan dari Si Gesit
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Sistem perangkingan terbalik berdasarkan aturan baru: semakin banyak absen & telat, semakin tinggi peringkat! 🌶️
        </Typography>

        {/* Filter Controls */}
        <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%)' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: '#ff6b35' }}>
              🔍 Filter Periode Perhitungan
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Tipe</InputLabel>
                  <Select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    label="Tipe"
                    sx={{
                      color: 'white',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' }
                    }}
                  >
                    <MenuItem value="guru">Guru</MenuItem>
                    <MenuItem value="siswa">Siswa</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Bulan Mulai</InputLabel>
                  <Select
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                    label="Bulan Mulai"
                    sx={{
                      color: 'white',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' }
                    }}
                  >
                    {months.map(month => (
                      <MenuItem key={month.value} value={month.value}>
                        {month.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Tahun Mulai</InputLabel>
                  <Select
                    value={startYear}
                    onChange={(e) => setStartYear(e.target.value)}
                    label="Tahun Mulai"
                    sx={{
                      color: 'white',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' }
                    }}
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Bulan Sampai</InputLabel>
                  <Select
                    value={endMonth}
                    onChange={(e) => setEndMonth(e.target.value)}
                    label="Bulan Sampai"
                    sx={{
                      color: 'white',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' }
                    }}
                  >
                    {months.map(month => (
                      <MenuItem key={month.value} value={month.value}>
                        {month.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Tahun Sampai</InputLabel>
                  <Select
                    value={endYear}
                    onChange={(e) => setEndYear(e.target.value)}
                    label="Tahun Sampai"
                    sx={{
                      color: 'white',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' }
                    }}
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <Button
                  variant="contained"
                  onClick={calculateRanking}
                  disabled={loading}
                  startIcon={<Whatshot />}
                  fullWidth
                  sx={{
                    background: 'linear-gradient(45deg, #ff6b35 30%, #ff5722 90%)',
                    color: 'white',
                    fontWeight: 'bold',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #ff5722 30%, #f44336 90%)',
                      transform: 'scale(1.05)'
                    }
                  }}
                >
                  {loading ? 'Menghitung...' : 'Hitung Santuy'}
                </Button>
              </Grid>
            </Grid>

            {activeSchoolDays > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  📅 Periode: <strong>{months.find(m => m.value === startMonth)?.label} {startYear} - {months.find(m => m.value === endMonth)?.label} {endYear}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  📊 Hari aktif sekolah: <strong>{activeSchoolDays} hari</strong>
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {loading && (
          <Box sx={{ mb: 3 }}>
            <LinearProgress sx={{ bgcolor: '#424242', '& .MuiLinearProgress-bar': { bgcolor: '#ff6b35' } }} />
            <Typography variant="body2" sx={{ mt: 1, color: '#ff6b35' }}>
              Menghitung peringkat santuy...
            </Typography>
          </Box>
        )}

        {/* Top 5 Performers */}
        {topPerformers.length > 0 && (
          <>
            <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2, color: '#ff6b35' }}>
              🔥 Top 5 Si Santuy (Berdasarkan Aturan Terbalik)
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              {topPerformers.map((person, index) => (
                <Grid item xs={12} md={6} lg={4} key={person.identifier}>
                  <Card
                    sx={{
                      position: 'relative',
                      background: `linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%)`,
                      border: `2px solid ${person.performanceColor === 'error' ? '#ff6b35' :
                                        person.performanceColor === 'warning' ? '#ff9800' :
                                        person.performanceColor === 'grey' ? '#9e9e9e' : '#4caf50'}`,
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        transition: 'transform 0.3s ease',
                        boxShadow: `0 8px 25px rgba(255, 107, 53, 0.3)`
                      }
                    }}
                  >
                    <CardContent sx={{ textAlign: 'center', pb: 2 }}>
                      {/* Rank Badge */}
                      <Box
                        sx={{
                          position: 'absolute',
                          top: -10,
                          right: -10,
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          backgroundColor: getRankColor(person.rank),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                          fontWeight: 'bold',
                          color: 'white',
                          boxShadow: 2
                        }}
                      >
                        {getRankIcon(person.rank)}
                      </Box>

                      {/* Avatar */}
                      <Avatar
                        sx={{
                          width: 80,
                          height: 80,
                          mx: 'auto',
                          mb: 2,
                          bgcolor: getRankColor(person.rank),
                          fontSize: '2rem',
                          fontWeight: 'bold'
                        }}
                      >
                        {person.nama.charAt(0).toUpperCase()}
                      </Avatar>

                      {/* Name and Position */}
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                        {person.nama}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {person.jabatan}
                      </Typography>

                      {/* Star Rating */}
                      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                        {getStarRating(person.stars)}
                      </Box>

                      {/* Attendance Breakdown */}
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom align="center">
                          📊 Rincian Kehadiran
                        </Typography>
                        <Grid container spacing={1} sx={{ textAlign: 'center' }}>
                          <Grid item xs={1.5}>
                            <Typography variant="caption" color="error.main" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                              TK
                            </Typography>
                            <Typography variant="h6" color="error.main" sx={{ fontSize: '1rem' }}>
                              {person.attendance?.tanpaKeterangan || 0}
                            </Typography>
                          </Grid>
                          <Grid item xs={1.5}>
                            <Typography variant="caption" color="warning.main" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                              I/S
                            </Typography>
                            <Typography variant="h6" color="warning.main" sx={{ fontSize: '1rem' }}>
                              {(person.attendance?.izin || 0) + (person.attendance?.sakit || 0)}
                            </Typography>
                          </Grid>
                          <Grid item xs={1.5}>
                            <Typography variant="caption" color="grey.400" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                              T2
                            </Typography>
                            <Typography variant="h6" color="grey.400" sx={{ fontSize: '1rem' }}>
                              {person.attendance?.tahap2 || 0}
                            </Typography>
                          </Grid>
                          <Grid item xs={1.5}>
                            <Typography variant="caption" color="orange" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                              T1
                            </Typography>
                            <Typography variant="h6" color="orange" sx={{ fontSize: '1rem' }}>
                              {person.attendance?.tahap1 || 0}
                            </Typography>
                          </Grid>
                          <Grid item xs={1.5}>
                            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                              Cuti
                            </Typography>
                            <Typography variant="h6" color="primary.main" sx={{ fontSize: '1rem' }}>
                              {person.attendance?.cuti || 0}
                            </Typography>
                          </Grid>
                          <Grid item xs={1.5}>
                            <Typography variant="caption" color="secondary.main" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                              DL
                            </Typography>
                            <Typography variant="h6" color="secondary.main" sx={{ fontSize: '1rem' }}>
                              {person.attendance?.dinasLuar || 0}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Box>

                      {/* Performance Stats */}
                      <Grid container spacing={1} sx={{ textAlign: 'center' }}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Tingkat Santuy
                          </Typography>
                          <Typography
                            variant="h6"
                            sx={{
                              color: person.attendance?.totalAbsences >= 10 ? 'error.main' :
                                    person.attendance?.totalAbsences >= 5 ? 'warning.main' : 'grey.400',
                              fontWeight: 'bold'
                            }}
                          >
                            {person.attendance?.totalAbsences || 0} hari
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Skor Santuy
                          </Typography>
                          <Typography variant="h6" color="#ff6b35" sx={{ fontWeight: 'bold' }}>
                            {person.santuyScore}
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </>
        )}

        {/* Detailed Ranking Table */}
        {rankingData.length > 0 && (
          <>
            <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2, color: '#ff6b35' }}>
              📊 Perangkingan Lengkap Santuy
            </Typography>

            <TableContainer component={Paper} sx={{ mb: 1, overflowX: 'auto', bgcolor: '#1e1e1e' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#2c2c2c' }}>
                    <TableCell sx={{ fontWeight: 'bold', color: '#ff6b35' }}>Peringkat</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#ff6b35' }}>Nama</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#ff6b35' }}>Jabatan</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#ff6b35' }}>TK</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#ff6b35' }}>Izin</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#ff6b35' }}>Sakit</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#ff6b35' }}>Cuti</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#ff6b35' }}>T2</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#ff6b35' }}>T1</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#ff6b35' }}>DL</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#ff6b35' }}>Total Absen</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#ff6b35' }}>Tingkat Hadir (%)</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#ff6b35' }}>Skor Santuy</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#ff6b35' }}>Rating</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rankingData
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((person, index) => {
                      const actualRank = page * rowsPerPage + index + 1;
                      const stars = actualRank <= 5 ? Math.max(1, 6 - actualRank) : 0;

                      return (
                        <TableRow
                          key={person.identifier}
                          sx={{
                            bgcolor: person.performanceColor === 'error' ? 'rgba(255, 107, 53, 0.1)' :
                                   person.performanceColor === 'warning' ? 'rgba(255, 152, 0, 0.1)' :
                                   person.performanceColor === 'grey' ? 'rgba(158, 158, 158, 0.1)' :
                                   'rgba(76, 175, 80, 0.1)',
                            '&:hover': { bgcolor: 'rgba(255, 107, 53, 0.05)' }
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {actualRank <= 3 && (
                                <Typography variant="h6">
                                  {getRankIcon(actualRank)}
                                </Typography>
                              )}
                              <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#ff6b35' }}>
                                #{actualRank}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 'medium', color: 'white' }}>
                            {person.nama}
                          </TableCell>
                          <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{person.jabatan}</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={person.attendance?.tanpaKeterangan || 0}
                              color="error"
                              size="small"
                              variant={(person.attendance?.tanpaKeterangan || 0) > 0 ? "filled" : "outlined"}
                              sx={{ bgcolor: (person.attendance?.tanpaKeterangan || 0) > 0 ? 'rgba(244, 67, 54, 0.2)' : 'transparent', color: '#f44336' }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={person.attendance?.izin || 0}
                              color="warning"
                              size="small"
                              variant={(person.attendance?.izin || 0) > 0 ? "filled" : "outlined"}
                              sx={{ bgcolor: (person.attendance?.izin || 0) > 0 ? 'rgba(255, 152, 0, 0.2)' : 'transparent', color: '#ff9800' }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={person.attendance?.sakit || 0}
                              color="secondary"
                              size="small"
                              variant={(person.attendance?.sakit || 0) > 0 ? "filled" : "outlined"}
                              sx={{ bgcolor: (person.attendance?.sakit || 0) > 0 ? 'rgba(156, 39, 176, 0.2)' : 'transparent', color: '#9c27b0' }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={person.attendance?.cuti || 0}
                              color="primary"
                              size="small"
                              variant={(person.attendance?.cuti || 0) > 0 ? "filled" : "outlined"}
                              sx={{ bgcolor: (person.attendance?.cuti || 0) > 0 ? 'rgba(33, 150, 243, 0.2)' : 'transparent', color: '#2196f3' }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={person.attendance?.tahap2 || 0}
                              color="default"
                              size="small"
                              variant={(person.attendance?.tahap2 || 0) > 0 ? "filled" : "outlined"}
                              sx={{ bgcolor: (person.attendance?.tahap2 || 0) > 0 ? 'rgba(158, 158, 158, 0.2)' : 'transparent', color: '#9e9e9e' }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={person.attendance?.tahap1 || 0}
                              color="warning"
                              size="small"
                              variant={(person.attendance?.tahap1 || 0) > 0 ? "filled" : "outlined"}
                              sx={{ bgcolor: (person.attendance?.tahap1 || 0) > 0 ? 'rgba(255, 152, 0, 0.2)' : 'transparent', color: '#ff9800' }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={person.attendance?.dinasLuar || 0}
                              color="info"
                              size="small"
                              variant={(person.attendance?.dinasLuar || 0) > 0 ? "filled" : "outlined"}
                              sx={{ bgcolor: (person.attendance?.dinasLuar || 0) > 0 ? 'rgba(3, 169, 244, 0.2)' : 'transparent', color: '#03a9f4' }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#ff6b35' }}>
                              {person.attendance?.totalAbsences || 0}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography
                              variant="body2"
                              sx={{
                                color: person.attendance?.attendancePercentage <= 70 ? 'error.main' :
                                      person.attendance?.attendancePercentage <= 85 ? 'warning.main' : 'success.main',
                                fontWeight: 'bold'
                              }}
                            >
                              {person.attendance?.attendancePercentage?.toFixed(1) || 0}%
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 'bold',
                                color: person.santuyScore >= 5000 ? 'error.main' :
                                      person.santuyScore >= 3000 ? 'warning.main' : '#ff6b35'
                              }}
                            >
                              {person.santuyScore}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            {stars > 0 && (
                              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                {getStarRating(stars)}
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={rankingData.length}
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
              sx={{
                color: 'white',
                '& .MuiTablePagination-selectLabel': { color: 'rgba(255, 255, 255, 0.7)' },
                '& .MuiTablePagination-displayedRows': { color: 'rgba(255, 255, 255, 0.7)' },
                '& .MuiSelect-icon': { color: 'rgba(255, 255, 255, 0.7)' }
              }}
            />
          </>
        )}

        {rankingData.length === 0 && !loading && (
          <Alert severity="info" sx={{ mt: 3, bgcolor: 'rgba(255, 107, 53, 0.1)', color: '#ff6b35' }}>
            Tidak ada data kehadiran untuk periode yang dipilih
          </Alert>
        )}

        {/* Information Card */}
        <Card sx={{ mt: 4, bgcolor: 'rgba(255, 107, 53, 0.1)', border: '1px solid #ff6b35' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: '#ff6b35' }}>
              🔥 Aturan Si Santuy - Kebalikan dari Si Gesit
            </Typography>
            <Typography variant="body2" component="div" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
              <strong>🎯 Hierarki Penilaian Terbalik (Prioritas 1-5):</strong><br/>
              <strong>1️⃣ Tingkat Kehadiran paling rendah</strong><br/>
              • Bobot: totalAbsences × 100,000<br/>
              • Karyawan dengan ketidakhadiran terbanyak mendapat skor tertinggi<br/>
              • Formula: (Total Absen ÷ Hari Aktif Sekolah) × 100% (di-invert)<br/><br/>

              <strong>2️⃣ Tingkat Tepat Waktu Paling Sedikit</strong><br/>
              • Penalti: -tepatWaktu × 10,000<br/>
              • Karyawan dengan TW (Tepat Waktu) tersedikit mendapat skor lebih tinggi<br/>
              • Semakin sering terlambat = semakin baik untuk Si Santuy<br/><br/>

              <strong>3️⃣ Tingkat Tahap 1 Paling Banyak</strong><br/>
              • Bonus: tahap1 × 1,000<br/>
              • Karyawan dengan T1 (terlambat ringan) terbanyak mendapat skor lebih tinggi<br/>
              • Lebih banyak terlambat = lebih santuy<br/><br/>

              <strong>4️⃣ Tingkat Tahap 2 Paling Banyak</strong><br/>
              • Bonus: tahap2 × 10,000<br/>
              • Karyawan dengan T2 (terlambat berat) terbanyak mendapat skor lebih tinggi<br/>
              • Terlambat parah = sangat santuy<br/><br/>

              <strong>5️⃣ Rata-Rata Waktu datang paling lambat</strong><br/>
              • Bonus: avgCheckInTime ÷ 10<br/>
              • Karyawan dengan rata-rata waktu datang lebih lambat mendapat skor lebih tinggi<br/>
              • Semakin sering datang telat = semakin santuy<br/><br/>

              <strong>🔧 Tiebreaker Hierarchy (Jika skor sama):</strong><br/>
              1. Ketidakhadiran terbanyak (aturan #1 terbalik)<br/>
              2. TW tersedikit (aturan #2 terbalik)<br/>
              3. T1 terbanyak (aturan #3 terbalik)<br/>
              4. T2 terbanyak (aturan #4 terbalik)<br/>
              5. Rata-rata waktu datang terlambat (aturan #5 terbalik)<br/>
              6. Urutan abjad nama (final tiebreaker)<br/><br/>

              <strong>🎨 Kode Warna Santuy:</strong><br/>
              • 🔴 <strong>Merah:</strong> Sangat Santuy (banyak absen, sering telat)<br/>
              • 🟡 <strong>Kuning:</strong> Cukup Santuy (sedang absen/telat)<br/>
              • 🔘 <strong>Abu-abu:</strong> Kurang Santuy (hanya beberapa kali telat)<br/>
              • 🟢 <strong>Hijau:</strong> Tidak Santuy (terlalu disiplin, jarang absen)<br/><br/>

              <strong>🌶️ Sistem Api:</strong><br/>
              • Peringkat 1: 🔥🔥🔥🔥🔥 (5 api)<br/>
              • Peringkat 2: 🔥🔥🔥🔥 (4 api)<br/>
              • Peringkat 3: 🔥🔥🔥 (3 api)<br/>
              • Peringkat 4: 🔥🔥 (2 api)<br/>
              • Peringkat 5: 🔥 (1 api)<br/>
              • Peringkat 6+: Tidak mendapat api
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </ThemeProvider>
  );
};

export default SiSantuy;