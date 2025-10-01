import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
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
  Card,
  CardContent,
  Grid,
  Alert
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { db } from '../database';

const RekapDatang = ({ mode }) => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [filterType, setFilterType] = useState('guru');
  const [filterValue, setFilterValue] = useState('');
  const [attendanceData, setAttendanceData] = useState([]);
  const [dailyAttendanceData, setDailyAttendanceData] = useState([]);
  const [groupedData, setGroupedData] = useState({});
  const [schoolSettings, setSchoolSettings] = useState({});
  const [attendanceSettings, setAttendanceSettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [availableFilters, setAvailableFilters] = useState([]);

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

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  useEffect(() => {
    loadSchoolSettings();
    loadAttendanceSettings();

    window.refreshRekapDatang = generateReport;

    return () => {
      delete window.refreshRekapDatang;
    };
  }, []);

  useEffect(() => {
    generateReport();
  }, [selectedMonth, selectedYear, filterType, filterValue]);

  useEffect(() => {
    loadAvailableFilters();
  }, [filterType]);

  useEffect(() => {
    if (filterType === 'siswa' && availableFilters.length > 0 && !filterValue) {
      setFilterValue(availableFilters[0]);
    }
  }, [availableFilters, filterType, filterValue]);

  const loadSchoolSettings = () => {
    db.school_settings.toCollection().first().then(settings => {
      if (settings) {
        setSchoolSettings(settings);
      }
    });
  };

  const loadAttendanceSettings = () => {
    db.attendance_settings.toArray().then(settings => {
      setAttendanceSettings(settings);
    });
  };

  const loadAvailableFilters = async () => {
    try {
      if (filterType === 'guru') {
        const guruData = await db.guru.where('status').equals('active').toArray();
        return [...new Set(guruData.map(record => record.jabatan).filter(Boolean))];
      } else if (filterType === 'siswa') {
        const siswaData = await db.siswa.where('status').equals('active').toArray();
        return [...new Set(siswaData.map(record => record.jabatan).filter(Boolean))];
      }
    } catch (error) {
      console.error('Error getting available filters:', error);
    }
    return [];
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const daysInSelectedMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      setDaysInMonth(daysInSelectedMonth);

      const startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
      const endDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${daysInSelectedMonth.toString().padStart(2, '0')}`;

      let allAttendanceRecords = await db.attendance.toArray();
      let attendanceRecords = allAttendanceRecords.filter(record => {
        const recordDate = record.tanggal;
        const dateStr = recordDate.split('T')[0] || recordDate.split(' ')[0];
        return dateStr >= startDate && dateStr <= endDate;
      });

      // Filter by attendance type: ONLY "Datang" records
      attendanceRecords = attendanceRecords.filter(record => record.att === 'Datang');

      if (filterType === 'guru') {
        attendanceRecords = attendanceRecords.filter(record => record.sebagai === 'Guru');
      } else if (filterType === 'siswa') {
        attendanceRecords = attendanceRecords.filter(record => record.sebagai === 'Siswa');
      }

      let allPeople = [];
      if (filterType === 'guru') {
        allPeople = await db.guru.where('status').equals('active').toArray();
      } else if (filterType === 'siswa') {
        allPeople = await db.siswa.where('status').equals('active').toArray();
      }

      let filteredPeople = allPeople;
      if (filterValue && filterValue !== '') {
        filteredPeople = allPeople.filter(person => person.jabatan === filterValue);
      }

      const filteredIdentifiers = filteredPeople.map(person => person.niy || person.nisn);

      if (filterValue && filterValue !== '') {
        attendanceRecords = attendanceRecords.filter(record =>
          record.jabatan === filterValue && filteredIdentifiers.includes(record.identifier)
        );
      } else {
        if (filterType === 'guru') {
          attendanceRecords = attendanceRecords.filter(record => record.sebagai === 'Guru');
        } else if (filterType === 'siswa') {
          attendanceRecords = attendanceRecords.filter(record => record.sebagai === 'Siswa');
        }
      }

      setAttendanceData(attendanceRecords);

      const dailyData = generateDailyAttendance(filteredPeople, attendanceRecords, daysInSelectedMonth, filterType);
      setDailyAttendanceData(dailyData);

      if (filterType === 'siswa' && !filterValue) {
        const grouped = groupByClass(dailyData);
        setGroupedData(grouped);
      } else {
        setGroupedData({});
      }

    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateDailyAttendance = (allPeople, attendanceRecords, daysInMonth, filterType) => {
    const attendanceMap = {};

    allPeople.forEach(person => {
      const key = `${person.nisn || person.niy}-${person.nama}`;
      attendanceMap[key] = {
        identifier: person.nisn || person.niy,
        nama: person.nama,
        jabatan: person.jabatan,
        sebagai: person.sebagai,
        dailyStatus: {},
        summary: {
          hadir: 0,
          sakit: 0,
          izin: 0,
          tanpaKeterangan: 0,
          totalKehadiran: 0,
          totalTidakHadir: 0,
          tepatWaktu: 0,
          tahap1: 0,
          tahap2: 0,
          dinasLuar: 0
        }
      };
    });

    Object.keys(attendanceMap).forEach(key => {
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        const checkDate = new Date(selectedYear, selectedMonth - 1, day);
        const currentDate = new Date();
        const isFutureDate = checkDate > currentDate;
        const isWeekend = checkDate.getDay() === 0 || checkDate.getDay() === 6;
        const dayHasAnyAttendance = attendanceRecords.some(r => r.tanggal === dateStr);
        const isHoliday = !dayHasAnyAttendance && !isFutureDate;

        if (isFutureDate || isWeekend || isHoliday) {
          attendanceMap[key].dailyStatus[day] = '';
          continue;
        }

        const dayAttendanceRecords = attendanceRecords.filter(r =>
          r.identifier === attendanceMap[key].identifier &&
          r.tanggal === dateStr
        );
        const hasAttendanceRecord = dayAttendanceRecords.length > 0;

        let status = '';
        if (hasAttendanceRecord) {
          const attendanceRecord = dayAttendanceRecords[0];
          const recordStatus = attendanceRecord.status;

          if (recordStatus && ['TW', 'T1', 'T2', 'H'].includes(recordStatus)) {
            status = recordStatus;
            if (status === 'TW') {
              attendanceMap[key].summary.tepatWaktu++;
              attendanceMap[key].summary.hadir++;
              attendanceMap[key].summary.totalKehadiran++;
            } else if (status === 'T1') {
              attendanceMap[key].summary.tahap1++;
              attendanceMap[key].summary.hadir++;
              attendanceMap[key].summary.totalKehadiran++;
            } else if (status === 'T2') {
              attendanceMap[key].summary.tahap2++;
              attendanceMap[key].summary.hadir++;
              attendanceMap[key].summary.totalKehadiran++;
            } else if (status === 'H') {
              attendanceMap[key].summary.hadir++;
              attendanceMap[key].summary.totalKehadiran++;
            }
          } else {
            const statusLower = attendanceRecord.status?.toLowerCase();
            if (['datang', 'hadir', 'present', 'masuk'].includes(statusLower)) {
              const personType = attendanceMap[key].sebagai.toLowerCase();
              const personJabatan = attendanceMap[key].jabatan;
              const timeStatus = getAttendanceStatus(attendanceRecord.jam, personType, personJabatan);

              if (timeStatus === 'tepatwaktu') {
                status = 'TW';
                attendanceMap[key].summary.tepatWaktu++;
                attendanceMap[key].summary.hadir++;
                attendanceMap[key].summary.totalKehadiran++;
              } else if (timeStatus === 'tahap1') {
                status = 'T1';
                attendanceMap[key].summary.tahap1++;
                attendanceMap[key].summary.hadir++;
                attendanceMap[key].summary.totalKehadiran++;
              } else if (timeStatus === 'tahap2') {
                status = 'T2';
                attendanceMap[key].summary.tahap2++;
                attendanceMap[key].summary.hadir++;
                attendanceMap[key].summary.totalKehadiran++;
              }
            }
          }
        } else {
          status = 'TK';
          attendanceMap[key].summary.tanpaKeterangan++;
        }
        attendanceMap[key].dailyStatus[day] = status;
      }
    });

    return Object.values(attendanceMap);
  };

  const groupByClass = (data) => {
    const grouped = {};
    data.forEach(student => {
      const className = student.jabatan;
      if (!grouped[className]) {
        grouped[className] = [];
      }
      grouped[className].push(student);
    });
    return grouped;
  };

  const getAttendanceStatus = (attendanceTime, personType, personJabatan) => {
    if (!attendanceTime) return 'tidak hadir';

    const [hours, minutes] = attendanceTime.split(':').map(Number);
    const attendanceMinutes = hours * 60 + minutes;

    const jabatanSettings = attendanceSettings.filter(setting =>
      setting.type === 'jabatan' && setting.jabatan === personJabatan
    );

    if (jabatanSettings.length > 0) {
      for (const setting of jabatanSettings) {
        const [startHours, startMinutes] = setting.start_time.split(':').map(Number);
        const [endHours, endMinutes] = setting.end_time.split(':').map(Number);
        const startTotal = startHours * 60 + startMinutes;
        const endTotal = endHours * 60 + endMinutes;

        if (attendanceMinutes >= startTotal && attendanceMinutes < endTotal) {
          return setting.label.toLowerCase().replace(' ', '');
        }
      }
    }

    const relevantSettings = attendanceSettings.filter(setting => setting.type === personType);

    for (const setting of relevantSettings) {
      const [startHours, startMinutes] = setting.start_time.split(':').map(Number);
      const [endHours, endMinutes] = setting.end_time.split(':').map(Number);
      const startTotal = startHours * 60 + startMinutes;
      const endTotal = endHours * 60 + endMinutes;

      if (attendanceMinutes >= startTotal && attendanceMinutes < endTotal) {
        return setting.label.toLowerCase().replace(' ', '');
      }
    }

    return 'tidak hadir';
  };

  const generatePDF = () => {
    // PDF generation logic would go here
    alert('Fitur PDF untuk Rekap Datang akan diimplementasikan');
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        📊 Rekap Datang - Mode: {mode}
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Rekapitulasi hanya untuk absensi DATANG (TW/T1/T2)
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🔍 Filter Laporan
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth>
                <InputLabel>Tahun</InputLabel>
                <Select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  label="Tahun"
                >
                  {years.map(year => (
                    <MenuItem key={year} value={year}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth>
                <InputLabel>Bulan</InputLabel>
                <Select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  label="Bulan"
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
                <InputLabel>Tipe Filter</InputLabel>
                <Select
                  value={filterType}
                  onChange={(e) => {
                    const newFilterType = e.target.value;
                    setFilterType(newFilterType);
                    setFilterValue('');
                  }}
                  label="Tipe Filter"
                >
                   <MenuItem value="guru">GURU</MenuItem>
                   <MenuItem value="siswa">SISWA</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>
                  {filterType === 'guru' ? 'Filter Guru' : 'Filter Siswa'}
                </InputLabel>
                <Select
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  label={filterType === 'guru' ? 'Filter Guru' : 'Filter Siswa'}
                >
                  {filterType === 'guru' && (
                    <MenuItem value="">Semua Guru</MenuItem>
                  )}
                  {availableFilters.map(filter => (
                    <MenuItem key={filter} value={filter}>
                      {filter}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="contained"
                startIcon={<PictureAsPdfIcon />}
                onClick={generatePDF}
                disabled={dailyAttendanceData.length === 0 || loading}
                fullWidth
              >
                Generate PDF
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {dailyAttendanceData.length > 0 ? (
        <>
          {filterType === 'siswa' && filterValue && (
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}>
              📚 {filterValue}
            </Typography>
          )}
          <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table sx={{ minWidth: 1200 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 50 }}>No</TableCell>
                <TableCell sx={{ minWidth: 200 }}>Nama</TableCell>
                {Array.from({ length: daysInMonth }, (_, i) => (
                  <TableCell key={i + 1} align="center" sx={{ minWidth: 30, fontSize: '0.8rem' }}>
                    {i + 1}
                  </TableCell>
                ))}
                <TableCell align="center" sx={{ minWidth: 60, fontSize: '0.8rem' }}>Hadir</TableCell>
                <TableCell align="center" sx={{ minWidth: 80, fontSize: '0.8rem' }}>Tanpa Keterangan</TableCell>
                <TableCell align="center" sx={{ minWidth: 60, fontSize: '0.8rem' }}>Tepat Waktu</TableCell>
                <TableCell align="center" sx={{ minWidth: 50, fontSize: '0.8rem' }}>Tahap 1</TableCell>
                <TableCell align="center" sx={{ minWidth: 50, fontSize: '0.8rem' }}>Tahap 2</TableCell>
                <TableCell align="center" sx={{ minWidth: 80, fontSize: '0.8rem' }}>Total Kehadiran</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dailyAttendanceData.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 'medium' }}>{item.nama}</TableCell>
                  {Array.from({ length: daysInMonth }, (_, dayIndex) => {
                    const day = dayIndex + 1;
                    const status = item.dailyStatus[day] || '';

                    const checkDate = new Date(selectedYear, selectedMonth - 1, day);
                    const currentDate = new Date();
                    const isFutureDate = checkDate > currentDate;
                    const isWeekend = checkDate.getDay() === 0 || checkDate.getDay() === 6;

                    return (
                      <TableCell
                        key={day}
                        align="center"
                        sx={{
                          fontSize: '0.75rem',
                          padding: '4px',
                          minWidth: 30,
                          backgroundColor: status === 'TW' ? '#e8f5e8' :
                                          status === 'T1' ? '#e8f5e8' :
                                          status === 'T2' ? '#e8f5e8' :
                                          status === 'H' ? '#e8f5e8' :
                                          status === 'TK' ? '#ffebee' : 'transparent'
                        }}
                      >
                        {status}
                      </TableCell>
                    );
                  })}
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                    {item.summary.hadir}
                  </TableCell>
                  <TableCell align="center">{item.summary.tanpaKeterangan}</TableCell>
                  <TableCell align="center">{item.summary.tepatWaktu}</TableCell>
                  <TableCell align="center">{item.summary.tahap1}</TableCell>
                  <TableCell align="center">{item.summary.tahap2}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', backgroundColor: '#e3f2fd' }}>
                    {item.summary.totalKehadiran}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        </>
      ) : (
        <Alert severity="info">
          {loading ? 'Memuat data...' : 'Tidak ada data absensi DATANG untuk periode dan filter yang dipilih'}
        </Alert>
      )}
    </Box>
  );
};

export default RekapDatang;