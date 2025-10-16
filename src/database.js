import Dexie from 'dexie';

// Initialize IndexedDB database with Dexie
export const db = new Dexie('AbsenBarcodeDB');

db.version(1).stores({
  users: '++id, username, password, role, nama, email, wa, status, last_login, created_at, updated_at',
  guru: '++id, nama, niy, jabatan, sebagai, email, wa, status, pendidikan, mk_start_year, mk_start_month, gaji_pokok, tunjangan_kinerja, tunjangan_umum, tunjangan_istri, tunjangan_anak, tunjangan_kepala_sekolah, tunjangan_wali_kelas, honor_bendahara, keterangan, custom_base_salary, created_at, updated_at',
  siswa: '++id, nama, nisn, jabatan, sebagai, email, wa, status, created_at, updated_at',
  attendance: '++id, [identifier+tanggal+jam], tanggal, identifier, nama, jabatan, jam, status, keterangan, att, sebagai, wa, email, created_at, updated_at',
  perizinan: '++id, [identifier+tanggal], tanggal, tanggal_mulai, tanggal_selesai, identifier, nama, status, jenis_izin, keterangan, sebagai, created_at, updated_at',
  penggajian: '++id, identifier, nama, jabatan, sebagai, bulan, tahun, gaji_pokok, tunjangan_kinerja, tunjangan_umum, tunjangan_istri, tunjangan_anak, tunjangan_kepala_sekolah, tunjangan_wali_kelas, honor_bendahara, potongan, total_gaji, status_bayar, created_at, updated_at',
  attendance_settings: '++id, type, start_time, end_time, att, label, group_name, created_at, updated_at',
  school_settings: '++id, nama_sekolah, npsn, alamat_desa, alamat_kecamatan, alamat_kabupaten, alamat_provinsi, alamat_negara, nama_kepala_sekolah, niy_kepala_sekolah, created_at, updated_at',
  reminder_settings: '++id, enabled, reminder_time, test_mode, last_reminder_date, created_at, updated_at',
  guru_inactive: '++id, nama, niy, jabatan, sebagai, email, wa, tanggal_keluar, alasan, created_at, updated_at',
  siswa_inactive: '++id, nama, nisn, jabatan, sebagai, email, wa, tanggal_keluar, alasan, created_at, updated_at'
});

// ============================================================================
// NEW: Clean database initialization - NO DEFAULT DATA
// ============================================================================
const initializeCleanDatabase = async () => {
  try {
    console.log('🚀 Initializing clean database (no default data)...');

    // Only check if database is accessible, don't add any default data
    const guruCount = await db.guru.count();
    const siswaCount = await db.siswa.count();
    const usersCount = await db.users.count();
    const settingsCount = await db.attendance_settings.count();
    const schoolSettingsCount = await db.school_settings.count();

    console.log('📊 Clean database initialized:', {
      guruCount,
      siswaCount,
      usersCount,
      settingsCount,
      schoolSettingsCount
    });

    console.log('✅ Clean database ready - No default data added');

  } catch (error) {
    console.error('❌ Error initializing clean database:', error);
  }
};

// ============================================================================
// NEW: Clean database initialization - NO DEFAULT DATA
// ============================================================================
db.open().then(() => {
  console.log('📱 IndexedDB database opened successfully');
  initializeCleanDatabase();
}).catch(error => {
  console.error('❌ Error opening IndexedDB:', error);
});

// ============================================================================
// NEW: Database Management Functions
// ============================================================================

/**
 * Clear all data from the database
 * @returns {Promise} Promise that resolves when all data is cleared
 */
export const clearAllData = async () => {
  try {
    console.log('🗑️ Clearing all database data...');

    // Clear all tables
    await Promise.all([
      db.guru.clear(),
      db.siswa.clear(),
      db.attendance.clear(),
      db.perizinan.clear(),
      db.penggajian.clear(),
      db.guru_inactive.clear(),
      db.siswa_inactive.clear(),
      db.attendance_settings.clear(),
      db.school_settings.clear(),
      db.reminder_settings.clear(),
      db.users.clear()
    ]);

    console.log('✅ All database data cleared successfully');
    return true;
  } catch (error) {
    console.error('❌ Error clearing database data:', error);
    throw error;
  }
};

/**
 * Reset database to clean state (clear data and reinitialize)
 * @returns {Promise} Promise that resolves when reset is complete
 */
export const resetDatabase = async () => {
  try {
    await clearAllData();
    await initializeCleanDatabase();
    console.log('✅ Database reset to clean state');
    return true;
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    throw error;
  }
};

/**
 * Clear localStorage data related to the application
 */
export const clearLocalStorage = () => {
  try {
    console.log('🗑️ Clearing localStorage data...');

    // Clear sync-related localStorage
    const keysToRemove = [
      'sync_offline_queue',
      'sync_history',
      'last_sync_time',
      'last_supabase_sync',
      'supabase_data_available',
      'deductionSettings',
      'mkSettings'
    ];

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });

    console.log('✅ localStorage cleared successfully');
    return true;
  } catch (error) {
    console.error('❌ Error clearing localStorage:', error);
    throw error;
  }
};

/**
 * Complete application reset (database + localStorage)
 */
export const resetApplication = async () => {
  try {
    console.log('🔄 Performing complete application reset...');

    await clearAllData();
    clearLocalStorage();

    console.log('✅ Application completely reset to clean state');
    return true;
  } catch (error) {
    console.error('❌ Error during application reset:', error);
    throw error;
  }
};

export default db;