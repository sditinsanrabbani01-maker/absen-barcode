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
  Alert,
  Popover
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { db } from '../database';
import { DateTimeUtils } from '../utils/dateTime';
import jsPDF from 'jspdf';

const RekapAbsen = ({ mode }) => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1); // Default to current month
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear()); // Default to current year
  const [filterType, setFilterType] = useState('guru'); // 'guru' or 'siswa'
  const [filterValue, setFilterValue] = useState('');
  const [attendanceData, setAttendanceData] = useState([]);
  const [dailyAttendanceData, setDailyAttendanceData] = useState([]);
  const [groupedData, setGroupedData] = useState({});
  const [schoolSettings, setSchoolSettings] = useState({});
  const [attendanceSettings, setAttendanceSettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [availableFilters, setAvailableFilters] = useState([]);
  const [editingCell, setEditingCell] = useState(null); // {personIndex, day}
  const [editPopoverAnchor, setEditPopoverAnchor] = useState(null);

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

    // Register global refresh function
    window.refreshRekapAbsen = generateReport;

    return () => {
      delete window.refreshRekapAbsen;
    };
  }, []);

  useEffect(() => {
    generateReport();
  }, [selectedMonth, selectedYear, filterType, filterValue]);

  useEffect(() => {
    loadAvailableFilters();
  }, [filterType]);


  useEffect(() => {
    // Auto-select first class when SISWA is selected and filters are loaded
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
    const filters = await getAvailableFilters();
    setAvailableFilters(filters);
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      // Calculate days in month using local timezone
      const daysInSelectedMonth = DateTimeUtils.getWorkingDaysInMonth(selectedYear, selectedMonth);
      setDaysInMonth(daysInSelectedMonth);

      // Get attendance data for selected month/year using local timezone
      const { startDate, endDate } = DateTimeUtils.getMonthBounds(selectedYear, selectedMonth);

      // Get all attendance records and filter by date using local timezone
      let allAttendanceRecords = await db.attendance.toArray();
      let attendanceRecords = allAttendanceRecords.filter(record => {
        let recordDate = record.tanggal;
        // Handle different date formats and convert to local timezone
        if (!isNaN(recordDate) && !isNaN(parseFloat(recordDate))) {
          // Excel serial date
          const serialDate = parseInt(recordDate);
          const excelEpoch = new Date(1900, 0, 1);
          const utcDate = new Date(excelEpoch.getTime() + (serialDate - 2) * 24 * 60 * 60 * 1000);
          recordDate = DateTimeUtils.utcToLocalDate(utcDate);
        } else if (typeof recordDate === 'string') {
          recordDate = DateTimeUtils.utcToLocalDate(recordDate);
        }
        return recordDate >= startDate && recordDate <= endDate;
      });

      // Filter attendance records by type (guru/siswa)
      if (filterType === 'guru') {
        attendanceRecords = attendanceRecords.filter(record => record.sebagai === 'Guru');
      } else if (filterType === 'siswa') {
        attendanceRecords = attendanceRecords.filter(record => record.sebagai === 'Siswa');
      }

      // Get all perizinan records and filter by date using local timezone
      let allPerizinanRecords = await db.perizinan.toArray();
      let perizinanRecords = allPerizinanRecords.filter(record => {
        let recordDate = record.tanggal;
        let dateStr;

        // Handle Excel serial dates (numbers) - convert to local timezone
        if (!isNaN(recordDate) && !isNaN(parseFloat(recordDate))) {
          const serialDate = parseInt(recordDate);
          const excelEpoch = new Date(1900, 0, 1);
          const utcDate = new Date(excelEpoch.getTime() + (serialDate - 2) * 24 * 60 * 60 * 1000);
          dateStr = DateTimeUtils.utcToLocalDate(utcDate);
        } else {
          // Handle different date formats - convert to local timezone
          dateStr = DateTimeUtils.utcToLocalDate(recordDate);
        }

        return dateStr >= startDate && dateStr <= endDate;
      });

      // Get all people (guru or siswa) first
      let allPeople = [];
      if (filterType === 'guru') {
        allPeople = await db.guru.where('status').equals('active').toArray();
      } else if (filterType === 'siswa') {
        allPeople = await db.siswa.where('status').equals('active').toArray();
      }

      // Filter people by jabatan if specified
      let filteredPeople = allPeople;
      if (filterValue && filterValue !== '') {
        filteredPeople = allPeople.filter(person => person.jabatan === filterValue);
      }

      // Get identifiers of filtered people
      const filteredIdentifiers = filteredPeople.map(person => person.niy || person.nisn);

      // Filter attendance records by jabatan and identifiers
      if (filterValue && filterValue !== '') {
        attendanceRecords = attendanceRecords.filter(record =>
          record.jabatan === filterValue && filteredIdentifiers.includes(record.identifier)
        );
      } else {
        // Filter by type only
        if (filterType === 'guru') {
          attendanceRecords = attendanceRecords.filter(record => record.sebagai === 'Guru');
        } else if (filterType === 'siswa') {
          attendanceRecords = attendanceRecords.filter(record => record.sebagai === 'Siswa');
        }
      }

      // Filter perizinan records by type only (don't filter by identifiers to allow name matching)
      perizinanRecords = perizinanRecords.filter(record =>
        (filterType === 'guru' && record.sebagai === 'Guru') ||
        (filterType === 'siswa' && record.sebagai === 'Siswa')
      );



      setAttendanceData(attendanceRecords);

      // Generate daily attendance data
      const dailyData = generateDailyAttendance(filteredPeople, attendanceRecords, perizinanRecords, daysInSelectedMonth, filterType);
      setDailyAttendanceData(dailyData);

      // Group data by class for students only when no specific class is selected
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

    // Initialize attendance map for each person
    allPeople.forEach(person => {
      const key = `${person.nisn || person.niy}-${person.nama}`;
      attendanceMap[key] = {
        identifier: person.nisn || person.niy,
        nama: person.nama,
        jabatan: person.jabatan,
        sebagai: person.sebagai,
        dailyStatus: {}, // Will store status for each day
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


    // Fill in attendance data for each day
    Object.keys(attendanceMap).forEach(key => {
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        // Check if this date is in the future (after today) - using local timezone
        const currentDate = new Date();
        const checkDate = new Date(selectedYear, selectedMonth - 1, day);
        const localCurrentDate = new Date(currentDate.getTime() + DateTimeUtils.MAKASSAR_OFFSET);
        const localCheckDate = new Date(checkDate.getTime() + DateTimeUtils.MAKASSAR_OFFSET);
        const isFutureDate = localCheckDate > localCurrentDate;

        // Check if this is weekend (Saturday = 6, Sunday = 0)
        const isWeekend = checkDate.getDay() === 0 || checkDate.getDay() === 6;

        // Check if this is a holiday (no attendance records for this day)
        const dayHasAnyAttendance = attendanceRecords.some(r => r.tanggal === dateStr);
        const isHoliday = !dayHasAnyAttendance && !isFutureDate;

        // If future date, weekend, or holiday, don't show any status
        if (isFutureDate || isWeekend || isHoliday) {
          attendanceMap[key].dailyStatus[day] = '';
          continue;
        }

        // Check if person has ANY attendance record for this day
        const dayAttendanceRecords = attendanceRecords.filter(r =>
          r.identifier === attendanceMap[key].identifier &&
          r.tanggal === dateStr
        );
        const hasAttendanceRecord = dayAttendanceRecords.length > 0;

        const perizinanRecord = perizinanRecords.find(r => {
          // Normalize names for comparison - remove extra spaces, titles, and standardize
          const normalizeName = (name) => {
            return name.trim().toLowerCase()
              .replace(/\s+/g, ' ')
              .replace(/,?\s*(s\.?\s*pd\.?\s*i?|s\.?\s*pd|dr\.?|prof\.?|hj\.?|ny\.?)/gi, '') // Remove common titles
              .trim();
          };
          const perizinanName = normalizeName(r.nama);
          const attendanceName = normalizeName(attendanceMap[key].nama);

          // Normalize perizinan date for comparison - convert to local timezone
          let perizinanDateStr = r.tanggal;
          if (!isNaN(r.tanggal) && !isNaN(parseFloat(r.tanggal))) {
            const serialDate = parseInt(r.tanggal);
            const excelEpoch = new Date(1900, 0, 1);
            const utcDate = new Date(excelEpoch.getTime() + (serialDate - 2) * 24 * 60 * 60 * 1000);
            perizinanDateStr = DateTimeUtils.utcToLocalDate(utcDate);
          } else if (typeof r.tanggal === 'string') {
            perizinanDateStr = DateTimeUtils.utcToLocalDate(r.tanggal);
          }

          const nameMatch = perizinanName === attendanceName;
          const dateMatch = perizinanDateStr === dateStr;

          return nameMatch && dateMatch;
        });

        let status = '';
        if (hasAttendanceRecord) {
          // Person has attendance record(s) for this day
          const attendanceRecord = dayAttendanceRecords[0];

          // Check if this is imported data with proper status codes
          const recordStatus = attendanceRecord.status;
          if (recordStatus && ['TW', 'T1', 'T2', 'H', 'I', 'S'].includes(recordStatus)) {
            // Use the imported status directly
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
            } else if (status === 'I') {
              attendanceMap[key].summary.izin++;
              attendanceMap[key].summary.totalTidakHadir++;
            } else if (status === 'S') {
              attendanceMap[key].summary.sakit++;
              attendanceMap[key].summary.totalTidakHadir++;
            }
          } else {
            // Legacy data or scanned data - use time-based determination
            const statusLower = attendanceRecord.status?.toLowerCase();
            if (['datang', 'hadir', 'present', 'masuk'].includes(statusLower)) {
              // Use time-based status determination
              const personType = attendanceMap[key].sebagai.toLowerCase();
              const personJabatan = attendanceMap[key].jabatan;
              const timeStatus = getAttendanceStatus(attendanceRecord.jam, personType, personJabatan);

              if (timeStatus === 'tepatwaktu') {
                status = 'TW'; // Tepat Waktu
                attendanceMap[key].summary.tepatWaktu++;
                attendanceMap[key].summary.hadir++;
                attendanceMap[key].summary.totalKehadiran++;
              } else if (timeStatus === 'tahap1') {
                status = 'T1'; // Tahap 1
                attendanceMap[key].summary.tahap1++;
                attendanceMap[key].summary.hadir++;
                attendanceMap[key].summary.totalKehadiran++;
              } else if (timeStatus === 'tahap2') {
                status = 'T2'; // Tahap 2
                attendanceMap[key].summary.tahap2++;
                attendanceMap[key].summary.hadir++;
                attendanceMap[key].summary.totalKehadiran++;
              } else if (timeStatus === 'pulang') {
                status = 'H'; // Regular Hadir for pulang
                attendanceMap[key].summary.hadir++;
                attendanceMap[key].summary.totalKehadiran++;
              }
            } else if (statusLower === 'izin') {
              status = 'I'; // Izin
              attendanceMap[key].summary.izin++;
              attendanceMap[key].summary.totalTidakHadir++;
            } else if (statusLower === 'sakit') {
              status = 'S'; // Sakit
              attendanceMap[key].summary.sakit++;
              attendanceMap[key].summary.totalTidakHadir++;
            } else {
              status = 'TK'; // Tanpa Keterangan
              attendanceMap[key].summary.tanpaKeterangan++;
            }
          }
        } else if (perizinanRecord) {
          // Perizinan records based on jenis_izin (case insensitive)
          const jenisIzin = (perizinanRecord.jenis_izin || '').toLowerCase().trim();

          if (jenisIzin === 'dinas luar') {
            status = 'DL'; // Dinas Luar
            attendanceMap[key].summary.dinasLuar++;
            attendanceMap[key].summary.hadir++;
            attendanceMap[key].summary.totalKehadiran++;
          } else if (jenisIzin === 'sakit') {
            status = 'S'; // Sakit
            attendanceMap[key].summary.sakit++;
            attendanceMap[key].summary.totalTidakHadir++;
          } else if (jenisIzin === 'izin') {
            status = 'I'; // Izin
            attendanceMap[key].summary.izin++;
            attendanceMap[key].summary.totalTidakHadir++;
          } else if (jenisIzin === 'cuti' || jenisIzin === 'izin' || jenisIzin === 'sakit') {
            // Handle Izin, Sakit, and Cuti with date range
            const tanggalMulai = perizinanRecord.tanggal_mulai;
            const tanggalSelesai = perizinanRecord.tanggal_selesai;

            if (tanggalMulai && tanggalSelesai && tanggalMulai !== tanggalSelesai) {
              // Multi-day izin - check if current day is within range (using local timezone)
              const currentDate = new Date(selectedYear, selectedMonth - 1, day);
              const localCurrentDate = new Date(currentDate.getTime() + DateTimeUtils.MAKASSAR_OFFSET);
              const startDate = new Date(tanggalMulai);
              const endDate = new Date(tanggalSelesai);
  
              if (localCurrentDate >= startDate && localCurrentDate <= endDate) {
                // Day is within the izin range
                if (jenisIzin === 'sakit') {
                  status = 'S'; // Sakit day
                  attendanceMap[key].summary.sakit++;
                  attendanceMap[key].summary.totalTidakHadir++;
                } else {
                  status = 'I'; // Izin or Cuti day
                  attendanceMap[key].summary.izin++;
                  attendanceMap[key].summary.totalTidakHadir++;
                }
              } else {
                status = 'TK'; // Not in izin range
                attendanceMap[key].summary.tanpaKeterangan++;
              }
            } else {
              // Single day izin (or missing date range)
              if (jenisIzin === 'sakit') {
                status = 'S'; // Sakit
                attendanceMap[key].summary.sakit++;
                attendanceMap[key].summary.totalTidakHadir++;
              } else {
                status = 'I'; // Izin or Cuti treated as Izin
                attendanceMap[key].summary.izin++;
                attendanceMap[key].summary.totalTidakHadir++;
              }
            }
          } else {
            status = 'TK'; // Tanpa Keterangan for unknown types
            attendanceMap[key].summary.tanpaKeterangan++;
          }

          // Debug successful matches
        } else {
          // No attendance or perizinan record for this day
          status = 'TK'; // Tanpa Keterangan
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

    // Convert attendance time to minutes since midnight
    const [hours, minutes] = attendanceTime.split(':').map(Number);
    const attendanceMinutes = hours * 60 + minutes;

    // First, check for jabatan-specific settings
    const jabatanSettings = attendanceSettings.filter(setting =>
      setting.type === 'jabatan' && setting.jabatan === personJabatan
    );

    if (jabatanSettings.length > 0) {
      // Use jabatan-specific settings
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

    // Fall back to general guru/siswa settings
    const relevantSettings = attendanceSettings.filter(setting => setting.type === personType);

    // Find the matching time slot
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
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let yPosition = margin;

    // Header/Kop Surat
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    let title = `REKAPITULASI ABSEN ${filterType.toUpperCase()}`;
    if (filterType === 'siswa' && filterValue) {
      title += ` - ${filterValue}`;
    }
    doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;

    doc.setFontSize(10);
    const schoolName = schoolSettings.nama_sekolah || 'NAMA SEKOLAH';
    doc.text(schoolName, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const address = `${schoolSettings.alamat_desa || ''}, ${schoolSettings.alamat_kecamatan || ''}, ${schoolSettings.alamat_kabupaten || ''}, ${schoolSettings.alamat_provinsi || ''}`;
    doc.text(address, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 4;

    const period = `Bulan ${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`;
    doc.text(period, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    // Table setup
    const rowHeight = 5;
    const nameColWidth = 35;
    const dayColWidth = 6;
    const summaryColWidth = 8;

    // Calculate total table width
    const dayColsWidth = daysInMonth * dayColWidth;
    const summaryColsWidth = 10 * summaryColWidth; // 10 summary columns
    const totalTableWidth = nameColWidth + dayColsWidth + summaryColsWidth + 10; // +10 for No column

    let tableX = (pageWidth - totalTableWidth) / 2;

    // Header rows
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');

    // First header row (merged cells)
    let currentX = tableX;
    doc.rect(currentX, yPosition, 8, rowHeight * 2, 'S'); // No column
    doc.text('No', currentX + 2, yPosition + 3);
    currentX += 8;

    doc.rect(currentX, yPosition, nameColWidth, rowHeight * 2, 'S'); // Name column
    doc.text('Nama', currentX + 2, yPosition + 3);
    currentX += nameColWidth;

    // Days header (spans 2 rows)
    doc.rect(currentX, yPosition, dayColsWidth, rowHeight, 'S');
    doc.text('Tanggal', currentX + dayColsWidth/2 - 8, yPosition + 3);
    // Draw vertical lines for days
    for (let i = 1; i <= daysInMonth; i++) {
      doc.rect(currentX + (i-1)*dayColWidth, yPosition + rowHeight, dayColWidth, rowHeight, 'S');
      doc.text(i.toString(), currentX + (i-1)*dayColWidth + 1.5, yPosition + rowHeight + 3);
    }
    currentX += dayColsWidth;

    // Summary header (spans 2 rows)
    doc.rect(currentX, yPosition, summaryColsWidth, rowHeight, 'S');
    doc.text('Rekapitulasi', currentX + summaryColsWidth/2 - 12, yPosition + 3);

    yPosition += rowHeight;

    // Summary headers
    const summaryHeaders = ['Hadir', 'Izin', 'Sakit', 'TIDAK HADIR', 'Tanpa Keterangan', 'Tepat Waktu', 'Tahap 1', 'Tahap 2', 'Dinas Luar', 'Total Kehadiran'];

    summaryHeaders.forEach((header, index) => {
      doc.rect(currentX + index*summaryColWidth, yPosition, summaryColWidth, rowHeight, 'S');
      doc.text(header, currentX + index*summaryColWidth + 0.5, yPosition + 2);
    });

    yPosition += rowHeight;

    // Data rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);

    // Generate PDF data (flat data for all cases now)
    dailyAttendanceData.forEach((item, index) => {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = margin;
      }

      currentX = tableX;

      // No column
      doc.rect(currentX, yPosition, 8, rowHeight, 'S');
      doc.text((index + 1).toString(), currentX + 2, yPosition + 3);
      currentX += 8;

      // Name column
      doc.rect(currentX, yPosition, nameColWidth, rowHeight, 'S');
      const shortName = item.nama.length > 15 ? item.nama.substring(0, 12) + '...' : item.nama;
      doc.text(shortName, currentX + 1, yPosition + 3);
      currentX += nameColWidth;

      // Daily attendance columns
      for (let day = 1; day <= daysInMonth; day++) {
        const status = item.dailyStatus[day] || '';
        doc.rect(currentX, yPosition, dayColWidth, rowHeight, 'S');
        doc.text(status, currentX + 2, yPosition + 3);
        currentX += dayColWidth;
      }

      // Summary columns
      const summaryValues = [
        item.summary.hadir,
        item.summary.izin,
        item.summary.sakit,
        item.summary.totalTidakHadir,
        item.summary.tanpaKeterangan,
        item.summary.tepatWaktu,
        item.summary.tahap1,
        item.summary.tahap2,
        item.summary.dinasLuar,
        item.summary.totalKehadiran
      ];

      summaryValues.forEach((value, idx) => {
        doc.rect(currentX, yPosition, summaryColWidth, rowHeight, 'S');
        doc.text(value.toString(), currentX + 1, yPosition + 3);
        currentX += summaryColWidth;
      });

      yPosition += rowHeight;
    });

    // Signature section
    yPosition += 10;
    if (yPosition > pageHeight - 25) {
      doc.addPage();
      yPosition = margin;
    }

    const currentDate = new Date();
    const district = schoolSettings.alamat_kecamatan || 'Kecamatan';
    const localDate = new Date(currentDate.getTime() + DateTimeUtils.MAKASSAR_OFFSET);
    const dayDate = `${localDate.toLocaleDateString('id-ID', {
      timeZone: 'Asia/Makassar',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })}`;

    doc.setFontSize(8);
    doc.text(`Keterangan:`, margin, yPosition);
    yPosition += 4;
    doc.text(`TW = TEPAT WAKTU`, margin, yPosition);
    yPosition += 4;
    doc.text(`T1 = TAHAP 1`, margin, yPosition);
    yPosition += 4;
    doc.text(`T2 = TAHAP 2`, margin, yPosition);
    yPosition += 4;
    doc.text(`DL = DINAS LUAR`, margin, yPosition);
    yPosition += 4;
    doc.text(`S = SAKIT`, margin, yPosition);
    yPosition += 4;
    doc.text(`I = IZIN / CUTI`, margin, yPosition);
    yPosition += 4;
    doc.text(`TK = TANPA KETERANGAN`, margin, yPosition);
    yPosition += 5;
    doc.text(`${district}, ${dayDate}`, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 8;

    doc.text('Kepala Sekolah,', pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 15;

    // Signature line
    doc.setLineWidth(0.3);
    doc.line(pageWidth - margin - 30, yPosition, pageWidth - margin, yPosition);
    yPosition += 3;

    const principalName = schoolSettings.nama_kepala_sekolah || 'Nama Kepala Sekolah';
    doc.text(principalName, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 3;

    const principalNIY = schoolSettings.niy_kepala_sekolah || 'NIY. ';
    doc.text(`NIY. ${principalNIY}`, pageWidth - margin, yPosition, { align: 'right' });

    // Save PDF
    const fileName = `Rekap_Absensi_${filterType}_${selectedMonth}_${selectedYear}.pdf`;
    doc.save(fileName);
  };

  const getAvailableFilters = async () => {
    try {
      if (filterType === 'guru') {
        // Get unique jabatan (subjects) for teachers from guru table
        const guruData = await db.guru.where('status').equals('active').toArray();
        return [...new Set(guruData.map(record => record.jabatan).filter(Boolean))];
      } else if (filterType === 'siswa') {
        // Get unique jabatan (classes) for students from siswa table
        const siswaData = await db.siswa.where('status').equals('active').toArray();
        return [...new Set(siswaData.map(record => record.jabatan).filter(Boolean))];
      }
    } catch (error) {
      console.error('Error getting available filters:', error);
    }
    return [];
  };

  const handleCellClick = (event, personIndex, day) => {
    // Prevent editing for future dates, weekends, or holidays
    const checkDate = new Date(selectedYear, selectedMonth - 1, day);
    const currentDate = new Date();
    const isFutureDate = checkDate > currentDate;
    const isWeekend = checkDate.getDay() === 0 || checkDate.getDay() === 6;

    if (isFutureDate || isWeekend) {
      return; // Don't allow editing future dates or weekends
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
      // Check if there's already an attendance record for this person and date
      const existingAttendance = await db.attendance.where('[identifier+tanggal]').equals([person.identifier, dateStr]).first();

      // Check if there's already a perizinan record for this person and date
      const existingPerizinan = await db.perizinan.where('[identifier+tanggal]').equals([person.identifier, dateStr]).first();

      if (newStatus === 'TK' || newStatus === '') {
        // TK = delete existing records (since TK means empty/absent)
        if (existingAttendance) {
          await db.attendance.delete(existingAttendance.id);
        }
        if (existingPerizinan) {
          await db.perizinan.delete(existingPerizinan.id);
        }
      } else {
        // For other statuses, check if record already exists
        if (existingAttendance || existingPerizinan) {
          // If record exists, update it
          if (['DL', 'I', 'S'].includes(newStatus)) {
            // Remove attendance record if exists (switching to perizinan)
            if (existingAttendance) {
              await db.attendance.delete(existingAttendance.id);
            }

            // Update or create perizinan record
            const jenisIzin = newStatus === 'DL' ? 'Dinas Luar' :
                             newStatus === 'I' ? 'Izin' : 'Sakit';

            if (existingPerizinan) {
              await db.perizinan.update(existingPerizinan.id, {
                jenis_izin: jenisIzin,
                keterangan: `Updated via Rekap Absen - ${jenisIzin}`
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
                keterangan: `Updated via Rekap Absen - ${jenisIzin}`,
                wa: person.wa || '',
                email: person.email || ''
              });
            }
          } else {
            // Remove perizinan record if exists (switching to attendance)
            if (existingPerizinan) {
              await db.perizinan.delete(existingPerizinan.id);
            }

            // Update or create attendance record
            const att = ['TW', 'T1', 'T2'].includes(newStatus) ? 'Datang' : 'Pulang';
            const keterangan = newStatus === 'TW' ? 'Tepat Waktu' :
                              newStatus === 'T1' ? 'Tahap 1' :
                              newStatus === 'T2' ? 'Tahap 2' : 'Hadir';

            // Calculate the latest possible time for TW/T1/T2
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
        } else {
          // No existing record, create new one
          if (['DL', 'I', 'S'].includes(newStatus)) {
            // Add to perizinan table
            const jenisIzin = newStatus === 'DL' ? 'Dinas Luar' :
                             newStatus === 'I' ? 'Izin' : 'Sakit';

            await db.perizinan.add({
              tanggal: dateStr,
              tanggal_mulai: dateStr,
              tanggal_selesai: dateStr,
              identifier: person.identifier,
              nama: person.nama,
              jabatan: person.jabatan,
              sebagai: person.sebagai,
              jenis_izin: jenisIzin,
              keterangan: `Updated via Rekap Absen - ${jenisIzin}`,
              wa: person.wa || '',
              email: person.email || ''
            });
          } else {
            // Add to attendance table with latest time for TW/T1/T2
            const att = ['TW', 'T1', 'T2'].includes(newStatus) ? 'Datang' : 'Pulang';
            const keterangan = newStatus === 'TW' ? 'Tepat Waktu' :
                              newStatus === 'T1' ? 'Tahap 1' :
                              newStatus === 'T2' ? 'Tahap 2' : 'Hadir';

            // Calculate the latest possible time for TW/T1/T2
            let jam = '00:00';
            if (['TW', 'T1', 'T2'].includes(newStatus)) {
              jam = getLatestTimeForStatus(newStatus, person.sebagai, person.jabatan);
            }

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

      // Close popover and refresh data
      setEditPopoverAnchor(null);
      setEditingCell(null);

      // Refresh both RekapAbsen and Absensi data
      generateReport();
      if (window.refreshAbsensi) {
        window.refreshAbsensi();
      }

    } catch (error) {
      console.error('Error updating attendance status:', error);
      alert('Gagal mengupdate status absensi: ' + error.message);
    }
  };

  const getLatestTimeForStatus = (status, personType, personJabatan) => {
    // Get the latest possible time for TW/T1/T2 based on attendance settings

    // First, check for jabatan-specific settings
    const jabatanSettings = attendanceSettings.filter(setting =>
      setting.type === 'jabatan' && setting.jabatan === personJabatan
    );

    if (jabatanSettings.length > 0) {
      // Use jabatan-specific settings
      for (const setting of jabatanSettings) {
        const label = setting.label.toLowerCase().replace(' ', '');
        if ((status === 'TW' && label === 'tepatwaktu') ||
            (status === 'T1' && label === 'tahap1') ||
            (status === 'T2' && label === 'tahap2')) {
          return setting.end_time;
        }
      }
    }

    // Fall back to general guru/siswa settings
    const relevantSettings = attendanceSettings.filter(setting => setting.type === personType);

    for (const setting of relevantSettings) {
      const label = setting.label.toLowerCase().replace(' ', '');
      if ((status === 'TW' && label === 'tepatwaktu') ||
          (status === 'T1' && label === 'tahap1') ||
          (status === 'T2' && label === 'tahap2')) {
        return setting.end_time;
      }
    }

    // Default fallback times if no settings found
    if (status === 'TW') return '07:30'; // Latest for TW
    if (status === 'T1') return '08:00'; // Latest for T1
    if (status === 'T2') return '12:00'; // Latest for T2

    return '00:00';
  };

  const handleClosePopover = () => {
    setEditPopoverAnchor(null);
    setEditingCell(null);
  };


  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        📊 Rekap Absensi Bulanan - Mode: {mode}
      </Typography>

      {/* Filter Controls */}
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

      {/* Summary Stats */}
      {dailyAttendanceData.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="primary">
                  {dailyAttendanceData.length}
                </Typography>
                <Typography variant="body2">
                  Total {filterType === 'guru' ? 'Guru' : 'Siswa'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="success.main">
                  {dailyAttendanceData.reduce((sum, item) => sum + item.summary.totalKehadiran, 0)}
                </Typography>
                <Typography variant="body2">
                  Total Kehadiran
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="warning.main">
                  {dailyAttendanceData.reduce((sum, item) => sum + item.summary.izin + item.summary.sakit, 0)}
                </Typography>
                <Typography variant="body2">
                  Izin + Sakit + Cuti
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="info.main">
                  {daysInMonth}
                </Typography>
                <Typography variant="body2">
                  Hari Kerja
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Izin Information Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Informasi Izin (Izin/Sakit/Cuti):</strong><br/>
          • Semua jenis izin dengan rentang tanggal akan menampilkan status yang sesuai pada setiap hari dalam rentang<br/>
          • Izin: Status "I", Sakit: Status "S", Cuti: Status "I"<br/>
          • Jika hanya 1 hari, gunakan tanggal yang sama untuk mulai dan selesai<br/>
          • Dinas Luar tetap single-day (tidak perlu rentang tanggal)
        </Typography>
      </Alert>

      {/* Data Table */}
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
                {/* Day columns */}
                {Array.from({ length: daysInMonth }, (_, i) => (
                  <TableCell key={i + 1} align="center" sx={{ minWidth: 30, fontSize: '0.8rem' }}>
                    {i + 1}
                  </TableCell>
                ))}
                <TableCell align="center" sx={{ minWidth: 60, fontSize: '0.8rem' }}>Hadir</TableCell>
                <TableCell align="center" sx={{ minWidth: 40, fontSize: '0.8rem' }}>Izin</TableCell>
                <TableCell align="center" sx={{ minWidth: 40, fontSize: '0.8rem' }}>Sakit</TableCell>
                <TableCell align="center" sx={{ minWidth: 80, fontSize: '0.8rem' }}>TIDAK HADIR</TableCell>
                <TableCell align="center" sx={{ minWidth: 80, fontSize: '0.8rem' }}>Tanpa Keterangan</TableCell>
                <TableCell align="center" sx={{ minWidth: 60, fontSize: '0.8rem' }}>Tepat Waktu</TableCell>
                <TableCell align="center" sx={{ minWidth: 50, fontSize: '0.8rem' }}>Tahap 1</TableCell>
                <TableCell align="center" sx={{ minWidth: 50, fontSize: '0.8rem' }}>Tahap 2</TableCell>
                <TableCell align="center" sx={{ minWidth: 60, fontSize: '0.8rem' }}>Dinas Luar</TableCell>
                <TableCell align="center" sx={{ minWidth: 80, fontSize: '0.8rem' }}>Total Kehadiran</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dailyAttendanceData.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 'medium' }}>{item.nama}</TableCell>
                  {/* Daily attendance columns */}
                  {Array.from({ length: daysInMonth }, (_, dayIndex) => {
                    const day = dayIndex + 1;
                    const status = item.dailyStatus[day] || '';

                    // Check if this cell can be edited (not future date, not weekend) - using local timezone
                    const checkDate = new Date(selectedYear, selectedMonth - 1, day);
                    const currentDate = new Date();
                    const localCurrentDate = new Date(currentDate.getTime() + DateTimeUtils.MAKASSAR_OFFSET);
                    const localCheckDate = new Date(checkDate.getTime() + DateTimeUtils.MAKASSAR_OFFSET);
                    const isFutureDate = localCheckDate > localCurrentDate;
                    const isWeekend = localCheckDate.getDay() === 0 || localCheckDate.getDay() === 6;
                    const canEdit = !isFutureDate && !isWeekend;

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
                                          status === 'DL' ? '#e0f2f1' :
                                          status === 'I' ? '#fff3e0' :
                                          status === 'S' ? '#fce4ec' :
                                          status === 'TK' ? '#ffebee' : 'transparent',
                          cursor: canEdit ? 'pointer' : 'default',
                          '&:hover': canEdit ? { opacity: 0.7 } : {}
                        }}
                        onClick={(event) => canEdit && handleCellClick(event, index, day)}
                      >
                        {status}
                      </TableCell>
                    );
                  })}
                  {/* Summary columns */}
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                    {item.summary.hadir}
                  </TableCell>
                  <TableCell align="center">{item.summary.izin}</TableCell>
                  <TableCell align="center">{item.summary.sakit}</TableCell>
                  <TableCell align="center">{item.summary.totalTidakHadir}</TableCell>
                  <TableCell align="center">{item.summary.tanpaKeterangan}</TableCell>
                  <TableCell align="center">{item.summary.tepatWaktu}</TableCell>
                  <TableCell align="center">{item.summary.tahap1}</TableCell>
                  <TableCell align="center">{item.summary.tahap2}</TableCell>
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
          {loading ? 'Memuat data...' : 'Tidak ada data absensi untuk periode dan filter yang dipilih'}
        </Alert>
      )}

      {/* Edit Status Popover */}
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

export default RekapAbsen;