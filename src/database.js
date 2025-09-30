import Dexie from 'dexie';

export const db = new Dexie('AbsenBarcodeDB');

// Simplified database - only siswa data
// Complete database with guru and siswa data
db.version(12).stores({
  guru: '++id, nama, niy, jabatan, sebagai, email, wa, status',
  siswa: '++id, nama, nisn, jabatan, sebagai, email, wa, status',
  attendance: '++id, [identifier+tanggal], tanggal, identifier, nama, jabatan, jam, status, keterangan, sebagai, wa, email, att',
  penggajian: '++id, nama, jabatan, gaji, bulan',
  guru_inactive: '++id, nama, niy, jabatan, sebagai, email, wa, status, tanggal_keluar, alasan',
  siswa_inactive: '++id, nama, nisn, jabatan, sebagai, email, wa, status, tanggal_keluar, alasan',
  attendance_settings: '++id, type, start_time, end_time, att, label, group_name',
  perizinan: '++id, [identifier+tanggal], [identifier+tanggal_mulai], tanggal, tanggal_mulai, tanggal_selesai, identifier, nama, status, jenis_izin, keterangan, sebagai',
  school_settings: '++id, nama_sekolah, npsn, alamat_desa, alamat_kecamatan, alamat_kabupaten, alamat_provinsi, alamat_negara, nama_kepala_sekolah, niy_kepala_sekolah',
  reminder_settings: '++id, enabled, reminder_time, test_mode, last_reminder_date'
}).upgrade(tx => {
  // Migrate existing data to add status
  tx.table('guru').toCollection().modify(guru => {
    if (!guru.status) guru.status = 'active';
  });
  tx.table('siswa').toCollection().modify(siswa => {
    if (!siswa.status) siswa.status = 'active';
  });
});

