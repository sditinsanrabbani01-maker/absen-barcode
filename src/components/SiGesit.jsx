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
  TablePagination
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

        // Count attendance types - UPDATED: only count "Datang" statuses for TW/T1/T2
        let tepatWaktu = 0;
        let tahap1 = 0;
        let tahap2 = 0;
        let hadir = 0;
        let dinasLuar = 0;
        let izin = 0;
        let sakit = 0;
        let cuti = 0; // New: Cuti status
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
          // If no records at all for this date, it will be counted as TK in the next section
        });

        // Count perizinan records - UPDATED: add Cuti
        personPerizinan.forEach(record => {
          const jenisIzin = (record.jenis_izin || '').toLowerCase().trim();
          if (jenisIzin === 'dinas luar') dinasLuar++;
          else if (jenisIzin === 'izin') izin++;
          else if (jenisIzin === 'sakit') sakit++;
          else if (jenisIzin === 'cuti') cuti++; // New: Cuti
          else tanpaKeterangan++;
        });

        // Count TK from attendance records with unknown status - same as RekapAbsen
        personAttendance.forEach(record => {
          const statusLower = record.status?.toLowerCase();
          if (!['tw', 't1', 't2', 'h', 'i', 's'].includes(statusLower) &&
              !['datang', 'hadir', 'present', 'masuk', 'izin', 'sakit'].includes(statusLower)) {
            tanpaKeterangan++;
          }
        });

        // Count TK for active school days with no attendance or perizinan records
        // Only count absences on days when school was actually active (someone attended)
        const attendanceDateSet = new Set(personAttendance.map(r => r.tanggal));
        const perizinanDateSet = new Set(personPerizinan.map(r => r.tanggal));

        // Only count TK for days that are in the active school days set
        uniqueDates.forEach(activeDate => {
          const hasAttendance = attendanceDateSet.has(activeDate);
          const hasPerizinan = perizinanDateSet.has(activeDate);

          if (!hasAttendance && !hasPerizinan) {
            tanpaKeterangan++;
          }
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

        // NEW RATING SYSTEM - Aturan Penilaian Si Gesit (Hierarki Baru):
        // 1. Tingkat Kehadiran paling tinggi (attendancePercentage * 100000)
        // 2. Tingkat Tepat Waktu Paling Banyak (tepatWaktu * 10000)
        // 3. Tingkat Tahap 1 Paling Sedikit (penalty -tahap1 * 1000)
        // 4. Tingkat Tahap 2 Paling Sedikit (penalty -tahap2 * 10000)
        // 5. Rata-Rata Waktu datang paling cepat (earlier time = higher score)

        // Calculate average check-in time (in minutes since midnight)
        const avgCheckInTime = calculateAverageCheckInTime(identifier, attendanceRecords) || 9999; // Default high value if no data

        // NEW COMPOSITE SCORE - Mengikuti aturan penilaian baru
        // Higher scores are better: higher attendance %, more TW, fewer T1/T2, earlier time
        const ratingScore =
          (attendancePercentage * 100000) +           // 1. Tingkat Kehadiran (bobot tertinggi)
          (tepatWaktu * 10000) +                     // 2. Jumlah Tepat Waktu (bobot tinggi)
          (-tahap1 * 1000) +                         // 3. Penalti Tahap 1 (sedikit = lebih baik)
          (-tahap2 * 10000) +                        // 4. Penalti Tahap 2 (sangat sedikit = lebih baik)
          ((9999 - avgCheckInTime) / 100);           // 5. Waktu datang (lebih cepat = skor lebih tinggi)

        // Determine color based on attendance pattern
        let performanceColor = 'success'; // Green - perfect
        if (tahap2 > 0) performanceColor = 'grey'; // Has T2
        else if (tahap1 > 0) performanceColor = 'warning'; // Has T1
        else if (tanpaKeterangan > 2 || izin > 3 || sakit > 3 || cuti > 3) performanceColor = 'error'; // Many absences

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

      // Sort by NEW rating score with UPDATED tiebreakers (descending)
      // Higher score = better performance according to new rules
      personScores.sort((a, b) => {
        // Primary: rating score (higher is better - follows new evaluation hierarchy)
        if (b.ratingScore !== a.ratingScore) {
          return b.ratingScore - a.ratingScore;
        }

        // Tiebreaker 1: attendance percentage (higher is better) - Rule #1
        if (b.attendance.attendancePercentage !== a.attendance.attendancePercentage) {
          return b.attendance.attendancePercentage - a.attendance.attendancePercentage;
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
        const aAvgTime = calculateAverageCheckInTime(a.identifier, attendanceRecords) || 9999;
        const bAvgTime = calculateAverageCheckInTime(b.identifier, attendanceRecords) || 9999;
        if (aAvgTime !== bAvgTime) {
          return aAvgTime - bAvgTime; // Earlier time (lower minutes) first
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
        🏆 Si Gesit - Sistem Penilaian Berdasarkan Aturan Baru
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Sistem perangkingan kehadiran berdasarkan hierarki penilaian baru: Kehadiran → Ketepatan Waktu → Disiplin → Kedisiplinan
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
            🏅 Top 5 Si Gesit (Berdasarkan Aturan Baru)
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
                        <Grid item xs={1.5}>
                          <Typography variant="caption" color="success.main" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                            TW
                          </Typography>
                          <Typography variant="h6" color="success.main" sx={{ fontSize: '1rem' }}>
                            {person.attendance?.tepatWaktu || 0}
                          </Typography>
                        </Grid>
                        <Grid item xs={1.5}>
                          <Typography variant="caption" color="info.main" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                            DL
                          </Typography>
                          <Typography variant="h6" color="info.main" sx={{ fontSize: '1rem' }}>
                            {person.attendance?.dinasLuar || 0}
                          </Typography>
                        </Grid>
                        <Grid item xs={1.5}>
                          <Typography variant="caption" color="warning.main" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                            T1
                          </Typography>
                          <Typography variant="h6" color="warning.main" sx={{ fontSize: '1rem' }}>
                            {person.attendance?.tahap1 || 0}
                          </Typography>
                        </Grid>
                        <Grid item xs={1.5}>
                          <Typography variant="caption" color="grey.600" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                            T2
                          </Typography>
                          <Typography variant="h6" color="grey.600" sx={{ fontSize: '1rem' }}>
                            {person.attendance?.tahap2 || 0}
                          </Typography>
                        </Grid>
                        <Grid item xs={1.5}>
                          <Typography variant="caption" color="error.main" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                            TK
                          </Typography>
                          <Typography variant="h6" color="error.main" sx={{ fontSize: '1rem' }}>
                            {person.attendance?.tanpaKeterangan || 0}
                          </Typography>
                        </Grid>
                        <Grid item xs={1.5}>
                          <Typography variant="caption" color="secondary.main" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                            S
                          </Typography>
                          <Typography variant="h6" color="secondary.main" sx={{ fontSize: '1rem' }}>
                            {person.attendance?.sakit || 0}
                          </Typography>
                        </Grid>
                        <Grid item xs={1.5}>
                          <Typography variant="caption" color="warning.main" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                            I
                          </Typography>
                          <Typography variant="h6" color="warning.main" sx={{ fontSize: '1rem' }}>
                            {person.attendance?.izin || 0}
                          </Typography>
                        </Grid>
                        <Grid item xs={1.5}>
                          <Typography variant="caption" color="primary.main" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                            C
                          </Typography>
                          <Typography variant="h6" color="primary.main" sx={{ fontSize: '1rem' }}>
                            {person.attendance?.cuti || 0}
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

          <TableContainer component={Paper} sx={{ mb: 1, overflowX: 'auto' }}>
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
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>C</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Total Hadir</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Tingkat Hadir (%)</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Skor Rating</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Rating</TableCell>
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
                          bgcolor: person.performanceColor === 'success' ? 'rgba(76, 175, 80, 0.1)' :
                                  person.performanceColor === 'warning' ? 'rgba(255, 152, 0, 0.1)' :
                                  person.performanceColor === 'grey' ? 'rgba(158, 158, 158, 0.1)' :
                                  person.performanceColor === 'error' ? 'rgba(244, 67, 54, 0.1)' : 'inherit',
                          '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' }
                        }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {actualRank <= 3 && (
                              <Typography variant="h6">
                                {getRankIcon(actualRank)}
                              </Typography>
                            )}
                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                              #{actualRank}
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
                          <Chip
                            label={person.attendance?.cuti || 0}
                            color="primary"
                            size="small"
                            variant={person.attendance?.cuti > 0 ? "filled" : "outlined"}
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
          />
        </>
      )}

      {rankingData.length === 0 && !loading && (
        <Alert severity="info" sx={{ mt: 3 }}>
          Tidak ada data kehadiran untuk periode 3 bulan terakhir
        </Alert>
      )}

      {/* Information Card */}
      <Card sx={{ mt: 4, bgcolor: 'success.main', color: 'white' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🏆 Aturan Tingkat Penilaian Si Gesit (Model Baru)
          </Typography>
          <Typography variant="body2" component="div">
            <strong>🎯 Hierarki Penilaian Baru (Prioritas 1-5):</strong><br/>
            <strong>1️⃣ Tingkat Kehadiran paling tinggi</strong><br/>
            • Bobot: attendancePercentage × 100,000<br/>
            • Karyawan dengan persentase kehadiran tertinggi mendapat skor tertinggi<br/>
            • Formula: (Total Hari Hadir ÷ Hari Aktif Sekolah) × 100%<br/><br/>

            <strong>2️⃣ Tingkat Tepat Waktu Paling Banyak</strong><br/>
            • Bobot: tepatWaktu × 10,000<br/>
            • Karyawan dengan TW (Tepat Waktu) terbanyak mendapat skor lebih tinggi<br/>
            • Hanya dihitung dari status "Datang" dengan waktu tepat<br/><br/>

            <strong>3️⃣ Tingkat Tahap 1 Paling Sedikit</strong><br/>
            • Penalti: -tahap1 × 1,000<br/>
            • Karyawan dengan T1 (Tahap 1/Terlambat ringan) lebih sedikit mendapat skor lebih tinggi<br/>
            • Lebih toleran dibanding Tahap 2<br/><br/>

            <strong>4️⃣ Tingkat Tahap 2 Paling Sedikit</strong><br/>
            • Penalti: -tahap2 × 10,000<br/>
            • Karyawan dengan T2 (Tahap 2/Terlambat berat) lebih sedikit mendapat skor lebih tinggi<br/>
            • Penalti lebih berat karena terlambat lebih parah<br/><br/>

            <strong>5️⃣ Rata-Rata Waktu datang paling cepat</strong><br/>
            • Bonus: (9999 - avgCheckInTime) ÷ 100<br/>
            • Karyawan dengan rata-rata waktu datang lebih cepat mendapat skor lebih tinggi<br/>
            • Waktu dalam menit sejak tengah malam (lebih kecil = lebih baik)<br/><br/>

            <strong>🔧 Tiebreaker Hierarchy (Jika skor sama):</strong><br/>
            1. Tingkat kehadiran tertinggi (aturan #1)<br/>
            2. Jumlah TW terbanyak (aturan #2)<br/>
            3. Jumlah T1 tersedikit (aturan #3)<br/>
            4. Jumlah T2 tersedikit (aturan #4)<br/>
            5. Rata-rata waktu datang tercepat (aturan #5)<br/>
            6. Urutan abjad nama (tiebreaker final)<br/><br/>

            <strong>📊 Definisi Status:</strong><br/>
            • <strong>TW:</strong> Tepat Waktu (absen di waktu yang ditentukan)<br/>
            • <strong>T1:</strong> Tahap 1 (terlambat ringan/sedang)<br/>
            • <strong>T2:</strong> Tahap 2 (terlambat berat)<br/>
            • <strong>DL:</strong> Dinas Luar (dianggap hadir)<br/>
            • <strong>TK:</strong> Tanpa Keterangan (tidak hadir tanpa alasan)<br/>
            • <strong>I:</strong> Izin (perizinan resmi)<br/>
            • <strong>S:</strong> Sakit (dengan surat dokter)<br/>
            • <strong>C:</strong> Cuti (izin cuti resmi)<br/><br/>

            <strong>🎨 Kode Warna Performa:</strong><br/>
            • 🟢 <strong>Hijau:</strong> Perfect (hanya TW dan DL)<br/>
            • 🟡 <strong>Kuning:</strong> Good (ada T1 tapi tidak ada T2)<br/>
            • 🔘 <strong>Abu-abu:</strong> Fair (ada T2)<br/>
            • 🔴 <strong>Merah:</strong> Poor (banyak TK/I/S/C)<br/><br/>

            <strong>⭐ Sistem Bintang:</strong><br/>
            • Peringkat 1: ⭐⭐⭐⭐⭐ (5 bintang)<br/>
            • Peringkat 2: ⭐⭐⭐⭐ (4 bintang)<br/>
            • Peringkat 3: ⭐⭐⭐ (3 bintang)<br/>
            • Peringkat 4: ⭐⭐ (2 bintang)<br/>
            • Peringkat 5: ⭐ (1 bintang)<br/>
            • Peringkat 6+: Tidak mendapat bintang
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SiGesit;