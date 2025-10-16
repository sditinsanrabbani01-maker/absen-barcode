 # 📱 Sistem Absensi Barcode Sekolah
 
 Sistem absensi modern dengan QR code scanning untuk sekolah, menggunakan React + Vite dengan database **Supabase** (PostgreSQL cloud) untuk production dan **IndexedDB** untuk development.
 
 ## 🚀 **Production Ready** - Deployed on Vercel + Supabase
 
 [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/absen-barcode)
 
 ### 🌐 **Live Demo**: [https://your-app-name.vercel.app](https://your-app-name.vercel.app)

## ✨ Fitur Utama

### 🎯 Absensi Pintar
- **Scan QR Code** real-time dengan kamera device
- **Default Full Screen** saat pertama kali dibuka
- **Mirror Mode** untuk memudahkan penyesuaian posisi
- **Ukuran Kotak Scanner** responsive (Kecil/Sedang/Besar/Full) menyesuaikan rotasi layar
- **UI Immersive** full-screen dengan floating controls
- **Kalkulasi Status Otomatis** berdasarkan waktu scan
- **Kolom Att (Attendance Type)** - Datang/Pulang berdasarkan waktu
- **Pencegahan Duplikasi** berdasarkan Att type per hari
- **Fitur Pulang Cepat** untuk siswa

### 👥 Manajemen Data
- **Data Guru & Siswa** dengan status aktif/non-aktif
- **Import/Export Excel** untuk data massal
- **Backup & Restore** data lengkap antar device
- **Mutasi/Keluar** dengan pencatatan alasan

### 📊 Dashboard & Reporting
- **Dashboard Real-time** dengan statistik terkini
- **Rekapan Absen** harian dan historis
- **Filter & Search** data yang powerful
- **Export Laporan** dalam format Excel

### ⚙️ Pengaturan Konfigurasi
- **Range Waktu** yang dapat dikustomisasi
- **Status Absensi** berdasarkan waktu kedatangan
- **Pengaturan Terpisah** untuk Guru dan Siswa

### 🗑️ Admin Controls
- **Hapus Data** individual atau massal
- **Konfirmasi Keamanan** untuk operasi berbahaya
- **Audit Trail** untuk tracking perubahan

## 🚀 **NEW: Production Deployment dengan Supabase**

Aplikasi sekarang mendukung deployment production dengan **Supabase** (PostgreSQL cloud) untuk sinkronisasi data real-time antar device!

### ✅ **Fitur Production**:
- 🌐 **Multi-device sync** - Data tersinkronisasi otomatis
- 📊 **Real-time database** - Update langsung terlihat di semua device
- 🔒 **Cloud backup** - Data aman di cloud
- 🚀 **High availability** - 99.9% uptime guarantee
- 📈 **Scalable** - Siap untuk pertumbuhan

### 🛠️ **Quick Deploy**:

#### **1. Setup Database (5 menit)**
```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Update .env dengan Supabase credentials Anda
# VITE_SUPABASE_URL=https://jfvmledccblgzvjzytaz.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key

# 3. Run database schema
# Buka supabase-schema.sql di Supabase SQL Editor dan execute
```

#### **2. Deploy ke Vercel (3 menit)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy production
vercel --prod

# Set environment variables di Vercel dashboard
```

#### **3. Live Application**
```
🌐 https://your-app-name.vercel.app
📱 Ready untuk production dengan full features!
```

### 📋 **Database Schema**:
- ✅ **10+ tables** dengan relationships
- ✅ **Auto-migration** scripts included
- ✅ **Sample data** untuk testing
- ✅ **Indexes** untuk performance optimal

---

## 🔄 **Legacy: Sinkronisasi Data Lokal (IndexedDB)**

> ⚠️ **Deprecated**: Untuk production, gunakan Supabase di atas

### ❓ Mengapa Data Berbeda di Device Lain?

Aplikasi development menggunakan **IndexedDB** (database lokal browser) untuk menyimpan data. Setiap device/browser memiliki database terpisah, sehingga:

- ✅ **Data di Device A** tidak otomatis muncul di Device B
- ✅ **Browser berbeda** di device yang sama pun terpisah
- ✅ **Data hilang** jika browser di-clear

### 🔄 Solusi Sinkronisasi Data

#### **Metode 1: Backup & Restore (Manual)**
1. **Di Device Utama:**
   - Buka menu **Database**
   - Klik **"📤 Backup Semua Data"**
   - Simpan file `.json` yang terdownload

2. **Di Device Lain:**
   - Buka menu **Database**
   - Klik **"📥 Restore Data"**
   - Pilih file backup yang sudah didownload
   - Data akan otomatis diimpor

#### **Metode 2: Sinkronisasi Berkala**
- Lakukan backup setiap hari setelah absensi selesai
- Bagikan file backup ke device lain via email/USB
- Import di device tujuan

## 🛠️ Instalasi & Setup

### 🚀 **Quick Start (Production Deployment)**

```bash
# 1. Clone dan setup otomatis
git clone <your-repo-url>
cd absen-barcode

