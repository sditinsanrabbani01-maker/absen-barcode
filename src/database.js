import Dexie from 'dexie';

// Initialize IndexedDB database with Dexie
export const db = new Dexie('AbsenBarcodeDB');

db.version(1).stores({
  guru: '++id, nama, niy, jabatan, sebagai, email, wa, status, pendidikan, mk_start_year, mk_start_month, gaji_pokok, tunjangan_kinerja, tunjangan_umum, tunjangan_istri, tunjangan_anak, tunjangan_kepala_sekolah, tunjangan_wali_kelas, honor_bendahara, keterangan, custom_base_salary, created_at, updated_at',
  siswa: '++id, nama, nisn, jabatan, sebagai, email, wa, status, created_at, updated_at',
  attendance: '++id, tanggal, identifier, nama, jabatan, jam, status, keterangan, att, sebagai, wa, email, created_at, updated_at',
  perizinan: '++id, tanggal, tanggal_mulai, tanggal_selesai, identifier, nama, status, jenis_izin, keterangan, sebagai, created_at, updated_at',
  penggajian: '++id, identifier, nama, jabatan, sebagai, bulan, tahun, gaji_pokok, tunjangan_kinerja, tunjangan_umum, tunjangan_istri, tunjangan_anak, tunjangan_kepala_sekolah, tunjangan_wali_kelas, honor_bendahara, potongan, total_gaji, status_bayar, created_at, updated_at',
  attendance_settings: '++id, type, start_time, end_time, att, label, group_name, created_at, updated_at',
  school_settings: '++id, nama_sekolah, npsn, alamat_desa, alamat_kecamatan, alamat_kabupaten, alamat_provinsi, alamat_negara, nama_kepala_sekolah, niy_kepala_sekolah, created_at, updated_at',
  reminder_settings: '++id, enabled, reminder_time, test_mode, last_reminder_date, created_at, updated_at',
  guru_inactive: '++id, nama, niy, jabatan, sebagai, email, wa, tanggal_keluar, alasan, created_at, updated_at',
  siswa_inactive: '++id, nama, nisn, jabatan, sebagai, email, wa, tanggal_keluar, alasan, created_at, updated_at'
});

// Initialize sample data if database is empty
const initializeSampleData = async () => {
  try {
    console.log('🔄 Initializing sample data in IndexedDB...');

    // Check if we have any data
    const guruCount = await db.guru.count();
    const siswaCount = await db.siswa.count();
    const settingsCount = await db.attendance_settings.count();

    console.log('📊 Current database counts:', { guruCount, siswaCount, settingsCount });

    const promises = [];

    // Add sample guru if empty
    if (guruCount === 0) {
      const sampleGuru = [
        { nama: 'Ahmad Santoso', niy: 'G001', jabatan: 'Guru Matematika', sebagai: 'Guru', email: 'ahmad@school.com', wa: '08123456789', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { nama: 'Siti Aminah', niy: 'G002', jabatan: 'Guru Bahasa Indonesia', sebagai: 'Guru', email: 'siti@school.com', wa: '08198765432', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { nama: 'Budi Setiawan', niy: 'G003', jabatan: 'Guru IPA', sebagai: 'Guru', email: 'budi@school.com', wa: '08134567890', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ];
      promises.push(db.guru.bulkAdd(sampleGuru));
    }

    // Add sample siswa if empty
    if (siswaCount === 0) {
      const sampleSiswa = [
        { nama: 'Rina Sari', nisn: 'S001', jabatan: 'Kelas 10A', sebagai: 'Siswa', email: 'rina@school.com', wa: '08111111111', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { nama: 'Dedi Kurniawan', nisn: 'S002', jabatan: 'Kelas 10A', sebagai: 'Siswa', email: 'dedi@school.com', wa: '08122222222', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { nama: 'Maya Putri', nisn: 'S003', jabatan: 'Kelas 10B', sebagai: 'Siswa', email: 'maya@school.com', wa: '08133333333', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { nama: 'Andi Rahman', nisn: 'S004', jabatan: 'Kelas 10B', sebagai: 'Siswa', email: 'andi@school.com', wa: '08144444444', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { nama: 'Sari Dewi', nisn: 'S005', jabatan: 'Kelas 11A', sebagai: 'Siswa', email: 'sari@school.com', wa: '08155555555', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ];
      promises.push(db.siswa.bulkAdd(sampleSiswa));
    }

    // Add default attendance settings if empty
    if (settingsCount === 0) {
      const defaultSettings = [
        { type: 'guru', start_time: '06:00', end_time: '07:30', att: 'Datang', label: 'Tepat Waktu', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { type: 'guru', start_time: '07:30', end_time: '08:00', att: 'Datang', label: 'Tahap 1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { type: 'guru', start_time: '08:00', end_time: '15:00', att: 'Datang', label: 'Tahap 2', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { type: 'guru', start_time: '15:00', end_time: '17:00', att: 'Pulang', label: 'Pulang', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { type: 'siswa', start_time: '06:00', end_time: '07:30', att: 'Datang', label: 'Tepat Waktu', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { type: 'siswa', start_time: '07:30', end_time: '08:00', att: 'Datang', label: 'Tahap 1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { type: 'siswa', start_time: '08:00', end_time: '12:00', att: 'Datang', label: 'Tahap 2', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { type: 'siswa', start_time: '12:00', end_time: '17:00', att: 'Pulang', label: 'Pulang', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ];
      promises.push(db.attendance_settings.bulkAdd(defaultSettings));
    }

    // Add default school settings if empty
    const schoolSettingsCount = await db.school_settings.count();
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
        niy_kepala_sekolah: '197001011990011001',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      promises.push(db.school_settings.add(defaultSchoolSettings));
    }

    await Promise.all(promises);
    console.log('✅ Sample data initialized in IndexedDB');

  } catch (error) {
    console.error('❌ Error initializing sample data:', error);
  }
};

// Initialize sample data when module loads
db.open().then(() => {
  console.log('📱 IndexedDB database opened successfully');
  initializeSampleData();
}).catch(error => {
  console.error('❌ Error opening IndexedDB:', error);
});

export default db;