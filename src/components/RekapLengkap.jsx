import React, { useState, useEffect, Fragment } from 'react';
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
  Alert,
  Popover,
  ButtonGroup
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { db } from '../database';

const RekapLengkap = ({ mode }) => {
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
  const [editingCell, setEditingCell] = useState(null);
  const [editPopoverAnchor, setEditPopoverAnchor] = useState(null);

  // New state for rekap mode
  const [rekapMode, setRekapMode] = useState('lengkap'); // 'datang', 'pulang', 'lengkap'

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

    window.refreshRekapLengkap = generateReport;

    return () => {
      delete window.refreshRekapLengkap;
    };
  }, []);

  useEffect(() => {
    generateReport();
  }, [selectedMonth, selectedYear, filterType, filterValue, rekapMode]);

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

      // Filter by attendance type based on rekap mode
      if (rekapMode === 'datang') {
        attendanceRecords = attendanceRecords.filter(record => record.att === 'Datang');
      } else if (rekapMode === 'pulang') {
        attendanceRecords = attendanceRecords.filter(record => record.att === 'Pulang');
      }
      // For 'lengkap', include all records (Datang + Pulang)

      // Filter by type (guru/siswa)
      if (filterType === 'guru') {
        attendanceRecords = attendanceRecords.filter(record => record.sebagai === 'Guru');
      } else if (filterType === 'siswa') {
        attendanceRecords = attendanceRecords.filter(record => record.sebagai === 'Siswa');
      }

      let allPerizinanRecords = await db.perizinan.toArray();
      let perizinanRecords = allPerizinanRecords.filter(record => {
        const recordDate = record.tanggal;
        let dateStr;

        if (!isNaN(recordDate) && !isNaN(parseFloat(recordDate))) {
          const serialDate = parseInt(recordDate);
          const excelEpoch = new Date(1900, 0, 1);
          const jsDate = new Date(excelEpoch.getTime() + (serialDate - 2) * 24 * 60 * 60 * 1000);
          dateStr = jsDate.toISOString().split('T')[0];
        } else {
          dateStr = recordDate.split('T')[0] || recordDate.split(' ')[0];
        }

        return dateStr >= startDate && dateStr <= endDate;
      });

      perizinanRecords = perizinanRecords.filter(record =>
        (filterType === 'guru' && record.sebagai === 'Guru') ||
        (filterType === 'siswa' && record.sebagai === 'Siswa')
      );

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

      const dailyData = generateDailyAttendance(filteredPeople, attendanceRecords, perizinanRecords, daysInSelectedMonth, filterType);
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

  const generateDailyAttendance = (allPeople, attendanceRecords, perizinanRecords, daysInMonth, filterType) => {
    const attendanceMap = {};

    allPeople.forEach(person => {
      const key = `${person.nisn || person.niy}-${person.nama}`;
      attendanceMap[key] = {
        identifier: person.nisn || person.niy,
        nama: person.nama,
        jabatan: person.jabatan,
        sebagai: person.sebagai,
        dailyStatus: rekapMode === 'lengkap' ? {} : {}, // For lengkap mode, we'll use different structure
        dailyDatang: rekapMode === 'lengkap' ? {} : null, // Only for lengkap mode
        dailyPulang: rekapMode === 'lengkap' ? {} : null, // Only for lengkap mode
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
          if (rekapMode === 'lengkap') {
            attendanceMap[key].dailyDatang[day] = '';
            attendanceMap[key].dailyPulang[day] = '';
          } else {
            attendanceMap[key].dailyStatus[day] = '';
          }
          continue;
        }

        // Get perizinan record for this person and date
        const perizinanRecord = perizinanRecords.find(r => {
          const normalizeName = (name) => {
            return name.trim().toLowerCase()
              .replace(/\s+/g, ' ')
              .replace(/,?\s*(s\.?\s*pd\.?\s*i?|s\.?\s*pd|dr\.?|prof\.?|hj\.?|ny\.?)/gi, '')
              .trim();
          };
          const perizinanName = normalizeName(r.nama);
          const attendanceName = normalizeName(attendanceMap[key].nama);

          let perizinanDateStr = r.tanggal;
          if (!isNaN(r.tanggal) && !isNaN(parseFloat(r.tanggal))) {
            const serialDate = parseInt(r.tanggal);
            const excelEpoch = new Date(1900, 0, 1);
            const jsDate = new Date(excelEpoch.getTime() + (serialDate - 2) * 24 * 60 * 60 * 1000);
            perizinanDateStr = jsDate.toISOString().split('T')[0];
          } else if (typeof r.tanggal === 'string') {
            perizinanDateStr = r.tanggal.split('T')[0] || r.tanggal.split(' ')[0];
          }

          const nameMatch = perizinanName === attendanceName;
          const dateMatch = perizinanDateStr === dateStr;

          return nameMatch && dateMatch;
        });

        if (rekapMode === 'lengkap') {
          // Handle lengkap mode with separate datang and pulang columns
          const datangRecords = attendanceRecords.filter(r =>
            r.identifier === attendanceMap[key].identifier &&
            r.tanggal === dateStr &&
            r.att === 'Datang'
          );

          const pulangRecords = attendanceRecords.filter(r =>
            r.identifier === attendanceMap[key].identifier &&
            r.tanggal === dateStr &&
            r.att === 'Pulang'
          );

          // Process DATANG column
          let datangStatus = '';
          if (datangRecords.length > 0) {
            const record = datangRecords[0];
            datangStatus = getStatusForRecord(record, 'datang');
          } else if (perizinanRecord) {
            datangStatus = getPerizinanStatus(perizinanRecord, dateStr, selectedYear, selectedMonth, day);
          } else {
            datangStatus = 'TK';
          }

          // Process PULANG column
          let pulangStatus = '';
          if (pulangRecords.length > 0) {
            pulangStatus = 'P'; // Always show P for pulang records
          } else if (perizinanRecord) {
            pulangStatus = getPerizinanStatus(perizinanRecord, dateStr, selectedYear, selectedMonth, day);
          } else {
            pulangStatus = 'TK';
          }

          attendanceMap[key].dailyDatang[day] = datangStatus;
          attendanceMap[key].dailyPulang[day] = pulangStatus;

          // Update summary counts
          updateSummaryCounts(attendanceMap[key].summary, datangStatus, 'datang');
          updateSummaryCounts(attendanceMap[key].summary, pulangStatus, 'pulang');

        } else {
          // Handle datang/pulang only modes
          const dayAttendanceRecords = attendanceRecords.filter(r =>
            r.identifier === attendanceMap[key].identifier &&
            r.tanggal === dateStr
          );
          const hasAttendanceRecord = dayAttendanceRecords.length > 0;

          let status = '';
          if (hasAttendanceRecord) {
            const attendanceRecord = dayAttendanceRecords[0];
            status = getStatusForRecord(attendanceRecord, rekapMode);
          } else if (perizinanRecord) {
            status = getPerizinanStatus(perizinanRecord, dateStr, selectedYear, selectedMonth, day);
          } else {
            status = 'TK';
          }

          attendanceMap[key].dailyStatus[day] = status;
          updateSummaryCounts(attendanceMap[key].summary, status, rekapMode);
        }
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
    alert('Fitur PDF untuk Rekap Lengkap akan diimplementasikan');
  };

  const handleCellClick = (event, personIndex, day) => {
    const checkDate = new Date(selectedYear, selectedMonth - 1, day);
    const currentDate = new Date();
    const isFutureDate = checkDate > currentDate;
    const isWeekend = checkDate.getDay() === 0 || checkDate.getDay() === 6;

    if (isFutureDate || isWeekend) {
      return;
    }

    setEditingCell({ personIndex, day });
    setEditPopoverAnchor(event.currentTarget);
  };

  const handleStatusChange = async (newStatus) => {
    if (!editingCell) return;

    const { personIndex, day } = editingCell;
    const person = dailyAttendanceData[personIndex];
    const dateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

    try {
      const existingAttendance = await db.attendance.where('[identifier+tanggal]').equals([person.identifier, dateStr]).first();
      const existingPerizinan = await db.perizinan.where('[identifier+tanggal]').equals([person.identifier, dateStr]).first();

      if (newStatus === 'TK' || newStatus === '') {
        if (existingAttendance) {
          await db.attendance.delete(existingAttendance.id);
        }
        if (existingPerizinan) {
          await db.perizinan.delete(existingPerizinan.id);
        }
      } else {
        if (['DL', 'I', 'S'].includes(newStatus)) {
          if (existingAttendance) {
            await db.attendance.delete(existingAttendance.id);
          }

          const jenisIzin = newStatus === 'DL' ? 'Dinas Luar' :
                           newStatus === 'I' ? 'Izin' : 'Sakit';

          if (existingPerizinan) {
            await db.perizinan.update(existingPerizinan.id, {
              jenis_izin: jenisIzin,
              keterangan: `Updated via Rekap Lengkap - ${jenisIzin}`
            });
          } else {
            await db.perizinan.add({
              tanggal: dateStr,
              tanggal_mulai: dateStr,
              tanggal_selesai: dateStr,
              identifier: person.identifier,
              nama: person.nama,
              jabatan: person.jabatan,
              sebagai: person.sebagai,
              jenis_izin: jenisIzin,
              keterangan: `Updated via Rekap Lengkap - ${jenisIzin}`,
              wa: person.wa || '',
              email: person.email || ''
            });
          }
        } else {
          if (existingPerizinan) {
            await db.perizinan.delete(existingPerizinan.id);
          }

          const att = ['TW', 'T1', 'T2'].includes(newStatus) ? 'Datang' : 'Pulang';
          const keterangan = newStatus === 'TW' ? 'Tepat Waktu' :
                            newStatus === 'T1' ? 'Tahap 1' :
                            newStatus === 'T2' ? 'Tahap 2' : 'Hadir';

          let jam = '00:00';
          if (['TW', 'T1', 'T2'].includes(newStatus)) {
            jam = getLatestTimeForStatus(newStatus, person.sebagai, person.jabatan);
          }

          if (existingAttendance) {
            await db.attendance.update(existingAttendance.id, {
              jam: jam,
              status: newStatus,
              keterangan: keterangan,
              att: att
            });
          } else {
            await db.attendance.add({
              tanggal: dateStr,
              identifier: person.identifier,
              nama: person.nama,
              jabatan: person.jabatan,
              sebagai: person.sebagai,
              jam: jam,
              status: newStatus,
              keterangan: keterangan,
              att: att,
              wa: person.wa || '',
              email: person.email || ''
            });
          }
        }
      }

      setEditPopoverAnchor(null);
      setEditingCell(null);
      generateReport();

      if (window.refreshAbsensi) {
        window.refreshAbsensi();
      }

    } catch (error) {
      console.error('Error updating attendance status:', error);
      alert('Gagal mengupdate status absensi: ' + error.message);
    }
  };

  const getStatusForRecord = (record, mode) => {
    const recordStatus = record.status;

    if (recordStatus && ['TW', 'T1', 'T2', 'H', 'I', 'S'].includes(recordStatus)) {
      return recordStatus;
    } else {
      const statusLower = record.status?.toLowerCase();
      if (['datang', 'hadir', 'present', 'masuk'].includes(statusLower)) {
        if (mode === 'datang') {
          const personType = record.sebagai.toLowerCase();
          const personJabatan = record.jabatan;
          const timeStatus = getAttendanceStatus(record.jam, personType, personJabatan);
          if (timeStatus === 'tepatwaktu') return 'TW';
          else if (timeStatus === 'tahap1') return 'T1';
          else if (timeStatus === 'tahap2') return 'T2';
          else return 'H';
        } else if (mode === 'pulang') {
          return 'P';
        }
      } else if (statusLower === 'izin') return 'I';
      else if (statusLower === 'sakit') return 'S';
      else return 'TK';
    }
  };

  const getPerizinanStatus = (perizinanRecord, dateStr, selectedYear, selectedMonth, day) => {
    const jenisIzin = (perizinanRecord.jenis_izin || '').toLowerCase().trim();

    if (jenisIzin === 'dinas luar') {
      return 'DL';
    } else if (jenisIzin === 'sakit') {
      return 'S';
    } else if (jenisIzin === 'izin') {
      return 'I';
    } else if (jenisIzin === 'cuti') {
      return 'C';
    } else if (jenisIzin === 'sakit') {
      const tanggalMulai = perizinanRecord.tanggal_mulai;
      const tanggalSelesai = perizinanRecord.tanggal_selesai;

      if (tanggalMulai && tanggalSelesai && tanggalMulai !== tanggalSelesai) {
        const currentDate = new Date(selectedYear, selectedMonth - 1, day);
        const startDate = new Date(tanggalMulai);
        const endDate = new Date(tanggalSelesai);

        if (currentDate >= startDate && currentDate <= endDate) {
          if (jenisIzin === 'sakit') return 'S';
          else if (jenisIzin === 'cuti') return 'C';
          else return 'I';
        } else {
          return 'TK';
        }
      } else {
        if (jenisIzin === 'sakit') return 'S';
        else if (jenisIzin === 'cuti') return 'C';
        else return 'I';
      }
    } else {
      return 'TK';
    }
  };

  const updateSummaryCounts = (summary, status, mode) => {
    if (status === 'TW' || status === 'T1' || status === 'T2') {
      if (mode === 'datang' || mode === 'lengkap') {
        summary.tepatWaktu += status === 'TW' ? 1 : 0;
        summary.tahap1 += status === 'T1' ? 1 : 0;
        summary.tahap2 += status === 'T2' ? 1 : 0;
        summary.hadir++;
        summary.totalKehadiran++;
      }
    } else if (status === 'H' || status === 'P') {
      summary.hadir++;
      summary.totalKehadiran++;
    } else if (status === 'DL') {
      summary.dinasLuar++;
      summary.hadir++;
      summary.totalKehadiran++;
    } else if (status === 'I') {
      summary.izin++;
      summary.totalTidakHadir++;
    } else if (status === 'S') {
      summary.sakit++;
      summary.totalTidakHadir++;
    } else if (status === 'C') {
      summary.izin++; // Cuti counted as izin
      summary.totalTidakHadir++;
    } else if (status === 'TK') {
      summary.tanpaKeterangan++;
    }
  };

  const getLatestTimeForStatus = (status, personType, personJabatan) => {
    const jabatanSettings = attendanceSettings.filter(setting =>
      setting.type === 'jabatan' && setting.jabatan === personJabatan
    );

    if (jabatanSettings.length > 0) {
      for (const setting of jabatanSettings) {
        const label = setting.label.toLowerCase().replace(' ', '');
        if ((status === 'TW' && label === 'tepatwaktu') ||
            (status === 'T1' && label === 'tahap1') ||
            (status === 'T2' && label === 'tahap2')) {
          return setting.end_time;
        }
      }
    }

    const relevantSettings = attendanceSettings.filter(setting => setting.type === personType);

    for (const setting of relevantSettings) {
      const label = setting.label.toLowerCase().replace(' ', '');
      if ((status === 'TW' && label === 'tepatwaktu') ||
          (status === 'T1' && label === 'tahap1') ||
          (status === 'T2' && label === 'tahap2')) {
        return setting.end_time;
      }
    }

    if (status === 'TW') return '07:30';
    if (status === 'T1') return '08:00';
    if (status === 'T2') return '12:00';

    return '00:00';
  };

  const handleClosePopover = () => {
    setEditPopoverAnchor(null);
    setEditingCell(null);
  };

  const getRekapModeTitle = () => {
    switch (rekapMode) {
      case 'datang': return 'Rekap Datang';
      case 'pulang': return 'Rekap Pulang';
      case 'lengkap': return 'Rekap Lengkap';
      default: return 'Rekap Lengkap';
    }
  };

  const getRekapModeDescription = () => {
    switch (rekapMode) {
      case 'datang': return 'Rekapitulasi hanya untuk absensi DATANG (TW/T1/T2)';
      case 'pulang': return 'Rekapitulasi hanya untuk absensi PULANG';
      case 'lengkap': return 'Rekapitulasi lengkap DATANG + PULANG + PERIZINAN';
      default: return 'Rekapitulasi lengkap DATANG + PULANG + PERIZINAN';
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        📊 {getRekapModeTitle()} - Mode: {mode}
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        {getRekapModeDescription()}
      </Typography>

      {/* Mode Selection Buttons */}
      <Box sx={{ mb: 3 }}>
        <ButtonGroup variant="contained" aria-label="rekap mode selection">
          <Button
            onClick={() => setRekapMode('datang')}
            variant={rekapMode === 'datang' ? 'contained' : 'outlined'}
            color="primary"
          >
            Rekap Datang
          </Button>
          <Button
            onClick={() => setRekapMode('pulang')}
            variant={rekapMode === 'pulang' ? 'contained' : 'outlined'}
            color="secondary"
          >
            Rekap Pulang
          </Button>
          <Button
            onClick={() => setRekapMode('lengkap')}
            variant={rekapMode === 'lengkap' ? 'contained' : 'outlined'}
            color="success"
          >
            Rekap Lengkap
          </Button>
        </ButtonGroup>
      </Box>

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

      {rekapMode === 'lengkap' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Informasi Rekap Lengkap:</strong><br/>
            • Kolom <strong style={{color: '#1976d2'}}>DATANG</strong> menampilkan: TW, T1, T2, DL, TK, I, S, C<br/>
            • Kolom <strong style={{color: '#dc004e'}}>PULANG</strong> menampilkan: P (Pulang), TK (Tidak absen pulang), DL, I, S, C<br/>
            • Klik sel untuk mengedit status absensi
          </Typography>
        </Alert>
      )}

      {dailyAttendanceData.length > 0 ? (
        <>
          {filterType === 'siswa' && filterValue && (
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}>
              📚 {filterValue}
            </Typography>
          )}
          <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table sx={{ minWidth: rekapMode === 'lengkap' ? 1600 : 1200 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 50 }}>No</TableCell>
                <TableCell sx={{ minWidth: 200 }}>Nama</TableCell>
                {rekapMode === 'lengkap' ? (
                  // Lengkap mode: 2 columns per day (Datang + Pulang)
                  Array.from({ length: daysInMonth }, (_, i) => (
                    <React.Fragment key={i + 1}>
                      <TableCell align="center" sx={{
                        minWidth: 25,
                        fontSize: '0.7rem',
                        backgroundColor: '#e3f2fd',
                        color: '#1976d2',
                        fontWeight: 'bold',
                        borderRight: '2px solid #1976d2'
                      }}>
                        {i + 1}<br/>DATANG
                      </TableCell>
                      <TableCell align="center" sx={{
                        minWidth: 25,
                        fontSize: '0.7rem',
                        backgroundColor: '#fce4ec',
                        color: '#dc004e',
                        fontWeight: 'bold'
                      }}>
                        {i + 1}<br/>PULANG
                      </TableCell>
                    </React.Fragment>
                  ))
                ) : (
                  // Datang/Pulang only modes: 1 column per day
                  Array.from({ length: daysInMonth }, (_, i) => (
                    <TableCell key={i + 1} align="center" sx={{ minWidth: 30, fontSize: '0.8rem' }}>
                      {i + 1}
                    </TableCell>
                  ))
                )}
                <TableCell align="center" sx={{ minWidth: 60, fontSize: '0.8rem' }}>Hadir</TableCell>
                <TableCell align="center" sx={{ minWidth: 40, fontSize: '0.8rem' }}>Izin</TableCell>
                <TableCell align="center" sx={{ minWidth: 40, fontSize: '0.8rem' }}>Sakit</TableCell>
                <TableCell align="center" sx={{ minWidth: 80, fontSize: '0.8rem' }}>TIDAK HADIR</TableCell>
                <TableCell align="center" sx={{ minWidth: 80, fontSize: '0.8rem' }}>Tanpa Keterangan</TableCell>
                {rekapMode !== 'pulang' && (
                  <>
                    <TableCell align="center" sx={{ minWidth: 60, fontSize: '0.8rem' }}>Tepat Waktu</TableCell>
                    <TableCell align="center" sx={{ minWidth: 50, fontSize: '0.8rem' }}>Tahap 1</TableCell>
                    <TableCell align="center" sx={{ minWidth: 50, fontSize: '0.8rem' }}>Tahap 2</TableCell>
                  </>
                )}
                <TableCell align="center" sx={{ minWidth: 60, fontSize: '0.8rem' }}>Dinas Luar</TableCell>
                <TableCell align="center" sx={{ minWidth: 80, fontSize: '0.8rem' }}>Total Kehadiran</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dailyAttendanceData.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 'medium' }}>{item.nama}</TableCell>
                  {rekapMode === 'lengkap' ? (
                    // Lengkap mode: 2 columns per day
                    Array.from({ length: daysInMonth }, (_, dayIndex) => {
                      const day = dayIndex + 1;
                      const datangStatus = item.dailyDatang[day] || '';
                      const pulangStatus = item.dailyPulang[day] || '';

                      return (
                        <React.Fragment key={day}>
                          <TableCell
                            align="center"
                            sx={{
                              fontSize: '0.7rem',
                              padding: '2px',
                              minWidth: 25,
                              backgroundColor: datangStatus === 'TW' || datangStatus === 'T1' || datangStatus === 'T2' ? '#e8f5e8' :
                                              datangStatus === 'DL' ? '#e0f2f1' :
                                              datangStatus === 'I' ? '#fff3e0' :
                                              datangStatus === 'S' ? '#fce4ec' :
                                              datangStatus === 'C' ? '#f3e5f5' :
                                              datangStatus === 'TK' ? '#ffebee' : 'transparent',
                              borderRight: '1px solid #1976d2'
                            }}
                          >
                            {datangStatus}
                          </TableCell>
                          <TableCell
                            align="center"
                            sx={{
                              fontSize: '0.7rem',
                              padding: '2px',
                              minWidth: 25,
                              backgroundColor: pulangStatus === 'P' ? '#fce4ec' :
                                              pulangStatus === 'DL' ? '#e0f2f1' :
                                              pulangStatus === 'I' ? '#fff3e0' :
                                              pulangStatus === 'S' ? '#fce4ec' :
                                              pulangStatus === 'C' ? '#f3e5f5' :
                                              pulangStatus === 'TK' ? '#ffebee' : 'transparent'
                            }}
                          >
                            {pulangStatus}
                          </TableCell>
                        </React.Fragment>
                      );
                    })
                  ) : (
                    // Datang/Pulang only modes: 1 column per day
                    Array.from({ length: daysInMonth }, (_, dayIndex) => {
                      const day = dayIndex + 1;
                      const status = item.dailyStatus[day] || '';

                      const checkDate = new Date(selectedYear, selectedMonth - 1, day);
                      const currentDate = new Date();
                      const isFutureDate = checkDate > currentDate;
                      const isWeekend = checkDate.getDay() === 0 || checkDate.getDay() === 6;
                      const canEdit = !isFutureDate && !isWeekend && rekapMode === 'lengkap';

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
                                            status === 'P' ? '#fce4ec' :
                                            status === 'DL' ? '#e0f2f1' :
                                            status === 'I' ? '#fff3e0' :
                                            status === 'S' ? '#fce4ec' :
                                            status === 'C' ? '#f3e5f5' :
                                            status === 'TK' ? '#ffebee' : 'transparent',
                            cursor: canEdit ? 'pointer' : 'default',
                            '&:hover': canEdit ? { opacity: 0.7 } : {}
                          }}
                          onClick={(event) => canEdit && handleCellClick(event, index, day)}
                        >
                          {status}
                        </TableCell>
                      );
                    })
                  )}
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                    {item.summary.hadir}
                  </TableCell>
                  <TableCell align="center">{item.summary.izin}</TableCell>
                  <TableCell align="center">{item.summary.sakit}</TableCell>
                  <TableCell align="center">{item.summary.totalTidakHadir}</TableCell>
                  <TableCell align="center">{item.summary.tanpaKeterangan}</TableCell>
                  {rekapMode !== 'pulang' && (
                    <>
                      <TableCell align="center">{item.summary.tepatWaktu}</TableCell>
                      <TableCell align="center">{item.summary.tahap1}</TableCell>
                      <TableCell align="center">{item.summary.tahap2}</TableCell>
                    </>
                  )}
                  <TableCell align="center">{item.summary.dinasLuar}</TableCell>
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
          {loading ? 'Memuat data...' : `Tidak ada data absensi ${rekapMode === 'datang' ? 'DATANG' : rekapMode === 'pulang' ? 'PULANG' : ''} untuk periode dan filter yang dipilih`}
        </Alert>
      )}

      <Popover
        open={Boolean(editPopoverAnchor)}
        anchorEl={editPopoverAnchor}
        onClose={handleClosePopover}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        <Box sx={{ p: 2, minWidth: 200 }}>
          <Typography variant="subtitle2" gutterBottom>
            Ubah Status Absensi
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={editingCell ? dailyAttendanceData[editingCell.personIndex]?.dailyStatus[editingCell.day] || '' : ''}
              onChange={(e) => handleStatusChange(e.target.value)}
              label="Status"
            >
              <MenuItem value="">
                <em>Kosongkan</em>
              </MenuItem>
              <MenuItem value="TW">TW - Tepat Waktu</MenuItem>
              <MenuItem value="T1">T1 - Tahap 1</MenuItem>
              <MenuItem value="T2">T2 - Tahap 2</MenuItem>
              <MenuItem value="H">H - Hadir</MenuItem>
              <MenuItem value="DL">DL - Dinas Luar</MenuItem>
              <MenuItem value="I">I - Izin</MenuItem>
              <MenuItem value="S">S - Sakit</MenuItem>
              <MenuItem value="TK">TK - Tanpa Keterangan</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Popover>
    </Box>
  );
};

export default RekapLengkap;