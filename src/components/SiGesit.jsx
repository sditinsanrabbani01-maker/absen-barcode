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
  Paper
} from '@mui/material';
import { Star, EmojiEvents, TrendingUp, AccessTime } from '@mui/icons-material';
import { db } from '../database';

const SiGesit = ({ mode }) => {
  const [rankingData, setRankingData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState('guru'); // 'guru' or 'siswa'
  const [topPerformers, setTopPerformers] = useState([]);
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1 - 2); // 3 months ago (1-indexed)
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1); // Current month (1-indexed)
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [activeSchoolDays, setActiveSchoolDays] = useState(0);

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

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

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

      // Calculate scores for each person
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

        // Count attendance types
        let tepatWaktu = 0;
        let tahap1 = 0;
        let tahap2 = 0;
        let hadir = 0;
        let dinasLuar = 0;
        let izin = 0;
        let sakit = 0;
        let tanpaKeterangan = 0;

        // Count attendance records
        personAttendance.forEach(record => {
          const status = record.status;
          if (status === 'TW') tepatWaktu++;
          else if (status === 'T1') tahap1++;
          else if (status === 'T2') tahap2++;
          else if (status === 'H') hadir++;
        });

        // Count perizinan records
        personPerizinan.forEach(record => {
          const jenisIzin = (record.jenis_izin || '').toLowerCase().trim();
          if (jenisIzin === 'dinas luar') dinasLuar++;
          else if (jenisIzin === 'izin') izin++;
          else if (jenisIzin === 'sakit') sakit++;
          else tanpaKeterangan++;
        });

        // Calculate unique present days (each day counts as 1, regardless of multiple records)
        // Get unique dates when this person was present
        const personAttendanceDates = new Set();
        const personPerizinanDates = new Set();

        // Add attendance dates (for any attendance record)
        personAttendance.forEach(record => {
          personAttendanceDates.add(record.tanggal);
        });

        // Add perizinan dates (only for dinas luar)
        personPerizinan.forEach(record => {
          const jenisIzin = (record.jenis_izin || '').toLowerCase().trim();
          if (jenisIzin === 'dinas luar') {
            personPerizinanDates.add(record.tanggal);
          }
        });

        // Total unique present days (attendance days + dinas luar days)
        const totalPresentDays = personAttendanceDates.size + personPerizinanDates.size;

        // Calculate attendance percentage based on active school days (capped at 100%)
        const attendancePercentage = activeSchoolDaysCount > 0 ?
          Math.min((totalPresentDays / activeSchoolDaysCount) * 100, 100) : 0;

        // Rating system based on attendance quality first, then earliest arrival time:
        // 1. Most Tepat Waktu (TW) - higher is better (weight: 10000)
        // 2. Fewest Tahap 1 (T1) - lower is better (penalty: -1000)
        // 3. Fewest Tahap 2 (T2) - lower is better (penalty: -100)
        // 4. Most Dinas Luar (DL) - higher is better (weight: 10)
        // 5. Earliest average check-in time (lower minutes = better) - tiebreaker

        // Calculate average check-in time (in minutes since midnight)
        const avgCheckInTime = calculateAverageCheckInTime(identifier, attendanceRecords) || 9999; // Default high value if no data

        // Create a composite score prioritizing attendance quality, then time as tiebreaker
        // Higher scores are better: more TW, fewer T1/T2, more DL, earlier time
        // T1 is more tolerated than T2 (T1 penalty < T2 penalty)
        const ratingScore = (tepatWaktu * 100000) - (tahap1 * 100) - (tahap2 * 1000) + (dinasLuar * 10) - (avgCheckInTime / 100);

        // Determine color based on attendance pattern
        let performanceColor = 'success'; // Green - perfect
        if (tahap2 > 0) performanceColor = 'grey'; // Has T2
        else if (tahap1 > 0) performanceColor = 'warning'; // Has T1
        else if (tanpaKeterangan > 2 || izin > 3 || sakit > 3) performanceColor = 'error'; // Many absences

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
            tanpaKeterangan,
            totalPresentDays,
            attendancePercentage
          },
          ratingScore,
          performanceColor,
          activeSchoolDays: activeSchoolDaysCount
        };
      });

      // Sort by rating score with tiebreakers (descending) - higher score = better performance (more TW, fewer violations, earlier time)
      personScores.sort((a, b) => {
        // First: rating score (higher is better - more TW, fewer violations, earlier time)
        if (b.ratingScore !== a.ratingScore) {
          return b.ratingScore - a.ratingScore;
        }

        // Tiebreaker 1: attendance percentage (higher is better)
        if (b.attendance.attendancePercentage !== a.attendance.attendancePercentage) {
          return b.attendance.attendancePercentage - a.attendance.attendancePercentage;
        }

        // Tiebreaker 2: fewer absences (lower is better)
        const aAbsences = a.attendance.izin + a.attendance.sakit + a.attendance.tanpaKeterangan;
        const bAbsences = b.attendance.izin + b.attendance.sakit + b.attendance.tanpaKeterangan;
        if (aAbsences !== bAbsences) {
          return aAbsences - bAbsences; // Lower absences first
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

  const calculateWorkingDays = (startDate, endDate) => {
    let workingDays = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      // Count weekdays (Monday = 1, Tuesday = 2, ..., Friday = 5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
  };

  const getStarRating = (stars) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        sx={{
          color: index < stars ? '#ffd700' : '#e0e0e0',
          fontSize: '1.2rem'
        }}
      />
    ));
  };

  const getRankColor = (rank) => {
    switch (rank) {
      case 1: return '#ffd700'; // Gold
      case 2: return '#c0c0c0'; // Silver
      case 3: return '#cd7f32'; // Bronze
      default: return '#2196f3'; // Blue
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

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `🏅`;
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        🏆 Si Gesit - Sistem Perangkingan Kehadiran
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Sistem perangkingan kehadiran berdasarkan ketepatan waktu dan konsistensi kehadiran
      </Typography>

      {/* Filter Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🔍 Filter Periode Perhitungan
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth>
                <InputLabel>Tipe</InputLabel>
                <Select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  label="Tipe"
                >
                  <MenuItem value="guru">Guru</MenuItem>
                  <MenuItem value="siswa">Siswa</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth>
                <InputLabel>Bulan Mulai</InputLabel>
                <Select
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  label="Bulan Mulai"
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
                <InputLabel>Tahun Mulai</InputLabel>
                <Select
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value)}
                  label="Tahun Mulai"
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
                <InputLabel>Bulan Sampai</InputLabel>
                <Select
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  label="Bulan Sampai"
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
                <InputLabel>Tahun Sampai</InputLabel>
                <Select
                  value={endYear}
                  onChange={(e) => setEndYear(e.target.value)}
                  label="Tahun Sampai"
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
                startIcon={<TrendingUp />}
                fullWidth
              >
                {loading ? 'Menghitung...' : 'Hitung'}
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
          <LinearProgress />
          <Typography variant="body2" sx={{ mt: 1 }}>
            Menghitung perangkingan...
          </Typography>
        </Box>
      )}

      {/* Top 5 Performers */}
      {topPerformers.length > 0 && (
        <>
          <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
            🏅 Top 5 Paling Rajin
          </Typography>

          <Grid container spacing={3} sx={{ mb: 4 }}>
            {topPerformers.map((person, index) => (
              <Grid item xs={12} md={6} lg={4} key={person.identifier}>
                <Card
                  sx={{
                    position: 'relative',
                    background: `linear-gradient(135deg, ${getRankColor(person.rank)}15, ${getRankColor(person.rank)}05)`,
                    border: `2px solid ${person.performanceColor === 'success' ? '#4caf50' :
                                       person.performanceColor === 'warning' ? '#ff9800' :
                                       person.performanceColor === 'grey' ? '#9e9e9e' : '#f44336'}`,
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      transition: 'transform 0.3s ease'
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
                        <Grid item xs={2.4}>
                          <Typography variant="caption" color="success.main" sx={{ fontWeight: 'bold' }}>
                            TW
                          </Typography>
                          <Typography variant="h6" color="success.main">
                            {person.attendance?.tepatWaktu || 0}
                          </Typography>
                        </Grid>
                        <Grid item xs={2.4}>
                          <Typography variant="caption" color="info.main" sx={{ fontWeight: 'bold' }}>
                            DL
                          </Typography>
                          <Typography variant="h6" color="info.main">
                            {person.attendance?.dinasLuar || 0}
                          </Typography>
                        </Grid>
                        <Grid item xs={2.4}>
                          <Typography variant="caption" color="warning.main" sx={{ fontWeight: 'bold' }}>
                            T1
                          </Typography>
                          <Typography variant="h6" color="warning.main">
                            {person.attendance?.tahap1 || 0}
                          </Typography>
                        </Grid>
                        <Grid item xs={2.4}>
                          <Typography variant="caption" color="grey.600" sx={{ fontWeight: 'bold' }}>
                            T2
                          </Typography>
                          <Typography variant="h6" color="grey.600">
                            {person.attendance?.tahap2 || 0}
                          </Typography>
                        </Grid>
                        <Grid item xs={2.4}>
                          <Typography variant="caption" color="error.main" sx={{ fontWeight: 'bold' }}>
                            TK
                          </Typography>
                          <Typography variant="h6" color="error.main">
                            {person.attendance?.tanpaKeterangan || 0}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>

                    {/* Performance Stats */}
                    <Grid container spacing={1} sx={{ textAlign: 'center' }}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Tingkat Hadir
                        </Typography>
                        <Typography
                          variant="h6"
                          sx={{
                            color: person.attendance?.attendancePercentage >= 90 ? 'success.main' :
                                   person.attendance?.attendancePercentage >= 75 ? 'warning.main' : 'error.main',
                            fontWeight: 'bold'
                          }}
                        >
                          {person.attendance?.attendancePercentage?.toFixed(1) || 0}%
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Skor Rating
                        </Typography>
                        <Typography variant="h6" color="primary.main" sx={{ fontWeight: 'bold' }}>
                          {person.ratingScore}
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
          <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
            📊 Perangkingan Lengkap
          </Typography>

          <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Peringkat</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Nama</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Jabatan</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>TW</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>DL</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>T1</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>T2</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>TK</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>I</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>S</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Total Hadir</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Tingkat Hadir (%)</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Skor Rating</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Rating</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rankingData.map((person, index) => {
                  const rank = index + 1;
                  const stars = rank <= 5 ? Math.max(1, 6 - rank) : 0;

                  return (
                    <TableRow
                      key={person.identifier}
                      sx={{
                        bgcolor: person.performanceColor === 'success' ? 'rgba(76, 175, 80, 0.1)' :
                                person.performanceColor === 'warning' ? 'rgba(255, 152, 0, 0.1)' :
                                person.performanceColor === 'grey' ? 'rgba(158, 158, 158, 0.1)' :
                                person.performanceColor === 'error' ? 'rgba(244, 67, 54, 0.1)' : 'inherit',
                        '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' }
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {rank <= 3 && (
                            <Typography variant="h6">
                              {getRankIcon(rank)}
                            </Typography>
                          )}
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            #{rank}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'medium' }}>
                        {person.nama}
                      </TableCell>
                      <TableCell>{person.jabatan}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={person.attendance?.tepatWaktu || 0}
                          color="success"
                          size="small"
                          variant={person.attendance?.tepatWaktu > 0 ? "filled" : "outlined"}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={person.attendance?.dinasLuar || 0}
                          color="info"
                          size="small"
                          variant={person.attendance?.dinasLuar > 0 ? "filled" : "outlined"}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={person.attendance?.tahap1 || 0}
                          color="warning"
                          size="small"
                          variant={person.attendance?.tahap1 > 0 ? "filled" : "outlined"}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={person.attendance?.tahap2 || 0}
                          color="default"
                          size="small"
                          variant={person.attendance?.tahap2 > 0 ? "filled" : "outlined"}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={person.attendance?.tanpaKeterangan || 0}
                          color="error"
                          size="small"
                          variant={person.attendance?.tanpaKeterangan > 0 ? "filled" : "outlined"}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={person.attendance?.izin || 0}
                          color="warning"
                          size="small"
                          variant={person.attendance?.izin > 0 ? "filled" : "outlined"}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={person.attendance?.sakit || 0}
                          color="secondary"
                          size="small"
                          variant={person.attendance?.sakit > 0 ? "filled" : "outlined"}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {person.attendance?.totalPresentDays || 0}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography
                          variant="body2"
                          sx={{
                            color: person.attendance?.attendancePercentage >= 90 ? 'success.main' :
                                   person.attendance?.attendancePercentage >= 75 ? 'warning.main' : 'error.main',
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
                            color: person.ratingScore >= 500 ? 'success.main' :
                                   person.ratingScore >= 300 ? 'warning.main' : 'error.main'
                          }}
                        >
                          {person.ratingScore}
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
        </>
      )}

      {rankingData.length === 0 && !loading && (
        <Alert severity="info" sx={{ mt: 3 }}>
          Tidak ada data kehadiran untuk periode 3 bulan terakhir
        </Alert>
      )}

      {/* Information Card */}
      <Card sx={{ mt: 4, bgcolor: 'info.main', color: 'white' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ℹ️ Cara Perhitungan Perangkingan Si Gesit
          </Typography>
          <Typography variant="body2" component="div">
            <strong>Periode:</strong> Dari tanggal 1 bulan mulai sampai akhir bulan sampai (berdasarkan hari aktif sekolah)<br/>
            <strong>Hari Aktif Sekolah:</strong> Hari dimana ada minimal 1 orang yang mengisi absensi<br/>
            <strong>Sistem Rating Hierarki:</strong><br/>
            1️⃣ <strong>Paling banyak Tepat Waktu (TW)</strong> → Skor +100,000 per TW<br/>
            2️⃣ <strong>Paling sedikit Tahap 1 (T1)</strong> → Penalti -100 per T1 (lebih toleran)<br/>
            3️⃣ <strong>Paling sedikit Tahap 2 (T2)</strong> → Penalti -1,000 per T2 (kurang toleran)<br/>
            4️⃣ <strong>Paling banyak Dinas Luar (DL)</strong> → Skor +10 per DL<br/>
            5️⃣ <strong>Datang paling cepat (rata-rata waktu absen)</strong> → Lebih cepat = lebih baik<br/>
            <strong>Tiebreaker jika skor sama:</strong><br/>
            • Tingkat kehadiran tertinggi<br/>
            • Jumlah ketidakhadiran terendah<br/>
            • Urutan abjad nama<br/>
            <strong>Tingkat Kehadiran:</strong> (Total Hadir / Hari Aktif Sekolah) × 100%<br/>
            <strong>Kode Status Kehadiran:</strong><br/>
            • <strong>TW:</strong> Tepat Waktu<br/>
            • <strong>DL:</strong> Dinas Luar<br/>
            • <strong>T1:</strong> Tahap 1 (terlambat)<br/>
            • <strong>T2:</strong> Tahap 2 (terlambat)<br/>
            • <strong>TK:</strong> Tanpa Keterangan<br/>
            • <strong>I:</strong> Izin<br/>
            • <strong>S:</strong> Sakit<br/>
            • <strong>H:</strong> Hadir (umum)<br/>
            <strong>Kode Warna:</strong><br/>
            • 🟢 <strong>Hijau:</strong> Sempurna (tidak ada keterlambatan)<br/>
            • 🟡 <strong>Kuning:</strong> Ada Tahap 1<br/>
            • 🔘 <strong>Abu-abu:</strong> Ada Tahap 2<br/>
            • 🔴 <strong>Merah:</strong> Banyak tidak hadir/tanpa keterangan<br/>
            <strong>Rating Bintang:</strong> Peringkat 1-5 mendapat 5-1 bintang
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SiGesit;