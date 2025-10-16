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
import { supabase } from '../config/supabase';
import { useRealtime } from '../context/RealtimeContext';
import SyncStatus from './SyncStatus';

const Penggajian = ({ mode }) => {
  const [tabValue, setTabValue] = useState(0);
  const [payrollData, setPayrollData] = useState([]);
  const [deductionSettings, setDeductionSettings] = useState({
    tahap1: 5000,
    tahap2: 10000,
    tidakHadir: 25000,
    tanpaKeterangan: 50000
  });
  // Function to get previous month (for payroll processing)
  const getPreviousMonth = () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
    const currentYear = now.getFullYear();

    // If current month is January, previous month is December of previous year
    if (currentMonth === 1) {
      return {
        month: 12,
        year: currentYear - 1
      };
    } else {
      return {
        month: currentMonth - 1,
        year: currentYear
      };
    }
  };

  const previousMonthData = getPreviousMonth();
  const [selectedMonth, setSelectedMonth] = useState(previousMonthData.month);
  const [selectedYear, setSelectedYear] = useState(previousMonthData.year);

  // Function to handle month/year change with automatic adjustment
  const handleMonthChange = (newMonth) => {
    setSelectedMonth(newMonth);
    // Auto-adjust year if month is January and current selection would be December
    if (newMonth === 12 && selectedMonth === 1) {
      setSelectedYear(selectedYear - 1);
    }
  };

  const handleYearChange = (newYear) => {
    setSelectedYear(newYear);
  };
  const [loading, setLoading] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState({});

  // Real-time context
  const { subscribeToTable } = useRealtime();

  // Dialog states
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mkSettingsOpen, setMkSettingsOpen] = useState(false);
  const [salaryClaimOpen, setSalaryClaimOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Edit states
  const [editingRow, setEditingRow] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkEditValues, setBulkEditValues] = useState({
    gaji_pokok: '',
    tunjangan_kinerja: '',
    tunjangan_umum: '',
    tunjangan_istri: '',
    tunjangan_anak: '',
    tunjangan_kepala_sekolah: '',
    tunjangan_wali_kelas: '',
    honor_bendahara: '',
    keterangan: ''
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
    const initializePayrollSystem = async () => {
      console.log('🚀 Initializing payroll system...');

      // Load all settings first
      await Promise.all([
        loadSchoolSettings(),
        loadDeductionSettings(),
        loadPayrollData()
      ]);


      console.log('✅ Payroll system initialized');
    };

    initializePayrollSystem();

    // Setup real-time subscriptions for payroll-related tables
    console.log('📡 Setting up real-time subscriptions for payroll system...');

    // Subscribe to guru table changes (main payroll data source)
    const guruSubscription = subscribeToTable(TABLES.GURU, (change) => {
      console.log('🔄 Real-time guru change detected in Penggajian:', change);
      // Reload payroll data when guru data changes
      loadPayrollData();
    });

    // Subscribe to attendance table changes (affects payroll calculations)
    const attendanceSubscription = subscribeToTable(TABLES.ATTENDANCE, (change) => {
      console.log('🔄 Real-time attendance change detected in Penggajian:', change);
      // Reload payroll data when attendance changes
      loadPayrollData();
    });

    // Subscribe to perizinan table changes (affects payroll calculations)
    const perizinanSubscription = subscribeToTable(TABLES.PERIZINAN, (change) => {
      console.log('🔄 Real-time perizinan change detected in Penggajian:', change);
      // Reload payroll data when perizinan changes
      loadPayrollData();
    });

    // Subscribe to attendance_settings table changes (for deduction settings)
    const settingsSubscription = subscribeToTable(TABLES.ATTENDANCE_SETTINGS, (change) => {
      console.log('🔄 Real-time attendance_settings change detected in Penggajian:', change);
      // Reload settings when they change
      loadDeductionSettings();
      // Reload payroll data to reflect new settings
      loadPayrollData();
    });


    // Cleanup subscriptions on unmount
    return () => {
      console.log('🔌 Cleaning up payroll real-time subscriptions...');
      guruSubscription?.unsubscribe?.();
      attendanceSubscription?.unsubscribe?.();
      perizinanSubscription?.unsubscribe?.();
      settingsSubscription?.unsubscribe?.();
    };
  }, [selectedMonth, selectedYear]);

  // Initialize default MK settings if they don't exist
  const initializeDefaultMkSettings = async () => {
    try {
      // Check if MK settings exist in localStorage
      const existingSettings = localStorage.getItem('mkSettings');

      if (!existingSettings) {
        console.log('📊 Creating initial MK settings...');

        // Try to load from Supabase first
        try {
          const { data: supabaseSettings, error } = await supabase
            .from(TABLES.MK_SETTINGS)
            .select('*')
            .single();

          if (!error && supabaseSettings) {
            console.log('📊 Found existing MK settings in Supabase');

            // Convert JSONB fields back to objects
            const mkData = {
              startYear: supabaseSettings.start_year || 2023,
              startMonth: supabaseSettings.start_month || 7,
              baseSalaries: supabaseSettings.base_salaries || {
                'SMA/Sederajat': 2500000,
                'D3': 2750000,
                'S1': 3000000,
                'S2': 3500000,
                'S3': 4000000
              },
              annualIncrements: supabaseSettings.annual_increments || {
                'SMA/Sederajat': 200000,
                'D3': 225000,
                'S1': 250000,
                'S2': 275000,
                'S3': 300000
              },
              annualIncrementEnabled: supabaseSettings.annual_increment_enabled !== false,
              useCurrentFilter: supabaseSettings.use_current_filter !== false,
              // Note: baseSalariesEdited tracking removed from database schema
            };

            localStorage.setItem('mkSettings', JSON.stringify(mkData));
            console.log('✅ Loaded MK settings from Supabase to localStorage');
            return;
          }
        } catch (supabaseError) {
          console.warn('⚠️ Could not load from Supabase:', supabaseError);
        }

        // Create default settings if not found in Supabase
        const defaultSettings = {
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
          useCurrentFilter: true,
          // Note: baseSalariesEdited tracking removed from database schema
        };

        localStorage.setItem('mkSettings', JSON.stringify(defaultSettings));
        console.log('✅ Created initial MK settings in localStorage');
      } else {
        console.log('📊 MK settings already exist in localStorage');
      }
    } catch (error) {
      console.warn('Failed to initialize default MK settings:', error);
    }
  };

  const loadSchoolSettings = () => {
    db.school_settings.toCollection().first().then(settings => {
      if (settings) {
        setSchoolSettings(settings);
      }
    });
  };

  const loadDeductionSettings = async () => {
    try {
      // Try to load from Supabase first
      const settings = await DatabaseService.getAll(TABLES.ATTENDANCE_SETTINGS);
      const deductionSetting = settings.find(s => s.type === 'deduction');

      if (deductionSetting) {
        const deductionData = {
          tahap1: deductionSetting.tahap1 || 5000,
          tahap2: deductionSetting.tahap2 || 10000,
          tidakHadir: deductionSetting.tidak_hadir || 25000,
          tanpaKeterangan: deductionSetting.tanpa_keterangan || 50000
        };
        setDeductionSettings(deductionData);
        console.log('💰 Loaded deduction settings from Supabase:', deductionData);
      } else {
        // Fallback to localStorage for backward compatibility
        const saved = localStorage.getItem('deductionSettings');
        if (saved) {
          setDeductionSettings(JSON.parse(saved));
        }
      }
    } catch (error) {
      console.warn('Failed to load deduction settings from Supabase, using localStorage:', error);
      // Fallback to localStorage
      const saved = localStorage.getItem('deductionSettings');
      if (saved) {
        setDeductionSettings(JSON.parse(saved));
      }
    }
  };

  const saveDeductionSettings = async (settings) => {
    try {
      console.log('💰 Saving deduction settings to Supabase...');

      // Save to Supabase
      const settingsData = {
        type: 'deduction',
        tahap1: settings.tahap1,
        tahap2: settings.tahap2,
        tidak_hadir: settings.tidakHadir,
        tanpa_keterangan: settings.tanpaKeterangan,
        label: 'Deduction Settings',
        att: 'system'
      };

      // Check if settings already exist
      const existingSettings = await DatabaseService.getAll(TABLES.ATTENDANCE_SETTINGS);
      const existingDeduction = existingSettings.find(s => s.type === 'deduction');

      let saveResult;
      if (existingDeduction) {
        // Update existing
        console.log('🔄 Updating existing deduction settings...');
        saveResult = await DatabaseService.update(TABLES.ATTENDANCE_SETTINGS, existingDeduction.id, settingsData);
      } else {
        // Create new
        console.log('➕ Creating new deduction settings...');
        saveResult = await DatabaseService.create(TABLES.ATTENDANCE_SETTINGS, settingsData);
      }

      console.log('✅ Deduction settings saved to Supabase:', saveResult);
      setDeductionSettings(settings);

      // Also save to localStorage for offline support
      localStorage.setItem('deductionSettings', JSON.stringify(settings));

      alert('✅ Pengaturan potongan berhasil disimpan dan disinkronisasi!');
    } catch (error) {
      console.error('❌ Failed to save deduction settings to Supabase:', error);
      alert('❌ Gagal menyimpan ke Supabase: ' + error.message);

      // Fallback to localStorage
      setDeductionSettings(settings);
      localStorage.setItem('deductionSettings', JSON.stringify(settings));
    }
  };




  const calculateBaseSalary = (teacher, currentYear, currentMonth) => {
    // Simplified salary calculation - direct from data sources

    // Priority 1: Manual override from direct input (highest priority)
    const manualBaseSalary = teacher.custom_base_salary && teacher.custom_base_salary > 0 ? teacher.custom_base_salary : null;
    if (manualBaseSalary) {
      console.log(`✍️ Using manual base salary for ${teacher.nama}: Rp${manualBaseSalary.toLocaleString()}`);
      return manualBaseSalary;
    }

    // Priority 2: Excel import data (main source)
    const importedBaseSalary = teacher.gaji_pokok && teacher.gaji_pokok > 0 ? teacher.gaji_pokok : null;
    if (importedBaseSalary) {
      console.log(`📥 Using Excel import base salary for ${teacher.nama}: Rp${importedBaseSalary.toLocaleString()}`);
      return importedBaseSalary;
    }

    // Fallback: return 0 if no salary data available
    console.log(`⚠️ No salary data available for ${teacher.nama}`);
    return 0;
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
      console.log('💾 Saving teacher education to Supabase...');

      const updateData = {
        pendidikan: teacherEducationData.educationLevel,
        mk_start_year: teacherEducationData.startYear,
        mk_start_month: teacherEducationData.startMonth,
        updated_at: new Date().toISOString()
        // Note: 'bulan' field is NOT included - it's only in penggajian table
      };

      // Update in Supabase first
      const { data: supabaseResult, error: supabaseError } = await supabase
        .from(TABLES.GURU)
        .update(updateData)
        .eq('id', selectedTeacherForEducation.id)
        .select()
        .single();

      if (supabaseError) {
        console.error('❌ Supabase update error:', supabaseError);
        throw new Error('Supabase update failed: ' + supabaseError.message);
      } else {
        console.log('✅ Supabase update successful:', supabaseResult);
      }

      // Update local database
      await DatabaseService.update(TABLES.GURU, selectedTeacherForEducation.id, updateData);

      setTeacherEducationDialog(false);
      setSelectedTeacherForEducation(null);
      loadPayrollData(); // Refresh data
      alert('✅ Data pendidikan guru berhasil diperbarui dan disinkronisasi!');
    } catch (error) {
      console.error('Error updating teacher education:', error);
      alert('❌ Gagal memperbarui data pendidikan: ' + error.message);
    }
  };

  const loadPayrollData = async () => {
    setLoading(true);
    try {
      console.log('🔍 Loading payroll data from Supabase...');
      // Get only guru (teachers) data for payroll
      const allEmployees = await DatabaseService.getGuru(true);
      console.log(`✅ Loaded ${allEmployees.length} employees from database`);

      // Calculate attendance data for each employee
      const payrollWithDeductions = await Promise.all(
        allEmployees.map(async (employee) => {
          const attendanceData = await calculateEmployeeAttendance(employee);
          const deductions = calculateDeductions(attendanceData);

          // Calculate base salary (no MK calculation needed)
          const calculatedBaseSalary = calculateBaseSalary(employee, selectedYear, selectedMonth);

          const totalSalary = calculateTotalSalary({
            ...employee,
            gaji_pokok: calculatedBaseSalary
          }, deductions);

          return {
            ...employee,
            attendanceData,
            deductions,
            totalSalary,
            bulan: `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`,
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

    // Get attendance records for the month from both local and Supabase
    let attendanceRecords = [];

    try {
      // Try to get from Supabase first
      const { data: supabaseAttendance, error: attError } = await supabase
        .from(TABLES.ATTENDANCE)
        .select('*')
        .eq('identifier', identifier)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate);

      if (!attError && supabaseAttendance) {
        attendanceRecords = supabaseAttendance;
        console.log(`📊 Loaded ${attendanceRecords.length} attendance records from Supabase for ${identifier}`);
      } else {
        // Fallback to local
        console.warn('Failed to load from Supabase, using local data:', attError);
        attendanceRecords = await db.attendance.toArray();
        attendanceRecords = attendanceRecords.filter(record => {
          const recordDate = record.tanggal;
          const dateStr = recordDate.split('T')[0] || recordDate.split(' ')[0];
          return record.identifier === identifier && dateStr >= startDate && dateStr <= endDate;
        });
      }
    } catch (error) {
      console.error('Error loading attendance:', error);
      // Fallback to local
      attendanceRecords = await db.attendance.toArray();
      attendanceRecords = attendanceRecords.filter(record => {
        const recordDate = record.tanggal;
        const dateStr = recordDate.split('T')[0] || recordDate.split(' ')[0];
        return record.identifier === identifier && dateStr >= startDate && dateStr <= endDate;
      });
    }

    // Get perizinan records for the month from both local and Supabase
    let perizinanRecords = [];

    try {
      // Try to get from Supabase first
      const { data: supabasePerizinan, error: perError } = await supabase
        .from(TABLES.PERIZINAN)
        .select('*')
        .eq('identifier', identifier)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate);

      if (!perError && supabasePerizinan) {
        perizinanRecords = supabasePerizinan;
        console.log(`📋 Loaded ${perizinanRecords.length} perizinan records from Supabase for ${identifier}`);
      } else {
        // Fallback to local
        console.warn('Failed to load perizinan from Supabase, using local data:', perError);
        perizinanRecords = await db.perizinan.toArray();
      }
    } catch (error) {
      console.error('Error loading perizinan:', error);
      // Fallback to local
      perizinanRecords = await db.perizinan.toArray();
    }
    // Filter perizinan records by date range
    if (Array.isArray(perizinanRecords)) {
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
    }

    // Count attendance types (same logic as RekapAbsen.jsx)
    let tahap1 = 0, tahap2 = 0, sakit = 0, izin = 0, dinasLuar = 0, tanpaKeterangan = 0;

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
      tanpaKeterangan,
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
    const { tahap1, tahap2, tidakHadir, tanpaKeterangan } = attendanceData;

    return {
      tahap1Deduction: tahap1 * deductionSettings.tahap1,
      tahap2Deduction: tahap2 * deductionSettings.tahap2,
      tidakHadirDeduction: tidakHadir * deductionSettings.tidakHadir,
      tanpaKeteranganDeduction: tanpaKeterangan * deductionSettings.tanpaKeterangan,
      totalDeduction: (tahap1 * deductionSettings.tahap1) +
                     (tahap2 * deductionSettings.tahap2) +
                     (tidakHadir * deductionSettings.tidakHadir) +
                     (tanpaKeterangan * deductionSettings.tanpaKeterangan)
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
        // Note: Field mapping harus sesuai dengan schema database
        const payrollRecord = {
          nama: row['Nama'] || row['NAMA'] || '',
          niy: row['NIY'] || row['niy'] || null, // Tambahkan NIY jika ada di Excel
          jabatan: row['Jabatan'] || row['JABATAN'] || '',
          sebagai: 'Guru', // Default value
          email: row['Email'] || row['EMAIL'] || null,
          wa: row['WA'] || row['wa'] || null,
          status: 'active', // Field status (bukan status_guru)
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
          keterangan: row['Keterangan'] || row['KETERANGAN'] || ''
          // Note: Field 'status_guru' TIDAK digunakan - gunakan 'status' saja
          // Field 'bulan' TIDAK digunakan - hanya untuk tabel penggajian
        };

        console.log('Adding record to database:', payrollRecord);

        // Search by name in both local and Supabase
        console.log(`Searching for existing record by name: ${payrollRecord.nama}`);

        // First check local database
        let existingRecords = await db.guru.where('nama').equals(payrollRecord.nama).toArray();
        console.log(`Found ${existingRecords.length} existing records for ${payrollRecord.nama} in local DB`);

        // Also check by NIY if available
        if (existingRecords.length === 0 && payrollRecord.niy) {
          existingRecords = await db.guru.where('niy').equals(payrollRecord.niy).toArray();
          console.log(`Found ${existingRecords.length} existing records for NIY ${payrollRecord.niy} in local DB`);
        }

        // If not found locally, check Supabase
        if (existingRecords.length === 0) {
          try {
            console.log(`🔍 Searching in Supabase for: ${payrollRecord.nama}`);
            const { data: supabaseRecords, error } = await supabase
              .from(TABLES.GURU)
              .select('*')
              .eq('nama', payrollRecord.nama)
              .limit(1); // Only get one record

            if (error) {
              console.error(`❌ Supabase search error for ${payrollRecord.nama}:`, error);
            } else if (supabaseRecords && supabaseRecords.length > 0) {
              console.log(`✅ Found ${supabaseRecords.length} records in Supabase for ${payrollRecord.nama}`);
              const record = supabaseRecords[0];

              // Add to local database first
              await db.guru.add({
                id: record.id,
                nama: record.nama,
                niy: record.niy,
                jabatan: record.jabatan,
                sebagai: record.sebagai || 'Guru',
                email: record.email,
                wa: record.wa,
                status: record.status || 'active', // Field status (bukan status_guru)
                pendidikan: record.pendidikan,
                mk_start_year: record.mk_start_year,
                mk_start_month: record.mk_start_month,
                gaji_pokok: record.gaji_pokok,
                tunjangan_kinerja: record.tunjangan_kinerja,
                tunjangan_umum: record.tunjangan_umum,
                tunjangan_istri: record.tunjangan_istri,
                tunjangan_anak: record.tunjangan_anak,
                tunjangan_kepala_sekolah: record.tunjangan_kepala_sekolah,
                tunjangan_wali_kelas: record.tunjangan_wali_kelas,
                honor_bendahara: record.honor_bendahara,
                keterangan: record.keterangan,
                custom_base_salary: record.custom_base_salary,
                created_at: record.created_at,
                updated_at: record.updated_at
              });

              // Now search again locally
              existingRecords = await db.guru.where('nama').equals(payrollRecord.nama).toArray();
              console.log(`✅ After sync: Found ${existingRecords.length} records in local DB`);
            } else {
              console.log(`ℹ️ No records found in Supabase for ${payrollRecord.nama}`);
            }
          } catch (error) {
            console.error('❌ Error searching in Supabase:', error);
          }
        }

        if (existingRecords.length > 0) {
          const existing = existingRecords[0];
          console.log(`🔄 Replacing existing record for ${payrollRecord.nama} (ID: ${existing.id})`);

          // Complete replacement - import data overwrites everything
          const replacedRecord = {
            ...payrollRecord,
            // Keep only the ID, replace everything else
            id: existing.id,
            // Add metadata
            updated_at: new Date().toISOString()
          };

          try {
            // Search for existing record in Supabase by name (case-insensitive)
            console.log(`🔍 Searching for existing record in Supabase by name: "${payrollRecord.nama}"`);

            // Use ilike for case-insensitive search
            const { data: supabaseSearchResults, error: searchError } = await supabase
              .from(TABLES.GURU)
              .select('*')
              .ilike('nama', payrollRecord.nama)
              .limit(5); // Get multiple results in case of similar names

            if (searchError) {
              console.error(`❌ Error searching for ${payrollRecord.nama} in Supabase:`, searchError);
              throw new Error(`Failed to search for existing record: ${searchError.message}`);
            }

            if (!supabaseSearchResults || supabaseSearchResults.length === 0) {
              console.error(`❌ Guru dengan nama "${payrollRecord.nama}" tidak ditemukan di Supabase`);
              console.error(`📋 Available names in Supabase:`, supabaseSearchResults?.map(r => r.nama));
              throw new Error(`Guru dengan nama "${payrollRecord.nama}" tidak ditemukan di database`);
            }

            // Find exact match (case-insensitive)
            const exactMatch = supabaseSearchResults.find(record =>
              record.nama.toLowerCase() === payrollRecord.nama.toLowerCase()
            );

            if (!exactMatch) {
              console.error(`❌ Exact match not found for "${payrollRecord.nama}"`);
              console.error(`🔍 Similar names found:`, supabaseSearchResults.map(r => r.nama));
              throw new Error(`Exact match not found for "${payrollRecord.nama}". Similar names: ${supabaseSearchResults.map(r => r.nama).join(', ')}`);
            }

            console.log(`✅ Found exact match in Supabase for ${payrollRecord.nama} (ID: ${exactMatch.id})`);

            // Prepare update data with only Excel fields
            const updateData = {
              // MK fields from Excel
              mk_start_year: parseInt(row['Tahun Mulai Kerja'] || row['TAHUN MULAI KERJA'] || 2023),
              mk_start_month: parseInt(row['Bulan Mulai Kerja'] || row['BULAN MULAI KERJA'] || 7),

              // Salary fields from Excel
              gaji_pokok: parseFloat((row['Gaji Pokok'] || row['GAJI POKOK'] || '0').toString().replace(/[^\d]/g, '')) || 0,
              tunjangan_kinerja: parseFloat((row['Tunj. Kinerja'] || row['TUNJ KINERJA'] || '0').toString().replace(/[^\d]/g, '')) || 0,
              tunjangan_umum: parseFloat((row['Tunj. Umum'] || row['TUNJ UMUM'] || '0').toString().replace(/[^\d]/g, '')) || 0,
              tunjangan_istri: parseFloat((row['Tunj. Istri'] || row['TUNJ ISTRI'] || '0').toString().replace(/[^\d]/g, '')) || 0,
              tunjangan_anak: parseFloat((row['Tunj. Anak'] || row['TUNJ ANAK'] || '0').toString().replace(/[^\d]/g, '')) || 0,
              tunjangan_kepala_sekolah: parseFloat((row['Tunj. Kepala Sekolah'] || row['TUNJ KEPALA SEKOLAH'] || '0').toString().replace(/[^\d]/g, '')) || 0,
              tunjangan_wali_kelas: parseFloat((row['Tunj. Wali Kelas'] || row['TUNJ WALI KELAS'] || '0').toString().replace(/[^\d]/g, '')) || 0,
              honor_bendahara: parseFloat((row['Honor Bendahara'] || row['HONOR BENDAHARA'] || '0').toString().replace(/[^\d]/g, '')) || 0,
              keterangan: row['Keterangan'] || row['KETERANGAN'] || '',

              // Metadata
              updated_at: new Date().toISOString()
            };

            console.log(`📤 Updating record in Supabase for ${payrollRecord.nama} with data:`, updateData);

            // Update in Supabase using the found UUID
            const { data: supabaseResult, error: supabaseError } = await supabase
              .from(TABLES.GURU)
              .update(updateData)
              .eq('id', exactMatch.id)
              .select()
              .single();

            if (supabaseError) {
              console.error(`❌ Supabase update error for ${payrollRecord.nama}:`, supabaseError);
              throw supabaseError;
            } else {
              console.log(`✅ Supabase update successful for ${payrollRecord.nama}:`, supabaseResult);
            }

            // Update local database with Supabase data
            await db.guru.update(existing.id, {
              ...replacedRecord,
              id: supabaseResult?.id || existing.id,
              ...updateData
            });
            console.log(`✅ Local database update successful for ${payrollRecord.nama}`);

          } catch (error) {
            console.error(`❌ Error updating ${payrollRecord.nama}:`, error);
            // Fallback to local only
            await db.guru.update(existing.id, replacedRecord);
          }

          console.log(`✅ Replaced record ${existing.id} for ${payrollRecord.nama}`);
        } else {
          console.log(`➕ Adding new record for ${payrollRecord.nama}`);

          try {
            // Create in Supabase first
            const { data: supabaseResult, error: supabaseError } = await supabase
              .from(TABLES.GURU)
              .insert({
                ...payrollRecord,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select()
              .single();

            if (supabaseError) {
              console.error(`❌ Supabase create error for ${payrollRecord.nama}:`, supabaseError);
              throw supabaseError;
            } else {
              console.log(`✅ Supabase create successful for ${payrollRecord.nama}:`, supabaseResult);
            }

            // Create in local database with Supabase ID
            const localResult = await db.guru.add({
              ...payrollRecord,
              id: supabaseResult?.id, // Use Supabase ID
              created_at: new Date().toISOString(),
              imported_at: new Date().toISOString()
            });
            console.log(`✅ Local database create successful for ${payrollRecord.nama} with ID: ${localResult}`);

          } catch (error) {
            console.error(`❌ Error creating ${payrollRecord.nama}:`, error);
            // Fallback to local only with generated ID
            const localResult = await db.guru.add({
              ...payrollRecord,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            console.log(`✅ Fallback local create for ${payrollRecord.nama} with ID: ${localResult}`);
          }

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

    // Verify data in Supabase
    try {
      const { data: supabaseData, error: supabaseError } = await supabase
        .from(TABLES.GURU)
        .select('nama, niy, gaji_pokok, status')
        .order('nama');

      if (!supabaseError && supabaseData) {
        console.log(`✅ Verification: ${supabaseData.length} records in Supabase`);
        console.log('Sample Supabase data:', supabaseData.slice(0, 3));
      } else {
        console.error('❌ Supabase verification error:', supabaseError);
      }
    } catch (error) {
      console.error('❌ Error verifying Supabase data:', error);
    }

    if (successCount > 0) {
      alert(`✅ Import berhasil! ${successCount} data berhasil diimpor${errorCount > 0 ? `, ${errorCount} gagal` : ''}\n📝 Data tersimpan di database dan siap digunakan.`);
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
Status Guru\t: ${employee.status || 'PTY'}
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
Tanpa Keterangan\t: Rp${((employee.attendanceData?.tanpaKeterangan || 0) * deductionSettings.tanpaKeterangan).toLocaleString()} (${employee.attendanceData?.tanpaKeterangan || 0}x)
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
      console.log('💾 Saving salary edit to Supabase...');

      const updateData = {
        custom_base_salary: parseFloat(editValues.gaji_pokok) || 0,
        tunjangan_kinerja: parseFloat(editValues.tunjangan_kinerja) || 0,
        tunjangan_umum: parseFloat(editValues.tunjangan_umum) || 0,
        tunjangan_istri: parseFloat(editValues.tunjangan_istri) || 0,
        tunjangan_anak: parseFloat(editValues.tunjangan_anak) || 0,
        tunjangan_kepala_sekolah: parseFloat(editValues.tunjangan_kepala_sekolah) || 0,
        tunjangan_wali_kelas: parseFloat(editValues.tunjangan_wali_kelas) || 0,
        honor_bendahara: parseFloat(editValues.honor_bendahara) || 0,
        keterangan: editValues.keterangan || '',
        updated_at: new Date().toISOString()
        // Note: 'bulan' field is NOT included - it's only in penggajian table
      };

      // Update in Supabase first
      const { data: supabaseResult, error: supabaseError } = await supabase
        .from(TABLES.GURU)
        .update(updateData)
        .eq('id', employee.id)
        .select()
        .single();

      if (supabaseError) {
        console.error('❌ Supabase update error:', supabaseError);
        throw new Error('Supabase update failed: ' + supabaseError.message);
      } else {
        console.log('✅ Supabase update successful:', supabaseResult);
      }

      // Update local database
      await DatabaseService.update(TABLES.GURU, employee.id, updateData);

      setEditingRow(null);
      setEditValues({});
      loadPayrollData(); // Refresh data
      alert('✅ Data gaji berhasil diperbarui dan disinkronisasi!');
    } catch (error) {
      console.error('Error updating salary:', error);
      alert('❌ Gagal memperbarui data gaji: ' + error.message);
    }
  };

  const cancelEditing = () => {
    setEditingRow(null);
    setEditValues({});
  };

  const sendBulkWhatsApp = async () => {
    if (payrollData.length === 0) {
      alert('Tidak ada data penggajian untuk dikirim');
      return;
    }

    const deviceId = '9b33e3a9-e9ff-4f8b-a62a-90b5eee3f946';
    let successCount = 0;
    let errorCount = 0;

    console.log(`📱 Sending bulk WhatsApp to ${payrollData.length} employees...`);

    for (const employee of payrollData) {
      if (!employee.wa || employee.wa.trim() === '') {
        console.warn(`⚠️ No WhatsApp number for ${employee.nama}`);
        errorCount++;
        continue;
      }

      try {
        let number = employee.wa;
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

        const response = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          console.log(`✅ WhatsApp sent to ${employee.nama}`);
          successCount++;
        } else {
          console.warn(`❌ Failed to send WhatsApp to ${employee.nama}: ${response.statusText}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ Error sending WhatsApp to ${employee.nama}:`, error);
        errorCount++;
      }

      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    alert(`✅ Bulk WhatsApp completed!\nBerhasil: ${successCount}\nGagal: ${errorCount}`);
  };

  const saveBulkEdit = async () => {
    if (payrollData.length === 0) {
      alert('Tidak ada data untuk diupdate');
      return;
    }

    try {
      console.log('💾 Saving bulk edit to Supabase...');

      // Prepare update data
      const updateData = {};
      if (bulkEditValues.gaji_pokok !== '') {
        updateData.custom_base_salary = parseFloat(bulkEditValues.gaji_pokok) || 0;
      }
      if (bulkEditValues.tunjangan_kinerja !== '') {
        updateData.tunjangan_kinerja = parseFloat(bulkEditValues.tunjangan_kinerja) || 0;
      }
      if (bulkEditValues.tunjangan_umum !== '') {
        updateData.tunjangan_umum = parseFloat(bulkEditValues.tunjangan_umum) || 0;
      }
      if (bulkEditValues.tunjangan_istri !== '') {
        updateData.tunjangan_istri = parseFloat(bulkEditValues.tunjangan_istri) || 0;
      }
      if (bulkEditValues.tunjangan_anak !== '') {
        updateData.tunjangan_anak = parseFloat(bulkEditValues.tunjangan_anak) || 0;
      }
      if (bulkEditValues.tunjangan_kepala_sekolah !== '') {
        updateData.tunjangan_kepala_sekolah = parseFloat(bulkEditValues.tunjangan_kepala_sekolah) || 0;
      }
      if (bulkEditValues.tunjangan_wali_kelas !== '') {
        updateData.tunjangan_wali_kelas = parseFloat(bulkEditValues.tunjangan_wali_kelas) || 0;
      }
      if (bulkEditValues.honor_bendahara !== '') {
        updateData.honor_bendahara = parseFloat(bulkEditValues.honor_bendahara) || 0;
      }
      if (bulkEditValues.keterangan !== '') {
        updateData.keterangan = bulkEditValues.keterangan;
      }

      if (Object.keys(updateData).length === 0) {
        alert('❌ Tidak ada data yang diubah');
        return;
      }

      updateData.updated_at = new Date().toISOString();

      // Update all employees in Supabase
      const { error: supabaseError } = await supabase
        .from(TABLES.GURU)
        .update(updateData)
        .eq('status', 'active');

      if (supabaseError) {
        console.error('❌ Supabase bulk update error:', supabaseError);
        throw supabaseError;
      }

      // Update local database
      const { db } = await import('../database.js');
      await db.guru.where('status').equals('active').modify(updateData);

      console.log('✅ Bulk edit successful');
      alert(`✅ Bulk edit berhasil!\n${payrollData.length} data guru telah diperbarui.`);

      // Reset form and reload data
      setBulkEditMode(false);
      setBulkEditValues({
        gaji_pokok: '',
        tunjangan_kinerja: '',
        tunjangan_umum: '',
        tunjangan_istri: '',
        tunjangan_anak: '',
        tunjangan_kepala_sekolah: '',
        tunjangan_wali_kelas: '',
        honor_bendahara: '',
        keterangan: ''
      });
      loadPayrollData();

    } catch (error) {
      console.error('❌ Error in bulk edit:', error);
      alert('❌ Gagal melakukan bulk edit: ' + error.message);
    }
  };

  const generateImportTemplate = () => {
    const templateData = [
      {
        'Nama': 'Contoh Nama Guru',
        'Jabatan': 'Guru Kelas',
        'Status': 'active',
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
        'Status': '',
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
      { wch: 12 }, // Status
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
        employee.status || 'PTY',
        employee.calculated_mk_tahun !== undefined ? employee.calculated_mk_tahun : (employee.mk_tahun || 0),
        employee.calculated_mk_bulan !== undefined ? employee.calculated_mk_bulan : (employee.mk_bulan || 0),
        `Rp${(employee.calculated_base_salary || employee.gaji_pokok || 0).toLocaleString()}${employee.gaji_pokok && employee.gaji_pokok > 0 ? ' (Excel)' : ' (MK)'}`,
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
        `Rp${((employee.attendanceData?.tanpaKeterangan || 0) * deductionSettings.tanpaKeterangan).toLocaleString()}`,
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
        'Tahap 1', 'Tahap 2', 'Tidak Hadir', 'Tanpa Keterangan', 'Pot. Kinerja', 'Jumlah',
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
        17: { cellWidth: 20 },
        18: { cellWidth: 18 },
        19: { cellWidth: 18 },
        20: { cellWidth: 20 },
        21: { cellWidth: 25 }
      }
    });

    doc.save(`Laporan_Penggajian_${selectedMonth}_${selectedYear}.pdf`);
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          💰 Penggajian - Mode: {mode}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            🔄 Real-time Aktif
          </Typography>
          <SyncStatus />
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>📅 Periode Penggajian:</strong> Sistem otomatis menampilkan data bulan lalu untuk pemrosesan penggajian
          <br />
          <strong>📊 Bulan Diproses:</strong> {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
          {selectedMonth !== new Date().getMonth() + 1 && (
            <Typography component="span" color="primary" sx={{ ml: 1, fontWeight: 'bold' }}>
              (Bulan Lalu - Otomatis)
            </Typography>
          )}
          <br />
          <strong>💰 Gaji Langsung:</strong> Data gaji diambil langsung dari Excel import atau input manual
          <br />
          <strong>🔄 Real-time Sync:</strong> Data penggajian, absensi, dan pengaturan tersinkronisasi otomatis
          <br />
          <strong>📱 Bulk Operations:</strong> Gunakan tombol "Edit Semua" dan "Kirim Bulk WA" untuk operasi massal
          <br />
          <strong>� Database:</strong> Pastikan tabel sudah dibuat di Supabase dengan script SQL yang disediakan
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
                  onChange={(e) => handleMonthChange(e.target.value)}
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
                  onChange={(e) => handleYearChange(e.target.value)}
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
                startIcon={<Calculate />}
                onClick={() => {
                  const currentDate = new Date();
                  setSelectedMonth(currentDate.getMonth() + 1);
                  setSelectedYear(currentDate.getFullYear());
                }}
                fullWidth
                title="Tampilkan bulan ini untuk perhitungan"
              >
                Bulan Ini
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
                variant={bulkEditMode ? "contained" : "outlined"}
                color={bulkEditMode ? "primary" : "default"}
                startIcon={<Edit />}
                onClick={() => {
                  // Simple bulk edit mode - don't pre-populate with calculated values
                  // Users can see current values in the table and edit bulk fields as needed
                  setBulkEditMode(!bulkEditMode);
                }}
                fullWidth
              >
                {bulkEditMode ? "Batal Edit Semua" : "Edit Semua"}
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="contained"
                color="success"
                startIcon={<WhatsApp />}
                onClick={sendBulkWhatsApp}
                disabled={payrollData.length === 0}
                fullWidth
              >
                Kirim Bulk WA
              </Button>
            </Grid>


            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                startIcon={<Settings />}
                onClick={async () => {
                  try {
                    // Test Supabase connection
                    const { data, error } = await supabase
                      .from('guru')
                      .select('count')
                      .limit(1);

                    if (error) {
                      console.error('Supabase connection test failed:', error);
                      alert('❌ Koneksi Supabase gagal!\n\nError: ' + error.message + '\n\nPastikan:\n1. Tabel sudah dibuat di Supabase\n2. RLS (Row Level Security) sudah dimatikan atau dikonfigurasi\n3. Kredensial sudah benar');
                    } else {
                      console.log('✅ Supabase connection successful');
                      alert('✅ Koneksi Supabase berhasil!\n\nSilakan jalankan script SQL di Supabase Dashboard untuk membuat tabel.');
                    }
                  } catch (error) {
                    console.error('Connection test error:', error);
                    alert('❌ Error testing connection: ' + error.message);
                  }
                }}
                fullWidth
                title="Test koneksi Supabase"
              >
                Test Supabase
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                startIcon={<Settings />}
                onClick={async () => {
                  try {
                    const { data: supabaseData, error } = await supabase
                      .from(TABLES.GURU)
                      .select('nama, niy, gaji_pokok, status, updated_at')
                      .order('nama');

                    if (error) {
                      console.error('Supabase error:', error);
                      alert('❌ Error mengakses Supabase: ' + error.message);
                    } else {
                      console.log('✅ Supabase data:', supabaseData);
                      alert(`✅ Berhasil mengakses Supabase!\n📊 Total records: ${supabaseData.length}\n🔍 Cek console untuk detail data.`);
                    }
                  } catch (error) {
                    console.error('Error:', error);
                    alert('❌ Error: ' + error.message);
                  }
                }}
                fullWidth
                title="Verifikasi data di Supabase"
              >
                Cek Supabase
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
                  Rp{payrollData.reduce((sum, emp) => {
                    const baseSalary = emp.calculated_base_salary || emp.gaji_pokok || 0;
                    return sum + baseSalary;
                  }, 0).toLocaleString()}
                </Typography>
                <Typography variant="body2">
                  Total Gaji Pokok
                  <Typography variant="caption" display="block" color="text.secondary">
                    (Excel + MK Settings)
                  </Typography>
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

      {/* Bulk Edit Mode Indicator */}
       {bulkEditMode && (
         <Alert severity="warning" sx={{ mb: 3 }}>
           <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
             <Edit /> Mode Edit Massal Aktif
           </Typography>
           <Typography variant="body2" sx={{ mb: 2 }}>
             <strong>Lihat nilai saat ini</strong> di tabel di bawah, kemudian edit field input untuk menerapkan nilai baru ke semua guru.
             Kosongkan field yang tidak ingin diubah. Field yang diisi akan mengganti semua data guru.
           </Typography>
           <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold', mb: 2 }}>
             💡 Tip: Klik pada field mana pun di tabel untuk melihat nilai saat ini dari masing-masing guru
           </Typography>
           <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
             <Button
               variant="outlined"
               onClick={() => {
                 setBulkEditMode(false);
                 setBulkEditValues({
                   gaji_pokok: '',
                   tunjangan_kinerja: '',
                   tunjangan_umum: '',
                   tunjangan_istri: '',
                   tunjangan_anak: '',
                   tunjangan_kepala_sekolah: '',
                   tunjangan_wali_kelas: '',
                   honor_bendahara: '',
                   keterangan: ''
                 });
               }}
             >
               Batal
             </Button>
             <Button
               variant="contained"
               color="primary"
               onClick={saveBulkEdit}
             >
               Simpan Semua ({payrollData.length} Data)
             </Button>
           </Box>
         </Alert>
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
              <TableCell sx={{ fontWeight: 'bold', minWidth: 120 }}>Tanpa Keterangan</TableCell>
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
                  <TableCell>{employee.status || 'PTY'}</TableCell>
                  <TableCell align="center">
                    <Box>
                      <Typography variant="body2">
                        {employee.calculated_mk_tahun !== undefined ? employee.calculated_mk_tahun : (employee.mk_tahun || 0)}
                      </Typography>
                      {employee.mk_tahun && employee.mk_tahun > 0 && (
                        <Typography variant="caption" color="primary.main" sx={{ fontWeight: 'bold' }}>
                          (Excel: {employee.mk_tahun})
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Box>
                      <Typography variant="body2">
                        {employee.calculated_mk_bulan !== undefined ? employee.calculated_mk_bulan : (employee.mk_bulan || 0)}
                      </Typography>
                      {employee.mk_bulan && employee.mk_bulan > 0 && (
                        <Typography variant="caption" color="primary.main" sx={{ fontWeight: 'bold' }}>
                          (Excel: {employee.mk_bulan})
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    {bulkEditMode ? (
                      <TextField
                        size="small"
                        type="number"
                        value={bulkEditValues.gaji_pokok}
                        onChange={(e) => setBulkEditValues({...bulkEditValues, gaji_pokok: e.target.value})}
                        sx={{ width: 100 }}
                        placeholder="Edit nilai baru"
                      />
                    ) : editingRow === (employee.niy || employee.nisn) ? (
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
                        {employee.gaji_pokok && employee.gaji_pokok > 0 ? (
                          <Typography variant="caption" color="primary.main" sx={{ fontWeight: 'bold' }}>
                            (Excel Import)
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="secondary.main">
                            (MK Settings)
                          </Typography>
                        )}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {bulkEditMode ? (
                      <TextField
                        size="small"
                        type="number"
                        value={bulkEditValues.tunjangan_kinerja}
                        onChange={(e) => setBulkEditValues({...bulkEditValues, tunjangan_kinerja: e.target.value})}
                        sx={{ width: 100 }}
                        placeholder="Edit nilai baru"
                      />
                    ) : editingRow === (employee.niy || employee.nisn) ? (
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
                    {bulkEditMode ? (
                      <TextField
                        size="small"
                        type="number"
                        value={bulkEditValues.tunjangan_umum}
                        onChange={(e) => setBulkEditValues({...bulkEditValues, tunjangan_umum: e.target.value})}
                        sx={{ width: 100 }}
                        placeholder="0"
                      />
                    ) : editingRow === (employee.niy || employee.nisn) ? (
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
                    {bulkEditMode ? (
                      <TextField
                        size="small"
                        type="number"
                        value={bulkEditValues.tunjangan_istri}
                        onChange={(e) => setBulkEditValues({...bulkEditValues, tunjangan_istri: e.target.value})}
                        sx={{ width: 100 }}
                        placeholder="0"
                      />
                    ) : editingRow === (employee.niy || employee.nisn) ? (
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
                    {bulkEditMode ? (
                      <TextField
                        size="small"
                        type="number"
                        value={bulkEditValues.tunjangan_anak}
                        onChange={(e) => setBulkEditValues({...bulkEditValues, tunjangan_anak: e.target.value})}
                        sx={{ width: 100 }}
                        placeholder="0"
                      />
                    ) : editingRow === (employee.niy || employee.nisn) ? (
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
                    {bulkEditMode ? (
                      <TextField
                        size="small"
                        type="number"
                        value={bulkEditValues.tunjangan_kepala_sekolah}
                        onChange={(e) => setBulkEditValues({...bulkEditValues, tunjangan_kepala_sekolah: e.target.value})}
                        sx={{ width: 100 }}
                        placeholder="0"
                      />
                    ) : editingRow === (employee.niy || employee.nisn) ? (
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
                    {bulkEditMode ? (
                      <TextField
                        size="small"
                        type="number"
                        value={bulkEditValues.tunjangan_wali_kelas}
                        onChange={(e) => setBulkEditValues({...bulkEditValues, tunjangan_wali_kelas: e.target.value})}
                        sx={{ width: 100 }}
                        placeholder="0"
                      />
                    ) : editingRow === (employee.niy || employee.nisn) ? (
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
                    {bulkEditMode ? (
                      <TextField
                        size="small"
                        type="number"
                        value={bulkEditValues.honor_bendahara}
                        onChange={(e) => setBulkEditValues({...bulkEditValues, honor_bendahara: e.target.value})}
                        sx={{ width: 100 }}
                        placeholder="0"
                      />
                    ) : editingRow === (employee.niy || employee.nisn) ? (
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
                  <TableCell align="center">
                    <Chip
                      label={`Rp${((employee.attendanceData?.tanpaKeterangan || 0) * deductionSettings.tanpaKeterangan).toLocaleString()}`}
                      color={employee.attendanceData?.tanpaKeterangan > 0 ? "error" : "default"}
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
                  <TableCell>
                    {bulkEditMode ? (
                      <TextField
                        size="small"
                        value={bulkEditValues.keterangan}
                        onChange={(e) => setBulkEditValues({...bulkEditValues, keterangan: e.target.value})}
                        sx={{ width: 150 }}
                        placeholder="Keterangan"
                      />
                    ) : (
                      employee.keterangan || ''
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      {bulkEditMode ? (
                        <Typography variant="caption" color="primary" sx={{ alignSelf: 'center', fontWeight: 'bold' }}>
                          Mode Edit Massal
                        </Typography>
                      ) : (
                        <>
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
                            <>
                              <Tooltip title="Edit Gaji & Tunjangan">
                                <IconButton
                                  color="primary"
                                  size="small"
                                  onClick={() => startEditing(employee)}
                                >
                                  <Edit />
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
                            </>
                          )}
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {payrollData.length === 0 && !loading && (
        <Box sx={{ mt: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Tidak ada data penggajian untuk periode yang dipilih. Pastikan data guru/siswa sudah tersedia.
          </Alert>

          {/* Database Setup Instructions */}
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              🗄️ Setup Database Supabase
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Jika data tidak muncul, kemungkinan tabel belum dibuat di Supabase. Ikuti langkah berikut:
            </Typography>
            <Typography variant="body2" component="div">
              <ol>
                <li>1. Buka <strong>Supabase Dashboard</strong> → <strong>SQL Editor</strong></li>
                <li>2. Copy script dari file <strong>supabase-schema.sql</strong></li>
                <li>3. Paste dan jalankan script di SQL Editor</li>
                <li>4. Klik tombol <strong>"Test Supabase"</strong> di bawah untuk verifikasi</li>
                <li>5. Import file Excel untuk memasukkan data guru</li>
              </ol>
            </Typography>
            <Typography variant="body2" sx={{ mt: 2, fontWeight: 'bold' }}>
              💡 Kredensial Supabase Anda sudah dikonfigurasi dengan benar!
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, fontSize: '0.8rem', color: 'text.secondary' }}>
              📊 Data penggajian disimpan di tabel <strong>guru</strong> (bukan tabel penggajian)
            </Typography>
          </Alert>
        </Box>
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

            <Grid item xs={12}>
              <TextField
                label="Potongan Tanpa Keterangan (Rp)"
                type="number"
                value={deductionSettings.tanpaKeterangan}
                onChange={(e) => setDeductionSettings({
                  ...deductionSettings,
                  tanpaKeterangan: parseInt(e.target.value) || 0
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