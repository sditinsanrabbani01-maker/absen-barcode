import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Database table names (consistent with Dexie schema)
export const TABLES = {
  GURU: 'guru',
  SISWA: 'siswa',
  ATTENDANCE: 'attendance',
  PENGAJIAN: 'penggajian',
  GURU_INACTIVE: 'guru_inactive',
  SISWA_INACTIVE: 'siswa_inactive',
  ATTENDANCE_SETTINGS: 'attendance_settings',
  MK_SETTINGS: 'mk_settings',
  PERIZINAN: 'perizinan',
  SCHOOL_SETTINGS: 'school_settings',
  REMINDER_SETTINGS: 'reminder_settings'
}

// Data migration utilities
export class DataMigrationService {
  // Migrate local Dexie data to Supabase
  static async migrateFromDexie() {
    console.log('🔄 Starting data migration from Dexie to Supabase...');

    try {
      // Import Dexie database for migration
      const { db: dexieDb } = await import('../database.js');

      // Migrate each table
      const results = {
        guru: await this.migrateGuru(dexieDb),
        siswa: await this.migrateSiswa(dexieDb),
        attendance: await this.migrateAttendance(dexieDb),
        perizinan: await this.migratePerizinan(dexieDb),
        attendance_settings: await this.migrateAttendanceSettings(dexieDb),
        school_settings: await this.migrateSchoolSettings(dexieDb),
        reminder_settings: await this.migrateReminderSettings(dexieDb)
      };

      console.log('✅ Migration completed:', results);
      return results;

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  static async migrateGuru(dexieDb) {
    try {
      const localGuru = await dexieDb.guru.toArray();
      console.log(`📚 Migrating ${localGuru.length} guru records...`);

      if (localGuru.length === 0) return { migrated: 0, skipped: 0 };

      let migrated = 0;
      let skipped = 0;

      for (const guru of localGuru) {
        try {
          // Check if already exists in Supabase
          const { data: existing } = await supabase
            .from(TABLES.GURU)
            .select('id')
            .eq('niy', guru.niy)
            .single();

          if (existing) {
            skipped++;
            continue;
          }

          // Insert to Supabase
          await supabase.from(TABLES.GURU).insert({
            nama: guru.nama,
            niy: guru.niy,
            jabatan: guru.jabatan,
            sebagai: guru.sebagai,
            email: guru.email,
            wa: guru.wa,
            status: guru.status || 'active',
            pendidikan: guru.pendidikan,
            mk_start_year: guru.mk_start_year,
            mk_start_month: guru.mk_start_month,
            gaji_pokok: guru.gaji_pokok,
            tunjangan_kinerja: guru.tunjangan_kinerja,
            tunjangan_umum: guru.tunjangan_umum,
            tunjangan_istri: guru.tunjangan_istri,
            tunjangan_anak: guru.tunjangan_anak,
            tunjangan_kepala_sekolah: guru.tunjangan_kepala_sekolah,
            tunjangan_wali_kelas: guru.tunjangan_wali_kelas,
            honor_bendahara: guru.honor_bendahara,
            keterangan: guru.keterangan,
            custom_base_salary: guru.custom_base_salary
          });
          migrated++;
        } catch (error) {
          console.error(`Error migrating guru ${guru.nama}:`, error);
          skipped++;
        }
      }

      return { migrated, skipped };
    } catch (error) {
      console.error('Error in migrateGuru:', error);
      return { migrated: 0, skipped: 0, error: error.message };
    }
  }

  static async migrateSiswa(dexieDb) {
    try {
      const localSiswa = await dexieDb.siswa.toArray();
      console.log(`📚 Migrating ${localSiswa.length} siswa records...`);

      if (localSiswa.length === 0) return { migrated: 0, skipped: 0 };

      let migrated = 0;
      let skipped = 0;

      for (const siswa of localSiswa) {
        try {
          // Check if already exists
          const { data: existing } = await supabase
            .from(TABLES.SISWA)
            .select('id')
            .eq('nisn', siswa.nisn)
            .single();

          if (existing) {
            skipped++;
            continue;
          }

          await supabase.from(TABLES.SISWA).insert({
            nama: siswa.nama,
            nisn: siswa.nisn,
            jabatan: siswa.jabatan,
            sebagai: siswa.sebagai,
            email: siswa.email,
            wa: siswa.wa,
            status: siswa.status || 'active'
          });
          migrated++;
        } catch (error) {
          console.error(`Error migrating siswa ${siswa.nama}:`, error);
          skipped++;
        }
      }

      return { migrated, skipped };
    } catch (error) {
      console.error('Error in migrateSiswa:', error);
      return { migrated: 0, skipped: 0, error: error.message };
    }
  }

  static async migrateAttendance(dexieDb) {
    try {
      const localAttendance = await dexieDb.attendance.toArray();
      console.log(`📚 Migrating ${localAttendance.length} attendance records...`);

      if (localAttendance.length === 0) return { migrated: 0, skipped: 0 };

      // Migrate in batches for better performance
      const batchSize = 50;
      let migrated = 0;
      let skipped = 0;

      for (let i = 0; i < localAttendance.length; i += batchSize) {
        const batch = localAttendance.slice(i, i + batchSize);

        try {
          const attendanceData = batch.map(att => ({
            tanggal: att.tanggal,
            identifier: att.identifier,
            nama: att.nama,
            jabatan: att.jabatan,
            jam: att.jam,
            status: att.status,
            keterangan: att.keterangan,
            sebagai: att.sebagai,
            wa: att.wa,
            email: att.email,
            att: att.att
          }));

          const { error } = await supabase
            .from(TABLES.ATTENDANCE)
            .insert(attendanceData);

          if (error) {
            console.error('Error in attendance batch:', error);
            skipped += batch.length;
          } else {
            migrated += batch.length;
          }
        } catch (error) {
          console.error('Error processing attendance batch:', error);
          skipped += batch.length;
        }
      }

      return { migrated, skipped };
    } catch (error) {
      console.error('Error in migrateAttendance:', error);
      return { migrated: 0, skipped: 0, error: error.message };
    }
  }

  static async migratePerizinan(dexieDb) {
    try {
      const localPerizinan = await dexieDb.perizinan.toArray();
      console.log(`📚 Migrating ${localPerizinan.length} perizinan records...`);

      if (localPerizinan.length === 0) return { migrated: 0, skipped: 0 };

      let migrated = 0;
      let skipped = 0;

      for (const izin of localPerizinan) {
        try {
          await supabase.from(TABLES.PERIZINAN).insert({
            tanggal: izin.tanggal,
            tanggal_mulai: izin.tanggal_mulai,
            tanggal_selesai: izin.tanggal_selesai,
            identifier: izin.identifier,
            nama: izin.nama,
            status: izin.status || 'Disetujui',
            jenis_izin: izin.jenis_izin,
            keterangan: izin.keterangan,
            sebagai: izin.sebagai
          });
          migrated++;
        } catch (error) {
          console.error(`Error migrating perizinan ${izin.nama}:`, error);
          skipped++;
        }
      }

      return { migrated, skipped };
    } catch (error) {
      console.error('Error in migratePerizinan:', error);
      return { migrated: 0, skipped: 0, error: error.message };
    }
  }

  static async migrateAttendanceSettings(dexieDb) {
    try {
      const localSettings = await dexieDb.attendance_settings.toArray();
      console.log(`📚 Migrating ${localSettings.length} attendance_settings records...`);

      if (localSettings.length === 0) return { migrated: 0, skipped: 0 };

      let migrated = 0;
      let skipped = 0;

      for (const setting of localSettings) {
        try {
          await supabase.from(TABLES.ATTENDANCE_SETTINGS).insert({
            type: setting.type,
            start_time: setting.start_time,
            end_time: setting.end_time,
            att: setting.att,
            label: setting.label,
            group_name: setting.group_name
          });
          migrated++;
        } catch (error) {
          console.error(`Error migrating setting ${setting.label}:`, error);
          skipped++;
        }
      }

      return { migrated, skipped };
    } catch (error) {
      console.error('Error in migrateAttendanceSettings:', error);
      return { migrated: 0, skipped: 0, error: error.message };
    }
  }

  static async migrateSchoolSettings(dexieDb) {
    try {
      const { data: existing } = await supabase
        .from(TABLES.SCHOOL_SETTINGS)
        .select('id')
        .limit(1);

      if (existing && existing.length > 0) {
        return { migrated: 0, skipped: 1 }; // Already exists
      }

      // Get local school settings
      const localSettings = await dexieDb.school_settings.toCollection().first();

      if (!localSettings) return { migrated: 0, skipped: 0 };

      await supabase.from(TABLES.SCHOOL_SETTINGS).insert({
        nama_sekolah: localSettings.nama_sekolah,
        npsn: localSettings.npsn,
        alamat_desa: localSettings.alamat_desa,
        alamat_kecamatan: localSettings.alamat_kecamatan,
        alamat_kabupaten: localSettings.alamat_kabupaten,
        alamat_provinsi: localSettings.alamat_provinsi,
        alamat_negara: localSettings.alamat_negara,
        nama_kepala_sekolah: localSettings.nama_kepala_sekolah,
        niy_kepala_sekolah: localSettings.niy_kepala_sekolah
      });

      return { migrated: 1, skipped: 0 };
    } catch (error) {
      console.error('Error in migrateSchoolSettings:', error);
      return { migrated: 0, skipped: 0, error: error.message };
    }
  }

  static async migrateReminderSettings(dexieDb) {
    try {
      const { data: existing } = await supabase
        .from(TABLES.REMINDER_SETTINGS)
        .select('id')
        .limit(1);

      if (existing && existing.length > 0) {
        return { migrated: 0, skipped: 1 }; // Already exists
      }

      // Get local reminder settings
      const localSettings = await dexieDb.reminder_settings.toCollection().first();

      if (!localSettings) return { migrated: 0, skipped: 0 };

      await supabase.from(TABLES.REMINDER_SETTINGS).insert({
        enabled: localSettings.enabled,
        reminder_time: localSettings.reminder_time,
        test_mode: localSettings.test_mode,
        last_reminder_date: localSettings.last_reminder_date
      });

      return { migrated: 1, skipped: 0 };
    } catch (error) {
      console.error('Error in migrateReminderSettings:', error);
      return { migrated: 0, skipped: 0, error: error.message };
    }
  }
}

// Helper functions for common database operations
export class DatabaseService {
  // Generic CRUD operations
  static async getAll(tableName) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('id', { ascending: true })

    if (error) throw error
    return data
  }

  static async getById(tableName, id) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  static async create(tableName, data) {
    console.log(`📝 Creating record in ${tableName}:`, data)

    const { db } = await import('../database.js');

    // Prepare data with timestamps
    const dataWithTimestamp = {
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      // Always create in local storage first for immediate response
      let localResult;
      if (tableName === TABLES.GURU) {
        localResult = await db.guru.add(dataWithTimestamp);
      } else if (tableName === TABLES.SISWA) {
        localResult = await db.siswa.add(dataWithTimestamp);
      } else if (tableName === TABLES.ATTENDANCE) {
        localResult = await db.attendance.add(data);
      } else if (tableName === TABLES.PERIZINAN) {
        localResult = await db.perizinan.add(data);
      } else if (tableName === TABLES.ATTENDANCE_SETTINGS) {
        localResult = await db.attendance_settings.add(data);
      } else if (tableName === TABLES.PENGAJIAN) {
        localResult = await db.penggajian.add(data);
      }

      console.log(`✅ Record created in local ${tableName}:`, localResult)

      // Note: Real-time sync is handled by WebSocket subscriptions in components
      // The data will be automatically synced when subscriptions detect changes

      // Return local result immediately for responsive UI
      return { id: localResult, ...dataWithTimestamp, synced: false };

    } catch (error) {
      console.error(`❌ Error in create operation for ${tableName}:`, error)
      throw error
    }
  }

  static async update(tableName, id, data) {
    console.log(`📝 Updating record in ${tableName} (ID: ${id}):`, data)

    const { db } = await import('../database.js');

    // Prepare data with updated timestamp
    const dataWithTimestamp = {
      ...data,
      updated_at: new Date().toISOString()
    };

    try {
      // Always update in local storage first for immediate response
      let localResult;
      if (tableName === TABLES.GURU) {
        localResult = await db.guru.update(id, dataWithTimestamp);
      } else if (tableName === TABLES.SISWA) {
        localResult = await db.siswa.update(id, dataWithTimestamp);
      } else if (tableName === TABLES.ATTENDANCE) {
        localResult = await db.attendance.update(id, data);
      } else if (tableName === TABLES.PERIZINAN) {
        localResult = await db.perizinan.update(id, data);
      } else if (tableName === TABLES.ATTENDANCE_SETTINGS) {
        localResult = await db.attendance_settings.update(id, data);
      } else if (tableName === TABLES.PENGAJIAN) {
        localResult = await db.penggajian.update(id, data);
      }

      console.log(`✅ Record updated in local ${tableName}:`, localResult)

      // Note: Real-time sync is handled by WebSocket subscriptions in components
      // The data will be automatically synced when subscriptions detect changes

      // Return local result immediately for responsive UI
      return { id, ...dataWithTimestamp, synced: false };

    } catch (error) {
      console.error(`❌ Error in update operation for ${tableName}:`, error)
      throw error
    }
  }

  static async delete(tableName, id) {
    console.log(`🗑️ Deleting record from ${tableName} (ID: ${id})`)

    const { db } = await import('../database.js');

    try {
      // Always delete from local storage first for immediate response
      if (tableName === TABLES.GURU) {
        await db.guru.delete(id);
      } else if (tableName === TABLES.SISWA) {
        await db.siswa.delete(id);
      } else if (tableName === TABLES.ATTENDANCE) {
        await db.attendance.delete(id);
      } else if (tableName === TABLES.PERIZINAN) {
        await db.perizinan.delete(id);
      } else if (tableName === TABLES.ATTENDANCE_SETTINGS) {
        await db.attendance_settings.delete(id);
      } else if (tableName === TABLES.PENGAJIAN) {
        await db.penggajian.delete(id);
      }

      console.log(`✅ Record deleted from local ${tableName}`)

      // Note: Real-time sync is handled by WebSocket subscriptions in components
      // The data will be automatically synced when subscriptions detect changes

    } catch (error) {
      console.error(`❌ Error in delete operation for ${tableName}:`, error)
      throw error
    }
  }

  static async bulkCreate(tableName, dataArray) {
    console.log(`📤 Inserting ${dataArray.length} records to ${tableName}...`)

    const { db } = await import('../database.js');

    // Prepare data with timestamps
    const dataWithTimestamps = dataArray.map(data => ({
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    try {
      // Always bulk insert to local storage first for immediate response
      let localResults;
      if (tableName === TABLES.GURU) {
        localResults = await db.guru.bulkAdd(dataWithTimestamps);
      } else if (tableName === TABLES.SISWA) {
        localResults = await db.siswa.bulkAdd(dataWithTimestamps);
      } else if (tableName === TABLES.ATTENDANCE) {
        localResults = await db.attendance.bulkAdd(dataArray);
      } else if (tableName === TABLES.PERIZINAN) {
        localResults = await db.perizinan.bulkAdd(dataArray);
      } else if (tableName === TABLES.ATTENDANCE_SETTINGS) {
        localResults = await db.attendance_settings.bulkAdd(dataArray);
      } else if (tableName === TABLES.PENGAJIAN) {
        localResults = await db.penggajian.bulkAdd(dataArray);
      }

      console.log(`✅ Successfully inserted ${dataArray.length} records to local ${tableName}`)

      // Note: Real-time sync is handled by WebSocket subscriptions in components
      // The data will be automatically synced when subscriptions detect changes

      // Return local results immediately for responsive UI
      return dataWithTimestamps;

    } catch (error) {
      console.error(`❌ Error in bulk create operation for ${tableName}:`, error)
      throw error
    }
  }

  // Specific table operations
  static async getGuru(activeOnly = true) {
    console.log('🔍 Getting guru data from Supabase...')
    try {
      let query = supabase.from(TABLES.GURU).select('*')

      if (activeOnly) {
        query = query.eq('status', 'active')
      }

      const { data, error } = await query.order('nama', { ascending: true })
      if (error) {
        console.error('❌ Error getting guru from Supabase:', error)
        console.log('🔄 Error details:', error.message, error.details)
        // Fallback to local data if Supabase fails
        console.log('🔄 Falling back to local data...')
        const { db } = await import('../database.js');
        return await db.guru.toArray();
      }
      console.log('✅ Got guru data from Supabase:', data?.length || 0, 'records')
      console.log('📋 Sample records:', data?.slice(0, 3))
      return data || []
    } catch (err) {
      console.error('❌ Supabase connection failed, using local data:', err)
      // Fallback to local data
      const { db } = await import('../database.js');
      return await db.guru.toArray();
    }
  }

  static async getSiswa(activeOnly = true) {
    let query = supabase.from(TABLES.SISWA).select('*')

    if (activeOnly) {
      query = query.eq('status', 'active')
    }

    const { data, error } = await query.order('nama', { ascending: true })
    if (error) throw error
    return data
  }

  static async getAttendanceByDateRange(startDate, endDate) {
    const { data, error } = await supabase
      .from(TABLES.ATTENDANCE)
      .select('*')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: true })

    if (error) throw error
    return data
  }

  static async getPerizinanByDateRange(startDate, endDate) {
    const { data, error } = await supabase
      .from(TABLES.PERIZINAN)
      .select('*')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: true })

    if (error) throw error
    return data
  }

