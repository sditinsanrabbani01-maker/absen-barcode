-- =====================================================
-- SUPABASE DROP TABLES SCRIPT
-- =====================================================
-- WARNING: This script will DELETE ALL DATA permanently!
-- Use with caution - make sure to backup important data first
-- =====================================================

-- Drop tables in reverse dependency order (most dependent first)
DROP TABLE IF EXISTS penggajian CASCADE;
DROP TABLE IF EXISTS perizinan CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS guru_inactive CASCADE;
DROP TABLE IF EXISTS siswa_inactive CASCADE;
DROP TABLE IF EXISTS guru CASCADE;
DROP TABLE IF EXISTS siswa CASCADE;
DROP TABLE IF EXISTS attendance_settings CASCADE;
DROP TABLE IF EXISTS school_settings CASCADE;
DROP TABLE IF EXISTS reminder_settings CASCADE;

-- Drop custom functions if they exist
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop extensions if they exist (optional - only if you want to remove them)
-- DROP EXTENSION IF EXISTS "uuid-ossp";

-- =====================================================
-- VERIFICATION QUERIES (Optional)
-- =====================================================
-- Uncomment the following lines to verify all tables are dropped

-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_type = 'BASE TABLE'
-- AND table_name IN (
--     'guru', 'siswa', 'attendance', 'penggajian',
--     'guru_inactive', 'siswa_inactive', 'attendance_settings',
--     'perizinan', 'school_settings', 'reminder_settings'
-- );

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
-- If you see this message, all tables have been successfully dropped
-- You can now run the CREATE script to recreate the database structure
-- =====================================================

-- SELECT '✅ ALL TABLES SUCCESSFULLY DROPPED - Database is now clean' as status;