# 2. Install semua dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env dengan credentials Supabase Anda

# 4. Deploy ke production
./setup.sh  # Atau baca DEPLOYMENT.md untuk detail

# 5. Setup database di Supabase
# Buka supabase-schema.sql di SQL Editor dan run
```

### 📋 **Prerequisites**
```bash
Node.js >= 18.0.0
npm >= 9.0.0
Git
```

### 🔧 **Development Setup**
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build untuk production
npm run build

# Preview production build
npm run preview
```

### 🌐 **Production Deployment**

#### **Vercel (Recommended)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy production
vercel --prod

# Set environment variables di dashboard
# Lihat DEPLOYMENT.md untuk detail lengkap
```

#### **Manual Deployment**
1. **Build aplikasi**: `npm run build`
2. **Serve dengan static host** (nginx, apache, netlify, dll.)
3. **Set environment variables** sesuai `.env.example`
4. **Configure CORS** untuk production domain

### 📊 **Database Setup**

#### **Supabase (Production)**
1. Buat project baru di [supabase.com](https://supabase.com)
2. Buka **SQL Editor**
3. Copy & paste isi `supabase-schema.sql`
4. Klik **Run** untuk execute schema
5. Update `.env` dengan credentials dari **Settings > API**

#### **IndexedDB (Development)**
- Otomatis setup saat pertama kali buka aplikasi
- Data tersimpan lokal di browser
- Perfect untuk development dan testing

### ⚙️ **Environment Variables**

Copy `.env.example` ke `.env` dan update dengan credentials Anda:

```env
# Supabase (Production Database)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# WhatsApp API
VITE_WHATSAPP_DEVICE_ID=your-device-id
VITE_WHATSAPP_API_URL=https://api.whacenter.com/api

# App Configuration
VITE_APP_NAME=Absen Barcode
VITE_CORS_ORIGIN=http://localhost:5173
```

## 🔒 HTTPS & Camera Access

### **Masalah SSL di Windows**
Server development menggunakan HTTP untuk kompatibilitas Windows. Untuk akses kamera QR scanner, gunakan salah satu solusi berikut:

### **Solusi 1: Chrome Flags (Recommended)**
1. **Buka Chrome** dengan command:
   ```bash
   chrome.exe --unsafely-treat-insecure-origin-as-secure=http://localhost:5173 --user-data-dir="C:\temp\chrome-dev"
   ```
2. **Atau manual**:
   - Buka `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
   - Enable flag tersebut
   - Add `http://localhost:5173` ke daftar
   - Restart Chrome

### **Solusi 2: Firefox**
Firefox lebih permisif dengan HTTP localhost:
1. Buka `about:config`
2. Set `media.devices.insecure.http` ke `true`
3. Restart Firefox

### **Solusi 3: Build Production**
```bash
npm run build
npm run preview
```
Gunakan web server dengan HTTPS (nginx, apache, dll.)

### **Solusi 4: Manual HTTPS Setup**
```bash
# Install mkcert untuk development certificates
npm install -g mkcert
mkcert -install
mkcert localhost

# Update vite.config.js:
server: {
  https: {
    key: './localhost-key.pem',
    cert: './localhost.pem'
  }
}
```

### **Testing Camera Access**
1. Buka aplikasi di browser
2. Menu **Absensi** → **QR Scan**
3. Klik **"Open Scanner in New Tab"**
4. **Pilih kamera** (depan/belakang) jika tersedia
5. Browser akan minta permission kamera
6. ✅ Jika berhasil: Camera aktif untuk scanning
7. ❌ Jika gagal: Gunakan solusi di atas

