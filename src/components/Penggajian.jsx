import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Card, CardContent, Grid, Alert, FormControl, InputLabel, Select, MenuItem, Chip, Tabs, Tab, Divider, IconButton, Tooltip, LinearProgress
} from '@mui/material';
import {
  UploadFile, Settings, WhatsApp, PictureAsPdf, Edit, Delete, Refresh, Calculate, Save, Close
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { db } from '../database';
import { DatabaseService, TABLES } from '../config/supabase';

const Penggajian = ({ mode }) => {
  const [tabValue, setTabValue] = useState(0);
  const [payrollData, setPayrollData] = useState([]);
  const [deductionSettings, setDeductionSettings] = useState({
    tahap1: 5000,
    tahap2: 10000,
    tidakHadir: 25000
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState({});

  // Dialog states
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mkSettingsOpen, setMkSettingsOpen] = useState(false);
  const [salaryClaimOpen, setSalaryClaimOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Edit states
  const [editingRow, setEditingRow] = useState(null);
  const [editValues, setEditValues] = useState({});

  // MK Settings states - now responsive to current filter
  const [mkSettings, setMkSettings] = useState({
    startYear: 2023,
    startMonth: 7,
    baseSalaries: {
      'SMA/Sederajat': 2500000,
      'D3': 2750000,
      'S1': 3000000,
      'S2': 3500000,
      'S3': 4000000
    },
    annualIncrements: {
      'SMA/Sederajat': 200000,
      'D3': 225000,
      'S1': 250000,
      'S2': 275000,
      'S3': 300000
    },
    annualIncrementEnabled: true,
    // Auto-populate from current filter
    useCurrentFilter: true,
    // Track if base salaries were manually edited
    baseSalariesEdited: {
      'SMA/Sederajat': false,
      'D3': false,
      'S1': false,
      'S2': false,
      'S3': false
    }
  });

  const [teacherEducationDialog, setTeacherEducationDialog] = useState(false);
  const [selectedTeacherForEducation, setSelectedTeacherForEducation] = useState(null);
  const [teacherEducationData, setTeacherEducationData] = useState({
    educationLevel: 'S1',
    startYear: new Date().getFullYear(),
    startMonth: new Date().getMonth() + 1
  });

  const months = [
    { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' }, { value: 3, label: 'Maret' },
    { value: 4, label: 'April' }, { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' }, { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' }, { value: 11, label: 'November' }, { value: 12, label: 'Desember' }
  ];

  useEffect(() => {
    loadSchoolSettings();
    loadDeductionSettings();
    loadMkSettings();
    loadPayrollData();
  }, [selectedMonth, selectedYear]);

  const loadSchoolSettings = () => {
    db.school_settings.toCollection().first().then(settings => {
      if (settings) {
        setSchoolSettings(settings);
      }
    });
  };

  const loadDeductionSettings = () => {
    // Load deduction settings from localStorage or use defaults
    const saved = localStorage.getItem('deductionSettings');
    if (saved) {
      setDeductionSettings(JSON.parse(saved));
    }
  };

  const saveDeductionSettings = (settings) => {
    setDeductionSettings(settings);
    localStorage.setItem('deductionSettings', JSON.stringify(settings));
  };

  const loadMkSettings = () => {
    const saved = localStorage.getItem('mkSettings');
    if (saved) {
      setMkSettings(JSON.parse(saved));
    }
  };

  const saveMkSettings = (settings) => {
    // Track which base salaries were manually edited
    const defaultBaseSalaries = {
      'SMA/Sederajat': 2500000,
      'D3': 2750000,
      'S1': 3000000,
      'S2': 3500000,
      'S3': 4000000
    };

    const editedTracking = {};
    Object.keys(settings.baseSalaries).forEach(level => {
      editedTracking[level] = settings.baseSalaries[level] !== defaultBaseSalaries[level];
    });

    const updatedSettings = {
      ...settings,
      baseSalariesEdited: editedTracking
    };

    setMkSettings(updatedSettings);
    localStorage.setItem('mkSettings', JSON.stringify(updatedSettings));
  };

  const calculateMK = (teacher, currentYear, currentMonth) => {
    // Always use teacher's start date, if not available use global default
    const startYear = teacher.mk_start_year || mkSettings.startYear;
    const startMonth = teacher.mk_start_month || mkSettings.startMonth;

    let totalYears = currentYear - startYear;
    let totalMonths = currentMonth - startMonth;

    if (totalMonths < 0) {
      totalYears--;
      totalMonths += 12;
    }

    return {
      years: Math.max(0, totalYears),
      months: Math.max(0, totalMonths),
      totalMonths: Math.max(0, totalYears * 12 + totalMonths)
    };
  };

  const calculateBaseSalary = (teacher, currentYear, currentMonth) => {
    const educationLevel = teacher.pendidikan || 'S1';

    // Highest priority: manual override from direct input
    const manualBaseSalary = teacher.custom_base_salary && teacher.custom_base_salary > 0 ? teacher.custom_base_salary : null;
    if (manualBaseSalary) {
      console.log(`✍️ Using manual base salary for ${teacher.nama}: Rp${manualBaseSalary.toLocaleString()}`);
      return manualBaseSalary;
    }

    // Check if teacher has imported base salary (from Excel import)
    const importedBaseSalary = teacher.gaji_pokok && teacher.gaji_pokok > 0 ? teacher.gaji_pokok : null;

    // Get settings base salary
    const settingsBaseSalary = mkSettings.baseSalaries[educationLevel] || mkSettings.baseSalaries['S1'];

    let baseSalary;
    let source = '';

    // New priority logic: If settings > 0, use settings and clear import; if settings = 0, use import
    if (settingsBaseSalary > 0) {
      // Use settings and clear import if exists
      baseSalary = settingsBaseSalary;
      source = 'Settings';
      console.log(`🔧 Using settings base salary for ${teacher.nama}: Rp${baseSalary.toLocaleString()} (${educationLevel}) - SETTINGS > 0`);

      // Clear imported salary when using settings
      if (teacher.gaji_pokok) {
        DatabaseService.update(TABLES.GURU, teacher.id, { gaji_pokok: null });
        console.log(`🗑️ Cleared imported gaji_pokok for ${teacher.nama} due to settings > 0`);
      }
    } else {
      // Use import result if available, otherwise use settings (which is 0)
      baseSalary = importedBaseSalary || settingsBaseSalary;
      source = importedBaseSalary ? 'Import' : 'Settings (0)';
      console.log(`${importedBaseSalary ? '📥' : '⚙️'} Using ${importedBaseSalary ? 'imported' : 'settings (0)'} base salary for ${teacher.nama}: Rp${baseSalary.toLocaleString()}`);
    }

    if (!mkSettings.annualIncrementEnabled) {
      return baseSalary;
    }

    // Calculate MK from teacher's start date to current period
    const mk = calculateMK(teacher, currentYear, currentMonth);
    const yearsOfService = mk.years;

    // Use different increment amounts based on education level
    const incrementAmount = mkSettings.annualIncrements[educationLevel] || mkSettings.annualIncrements['S1'];

    const finalSalary = baseSalary + (yearsOfService * incrementAmount);
    console.log(`📊 Final calculation for ${teacher.nama}: Base=${baseSalary.toLocaleString()} (${source}), MK=${yearsOfService}yr, Increment=${incrementAmount.toLocaleString()}, Total=${finalSalary.toLocaleString()}`);

    return finalSalary;
  };

  const openTeacherEducationDialog = (teacher) => {
    setSelectedTeacherForEducation(teacher);
    setTeacherEducationData({
      educationLevel: teacher.pendidikan || 'S1',
      startYear: teacher.mk_start_year || new Date().getFullYear(),
      startMonth: teacher.mk_start_month || new Date().getMonth() + 1
    });
    setTeacherEducationDialog(true);
  };

  const saveTeacherEducation = async () => {
    try {
      await DatabaseService.update(TABLES.GURU, selectedTeacherForEducation.id, {
        pendidikan: teacherEducationData.educationLevel,
        mk_start_year: teacherEducationData.startYear,
        mk_start_month: teacherEducationData.startMonth
      });

      setTeacherEducationDialog(false);
      setSelectedTeacherForEducation(null);
      loadPayrollData(); // Refresh data
      alert('✅ Data pendidikan guru berhasil diperbarui');
    } catch (error) {
      console.error('Error updating teacher education:', error);
      alert('❌ Gagal memperbarui data pendidikan: ' + error.message);
    }
  };

  const loadPayrollData = async () => {
    setLoading(true);
    try {
      // Get only guru (teachers) data for payroll
      const allEmployees = await DatabaseService.getGuru(true);

      // Calculate attendance data for each employee
      const payrollWithDeductions = await Promise.all(
        allEmployees.map(async (employee) => {
          const attendanceData = await calculateEmployeeAttendance(employee);
          const deductions = calculateDeductions(attendanceData);

          // Calculate MK and base salary
          const mk = calculateMK(employee, selectedYear, selectedMonth);
          const calculatedBaseSalary = calculateBaseSalary(employee, selectedYear, selectedMonth);

          const totalSalary = calculateTotalSalary({
            ...employee,
            gaji_pokok: calculatedBaseSalary,
            mk_tahun: mk.years,
            mk_bulan: mk.months
          }, deductions);

          return {
            ...employee,
            attendanceData,
            deductions,
            totalSalary,
            bulan: `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`,
            calculated_mk_tahun: mk.years,
            calculated_mk_bulan: mk.months,
            calculated_base_salary: calculatedBaseSalary
          };
        })
      );

      setPayrollData(payrollWithDeductions);
    } catch (error) {
      console.error('Error loading payroll data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateEmployeeAttendance = async (employee) => {
    const identifier = employee.niy || employee.nisn;
    const startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
    const endDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${new Date(selectedYear, selectedMonth, 0).getDate()}`;

    // Get attendance records for the month
    let attendanceRecords = await db.attendance.toArray();
    attendanceRecords = attendanceRecords.filter(record => {
      const recordDate = record.tanggal;
      const dateStr = recordDate.split('T')[0] || recordDate.split(' ')[0];
      return record.identifier === identifier && dateStr >= startDate && dateStr <= endDate;
    });

    // Get perizinan records for the month
    let perizinanRecords = await db.perizinan.toArray();
    perizinanRecords = perizinanRecords.filter(record => {
      let recordDate = record.tanggal;

      // Handle Excel serial dates (numbers)
      if (!isNaN(recordDate) && !isNaN(parseFloat(recordDate))) {
        const serialDate = parseInt(recordDate);
        const excelEpoch = new Date(1900, 0, 1);
        const jsDate = new Date(excelEpoch.getTime() + (serialDate - 2) * 24 * 60 * 60 * 1000);
        recordDate = jsDate.toISOString().split('T')[0];
      } else if (typeof recordDate === 'string') {
        recordDate = recordDate.split('T')[0] || recordDate.split(' ')[0];
      }

      return record.identifier === identifier && recordDate >= startDate && recordDate <= endDate;
    });

    // Count attendance types (same logic as RekapAbsen.jsx)
    let tahap1 = 0, tahap2 = 0, sakit = 0, izin = 0, dinasLuar = 0;

    // Count from attendance records
    attendanceRecords.forEach(record => {
      const recordStatus = record.status;
      if (recordStatus === 'T1') {
        tahap1++;
      } else if (recordStatus === 'T2') {
        tahap2++;
      }
    });

    // Count from perizinan records
    perizinanRecords.forEach(record => {
      const jenisIzin = (record.jenis_izin || '').toLowerCase().trim();
      if (jenisIzin === 'sakit') {
        sakit++;
      } else if (jenisIzin === 'izin') {
        izin++;
      } else if (jenisIzin === 'cuti') {
        izin++; // Cuti treated as Izin for payroll calculations
      } else if (jenisIzin === 'dinas luar') {
        dinasLuar++;
      }
    });

    // Calculate tidak hadir as Sakit + Izin (same as RekapAbsen summary)
    const tidakHadir = sakit + izin;

    return {
      workingDays: calculateWorkingDaysInMonth(selectedYear, selectedMonth),
      tahap1,
      tahap2,
      tidakHadir, // Sakit + Izin
      sakit,
      izin,
      dinasLuar,
      totalAttendance: attendanceRecords.length,
      totalPerizinan: perizinanRecords.length
    };
  };

  const calculateWorkingDaysInMonth = (year, month) => {
    let workingDays = 0;
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      // Count weekdays (Monday = 1 to Friday = 5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDays++;
      }
    }

    return workingDays;
  };

  const calculateDeductions = (attendanceData) => {
    const { tahap1, tahap2, tidakHadir } = attendanceData;

    return {
      tahap1Deduction: tahap1 * deductionSettings.tahap1,
      tahap2Deduction: tahap2 * deductionSettings.tahap2,
      tidakHadirDeduction: tidakHadir * deductionSettings.tidakHadir,
      totalDeduction: (tahap1 * deductionSettings.tahap1) +
                     (tahap2 * deductionSettings.tahap2) +
                     (tidakHadir * deductionSettings.tidakHadir)
    };
  };

  const calculateTotalSalary = (employee, deductions) => {
    // Calculate each allowance after capping deductions (no negative results)
    const baseSalary = employee.gaji_pokok || 0;
    const tunjanganKinerja = Math.max(0, (employee.tunjangan_kinerja || 0) - deductions.totalDeduction);
    const tunjanganUmum = employee.tunjangan_umum || 0;
    const tunjanganIstri = employee.tunjangan_istri || 0;
    const tunjanganAnak = employee.tunjangan_anak || 0;
    const tunjanganKepalaSekolah = employee.tunjangan_kepala_sekolah || 0;
    const tunjanganWaliKelas = employee.tunjangan_wali_kelas || 0;
    const honorBendahara = employee.honor_bendahara || 0;

    // Total salary is sum of all allowances (Tunjangan Kinerja already has deductions applied)
    const totalSalary = baseSalary + tunjanganKinerja + tunjanganUmum +
                        tunjanganIstri + tunjanganAnak + tunjanganKepalaSekolah +
                        tunjanganWaliKelas + honorBendahara;

    return totalSalary;
  };

  const handleExcelImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    console.log('File selected:', file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        console.log('File loaded, processing...');
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        console.log('Workbook sheets:', workbook.SheetNames);

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        console.log('Parsed data:', jsonData);
        console.log('Number of rows:', jsonData.length);

        if (jsonData.length === 0) {
          alert('❌ File Excel kosong atau tidak ada data yang dapat dibaca');
          return;
        }

        // Process the imported data
        await processImportedPayrollData(jsonData);

      } catch (error) {
        console.error('Error importing Excel:', error);
        alert('❌ Gagal mengimpor file Excel: ' + error.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processImportedPayrollData = async (data) => {
    console.log('Starting import process with data:', data);
    let successCount = 0;
    let errorCount = 0;

    // Process and save the imported payroll data
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      console.log(`Processing row ${i + 1}:`, row);

      // Skip empty rows
      if (!row['Nama'] && !row['NAMA']) {
        console.log(`Skipping empty row ${i + 1}`);
        continue;
      }

      try {
        // Map Excel columns to database fields
        const payrollRecord = {
          nama: row['Nama'] || row['NAMA'] || '',
          jabatan: row['Jabatan'] || row['JABATAN'] || '',
          status_guru: row['Status Guru'] || row['STATUS GURU'] || 'PTY',
          pendidikan: row['Jenjang Pendidikan'] || row['JENJANG PENDIDIKAN'] || 'S1',
          mk_start_year: parseInt(row['Tahun Mulai Kerja'] || row['TAHUN MULAI KERJA'] || 2023),
          mk_start_month: parseInt(row['Bulan Mulai Kerja'] || row['BULAN MULAI KERJA'] || 7),
          gaji_pokok: parseFloat((row['Gaji Pokok'] || row['GAJI POKOK'] || '0').toString().replace(/[^\d]/g, '')) || 0,
          tunjangan_kinerja: parseFloat((row['Tunj. Kinerja'] || row['TUNJ KINERJA'] || '0').toString().replace(/[^\d]/g, '')) || 0,
          tunjangan_umum: parseFloat((row['Tunj. Umum'] || row['TUNJ UMUM'] || '0').toString().replace(/[^\d]/g, '')) || 0,
          tunjangan_istri: parseFloat((row['Tunj. Istri'] || row['TUNJ ISTRI'] || '0').toString().replace(/[^\d]/g, '')) || 0,
          tunjangan_anak: parseFloat((row['Tunj. Anak'] || row['TUNJ ANAK'] || '0').toString().replace(/[^\d]/g, '')) || 0,
          tunjangan_kepala_sekolah: parseFloat((row['Tunj. Kepala Sekolah'] || row['TUNJ KEPALA SEKOLAH'] || '0').toString().replace(/[^\d]/g, '')) || 0,
          tunjangan_wali_kelas: parseFloat((row['Tunj. Wali Kelas'] || row['TUNJ WALI KELAS'] || '0').toString().replace(/[^\d]/g, '')) || 0,
          honor_bendahara: parseFloat((row['Honor Bendahara'] || row['HONOR BENDAHARA'] || '0').toString().replace(/[^\d]/g, '')) || 0,
          keterangan: row['Keterangan'] || row['KETERANGAN'] || '',
          status: 'active',
          bulan: `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`
        };

        console.log('Adding record to database:', payrollRecord);

        // Simple matching by name only - import data replaces everything
        console.log(`Searching for existing record by name: ${payrollRecord.nama}`);

        const existingRecords = await db.guru.where('nama').equals(payrollRecord.nama).toArray();
        console.log(`Found ${existingRecords.length} existing records for ${payrollRecord.nama}`);

        if (existingRecords.length > 0) {
          const existing = existingRecords[0];
          console.log(`🔄 Replacing existing record for ${payrollRecord.nama} (ID: ${existing.id})`);

          // Complete replacement - import data overwrites everything
          const replacedRecord = {
            ...payrollRecord,
            // Keep only the ID, replace everything else
            id: existing.id,
            // Add metadata
            imported_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          await DatabaseService.update(TABLES.GURU, existing.id, replacedRecord);
          console.log(`✅ Replaced record ${existing.id} for ${payrollRecord.nama} with imported data`);
        } else {
          console.log(`➕ Adding new record for ${payrollRecord.nama}`);
          await DatabaseService.create(TABLES.GURU, {
            ...payrollRecord,
            created_at: new Date().toISOString(),
            imported_at: new Date().toISOString()
          });
          console.log(`✅ Added new record for ${payrollRecord.nama}`);
        }

        console.log(`Successfully processed row ${i + 1}`);
        successCount++;
      } catch (error) {
        console.error(`Error adding row ${i + 1}:`, error);
        errorCount++;
      }
    }

    console.log(`Import completed. Success: ${successCount}, Errors: ${errorCount}`);

    if (successCount > 0) {
      alert(`✅ Import berhasil! ${successCount} data berhasil diimpor${errorCount > 0 ? `, ${errorCount} gagal` : ''}\n📝 Data import menggantikan data existing berdasarkan Nama.`);
    } else {
      alert(`❌ Import gagal! Tidak ada data yang berhasil diimpor. Periksa kolom Excel Anda.`);
    }

    loadPayrollData(); // Refresh data
  };

  const debugDatabase = async () => {
    try {
      console.log('=== DATABASE DEBUG INFO ===');
      const guruCount = await db.guru.count();
      console.log('Total guru records:', guruCount);

      const allGuru = await db.guru.toArray();
      console.log('All guru records:', allGuru);

      // Check for duplicates
      const names = allGuru.map(g => g.nama);
      const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
      const uniqueDuplicates = [...new Set(duplicates)];
      console.log('Duplicate names found:', uniqueDuplicates);

      const penggajianCount = await db.penggajian.count();
      console.log('Total penggajian records:', penggajianCount);

      const allPenggajian = await db.penggajian.toArray();
      console.log('All penggajian records:', allPenggajian);

      alert(`Database info: ${guruCount} guru, ${penggajianCount} penggajian records${uniqueDuplicates.length > 0 ? `\nDuplicates: ${uniqueDuplicates.join(', ')}` : '\nNo duplicates found'}`);
    } catch (error) {
      console.error('Debug error:', error);
    }
  };

  const cleanupDuplicates = async () => {
    try {
      console.log('Starting duplicate cleanup...');
      const allGuru = await db.guru.orderBy('nama').toArray();

      const seen = new Map();
      const toDelete = [];

      // Find duplicates
      allGuru.forEach((record, index) => {
        const key = `${record.nama}-${record.jabatan || ''}-${record.status_guru || ''}`;
        if (seen.has(key)) {
          // Keep the first occurrence, mark others for deletion
          toDelete.push(record.id);
        } else {
          seen.set(key, index);
        }
      });

      if (toDelete.length > 0) {
        console.log(`Deleting ${toDelete.length} duplicate records:`, toDelete);
        // Delete duplicate records using DatabaseService
        for (const id of toDelete) {
          await DatabaseService.delete(TABLES.GURU, id);
        }
        alert(`✅ Duplicates cleaned! ${toDelete.length} records removed.`);
      } else {
        alert('ℹ️ No duplicates found to clean.');
      }

      loadPayrollData(); // Refresh data
    } catch (error) {
      console.error('Cleanup error:', error);
      alert('❌ Error during cleanup: ' + error.message);
    }
  };

  const generateSalaryClaim = (employee) => {
    const currentDate = new Date();
    const monthName = months.find(m => m.value === selectedMonth)?.label;

    const grossSalary = ((employee.calculated_base_salary || employee.gaji_pokok || 0)) +
                      (employee.tunjangan_kinerja || 0) +
                      (employee.tunjangan_umum || 0) +
                      (employee.tunjangan_istri || 0) +
                      (employee.tunjangan_anak || 0) +
                      (employee.tunjangan_kepala_sekolah || 0) +
                      (employee.tunjangan_wali_kelas || 0) +
                      (employee.honor_bendahara || 0);

    const claimText = `Amprah Gaji

SDIT INSAN RABBANI

Bulan\t: ${monthName} ${selectedYear}
Nama\t: ${employee.nama}
Jabatan\t: ${employee.jabatan}
Status Guru\t: ${employee.status_guru || 'PTY'}
MK\t: ${employee.calculated_mk_tahun || 0} tahun ${employee.calculated_mk_bulan || 0} bulan

Penghasilan:
Gaji Pokok\t: Rp${(employee.gaji_pokok || 0).toLocaleString()}
Tunj. Kinerja\t: Rp${(employee.tunjangan_kinerja || 0).toLocaleString()}
Tunj. Umum\t: Rp${(employee.tunjangan_umum || 0).toLocaleString()}
Tunj. Istri\t: Rp${(employee.tunjangan_istri || 0).toLocaleString()}
Tunj. Anak\t: Rp${(employee.tunjangan_anak || 0).toLocaleString()}
Tunj. Kepala Sekolah\t: Rp${(employee.tunjangan_kepala_sekolah || 0).toLocaleString()}
Tunj. Wali Kelas\t: Rp${(employee.tunjangan_wali_kelas || 0).toLocaleString()}
Honor Bendahara\t: Rp${(employee.honor_bendahara || 0).toLocaleString()}

Potongan Kinerja:
Tahap 1\t: Rp${((employee.attendanceData?.tahap1 || 0) * deductionSettings.tahap1).toLocaleString()} (${employee.attendanceData?.tahap1 || 0}x)
Tahap 2\t: Rp${((employee.attendanceData?.tahap2 || 0) * deductionSettings.tahap2).toLocaleString()} (${employee.attendanceData?.tahap2 || 0}x)
Tidak Hadir\t: Rp${((employee.attendanceData?.tidakHadir || 0) * deductionSettings.tidakHadir).toLocaleString()} (${employee.attendanceData?.tidakHadir || 0}x)
Total Potongan\t: Rp${(employee.deductions?.totalDeduction || 0).toLocaleString()}

Jumlah Penghasilan\t: Rp${grossSalary.toLocaleString()}
Jumlah Dibayarkan\t: Rp${(employee.totalSalary || 0).toLocaleString()}

Keterangan\t: ${employee.keterangan || '-'}

\t\tMalili, ${currentDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
\t\tKepala SDIT Insan Rabbani



\t\t${employee.nama}
\t\tNIY. ${employee.niy}`;

    return claimText;
  };

  const sendWhatsAppClaim = async (employee) => {
    const deviceId = '9b33e3a9-e9ff-4f8b-a62a-90b5eee3f946';
    let number = employee.wa;

    if (!number || number.trim() === '') {
      alert(`Nomor WhatsApp untuk ${employee.nama} tidak tersedia`);
      return;
    }

    // Convert Indonesian phone numbers to international format
    if (number.startsWith('0')) {
      number = '62' + number.substring(1);
    } else if (number.startsWith('+62')) {
      number = number.substring(1);
    }

    const message = generateSalaryClaim(employee);

    const payload = {
      device_id: deviceId,
      number: number,
      message: message
    };

    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert(`✅ Amprah gaji berhasil dikirim ke ${employee.nama}`);
      } else {
        console.warn(`Failed to send WhatsApp to ${employee.nama}: ${response.statusText}`);
        // Fallback to WhatsApp Web
        const whatsappUrl = `https://wa.me/${employee.wa}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        alert(`📱 Membuka WhatsApp Web untuk ${employee.nama}\n\nPesan akan terkirim setelah Anda klik "Kirim" di WhatsApp Web.`);
      }
    } catch (error) {
      console.warn(`Error sending WhatsApp to ${employee.nama}:`, error.message);
      // Fallback to WhatsApp Web
      const whatsappUrl = `https://wa.me/${employee.wa}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      alert(`📱 Membuka WhatsApp Web untuk ${employee.nama}\n\nPesan akan terkirim setelah Anda klik "Kirim" di WhatsApp Web.`);
    }
  };

  const startEditing = (employee) => {
    setEditingRow(employee.niy || employee.nisn);
    setEditValues({
      gaji_pokok: employee.calculated_base_salary || employee.gaji_pokok || 0,
      tunjangan_kinerja: employee.tunjangan_kinerja || 0,
      tunjangan_umum: employee.tunjangan_umum || 0,
      tunjangan_istri: employee.tunjangan_istri || 0,
      tunjangan_anak: employee.tunjangan_anak || 0,
      tunjangan_kepala_sekolah: employee.tunjangan_kepala_sekolah || 0,
      tunjangan_wali_kelas: employee.tunjangan_wali_kelas || 0,
      honor_bendahara: employee.honor_bendahara || 0,
      keterangan: employee.keterangan || ''
    });
  };

  const saveEditing = async (employee) => {
    try {
      // Update the employee record in the database
      await DatabaseService.update(TABLES.GURU, employee.id, {
        custom_base_salary: parseFloat(editValues.gaji_pokok) || 0,
        tunjangan_kinerja: parseFloat(editValues.tunjangan_kinerja) || 0,
        tunjangan_umum: parseFloat(editValues.tunjangan_umum) || 0,
        tunjangan_istri: parseFloat(editValues.tunjangan_istri) || 0,
        tunjangan_anak: parseFloat(editValues.tunjangan_anak) || 0,
        tunjangan_kepala_sekolah: parseFloat(editValues.tunjangan_kepala_sekolah) || 0,
        tunjangan_wali_kelas: parseFloat(editValues.tunjangan_wali_kelas) || 0,
        honor_bendahara: parseFloat(editValues.honor_bendahara) || 0,
        keterangan: editValues.keterangan || ''
      });

      setEditingRow(null);
      setEditValues({});
      loadPayrollData(); // Refresh data
      alert('✅ Data gaji berhasil diperbarui');
    } catch (error) {
      console.error('Error updating salary:', error);
      alert('❌ Gagal memperbarui data gaji: ' + error.message);
    }
  };

  const cancelEditing = () => {
    setEditingRow(null);
    setEditValues({});
  };

  const generateImportTemplate = () => {
    const templateData = [
      {
        'Nama': 'Contoh Nama Guru',
        'Jabatan': 'Guru Kelas',
        'Status Guru': 'PTY',
        'Jenjang Pendidikan': 'S1',
        'Tahun Mulai Kerja': 2020,
        'Bulan Mulai Kerja': 7,
        'Gaji Pokok': 3000000,
        'Tunj. Kinerja': 500000,
        'Tunj. Umum': 200000,
        'Tunj. Istri': 100000,
        'Tunj. Anak': 50000,
        'Tunj. Kepala Sekolah': 0,
        'Tunj. Wali Kelas': 100000,
        'Honor Bendahara': 0,
        'Keterangan': 'Contoh data'
      },
      {
        'Nama': '',
        'Jabatan': '',
        'Status Guru': '',
        'Jenjang Pendidikan': '',
        'Tahun Mulai Kerja': '',
        'Bulan Mulai Kerja': '',
        'Gaji Pokok': '',
        'Tunj. Kinerja': '',
        'Tunj. Umum': '',
        'Tunj. Istri': '',
        'Tunj. Anak': '',
        'Tunj. Kepala Sekolah': '',
        'Tunj. Wali Kelas': '',
        'Honor Bendahara': '',
        'Keterangan': 'CATATAN: Import berdasarkan Nama - data existing akan diganti dengan data import'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Import Penggajian');

    // Set column widths
    worksheet['!cols'] = [
      { wch: 20 }, // Nama
      { wch: 15 }, // Jabatan
      { wch: 12 }, // Status Guru
      { wch: 15 }, // Jenjang Pendidikan
      { wch: 15 }, // Tahun Mulai Kerja
      { wch: 15 }, // Bulan Mulai Kerja
      { wch: 12 }, // Gaji Pokok
      { wch: 12 }, // Tunj. Kinerja
      { wch: 12 }, // Tunj. Umum
      { wch: 12 }, // Tunj. Istri
      { wch: 12 }, // Tunj. Anak
      { wch: 15 }, // Tunj. Kepala Sekolah
      { wch: 15 }, // Tunj. Wali Kelas
      { wch: 15 }, // Honor Bendahara
      { wch: 20 }  // Keterangan
    ];

    XLSX.writeFile(workbook, 'Template_Import_Penggajian.xlsx');
  };

  const generatePDFReport = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let yPosition = margin;

    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN PENGGAJIAN GURU', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const period = `Bulan ${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`;
    doc.text(period, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    // Table
    const tableData = payrollData.map((employee, index) => {
      const grossSalary = ((employee.calculated_base_salary || employee.gaji_pokok || 0)) +
                        (employee.tunjangan_kinerja || 0) +
                        (employee.tunjangan_umum || 0) +
                        (employee.tunjangan_istri || 0) +
                        (employee.tunjangan_anak || 0) +
                        (employee.tunjangan_kepala_sekolah || 0) +
                        (employee.tunjangan_wali_kelas || 0) +
                        (employee.honor_bendahara || 0);

      return [
        index + 1,
        employee.nama,
        employee.jabatan,
        employee.status_guru || 'PTY',
        employee.calculated_mk_tahun !== undefined ? employee.calculated_mk_tahun : (employee.mk_tahun || 0),
        employee.calculated_mk_bulan !== undefined ? employee.calculated_mk_bulan : (employee.mk_bulan || 0),
        `Rp${(employee.calculated_base_salary || employee.gaji_pokok || 0).toLocaleString()}${employee.gaji_pokok && employee.gaji_pokok > 0 ? ' (Import)' : ''}`,
        `Rp${(employee.tunjangan_kinerja || 0).toLocaleString()}`,
        `Rp${(employee.tunjangan_umum || 0).toLocaleString()}`,
        `Rp${(employee.tunjangan_istri || 0).toLocaleString()}`,
        `Rp${(employee.tunjangan_anak || 0).toLocaleString()}`,
        `Rp${(employee.tunjangan_kepala_sekolah || 0).toLocaleString()}`,
        `Rp${(employee.tunjangan_wali_kelas || 0).toLocaleString()}`,
        `Rp${(employee.honor_bendahara || 0).toLocaleString()}`,
        `Rp${((employee.attendanceData?.tahap1 || 0) * deductionSettings.tahap1).toLocaleString()}`,
        `Rp${((employee.attendanceData?.tahap2 || 0) * deductionSettings.tahap2).toLocaleString()}`,
        `Rp${((employee.attendanceData?.tidakHadir || 0) * deductionSettings.tidakHadir).toLocaleString()}`,
        `Rp${(employee.deductions?.totalDeduction || 0).toLocaleString()}`,
        `Rp${grossSalary.toLocaleString()}`,
        `Rp${(employee.totalSalary || 0).toLocaleString()}`,
        employee.keterangan || ''
      ];
    });

    doc.autoTable({
      head: [[
        'No', 'Nama', 'Jabatan', 'Status Guru', 'MK Thn', 'MK Bln',
        'Gaji Pokok', 'Tunj. Kinerja', 'Tunj. Umum', 'Tunj. Istri', 'Tunj. Anak',
        'Tunj. Kepala Sekolah', 'Tunj. Wali Kelas', 'Honor Bendahara',
        'Tahap 1', 'Tahap 2', 'Tidak Hadir', 'Pot. Kinerja', 'Jumlah',
        'Jumlah yang dibayarkan', 'Keterangan'
      ]],
      body: tableData,
      startY: yPosition,
      styles: { fontSize: 6 },
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 25 },
        2: { cellWidth: 20 },
        3: { cellWidth: 15 },
        4: { cellWidth: 10 },
        5: { cellWidth: 10 },
        6: { cellWidth: 18 },
        7: { cellWidth: 18 },
        8: { cellWidth: 15 },
        9: { cellWidth: 15 },
        10: { cellWidth: 15 },
        11: { cellWidth: 20 },
        12: { cellWidth: 18 },
        13: { cellWidth: 18 },
        14: { cellWidth: 15 },
        15: { cellWidth: 15 },
        16: { cellWidth: 18 },
        17: { cellWidth: 18 },
        18: { cellWidth: 18 },
        19: { cellWidth: 20 },
        20: { cellWidth: 25 }
      }
    });

    doc.save(`Laporan_Penggajian_${selectedMonth}_${selectedYear}.pdf`);
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        💰 Penggajian - Mode: {mode}
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>MK Otomatis:</strong> Perhitungan Masa Kerja otomatis berdasarkan filter periode saat ini
          ({months.find(m => m.value === selectedMonth)?.label} {selectedYear})
        </Typography>
      </Alert>

      {/* Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
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
                <InputLabel>Tahun</InputLabel>
                <Select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  label="Tahun"
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
                variant="outlined"
                startIcon={<Settings />}
                onClick={() => setSettingsOpen(true)}
                fullWidth
              >
                Pengaturan
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                startIcon={<Calculate />}
                onClick={() => setMkSettingsOpen(true)}
                fullWidth
              >
                Pengaturan MK
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                startIcon={<UploadFile />}
                onClick={generateImportTemplate}
                fullWidth
              >
                Template Import
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadFile />}
                fullWidth
              >
                Import Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  hidden
                  onChange={handleExcelImport}
                />
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="contained"
                startIcon={<PictureAsPdf />}
                onClick={generatePDFReport}
                disabled={payrollData.length === 0}
                fullWidth
              >
                Export PDF
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={loadPayrollData}
                disabled={loading}
                fullWidth
              >
                Refresh
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                onClick={debugDatabase}
                fullWidth
              >
                Debug DB
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                color="warning"
                onClick={cleanupDuplicates}
                fullWidth
              >
                Cleanup Duplicates
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {loading && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress />
          <Typography variant="body2" sx={{ mt: 1 }}>
            Menghitung data penggajian...
          </Typography>
        </Box>
      )}

      {/* Summary Cards */}
      {payrollData.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="primary.main">
                  {payrollData.length}
                </Typography>
                <Typography variant="body2">
                  Total Guru/Staf
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="success.main">
                  Rp{payrollData.reduce((sum, emp) => sum + (emp.totalSalary || 0), 0).toLocaleString()}
                </Typography>
                <Typography variant="body2">
                  Total Penggajian
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="info.main">
                  Rp{payrollData.reduce((sum, emp) => sum + (emp.calculated_base_salary || emp.gaji_pokok || 0), 0).toLocaleString()}
                </Typography>
                <Typography variant="body2">
                  Total Gaji Pokok
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="warning.main">
                  Rp{payrollData.reduce((sum, emp) => sum + (emp.deductions?.totalDeduction || 0), 0).toLocaleString()}
                </Typography>
                <Typography variant="body2">
                  Total Potongan
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="info.main">
                  {payrollData.reduce((sum, emp) => sum + (emp.attendanceData?.tidakHadir || 0), 0)}
                </Typography>
                <Typography variant="body2">
                  Total Tidak Hadir
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Payroll Table */}
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 2000 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 50 }}>No</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 150 }}>Nama</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 120 }}>Jabatan</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>Status Guru</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 80 }} colSpan={2}>MK</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>Gaji Pokok</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>Tunj. Kinerja</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>Tunj. Umum</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>Tunj. Istri</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>Tunj. Anak</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 120 }}>Tunj. Kepala Sekolah</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 120 }}>Tunj. Wali Kelas</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 120 }}>Honor Bendahara</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 80 }}>Tahap 1</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 80 }}>Tahap 2</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>Tidak Hadir</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>Pot. Kinerja</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 120 }}>Jumlah</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 150 }}>Jumlah yang dibayarkan</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 120 }}>Keterangan</TableCell>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 80 }}>Aksi</TableCell>
            </TableRow>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Thn</TableCell>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Bln</TableCell>
              <TableCell colSpan={8} sx={{ fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'center' }}>Penghasilan</TableCell>
              <TableCell colSpan={3}></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>(Setelah potongan)</TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payrollData.map((employee, index) => {
              const grossSalary = ((employee.calculated_base_salary || employee.gaji_pokok || 0)) +
                                (employee.tunjangan_kinerja || 0) +
                                (employee.tunjangan_umum || 0) +
                                (employee.tunjangan_istri || 0) +
                                (employee.tunjangan_anak || 0) +
                                (employee.tunjangan_kepala_sekolah || 0) +
                                (employee.tunjangan_wali_kelas || 0) +
                                (employee.honor_bendahara || 0);

              return (
                <TableRow key={employee.niy || employee.nisn} hover>
                  <TableCell sx={{ fontWeight: 'medium' }}>{index + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 'medium' }}>{employee.nama}</TableCell>
                  <TableCell>{employee.jabatan}</TableCell>
                  <TableCell>{employee.status_guru || 'PTY'}</TableCell>
                  <TableCell align="center">
                    <Box>
                      <Typography variant="body2">
                        {employee.calculated_mk_tahun !== undefined ? employee.calculated_mk_tahun : (employee.mk_tahun || 0)}
                      </Typography>
                      {employee.mk_tahun && (
                        <Typography variant="caption" color="text.secondary">
                          (Import: {employee.mk_tahun})
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Box>
                      <Typography variant="body2">
                        {employee.calculated_mk_bulan !== undefined ? employee.calculated_mk_bulan : (employee.mk_bulan || 0)}
                      </Typography>
                      {employee.mk_bulan && (
                        <Typography variant="caption" color="text.secondary">
                          (Import: {employee.mk_bulan})
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    {editingRow === (employee.niy || employee.nisn) ? (
                      <TextField
                        size="small"
                        type="number"
                        value={editValues.gaji_pokok}
                        onChange={(e) => setEditValues({...editValues, gaji_pokok: e.target.value})}
                        sx={{ width: 100 }}
                      />
                    ) : (
                      <Box>
                        <Typography variant="body2">
                          Rp{(employee.calculated_base_salary || employee.gaji_pokok || 0).toLocaleString()}
                        </Typography>
                        {employee.gaji_pokok && employee.gaji_pokok > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            (Import: Rp{employee.gaji_pokok.toLocaleString()})
                          </Typography>
                        )}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {editingRow === (employee.niy || employee.nisn) ? (
                      <TextField
                        size="small"
                        type="number"
                        value={editValues.tunjangan_kinerja}
                        onChange={(e) => setEditValues({...editValues, tunjangan_kinerja: e.target.value})}
                        sx={{ width: 100 }}
                      />
                    ) : (
                      `Rp${(employee.tunjangan_kinerja || 0).toLocaleString()}`
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {editingRow === (employee.niy || employee.nisn) ? (
                      <TextField
                        size="small"
                        type="number"
                        value={editValues.tunjangan_umum}
                        onChange={(e) => setEditValues({...editValues, tunjangan_umum: e.target.value})}
                        sx={{ width: 100 }}
                      />
                    ) : (
                      `Rp${(employee.tunjangan_umum || 0).toLocaleString()}`
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {editingRow === (employee.niy || employee.nisn) ? (
                      <TextField
                        size="small"
                        type="number"
                        value={editValues.tunjangan_istri}
                        onChange={(e) => setEditValues({...editValues, tunjangan_istri: e.target.value})}
                        sx={{ width: 100 }}
                      />
                    ) : (
                      `Rp${(employee.tunjangan_istri || 0).toLocaleString()}`
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {editingRow === (employee.niy || employee.nisn) ? (
                      <TextField
                        size="small"
                        type="number"
                        value={editValues.tunjangan_anak}
                        onChange={(e) => setEditValues({...editValues, tunjangan_anak: e.target.value})}
                        sx={{ width: 100 }}
                      />
                    ) : (
                      `Rp${(employee.tunjangan_anak || 0).toLocaleString()}`
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {editingRow === (employee.niy || employee.nisn) ? (
                      <TextField
                        size="small"
                        type="number"
                        value={editValues.tunjangan_kepala_sekolah}
                        onChange={(e) => setEditValues({...editValues, tunjangan_kepala_sekolah: e.target.value})}
                        sx={{ width: 100 }}
                      />
                    ) : (
                      `Rp${(employee.tunjangan_kepala_sekolah || 0).toLocaleString()}`
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {editingRow === (employee.niy || employee.nisn) ? (
                      <TextField
                        size="small"
                        type="number"
                        value={editValues.tunjangan_wali_kelas}
                        onChange={(e) => setEditValues({...editValues, tunjangan_wali_kelas: e.target.value})}
                        sx={{ width: 100 }}
                      />
                    ) : (
                      `Rp${(employee.tunjangan_wali_kelas || 0).toLocaleString()}`
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {editingRow === (employee.niy || employee.nisn) ? (
                      <TextField
                        size="small"
                        type="number"
                        value={editValues.honor_bendahara}
                        onChange={(e) => setEditValues({...editValues, honor_bendahara: e.target.value})}
                        sx={{ width: 100 }}
                      />
                    ) : (
                      `Rp${(employee.honor_bendahara || 0).toLocaleString()}`
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`Rp${((employee.attendanceData?.tahap1 || 0) * deductionSettings.tahap1).toLocaleString()}`}
                      color={employee.attendanceData?.tahap1 > 0 ? "warning" : "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`Rp${((employee.attendanceData?.tahap2 || 0) * deductionSettings.tahap2).toLocaleString()}`}
                      color={employee.attendanceData?.tahap2 > 0 ? "error" : "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`Rp${((employee.attendanceData?.tidakHadir || 0) * deductionSettings.tidakHadir).toLocaleString()}`}
                      color={employee.attendanceData?.tidakHadir > 0 ? "error" : "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                    Rp{(employee.deductions?.totalDeduction || 0).toLocaleString()}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    Rp{grossSalary.toLocaleString()}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                    Rp{(employee.totalSalary || 0).toLocaleString()}
                  </TableCell>
                  <TableCell>{employee.keterangan || ''}</TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      {editingRow === (employee.niy || employee.nisn) ? (
                        <>
                          <Tooltip title="Simpan">
                            <IconButton
                              color="primary"
                              size="small"
                              onClick={() => saveEditing(employee)}
                            >
                              <Save />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Batal">
                            <IconButton
                              color="error"
                              size="small"
                              onClick={cancelEditing}
                            >
                              <Close />
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : (
                        <Tooltip title="Edit Gaji & Tunjangan">
                          <IconButton
                            color="primary"
                            size="small"
                            onClick={() => startEditing(employee)}
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Atur Pendidikan & MK">
                        <IconButton
                          color="primary"
                          size="small"
                          onClick={() => openTeacherEducationDialog(employee)}
                        >
                          <Calculate />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Kirim Amprah Gaji via WhatsApp">
                        <IconButton
                          color="success"
                          onClick={() => sendWhatsAppClaim(employee)}
                        >
                          <WhatsApp />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {payrollData.length === 0 && !loading && (
        <Alert severity="info" sx={{ mt: 3 }}>
          Tidak ada data penggajian untuk periode yang dipilih. Pastikan data guru/siswa sudah tersedia.
        </Alert>
      )}

      {/* Deduction Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Settings /> Pengaturan Potongan Kinerja
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Atur besaran potongan untuk setiap jenis keterlambatan/kehadiran
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Potongan Tahap 1 (Rp)"
                type="number"
                value={deductionSettings.tahap1}
                onChange={(e) => setDeductionSettings({
                  ...deductionSettings,
                  tahap1: parseInt(e.target.value) || 0
                })}
                fullWidth
                InputProps={{
                  startAdornment: <Typography>Rp</Typography>
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Potongan Tahap 2 (Rp)"
                type="number"
                value={deductionSettings.tahap2}
                onChange={(e) => setDeductionSettings({
                  ...deductionSettings,
                  tahap2: parseInt(e.target.value) || 0
                })}
                fullWidth
                InputProps={{
                  startAdornment: <Typography>Rp</Typography>
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Potongan Tidak Hadir (Rp)"
                type="number"
                value={deductionSettings.tidakHadir}
                onChange={(e) => setDeductionSettings({
                  ...deductionSettings,
                  tidakHadir: parseInt(e.target.value) || 0
                })}
                fullWidth
                InputProps={{
                  startAdornment: <Typography>Rp</Typography>
                }}
              />
            </Grid>
          </Grid>

          <Alert severity="info" sx={{ mt: 3 }}>
            <strong>Catatan:</strong> Potongan hanya diterapkan pada Tunjangan Kinerja.
            Dinas luar tidak dikenakan potongan.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Batal</Button>
          <Button
            onClick={() => {
              saveDeductionSettings(deductionSettings);
              setSettingsOpen(false);
              loadPayrollData(); // Recalculate with new settings
            }}
            variant="contained"
          >
            Simpan
          </Button>
        </DialogActions>
      </Dialog>

      {/* MK Settings Dialog */}
      <Dialog open={mkSettingsOpen} onClose={() => setMkSettingsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Calculate /> Pengaturan Masa Kerja (MK) & Gaji Pokok
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Konfigurasi perhitungan masa kerja dan gaji pokok berdasarkan jenjang pendidikan
          </Typography>

          <Grid container spacing={3}>
            {/* MK Calculation Settings */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>Pengaturan Perhitungan MK</Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Otomatis dari Filter:</strong> Tahun dan Bulan MK mengikuti filter periode penggajian saat ini
                  ({months.find(m => m.value === selectedMonth)?.label} {selectedYear})
                </Typography>
              </Alert>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Tahun Mulai MK (Otomatis dari filter)"
                    type="number"
                    value={selectedYear}
                    disabled
                    fullWidth
                    helperText="Mengikuti tahun filter penggajian"
                    InputProps={{
                      readOnly: true,
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Bulan Mulai MK (Otomatis dari filter)</InputLabel>
                    <Select
                      value={selectedMonth}
                      disabled
                      label="Bulan Mulai MK (Otomatis dari filter)"
                    >
                      {months.map(month => (
                        <MenuItem key={month.value} value={month.value}>
                          {month.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Typography variant="caption" color="text.secondary">
                    Mengikuti bulan filter penggajian
                  </Typography>
                </Grid>
              </Grid>
            </Grid>

            {/* Base Salary by Education Level */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>Gaji Pokok Berdasarkan Jenjang Pendidikan</Typography>
              <Grid container spacing={2}>
                {Object.entries(mkSettings.baseSalaries).map(([level, salary]) => (
                  <Grid item xs={12} sm={6} key={level}>
                    <TextField
                      label={`Gaji Pokok ${level}`}
                      type="number"
                      value={salary}
                      onChange={(e) => setMkSettings({
                        ...mkSettings,
                        baseSalaries: {
                          ...mkSettings.baseSalaries,
                          [level]: parseFloat(e.target.value) || 0
                        }
                      })}
                      fullWidth
                      InputProps={{
                        startAdornment: <Typography>Rp</Typography>
                      }}
                    />
                  </Grid>
                ))}
              </Grid>
            </Grid>

            {/* Annual Increment Settings by Education Level */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>Kenaikan Tahunan Berdasarkan Jenjang</Typography>
              <Grid container spacing={2}>
                {Object.entries(mkSettings.annualIncrements).map(([level, increment]) => (
                  <Grid item xs={12} sm={6} key={level}>
                    <TextField
                      label={`Kenaikan ${level} per Tahun`}
                      type="number"
                      value={increment}
                      onChange={(e) => setMkSettings({
                        ...mkSettings,
                        annualIncrements: {
                          ...mkSettings.annualIncrements,
                          [level]: parseFloat(e.target.value) || 0
                        }
                      })}
                      fullWidth
                      InputProps={{
                        startAdornment: <Typography>Rp</Typography>
                      }}
                    />
                  </Grid>
                ))}
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Kenaikan Otomatis</InputLabel>
                    <Select
                      value={mkSettings.annualIncrementEnabled ? 'enabled' : 'disabled'}
                      onChange={(e) => setMkSettings({
                        ...mkSettings,
                        annualIncrementEnabled: e.target.value === 'enabled'
                      })}
                      label="Kenaikan Otomatis"
                    >
                      <MenuItem value="enabled">Aktif</MenuItem>
                      <MenuItem value="disabled">Nonaktif</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Grid>

            {/* Information */}
            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Cara Kerja:</strong><br/>
                  • MK dihitung otomatis berdasarkan filter periode penggajian saat ini<br/>
                  • Jika filter = September 2025, maka MK dihitung sampai September 2025<br/>
                  • <strong>Gaji Pokok:</strong> Jika pengaturan MK {'>'} 0 gunakan pengaturan dan hapus import, jika pengaturan MK = 0 gunakan hasil import<br/>
                  • Gaji pokok = Gaji pokok terbaru + (MK Tahun × Kenaikan per tahun sesuai jenjang)<br/>
                  • Kenaikan berbeda-beda untuk setiap jenjang pendidikan<br/>
                  • Kenaikan hanya berlaku jika diaktifkan<br/>
                  • Setiap guru harus memiliki data jenjang pendidikan untuk perhitungan yang akurat
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMkSettingsOpen(false)}>Batal</Button>
          <Button
            onClick={() => {
              saveMkSettings(mkSettings);
              setMkSettingsOpen(false);
              loadPayrollData(); // Recalculate with new settings
            }}
            variant="contained"
          >
            Simpan Pengaturan
          </Button>
        </DialogActions>
      </Dialog>

      {/* Teacher Education Dialog */}
      <Dialog open={teacherEducationDialog} onClose={() => setTeacherEducationDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Calculate /> Data Pendidikan Guru
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Atur jenjang pendidikan dan tanggal mulai kerja untuk {selectedTeacherForEducation?.nama}
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Jenjang Pendidikan</InputLabel>
                <Select
                  value={teacherEducationData.educationLevel}
                  onChange={(e) => setTeacherEducationData({
                    ...teacherEducationData,
                    educationLevel: e.target.value
                  })}
                  label="Jenjang Pendidikan"
                >
                  <MenuItem value="SMA/Sederajat">SMA/Sederajat</MenuItem>
                  <MenuItem value="D3">D3</MenuItem>
                  <MenuItem value="S1">S1</MenuItem>
                  <MenuItem value="S2">S2</MenuItem>
                  <MenuItem value="S3">S3</MenuItem>
                  <MenuItem value="Khusus">Khusus</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Tahun Mulai Kerja"
                type="number"
                value={teacherEducationData.startYear}
                onChange={(e) => setTeacherEducationData({
                  ...teacherEducationData,
                  startYear: parseInt(e.target.value) || new Date().getFullYear()
                })}
                fullWidth
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Bulan Mulai Kerja</InputLabel>
                <Select
                  value={teacherEducationData.startMonth}
                  onChange={(e) => setTeacherEducationData({
                    ...teacherEducationData,
                    startMonth: e.target.value
                  })}
                  label="Bulan Mulai Kerja"
                >
                  {months.map(month => (
                    <MenuItem key={month.value} value={month.value}>
                      {month.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Data Gaji Pokok:</strong><br/>
                  • Jika pengaturan MK {'>'} 0 → gunakan pengaturan dan hapus data import<br/>
                  • Jika pengaturan MK = 0 → gunakan hasil import Excel<br/>
                  • Tidak perlu input manual, otomatis berdasarkan aturan di atas
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTeacherEducationDialog(false)}>Batal</Button>
          <Button
            onClick={saveTeacherEducation}
            variant="contained"
          >
            Simpan
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Penggajian;