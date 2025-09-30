import { supabase, DatabaseService, TABLES } from './config/supabase.js';

// Database wrapper to maintain compatibility with existing code
export const db = {
  // Guru operations
  guru: {
    async toArray() {
      return await DatabaseService.getGuru(true);
    },

    where(field) {
      return {
        equals: (value) => {
          // Return synchronous object that matches Dexie API
          return {
            toArray: () => {
              // Execute query synchronously for compatibility
              if (field === 'status') {
                return DatabaseService.getGuru(value === 'active');
              }
              if (field === 'nama') {
                return supabase
                  .from(TABLES.GURU)
                  .select('*')
                  .eq('nama', value)
                  .eq('status', 'active')
                  .then(({ data, error }) => {
                    if (error) throw error;
                    return data;
                  });
              }
              return Promise.resolve([]);
            },
            first: () => {
              return this.toArray().then(results => results[0] || null);
            }
          };
        }
      };
    },

    async add(data) {
      return await DatabaseService.create(TABLES.GURU, {
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    },

    async update(id, data) {
      return await DatabaseService.update(TABLES.GURU, id, {
        ...data,
        updated_at: new Date().toISOString()
      });
    },

    count() {
      // Return a promise that resolves to the count
      return Promise.resolve().then(async () => {
        const { count, error } = await supabase
          .from(TABLES.GURU)
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');
        if (error) throw error;
        return count || 0;
      });
    }
  },

  // Siswa operations
  siswa: {
    async toArray() {
      return await DatabaseService.getSiswa(true);
    },

    where(field) {
      return {
        equals: (value) => {
          return {
            toArray: () => {
              if (field === 'status') {
                return DatabaseService.getSiswa(value === 'active');
              }
              if (field === 'nama') {
                return supabase
                  .from(TABLES.SISWA)
                  .select('*')
                  .eq('nama', value)
                  .eq('status', 'active')
                  .then(({ data, error }) => {
                    if (error) throw error;
                    return data;
                  });
              }
              return Promise.resolve([]);
            },
            first: () => {
              return this.toArray().then(results => results[0] || null);
            }
          };
        }
      };
    },

    async add(data) {
      return await DatabaseService.create(TABLES.SISWA, {
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    },

    async update(id, data) {
      return await DatabaseService.update(TABLES.SISWA, id, {
        ...data,
        updated_at: new Date().toISOString()
      });
    },

    count() {
      return Promise.resolve().then(async () => {
        const { count, error } = await supabase
          .from(TABLES.SISWA)
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');
        if (error) throw error;
        return count || 0;
      });
    }
  },

  // Attendance operations
  attendance: {
    async toArray() {
      // Get current month data for performance
      const currentDate = new Date();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      return await DatabaseService.getAttendanceByDateRange(
        startOfMonth.toISOString().split('T')[0],
        endOfMonth.toISOString().split('T')[0]
      );
    },

    async add(data) {
      return await DatabaseService.create(TABLES.ATTENDANCE, {
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    },

    where(field) {
      return {
        equals: (value) => {
          return {
            and: (condition) => {
              return {
                toArray: () => {
                  if (field === 'identifier') {
                    return supabase
                      .from(TABLES.ATTENDANCE)
                      .select('*')
                      .eq('identifier', value)
                      .then(({ data, error }) => {
                        if (error) throw error;
                        return data;
                      });
                  }
                  if (field === 'tanggal') {
                    return supabase
                      .from(TABLES.ATTENDANCE)
                      .select('*')
                      .eq('tanggal', value)
                      .then(({ data, error }) => {
                        if (error) throw error;
                        return data;
                      });
                  }
                  return Promise.resolve([]);
                }
              };
            }
          };
        }
      };
    },

    async delete(id) {
      return await DatabaseService.delete(TABLES.ATTENDANCE, id);
    },

    async clear() {
      const { error } = await supabase
        .from(TABLES.ATTENDANCE)
        .delete()
        .neq('id', 0); // Delete all records
      if (error) throw error;
    }
  },

  // Perizinan operations
  perizinan: {
    async toArray() {
      // Get current month data for performance
      const currentDate = new Date();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      return await DatabaseService.getPerizinanByDateRange(
        startOfMonth.toISOString().split('T')[0],
        endOfMonth.toISOString().split('T')[0]
      );
    },

    async add(data) {
      return await DatabaseService.create(TABLES.PERIZINAN, {
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    },

    where(field) {
      return {
        equals: (value) => {
          return {
            and: (condition) => {
              return {
                toArray: () => {
                  if (field === 'tanggal') {
                    return supabase
                      .from(TABLES.PERIZINAN)
                      .select('*')
                      .eq('tanggal', value)
                      .then(({ data, error }) => {
                        if (error) throw error;
                        return data;
                      });
                  }
                  return Promise.resolve([]);
                },

                first: () => {
                  return this.toArray().then(results => results[0] || null);
                }
              };
            }
          };
        }
      };
    },

    async delete(id) {
      return await DatabaseService.delete(TABLES.PERIZINAN, id);
    },

    async clear() {
      const { error } = await supabase
        .from(TABLES.PERIZINAN)
        .delete()
        .neq('id', 0); // Delete all records
      if (error) throw error;
    }
  },

  // School settings operations
  school_settings: {
    async toCollection() {
      return {
        async first() {
          const { data, error } = await supabase
            .from(TABLES.SCHOOL_SETTINGS)
            .select('*')
            .limit(1);
          if (error) throw error;
          return data[0] || null;
        }
      };
    },

    async add(data) {
      return await DatabaseService.create(TABLES.SCHOOL_SETTINGS, {
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  },

  // Attendance settings operations
  attendance_settings: {
    async toArray() {
      return await DatabaseService.getAll(TABLES.ATTENDANCE_SETTINGS);
    },

    async add(data) {
      return await DatabaseService.create(TABLES.ATTENDANCE_SETTINGS, {
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    },

    async update(id, data) {
      return await DatabaseService.update(TABLES.ATTENDANCE_SETTINGS, id, {
        ...data,
        updated_at: new Date().toISOString()
      });
    },

    async delete(id) {
      return await DatabaseService.delete(TABLES.ATTENDANCE_SETTINGS, id);
    },

    where(field) {
      return {
        equals: (value) => {
          return {
            first: () => {
              return supabase
                .from(TABLES.ATTENDANCE_SETTINGS)
                .select('*')
                .eq(field, value)
                .limit(1)
                .then(({ data, error }) => {
                  if (error) throw error;
                  return data[0] || null;
                });
            },

            toArray: () => {
              return supabase
                .from(TABLES.ATTENDANCE_SETTINGS)
                .select('*')
                .eq(field, value)
                .then(({ data, error }) => {
                  if (error) throw error;
                  return data;
                });
            }
          };
        }
      };
    },

    count() {
      return Promise.resolve().then(async () => {
        const { count, error } = await supabase
          .from(TABLES.ATTENDANCE_SETTINGS)
          .select('*', { count: 'exact', head: true });
        if (error) throw error;
        return count || 0;
      });
    }
  },

  // Reminder settings operations
  reminder_settings: {
    async toCollection() {
      return {
        async first() {
          const { data, error } = await supabase
            .from(TABLES.REMINDER_SETTINGS)
            .select('*')
            .limit(1);
          if (error) throw error;
          return data[0] || null;
        }
      };
    },

    async add(data) {
      return await DatabaseService.create(TABLES.REMINDER_SETTINGS, {
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    },

    async update(id, data) {
      return await DatabaseService.update(TABLES.REMINDER_SETTINGS, id, {
        ...data,
        updated_at: new Date().toISOString()
      });
    }
  }
};

// Initialize sample data if tables are empty
const initializeSampleData = async () => {
  try {
    console.log('🔄 Initializing sample data in Supabase...');

    // Check if we have any data in the tables
    const [guruCount, siswaCount, settingsCount] = await Promise.all([
      supabase.from(TABLES.GURU).select('*', { count: 'exact', head: true }),
      supabase.from(TABLES.SISWA).select('*', { count: 'exact', head: true }),
      supabase.from(TABLES.ATTENDANCE_SETTINGS).select('*', { count: 'exact', head: true })
    ]);

    console.log('📊 Table counts:', { guruCount: guruCount.count, siswaCount: siswaCount.count, settingsCount: settingsCount.count });

    const promises = [];

    // Add sample guru if empty
    if ((guruCount.count || 0) === 0) {
      const sampleGuru = [
        { nama: 'Ahmad Santoso', niy: 'G001', jabatan: 'Guru Matematika', sebagai: 'Guru', email: 'ahmad@school.com', wa: '08123456789', status: 'active' },
        { nama: 'Siti Aminah', niy: 'G002', jabatan: 'Guru Bahasa Indonesia', sebagai: 'Guru', email: 'siti@school.com', wa: '08198765432', status: 'active' },
        { nama: 'Budi Setiawan', niy: 'G003', jabatan: 'Guru IPA', sebagai: 'Guru', email: 'budi@school.com', wa: '08134567890', status: 'active' }
      ];
      promises.push(DatabaseService.bulkCreate(TABLES.GURU, sampleGuru));
    }

    // Add sample siswa if empty
    if ((siswaCount.count || 0) === 0) {
      const sampleSiswa = [
        { nama: 'Rina Sari', nisn: 'S001', jabatan: 'Kelas 10A', sebagai: 'Siswa', email: 'rina@school.com', wa: '08111111111', status: 'active' },
        { nama: 'Dedi Kurniawan', nisn: 'S002', jabatan: 'Kelas 10A', sebagai: 'Siswa', email: 'dedi@school.com', wa: '08122222222', status: 'active' },
        { nama: 'Maya Putri', nisn: 'S003', jabatan: 'Kelas 10B', sebagai: 'Siswa', email: 'maya@school.com', wa: '08133333333', status: 'active' },
        { nama: 'Andi Rahman', nisn: 'S004', jabatan: 'Kelas 10B', sebagai: 'Siswa', email: 'andi@school.com', wa: '08144444444', status: 'active' },
        { nama: 'Sari Dewi', nisn: 'S005', jabatan: 'Kelas 11A', sebagai: 'Siswa', email: 'sari@school.com', wa: '08155555555', status: 'active' }
      ];
      promises.push(DatabaseService.bulkCreate(TABLES.SISWA, sampleSiswa));
    }

    // Add default attendance settings if empty
    if ((settingsCount.count || 0) === 0) {
      const defaultSettings = [
        { type: 'guru', start_time: '06:00', end_time: '07:30', att: 'Datang', label: 'Tepat Waktu' },
        { type: 'guru', start_time: '07:30', end_time: '08:00', att: 'Datang', label: 'Tahap 1' },
        { type: 'guru', start_time: '08:00', end_time: '15:00', att: 'Datang', label: 'Tahap 2' },
        { type: 'guru', start_time: '15:00', end_time: '17:00', att: 'Pulang', label: 'Pulang' },
        { type: 'siswa', start_time: '06:00', end_time: '07:30', att: 'Datang', label: 'Tepat Waktu' },
        { type: 'siswa', start_time: '07:30', end_time: '08:00', att: 'Datang', label: 'Tahap 1' },
        { type: 'siswa', start_time: '08:00', end_time: '12:00', att: 'Datang', label: 'Tahap 2' },
        { type: 'siswa', start_time: '12:00', end_time: '17:00', att: 'Pulang', label: 'Pulang' }
      ];
      promises.push(DatabaseService.bulkCreate(TABLES.ATTENDANCE_SETTINGS, defaultSettings));
    }

    // Add default school settings if empty
    const { data: schoolSettings } = await supabase
      .from(TABLES.SCHOOL_SETTINGS)
      .select('*')
      .limit(1);

    if (!schoolSettings || schoolSettings.length === 0) {
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
      promises.push(DatabaseService.create(TABLES.SCHOOL_SETTINGS, defaultSchoolSettings));
    }

    await Promise.all(promises);
    console.log('✅ Sample data initialized in Supabase');
  } catch (error) {
    console.error('❌ Error initializing sample data:', error);
  }
};

// Initialize sample data when module loads
initializeSampleData();

export default db;