  static async searchUsers(searchTerm) {
    const { data, error } = await supabase
      .from(TABLES.GURU)
      .select('*')
      .or(`nama.ilike.%${searchTerm}%,niy.ilike.%${searchTerm}%`)
      .eq('status', 'active')
      .limit(10)

    if (error) throw error

    const siswaData = await supabase
      .from(TABLES.SISWA)
      .select('*')
      .or(`nama.ilike.%${searchTerm}%,nisn.ilike.%${searchTerm}%`)
      .eq('status', 'active')
      .limit(10)

    if (siswaData.error) throw siswaData.error

    return [...data, ...siswaData.data]
  }

  // Migration function to sync local data to Supabase
  static async syncLocalToSupabase() {
    console.log('🔄 Starting sync from local to Supabase...');

    try {
      // Import the database module to access local data
      const { db } = await import('../database.js');

      const results = {
        guru: await this.migrateGuruFromLocal(db),
        siswa: await this.migrateSiswaFromLocal(db),
        attendance: await this.migrateAttendanceFromLocal(db),
        perizinan: await this.migratePerizinanFromLocal(db),
        settings: await this.migrateSettingsFromLocal(db)
      };

      console.log('✅ Sync completed:', results);
      return results;

    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw error;
    }
  }

  // Auto-sync from Supabase to local storage on app load
  static async autoSyncFromSupabase() {
    console.log('🔄 Starting auto-sync from Supabase to local storage...');

    try {
      const { db } = await import('../database.js');

      const results = {
        guru: await this.syncGuruFromSupabase(db),
        siswa: await this.syncSiswaFromSupabase(db),
        attendance: await this.syncAttendanceFromSupabase(db),
        perizinan: await this.syncPerizinanFromSupabase(db),
        settings: await this.syncSettingsFromSupabase(db)
      };

      console.log('✅ Auto-sync from Supabase completed:', results);
      return results;

    } catch (error) {
      console.error('❌ Auto-sync from Supabase failed:', error);
      // Don't throw error - app should still work with local data
      return { error: error.message };
    }
  }

