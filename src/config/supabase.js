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
  PERIZINAN: 'perizinan',
  SCHOOL_SETTINGS: 'school_settings',
  REMINDER_SETTINGS: 'reminder_settings'
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
    const { data: result, error } = await supabase
      .from(tableName)
      .insert(data)
      .select()
      .single()

    if (error) throw error
    return result
  }

  static async update(tableName, id, data) {
    const { data: result, error } = await supabase
      .from(tableName)
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return result
  }

  static async delete(tableName, id) {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  static async bulkCreate(tableName, dataArray) {
    const { data, error } = await supabase
      .from(tableName)
      .insert(dataArray)
      .select()

    if (error) throw error
    return data
  }

  // Specific table operations
  static async getGuru(activeOnly = true) {
    let query = supabase.from(TABLES.GURU).select('*')

    if (activeOnly) {
      query = query.eq('status', 'active')
    }

    const { data, error } = await query.order('nama', { ascending: true })
    if (error) throw error
    return data
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
}

export default supabase