### **Fitur Kamera**
- ✅ **Auto-deteksi** kamera yang tersedia
- ✅ **Pilih kamera** depan/belakang
- ✅ **Switch real-time** tanpa restart
- ✅ **Fallback** ke kamera default jika hanya 1 kamera
- ✅ **Anti-duplikasi** scan dengan cooldown 3 detik
- ✅ **Visual feedback** saat processing scan
- ✅ **Full screen** tanpa sidebar untuk scanning optimal
- ✅ **Responsive** qrbox yang menyesuaikan layar
- ✅ **Single camera display** - tidak ada duplikasi tampilan kamera
- ✅ **Thorough cleanup** DOM elements saat switch kamera
- ✅ **Container content clearing** untuk clean state tanpa recreation
- ✅ **Initialization locking** mencegah multiple scanner instances
- ✅ **Proper camera ID handling** menggunakan actual device IDs
- ✅ **Sequential initialization** setelah camera detection
- ✅ **DOM readiness checking** dengan useRef untuk guaranteed availability
- ✅ **useEffect after render** untuk proper React lifecycle
- ✅ **DOM settlement delay** untuk memastikan element fully available
- ✅ **Double verification** dengan ref dan getElementById
- ✅ **Simple and reliable** approach tanpa complex timing
- ✅ **Stable DOM element** dengan content clearing instead of recreation
- ✅ **Async scanner cleanup** dengan proper timing delays
- ✅ **Sequential camera switching** dengan guaranteed cleanup completion
- ✅ **React best practices** dengan useRef untuk DOM access
- ✅ **Continuous scanning mode** untuk quickscan tanpa berhenti
- ✅ **Duplicate prevention** dengan session-based tracking
- ✅ **Smart notifications** - animated custom dialog untuk duplicate, toast untuk success
- ✅ **Animated UI components** - bounce-in animations untuk semua dialog
- ✅ **Real-time scan counter** untuk monitoring progress

### **Quick Start dengan Camera (Windows)**
```bash
# Jalankan batch file untuk auto-setup Chrome
run-dev.bat
```

**Apa yang dilakukan script:**
- ✅ Membuka Chrome dengan flags camera access
- ✅ Profile terpisah untuk development
- ✅ Auto-navigate ke aplikasi
- ✅ Siap test QR scanner langsung

### **Manual Testing Steps**
1. **Terminal 1**: `npm run dev` (start server)
2. **Terminal 2**: `run-dev.bat` (buka Chrome)
3. **App**: Menu Absensi → QR Scan
4. **Test**: Generate QR code di menu Data Guru/Siswa
5. **Scan**: Gunakan kamera untuk scan QR

### Build for Production
```bash
npm run build
npm run preview
```

## 📱 Cara Penggunaan

### 1. Setup Data Awal
1. Buka menu **Database**
2. Import data guru/siswa via Excel atau input manual
3. Setup pengaturan waktu absensi

### 2. Generate QR Code
1. Buka menu **Data Guru** atau **Data Siswa**
2. Klik **"Generate QR"** pada user yang diinginkan
3. QR code akan muncul dalam modal

### 3. Absensi Harian
1. Buka menu **Absensi** → **QR Scan**
2. Klik **"Open Scanner in New Tab"**
3. Scan QR code user dengan kamera
4. Status otomatis tercatat berdasarkan waktu

### 4. Monitoring & Laporan
1. **Dashboard**: Lihat statistik real-time
2. **Absen Hari Ini**: Monitor absensi harian
3. **Rekapan Absen**: Lihat history lengkap
4. Export data ke Excel jika diperlukan

## 🔧 Konfigurasi Status Absensi

### Default Settings Guru:
- **06:00 - 07:30**: Tepat Waktu
- **07:30 - 08:00**: Terlambat Tahap 1
- **08:00 - 15:00**: Terlambat Tahap 2
- **15:00 - 17:00**: Pulang

### Default Settings Siswa:
- **06:00 - 07:30**: Tepat Waktu
- **07:30 - 08:00**: Terlambat Tahap 1
- **08:00 - 12:00**: Terlambat Tahap 2
- **12:00 - 17:00**: Pulang

## 📋 Troubleshooting

### Data Tidak Muncul
1. Cek apakah data sudah di-import dengan benar
2. Refresh halaman browser
3. Clear browser cache jika perlu

### QR Code Tidak Terbaca
1. Pastikan pencahayaan cukup
2. Jaga jarak 20-30cm dari kamera
3. Hindari pantulan cahaya

### Sinkronisasi Gagal
1. Pastikan file backup valid (.json format)
2. Cek ukuran file tidak terlalu besar
3. Import satu per satu jika gagal bulk

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 📞 Support

Jika ada pertanyaan atau masalah:
1. Cek dokumentasi ini terlebih dahulu
2. Lihat bagian Troubleshooting
3. Buat issue di repository jika diperlukan

---

**⚠️ Important**: Selalu lakukan backup data secara berkala untuk menghindari kehilangan data penting!
