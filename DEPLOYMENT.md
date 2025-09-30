# Deployment Guide - Absen Barcode ke Vercel + Supabase

## 📋 Overview

Panduan lengkap untuk deploy aplikasi Absen Barcode ke Vercel dengan database Supabase.

## 🚀 Prerequisites

- Akun Vercel (https://vercel.com)
- Akun Supabase (https://supabase.com)
- Node.js 18+ dan npm
- Git

## 🗄️ 1. Setup Supabase Database

### 1.1 Buat Project Baru di Supabase

1. Login ke [Supabase Dashboard](https://supabase.com/dashboard)
2. Klik "New Project"
3. Pilih organization dan isi:
   - **Name**: `absen-barcode` atau nama pilihan Anda
   - **Database Password**: Buat password yang kuat
   - **Region**: Pilih region terdekat (Asia Southeast untuk Indonesia)
4. Tunggu hingga project selesai dibuat (2-3 menit)

### 1.2 Jalankan Database Schema

1. Di Supabase Dashboard, buka **SQL Editor**
2. Copy isi file `supabase-schema.sql` dan paste ke SQL Editor
3. Klik **Run** untuk mengeksekusi schema
4. Verifikasi tabel sudah tercipta di **Table Editor**

### 1.3 Konfigurasi Authentication (Opsional)

Jika ingin menggunakan fitur authentication:

1. Buka **Authentication** > **Settings**
2. Konfigurasi providers sesuai kebutuhan
3. Buka **API** untuk melihat URL dan keys

### 1.4 Ambil Supabase Credentials

1. Buka **Settings** > **API**
2. Copy **Project URL** dan **anon/public key**
3. Update file `.env` dengan credentials yang benar:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## ⚡ 2. Deploy ke Vercel

### 2.1 Persiapan Project

1. **Install dependencies**:
```bash
npm install
```

2. **Build project untuk testing**:
```bash
npm run build
```

3. **Verifikasi build berhasil**:
```bash
npm run preview
```

### 2.2 Deploy via Vercel CLI (Recommended)

1. **Install Vercel CLI**:
```bash
npm i -g vercel
```

2. **Login ke Vercel**:
```bash
vercel login
```

3. **Deploy project**:
```bash
vercel --prod
```

4. **Set Environment Variables di Vercel**:
   - Buka [Vercel Dashboard](https://vercel.com/dashboard)
   - Pilih project yang baru dibuat
   - Buka **Settings** > **Environment Variables**
   - Tambahkan semua variables dari `.env`:

```env
VITE_SUPABASE_URL=https://jfvmledccblgzvjzytaz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_WHATSAPP_DEVICE_ID=9b33e3a9-e9ff-4f8b-a62a-90b5eee3f946
VITE_WHATSAPP_API_URL=https://api.whacenter.com/api
VITE_APP_NAME=Absen Barcode
VITE_APP_VERSION=1.0.0
VITE_APP_MODE=production
VITE_ENABLE_CORS=true
VITE_CORS_ORIGIN=https://your-domain.vercel.app
```

### 2.3 Deploy via Git (Alternative)

1. **Push ke GitHub**:
```bash
git add .
git commit -m "Deploy: Add Supabase integration"
git push origin main
```

2. **Import di Vercel**:
   - Buka [Vercel Dashboard](https://vercel.com/dashboard)
   - Klik **Add New Project**
   - Pilih **Import Git Repository**
   - Connect ke GitHub repository Anda
   - Konfigurasi:
     - **Framework Preset**: Vite
     - **Root Directory**: `./` (default)
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`
     - **Install Command**: `npm install`

3. **Set Environment Variables** seperti di langkah 2.4

## 🔧 3. Post-Deployment Configuration

### 3.1 Update Domain di Environment Variables

Setelah deploy, update `VITE_CORS_ORIGIN` dengan domain Vercel Anda:

```env
VITE_CORS_ORIGIN=https://your-app-name.vercel.app
```

### 3.2 Test Database Connection

1. Buka aplikasi yang sudah di-deploy
2. Buka browser console (F12)
3. Check apakah ada error terkait database connection
4. Verifikasi data bisa di-load dari Supabase

### 3.3 WhatsApp Integration

Pastikan WhatsApp API masih berfungsi:

1. Test endpoint WhatsApp masih dapat diakses
2. Verifikasi device ID masih aktif
3. Test kirim pesan reminder

## 🛠️ 4. Troubleshooting

### 4.1 Database Connection Issues

**Error**: `Missing Supabase environment variables`

**Solution**:
1. Pastikan environment variables sudah di-set di Vercel
2. Redeploy setelah menambah environment variables
3. Check di browser console untuk error details

**Error**: `Failed to fetch` atau CORS errors

**Solution**:
1. Pastikan `VITE_CORS_ORIGIN` sesuai dengan domain Vercel
2. Check Supabase RLS (Row Level Security) settings
3. Verifikasi API keys tidak expired

### 4.2 Build Issues

**Error**: `Module not found: @supabase/supabase-js`

**Solution**:
```bash
npm install @supabase/supabase-js
```

**Error**: Build size terlalu besar

**Solution**:
- Build sudah dioptimasi dengan code splitting
- Jika masih besar, pertimbangkan lazy loading untuk komponen besar

### 4.3 Runtime Issues

**Error**: `ReferenceError: process is not defined`

**Solution**: Pastikan menggunakan `import.meta.env` untuk environment variables di Vite

**Error**: Dexie masih digunakan

**Solution**: Update semua komponen untuk menggunakan Supabase service

## 📊 5. Monitoring & Maintenance

### 5.1 Vercel Analytics

1. Buka project di Vercel Dashboard
2. Monitor **Functions** dan **Analytics** tab
3. Set alert untuk error rate tinggi

### 5.2 Supabase Monitoring

1. Buka **Dashboard** di Supabase
2. Monitor **Database** > **Performance**
3. Set alert untuk query lambat atau error

### 5.3 Log Monitoring

Aktifkan logging untuk production:

```javascript
// Di komponen utama atau service
if (import.meta.env.MODE === 'production') {
  console.log = () => {}; // Disable console.log di production
  // Gunakan proper logging service jika diperlukan
}
```

## 🔒 6. Security Considerations

### 6.1 Environment Variables

- ✅ **Sudah**: Environment variables di-set di Vercel
- ✅ **Sudah**: Sensitive data tidak di-commit ke Git
- ⚠️ **Review**: Pastikan semua API keys sudah di-rotate secara berkala

### 6.2 CORS Configuration

- ✅ **Sudah**: CORS diaktifkan untuk domain production
- ✅ **Sudah**: WhatsApp API proxy configured
- ⚠️ **Review**: Monitor untuk CORS errors di console

### 6.3 Database Security

- ✅ **Sudah**: RLS bisa diaktifkan jika diperlukan
- ✅ **Sudah**: Default policies untuk public read access
- ⚠️ **Review**: Sesuaikan RLS policies berdasarkan kebutuhan security

## 🚀 7. Quick Commands Reference

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run preview         # Preview production build

# Deployment
vercel --prod           # Deploy to production
vercel logs             # Check deployment logs
vercel env ls           # List environment variables

# Database
# Run supabase-schema.sql in Supabase SQL Editor

# Dependencies
npm install             # Install all dependencies
npm install @supabase/supabase-js  # Install Supabase client
```

## 📞 8. Support

Jika mengalami issues:

1. **Check Logs**: `vercel logs` atau Vercel Dashboard
2. **Database Logs**: Supabase Dashboard > Database > Logs
3. **Browser Console**: F12 untuk melihat client-side errors
4. **Network Tab**: Monitor API calls dan responses

## 🎯 9. Next Steps

Setelah deployment berhasil:

1. ✅ Test semua fitur utama
2. ✅ Setup monitoring dan alerts
3. ✅ Configure backup strategy untuk database
4. ✅ Set automated deployment untuk future updates
5. ✅ Document API endpoints jika diperlukan
6. ✅ Setup custom domain (opsional)

---

**Deployment Status**: ✅ Ready untuk production

**Last Updated**: 2024
**Version**: 1.0.0