// Populate with sample data - ensure data exists
db.open().then(() => {
  // Always check and add sample data if tables are empty
  const addSampleData = async () => {
    const guruCount = await db.guru.count();
    const siswaCount = await db.siswa.count();
    const attendanceCount = await db.attendance.count();
    const penggajianCount = await db.penggajian.count();
    const schoolSettingsCount = await db.school_settings.count();

    const promises = [];

    if (guruCount === 0) {
      const sampleGuru = [
        { nama: 'Ahmad Santoso', niy: 'G001', jabatan: 'Guru Matematika', sebagai: 'Guru', email: 'ahmad@school.com', wa: '08123456789', status: 'active' },
        { nama: 'Siti Aminah', niy: 'G002', jabatan: 'Guru Bahasa Indonesia', sebagai: 'Guru', email: 'siti@school.com', wa: '08198765432', status: 'active' },
        { nama: 'Budi Setiawan', niy: 'G003', jabatan: 'Guru IPA', sebagai: 'Guru', email: 'budi@school.com', wa: '08134567890', status: 'active' }
      ];
      promises.push(db.guru.bulkAdd(sampleGuru));
    }

    if (siswaCount === 0) {
      const sampleSiswa = [
        { nama: 'Rina Sari', nisn: 'S001', jabatan: 'Kelas 10A', sebagai: 'Siswa', email: 'rina@school.com', wa: '08111111111', status: 'active' },
        { nama: 'Dedi Kurniawan', nisn: 'S002', jabatan: 'Kelas 10A', sebagai: 'Siswa', email: 'dedi@school.com', wa: '08122222222', status: 'active' },
        { nama: 'Maya Putri', nisn: 'S003', jabatan: 'Kelas 10B', sebagai: 'Siswa', email: 'maya@school.com', wa: '08133333333', status: 'active' },
        { nama: 'Andi Rahman', nisn: 'S004', jabatan: 'Kelas 10B', sebagai: 'Siswa', email: 'andi@school.com', wa: '08144444444', status: 'active' },
        { nama: 'Sari Dewi', nisn: 'S005', jabatan: 'Kelas 11A', sebagai: 'Siswa', email: 'sari@school.com', wa: '08155555555', status: 'active' }
      ];
      promises.push(db.siswa.bulkAdd(sampleSiswa));
    }

    if (attendanceCount === 0) {
      const sampleAttendance = [
        // January 15, 2024 - Full attendance day
        { tanggal: '2024-01-15', identifier: 'S001', nama: 'Rina Sari', jabatan: 'Kelas 10A', jam: '07:30', status: 'datang', keterangan: '', sebagai: 'Siswa', wa: '08111111111', email: 'rina@school.com' },
        { tanggal: '2024-01-15', identifier: 'S002', nama: 'Dedi Kurniawan', jabatan: 'Kelas 10A', jam: '07:35', status: 'datang', keterangan: '', sebagai: 'Siswa', wa: '08122222222', email: 'dedi@school.com' },
        { tanggal: '2024-01-15', identifier: 'S003', nama: 'Maya Putri', jabatan: 'Kelas 10B', jam: '07:40', status: 'datang', keterangan: '', sebagai: 'Siswa', wa: '08133333333', email: 'maya@school.com' },
        { tanggal: '2024-01-15', identifier: 'S004', nama: 'Andi Rahman', jabatan: 'Kelas 10B', jam: '07:45', status: 'datang', keterangan: '', sebagai: 'Siswa', wa: '08144444444', email: 'andi@school.com' },
        { tanggal: '2024-01-15', identifier: 'S005', nama: 'Sari Dewi', jabatan: 'Kelas 11A', jam: '07:50', status: 'datang', keterangan: '', sebagai: 'Siswa', wa: '08155555555', email: 'sari@school.com' },
        { tanggal: '2024-01-15', identifier: 'G001', nama: 'Ahmad Santoso', jabatan: 'Guru Matematika', jam: '07:00', status: 'datang', keterangan: '', sebagai: 'Guru', wa: '08123456789', email: 'ahmad@school.com' },
        { tanggal: '2024-01-15', identifier: 'G002', nama: 'Siti Aminah', jabatan: 'Guru Bahasa Indonesia', jam: '07:05', status: 'datang', keterangan: '', sebagai: 'Guru', wa: '08198765432', email: 'siti@school.com' },
        { tanggal: '2024-01-15', identifier: 'G003', nama: 'Budi Setiawan', jabatan: 'Guru IPA', jam: '07:10', status: 'datang', keterangan: '', sebagai: 'Guru', wa: '08134567890', email: 'budi@school.com' },

        // January 16, 2024 - Mixed attendance (some izin, sakit)
        { tanggal: '2024-01-16', identifier: 'S001', nama: 'Rina Sari', jabatan: 'Kelas 10A', jam: '07:30', status: 'datang', keterangan: '', sebagai: 'Siswa', wa: '08111111111', email: 'rina@school.com' },
        { tanggal: '2024-01-16', identifier: 'S002', nama: 'Dedi Kurniawan', jabatan: 'Kelas 10A', jam: '07:35', status: 'Izin', keterangan: 'Sakit', sebagai: 'Siswa', wa: '08122222222', email: 'dedi@school.com' },
        { tanggal: '2024-01-16', identifier: 'S003', nama: 'Maya Putri', jabatan: 'Kelas 10B', jam: '07:40', status: 'datang', keterangan: '', sebagai: 'Siswa', wa: '08133333333', email: 'maya@school.com' },
        { tanggal: '2024-01-16', identifier: 'S004', nama: 'Andi Rahman', jabatan: 'Kelas 10B', jam: '07:45', status: 'Sakit', keterangan: 'Demam', sebagai: 'Siswa', wa: '08144444444', email: 'andi@school.com' },
        { tanggal: '2024-01-16', identifier: 'S005', nama: 'Sari Dewi', jabatan: 'Kelas 11A', jam: '07:50', status: 'datang', keterangan: '', sebagai: 'Siswa', wa: '08155555555', email: 'sari@school.com' },
        { tanggal: '2024-01-16', identifier: 'G001', nama: 'Ahmad Santoso', jabatan: 'Guru Matematika', jam: '07:00', status: 'datang', keterangan: '', sebagai: 'Guru', wa: '08123456789', email: 'ahmad@school.com' },
        { tanggal: '2024-01-16', identifier: 'G002', nama: 'Siti Aminah', jabatan: 'Guru Bahasa Indonesia', jam: '07:05', status: 'datang', keterangan: '', sebagai: 'Guru', wa: '08198765432', email: 'siti@school.com' },
        { tanggal: '2024-01-16', identifier: 'G003', nama: 'Budi Setiawan', jabatan: 'Guru IPA', jam: '07:10', status: 'Izin', keterangan: 'Kegiatan dinas', sebagai: 'Guru', wa: '08134567890', email: 'budi@school.com' },

        // January 17, 2024 - More mixed attendance
        { tanggal: '2024-01-17', identifier: 'S001', nama: 'Rina Sari', jabatan: 'Kelas 10A', jam: '07:30', status: 'datang', keterangan: '', sebagai: 'Siswa', wa: '08111111111', email: 'rina@school.com' },
        { tanggal: '2024-01-17', identifier: 'S002', nama: 'Dedi Kurniawan', jabatan: 'Kelas 10A', jam: '07:35', status: 'datang', keterangan: '', sebagai: 'Siswa', wa: '08122222222', email: 'dedi@school.com' },
        { tanggal: '2024-01-17', identifier: 'S003', nama: 'Maya Putri', jabatan: 'Kelas 10B', jam: '07:40', status: 'Sakit', keterangan: 'Flu', sebagai: 'Siswa', wa: '08133333333', email: 'maya@school.com' },
        { tanggal: '2024-01-17', identifier: 'S004', nama: 'Andi Rahman', jabatan: 'Kelas 10B', jam: '07:45', status: 'datang', keterangan: '', sebagai: 'Siswa', wa: '08144444444', email: 'andi@school.com' },
        { tanggal: '2024-01-17', identifier: 'S005', nama: 'Sari Dewi', jabatan: 'Kelas 11A', jam: '07:50', status: 'datang', keterangan: '', sebagai: 'Siswa', wa: '08155555555', email: 'sari@school.com' },
        { tanggal: '2024-01-17', identifier: 'G001', nama: 'Ahmad Santoso', jabatan: 'Guru Matematika', jam: '07:00', status: 'datang', keterangan: '', sebagai: 'Guru', wa: '08123456789', email: 'ahmad@school.com' },
        { tanggal: '2024-01-17', identifier: 'G002', nama: 'Siti Aminah', jabatan: 'Guru Bahasa Indonesia', jam: '07:05', status: 'Sakit', keterangan: 'Migraine', sebagai: 'Guru', wa: '08198765432', email: 'siti@school.com' },
        { tanggal: '2024-01-17', identifier: 'G003', nama: 'Budi Setiawan', jabatan: 'Guru IPA', jam: '07:10', status: 'datang', keterangan: '', sebagai: 'Guru', wa: '08134567890', email: 'budi@school.com' }
      ];
      promises.push(db.attendance.bulkAdd(sampleAttendance));
    }

    if (penggajianCount === 0) {
      const samplePenggajian = [
        { nama: 'Ahmad Santoso', jabatan: 'Guru Matematika', gaji: 3500000, bulan: 'Januari 2024' },
        { nama: 'Siti Aminah', jabatan: 'Guru Bahasa Indonesia', gaji: 3200000, bulan: 'Januari 2024' }
      ];
      promises.push(db.penggajian.bulkAdd(samplePenggajian));
    }

    // Add default attendance settings
    const settingsCount = await db.attendance_settings.count();
    if (settingsCount === 0) {
      const defaultSettings = [
        // Guru settings
        { type: 'guru', start_time: '06:00', end_time: '07:30', att: 'Datang', label: 'Tepat Waktu' },
        { type: 'guru', start_time: '07:30', end_time: '08:00', att: 'Datang', label: 'Tahap 1' },
        { type: 'guru', start_time: '08:00', end_time: '15:00', att: 'Datang', label: 'Tahap 2' },
        { type: 'guru', start_time: '15:00', end_time: '17:00', att: 'Pulang', label: 'Pulang' },

        // Siswa settings
        { type: 'siswa', start_time: '06:00', end_time: '07:30', att: 'Datang', label: 'Tepat Waktu' },
        { type: 'siswa', start_time: '07:30', end_time: '08:00', att: 'Datang', label: 'Tahap 1' },
        { type: 'siswa', start_time: '08:00', end_time: '12:00', att: 'Datang', label: 'Tahap 2' },
        { type: 'siswa', start_time: '12:00', end_time: '17:00', att: 'Pulang', label: 'Pulang' }
      ];
      promises.push(db.attendance_settings.bulkAdd(defaultSettings));
    }

    if (schoolSettingsCount === 0) {
      const defaultSchoolSettings = {
        nama_sekolah: 'SMA Negeri 1 Makassar',
        npsn: '40300123',
        alamat_desa: 'Bontoala',
        alamat_kecamatan: 'Bontoala',
        alamat_kabupaten: 'Kota Makassar',
        alamat_provinsi: 'Sulawesi Selatan',
        alamat_negara: 'Indonesia',
        nama_kepala_sekolah: 'Dr. H. Ahmad Yani, M.Pd.',
        niy_kepala_sekolah: '197001011990011001'
      };
      promises.push(db.school_settings.add(defaultSchoolSettings));
    }

    return Promise.all(promises);
  };

  return addSampleData();
}).catch(err => {
  console.error('Database initialization error:', err);
});

export default db;