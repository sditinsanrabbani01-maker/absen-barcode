-- =====================================================
-- SUPABASE DATABASE SCHEMA FOR ABSEN BARCODE APPLICATION
-- =====================================================
-- Complete database setup script for production use
-- Run this script in your Supabase SQL Editor
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security extension
CREATE EXTENSION IF NOT EXISTS "row_level_security";

-- Guru table (Teachers)
CREATE TABLE IF NOT EXISTS guru (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama TEXT NOT NULL,
    niy TEXT UNIQUE,
    jabatan TEXT,
    sebagai TEXT DEFAULT 'Guru',
    email TEXT,
    wa TEXT,
    status TEXT DEFAULT 'active',
    pendidikan TEXT DEFAULT 'S1',
    mk_start_year INTEGER,
    mk_start_month INTEGER,
    gaji_pokok DECIMAL(15,2),
    tunjangan_kinerja DECIMAL(15,2) DEFAULT 0,
    tunjangan_umum DECIMAL(15,2) DEFAULT 0,
    tunjangan_istri DECIMAL(15,2) DEFAULT 0,
    tunjangan_anak DECIMAL(15,2) DEFAULT 0,
    tunjangan_kepala_sekolah DECIMAL(15,2) DEFAULT 0,
    tunjangan_wali_kelas DECIMAL(15,2) DEFAULT 0,
    honor_bendahara DECIMAL(15,2) DEFAULT 0,
    keterangan TEXT,
    custom_base_salary DECIMAL(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    imported_at TIMESTAMP WITH TIME ZONE
);

-- Siswa table (Students)
CREATE TABLE IF NOT EXISTS siswa (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama TEXT NOT NULL,
    nisn TEXT UNIQUE,
    jabatan TEXT,
    sebagai TEXT DEFAULT 'Siswa',
    email TEXT,
    wa TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tanggal DATE NOT NULL,
    identifier TEXT NOT NULL,
    nama TEXT NOT NULL,
    jabatan TEXT,
    jam TIME,
    status TEXT,
    keterangan TEXT,
    sebagai TEXT,
    wa TEXT,
    email TEXT,
    att TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create composite index for attendance queries
CREATE INDEX IF NOT EXISTS idx_attendance_identifier_date ON attendance(identifier, tanggal);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(tanggal);

-- Penggajian table (Payroll)
CREATE TABLE IF NOT EXISTS penggajian (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama TEXT NOT NULL,
    jabatan TEXT,
    gaji DECIMAL(15,2),
    bulan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guru inactive table (Former teachers)
CREATE TABLE IF NOT EXISTS guru_inactive (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama TEXT NOT NULL,
    niy TEXT,
    jabatan TEXT,
    sebagai TEXT DEFAULT 'Guru',
    email TEXT,
    wa TEXT,
    status TEXT DEFAULT 'inactive',
    tanggal_keluar DATE,
    alasan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Siswa inactive table (Former students)
CREATE TABLE IF NOT EXISTS siswa_inactive (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama TEXT NOT NULL,
    nisn TEXT,
    jabatan TEXT,
    sebagai TEXT DEFAULT 'Siswa',
    email TEXT,
    wa TEXT,
    status TEXT DEFAULT 'inactive',
    tanggal_keluar DATE,
    alasan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance settings table
CREATE TABLE IF NOT EXISTS attendance_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    type TEXT NOT NULL, -- 'guru', 'siswa', 'jabatan', 'group'
    start_time TIME,
    end_time TIME,
    att TEXT, -- 'Datang' or 'Pulang'
    label TEXT,
    jabatan TEXT, -- for jabatan-specific settings
    group_name TEXT, -- for group settings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Perizinan table (Permissions/Absences)
CREATE TABLE IF NOT EXISTS perizinan (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tanggal DATE NOT NULL,
    tanggal_mulai DATE,
    tanggal_selesai DATE,
    identifier TEXT NOT NULL,
    nama TEXT NOT NULL,
    status TEXT DEFAULT 'Disetujui',
    jenis_izin TEXT NOT NULL, -- 'Izin', 'Sakit', 'Dinas Luar', 'Cuti'
    keterangan TEXT,
    sebagai TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create composite index for perizinan queries
CREATE INDEX IF NOT EXISTS idx_perizinan_identifier_date ON perizinan(identifier, tanggal);
CREATE INDEX IF NOT EXISTS idx_perizinan_date_range ON perizinan(tanggal_mulai, tanggal_selesai);

-- School settings table
CREATE TABLE IF NOT EXISTS school_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama_sekolah TEXT,
    npsn TEXT,
    alamat_desa TEXT,
    alamat_kecamatan TEXT,
    alamat_kabupaten TEXT,
    alamat_provinsi TEXT,
    alamat_negara TEXT,
    nama_kepala_sekolah TEXT,
    niy_kepala_sekolah TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reminder settings table
CREATE TABLE IF NOT EXISTS reminder_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    enabled BOOLEAN DEFAULT FALSE,
    reminder_time TIME DEFAULT '09:00',
    test_mode BOOLEAN DEFAULT FALSE,
    last_reminder_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MK Settings table (Masa Kerja & Gaji Pokok)
CREATE TABLE IF NOT EXISTS mk_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    start_year INTEGER DEFAULT 2023,
    start_month INTEGER DEFAULT 7,
    base_salaries JSONB DEFAULT '{
        "SMA/Sederajat": 2500000,
        "D3": 2750000,
        "S1": 3000000,
        "S2": 3500000,
        "S3": 4000000
    }',
    annual_increments JSONB DEFAULT '{
        "SMA/Sederajat": 200000,
        "D3": 225000,
        "S1": 250000,
        "S2": 275000,
        "S3": 300000
    }',
    annual_increment_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_guru_updated_at BEFORE UPDATE ON guru FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_siswa_updated_at BEFORE UPDATE ON siswa FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_penggajian_updated_at BEFORE UPDATE ON penggajian FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guru_inactive_updated_at BEFORE UPDATE ON guru_inactive FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_siswa_inactive_updated_at BEFORE UPDATE ON siswa_inactive FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_settings_updated_at BEFORE UPDATE ON attendance_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_perizinan_updated_at BEFORE UPDATE ON perizinan FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_school_settings_updated_at BEFORE UPDATE ON school_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reminder_settings_updated_at BEFORE UPDATE ON reminder_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mk_settings_updated_at BEFORE UPDATE ON mk_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default data
INSERT INTO attendance_settings (type, start_time, end_time, att, label) VALUES
-- Guru settings
('guru', '06:00', '07:30', 'Datang', 'Tepat Waktu'),
('guru', '07:30', '08:00', 'Datang', 'Tahap 1'),
('guru', '08:00', '15:00', 'Datang', 'Tahap 2'),
('guru', '15:00', '17:00', 'Pulang', 'Pulang'),
-- Siswa settings
('siswa', '06:00', '07:30', 'Datang', 'Tepat Waktu'),
('siswa', '07:30', '08:00', 'Datang', 'Tahap 1'),
('siswa', '08:00', '12:00', 'Datang', 'Tahap 2'),
('siswa', '12:00', '17:00', 'Pulang', 'Pulang')
ON CONFLICT DO NOTHING;

-- Insert default school settings
INSERT INTO school_settings (nama_sekolah, npsn, alamat_desa, alamat_kecamatan, alamat_kabupaten, alamat_provinsi, alamat_negara, nama_kepala_sekolah, niy_kepala_sekolah) VALUES
('SMA Negeri 1 Makassar', '40300123', 'Bontoala', 'Bontoala', 'Kota Makassar', 'Sulawesi Selatan', 'Indonesia', 'Dr. H. Ahmad Yani, M.Pd.', '197001011990011001')
ON CONFLICT DO NOTHING;

-- Insert default reminder settings
INSERT INTO reminder_settings (enabled, reminder_time, test_mode) VALUES
 (FALSE, '09:00', FALSE)
 ON CONFLICT DO NOTHING;

-- Insert default MK settings
INSERT INTO mk_settings (
    start_year, start_month, base_salaries, annual_increments,
    annual_increment_enabled, use_current_filter, label
) VALUES (
    2023, 7,
    '{
        "SMA/Sederajat": 2500000,
        "D3": 2750000,
        "S1": 3000000,
        "S2": 3500000,
        "S3": 4000000
    }',
    '{
        "SMA/Sederajat": 200000,
        "D3": 225000,
        "S1": 250000,
        "S2": 275000,
        "S3": 300000
    }',
    TRUE, TRUE, 'MK Settings'
)
ON CONFLICT DO NOTHING;

-- Insert sample data for testing
INSERT INTO guru (nama, niy, jabatan, sebagai, email, wa, status, pendidikan, mk_start_year, mk_start_month) VALUES
('Ahmad Santoso', 'G001', 'Guru Matematika', 'Guru', 'ahmad@school.com', '08123456789', 'active', 'S1', 2020, 7),
('Siti Aminah', 'G002', 'Guru Bahasa Indonesia', 'Guru', 'siti@school.com', '08198765432', 'active', 'S1', 2019, 8),
('Budi Setiawan', 'G003', 'Guru IPA', 'Guru', 'budi@school.com', '08134567890', 'active', 'S2', 2018, 1)
ON CONFLICT (niy) DO NOTHING;

INSERT INTO siswa (nama, nisn, jabatan, sebagai, email, wa, status) VALUES
('Rina Sari', 'S001', 'Kelas 10A', 'Siswa', 'rina@school.com', '08111111111', 'active'),
('Dedi Kurniawan', 'S002', 'Kelas 10A', 'Siswa', 'dedi@school.com', '08122222222', 'active'),
('Maya Putri', 'S003', 'Kelas 10B', 'Siswa', 'maya@school.com', '08133333333', 'active'),
('Andi Rahman', 'S004', 'Kelas 10B', 'Siswa', 'andi@school.com', '08144444444', 'active'),
('Sari Dewi', 'S005', 'Kelas 11A', 'Siswa', 'sari@school.com', '08155555555', 'active')
ON CONFLICT (nisn) DO NOTHING;

-- Insert sample attendance data
INSERT INTO attendance (tanggal, identifier, nama, jabatan, jam, status, keterangan, sebagai, wa, email, att) VALUES
('2024-01-15', 'S001', 'Rina Sari', 'Kelas 10A', '07:30', 'datang', '', 'Siswa', '08111111111', 'rina@school.com', 'Datang'),
('2024-01-15', 'G001', 'Ahmad Santoso', 'Guru Matematika', '07:00', 'datang', '', 'Guru', '08123456789', 'ahmad@school.com', 'Datang'),
('2024-01-16', 'S002', 'Dedi Kurniawan', 'Kelas 10A', '07:35', 'Izin', 'Sakit', 'Siswa', '08122222222', 'dedi@school.com', 'Datang')
ON CONFLICT DO NOTHING;

-- Insert sample perizinan data
INSERT INTO perizinan (tanggal, identifier, nama, status, jenis_izin, keterangan, sebagai) VALUES
('2024-01-16', 'S002', 'Dedi Kurniawan', 'Disetujui', 'Sakit', 'Demam', 'Siswa'),
('2024-01-17', 'G002', 'Siti Aminah', 'Disetujui', 'Izin', 'Kegiatan keluarga', 'Guru')
ON CONFLICT DO NOTHING;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) CONFIGURATION
-- =====================================================
-- For development and testing, we'll disable RLS to allow easy access
-- For production, you should enable RLS and create proper policies

-- Disable RLS for all tables (for development)
ALTER TABLE guru DISABLE ROW LEVEL SECURITY;
ALTER TABLE siswa DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE penggajian DISABLE ROW LEVEL SECURITY;
ALTER TABLE guru_inactive DISABLE ROW LEVEL SECURITY;
ALTER TABLE siswa_inactive DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE mk_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE perizinan DISABLE ROW LEVEL SECURITY;
ALTER TABLE school_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_settings DISABLE ROW LEVEL SECURITY;

-- Alternative: Enable RLS with public access policies (for production)
-- Uncomment the following lines if you want to enable RLS with proper policies

-- Enable RLS for all tables
-- ALTER TABLE guru ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE siswa ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE perizinan ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (adjust based on your security requirements)
-- CREATE POLICY "Allow anonymous read access" ON guru FOR SELECT USING (true);
-- CREATE POLICY "Allow anonymous insert access" ON guru FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow anonymous update access" ON guru FOR UPDATE USING (true);
-- CREATE POLICY "Allow anonymous delete access" ON guru FOR DELETE USING (true);

-- CREATE POLICY "Allow anonymous read access" ON siswa FOR SELECT USING (true);
-- CREATE POLICY "Allow anonymous insert access" ON siswa FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow anonymous update access" ON siswa FOR UPDATE USING (true);
-- CREATE POLICY "Allow anonymous delete access" ON siswa FOR DELETE USING (true);

-- CREATE POLICY "Allow anonymous read access" ON attendance FOR SELECT USING (true);
-- CREATE POLICY "Allow anonymous insert access" ON attendance FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow anonymous update access" ON attendance FOR UPDATE USING (true);
-- CREATE POLICY "Allow anonymous delete access" ON attendance FOR DELETE USING (true);

-- CREATE POLICY "Allow anonymous read access" ON perizinan FOR SELECT USING (true);
-- CREATE POLICY "Allow anonymous insert access" ON perizinan FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow anonymous update access" ON perizinan FOR UPDATE USING (true);
-- CREATE POLICY "Allow anonymous delete access" ON perizinan FOR DELETE USING (true);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these queries to verify your database setup

-- Check if all tables exist
SELECT
    table_name,
    CASE
        WHEN table_name = 'guru' THEN '✅ Teachers with payroll data'
        WHEN table_name = 'siswa' THEN '✅ Students data'
        WHEN table_name = 'attendance' THEN '✅ Daily attendance records'
        WHEN table_name = 'penggajian' THEN '✅ Payroll records'
        WHEN table_name = 'perizinan' THEN '✅ Permission requests'
        WHEN table_name = 'attendance_settings' THEN '✅ Settings and configurations'
        WHEN table_name = 'mk_settings' THEN '✅ MK (Masa Kerja) settings'
        WHEN table_name = 'school_settings' THEN '✅ School configuration'
        WHEN table_name = 'reminder_settings' THEN '✅ WhatsApp reminder settings'
        ELSE '✅ Other table'
    END as description
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'guru', 'siswa', 'attendance', 'penggajian',
    'guru_inactive', 'siswa_inactive', 'attendance_settings',
    'mk_settings', 'perizinan', 'school_settings', 'reminder_settings'
)
ORDER BY table_name;

-- Check table structures
SELECT
    'guru' as table_name,
    count(*) as record_count,
    'Teachers with payroll information' as description
FROM guru
UNION ALL
SELECT
    'siswa' as table_name,
    count(*) as record_count,
    'Students data' as description
FROM siswa
UNION ALL
SELECT
    'attendance' as table_name,
    count(*) as record_count,
    'Daily attendance records' as description
FROM attendance
UNION ALL
SELECT
    'perizinan' as table_name,
    count(*) as record_count,
    'Permission and absence requests' as description
FROM perizinan;

-- =====================================================
-- SETUP INSTRUCTIONS
-- =====================================================
-- 1. Copy and paste this entire script into your Supabase SQL Editor
-- 2. Run the script to create all tables
-- 3. Verify tables are created using the verification queries above
-- 4. Your application should now be able to connect and sync data
-- =====================================================

-- Final success message
SELECT '🎉 DATABASE SETUP COMPLETED SUCCESSFULLY!' as status;