import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Alert,
  Grid
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { db } from '../database';
import { WHATSAPP_CONFIG, getGroupName } from '../config/whatsapp';

// Reminder utility functions
const sendIzinReminder = async (person, jenisIzin, currentDate) => {
  try {
    // Get group name from settings
    const groupSetting = await db.attendance_settings.where('type').equals('group').first();
    const groupName = groupSetting?.group_name || 'Guru Sekolah';

    const deviceId = WHATSAPP_CONFIG.deviceId;
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

    const formData = new FormData();
    formData.append("device_id", deviceId);
    formData.append("number", person.wa);
    formData.append("message", message);

    const response = await fetch("/api/whatsapp/send", {
      method: "POST",
      body: formData
    });

    if (response.ok) {
      console.log(`✅ Reminder sent to ${person.nama} for ${jenisIzin}`);
      return true;
    } else {
      console.warn(`WhatsApp service not available for reminder: ${response.status} - ${response.statusText}`);
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
    const isWeekend = today.getDay() === 0 || today.getDay() === 6; // Sunday = 0, Saturday = 6
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

// Make functions available globally for testing
window.checkAndSendReminders = checkAndSendReminders;
window.sendIzinReminder = sendIzinReminder;

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
  // Start scheduling after a short delay
  setTimeout(() => {
    scheduleDailyReminder();
  }, 2000);
}

// Reminder settings functions
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

const IzinForm = ({ mode }) => {
  const isStandalone = mode === 'Standalone';
  const [searchQuery, setSearchQuery] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [jenisIzin, setJenisIzin] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');


  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Masukkan kata kunci pencarian');
      return;
    }

    setLoading(true);
    setError('');
    setFoundUser(null);

    try {
      const query = searchQuery.trim();

      // Search in guru table across multiple fields (case-insensitive)
      const queryLower = query.toLowerCase();

      // Search nama (case-insensitive)
      // Search nama (case-insensitive)
      const namaGuruResults = await db.guru.toArray();
      const namaGuruMatch = namaGuruResults.find(guru => guru.nama && guru.nama.toLowerCase().includes(queryLower));

      // Search email (case-insensitive)
      const emailGuruResults = await db.guru.toArray();
      const emailGuruMatch = emailGuruResults.find(guru => guru.email && guru.email.toLowerCase().includes(queryLower));

      // Search exact matches for identifiers
      const exactGuruResults = await Promise.all([
        db.guru.where('niy').equals(query).first(),
        db.guru.where('wa').equals(query).first()
      ]);

      // Find first non-null result from guru
      const guruResult = namaGuruMatch || emailGuruMatch || exactGuruResults.find(result => result !== undefined);

      // If not found in guru, search in siswa table (case-insensitive)
      let siswaResult = null;
      if (!guruResult) {
        // Search nama (case-insensitive)
        const namaSiswaResults = await db.siswa.toArray();
        const namaSiswaMatch = namaSiswaResults.find(siswa => siswa.nama && siswa.nama.toLowerCase().includes(queryLower));

        // Search email (case-insensitive)
        const emailSiswaResults = await db.siswa.toArray();
        const emailSiswaMatch = emailSiswaResults.find(siswa => siswa.email && siswa.email.toLowerCase().includes(queryLower));

        // Search exact matches for identifiers
        const exactSiswaResults = await Promise.all([
          db.siswa.where('nisn').equals(query).first(),
          db.siswa.where('wa').equals(query).first()
        ]);

        siswaResult = namaSiswaMatch || emailSiswaMatch || exactSiswaResults.find(result => result !== undefined);
      }

      const user = guruResult || siswaResult;

      if (user) {
        setFoundUser(user);
      } else {
        setError('Pengguna tidak ditemukan. Coba dengan NIY, NISN, Nama, Email, atau No WA yang berbeda.');
      }
    } catch (err) {
      setError('Terjadi kesalahan saat mencari data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!foundUser || !jenisIzin || !keterangan.trim()) {
      setError('Semua field harus diisi');
      return;
    }

    // Validate date range for all izin types
    if (!tanggalMulai || !tanggalSelesai) {
      setError('Tanggal mulai dan selesai harus diisi');
      return;
    }
    if (tanggalMulai > tanggalSelesai) {
      setError('Tanggal mulai tidak boleh lebih besar dari tanggal selesai');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const today = new Date().toISOString().split('T')[0];

      // Save to perizinan table
      const perizinanData = {
        tanggal: today,
        tanggal_mulai: tanggalMulai,
        tanggal_selesai: tanggalSelesai,
        identifier: foundUser.niy || foundUser.nisn,
        nama: foundUser.nama,
        status: foundUser.status,
        jenis_izin: jenisIzin,
        keterangan: keterangan.trim(),
        sebagai: foundUser.sebagai
      };

      const result = await db.perizinan.add(perizinanData);

      // Send WhatsApp message to group
      await sendWhatsAppToGroup(foundUser, jenisIzin, keterangan.trim(), today, tanggalMulai, tanggalSelesai);

      // Reset form
      setFoundUser(null);
      setJenisIzin('');
      setKeterangan('');
      setTanggalMulai('');
      setTanggalSelesai('');
      setSuccess(true);

      // Trigger global refresh for DataPerizinan component
      if (window.refreshPerizinanData) {
        window.refreshPerizinanData();
      }

      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);

    } catch (err) {
      setError('Gagal mengirim permohonan izin: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendWhatsAppToGroup = async (user, jenisIzin, keterangan, today, tanggalMulai, tanggalSelesai) => {
    try {
      // Get group name from settings using centralized function
      const groupName = await getGroupName(db);
      const deviceId = WHATSAPP_CONFIG.deviceId;

      let message = `📢 *PERIZINAN ${user.sebagai.toUpperCase()}* 📢

Assalamu'alaikum
Nama   : ${user.nama}
${user.sebagai === 'Guru' ? 'NIY' : 'NISN'} : ${user.niy || user.nisn}
Status : ${user.sebagai}
Jenis Izin : ${jenisIzin}
Keterangan : ${keterangan}

Tanggal pengajuan : ${today}`;

      // Add date range for all izin types
      if (tanggalMulai && tanggalSelesai) {
        if (tanggalMulai === tanggalSelesai) {
          message += `
Tanggal : ${tanggalMulai}`;
        } else {
          message += `
Tanggal Mulai : ${tanggalMulai}
Tanggal Selesai : ${tanggalSelesai}`;
        }
      }

      const formData = new FormData();
      formData.append("device_id", deviceId);
      formData.append("group", groupName);
      formData.append("message", message);

      const response = await fetch("/api/whatsapp/sendgroup", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        console.warn(`WhatsApp service not available: ${response.status} - ${response.statusText}`);
        return; // Don't throw error - izin is still saved
      }

    } catch (error) {
      // Don't throw error here - the permission is still saved
    }
  };

  if (isStandalone) {
    return (
      <Box sx={{
        height: '100vh',
        width: '100vw',
        position: 'fixed',
        top: 0,
        left: 0,
        bgcolor: 'background.default',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Box sx={{
          flex: 1,
          overflowY: 'auto',
          p: 3,
          maxWidth: 800,
          mx: 'auto',
          width: '100%'
        }}>
          <Typography variant="h5" gutterBottom align="center" sx={{ mb: 3 }}>
            📋 Sistem Perizinan Online
          </Typography>
          {renderFormContent()}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Form Perizinan - Mode: {mode}
      </Typography>
      {renderFormContent()}
    </Box>
  );

  function renderFormContent() {
    return (
      <>

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            ✅ Permohonan izin telah dikirim dan disimpan!
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}


        {/* Search Section */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            🔍 Cari Pengguna
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              fullWidth
              label="Masukkan NIY/NISN/Nama/Email/No WA"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Contoh: Ahmad Santoso, G001, ahmad@email.com, 08123456789 (tidak case-sensitive)"
            />
            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={loading}
              startIcon={<SearchIcon />}
              sx={{ minWidth: 120 }}
            >
              {loading ? 'Mencari...' : 'Cari'}
            </Button>
          </Box>
        </Paper>

        {/* User Identity Portal */}
        {foundUser && (
          <Card sx={{ mb: 3, border: '2px solid #1976d2' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: '#1976d2', fontWeight: 'bold' }}>
                🆔 Portal Identitas
              </Typography>
              <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1, fontFamily: 'monospace' }}>
                <Typography>Assalamualaikum</Typography>
                <Typography>
                  {foundUser.sebagai === 'Guru' ? 'NIY' : 'NISN'} : {foundUser.niy || foundUser.nisn}
                </Typography>
                <Typography>NAMA : {foundUser.nama}</Typography>
                <Typography>STATUS : {foundUser.status}</Typography>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Permission Form */}
        {foundUser && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              📝 Form Perizinan
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Jenis Izin</InputLabel>
                <Select
                  value={jenisIzin}
                  onChange={(e) => setJenisIzin(e.target.value)}
                  label="Jenis Izin"
                >
                  <MenuItem value="Sakit">Sakit</MenuItem>
                  <MenuItem value="Izin">Izin</MenuItem>
                  <MenuItem value="Dinas Luar">Dinas Luar</MenuItem>
                  <MenuItem value="Cuti">Cuti</MenuItem>
                </Select>
              </FormControl>

              {/* Date range inputs for all izin types */}
              {jenisIzin && (
                <Grid container spacing={2}>
                  <Grid xs={6}>
                    <TextField
                      label="Tanggal Mulai"
                      type="date"
                      value={tanggalMulai}
                      onChange={(e) => setTanggalMulai(e.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      helperText="Tanggal mulai izin/sakit/cuti"
                    />
                  </Grid>
                  <Grid xs={6}>
                    <TextField
                      label="Tanggal Selesai"
                      type="date"
                      value={tanggalSelesai}
                      onChange={(e) => setTanggalSelesai(e.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      helperText="Tanggal selesai izin/sakit/cuti"
                    />
                  </Grid>
                </Grid>
              )}

              <TextField
                fullWidth
                multiline
                rows={4}
                label="Keterangan"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Jelaskan alasan perizinan dengan detail..."
              />

              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit}
                disabled={loading || !jenisIzin || !keterangan.trim()}
                size="large"
                sx={{ mt: 2 }}
              >
                {loading ? 'Mengirim...' : 'Kirim Permohonan Izin'}
              </Button>
            </Box>
          </Paper>
        )}

      </>
    );
  }
};

export default IzinForm;