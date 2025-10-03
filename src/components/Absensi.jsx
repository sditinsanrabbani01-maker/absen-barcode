import React, { useState, useEffect } from 'react';
import { Box, Typography, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Select, MenuItem, FormControl, InputLabel, Checkbox, Alert, LinearProgress, InputAdornment, Stack, Grid, TablePagination, Chip } from '@mui/material';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import SyncIcon from '@mui/icons-material/Sync';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import { db } from '../database';
import IzinForm from './IzinForm';
import DataPerizinan from './DataPerizinan';
import RekapAbsen from './RekapAbsen';
import * as XLSX from 'xlsx';
import { realtimeManager } from '../services/SyncManager';
import { DatabaseService } from '../config/supabase';

const Absensi = ({ mode }) => {
  const [tabValue, setTabValue] = useState(0);
  const [attendance, setAttendance] = useState([]);
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [attendanceSettings, setAttendanceSettings] = useState([]);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [newSetting, setNewSetting] = useState({ type: 'guru', start_time: '', end_time: '', att: '', label: '' });
  const [earlyDismissalDialog, setEarlyDismissalDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedDailyAttendance, setSelectedDailyAttendance] = useState([]);
  const [selectedRecapAttendance, setSelectedRecapAttendance] = useState([]);
  const [editingSetting, setEditingSetting] = useState(null);
  const [editDialog, setEditDialog] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [jabatanTimeSettings, setJabatanTimeSettings] = useState([]);
  const [availableJabatan, setAvailableJabatan] = useState([]);
  const [newJabatanSetting, setNewJabatanSetting] = useState({
    jabatan: '',
    start_time: '',
    end_time: '',
    att: 'Datang', // Default to Datang
    label: 'Datang' // Default label
  });
  const [jabatanTimeDialog, setJabatanTimeDialog] = useState(false);
  const [editingJabatanSetting, setEditingJabatanSetting] = useState(null);
  const [editJabatanDialog, setEditJabatanDialog] = useState(false);
  const [excelImportDialog, setExcelImportDialog] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Reminder settings state
  const [reminderSettings, setReminderSettings] = useState({
    enabled: false,
    reminder_time: '09:00',
    test_mode: false
  });

  // Dialog states
  const [reminderSettingsOpen, setReminderSettingsOpen] = useState(false);

  // Reminder status state
  const [reminderStatus, setReminderStatus] = useState({
    isRunning: false,
    lastCheck: null,
    remindersSent: 0
  });

  // Pagination state for Rekap Absensi
  const [rekapPage, setRekapPage] = useState(0);
  const [rekapRowsPerPage, setRekapRowsPerPage] = useState(20);


  useEffect(() => {
    loadAttendanceData();
    loadAttendanceSettings();
    loadGroupSettings();
    loadJabatanTimeSettings();
    loadReminderSettings();
    loadAvailableJabatan(); // Load jabatan from database

    // Load users from both guru and siswa
    Promise.all([db.guru.toArray(), db.siswa.toArray()]).then(([guru, siswa]) => {
      setUsers([...guru, ...siswa]);
    });

    // ============================================================================
    // NEW: Real-time subscriptions for attendance and perizinan data
    // ============================================================================

    // Setup real-time subscriptions for attendance and perizinan tables
    const tablesToSubscribe = ['attendance', 'perizinan'];
    const subscriptions = [];

    tablesToSubscribe.forEach(tableName => {
      const subscription = realtimeManager.subscribeToTable(tableName, (change) => {
        console.log(`🔄 Real-time ${tableName} change in Absensi:`, change);

        // Reload data when any change occurs
        loadAttendanceData();
        loadAttendanceSettings();
        loadAvailableJabatan();

        // Reload users data after change
        Promise.all([db.guru.toArray(), db.siswa.toArray()]).then(([guru, siswa]) => {
          setUsers([...guru, ...siswa]);
        });
      });

      subscriptions.push(subscription);
    });

    // Listen for connection status changes
    const connectionUnsubscribe = realtimeManager.onConnectionStatus((status) => {
      console.log('🌐 Absensi connection status:', status);
      if (status.online) {
        // Reload data when coming back online
        loadAttendanceData();
        loadAttendanceSettings();
        loadAvailableJabatan();
      }
    });

    // Register global refresh function
    window.refreshAbsensi = loadAttendanceData;

    return () => {
      console.log('🔌 Cleaning up Absensi component subscriptions');
      delete window.refreshAbsensi;
      subscriptions.forEach(sub => sub.unsubscribe());
      connectionUnsubscribe();
    };
  }, []);

  const loadAttendanceData = () => {
    // Load both attendance and perizinan data for rekap
    Promise.all([
      db.attendance.toArray(),
      db.perizinan.toArray()
    ]).then(([attendanceData, perizinanData]) => {
      if (attendanceData.length === 0 && perizinanData.length === 0) {
        // Add default data
        const defaultData = { tanggal: '2023-10-01', identifier: '12345', nama: 'John Doe', jabatan: 'Teacher', jam: '08:00', status: 'Hadir', keterangan: '', sebagai: 'Guru', wa: '08123456789', email: 'john@example.com' };
        db.attendance.add(defaultData).then(() => {
          setAttendance([defaultData]);
        });
      } else {
        // Combine attendance and perizinan data for display
        const combinedData = [
          ...attendanceData.map(item => ({ ...item, dataType: 'attendance' })),
          ...perizinanData.map(item => ({
            ...item,
            dataType: 'perizinan',
            status: item.jenis_izin, // Show jenis_izin as status
            att: 'Izin', // Mark as izin
            jam: '-' // No time for izin
          }))
        ];
        setAttendance(combinedData);
      }
    });
  };

  const loadAttendanceSettings = () => {
    // Try to load from database first
    if (db.attendance_settings) {
      db.attendance_settings.toArray().then(settings => {
        if (settings.length > 0) {
          setAttendanceSettings(settings);
        } else {
          // Fallback to default settings if database is empty
          setDefaultSettings();
        }
      }).catch(error => {
        console.warn('Error loading attendance settings from database:', error);
        setDefaultSettings();
      });
    } else {
      // Fallback if table doesn't exist
      setDefaultSettings();
    }
  };

  const loadGroupSettings = () => {
    if (db.attendance_settings) {
      db.attendance_settings.where('type').equals('group').first().then(setting => {
        if (setting) {
          setGroupName(setting.group_name || '');
        }
      }).catch(error => {
        console.warn('Error loading group settings:', error);
      });
    }
  };

  const loadJabatanTimeSettings = async () => {
    if (db.attendance_settings) {
      try {
        const settings = await db.attendance_settings.where('type').equals('jabatan').toArray();
        setJabatanTimeSettings(settings);
      } catch (error) {
        console.warn('Error loading jabatan time settings:', error);
      }
    }
  };

  // Load jabatan from database untuk dropdown options
  const loadAvailableJabatan = async () => {
    try {
      const [guruData, siswaData] = await Promise.all([
        db.guru.where('status').equals('active').toArray(),
        db.siswa.where('status').equals('active').toArray()
      ]);

      // Get unique jabatan from both tables
      const jabatanSet = new Set();
      guruData.forEach(guru => guru.jabatan && jabatanSet.add(guru.jabatan));
      siswaData.forEach(siswa => siswa.jabatan && jabatanSet.add(siswa.jabatan));

      const jabatanList = Array.from(jabatanSet).sort();
      setAvailableJabatan(jabatanList);
      console.log('Loaded jabatan:', jabatanList);
      return jabatanList;
    } catch (error) {
      console.error('Error loading jabatan:', error);
      setAvailableJabatan([]);
      return [];
    }
  };

  const saveGroupName = () => {
    if (db.attendance_settings) {
      // Check if group setting already exists
      db.attendance_settings.where('type').equals('group').first().then(existing => {
        if (existing) {
          // Update existing
          db.attendance_settings.update(existing.id, { group_name: groupName });
        } else {
          // Create new
          db.attendance_settings.add({
            type: 'group',
            group_name: groupName
          });
        }
        alert('Nama grup berhasil disimpan!');
      }).catch(error => {
        console.error('Error saving group name:', error);
        alert('Gagal menyimpan nama grup');
      });
    }
  };

  const setDefaultSettings = () => {
    setAttendanceSettings([
      // Guru settings
      { id: 1, type: 'guru', start_time: '06:00', end_time: '07:30', att: 'Datang', label: 'Tepat Waktu' },
      { id: 2, type: 'guru', start_time: '07:30', end_time: '08:00', att: 'Datang', label: 'Tahap 1' },
      { id: 3, type: 'guru', start_time: '08:00', end_time: '15:00', att: 'Datang', label: 'Tahap 2' },
      { id: 4, type: 'guru', start_time: '15:00', end_time: '17:00', att: 'Pulang', label: 'Pulang' },

      // Siswa settings
      { id: 5, type: 'siswa', start_time: '06:00', end_time: '07:30', att: 'Datang', label: 'Tepat Waktu' },
      { id: 6, type: 'siswa', start_time: '07:30', end_time: '08:00', att: 'Datang', label: 'Tahap 1' },
      { id: 7, type: 'siswa', start_time: '08:00', end_time: '12:00', att: 'Datang', label: 'Tahap 2' },
      { id: 8, type: 'siswa', start_time: '12:00', end_time: '17:00', att: 'Pulang', label: 'Pulang' }
    ]);
  };

  useEffect(() => {
    localStorage.setItem('attendance', JSON.stringify(attendance));
  }, [attendance]);


  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Calculate attendance status based on time and user type
  const calculateAttendanceStatus = (currentTime, userType) => {
    const settings = attendanceSettings.filter(s => s.type === userType.toLowerCase());
    const currentMinutes = timeToMinutes(currentTime);

    for (const setting of settings) {
      const startMinutes = timeToMinutes(setting.start_time);
      const endMinutes = timeToMinutes(setting.end_time);

      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return { keterangan: setting.label, att: setting.att };
      }
    }

    return { status: 'Diluar Jadwal', keterangan: 'Diluar Jadwal', att: 'Datang' };
  };

  // Convert time string to minutes
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Check for duplicate attendance
  const checkDuplicateAttendance = (identifier, today, currentStatus) => {
    const todayAttendance = attendance.filter(a =>
      a.identifier === identifier &&
      a.tanggal === today
    );

    // Allow "Pulang" if there's already an entry but not "Pulang"
    if (currentStatus === 'Pulang') {
      return todayAttendance.length > 0 && !todayAttendance.some(a => a.status === 'Pulang');
    }

    // Prevent duplicate non-Pulang entries
    return todayAttendance.length > 0;
  };

  // Handle attendance recording with advanced logic
  const recordAttendance = (user, isEarlyDismissal = false) => {
    const today = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().split(' ')[0];

    // Calculate status based on time
    let status, keterangan, att;

    if (isEarlyDismissal) {
      status = 'Pulang Cepat';
      keterangan = 'Pulang Cepat';
      att = 'Pulang';
    } else {
      const result = calculateAttendanceStatus(currentTime, user.sebagai);
      status = result.att; // Use att as status since we removed status field
      keterangan = result.keterangan;
      att = result.att;
    }

    // Check for duplicates
    if (checkDuplicateAttendance(user.niy || user.nisn, today, status)) {
      if (status === 'Pulang') {
        // Allow Pulang if there's already an entry
      } else {
        alert(`Absensi sudah tercatat hari ini untuk ${user.nama}. Status terakhir: ${attendance.find(a => a.identifier === (user.niy || user.nisn) && a.tanggal === today)?.status}`);
        return;
      }
    }

    const newEntry = {
      tanggal: today,
      identifier: user.niy || user.nisn,
      nama: user.nama,
      jabatan: user.jabatan,
      jam: currentTime,
      status: status,
      keterangan: keterangan,
      att: att,
      sebagai: user.sebagai,
      wa: user.wa,
      email: user.email,
    };

    db.attendance.add(newEntry).then(() => {
      loadAttendanceData();
      alert(`Absensi berhasil dicatat untuk ${user.nama} - ${status}`);
    });
  };

  // Settings management functions
  const handleAddSetting = () => {
    if (newSetting.start_time && newSetting.end_time && newSetting.att && newSetting.label) {
      if (db.attendance_settings) {
        db.attendance_settings.add(newSetting).then(() => {
          loadAttendanceSettings();
          setNewSetting({ type: 'guru', start_time: '', end_time: '', att: '', label: '' });
          setSettingsDialog(false);
        }).catch(error => {
          console.error('Error adding setting:', error);
          alert('Gagal menambah pengaturan: ' + error.message);
        });
      } else {
        alert('Database belum diupdate. Silakan refresh halaman atau restart aplikasi.');
      }
    } else {
      alert('Semua field harus diisi!');
    }
  };

  const handleDeleteSetting = (id) => {
    if (confirm('Hapus pengaturan ini?')) {
      if (db.attendance_settings) {
        db.attendance_settings.delete(id).then(() => {
          loadAttendanceSettings();
        }).catch(error => {
          console.error('Error deleting setting:', error);
          alert('Gagal menghapus pengaturan.');
        });
      } else {
        // Remove from local state if table doesn't exist
        setAttendanceSettings(prev => prev.filter(s => s.id !== id));
      }
    }
  };

  const handleEditSetting = (setting) => {
    setEditingSetting(setting);
    setEditDialog(true);
  };

  const handleUpdateSetting = () => {
    if (editingSetting.start_time && editingSetting.end_time && editingSetting.att && editingSetting.label) {
      if (db.attendance_settings) {
        db.attendance_settings.update(editingSetting.id, editingSetting).then(() => {
          loadAttendanceSettings();
          setEditDialog(false);
          setEditingSetting(null);
        }).catch(error => {
          console.error('Error updating setting:', error);
          alert('Gagal mengupdate pengaturan.');
        });
      } else {
        // Update in local state if table doesn't exist
        setAttendanceSettings(prev => prev.map(s => s.id === editingSetting.id ? editingSetting : s));
        setEditDialog(false);
        setEditingSetting(null);
      }
    }
  };

  // Jabatan Time Settings functions
  const handleAddJabatanSetting = () => {
    if (newJabatanSetting.jabatan && newJabatanSetting.start_time && newJabatanSetting.end_time && newJabatanSetting.att && newJabatanSetting.label) {
      if (db.attendance_settings) {
        const settingToAdd = { ...newJabatanSetting, type: 'jabatan' };
        db.attendance_settings.add(settingToAdd).then(() => {
          loadJabatanTimeSettings();
          setNewJabatanSetting({ jabatan: '', start_time: '', end_time: '', att: '', label: '' });
          setJabatanTimeDialog(false);
        }).catch(error => {
          console.error('Error adding jabatan setting:', error);
          alert('Gagal menambah pengaturan jabatan: ' + error.message);
        });
      } else {
        alert('Database belum diupdate. Silakan refresh halaman atau restart aplikasi.');
      }
    } else {
      alert('Semua field harus diisi!');
    }
  };

  const handleEditJabatanSetting = (setting) => {
    setEditingJabatanSetting(setting);
    setEditJabatanDialog(true);
  };

  const handleUpdateJabatanSetting = () => {
    if (editingJabatanSetting.jabatan && editingJabatanSetting.start_time && editingJabatanSetting.end_time && editingJabatanSetting.att && editingJabatanSetting.label) {
      if (db.attendance_settings) {
        db.attendance_settings.update(editingJabatanSetting.id, editingJabatanSetting).then(() => {
          loadJabatanTimeSettings();
          setEditJabatanDialog(false);
          setEditingJabatanSetting(null);
        }).catch(error => {
          console.error('Error updating jabatan setting:', error);
          alert('Gagal mengupdate pengaturan jabatan.');
        });
      } else {
        // Update in local state if table doesn't exist
        setJabatanTimeSettings(prev => prev.map(s => s.id === editingJabatanSetting.id ? editingJabatanSetting : s));
        setEditJabatanDialog(false);
        setEditingJabatanSetting(null);
      }
    }
  };

  const handleDeleteJabatanSetting = (id) => {
    if (confirm('Hapus pengaturan jabatan ini?')) {
      if (db.attendance_settings) {
        db.attendance_settings.delete(id).then(() => {
          loadJabatanTimeSettings();
        }).catch(error => {
          console.error('Error deleting jabatan setting:', error);
          alert('Gagal menghapus pengaturan jabatan.');
        });
      } else {
        // Remove from local state if table doesn't exist
        setJabatanTimeSettings(prev => prev.filter(s => s.id !== id));
      }
    }
  };

  // Excel Import functions
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
          !file.name.endsWith('.xlsx')) {
        alert('Harap pilih file Excel (.xlsx) yang valid');
        return;
      }
      setSelectedFile(file);
    }
  };

  const processExcelImport = async () => {
    if (!selectedFile) {
      alert('Harap pilih file Excel terlebih dahulu');
      return;
    }

    setImportProgress(0);
    setImportResults(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });

          // Assume first sheet contains attendance data
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length < 2) {
            throw new Error('File Excel tidak memiliki data yang cukup');
          }

          // Process the data
          const importResults = await importAttendanceData(jsonData);
          setImportResults(importResults);
          setImportProgress(100);

          // Refresh data
          loadAttendanceData();

        } catch (error) {
          console.error('Error processing Excel file:', error);
          setImportResults({
            success: false,
            message: `Error memproses file: ${error.message}`,
            imported: 0,
            errors: [error.message]
          });
        }
      };

      reader.readAsArrayBuffer(selectedFile);
    } catch (error) {
      console.error('Error reading file:', error);
      setImportResults({
        success: false,
        message: 'Error membaca file',
        imported: 0,
        errors: [error.message]
      });
    }
  };

  const importAttendanceData = async (excelData) => {
    const results = {
      success: true,
      imported: 0,
      skipped: 0,
      errors: []
    };

    // Load all guru and siswa data for auto-matching
    const [guruData, siswaData] = await Promise.all([
      db.guru.toArray(),
      db.siswa.toArray()
    ]);

    const allUsers = [...guruData, ...siswaData];


    // Skip header row
    const dataRows = excelData.slice(1);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      setImportProgress(Math.round((i / dataRows.length) * 90)); // 90% for processing

      try {
        // Expected format: [Tanggal, Identifier, Nama, Jabatan, Jam, Status, Keterangan, Sebagai, WA, Email]
        if (row.length < 2) {
          results.errors.push(`Baris ${i + 2}: Data tidak lengkap. Minimal butuh 2 kolom: Tanggal, Identifier`);
          results.skipped++;
          continue;
        }

        let [tanggal, identifier, nama, jabatan, jam, status, keterangan, sebagai, wa, email] = row;

        // Auto-match with database if identifier is provided
        let matchedUser = null;
        if (identifier && identifier.toString().trim()) {
          const cleanIdentifier = identifier.toString().trim();
          matchedUser = allUsers.find(user =>
            user.niy === cleanIdentifier ||
            user.nisn === cleanIdentifier ||
            user.identifier === cleanIdentifier
          );

          if (matchedUser) {
            // Auto-populate fields from database
            nama = nama || matchedUser.nama;
            jabatan = jabatan || matchedUser.jabatan;
            sebagai = sebagai || matchedUser.sebagai;
            wa = wa || matchedUser.wa;
            email = email || matchedUser.email;

          } else {
            console.warn(`AUTO-MATCH: Row ${i + 2} - No user found for identifier "${cleanIdentifier}"`);
          }
        }

        // Validate required fields (tanggal and identifier are now minimum required)
        if (!tanggal || tanggal.toString().trim() === '') {
          results.errors.push(`Baris ${i + 2}: Tanggal kosong atau tidak ada. Pastikan kolom A (Tanggal) terisi dengan format yang benar.`);
          results.skipped++;
          continue;
        }
        if (!identifier || identifier.toString().trim() === '') {
          results.errors.push(`Baris ${i + 2}: Identifier kosong atau tidak ada. Pastikan kolom B (Identifier/NIY/NISN) terisi.`);
          results.skipped++;
          continue;
        }

        // Check if we have enough data after auto-matching
        if (!nama || nama.toString().trim() === '') {
          if (matchedUser) {
            results.errors.push(`Baris ${i + 2}: Nama tidak dapat diisi otomatis. Data user tidak lengkap.`);
          } else {
            results.errors.push(`Baris ${i + 2}: Nama kosong dan tidak dapat dicocokkan dengan database. Isi kolom C (Nama) atau pastikan identifier valid.`);
          }
          results.skipped++;
          continue;
        }
        if (!sebagai || sebagai.toString().trim() === '') {
          if (matchedUser) {
            results.errors.push(`Baris ${i + 2}: Sebagai tidak dapat diisi otomatis. Data user tidak lengkap.`);
          } else {
            results.errors.push(`Baris ${i + 2}: Kolom "Sebagai" kosong. Harus diisi "Guru" atau "Siswa", atau pastikan identifier valid untuk auto-fill.`);
          }
          results.skipped++;
          continue;
        }

        // Debug identifier processing
        const processedIdentifier = identifier.toString().trim();
        // Note: formattedDate will be logged after date parsing

        // Validate date format
        const dateStr = tanggal.toString().trim();
        let formattedDate;

        try {
          // Check if it's an Excel serial date (large number)
          const serialDate = parseFloat(dateStr);
          if (!isNaN(serialDate) && serialDate > 40000 && serialDate < 50000) {
            // Convert Excel serial date to JavaScript Date
            // Excel serial date starts from January 1, 1900
            const excelEpoch = new Date(1900, 0, 1);
            const daysSinceEpoch = serialDate - 2; // Excel has a bug where it considers 1900-02-29 as valid
            const jsDate = new Date(excelEpoch.getTime() + daysSinceEpoch * 24 * 60 * 60 * 1000);
            formattedDate = jsDate.toISOString().split('T')[0];
          } else if (dateStr.includes('-')) {
            // Handle YYYY-MM-DD or DD-MM-YYYY
            const parts = dateStr.split('-');
            if (parts.length === 3) {
              const [part1, part2, part3] = parts;
              if (part1.length === 4) {
                // YYYY-MM-DD
                formattedDate = dateStr;
              } else if (part3.length === 4) {
                // DD-MM-YYYY or MM-DD-YYYY
                // Assume DD-MM-YYYY for Indonesia
                formattedDate = `${part3}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
              } else {
                throw new Error(`Invalid dash date format: ${dateStr}`);
              }
            } else {
              throw new Error(`Invalid dash date format: ${dateStr}`);
            }
          } else if (dateStr.includes('/')) {
            // Convert DD/MM/YYYY or MM/DD/YYYY to YYYY-MM-DD
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const [part1, part2, part3] = parts;
              // Check if year is in last position
              if (part3.length === 4) {
                // Assume DD/MM/YYYY format (common in Indonesia)
                const day = parseInt(part1);
                const month = parseInt(part2);
                const year = parseInt(part3);
                if (day > 31 || month > 12 || year < 2000 || year > 2030) {
                  throw new Error(`Invalid date values: day=${day}, month=${month}, year=${year}`);
                }
                formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
              } else {
                throw new Error(`Invalid slash date format: ${dateStr} (year should be 4 digits)`);
              }
            } else {
              throw new Error(`Invalid slash date format: ${dateStr}`);
            }
          } else {
            // Try to parse as date object
            const dateObj = new Date(dateStr);
            if (!isNaN(dateObj.getTime())) {
              formattedDate = dateObj.toISOString().split('T')[0];
            } else {
              throw new Error(`Unrecognized date format: ${dateStr}`);
            }
          }

          // Validate the final date
          const testDate = new Date(formattedDate + 'T00:00:00');
          if (isNaN(testDate.getTime())) {
            throw new Error(`Invalid formatted date: ${formattedDate}`);
          }

          // Check if date is reasonable (not too far in past/future)
          const now = new Date();
          const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

          if (testDate < oneYearAgo || testDate > oneYearFromNow) {
            console.warn(`Date ${formattedDate} is outside reasonable range (1 year ago to 1 year from now)`);
            // Don't skip, just warn
          }


        } catch (dateError) {
          results.errors.push(`Baris ${i + 2}: Error parsing tanggal "${dateStr}": ${dateError.message}`);
          results.skipped++;
          continue;
        }

        // Determine attendance status automatically based on time
        let finalStatus, finalKeterangan, finalAtt;


        if (jam && jam.toString().trim()) {
          // Use time-based status determination
          const personType = (sebagai ? sebagai.toString() : 'Siswa').toLowerCase();
          const personJabatan = jabatan ? jabatan.toString() : '';

          // Get both the status label and the att (Datang/Pulang) from attendance settings
          const attendanceResult = getAttendanceStatusWithAtt(jam.toString(), personType, personJabatan);

          if (attendanceResult.timeStatus === 'tepatwaktu') {
            finalStatus = 'TW';
            finalKeterangan = 'Tepat Waktu';
            finalAtt = attendanceResult.att;
          } else if (attendanceResult.timeStatus === 'tahap1') {
            finalStatus = 'T1';
            finalKeterangan = 'Tahap 1';
            finalAtt = attendanceResult.att;
          } else if (attendanceResult.timeStatus === 'tahap2') {
            finalStatus = 'T2';
            finalKeterangan = 'Tahap 2';
            finalAtt = attendanceResult.att;
          } else if (attendanceResult.timeStatus === 'pulang') {
            finalStatus = 'H';
            finalKeterangan = 'Pulang';
            finalAtt = attendanceResult.att;
          } else {
            // Use status from Excel if time-based determination fails
            finalStatus = status ? status.toString() : 'H';
            finalKeterangan = keterangan ? keterangan.toString() : '';
            finalAtt = 'Datang'; // Default to Datang
          }
        } else {
          // No time provided, use status from Excel
          let statusText = status ? status.toString().trim() : '';

          // Normalize status text for common attendance types
          if (statusText) {
            const upperStatus = statusText.toUpperCase();
            if (upperStatus === 'DL' || upperStatus.includes('DINAS LUAR') || upperStatus === 'DINASLUAR') {
              finalStatus = 'Dinas Luar';
            } else if (upperStatus.includes('IZIN') || upperStatus === 'CUTI') {
              finalStatus = 'Izin';
            } else if (upperStatus.includes('SAKIT')) {
              finalStatus = 'Sakit';
            } else {
              // Keep original status if not recognized
              finalStatus = statusText;
            }
          } else {
            finalStatus = 'H';
          }

          finalKeterangan = keterangan ? keterangan.toString() : '';
          finalAtt = 'Datang'; // Default to Datang for manual entries
        }

        // Determine if this is izin/perizinan data (should go to perizinan table)
        const isIzinData = ['Izin', 'Sakit', 'Dinas Luar', 'Cuti'].includes(finalStatus);

        // Check for duplicates based on data type
        if (isIzinData) {
          // Check duplicates in perizinan table
          const existingIzin = await db.perizinan
            .where('[identifier+tanggal]')
            .equals(identifier.toString())
            .and(record => record.tanggal === formattedDate && record.jenis_izin === finalStatus)
            .first();

          if (existingIzin) {
            results.errors.push(`Baris ${i + 2}: Data izin ${finalStatus} sudah ada untuk ${nama} pada ${formattedDate}`);
            results.skipped++;
            continue;
          }
        } else {
          // Check duplicates in attendance table
          const existingAttendance = await db.attendance
            .where('identifier')
            .equals(identifier.toString())
            .and(record => record.tanggal === formattedDate && record.att === finalAtt)
            .first();

          if (existingAttendance) {
            results.errors.push(`Baris ${i + 2}: Data absensi ${finalAtt} sudah ada untuk ${nama} pada ${formattedDate}`);
            results.skipped++;
            continue;
          }
        }

        if (isIzinData) {
          // Insert to perizinan table
          const perizinanRecord = {
            tanggal: formattedDate,
            identifier: identifier.toString(),
            nama: nama.toString(),
            status: 'Disetujui', // Default status for imported izin
            jenis_izin: finalStatus,
            keterangan: finalKeterangan || 'Imported from Excel',
            sebagai: sebagai ? sebagai.toString() : 'Siswa'
          };

          try {
            await db.perizinan.add(perizinanRecord);
            results.imported++;
          } catch (insertError) {
            results.errors.push(`Baris ${i + 2}: Gagal menyimpan data izin untuk ${nama}: ${insertError.message}`);
            results.skipped++;
            continue;
          }
        } else {
          // Create attendance record for regular attendance
          const attendanceRecord = {
            tanggal: formattedDate,
            identifier: identifier.toString(),
            nama: nama.toString(),
            jabatan: jabatan ? jabatan.toString() : '',
            jam: jam ? jam.toString() : '',
            status: finalStatus,
            keterangan: finalKeterangan,
            sebagai: sebagai ? sebagai.toString() : 'Siswa',
            wa: wa ? wa.toString() : '',
            email: email ? email.toString() : '',
            att: finalAtt
          };

          try {
            await db.attendance.add(attendanceRecord);
            results.imported++;
          } catch (insertError) {
            results.errors.push(`Baris ${i + 2}: Gagal menyimpan data absensi untuk ${nama}: ${insertError.message}`);
            results.skipped++;
            continue;
          }
        }

      } catch (error) {
        results.errors.push(`Baris ${i + 2}: ${error.message}`);
        results.skipped++;
      }
    }

    results.message = `Berhasil mengimport ${results.imported} data absensi. ${results.skipped} data dilewati.`;
    return results;
  };

  const resetImportDialog = () => {
    setSelectedFile(null);
    setImportProgress(0);
    setImportResults(null);
    setExcelImportDialog(false);
  };

  const getAttendanceStatusWithAtt = (attendanceTime, personType, personJabatan) => {
    if (!attendanceTime) return { timeStatus: 'tidak hadir', att: 'Datang' };

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
          return {
            timeStatus: setting.label.toLowerCase().replace(' ', ''),
            att: setting.att
          };
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
        return {
          timeStatus: setting.label.toLowerCase().replace(' ', ''),
          att: setting.att
        };
      }
    }

    return { timeStatus: 'tidak hadir', att: 'Datang' };
  };

  // Reminder functions
  const loadReminderSettings = async () => {
    try {
      const settings = await db.reminder_settings.toCollection().first();
      if (settings) {
        setReminderSettings(settings);
      } else {
        // Create default settings
        const defaultSettings = {
          enabled: false,
          reminder_time: '09:00',
          test_mode: false,
          last_reminder_date: null
        };
        await db.reminder_settings.add(defaultSettings);
        setReminderSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error loading reminder settings:', error);
    }
  };

  const saveReminderSettings = async (settings) => {
    try {
      const existing = await db.reminder_settings.toCollection().first();
      if (existing) {
        await db.reminder_settings.update(existing.id, settings);
      } else {
        await db.reminder_settings.add(settings);
      }
      setReminderSettings(settings);
    } catch (error) {
      console.error('Error saving reminder settings:', error);
    }
  };

  const sendIzinReminder = async (person, jenisIzin, currentDate) => {
    try {
      // Get group name from settings
      const groupSetting = await db.attendance_settings.where('type').equals('group').first();
      const groupName = groupSetting?.group_name || 'Guru Sekolah';

      const deviceId = '9b33e3a9-e9ff-4f8b-a62a-90b5eee3f946';
      const izinLink = `${window.location.origin}/izin`;

      const message = `🔄 *PENGINGAT PERIZINAN* 🔄

Assalamu'alaikum
${person.nama}

Kemarin Anda mengajukan ${jenisIzin}.
Hari ini belum ada konfirmasi absensi atau perizinan baru.

Apakah Anda masih ${jenisIzin.toLowerCase()} hari ini?

Jika YA, silahkan ajukan perizinan kembali:
${izinLink}

Jika TIDAK, silahkan lakukan absensi masuk seperti biasa.

Terima kasih atas perhatiannya.`;

      const payload = {
        device_id: deviceId,
        number: person.wa,
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
        console.log(`✅ Reminder sent to ${person.nama} for ${jenisIzin}`);
        return true;
      } else {
        console.warn(`Failed to send reminder to ${person.nama}: ${response.statusText}`);
        return false;
      }
    } catch (error) {
      console.error(`Error sending reminder to ${person.nama}:`, error);
      return false;
    }
  };

  const checkAndSendReminders = async () => {
    try {
      console.log('🔄 Checking for izin reminders...');

      // Get reminder settings
      const reminderSettings = await db.reminder_settings.toCollection().first();
      if (!reminderSettings?.enabled) {
        console.log('❌ Reminder feature is disabled');
        return;
      }

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      console.log(`📅 Checking reminders for ${yesterdayStr} → ${todayStr}`);

      // 🚫 SKIP REMINDERS ON WEEKENDS AND HOLIDAYS
      const isWeekend = today.getDay() === 0 || today.getDay() === 6;
      if (isWeekend) {
        console.log('🏖️ Skipping reminders - today is weekend');
        return 0;
      }

      // Check if today has ANY attendance records (indicates it's a working day)
      const todayAttendance = await db.attendance.where('tanggal').equals(todayStr).toArray();
      if (todayAttendance.length === 0) {
        console.log('🏖️ Skipping reminders - no attendance records today (likely holiday)');
        return 0;
      }

      console.log(`✅ Today is a working day (${todayAttendance.length} attendance records found)`);

      // Get all perizinan from yesterday
      const yesterdayPerizinan = await db.perizinan.where('tanggal').equals(yesterdayStr).toArray();
      console.log(`📋 Found ${yesterdayPerizinan.length} perizinan records from yesterday`);

      // Get all perizinan from today
      const todayPerizinan = await db.perizinan.where('tanggal').equals(todayStr).toArray();
      const todayIdentifiers = new Set(todayPerizinan.map(p => p.identifier));

      // Get all attendance from today
      const todayAttendanceIdentifiers = new Set(todayAttendance.map(a => a.identifier));

      let remindersSent = 0;

      // Check each person who had izin yesterday
      for (const perizinan of yesterdayPerizinan) {
        const identifier = perizinan.identifier;
        const jenisIzin = perizinan.jenis_izin;

        // Skip if they already have perizinan or attendance today
        if (todayIdentifiers.has(identifier) || todayAttendanceIdentifiers.has(identifier)) {
          console.log(`⏭️ Skipping ${perizinan.nama} - already has activity today`);
          continue;
        }

        // Find person details
        let person = await db.guru.where('niy').equals(identifier).first() ||
                     await db.siswa.where('nisn').equals(identifier).first();

        if (person && person.wa) {
          const success = await sendIzinReminder(person, jenisIzin, today);
          if (success) {
            remindersSent++;
            console.log(`📤 Reminder sent to ${person.nama} (${person.wa}) for ${jenisIzin}`);
          } else {
            console.log(`❌ Failed to send reminder to ${person.nama} (${person.wa})`);
          }
        } else {
          console.log(`⚠️ No WhatsApp number for ${perizinan.nama} (${identifier})`);
        }
      }

      // Update last reminder date
      await db.reminder_settings.update(reminderSettings.id, {
        last_reminder_date: todayStr
      });

      console.log(`✅ Reminder check completed. Sent ${remindersSent} reminders.`);

      // Update UI status
      setReminderStatus({
        isRunning: false,
        lastCheck: new Date(),
        remindersSent: remindersSent
      });

      return remindersSent;

    } catch (error) {
      console.error('Error in checkAndSendReminders:', error);
      setReminderStatus({
        isRunning: false,
        lastCheck: new Date(),
        remindersSent: 0
      });
      return 0;
    }
  };

  const testReminder = async (setStatus) => {
    try {
      console.log('🧪 Testing reminder system...');
      setStatus({ isRunning: true, lastCheck: null, remindersSent: 0 });

      const remindersSent = await checkAndSendReminders();

      if (remindersSent > 0) {
        alert(`✅ Test completed! Sent ${remindersSent} test reminders.`);
      } else {
        alert(`ℹ️ Test completed! No reminders needed (everyone already confirmed or it's weekend/holiday).`);
      }
    } catch (error) {
      console.error('Error testing reminder:', error);
      setStatus({ isRunning: false, lastCheck: new Date(), remindersSent: 0 });
      alert('❌ Error testing reminder: ' + error.message);
    }
  };

  // Daily reminder scheduler
  const scheduleDailyReminder = () => {
    const now = new Date();
    const targetTime = new Date();
    targetTime.setHours(9, 0, 0, 0); // 09:00 today

    // If it's already past 09:00, schedule for tomorrow
    if (now >= targetTime) {
      targetTime.setDate(targetTime.getDate() + 1);
    }

    const timeUntilReminder = targetTime.getTime() - now.getTime();
    console.log(`⏰ Next reminder check scheduled in ${Math.round(timeUntilReminder / 1000 / 60)} minutes`);

    setTimeout(async () => {
      await checkAndSendReminders();
      // Schedule next day's reminder
      scheduleDailyReminder();
    }, timeUntilReminder);
  };

  // Start the scheduler when component mounts
  if (typeof window !== 'undefined') {
    window.scheduleDailyReminder = scheduleDailyReminder;
    window.checkAndSendReminders = checkAndSendReminders;
    window.sendIzinReminder = sendIzinReminder;
    // Start scheduling after a short delay
    setTimeout(() => {
      scheduleDailyReminder();
    }, 2000);
  }


  const downloadTemplate = () => {
    // Create sample data for the template
    const templateData = [
      ['Tanggal', 'Identifier', 'Nama', 'Jabatan', 'Jam', 'Status', 'Keterangan', 'Sebagai', 'WA', 'Email'],
      // Minimal data - system will auto-match and fill other fields
      ['2024-01-15', 'S001', '', '', '07:30', '', '', '', '', ''],
      ['2024-01-15', 'G001', '', '', '07:00', '', '', '', '', ''],
      // With some manual data if needed
      ['2024-01-15', 'S002', 'Dedi Kurniawan', 'Kelas 10A', '07:35', '', '', 'Siswa', '08122222222', 'dedi@school.com'],
      // Izin/Sakit/Dinas Luar - will go to PERIZINAN table
      ['2024-01-16', 'S001', '', '', '', 'izin', 'Sakit', '', '', ''],
      ['2024-01-17', 'G001', '', '', '', 'DL', 'Rapat Dinas', '', '', ''],
      // Full manual entry if auto-match fails
      ['2024-01-18', 'EXT001', 'Tamu Eksternal', 'Guest', '08:00', '', '', 'Guru', '08199999999', 'guest@external.com']
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(templateData);

    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 12 }, // Tanggal
      { wch: 12 }, // Identifier
      { wch: 20 }, // Nama
      { wch: 15 }, // Jabatan
      { wch: 8 },  // Jam
      { wch: 10 }, // Status
      { wch: 15 }, // Keterangan
      { wch: 8 },  // Sebagai
      { wch: 15 }, // WA
      { wch: 20 }  // Email
    ];

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Template Import Absensi');

    // Generate and download the file
    XLSX.writeFile(wb, 'Template_Import_Absensi.xlsx');
  };

  // Early dismissal function
  const handleEarlyDismissal = (student) => {
    setSelectedStudent(student);
    setEarlyDismissalDialog(true);
  };

  const confirmEarlyDismissal = () => {
    if (selectedStudent) {
      recordAttendance(selectedStudent, true);
      setEarlyDismissalDialog(false);
      setSelectedStudent(null);
    }
  };

  // Delete functions
  const handleDeleteDailyAttendance = (id) => {
    if (confirm('Hapus record absensi ini?')) {
      db.attendance.delete(id).then(() => {
        loadAttendanceData();
        setSelectedDailyAttendance(prev => prev.filter(selectedId => selectedId !== id));
      });
    }
  };


  const handleDeleteSelectedDaily = () => {
    if (selectedDailyAttendance.length === 0) {
      alert('Pilih data yang ingin dihapus terlebih dahulu');
      return;
    }
    if (confirm(`Hapus ${selectedDailyAttendance.length} record absensi yang dipilih?`)) {
      Promise.all(selectedDailyAttendance.map(id => db.attendance.delete(id))).then(() => {
        loadAttendanceData();
        setSelectedDailyAttendance([]);
        alert('Data absensi yang dipilih telah dihapus');
      });
    }
  };

  const handleDeleteAllAttendance = () => {
    if (confirm('Hapus SEMUA record absensi dan perizinan? Tindakan ini tidak dapat dibatalkan!')) {
      if (confirm('Apakah Anda YAKIN ingin menghapus semua data absensi dan perizinan?')) {
        Promise.all([
          db.attendance.clear(),
          db.perizinan.clear()
        ]).then(() => {
          loadAttendanceData();
          setSelectedDailyAttendance([]);
          setSelectedRecapAttendance([]);
          alert('Semua data absensi dan perizinan telah dihapus');
        });
      }
    }
  };

  // Selection handlers
  const handleSelectDailyAttendance = (id) => {
    setSelectedDailyAttendance(prev =>
      prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
    );
  };

  const handleSelectAllDailyAttendance = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.filter(a => a.tanggal === today);
    const allIds = todayAttendance.map(a => a.id);

    if (selectedDailyAttendance.length === todayAttendance.length) {
      setSelectedDailyAttendance([]);
    } else {
      setSelectedDailyAttendance(allIds);
    }
  };


  const handleScan = (decodedText) => {
    const user = users.find(u => u.niy === decodedText || u.nisn === decodedText);
    if (user) {
      const newEntry = {
        id: Date.now(),
        tanggal: new Date().toISOString().split('T')[0],
        niy: user.niy || user.nisn,
        nama: user.nama,
        jabatan: user.jabatan,
        jam: new Date().toTimeString().split(' ')[0],
        status: 'Hadir',
        keterangan: '',
        sebagai: user.sebagai,
        wa: user.wa,
        email: user.email,
      };
      setAttendance([...attendance, newEntry]);
    } else {
      alert('User not found');
    }
  };


  const renderQRScan = () => (
    <Box>
      <Typography variant="h6" gutterBottom>Scan QR Code untuk Absensi</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Pilih mode scan sesuai kebutuhan:
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={() => window.open('/scan?mode=normal', '_blank')}
          sx={{ flex: 1, py: 2 }}
        >
          📱 Scan Absensi Normal
          <Typography variant="caption" display="block">
            Datang/Pulang berdasarkan waktu
          </Typography>
        </Button>

        <Button
          variant="contained"
          color="warning"
          size="large"
          onClick={() => window.open('/scan?mode=early_departure', '_blank')}
          sx={{ flex: 1, py: 2 }}
        >
          🚪 Scan Pulang Cepat
          <Typography variant="caption" display="block">
            Selalu record sebagai "Pulang"
          </Typography>
        </Button>
      </Box>

      <Box sx={{ mt: 3, p: 2, bgcolor: 'info.main', color: 'white', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          ℹ️ Panduan Penggunaan:
        </Typography>
        <Typography variant="body2" component="div">
          • <strong>Scan Normal:</strong> Untuk absensi harian (datang/pulang otomatis berdasarkan jam)<br/>
          • <strong>Scan Pulang Cepat:</strong> Untuk siswa yang pulang lebih awal (selalu tercatat "Pulang")<br/>
          • <strong>Massal:</strong> Gunakan scan terpisah untuk efisiensi
        </Typography>
      </Box>
    </Box>
  );

  const renderTodayAttendance = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.filter(a => a.tanggal === today);

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Absen Hari Ini ({todayAttendance.length})</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {selectedDailyAttendance.length > 0 && (
              <Button
                variant="contained"
                color="error"
                size="small"
                onClick={handleDeleteSelectedDaily}
              >
                Hapus ({selectedDailyAttendance.length})
              </Button>
            )}
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={handleDeleteAllAttendance}
            >
              Hapus Semua Hari Ini
            </Button>
          </Box>
        </Box>
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={todayAttendance.length > 0 && selectedDailyAttendance.length === todayAttendance.length}
                    indeterminate={selectedDailyAttendance.length > 0 && selectedDailyAttendance.length < todayAttendance.length}
                    onChange={handleSelectAllDailyAttendance}
                  />
                </TableCell>
                <TableCell>Tanggal</TableCell>
                <TableCell>Identifier</TableCell>
                <TableCell>Nama</TableCell>
                <TableCell>Jabatan</TableCell>
                <TableCell>Jam</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Jenis</TableCell>
                <TableCell>Keterangan</TableCell>
                <TableCell>Sebagai</TableCell>
                <TableCell>Pulang Cepat</TableCell>
                <TableCell>Aksi</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {todayAttendance.map((row) => (
                <TableRow key={row.id}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedDailyAttendance.includes(row.id)}
                      onChange={() => handleSelectDailyAttendance(row.id)}
                    />
                  </TableCell>
                  <TableCell>{row.tanggal}</TableCell>
                  <TableCell>{row.identifier}</TableCell>
                  <TableCell>{row.nama}</TableCell>
                  <TableCell>{row.jabatan}</TableCell>
                  <TableCell>{row.jam}</TableCell>
                  <TableCell>{row.dataType === 'perizinan' ? row.jenis_izin : (row.att || '-')}</TableCell>
                  <TableCell>{row.keterangan}</TableCell>
                  <TableCell>{row.sebagai}</TableCell>
                  <TableCell>
                    {row.sebagai === 'Siswa' && row.status !== 'Pulang Cepat' && (
                      <Button
                        variant="outlined"
                        color="warning"
                        size="small"
                        onClick={() => {
                          const student = users.find(u => (u.niy || u.nisn) === row.identifier);
                          if (student) handleEarlyDismissal(student);
                        }}
                      >
                        Pulang Cepat
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      onClick={() => handleDeleteDailyAttendance(row.id)}
                      color="error"
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const renderRekapan = () => {
    // Sort attendance data by date (newest first)
    const sortedAttendance = [...attendance].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    // Calculate pagination
    const totalRecords = sortedAttendance.length;
    const startIndex = rekapPage * rekapRowsPerPage;
    const endIndex = startIndex + rekapRowsPerPage;
    const paginatedData = sortedAttendance.slice(startIndex, endIndex);

    const handleChangePage = (event, newPage) => {
      setRekapPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
      setRekapRowsPerPage(parseInt(event.target.value, 10));
      setRekapPage(0);
    };

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Rekap Absensi Lengkap ({totalRecords} record)</Typography>
          <Typography variant="body2" color="text.secondary">
            Halaman {rekapPage + 1} dari {Math.ceil(totalRecords / rekapRowsPerPage)}
          </Typography>
        </Box>

        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Tanggal</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Identifier</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Nama</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Jabatan</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Jam</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Jenis</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Keterangan</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Sebagai</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Belum ada data absensi
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row, index) => (
                  <TableRow key={`${row.id || index}`} hover>
                    <TableCell>{row.tanggal}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{row.identifier}</TableCell>
                    <TableCell sx={{ fontWeight: 'medium' }}>{row.nama}</TableCell>
                    <TableCell>{row.jabatan}</TableCell>
                    <TableCell>{row.jam || '-'}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          bgcolor: row.dataType === 'perizinan' ? 'warning.main' : 'success.main',
                          color: 'white',
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          display: 'inline-block',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}
                      >
                        {row.dataType === 'perizinan' ? row.jenis_izin : (row.att || row.status)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {row.dataType === 'perizinan' ? 'Izin' : 'Absensi'}
                    </TableCell>
                    <TableCell>{row.keterangan || '-'}</TableCell>
                    <TableCell>{row.sebagai}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={totalRecords}
          page={rekapPage}
          onPageChange={handleChangePage}
          rowsPerPage={rekapRowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50, 100]}
          labelRowsPerPage="Baris per halaman:"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} dari ${count !== -1 ? count : `lebih dari ${to}`}`
          }
        />
      </Box>
    );
  };


  const renderJabatanTimeSettings = () => (
    <Box>
      <Typography variant="h6" gutterBottom>Pengaturan Waktu Absensi Berdasarkan Jabatan</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Atur jadwal absensi khusus untuk jabatan tertentu (contoh: IT, Keamanan, dll.)
      </Typography>

      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => setJabatanTimeDialog(true)}
        sx={{ mb: 2 }}
      >
        Tambah Pengaturan Jabatan
      </Button>

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Jabatan</TableCell>
              <TableCell>Waktu Mulai</TableCell>
              <TableCell>Waktu Akhir</TableCell>
              <TableCell>Att</TableCell>
              <TableCell>Keterangan</TableCell>
              <TableCell>Edit</TableCell>
              <TableCell>Hapus</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jabatanTimeSettings.map((setting) => (
              <TableRow key={setting.id}>
                <TableCell sx={{ fontWeight: 'bold' }}>{setting.jabatan}</TableCell>
                <TableCell>{setting.start_time}</TableCell>
                <TableCell>{setting.end_time}</TableCell>
                <TableCell>{setting.att}</TableCell>
                <TableCell>{setting.label}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleEditJabatanSetting(setting)} color="primary" size="small">
                    Edit
                  </IconButton>
                </TableCell>
                <TableCell>
                  {db.attendance_settings ? (
                    <IconButton onClick={() => handleDeleteJabatanSetting(setting.id)} color="error">
                      <DeleteIcon />
                    </IconButton>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Default
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {jabatanTimeSettings.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Belum ada pengaturan waktu jabatan
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 3, p: 2, bgcolor: 'info.main', color: 'white', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          ℹ️ Cara Penggunaan:
        </Typography>
        <Typography variant="body2" component="div">
          • <strong>Jabatan:</strong> Pilih jabatan yang akan diberi jadwal khusus<br/>
          • <strong>Waktu Mulai/Akhir:</strong> Rentang waktu untuk status tertentu<br/>
          • <strong>Att:</strong> Jenis absensi (Datang/Pulang)<br/>
          • <strong>Keterangan:</strong> Label yang akan muncul (Tepat Waktu, Tahap 1, dll.)
        </Typography>
      </Box>
    </Box>
  );

  const renderFormPerizinan = () => (
    <Box>
      {/* Reminder Settings Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            ⚙️ Pengaturan Reminder Izin
          </Typography>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setReminderSettingsOpen(true)}
            size="small"
          >
            Kelola Reminder
          </Button>
        </Box>
        <Alert severity="info">
          <Typography variant="body2">
            <strong>Fitur Reminder Otomatis:</strong><br/>
            • Mengirim pengingat via WhatsApp jika ada izin kemarin tapi belum ada konfirmasi hari ini<br/>
            • Reminder dikirim pukul {reminderSettings.reminder_time}<br/>
            • <strong>Smart Detection:</strong> Tidak mengirim pada hari libur, weekend, atau hari tanpa aktivitas absensi<br/>
            • {reminderSettings.enabled ? '✅ Aktif' : '❌ Nonaktif'}
          </Typography>

          {/* Reminder Status Indicator */}
          {reminderStatus.lastCheck && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid #e0e0e0' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                📊 Status Reminder Terakhir:
              </Typography>
              <Typography variant="body2">
                🕘 Waktu Check: {reminderStatus.lastCheck.toLocaleString('id-ID')}
              </Typography>
              <Typography variant="body2">
                📤 Reminder Dikirim: {reminderStatus.remindersSent} orang
              </Typography>
              {reminderStatus.isRunning && (
                <Typography variant="body2" color="primary">
                  🔄 Reminder sedang berjalan...
                </Typography>
              )}
            </Box>
          )}
        </Alert>
      </Paper>

      {/* Izin Form */}
      <IzinForm mode={mode} />
    </Box>
  );

  const renderSettings = () => (
    <Box>
      {/* Group Settings */}
      <Typography variant="h6" gutterBottom>Pengaturan Grup WhatsApp</Typography>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Nama Grup untuk Notifikasi Perizinan
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            fullWidth
            label="Nama Grup WhatsApp"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Contoh: Guru Sekolah ABC"
            helperText="Nama grup WhatsApp yang akan menerima notifikasi perizinan"
          />
          <Button
            variant="contained"
            onClick={saveGroupName}
            sx={{ minWidth: 120 }}
          >
            Simpan
          </Button>
        </Box>
      </Paper>

      <Typography variant="h6" gutterBottom>Pengaturan Waktu Absensi</Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setSettingsDialog(true)}
        >
          Tambah Pengaturan
        </Button>
        <Button
          variant="outlined"
          startIcon={<CloudUploadIcon />}
          onClick={() => setExcelImportDialog(true)}
          color="success"
        >
          📤 Import dari Excel
        </Button>
      </Box>

      {/* Guru Settings */}
      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Pengaturan Guru</Typography>
      <TableContainer component={Paper} sx={{ mb: 3, overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Waktu Mulai</TableCell>
              <TableCell>Waktu Akhir</TableCell>
              <TableCell>Att</TableCell>
              <TableCell>Keterangan Keterlambatan</TableCell>
              <TableCell>Edit</TableCell>
              <TableCell>Hapus</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {attendanceSettings.filter(s => s.type === 'guru').map((setting) => (
              <TableRow key={setting.id}>
                <TableCell>{setting.start_time}</TableCell>
                <TableCell>{setting.end_time}</TableCell>
                <TableCell>{setting.att}</TableCell>
                <TableCell>{setting.label}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleEditSetting(setting)} color="primary" size="small">
                    Edit
                  </IconButton>
                </TableCell>
                <TableCell>
                  {db.attendance_settings ? (
                    <IconButton onClick={() => handleDeleteSetting(setting.id)} color="error">
                      <DeleteIcon />
                    </IconButton>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Default
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Siswa Settings */}
      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Pengaturan Siswa</Typography>
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Waktu Mulai</TableCell>
              <TableCell>Waktu Akhir</TableCell>
              <TableCell>Att</TableCell>
              <TableCell>Keterangan Keterlambatan</TableCell>
              <TableCell>Edit</TableCell>
              <TableCell>Hapus</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {attendanceSettings.filter(s => s.type === 'siswa').map((setting) => (
              <TableRow key={setting.id}>
                <TableCell>{setting.start_time}</TableCell>
                <TableCell>{setting.end_time}</TableCell>
                <TableCell>{setting.att}</TableCell>
                <TableCell>{setting.label}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleEditSetting(setting)} color="primary" size="small">
                    Edit
                  </IconButton>
                </TableCell>
                <TableCell>
                  {db.attendance_settings ? (
                    <IconButton onClick={() => handleDeleteSetting(setting.id)} color="error">
                      <DeleteIcon />
                    </IconButton>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Default
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">
          Absensi - Mode: {mode}
        </Typography>

        {/* Real-time Status */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip
            label="⚡ Real-time Sync Aktif"
            color="success"
            variant="outlined"
            size="small"
          />
        </Box>
      </Box>

      {/* Real-time Info Banner */}
      <Box sx={{ mb: 2, p: 2, bgcolor: 'success.light', color: 'success.dark', borderRadius: 1, border: '1px solid', borderColor: 'success.main' }}>
        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
          ⚡ Mode Real-time: Instant Cross-Device Sync
        </Typography>
        <Typography variant="body2" color="success.dark" component="div">
          <strong>📡 Real-time:</strong> Perubahan data langsung terlihat di semua device<br/>
          <strong>🌐 Cross-device:</strong> Input di device A langsung muncul di device B, C, D<br/>
          <strong>⚡ Instant:</strong> Tidak perlu refresh manual atau menunggu sync
        </Typography>
      </Box>
      <Tabs value={tabValue} onChange={handleTabChange}>
        <Tab label="QR Scan" />
        <Tab label="Absen Hari Ini" />
        <Tab label="Rekapan Absen" />
        <Tab label="Form Perizinan" />
        <Tab label="Data Perizinan" />
        <Tab label="Pengaturan Waktu Jabatan" />
        <Tab label="Pengaturan" />
      </Tabs>
      {tabValue === 0 && renderQRScan()}
      {tabValue === 1 && renderTodayAttendance()}
      {tabValue === 2 && renderRekapan()}
      {tabValue === 3 && renderFormPerizinan()}
      {tabValue === 4 && <DataPerizinan mode={mode} />}
      {tabValue === 5 && renderJabatanTimeSettings()}
      {tabValue === 6 && renderSettings()}

      {/* Settings Dialog */}
      <Dialog open={settingsDialog} onClose={() => setSettingsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Tambah Pengaturan Att</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="dense">
            <InputLabel>Tipe</InputLabel>
            <Select
              value={newSetting.type}
              onChange={(e) => setNewSetting({ ...newSetting, type: e.target.value })}
            >
              <MenuItem value="guru">Guru</MenuItem>
              <MenuItem value="siswa">Siswa</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Waktu Mulai"
            type="time"
            value={newSetting.start_time}
            onChange={(e) => setNewSetting({ ...newSetting, start_time: e.target.value })}
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Waktu Akhir"
            type="time"
            value={newSetting.end_time}
            onChange={(e) => setNewSetting({ ...newSetting, end_time: e.target.value })}
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Att"
            value={newSetting.att}
            onChange={(e) => setNewSetting({ ...newSetting, att: e.target.value })}
            fullWidth
            margin="dense"
            placeholder="contoh: Datang, Pulang"
          />
          <TextField
            label="Keterangan"
            value={newSetting.label}
            onChange={(e) => setNewSetting({ ...newSetting, label: e.target.value })}
            fullWidth
            margin="dense"
            placeholder="contoh: Tepat Waktu, Tahap 1, Tahap 2"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialog(false)}>Batal</Button>
          <Button onClick={handleAddSetting} variant="contained">Tambah</Button>
        </DialogActions>
      </Dialog>

      {/* Early Dismissal Dialog */}
      <Dialog open={earlyDismissalDialog} onClose={() => setEarlyDismissalDialog(false)}>
        <DialogTitle>Pulang Cepat</DialogTitle>
        <DialogContent>
          <Typography>
            Apakah Anda yakin ingin mencatat pulang cepat untuk siswa: <strong>{selectedStudent?.nama}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Status akan dicatat sebagai "Pulang Cepat" dengan waktu saat ini.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEarlyDismissalDialog(false)}>Batal</Button>
          <Button onClick={confirmEarlyDismissal} variant="contained" color="warning">
            Konfirmasi Pulang Cepat
          </Button>
        </DialogActions>
      </Dialog>

      {/* Jabatan Time Settings Dialog */}
      <Dialog open={jabatanTimeDialog} onClose={() => setJabatanTimeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Tambah Pengaturan Waktu Jabatan</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="dense">
            <InputLabel>Jabatan</InputLabel>
            <Select
              value={newJabatanSetting.jabatan}
              onChange={(e) => setNewJabatanSetting({ ...newJabatanSetting, jabatan: e.target.value })}
              label="Jabatan"
            >
              {availableJabatan.map((jabatan) => (
                <MenuItem key={jabatan} value={jabatan}>
                  {jabatan}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Waktu Mulai"
            type="time"
            value={newJabatanSetting.start_time}
            onChange={(e) => setNewJabatanSetting({ ...newJabatanSetting, start_time: e.target.value })}
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Waktu Akhir"
            type="time"
            value={newJabatanSetting.end_time}
            onChange={(e) => setNewJabatanSetting({ ...newJabatanSetting, end_time: e.target.value })}
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Att</InputLabel>
            <Select
              value={newJabatanSetting.att}
              onChange={(e) => setNewJabatanSetting({ ...newJabatanSetting, att: e.target.value })}
              label="Att"
            >
              <MenuItem value="Datang">Datang</MenuItem>
              <MenuItem value="Pulang">Pulang</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Keterangan"
            value={newJabatanSetting.label}
            onChange={(e) => setNewJabatanSetting({ ...newJabatanSetting, label: e.target.value })}
            fullWidth
            margin="dense"
            placeholder="contoh: Tepat Waktu, Tahap 1, Tahap 2"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJabatanTimeDialog(false)}>Batal</Button>
          <Button onClick={handleAddJabatanSetting} variant="contained">Tambah</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Jabatan Setting Dialog */}
      <Dialog open={editJabatanDialog} onClose={() => setEditJabatanDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Pengaturan Waktu Jabatan</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="dense">
            <InputLabel>Jabatan</InputLabel>
            <Select
              value={editingJabatanSetting?.jabatan || ''}
              onChange={(e) => setEditingJabatanSetting({ ...editingJabatanSetting, jabatan: e.target.value })}
              label="Jabatan"
            >
              {availableJabatan.map((jabatan) => (
                <MenuItem key={jabatan} value={jabatan}>
                  {jabatan}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Waktu Mulai"
            type="time"
            value={editingJabatanSetting?.start_time || ''}
            onChange={(e) => setEditingJabatanSetting({ ...editingJabatanSetting, start_time: e.target.value })}
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Waktu Akhir"
            type="time"
            value={editingJabatanSetting?.end_time || ''}
            onChange={(e) => setEditingJabatanSetting({ ...editingJabatanSetting, end_time: e.target.value })}
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Att</InputLabel>
            <Select
              value={editingJabatanSetting?.att || ''}
              onChange={(e) => setEditingJabatanSetting({ ...editingJabatanSetting, att: e.target.value })}
              label="Att"
            >
              <MenuItem value="Datang">Datang</MenuItem>
              <MenuItem value="Pulang">Pulang</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Keterangan"
            value={editingJabatanSetting?.label || ''}
            onChange={(e) => setEditingJabatanSetting({ ...editingJabatanSetting, label: e.target.value })}
            fullWidth
            margin="dense"
            placeholder="contoh: Tepat Waktu, Tahap 1, Tahap 2"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditJabatanDialog(false)}>Batal</Button>
          <Button onClick={handleUpdateJabatanSetting} variant="contained">Update</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Setting Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Pengaturan Att</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="dense">
            <InputLabel>Tipe</InputLabel>
            <Select
              value={editingSetting?.type || ''}
              onChange={(e) => setEditingSetting({ ...editingSetting, type: e.target.value })}
            >
              <MenuItem value="guru">Guru</MenuItem>
              <MenuItem value="siswa">Siswa</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Waktu Mulai"
            type="time"
            value={editingSetting?.start_time || ''}
            onChange={(e) => setEditingSetting({ ...editingSetting, start_time: e.target.value })}
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Waktu Akhir"
            type="time"
            value={editingSetting?.end_time || ''}
            onChange={(e) => setEditingSetting({ ...editingSetting, end_time: e.target.value })}
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Att"
            value={editingSetting?.att || ''}
            onChange={(e) => setEditingSetting({ ...editingSetting, att: e.target.value })}
            fullWidth
            margin="dense"
            placeholder="contoh: Datang, Pulang"
          />
          <TextField
            label="Keterangan"
            value={editingSetting?.label || ''}
            onChange={(e) => setEditingSetting({ ...editingSetting, label: e.target.value })}
            fullWidth
            margin="dense"
            placeholder="contoh: Datang, Pulang"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Batal</Button>
          <Button onClick={handleUpdateSetting} variant="contained">Update</Button>
        </DialogActions>
      </Dialog>

      {/* Excel Import Dialog */}
      <Dialog open={excelImportDialog} onClose={resetImportDialog} maxWidth="md" fullWidth>
        <DialogTitle>Import Data Absensi dari Excel</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload file Excel (.xlsx) dengan format kolom: Tanggal, Identifier, Nama, Jabatan, Jam, Status, Keterangan, Sebagai, WA, Email
            <br/>
            <strong>✨ Fitur Auto-Match:</strong> Sistem akan otomatis mencocokkan Identifier dengan database Guru/Siswa dan mengisi data yang kosong.
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Button
                variant="outlined"
                color="info"
                onClick={downloadTemplate}
                sx={{ flex: 1 }}
              >
                📥 Download Template
              </Button>
              <input
                accept=".xlsx"
                style={{ display: 'none' }}
                id="excel-file-input"
                type="file"
                onChange={handleFileSelect}
              />
              <label htmlFor="excel-file-input" style={{ flex: 1 }}>
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<CloudUploadIcon />}
                  fullWidth
                >
                  {selectedFile ? `File: ${selectedFile.name}` : 'Pilih File Excel (.xlsx)'}
                </Button>
              </label>
            </Box>
          </Box>

          {importProgress > 0 && importProgress < 100 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" gutterBottom>
                Memproses import... {importProgress}%
              </Typography>
              <LinearProgress variant="determinate" value={importProgress} />
            </Box>
          )}

          {importResults && (
            <Box sx={{ mb: 3 }}>
              <Alert severity={importResults.success ? 'success' : 'error'} sx={{ mb: 2 }}>
                <Typography variant="body2">
                  {importResults.message}
                </Typography>
              </Alert>

              {importResults.errors && importResults.errors.length > 0 && (
                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                  <Typography variant="subtitle2" color="error" gutterBottom>
                    Detail Error:
                  </Typography>
                  {importResults.errors.map((error, index) => (
                    <Typography key={index} variant="body2" color="error" sx={{ fontSize: '0.75rem' }}>
                      • {error}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          )}

          <Box sx={{ p: 2, bgcolor: 'info.main', color: 'white', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              📋 Format Excel yang Diharapkan:
            </Typography>
            <Typography variant="body2" component="div" sx={{ mb: 2 }}>
              <strong>Kolom Wajib (minimal diisi):</strong><br/>
              • <strong>A: Tanggal</strong> - Format: YYYY-MM-DD (2024-01-15), DD/MM/YYYY (15/01/2024), atau serial date Excel<br/>
              • <strong>B: Identifier</strong> - NISN untuk siswa (S001), NIY untuk guru (G001) - <strong>OTOMATIS cocokkan dengan database!</strong>
            </Typography>
            <Typography variant="body2" component="div" sx={{ mb: 2 }}>
              <strong>Kolom Opsional (akan diisi otomatis jika kosong):</strong><br/>
              • <strong>C: Nama</strong> - Nama lengkap (diisi otomatis dari database)<br/>
              • <strong>D: Jabatan</strong> - Kelas untuk siswa, Mata pelajaran untuk guru (diisi otomatis)<br/>
              • <strong>H: Sebagai</strong> - "Siswa" atau "Guru" (diisi otomatis)<br/>
              • <strong>E: Jam</strong> - Waktu absen (HH:MM format, contoh: 07:30) - <strong>OTOMATIS tentukan status!</strong><br/>
              • <strong>F: Status</strong> - Hanya untuk Izin/Sakit/Dinas Luar/Cuti (kosongkan jika ada Jam)<br/>
              • <strong>G: Keterangan</strong> - Keterangan tambahan<br/>
              • <strong>I: WA</strong> - Nomor WhatsApp (diisi otomatis)<br/>
              • <strong>J: Email</strong> - Alamat email (diisi otomatis)
            </Typography>
            <Typography variant="body2" component="div" sx={{ mb: 2 }}>
              <strong>🤖 Status Otomatis Berdasarkan Waktu:</strong><br/>
              • <strong>Datang (Pagi):</strong> 06:00-12:00 → att: "Datang"<br/>
              • <strong>Pulang (Sore):</strong> 12:00-17:00 → att: "Pulang"<br/>
              • <strong>07:00-07:30</strong> → TW (Tepat Waktu)<br/>
              • <strong>07:30-08:00</strong> → T1 (Tahap 1)<br/>
              • <strong>08:00-12:00</strong> → T2 (Tahap 2)<br/>
              • <strong>12:00+</strong> → H (Hadir/Pulang)<br/>
              • <strong>Izin/Sakit/Dinas Luar/Cuti</strong> → Kosongkan Jam, isi Status (F) dan Keterangan (G) → <strong>OTOMATIS masuk tabel PERIZINAN</strong><br/>
              • <strong>Status Fleksibel:</strong> DL/dl/dinas luar, izin/IZIN/cuti, sakit/SAKIT (otomatis dinormalisasi)
            </Typography>
            <Typography variant="body2" component="div">
              <strong>💡 Tips:</strong><br/>
              • <strong>Auto-Match:</strong> Cukup isi Tanggal + Identifier, sistem otomatis isi nama, jabatan, dll dari database!<br/>
              • Jika ada <strong>Jam</strong>, sistem otomatis tentukan TW/T1/T2 → masuk <strong>tabel ABSENSI</strong><br/>
              • Untuk <strong>Izin/Sakit/Dinas Luar/Cuti</strong>, kosongkan Jam dan isi Status + Keterangan → masuk <strong>tabel PERIZINAN</strong><br/>
              • <strong>Status Otomatis:</strong> DL/dl/dinas luar → "Dinas Luar", izin/cuti/CUTI → "Izin", sakit → "Sakit"<br/>
              • Download template untuk contoh yang benar<br/>
              • Data duplikat dicek per tabel masing-masing<br/>
              • <strong>Minimal Data:</strong> Tanggal + Identifier saja sudah cukup untuk import!
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={resetImportDialog}>Tutup</Button>
          <Button
            onClick={processExcelImport}
            variant="contained"
            disabled={!selectedFile || importProgress > 0}
            color="success"
          >
            {importProgress > 0 ? 'Memproses...' : 'Import Data'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reminder Settings Dialog */}
      <Dialog open={reminderSettingsOpen} onClose={() => setReminderSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NotificationsActiveIcon /> Pengaturan Reminder Izin
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Konfigurasi pengingat otomatis untuk perizinan yang belum dikonfirmasi
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Status Reminder</InputLabel>
                <Select
                  value={reminderSettings.enabled ? 'enabled' : 'disabled'}
                  onChange={(e) => setReminderSettings({
                    ...reminderSettings,
                    enabled: e.target.value === 'enabled'
                  })}
                  label="Status Reminder"
                >
                  <MenuItem value="enabled">Aktif</MenuItem>
                  <MenuItem value="disabled">Nonaktif</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Waktu Reminder (HH:MM)"
                type="time"
                value={reminderSettings.reminder_time}
                onChange={(e) => setReminderSettings({
                  ...reminderSettings,
                  reminder_time: e.target.value
                })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Cara Kerja:</strong><br/>
                  • Setiap hari pukul {reminderSettings.reminder_time}, sistem akan mengecek perizinan kemarin<br/>
                  • Jika ada yang belum konfirmasi hari ini, akan dikirim pengingat via WhatsApp<br/>
                  • Pengingat menyertakan link untuk ajukan perizinan kembali<br/>
                  • <strong>Smart Detection:</strong> Tidak mengirim pada hari libur/weekend atau hari tanpa aktivitas absensi
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReminderSettingsOpen(false)}>Batal</Button>
          <Button
            onClick={() => {
              saveReminderSettings(reminderSettings);
              setReminderSettingsOpen(false);
              alert('✅ Pengaturan reminder berhasil disimpan');
            }}
            variant="contained"
            startIcon={<NotificationsActiveIcon />}
          >
            Simpan Pengaturan
          </Button>
          <Button
            onClick={() => {
              testReminder(setReminderStatus);
            }}
            variant="outlined"
            color="secondary"
          >
            Test Reminder
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Absensi;