  // Sync Guru from Supabase to local
  static async syncGuruFromSupabase(db) {
    try {
      console.log('🔄 Syncing guru from Supabase...');
      const { data: supabaseGuru, error } = await supabase
        .from(TABLES.GURU)
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching guru from Supabase:', error);
        return { synced: 0, error: error.message };
      }

      if (!supabaseGuru || supabaseGuru.length === 0) {
        console.log('ℹ️ No guru data in Supabase');
        return { synced: 0 };
      }

      let synced = 0;
      for (const guru of supabaseGuru) {
        try {
          // Check if exists locally
          const existing = await db.guru.where('niy').equals(guru.niy).first();

          if (!existing) {
            // Add new record
            await db.guru.add({
              nama: guru.nama,
              niy: guru.niy,
              jabatan: guru.jabatan,
              sebagai: guru.sebagai || 'Guru',
              email: guru.email,
              wa: guru.wa,
              status: guru.status || 'active',
              pendidikan: guru.pendidikan,
              mk_start_year: guru.mk_start_year,
              mk_start_month: guru.mk_start_month,
              gaji_pokok: guru.gaji_pokok,
              tunjangan_kinerja: guru.tunjangan_kinerja,
              tunjangan_umum: guru.tunjangan_umum,
              tunjangan_istri: guru.tunjangan_istri,
              tunjangan_anak: guru.tunjangan_anak,
              tunjangan_kepala_sekolah: guru.tunjangan_kepala_sekolah,
              tunjangan_wali_kelas: guru.tunjangan_wali_kelas,
              honor_bendahara: guru.honor_bendahara,
              keterangan: guru.keterangan,
              custom_base_salary: guru.custom_base_salary
            });
            synced++;
          } else if (guru.updated_at && (!existing.updated_at || new Date(guru.updated_at) > new Date(existing.updated_at))) {
            // Update if Supabase data is newer
            await db.guru.update(existing.id, {
              nama: guru.nama,
              jabatan: guru.jabatan,
              sebagai: guru.sebagai || 'Guru',
              email: guru.email,
              wa: guru.wa,
              status: guru.status || 'active',
              pendidikan: guru.pendidikan,
              mk_start_year: guru.mk_start_year,
              mk_start_month: guru.mk_start_month,
              gaji_pokok: guru.gaji_pokok,
              tunjangan_kinerja: guru.tunjangan_kinerja,
              tunjangan_umum: guru.tunjangan_umum,
              tunjangan_istri: guru.tunjangan_istri,
              tunjangan_anak: guru.tunjangan_anak,
              tunjangan_kepala_sekolah: guru.tunjangan_kepala_sekolah,
              tunjangan_wali_kelas: guru.tunjangan_wali_kelas,
              honor_bendahara: guru.honor_bendahara,
              keterangan: guru.keterangan,
              custom_base_salary: guru.custom_base_salary,
              updated_at: guru.updated_at
            });
            synced++;
          }
        } catch (error) {
          console.error(`❌ Error syncing guru ${guru.nama}:`, error);
        }
      }

      console.log(`✅ Synced ${synced} guru records from Supabase`);
      return { synced };
    } catch (error) {
      console.error('❌ Error in syncGuruFromSupabase:', error);
      return { synced: 0, error: error.message };
    }
  }

  // Sync Siswa from Supabase to local
  static async syncSiswaFromSupabase(db) {
    try {
      console.log('🔄 Syncing siswa from Supabase...');
      const { data: supabaseSiswa, error } = await supabase
        .from(TABLES.SISWA)
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching siswa from Supabase:', error);
        return { synced: 0, error: error.message };
      }

      if (!supabaseSiswa || supabaseSiswa.length === 0) {
        console.log('ℹ️ No siswa data in Supabase');
        return { synced: 0 };
      }

      let synced = 0;
      for (const siswa of supabaseSiswa) {
        try {
          // Check if exists locally
          const existing = await db.siswa.where('nisn').equals(siswa.nisn).first();

          if (!existing) {
            // Add new record
            await db.siswa.add({
              nama: siswa.nama,
              nisn: siswa.nisn,
              jabatan: siswa.jabatan,
              sebagai: siswa.sebagai || 'Siswa',
              email: siswa.email,
              wa: siswa.wa,
              status: siswa.status || 'active'
            });
            synced++;
          } else if (siswa.updated_at && (!existing.updated_at || new Date(siswa.updated_at) > new Date(existing.updated_at))) {
            // Update if Supabase data is newer
            await db.siswa.update(existing.id, {
              nama: siswa.nama,
              jabatan: siswa.jabatan,
              sebagai: siswa.sebagai || 'Siswa',
              email: siswa.email,
              wa: siswa.wa,
              status: siswa.status || 'active',
              updated_at: siswa.updated_at
            });
            synced++;
          }
        } catch (error) {
          console.error(`❌ Error syncing siswa ${siswa.nama}:`, error);
        }
      }

      console.log(`✅ Synced ${synced} siswa records from Supabase`);
      return { synced };
    } catch (error) {
      console.error('❌ Error in syncSiswaFromSupabase:', error);
      return { synced: 0, error: error.message };
    }
  }

  // Sync Attendance from Supabase to local
  static async syncAttendanceFromSupabase(db) {
    try {
      console.log('🔄 Syncing attendance from Supabase...');
      const { data: supabaseAttendance, error } = await supabase
        .from(TABLES.ATTENDANCE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000); // Limit to prevent memory issues

      if (error) {
        console.error('❌ Error fetching attendance from Supabase:', error);
        return { synced: 0, error: error.message };
      }

      if (!supabaseAttendance || supabaseAttendance.length === 0) {
        console.log('ℹ️ No attendance data in Supabase');
        return { synced: 0 };
      }

      let synced = 0;
      for (const att of supabaseAttendance) {
        try {
          // Check if exists locally (by identifier, tanggal, jam combination)
          const existing = await db.attendance
            .where('[identifier+tanggal+jam]')
            .equals([att.identifier, att.tanggal, att.jam])
            .first();

          if (!existing) {
            // Add new record
            await db.attendance.add({
              tanggal: att.tanggal,
              identifier: att.identifier,
              nama: att.nama,
              jabatan: att.jabatan,
              jam: att.jam,
              status: att.status,
              keterangan: att.keterangan,
              sebagai: att.sebagai,
              wa: att.wa,
              email: att.email,
              att: att.att
            });
            synced++;
          }
        } catch (error) {
          console.error(`❌ Error syncing attendance record:`, error);
        }
      }

      console.log(`✅ Synced ${synced} attendance records from Supabase`);
      return { synced };
    } catch (error) {
      console.error('❌ Error in syncAttendanceFromSupabase:', error);
      return { synced: 0, error: error.message };
    }
  }

  // Sync Perizinan from Supabase to local
  static async syncPerizinanFromSupabase(db) {
    try {
      console.log('🔄 Syncing perizinan from Supabase...');
      const { data: supabasePerizinan, error } = await supabase
        .from(TABLES.PERIZINAN)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('❌ Error fetching perizinan from Supabase:', error);
        return { synced: 0, error: error.message };
      }

      if (!supabasePerizinan || supabasePerizinan.length === 0) {
        console.log('ℹ️ No perizinan data in Supabase');
        return { synced: 0 };
      }

      let synced = 0;
      for (const izin of supabasePerizinan) {
        try {
          // Check if exists locally (by identifier, tanggal combination)
          const existing = await db.perizinan
            .where('[identifier+tanggal]')
            .equals([izin.identifier, izin.tanggal])
            .first();

          if (!existing) {
            // Add new record
            await db.perizinan.add({
              tanggal: izin.tanggal,
              tanggal_mulai: izin.tanggal_mulai,
              tanggal_selesai: izin.tanggal_selesai,
              identifier: izin.identifier,
              nama: izin.nama,
              status: izin.status || 'Disetujui',
              jenis_izin: izin.jenis_izin,
              keterangan: izin.keterangan,
              sebagai: izin.sebagai
            });
            synced++;
          }
        } catch (error) {
          console.error(`❌ Error syncing perizinan record:`, error);
        }
      }

      console.log(`✅ Synced ${synced} perizinan records from Supabase`);
      return { synced };
    } catch (error) {
      console.error('❌ Error in syncPerizinanFromSupabase:', error);
      return { synced: 0, error: error.message };
    }
  }

  // Sync Settings from Supabase to local
  static async syncSettingsFromSupabase(db) {
    try {
      console.log('🔄 Syncing settings from Supabase...');

      // Sync attendance settings
      const { data: attendanceSettings, error: attError } = await supabase
        .from(TABLES.ATTENDANCE_SETTINGS)
        .select('*');

      if (!attError && attendanceSettings) {
        for (const setting of attendanceSettings) {
          try {
            const existing = await db.attendance_settings
              .where('id')
              .equals(setting.id)
              .first();

            if (!existing) {
              await db.attendance_settings.add(setting);
            }
          } catch (error) {
            console.error('❌ Error syncing attendance setting:', error);
          }
        }
      }

      // Sync school settings
      const { data: schoolSettings, error: schoolError } = await supabase
        .from(TABLES.SCHOOL_SETTINGS)
        .select('*')
        .single();

      if (!schoolError && schoolSettings) {
        try {
          const existing = await db.school_settings.toCollection().first();
          if (!existing) {
            await db.school_settings.add(schoolSettings);
          } else {
            await db.school_settings.update(existing.id, schoolSettings);
          }
        } catch (error) {
          console.error('❌ Error syncing school settings:', error);
        }
      }

      // Sync reminder settings
      const { data: reminderSettings, error: reminderError } = await supabase
        .from(TABLES.REMINDER_SETTINGS)
        .select('*')
        .single();

      if (!reminderError && reminderSettings) {
        try {
          const existing = await db.reminder_settings.toCollection().first();
          if (!existing) {
            await db.reminder_settings.add(reminderSettings);
          } else {
            await db.reminder_settings.update(existing.id, reminderSettings);
          }
        } catch (error) {
          console.error('❌ Error syncing reminder settings:', error);
        }
      }

      console.log('✅ Synced settings from Supabase');
      return { synced: 1 };
    } catch (error) {
      console.error('❌ Error in syncSettingsFromSupabase:', error);
      return { synced: 0, error: error.message };
    }
  }

  static async migrateGuruFromLocal(db) {
    try {
      const localGuru = await db.guru.toArray();
      console.log(`📚 Syncing ${localGuru.length} guru records...`);

      if (localGuru.length === 0) return { synced: 0, skipped: 0 };

      let synced = 0;
      let skipped = 0;

      for (const guru of localGuru) {
        try {
          // Check if already exists
          const { data: existing } = await supabase
            .from(TABLES.GURU)
            .select('id')
            .eq('niy', guru.niy)
            .single();

          if (existing) {
            // Update existing record
            await supabase
              .from(TABLES.GURU)
              .update({
                nama: guru.nama,
                jabatan: guru.jabatan,
                sebagai: guru.sebagai,
                email: guru.email,
                wa: guru.wa,
                status: guru.status || 'active',
                pendidikan: guru.pendidikan,
                mk_start_year: guru.mk_start_year,
                mk_start_month: guru.mk_start_month,
                gaji_pokok: guru.gaji_pokok,
                tunjangan_kinerja: guru.tunjangan_kinerja,
                tunjangan_umum: guru.tunjangan_umum,
                tunjangan_istri: guru.tunjangan_istri,
                tunjangan_anak: guru.tunjangan_anak,
                tunjangan_kepala_sekolah: guru.tunjangan_kepala_sekolah,
                tunjangan_wali_kelas: guru.tunjangan_wali_kelas,
                honor_bendahara: guru.honor_bendahara,
                keterangan: guru.keterangan,
                custom_base_salary: guru.custom_base_salary,
                updated_at: new Date().toISOString()
              })
              .eq('niy', guru.niy);
            synced++;
          } else {
            // Insert new record
            await supabase.from(TABLES.GURU).insert({
              nama: guru.nama,
              niy: guru.niy,
              jabatan: guru.jabatan,
              sebagai: guru.sebagai,
              email: guru.email,
              wa: guru.wa,
              status: guru.status || 'active',
              pendidikan: guru.pendidikan,
              mk_start_year: guru.mk_start_year,
              mk_start_month: guru.mk_start_month,
              gaji_pokok: guru.gaji_pokok,
              tunjangan_kinerja: guru.tunjangan_kinerja,
              tunjangan_umum: guru.tunjangan_umum,
              tunjangan_istri: guru.tunjangan_istri,
              tunjangan_anak: guru.tunjangan_anak,
              tunjangan_kepala_sekolah: guru.tunjangan_kepala_sekolah,
              tunjangan_wali_kelas: guru.tunjangan_wali_kelas,
              honor_bendahara: guru.honor_bendahara,
              keterangan: guru.keterangan,
              custom_base_salary: guru.custom_base_salary
            });
            synced++;
          }
        } catch (error) {
          console.error(`Error syncing guru ${guru.nama}:`, error);
          skipped++;
        }
      }

      return { synced, skipped };
    } catch (error) {
      console.error('Error in migrateGuruFromLocal:', error);
      return { synced: 0, skipped: 0, error: error.message };
    }
  }

  static async migrateSiswaFromLocal(db) {
    try {
      const localSiswa = await db.siswa.toArray();
      console.log(`📚 Syncing ${localSiswa.length} siswa records...`);

      if (localSiswa.length === 0) return { synced: 0, skipped: 0 };

      let synced = 0;
      let skipped = 0;

      for (const siswa of localSiswa) {
        try {
          // Check if already exists
          const { data: existing } = await supabase
            .from(TABLES.SISWA)
            .select('id')
            .eq('nisn', siswa.nisn)
            .single();

          if (existing) {
            // Update existing
            await supabase
              .from(TABLES.SISWA)
              .update({
                nama: siswa.nama,
                jabatan: siswa.jabatan,
                sebagai: siswa.sebagai,
                email: siswa.email,
                wa: siswa.wa,
                status: siswa.status || 'active',
                updated_at: new Date().toISOString()
              })
              .eq('nisn', siswa.nisn);
            synced++;
          } else {
            // Insert new
            await supabase.from(TABLES.SISWA).insert({
              nama: siswa.nama,
              nisn: siswa.nisn,
              jabatan: siswa.jabatan,
              sebagai: siswa.sebagai,
              email: siswa.email,
              wa: siswa.wa,
              status: siswa.status || 'active'
            });
            synced++;
          }
        } catch (error) {
          console.error(`Error syncing siswa ${siswa.nama}:`, error);
          skipped++;
        }
      }

      return { synced, skipped };
    } catch (error) {
      console.error('Error in migrateSiswaFromLocal:', error);
      return { synced: 0, skipped: 0, error: error.message };
    }
  }

  static async migrateAttendanceFromLocal(db) {
    try {
      const localAttendance = await db.attendance.toArray();
      console.log(`📚 Syncing ${localAttendance.length} attendance records...`);

      if (localAttendance.length === 0) return { synced: 0, skipped: 0 };

      let synced = 0;
      let skipped = 0;

      for (const att of localAttendance) {
        try {
          await supabase.from(TABLES.ATTENDANCE).insert({
            tanggal: att.tanggal,
            identifier: att.identifier,
            nama: att.nama,
            jabatan: att.jabatan,
            jam: att.jam,
            status: att.status,
            keterangan: att.keterangan,
            sebagai: att.sebagai,
            wa: att.wa,
            email: att.email,
            att: att.att
          });
          synced++;
        } catch (error) {
          console.error(`Error syncing attendance ${att.nama}:`, error);
          skipped++;
        }
      }

      return { synced, skipped };
    } catch (error) {
      console.error('Error in migrateAttendanceFromLocal:', error);
      return { synced: 0, skipped: 0, error: error.message };
    }
  }

  static async migratePerizinanFromLocal(db) {
    try {
      const localPerizinan = await db.perizinan.toArray();
      console.log(`📚 Syncing ${localPerizinan.length} perizinan records...`);

      if (localPerizinan.length === 0) return { synced: 0, skipped: 0 };

      let synced = 0;
      let skipped = 0;

      for (const izin of localPerizinan) {
        try {
          await supabase.from(TABLES.PERIZINAN).insert({
            tanggal: izin.tanggal,
            tanggal_mulai: izin.tanggal_mulai,
            tanggal_selesai: izin.tanggal_selesai,
            identifier: izin.identifier,
            nama: izin.nama,
            status: izin.status || 'Disetujui',
            jenis_izin: izin.jenis_izin,
            keterangan: izin.keterangan,
            sebagai: izin.sebagai
          });
          synced++;
        } catch (error) {
          console.error(`Error syncing perizinan ${izin.nama}:`, error);
          skipped++;
        }
      }

      return { synced, skipped };
    } catch (error) {
      console.error('Error in migratePerizinanFromLocal:', error);
      return { synced: 0, skipped: 0, error: error.message };
    }
  }

  static async migrateSettingsFromLocal(db) {
    try {
      // Migrate attendance settings
      const localSettings = await db.attendance_settings.toArray();

      let settingsSynced = 0;
      let settingsSkipped = 0;

      for (const setting of localSettings) {
        try {
          await supabase.from(TABLES.ATTENDANCE_SETTINGS).insert({
            type: setting.type,
            start_time: setting.start_time,
            end_time: setting.end_time,
            att: setting.att,
            label: setting.label,
            group_name: setting.group_name
          });
          settingsSynced++;
        } catch (error) {
          console.error(`Error syncing setting ${setting.label}:`, error);
          settingsSkipped++;
        }
      }

      // Migrate school settings
      const schoolSettings = await db.school_settings.toCollection().first();

      if (schoolSettings) {
        try {
          await supabase.from(TABLES.SCHOOL_SETTINGS).insert({
            nama_sekolah: schoolSettings.nama_sekolah,
            npsn: schoolSettings.npsn,
            alamat_desa: schoolSettings.alamat_desa,
            alamat_kecamatan: schoolSettings.alamat_kecamatan,
            alamat_kabupaten: schoolSettings.alamat_kabupaten,
            alamat_provinsi: schoolSettings.alamat_provinsi,
            alamat_negara: schoolSettings.alamat_negara,
            nama_kepala_sekolah: schoolSettings.nama_kepala_sekolah,
            niy_kepala_sekolah: schoolSettings.niy_kepala_sekolah
          });
        } catch (error) {
          console.error('Error syncing school settings:', error);
        }
      }

      return {
        settingsSynced,
        settingsSkipped,
        schoolSettings: schoolSettings ? 1 : 0
      };
    } catch (error) {
      console.error('Error in migrateSettingsFromLocal:', error);
      return { settingsSynced: 0, settingsSkipped: 0, error: error.message };
    }
  }
}

export default supabase