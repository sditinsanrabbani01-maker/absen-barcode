import React, { useState, useEffect } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Checkbox, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import * as XLSX from 'xlsx';
import { CloudUpload, CloudDownload } from '@mui/icons-material';
import { db } from '../database';
import { DataMigrationService } from '../config/supabase';

const Database = ({ mode }) => {
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    db.guru.where('status').equals('active').toArray().then(guru => setGuruData(guru));
    db.siswa.where('status').equals('active').toArray().then(siswa => setSiswaData(siswa));
  };

  const handleMigrateToSupabase = async () => {
    setIsMigrating(true);
    try {
      const results = await DataMigrationService.syncLocalToSupabase();
      setMigrationResults(results);
      alert('✅ Migrasi berhasil! Data lokal sudah disinkronisasi ke Supabase.');
    } catch (error) {
      console.error('Migration error:', error);
      alert('❌ Migrasi gagal: ' + error.message);
    } finally {
      setIsMigrating(false);
      setMigrationDialog(false);
    }
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["nama", "identifier", "jabatan", "sebagai", "email", "wa"],
      ["", "", "", "", "", ""],
      ["Contoh Guru: Ahmad Santoso", "G001", "Guru Matematika", "Guru", "ahmad@school.com", "08123456789"],
      ["Contoh Siswa: Rina Sari", "S001", "Kelas 10A", "Siswa", "rina@school.com", "08111111111"]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Data");
    XLSX.writeFile(wb, "template_data.xlsx");
  };

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

  const handleExportAllData = async () => {
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

      alert('Data berhasil diekspor! File backup tersimpan.');
    } catch (error) {
      console.error('Export error:', error);
      alert('Gagal mengekspor data: ' + error.message);
    }
  };

  const handleImportAllData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        if (!importedData.version) {
          alert('File backup tidak valid!');
          return;
        }

        const confirmImport = confirm(
          `Apakah Anda yakin ingin mengimpor data?\n\n` +
          `Guru: ${importedData.guru?.length || 0}\n` +
          `Siswa: ${importedData.siswa?.length || 0}\n` +
          `Absensi: ${importedData.attendance?.length || 0}\n` +
          `Penggajian: ${importedData.penggajian?.length || 0}\n\n` +
          `Data yang ada akan DITIMPA!`
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

        // Import new data
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

        // Reload data
        loadData();

        alert(`Data berhasil diimpor!\n\nImport Summary:\n` +
              `Guru: ${importedData.guru?.length || 0}\n` +
              `Siswa: ${importedData.siswa?.length || 0}\n` +
              `Absensi: ${importedData.attendance?.length || 0}\n` +
              `Penggajian: ${importedData.penggajian?.length || 0}`);

      } catch (error) {
        console.error('Import error:', error);
        alert('Gagal mengimpor data: ' + error.message);
      }
    };

    reader.readAsText(file);
  };

  const handleImportExcel = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Filter out empty rows and headers
        const filteredData = jsonData.filter((item, index) => {
          // Skip header row (index 0)
          if (index === 0) return false;

          // Skip if no name
          if (!item.nama || !item.nama.trim()) return false;

          // Skip obvious header rows
          const name = item.nama.trim().toLowerCase();
          if (name.includes('nama') || name.includes('contoh') || name.includes('template')) {
            return false;
          }

          // Accept data even if some fields are missing
          return true;
        });

        const guruDataImport = filteredData.filter(item => item.sebagai === 'Guru');
        const siswaDataImport = filteredData.filter(item => item.sebagai === 'Siswa' || !item.sebagai);

        let guruImported = 0;
        let siswaImported = 0;
        let guruAdded = 0;
        let guruUpdated = 0;
        let siswaAdded = 0;
        let siswaUpdated = 0;

        // Function to generate unique identifier
        const generateIdentifier = async (role) => {
          const prefix = role === 'Guru' ? 'G' : 'S';
          let counter = 1;
          let identifier;

          do {
            identifier = `${prefix}${counter.toString().padStart(3, '0')}`;
            const table = role === 'Guru' ? db.guru : db.siswa;
            const idField = role === 'Guru' ? 'niy' : 'nisn';
            const existing = await table.where(idField).equals(identifier).first();
            if (!existing) break;
            counter++;
          } while (true);

          return identifier;
        };

        if (guruDataImport.length > 0) {
          // Process guru data with update logic
          const processGuruData = async () => {
            let updated = 0;
            let added = 0;

            for (const item of guruDataImport) {
              try {
                // Validate required fields
                if (!item.nama || !item.nama.trim()) {
                  continue;
                }

                // Determine role and generate identifier if needed
                const role = item.sebagai === 'Guru' ? 'Guru' : 'Guru'; // Default to Guru for this section
                let identifier = item.identifier ? item.identifier.toString().trim() : '';

                if (!identifier) {
                  identifier = await generateIdentifier(role);
                }

                // Check if guru with same name already exists
                const existingByName = await db.guru.where('nama').equals(item.nama.trim()).first();

                if (existingByName) {
                  // Update existing record
                  await db.guru.update(existingByName.id, {
                    niy: identifier,
                    jabatan: item.jabatan || existingByName.jabatan,
                    sebagai: role,
                    email: item.email || existingByName.email,
                    wa: item.wa || existingByName.wa,
                    status: 'active'
                  });
                  updated++;
                } else {
                  // Check if NIY already exists
                  const existingByNiy = await db.guru.where('niy').equals(identifier).first();

                  if (!existingByNiy) {
                    // Add new record
                    const newGuru = {
                      nama: item.nama.trim(),
                      niy: identifier,
                      jabatan: item.jabatan || '',
                      sebagai: role,
                      email: item.email || '',
                      wa: item.wa || '',
                      status: 'active'
                    };
                    await db.guru.add(newGuru);
                    added++;
                  }
                }
              } catch (error) {
                console.error('Error processing guru item:', item, error);
              }
            }

            guruImported = added;
            return { updated, added };
          };

          processGuruData().then((result) => {
            guruAdded = result.added;
            guruUpdated = result.updated;
            loadData();
          }).catch(error => {
            console.error('Error in processGuruData:', error);
          });
        }

        if (siswaDataImport.length > 0) {
          // Process siswa data with update logic
          const processSiswaData = async () => {
            let updated = 0;
            let added = 0;

            for (const item of siswaDataImport) {
              try {
                // Validate required fields
                if (!item.nama || !item.nama.trim()) {
                  continue;
                }

                // Determine role and generate identifier if needed
                const role = item.sebagai === 'Siswa' || !item.sebagai ? 'Siswa' : 'Siswa'; // Default to Siswa for this section
                let identifier = item.identifier ? item.identifier.toString().trim() : '';

                if (!identifier) {
                  identifier = await generateIdentifier(role);
                }

                // Check if siswa with same name already exists
                const existingByName = await db.siswa.where('nama').equals(item.nama.trim()).first();

                if (existingByName) {
                  // Update existing record
                  await db.siswa.update(existingByName.id, {
                    nisn: identifier,
                    jabatan: item.jabatan || existingByName.jabatan,
                    sebagai: role,
                    email: item.email || existingByName.email,
                    wa: item.wa || existingByName.wa,
                    status: 'active'
                  });
                  updated++;
                } else {
                  // Check if NISN already exists
                  const existingByNisn = await db.siswa.where('nisn').equals(identifier).first();

                  if (!existingByNisn) {
                    // Add new record
                    const newSiswa = {
                      nama: item.nama.trim(),
                      nisn: identifier,
                      jabatan: item.jabatan || '',
                      sebagai: role,
                      email: item.email || '',
                      wa: item.wa || '',
                      status: 'active'
                    };
                    await db.siswa.add(newSiswa);
                    added++;
                  }
                }
              } catch (error) {
                console.error('Error processing siswa item:', item, error);
              }
            }

            siswaImported = added;
            return { updated, added };
          };

          processSiswaData().then((result) => {
            siswaAdded = result.added;
            siswaUpdated = result.updated;
            loadData();
          }).catch(error => {
            console.error('Error in processSiswaData:', error);
          });
        }

        // Show detailed import results
        let message = 'Import selesai!\n\n';

        if (guruAdded > 0) message += `Guru baru: ${guruAdded}\n`;
        if (guruUpdated > 0) message += `Guru diupdate: ${guruUpdated}\n`;
        if (siswaAdded > 0) message += `Siswa baru: ${siswaAdded}\n`;
        if (siswaUpdated > 0) message += `Siswa diupdate: ${siswaUpdated}\n`;

        if (guruAdded === 0 && guruUpdated === 0 && siswaAdded === 0 && siswaUpdated === 0) {
          message += 'Tidak ada data yang diimport.\n';
        }

        message += '\n📝 Catatan: Data dengan nama sama akan diupdate secara otomatis untuk menghindari duplikasi.';

        alert(message);
        event.target.value = '';
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleOpen = (item = null) => {
    setEditing(item);
    setForm(item || { nama: '', identifier: '', jabatan: '', sebagai: '', email: '', wa: '' });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (form.sebagai === 'Guru') {
      db.guru.add({
        nama: form.nama,
        niy: form.identifier,
        jabatan: form.jabatan,
        sebagai: form.sebagai,
        email: form.email,
        wa: form.wa,
        status: 'active'
      }).then(() => {
        loadData();
        handleClose();
      });
    } else {
      db.siswa.add({
        nama: form.nama,
        nisn: form.identifier,
        jabatan: form.jabatan,
        sebagai: form.sebagai,
        email: form.email,
        wa: form.wa,
        status: 'active'
      }).then(() => {
        loadData();
        handleClose();
      });
    }
  };

  const handleDeleteSelected = () => {
    if (confirm('Hapus data yang dipilih secara permanen?')) {
      const promises = [];
      selectedGuru.forEach(id => {
        promises.push(db.guru.delete(id));
      });
      selectedSiswa.forEach(id => {
        promises.push(db.siswa.delete(id));
      });
      Promise.all(promises).then(() => {
        setSelectedGuru([]);
        setSelectedSiswa([]);
        loadData();
      });
    }
  };

  const handleMutasiSelected = () => {
    setMutasiDialogOpen(true);
  };

  const confirmMutasi = () => {
    const tanggalKeluar = new Date().toISOString().split('T')[0];
    const promises = [];
    selectedGuru.forEach(id => {
      promises.push(
        db.guru.get(id).then(item => {
          if (item) {
            const inactiveItem = { ...item, tanggal_keluar: tanggalKeluar, alasan };
            return Promise.all([
              db.guru_inactive.add(inactiveItem),
              db.guru.delete(id)
            ]);
          }
        })
      );
    });
    selectedSiswa.forEach(id => {
      promises.push(
        db.siswa.get(id).then(item => {
          if (item) {
            const inactiveItem = { ...item, tanggal_keluar: tanggalKeluar, alasan };
            return Promise.all([
              db.siswa_inactive.add(inactiveItem),
              db.siswa.delete(id)
            ]);
          }
        })
      );
    });
    Promise.all(promises).then(() => {
      setSelectedGuru([]);
      setSelectedSiswa([]);
      setAlasan('');
      setMutasiDialogOpen(false);
      loadData();
    });
  };

  const handleSelectAllGuru = (checked) => {
    if (checked) {
      setSelectedGuru(guruData.map(item => item.id));
    } else {
      setSelectedGuru([]);
    }
  };

  const handleSelectAllSiswa = (checked) => {
    if (checked) {
      setSelectedSiswa(siswaData.map(item => item.id));
    } else {
      setSelectedSiswa([]);
    }
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

  const allData = [
    ...guruData.map(item => ({ ...item, identifier: item.niy })),
    ...siswaData.map(item => ({ ...item, identifier: item.nisn }))
  ];

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Database Management - Mode: {mode}
      </Typography>

      <Box sx={{ mb: 3, p: 2, bgcolor: 'info.main', color: 'white', borderRadius: 1 }}>
        <Typography variant="h6" gutterBottom>
          ℹ️ Sinkronisasi Data Antar Device
        </Typography>
        <Typography variant="body2">
          Data disimpan secara lokal di browser masing-masing device. Untuk menyamakan data antar device:
        </Typography>
        <Typography variant="body2" component="div" sx={{ mt: 1 }}>
          <strong>Cara Sync Data:</strong>
          <br />1. Di device utama: Klik "📤 Backup Semua Data" → simpan file .json
          <br />2. Di device lain: Klik "📥 Restore Data" → pilih file backup
          <br />3. Data akan otomatis tersinkronisasi
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
          💡 Tip: Lakukan backup secara berkala untuk menghindari kehilangan data
        </Typography>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" onClick={handleDownloadTemplate}>
          Download Template
        </Button>
        <Button variant="outlined" onClick={handleExportExcel}>
          Export Excel
        </Button>
        <Button variant="outlined" component="label">
          Import Excel
          <input type="file" accept=".xlsx,.xls" hidden onChange={handleImportExcel} />
        </Button>
        <Button variant="contained" color="success" onClick={handleExportAllData}>
          📤 Backup Semua Data
        </Button>
        <Button variant="contained" color="info" component="label">
          📥 Restore Data
          <input type="file" accept=".json" hidden onChange={handleImportAllData} />
        </Button>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<CloudUpload />}
          onClick={() => setMigrationDialog(true)}
          disabled={isMigrating}
        >
          {isMigrating ? '🔄 Migrating...' : '☁️ Sync ke Supabase'}
        </Button>
        <Button variant="contained" color="primary" onClick={() => handleOpen()}>
          Tambah Manual
        </Button>
        <Button variant="contained" color="error" onClick={handleDeleteSelected} disabled={selectedGuru.length === 0 && selectedSiswa.length === 0}>
          Hapus ({selectedGuru.length + selectedSiswa.length})
        </Button>
        <Button variant="contained" color="warning" onClick={handleMutasiSelected} disabled={selectedGuru.length === 0 && selectedSiswa.length === 0}>
          Mutasi/Keluar ({selectedGuru.length + selectedSiswa.length})
        </Button>
      </Box>

      <Typography variant="h6" gutterBottom>
        Data Guru ({guruData.length})
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 3, overflowX: 'auto' }}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedGuru.length === guruData.length && guruData.length > 0}
                  indeterminate={selectedGuru.length > 0 && selectedGuru.length < guruData.length}
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
            {guruData.map((row) => (
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

      <Typography variant="h6" gutterBottom>
        Data Siswa ({siswaData.length})
      </Typography>
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedSiswa.length === siswaData.length && siswaData.length > 0}
                  indeterminate={selectedSiswa.length > 0 && selectedSiswa.length < siswaData.length}
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
            {siswaData.map((row) => (
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

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editing ? 'Edit Data' : 'Tambah Data Manual'}</DialogTitle>
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
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={mutasiDialogOpen} onClose={() => setMutasiDialogOpen(false)}>
        <DialogTitle>Konfirmasi Mutasi/Keluar</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Alasan"
            fullWidth
            variant="standard"
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMutasiDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmMutasi}>Konfirmasi</Button>
        </DialogActions>
      </Dialog>

      {/* Migration Dialog */}
      <Dialog open={migrationDialog} onClose={() => !isMigrating && setMigrationDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloudUpload /> Migrasi Data ke Supabase
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
                <strong>Hasil Migrasi:</strong><br/>
                • Guru: {migrationResults.guru?.synced || 0} synced, {migrationResults.guru?.skipped || 0} skipped<br/>
                • Siswa: {migrationResults.siswa?.synced || 0} synced, {migrationResults.siswa?.skipped || 0} skipped<br/>
                • Attendance: {migrationResults.attendance?.synced || 0} synced, {migrationResults.attendance?.skipped || 0} skipped<br/>
                • Perizinan: {migrationResults.perizinan?.synced || 0} synced, {migrationResults.perizinan?.skipped || 0} skipped<br/>
                • Settings: {migrationResults.settings?.settingsSynced || 0} synced, {migrationResults.settings?.settingsSkipped || 0} skipped<br/>
                • School Settings: {migrationResults.settings?.schoolSettings || 0} synced
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
            {migrationResults ? 'Tutup' : 'Batal'}
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