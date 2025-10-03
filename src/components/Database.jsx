import React, { useState, useEffect } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Checkbox, FormControl, InputLabel, Select, MenuItem, CircularProgress, Alert, LinearProgress, TablePagination, InputAdornment, Chip } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { CloudUpload, CloudDownload, GetApp, Publish } from '@mui/icons-material';
import { db, clearAllData, resetApplication } from '../database';
import { DatabaseService, supabase } from '../config/supabase';
import { useRealtime } from '../context/RealtimeContext';

const Database = ({ mode }) => {
  // Realtime context
  const { deleteRecord } = useRealtime();

  // State management
  const [guruData, setGuruData] = useState([]);
  const [siswaData, setSiswaData] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nama: '', identifier: '', jabatan: '', sebagai: '', email: '', wa: '' });
  const [selectedGuru, setSelectedGuru] = useState([]);
  const [selectedSiswa, setSelectedSiswa] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mutasiDialogOpen, setMutasiDialogOpen] = useState(false);
  const [alasan, setAlasan] = useState('');
  const [migrationDialog, setMigrationDialog] = useState(false);
  const [migrationResults, setMigrationResults] = useState(null);
  const [isMigrating, setIsMigrating] = useState(false);

  // Loading states
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Pagination states
  const [guruPage, setGuruPage] = useState(0);
  const [guruRowsPerPage, setGuruRowsPerPage] = useState(20);
  const [siswaPage, setSiswaPage] = useState(0);
  const [siswaRowsPerPage, setSiswaRowsPerPage] = useState(20);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredGuruData, setFilteredGuruData] = useState([]);
  const [filteredSiswaData, setFilteredSiswaData] = useState([]);

  // Initial loading state
  const [initialLoading, setInitialLoading] = useState(true);
  const [dataSource, setDataSource] = useState('local'); // 'local' or 'supabase'

  useEffect(() => {
    // ============================================================================
    // NEW: Native Supabase realtime subscriptions (following user's suggestion)
    // ============================================================================

    // Initial load with loading state
    loadData(true);

    // Setup native Supabase realtime subscriptions
    const subscriptions = [];

    // Subscribe to guru table changes using native Supabase
    const guruChannel = supabase
      .channel('guru_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'guru' },
        (payload) => {
          console.log('🔄 Real-time guru change:', payload);
          loadData(); // Reload data when guru table changes
        }
      )
      .subscribe();

    subscriptions.push(guruChannel);

    // Subscribe to siswa table changes using native Supabase
    const siswaChannel = supabase
      .channel('siswa_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'siswa' },
        (payload) => {
          console.log('🔄 Real-time siswa change:', payload);
          loadData(); // Reload data when siswa table changes
        }
      )
      .subscribe();

    subscriptions.push(siswaChannel);

    // Cleanup function
    return () => {
      console.log('🔌 Cleaning up Database component subscriptions');
      subscriptions.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, []);

  // Search filtering effect
  useEffect(() => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();

      const filteredGuru = guruData.filter(item =>
        item.nama?.toLowerCase().includes(searchLower) ||
        item.niy?.toLowerCase().includes(searchLower) ||
        item.jabatan?.toLowerCase().includes(searchLower) ||
        item.email?.toLowerCase().includes(searchLower) ||
        item.wa?.toLowerCase().includes(searchLower)
      );

      const filteredSiswa = siswaData.filter(item =>
        item.nama?.toLowerCase().includes(searchLower) ||
        item.nisn?.toLowerCase().includes(searchLower) ||
        item.jabatan?.toLowerCase().includes(searchLower) ||
        item.email?.toLowerCase().includes(searchLower) ||
        item.wa?.toLowerCase().includes(searchLower)
      );

      setFilteredGuruData(filteredGuru);
      setFilteredSiswaData(filteredSiswa);
    } else {
      setFilteredGuruData(guruData);
      setFilteredSiswaData(siswaData);
    }
  }, [searchTerm, guruData, siswaData]);

  // Load data from IndexedDB
  const loadData = async (isInitialLoad = false) => {
    try {
      const [guru, siswa] = await Promise.all([
        db.guru.where('status').equals('active').toArray(),
        db.siswa.where('status').equals('active').toArray()
      ]);

      setGuruData(guru);
      setSiswaData(siswa);
      setFilteredGuruData(guru);
      setFilteredSiswaData(siswa);

      // Determine data source using Supabase connection
      if (navigator.onLine && import.meta.env.VITE_SUPABASE_URL) {
        setDataSource('supabase');
        console.log('📊 Data loaded from Supabase with real-time sync');
      } else {
        setDataSource('local');
        console.log('📊 Data loaded from local storage');
      }

      // Hide initial loading after first load
      if (isInitialLoad) {
        setInitialLoading(false);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setDataSource('local');
      if (isInitialLoad) {
        setInitialLoading(false);
      }
    }
  };

  // Generate next available identifier (max existing + 1)
  const generateNextIdentifier = async (role) => {
    const prefix = role === 'Guru' ? 'G' : 'S';
    const table = role === 'Guru' ? db.guru : db.siswa;
    const idField = role === 'Guru' ? 'niy' : 'nisn';

    try {
      // Get all existing identifiers for this role
      const existingRecords = await table.where('sebagai').equals(role).toArray();
      const existingIds = existingRecords
        .map(record => record[idField])
        .filter(id => id && id.startsWith(prefix))
        .map(id => {
          const numPart = id.substring(1); // Remove prefix
          const num = parseInt(numPart, 10);
          return isNaN(num) ? 0 : num;
        });

      // Find max number and add 1
      const maxNum = existingIds.length > 0 ? Math.max(...existingIds) : 0;
      const nextNum = maxNum + 1;

      return `${prefix}${nextNum.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating identifier:', error);
      // Fallback to simple counter
      return `${prefix}001`;
    }
  };

  // Batch insert/update operations for better performance
  const batchProcessRecords = async (records, table, idField, role) => {
    const results = { added: 0, updated: 0, skipped: 0 };

    // Process in batches of 10 to avoid blocking UI
    const batchSize = 10;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      const batchPromises = batch.map(async (item) => {
        try {
          // Validate required fields
          if (!item.nama || !item.nama.trim()) {
            console.log(`Skipping ${role.toLowerCase()} item - no name:`, item);
            results.skipped++;
            return;
          }

          let identifier = item.identifier ? item.identifier.toString().trim() : '';

          // Generate identifier if not provided
          if (!identifier) {
            identifier = await generateNextIdentifier(role);
            console.log(`Generated identifier for ${role.toLowerCase()}:`, identifier);
          }

          // Check for existing record by identifier first
          let existingRecord = null;
          if (identifier && identifier.length > 3) {
            existingRecord = await table.where(idField).equals(identifier).first();
          }

          // If not found by identifier, check by name (only if exactly one match)
          if (!existingRecord) {
            const existingByName = await table.where('nama').equals(item.nama.trim()).toArray();
            if (existingByName.length === 1) {
              existingRecord = existingByName[0];
            }
          }

          if (existingRecord) {
            // Update existing record
            await table.update(existingRecord.id, {
              [idField]: identifier,
              jabatan: item.jabatan || existingRecord.jabatan,
              sebagai: role,
              email: item.email || existingRecord.email,
              wa: item.wa || existingRecord.wa,
              status: 'active'
            });
            console.log(`Updated ${role.toLowerCase()}:`, item.nama, `with ${idField}:`, identifier);
            results.updated++;
          } else {
            // Check for duplicate identifier
            const existingById = await table.where(idField).equals(identifier).first();
            if (!existingById) {
              // Add new record
              const newRecord = {
                nama: item.nama.trim(),
                [idField]: identifier,
                jabatan: item.jabatan || '',
                sebagai: role,
                email: item.email || '',
                wa: item.wa || '',
                status: 'active'
              };
              await table.add(newRecord);
              console.log(`Added new ${role.toLowerCase()}:`, item.nama, `with ${idField}:`, identifier);
              results.added++;
            } else {
              console.log(`Skipping ${role.toLowerCase()} - ${idField} already exists:`, identifier);
              results.skipped++;
            }
          }
        } catch (error) {
          console.error(`Error processing ${role.toLowerCase()} item:`, item, error);
          results.skipped++;
        }
      });

      await Promise.all(batchPromises);

      // Update progress
      setImportProgress(Math.min(100, ((i + batch.length) / records.length) * 100));
    }

    return results;
  };

  // Handle Excel import with proper async/await
  const handleImportExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress(0);

    try {
      const reader = new FileReader();
      const fileData = await new Promise((resolve, reject) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });

      const workbook = XLSX.read(fileData, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Filter and validate data
      const filteredData = jsonData.filter((item, index) => {
        if (index === 0) return false; // Skip header

        if (!item.nama || !item.nama.trim()) return false;
        if (!isNaN(item.nama.trim())) return false; // Skip numeric names

        const name = item.nama.trim().toLowerCase();
        if (name.includes('nama') || name.includes('contoh') || name.includes('template')) return false;

        return true;
      });

      console.log('📊 Import Debug Info:');
      console.log('Total rows in Excel:', jsonData.length);
      console.log('Filtered data count:', filteredData.length);

      // Separate guru and siswa data
      const guruDataImport = filteredData.filter(item => item.sebagai === 'Guru');
      const siswaDataImport = filteredData.filter(item => item.sebagai === 'Siswa' || !item.sebagai);

      console.log(`👨‍🏫 Processing ${guruDataImport.length} guru records...`);
      console.log(`👨‍🎓 Processing ${siswaDataImport.length} siswa records...`);

      // Process both tables concurrently for better performance
      const [guruResults, siswaResults] = await Promise.all([
        batchProcessRecords(guruDataImport, db.guru, 'niy', 'Guru'),
        batchProcessRecords(siswaDataImport, db.siswa, 'nisn', 'Siswa')
      ]);

      // Reload data to refresh UI
      await loadData();

      // Show results
      const message = generateImportMessage(guruResults, siswaResults);
      alert(message);

    } catch (error) {
      console.error('Import error:', error);
      alert('❌ Gagal mengimpor data: ' + error.message);
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      event.target.value = ''; // Reset file input
    }
  };

  // Generate import result message
  const generateImportMessage = (guruResults, siswaResults) => {
    let message = '✅ Import selesai!\n\n';

    if (guruResults.added > 0) message += `Guru baru: ${guruResults.added}\n`;
    if (guruResults.updated > 0) message += `Guru diupdate: ${guruResults.updated}\n`;
    if (siswaResults.added > 0) message += `Siswa baru: ${siswaResults.added}\n`;
    if (siswaResults.updated > 0) message += `Siswa diupdate: ${siswaResults.updated}\n`;

    const totalProcessed = guruResults.added + guruResults.updated + siswaResults.added + siswaResults.updated;
    if (totalProcessed === 0) {
      message += '⚠️ Tidak ada data yang diimport.\n';
    }

    if (guruResults.skipped > 0 || siswaResults.skipped > 0) {
      message += `\n⚠️ Data dilewati: ${guruResults.skipped + siswaResults.skipped} record\n`;
    }

    message += '\n📝 Catatan: Data dengan identifier sama akan diupdate, duplikasi dicegah otomatis.';
    return message;
  };

  // Handle JSON import/export
  const handleImportAllData = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      const fileContent = await new Promise((resolve, reject) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
      });

      const importedData = JSON.parse(fileContent);

      if (!importedData.version) {
        alert('❌ File backup tidak valid!');
        return;
      }

      const confirmImport = confirm(
        `⚠️ Import Data Lengkap\n\n` +
        `Guru: ${importedData.guru?.length || 0}\n` +
        `Siswa: ${importedData.siswa?.length || 0}\n` +
        `Absensi: ${importedData.attendance?.length || 0}\n` +
        `Penggajian: ${importedData.penggajian?.length || 0}\n\n` +
        `❗ Data yang ada akan DITIMPA!\n\nLanjutkan?`
      );

      if (!confirmImport) return;

      // Clear existing data
      await Promise.all([
        db.guru.clear(),
        db.siswa.clear(),
        db.attendance.clear(),
        db.penggajian.clear(),
        db.guru_inactive.clear(),
        db.siswa_inactive.clear(),
        db.attendance_settings?.clear()
      ]);

      // Batch import new data
      const importPromises = [];
      if (importedData.guru?.length) importPromises.push(db.guru.bulkAdd(importedData.guru));
      if (importedData.siswa?.length) importPromises.push(db.siswa.bulkAdd(importedData.siswa));
      if (importedData.attendance?.length) importPromises.push(db.attendance.bulkAdd(importedData.attendance));
      if (importedData.penggajian?.length) importPromises.push(db.penggajian.bulkAdd(importedData.penggajian));
      if (importedData.guru_inactive?.length) importPromises.push(db.guru_inactive.bulkAdd(importedData.guru_inactive));
      if (importedData.siswa_inactive?.length) importPromises.push(db.siswa_inactive.bulkAdd(importedData.siswa_inactive));
      if (importedData.attendance_settings?.length && db.attendance_settings) {
        importPromises.push(db.attendance_settings.bulkAdd(importedData.attendance_settings));
      }

      await Promise.all(importPromises);
      await loadData();

      alert(`✅ Data berhasil diimpor!\n\n` +
            `Guru: ${importedData.guru?.length || 0}\n` +
            `Siswa: ${importedData.siswa?.length || 0}\n` +
            `Absensi: ${importedData.attendance?.length || 0}\n` +
            `Penggajian: ${importedData.penggajian?.length || 0}`);

    } catch (error) {
      console.error('Import error:', error);
      alert('❌ Gagal mengimpor data: ' + error.message);
    }

    event.target.value = '';
  };

  // Handle export with loading state
  const handleExportAllData = async () => {
    setIsExporting(true);
    try {
      const [guru, siswa, attendance, penggajian, guruInactive, siswaInactive, settings] = await Promise.all([
        db.guru.toArray(),
        db.siswa.toArray(),
        db.attendance.toArray(),
        db.penggajian.toArray(),
        db.guru_inactive.toArray(),
        db.siswa_inactive.toArray(),
        db.attendance_settings ? db.attendance_settings.toArray() : []
      ]);

      const allData = {
        guru,
        siswa,
        attendance,
        penggajian,
        guru_inactive: guruInactive,
        siswa_inactive: siswaInactive,
        attendance_settings: settings,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      const dataStr = JSON.stringify(allData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `absen_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert('✅ Data berhasil diekspor! File backup tersimpan.');
    } catch (error) {
      console.error('Export error:', error);
      alert('❌ Gagal mengekspor data: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Supabase migration with confirmation
  const handleMigrateToSupabase = async () => {
    const confirmMigration = confirm(
      `🚀 Migrasi ke Supabase\n\n` +
      `Ini akan mengupload semua data lokal ke database cloud Supabase.\n\n` +
      `• Data yang sudah ada di Supabase akan diupdate\n` +
      `• Data baru akan ditambahkan\n` +
      `• Proses ini tidak akan menghapus data lokal\n\n` +
      `Lanjutkan migrasi?`
    );

    if (!confirmMigration) return;

    setIsMigrating(true);
    try {
      console.log('🔄 Starting Supabase migration...');
      const results = await DatabaseService.syncLocalToSupabase();

      console.log('✅ Migration completed:', results);
      setMigrationResults(results);

      // Verify data in Supabase
      console.log('🔍 Verifying data in Supabase...');
      const { data: guruData, error: guruError } = await supabase.from('guru').select('*').limit(5);
      const { data: siswaData, error: siswaError } = await supabase.from('siswa').select('*').limit(5);

      if (guruError || siswaError) {
        console.error('❌ Verification failed:', { guruError, siswaError });
        alert('⚠️ Migrasi berhasil, tetapi verifikasi gagal. Periksa koneksi Supabase.');
      } else {
        console.log('✅ Verification successful:', {
          guruCount: guruData?.length || 0,
          siswaCount: siswaData?.length || 0
        });

        const successMessage = `✅ Migrasi Berhasil!\n\n` +
          `📊 Hasil Migrasi:\n` +
          `• Guru: ${results.guru?.synced || 0} synced, ${results.guru?.skipped || 0} skipped\n` +
          `• Siswa: ${results.siswa?.synced || 0} synced, ${results.siswa?.skipped || 0} skipped\n` +
          `• Attendance: ${results.attendance?.synced || 0} synced\n` +
          `• Perizinan: ${results.perizinan?.synced || 0} synced\n\n` +
          `🔍 Verifikasi: ${guruData?.length || 0} guru, ${siswaData?.length || 0} siswa ditemukan di Supabase`;

        alert(successMessage);
      }
    } catch (error) {
      console.error('❌ Migration failed:', error);
      alert('❌ Migrasi gagal: ' + error.message);
    } finally {
      setIsMigrating(false);
    }
  };

  // CRUD operations
  const handleOpen = (item = null) => {
    setEditing(item);
    setForm(item || { nama: '', identifier: '', jabatan: '', sebagai: '', email: '', wa: '' });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditing(null);
  };

  const handleSave = async () => {
    try {
      const tableName = form.sebagai === 'Guru' ? 'guru' : 'siswa';
      const data = {
        nama: form.nama,
        [form.sebagai === 'Guru' ? 'niy' : 'nisn']: form.identifier,
        jabatan: form.jabatan,
        sebagai: form.sebagai,
        email: form.email,
        wa: form.wa,
        status: 'active'
      };

      if (editing) {
        // Update existing record
        await DatabaseService.update(tableName, editing.id, data);
      } else {
        // Create new record
        await DatabaseService.create(tableName, data);
      }

      await loadData();
      handleClose();
    } catch (error) {
      console.error('Save error:', error);
      alert('❌ Gagal menyimpan data: ' + error.message);
    }
  };

  // Selection handlers with consistency checks
  const handleSelectAllGuru = (checked) => {
    setSelectedGuru(checked ? guruData.map(item => item.id) : []);
  };

  const handleSelectAllSiswa = (checked) => {
    setSelectedSiswa(checked ? siswaData.map(item => item.id) : []);
  };

  const handleSelectGuru = (id) => {
    setSelectedGuru(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectSiswa = (id) => {
    setSelectedSiswa(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Delete selected records using realtime manager
  const handleDeleteSelected = async () => {
    if (!confirm('❌ Hapus data yang dipilih secara permanen?')) return;

    try {
      // Delete from local database first to prevent sync issues
      const localDeletePromises = [];

      // Delete guru records from local database
      for (const id of selectedGuru) {
        localDeletePromises.push(db.guru.delete(id));
      }

      // Delete siswa records from local database
      for (const id of selectedSiswa) {
        localDeletePromises.push(db.siswa.delete(id));
      }

      // Wait for local deletions to complete
      await Promise.all(localDeletePromises);
      console.log('✅ Local database records deleted');

      // Then delete from Supabase
      const supabaseDeletePromises = [];

      // Delete guru records with their niy identifier
      for (const id of selectedGuru) {
        const guru = guruData.find(g => g.id === id);
        if (guru) {
          supabaseDeletePromises.push(deleteRecord('guru', id, guru.niy));
        }
      }

      // Delete siswa records with their nisn identifier
      for (const id of selectedSiswa) {
        const siswa = siswaData.find(s => s.id === id);
        if (siswa) {
          supabaseDeletePromises.push(deleteRecord('siswa', id, siswa.nisn));
        }
      }

      // Wait for Supabase deletions to complete
      await Promise.all(supabaseDeletePromises);
      console.log('✅ Supabase records deleted');

      setSelectedGuru([]);
      setSelectedSiswa([]);

      // Reload data after a short delay to ensure sync is complete
      setTimeout(async () => {
        await loadData();
        alert('✅ Data berhasil dihapus');
      }, 1000);

    } catch (error) {
      console.error('Delete error:', error);
      alert('❌ Gagal menghapus data: ' + error.message);
    }
  };

  // Mutasi (transfer) selected records
  const handleMutasiSelected = () => {
    setMutasiDialogOpen(true);
  };

  const confirmMutasi = async () => {
    if (!alasan.trim()) {
      alert('❌ Alasan mutasi harus diisi!');
      return;
    }

    try {
      const tanggalKeluar = new Date().toISOString().split('T')[0];
      const mutasiPromises = [];

      // Process guru mutasi
      for (const id of selectedGuru) {
        const item = await db.guru.get(id);
        if (item) {
          const inactiveItem = { ...item, tanggal_keluar: tanggalKeluar, alasan };
          mutasiPromises.push(
            db.guru_inactive.add(inactiveItem),
            db.guru.delete(id)
          );
        }
      }

      // Process siswa mutasi
      for (const id of selectedSiswa) {
        const item = await db.siswa.get(id);
        if (item) {
          const inactiveItem = { ...item, tanggal_keluar: tanggalKeluar, alasan };
          mutasiPromises.push(
            db.siswa_inactive.add(inactiveItem),
            db.siswa.delete(id)
          );
        }
      }

      await Promise.all(mutasiPromises);
      setSelectedGuru([]);
      setSelectedSiswa([]);
      setAlasan('');
      setMutasiDialogOpen(false);
      await loadData();

      alert('✅ Mutasi berhasil diproses');
    } catch (error) {
      console.error('Mutasi error:', error);
      alert('❌ Gagal memproses mutasi: ' + error.message);
    }
  };

  // Template download
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["nama", "identifier", "jabatan", "sebagai", "email", "wa"],
      ["Contoh Guru", "G001", "Guru Matematika", "Guru", "guru@school.com", "08123456789"],
      ["Contoh Siswa", "S001", "Kelas 10A", "Siswa", "siswa@school.com", "08111111111"]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Data");
    XLSX.writeFile(wb, "template_data.xlsx");
  };

  // Reset all data
  const handleResetAllData = async () => {
    try {
      await resetApplication();
      await loadData();
      setSelectedGuru([]);
      setSelectedSiswa([]);
      alert('✅ Semua data berhasil direset ke kondisi awal');
    } catch (error) {
      console.error('Error resetting data:', error);
      alert('❌ Gagal mereset data: ' + error.message);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const allData = [
      ...guruData.map(item => ({ ...item, identifier: item.niy })),
      ...siswaData.map(item => ({ ...item, identifier: item.nisn }))
    ];
    const ws = XLSX.utils.json_to_sheet(allData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Lengkap");
    XLSX.writeFile(wb, "data_lengkap.xlsx");
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">
          Database Management - Mode: {mode}
        </Typography>

        {/* Real-time Status Indicator */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {initialLoading ? (
            <Chip
              label="⏳ Memuat data..."
              color="primary"
              variant="outlined"
            />
          ) : (
            <Chip
              label={dataSource === 'supabase' ? '⚡ Real-time Sync Aktif' : '💾 Data Lokal'}
              color={dataSource === 'supabase' ? 'success' : 'default'}
              variant="outlined"
            />
          )}
        </Box>
      </Box>

      {/* Initial Loading Progress */}
      {initialLoading && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            🔄 Menginisialisasi sistem dan memuat data dari cloud...
          </Typography>
          <LinearProgress />
        </Box>
      )}

      {/* Info Panel */}
      <Box sx={{
        mb: 3,
        p: 2,
        bgcolor: dataSource === 'supabase' ? 'success.main' : 'info.main',
        color: 'white',
        borderRadius: 1
      }}>
        <Typography variant="h6" gutterBottom>
          {initialLoading ? '⏳ Memuat Sistem...' : `ℹ️ Database ${dataSource === 'supabase' ? 'Supabase Cloud' : 'Lokal'} Aktif`}
        </Typography>

        {initialLoading ? (
          <Typography variant="body2">
            🔄 Menginisialisasi sistem dan memuat data dari {navigator.onLine ? 'cloud' : 'storage lokal'}...
          </Typography>
        ) : (
          <Typography variant="body2" component="div">
            {dataSource === 'supabase' ? (
              <>
                <strong>⚡ Mode Real-time Database:</strong><br/>
                • 📡 Real-time subscriptions aktif<br/>
                • 🔄 Update otomatis antar device<br/>
                • 🌐 Sinkronisasi real-time dengan Supabase<br/>
                • 💾 Data tersimpan di cloud dan lokal
              </>
            ) : (
              <>
                <strong>💾 Mode Local Database:</strong><br/>
                • 📱 Aplikasi siap digunakan offline<br/>
                • ✅ Semua fitur tetap berfungsi<br/>
                • 📡 Real-time subscriptions siap aktifkan<br/>
                • 🔄 Auto-activate saat online
              </>
            )}
          </Typography>
        )}

        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
          {initialLoading ?
            '⏳ Mohon tunggu sebentar, sistem sedang memuat...' :
            `💡 Status: ${dataSource === 'supabase' ? 'Real-time sync aktif' : 'Mode offline siap'}`
          }
        </Typography>
      </Box>

      {/* Search and Action Buttons */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          label="🔍 Cari Data"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari nama, NIY, NISN, jabatan, email..."
          sx={{ minWidth: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <Button variant="contained" onClick={handleDownloadTemplate}>
          📥 Template
        </Button>
        <Button variant="outlined" onClick={handleExportExcel}>
          📊 Export Excel
        </Button>
        <Button variant="outlined" component="label" disabled={isImporting}>
          📤 Import Excel
          <input type="file" accept=".xlsx,.xls" hidden onChange={handleImportExcel} />
        </Button>
        <Button
          variant="contained"
          color="success"
          startIcon={isExporting ? <CircularProgress size={20} /> : <GetApp/>}
          onClick={handleExportAllData}
          disabled={isExporting}
        >
          {isExporting ? '📤 Exporting...' : '📤 Backup Data'}
        </Button>
        <Button
          variant="contained"
          color="info"
          component="label"
          startIcon={<Publish/>}
        >
          📥 Restore Data
          <input type="file" accept=".json" hidden onChange={handleImportAllData} />
        </Button>
        <Button
          variant="contained"
          color="secondary"
          startIcon={isMigrating ? <CircularProgress size={20} /> : <CloudUpload/>}
          onClick={() => setMigrationDialog(true)}
          disabled={isMigrating}
        >
          {isMigrating ? '☁️ Migrating...' : '☁️ Sync Supabase'}
        </Button>
        <Button variant="contained" color="primary" onClick={() => handleOpen()}>
          ➕ Tambah Manual
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleDeleteSelected}
          disabled={selectedGuru.length === 0 && selectedSiswa.length === 0}
        >
          🗑️ Hapus ({selectedGuru.length + selectedSiswa.length})
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={handleMutasiSelected}
          disabled={selectedGuru.length === 0 && selectedSiswa.length === 0}
        >
          📋 Mutasi ({selectedGuru.length + selectedSiswa.length})
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => {
            if (confirm('⚠️ Yakin ingin menghapus SEMUA data? Aksi ini tidak dapat dibatalkan!')) {
              handleResetAllData();
            }
          }}
          sx={{ ml: 2 }}
        >
          🗑️ Reset Semua Data
        </Button>
      </Box>

      {/* Import Progress */}
      {isImporting && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            📤 Importing data... {importProgress.toFixed(0)}%
          </Typography>
          <LinearProgress variant="determinate" value={importProgress} />
        </Box>
      )}

      {/* Guru Table */}
      <Typography variant="h6" gutterBottom>
        👨‍🏫 Data Guru ({
          initialLoading ? '...' : filteredGuruData.length
        }{searchTerm ? ` dari ${initialLoading ? '...' : guruData.length}` : ''})
        {!initialLoading && dataSource === 'supabase' && (
          <Typography component="span" variant="body2" color="success.main" sx={{ ml: 1 }}>
            • Data dari Supabase
          </Typography>
        )}
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 1, overflowX: 'auto' }}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedGuru.length === filteredGuruData.length && filteredGuruData.length > 0}
                  indeterminate={selectedGuru.length > 0 && selectedGuru.length < filteredGuruData.length}
                  onChange={(e) => handleSelectAllGuru(e.target.checked)}
                />
              </TableCell>
              <TableCell>Nama</TableCell>
              <TableCell>NIY</TableCell>
              <TableCell>Jabatan</TableCell>
              <TableCell>Sebagai</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>WA</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredGuruData
              .slice(guruPage * guruRowsPerPage, guruPage * guruRowsPerPage + guruRowsPerPage)
              .map((row) => (
                <TableRow key={row.id}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedGuru.includes(row.id)}
                      onChange={() => handleSelectGuru(row.id)}
                    />
                  </TableCell>
                  <TableCell>{row.nama}</TableCell>
                  <TableCell>{row.niy}</TableCell>
                  <TableCell>{row.jabatan}</TableCell>
                  <TableCell>{row.sebagai}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.wa}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={filteredGuruData.length}
        page={guruPage}
        onPageChange={(event, newPage) => setGuruPage(newPage)}
        rowsPerPage={guruRowsPerPage}
        onRowsPerPageChange={(event) => {
          setGuruRowsPerPage(parseInt(event.target.value, 10));
          setGuruPage(0);
        }}
        rowsPerPageOptions={[10, 20, 50, 100]}
        labelRowsPerPage="Baris per halaman:"
        labelDisplayedRows={({ from, to, count }) =>
          `${from}-${to} dari ${count !== -1 ? count : `lebih dari ${to}`}`
        }
      />

      {/* Siswa Table */}
      <Typography variant="h6" gutterBottom>
        👨‍🎓 Data Siswa ({
          initialLoading ? '...' : filteredSiswaData.length
        }{searchTerm ? ` dari ${initialLoading ? '...' : siswaData.length}` : ''})
        {!initialLoading && dataSource === 'supabase' && (
          <Typography component="span" variant="body2" color="success.main" sx={{ ml: 1 }}>
            • Data dari Supabase
          </Typography>
        )}
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 1, overflowX: 'auto' }}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedSiswa.length === filteredSiswaData.length && filteredSiswaData.length > 0}
                  indeterminate={selectedSiswa.length > 0 && selectedSiswa.length < filteredSiswaData.length}
                  onChange={(e) => handleSelectAllSiswa(e.target.checked)}
                />
              </TableCell>
              <TableCell>Nama</TableCell>
              <TableCell>NISN</TableCell>
              <TableCell>Jabatan</TableCell>
              <TableCell>Sebagai</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>WA</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredSiswaData
              .slice(siswaPage * siswaRowsPerPage, siswaPage * siswaRowsPerPage + siswaRowsPerPage)
              .map((row) => (
                <TableRow key={row.id}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedSiswa.includes(row.id)}
                      onChange={() => handleSelectSiswa(row.id)}
                    />
                  </TableCell>
                  <TableCell>{row.nama}</TableCell>
                  <TableCell>{row.nisn}</TableCell>
                  <TableCell>{row.jabatan}</TableCell>
                  <TableCell>{row.sebagai}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.wa}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={filteredSiswaData.length}
        page={siswaPage}
        onPageChange={(event, newPage) => setSiswaPage(newPage)}
        rowsPerPage={siswaRowsPerPage}
        onRowsPerPageChange={(event) => {
          setSiswaRowsPerPage(parseInt(event.target.value, 10));
          setSiswaPage(0);
        }}
        rowsPerPageOptions={[10, 20, 50, 100]}
        labelRowsPerPage="Baris per halaman:"
        labelDisplayedRows={({ from, to, count }) =>
          `${from}-${to} dari ${count !== -1 ? count : `lebih dari ${to}`}`
        }
      />

      {/* Add/Edit Dialog */}
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editing ? '✏️ Edit Data' : '➕ Tambah Data Manual'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nama"
            fullWidth
            variant="standard"
            value={form.nama}
            onChange={(e) => setForm({ ...form, nama: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Identifier"
            fullWidth
            variant="standard"
            value={form.identifier}
            onChange={(e) => setForm({ ...form, identifier: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Jabatan"
            fullWidth
            variant="standard"
            value={form.jabatan}
            onChange={(e) => setForm({ ...form, jabatan: e.target.value })}
          />
          <FormControl fullWidth margin="dense" variant="standard">
            <InputLabel>Sebagai</InputLabel>
            <Select
              value={form.sebagai}
              onChange={(e) => setForm({ ...form, sebagai: e.target.value })}
            >
              <MenuItem value="Guru">Guru</MenuItem>
              <MenuItem value="Siswa">Siswa</MenuItem>
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Email"
            fullWidth
            variant="standard"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <TextField
            margin="dense"
            label="WA"
            fullWidth
            variant="standard"
            value={form.wa}
            onChange={(e) => setForm({ ...form, wa: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>❌ Batal</Button>
          <Button onClick={handleSave}>✅ Simpan</Button>
        </DialogActions>
      </Dialog>

      {/* Mutasi Dialog */}
      <Dialog open={mutasiDialogOpen} onClose={() => setMutasiDialogOpen(false)}>
        <DialogTitle>📋 Konfirmasi Mutasi/Keluar</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Alasan Mutasi"
            fullWidth
            variant="standard"
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            multiline
            rows={3}
            placeholder="Contoh: Pindah sekolah, Lulus, dll."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMutasiDialogOpen(false)}>❌ Batal</Button>
          <Button onClick={confirmMutasi} disabled={!alasan.trim()}>✅ Konfirmasi Mutasi</Button>
        </DialogActions>
      </Dialog>

      {/* Migration Dialog */}
      <Dialog open={migrationDialog} onClose={() => !isMigrating && setMigrationDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloudUpload /> ☁️ Migrasi Data ke Supabase
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Sinkronisasi data lokal ke database Supabase cloud. Pastikan RLS policies sudah dikonfigurasi dengan benar.
          </Typography>

          {migrationResults && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom color="success.dark">
                ✅ Migrasi Berhasil!
              </Typography>
              <Typography variant="body2" component="div">
                <strong>📊 Hasil Migrasi:</strong><br/>
                • Guru: {migrationResults.guru?.synced || 0} synced, {migrationResults.guru?.skipped || 0} skipped<br/>
                • Siswa: {migrationResults.siswa?.synced || 0} synced, {migrationResults.siswa?.skipped || 0} skipped<br/>
                • Attendance: {migrationResults.attendance?.synced || 0} synced<br/>
                • Perizinan: {migrationResults.perizinan?.synced || 0} synced<br/>
                • Settings: {migrationResults.settings?.settingsSynced || 0} synced
              </Typography>
            </Box>
          )}

          <Box sx={{ mt: 3, p: 2, bgcolor: 'info.main', color: 'white', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              ℹ️ Cara Kerja Migrasi:
            </Typography>
            <Typography variant="body2" component="div">
              • <strong>Data lokal</strong> dibaca dari browser storage<br/>
              • <strong>Duplicate check</strong> - data yang sudah ada di Supabase dilewati<br/>
              • <strong>Sync otomatis</strong> - data baru diinsert, existing diupdate<br/>
              • <strong>Batch processing</strong> untuk performa optimal<br/>
              • <strong>Rollback safe</strong> - jika error, tidak ada data yang hilang
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMigrationDialog(false)} disabled={isMigrating}>
            {migrationResults ? '✅ Tutup' : '❌ Batal'}
          </Button>
          {!migrationResults && (
            <Button
              onClick={handleMigrateToSupabase}
              variant="contained"
              disabled={isMigrating}
              startIcon={<CloudUpload />}
            >
              {isMigrating ? '🔄 Memigrasi...' : '🚀 Mulai Migrasi'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Database;