import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, IconButton, Select, MenuItem, FormControl, InputLabel, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Html5Qrcode } from 'html5-qrcode';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FlipCameraAndroidIcon from '@mui/icons-material/FlipCameraAndroid';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import { useNavigate } from 'react-router-dom';
import { db } from '../database';
import AnimatedDialog from './AnimatedDialog';

// Add mobile viewport fixes
const mobileViewportStyles = `
  /* Fix for mobile viewport height issues */
  .mobile-camera-container {
    height: 100dvh !important;
    height: 100vh !important;
  }

  /* iOS Safari specific fixes */
  @supports (-webkit-touch-callout: none) {
    .mobile-camera-container {
      height: -webkit-fill-available !important;
      min-height: 100vh !important;
    }
  }

  /* Ensure camera video fills container */
  #qr-reader video {
    object-fit: cover !important;
    width: 100% !important;
    height: 100% !important;
  }

  /* Prevent zoom on input focus (iOS) */
  #qr-reader {
    touch-action: manipulation;
  }
`;

const Scan = () => {
  const [scanResult, setScanResult] = useState('');
  const [scanMode, setScanMode] = useState('normal');
  const [selectedCamera, setSelectedCamera] = useState('');
  const [cameras, setCameras] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [processedCodes, setProcessedCodes] = useState(new Set());
  const [scanCount, setScanCount] = useState(0);
  const [duplicateDialog, setDuplicateDialog] = useState({ open: false, nama: '', status: '', att: '' });
  const [mirrorMode, setMirrorMode] = useState(true); // Default mirror mode enabled
  const [scannerSize, setScannerSize] = useState(3); // 0: Kecil, 1: Sedang, 2: Besar, 3: FULL (default)
  const html5QrCodeRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Read scan mode from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode') || 'normal';
    setScanMode(mode);

    // Get available cameras
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length) {
        setCameras(devices);
        // Auto-select back camera if available, otherwise first available camera
        const backCamera = devices.find(device =>
          device.label.toLowerCase().includes('back') ||
          device.label.toLowerCase().includes('environment') ||
          device.label.toLowerCase().includes('rear')
        );
        const selectedDevice = backCamera || devices[0];
        setSelectedCamera(selectedDevice.id);
      }
    }).catch(err => {
      console.error('Error getting cameras:', err);
    });

    // Handle window resize for responsive scanner sizing
    const handleResize = () => {
      if (isScanning) {
        // Restart scanner with new dimensions when window resizes
        stopScanning().then(() => {
          startScanning(selectedCamera);
        });
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      stopScanning();
    };
  }, []);

  // Start scanning when camera is selected
  useEffect(() => {
    if (selectedCamera && !isScanning) {
      startScanning(selectedCamera);
    }
  }, [selectedCamera, isScanning]);

  const startScanning = async (cameraId) => {
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("qr-reader");
      }

      const scannerConfig = getScannerConfig(scannerSize);
      const config = {
        fps: 10,
        qrbox: scannerConfig.qrbox,
        aspectRatio: window.innerWidth / window.innerHeight
      };

      await html5QrCodeRef.current.start(
        cameraId,
        config,
        onScanSuccess,
        onScanFailure
      );

      setIsScanning(true);
    } catch (error) {
      console.error('Failed to start scanner:', error);
    }
  };

  const stopScanning = async () => {
    try {
      if (html5QrCodeRef.current && isScanning) {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
        setIsScanning(false);
      }
    } catch (error) {
      console.warn('Error stopping scanner:', error);
    }
  };

  const onScanSuccess = async (decodedText) => {

    // Check if this code has already been processed in this session
    if (processedCodes.has(decodedText)) {

      // Find user to show name in duplicate message
      try {
        const [guru, siswa] = await Promise.all([
          db.guru.where('niy').equals(decodedText).first(),
          db.siswa.where('nisn').equals(decodedText).first()
        ]);
        const user = guru || siswa;

        if (user) {
          // Show intrusive popup for duplicates
          alert(`Maaf ${user.nama} telah absen`);
        } else {
          alert('Kode QR sudah dipindai sebelumnya');
        }
      } catch (error) {
        console.error('Error checking duplicate:', error);
        alert('Kode QR sudah dipindai sebelumnya');
      }
      return;
    }

    // Mark code as processed
    setProcessedCodes(prev => new Set([...prev, decodedText]));
    setScanResult(decodedText);
    setScanCount(prev => prev + 1);

    try {
      // Load users from db - check both guru and siswa tables
      const [guru, siswa] = await Promise.all([
        db.guru.where('niy').equals(decodedText).first(),
        db.siswa.where('nisn').equals(decodedText).first()
      ]);

      const user = guru || siswa;

      if (user) {
        if (user.status === 'active') {
          await recordAttendance(user);
          // Show non-intrusive notification for successful attendance
          showSuccessNotification(user.nama);
        } else {
          alert('Pengguna ditemukan tetapi status tidak aktif. Status: ' + user.status);
        }
      } else {
        // Show available identifiers for debugging
        const [activeGuru, activeSiswa] = await Promise.all([
          db.guru.where('status').equals('active').toArray(),
          db.siswa.where('status').equals('active').toArray()
        ]);

        alert(`Pengguna tidak ditemukan dengan identifier: ${decodedText}\n\nIdentifier yang ada di database:\nGuru: ${activeGuru.map(g => g.niy).join(', ')}\nSiswa: ${activeSiswa.map(s => s.nisn).join(', ')}\n\nPastikan QR code cocok dengan salah satu identifier di atas.`);
      }
    } catch (error) {
      console.error('Error during scan processing:', error);
      alert('Terjadi kesalahan saat memproses scan: ' + error.message);
    }

    // Scanner stays running for continuous scanning
  };

  const onScanFailure = (error) => {
    // Only log errors, don't show to user as it's normal for failed scans
    console.debug('Scan attempt failed:', error);
  };

  // Calculate attendance status and type based on time and user type
  const calculateAttendanceStatus = async (currentTime, userType) => {
    const currentMinutes = timeToMinutes(currentTime);

    try {
      // Try to get settings from database
      const settings = await db.attendance_settings.where('type').equals(userType.toLowerCase()).toArray();
      if (settings.length > 0) {
        for (const setting of settings) {
          const startMinutes = timeToMinutes(setting.start_time);
          const endMinutes = timeToMinutes(setting.end_time);
          if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
            return { keterangan: setting.label, att: setting.att };
          }
        }
      }
    } catch (error) {
      console.warn('Using default attendance settings:', error);
    }

    // Fallback to default settings if database settings not available
    const defaultSettings = userType.toLowerCase() === 'guru' ? [
      { start_time: '06:00', end_time: '07:30', att: 'Datang', label: 'Tepat Waktu' },
      { start_time: '07:30', end_time: '08:00', att: 'Datang', label: 'Tahap 1' },
      { start_time: '08:00', end_time: '15:00', att: 'Datang', label: 'Tahap 2' },
      { start_time: '15:00', end_time: '17:00', att: 'Pulang', label: 'Pulang' }
    ] : [
      { start_time: '06:00', end_time: '07:30', att: 'Datang', label: 'Tepat Waktu' },
      { start_time: '07:30', end_time: '08:00', att: 'Datang', label: 'Tahap 1' },
      { start_time: '08:00', end_time: '12:00', att: 'Datang', label: 'Tahap 2' },
      { start_time: '12:00', end_time: '17:00', att: 'Pulang', label: 'Pulang' }
    ];

    for (const setting of defaultSettings) {
      const startMinutes = timeToMinutes(setting.start_time);
      const endMinutes = timeToMinutes(setting.end_time);
      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return { keterangan: setting.label, att: setting.att };
      }
    }

    return { keterangan: 'Diluar Jadwal', att: 'Datang' };
  };

  // Fallback: Open WhatsApp Web with pre-filled message
  const sendWhatsAppViaWeb = (user, today, currentTime, status, keterangan) => {
    const message = `🌟 Assalamu'alaikum ${user.nama} 🌟

✅ Anda telah berhasil *ABSEN*
📅 Tanggal : ${today}
🕒 Pukul : ${currentTime}
📌 Status : ${att}
📝 Keterangan : ${keterangan}

Terima kasih atas perhatian Anda 🙏`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${user.wa}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');

    alert(`✅ Membuka WhatsApp Web untuk ${user.nama}\n\nPesan akan terkirim setelah Anda klik "Kirim" di WhatsApp Web.`);
  };

  // Send WhatsApp message using Whacenter API
  const sendWhatsAppMessage = async (user, today, currentTime, status, keterangan) => {
    const deviceId = '9b33e3a9-e9ff-4f8b-a62a-90b5eee3f946';
    let number = user.wa;

    if (!number || number.trim() === '') {
      console.warn('Phone number is empty, skipping WhatsApp message');
      return;
    }

    // Convert Indonesian phone numbers to international format
    if (number.startsWith('0')) {
      number = '62' + number.substring(1);
    } else if (number.startsWith('+62')) {
      number = number.substring(1);
    }

    const message = `🌟 Assalamu'alaikum ${user.nama} 🌟

✅ Anda telah berhasil *ABSEN*
📅 Tanggal : ${today}
🕒 Pukul : ${currentTime}
📌 Status : ${status}
📝 Keterangan : ${keterangan}

Terima kasih atas perhatian Anda 🙏`;

    const payload = {
      device_id: deviceId,
      number: number,
      message: message
    };

    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        // WhatsApp message sent successfully
      } else {
        console.warn(`Failed to send WhatsApp to ${user.nama}: ${response.statusText}`);
        // Fallback to WhatsApp Web on API failure
        sendWhatsAppViaWeb(user, today, currentTime, status, keterangan);
      }
    } catch (error) {
      console.warn(`Error sending WhatsApp to ${user.nama}:`, error.message);
      // Fallback to WhatsApp Web on network error
      sendWhatsAppViaWeb(user, today, currentTime, status, keterangan);
    }
  };

  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const checkDuplicateAttendance = async (identifier, today, currentAtt) => {
    const todayAttendance = await db.attendance.where('identifier').equals(identifier).and(a => a.tanggal === today && a.att === currentAtt).toArray();
    // Prevent duplicate entries for the same Att type (Datang/Pulang)
    return todayAttendance.length > 0;
  };

  const showSuccessNotification = (nama) => {
    // Create a temporary notification that disappears after 3 seconds
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4caf50;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: 'Roboto', sans-serif;
      font-size: 16px;
      font-weight: 500;
      animation: slideIn 0.3s ease-out;
    `;
    notification.innerHTML = `✅ ${nama} absen diterima`;

    // Add slide-in animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideIn 0.3s ease-in reverse';
      setTimeout(() => {
        document.body.removeChild(notification);
        document.head.removeChild(style);
      }, 300);
    }, 3000);
  };


  const recordAttendance = async (user) => {
    const today = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().split(' ')[0];

    let status, keterangan, att;

    if (scanMode === 'early_departure') {
      status = 'Pulang';
      keterangan = 'Pulang';
      att = 'Pulang';
    } else {
      const result = await calculateAttendanceStatus(currentTime, user.sebagai);
      status = result.att; // Use att as status since we removed status field
      keterangan = result.keterangan;
      att = result.att;
    }

    const isDuplicate = await checkDuplicateAttendance(user.niy || user.nisn, today, att);

    if (isDuplicate) {
      const lastEntry = await db.attendance.where('identifier').equals(user.niy || user.nisn).and(a => a.tanggal === today && a.att === att).last();
      // Show custom blocking dialog for duplicate attendance
      setDuplicateDialog({ open: true, nama: user.nama, status: lastEntry?.status || 'Unknown', att });
      return;
    }

    const newEntry = {
      tanggal: today,
      identifier: user.niy || user.nisn,
      nama: user.nama,
      jabatan: user.jabatan,
      jam: currentTime,
      status: status,
      keterangan: keterangan,
      sebagai: user.sebagai,
      wa: user.wa,
      email: user.email,
      att: att,
    };

    await db.attendance.add(newEntry);

    // Send WhatsApp message after successful recording
    sendWhatsAppMessage(user, today, currentTime, status, keterangan);

    // Don't navigate away - stay in continuous scan mode
  };

  const handleCameraChange = async (cameraId) => {

    // Stop current scanning
    await stopScanning();

    // Reset scan result but keep processed codes and count
    setScanResult('');

    // Start with new camera
    setSelectedCamera(cameraId);
  };

  const getCameraLabel = (camera) => {
    if (camera.label.toLowerCase().includes('back') || camera.label.toLowerCase().includes('environment')) {
      return '📷 Kamera Belakang';
    } else if (camera.label.toLowerCase().includes('front') || camera.label.toLowerCase().includes('user')) {
      return '📱 Kamera Depan';
    } else {
      return camera.label || `Camera ${camera.id}`;
    }
  };

  const getScannerConfig = (size) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const aspectRatio = viewportWidth / viewportHeight;

    // Responsive sizing based on screen orientation
    let baseSize;
    if (aspectRatio > 1) {
      // Landscape (16:9)
      baseSize = Math.min(viewportWidth * 0.6, viewportHeight * 0.8);
    } else {
      // Portrait (9:16)
      baseSize = Math.min(viewportWidth * 0.8, viewportHeight * 0.6);
    }

    const configs = [
      { qrbox: { width: Math.floor(baseSize * 0.3), height: Math.floor(baseSize * 0.3) }, label: 'KECIL' }, // 0: Kecil - 30% of responsive base
      { qrbox: { width: Math.floor(baseSize * 0.5), height: Math.floor(baseSize * 0.5) }, label: 'SEDANG' }, // 1: Sedang - 50% of responsive base
      { qrbox: { width: Math.floor(baseSize * 0.7), height: Math.floor(baseSize * 0.7) }, label: 'BESAR' }, // 2: Besar - 70% of responsive base
      { qrbox: { width: Math.floor(baseSize * 0.9), height: Math.floor(baseSize * 0.9) }, label: 'FULL' } // 3: Full - 90% of responsive base (almost full screen)
    ];
    return configs[size];
  };

  const cycleScannerSize = async () => {
    const newSize = (scannerSize + 1) % 4; // Cycle through 0, 1, 2, 3
    setScannerSize(newSize);

    // Restart scanner with new size
    if (isScanning) {
      await stopScanning();
      await startScanning(selectedCamera);
    }
  };

  const getScannerSizeLabel = () => {
    const labels = ['KECIL', 'SEDANG', 'BESAR', 'FULL'];
    return labels[scannerSize];
  };

  return (
    <>
      {/* Inject mobile viewport styles */}
      <style>{mobileViewportStyles}</style>

      <Box sx={{
        height: '100dvh', // Use dynamic viewport height for mobile
        width: '100vw',
        position: 'fixed',
        top: 0,
        left: 0,
        bgcolor: 'black',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // Mobile-specific fixes
        '@supports (-webkit-touch-callout: none)': {
          height: '-webkit-fill-available',
          minHeight: '100vh'
        }
      }}>
      {/* Full Screen Scanner */}
      <Box sx={{
        flexGrow: 1,
        position: 'relative',
        width: '100vw',
        height: '100dvh', // Use dynamic viewport height for mobile
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Mobile-specific fixes
        '@supports (-webkit-touch-callout: none)': {
          height: '-webkit-fill-available',
          minHeight: '100vh'
        }
      }}>
        <div
          id="qr-reader"
          className="mobile-camera-container"
          style={{
            width: '100vw',
            height: '100dvh', // Use dynamic viewport height for mobile
            position: 'absolute',
            top: 0,
            left: 0,
            transform: mirrorMode ? 'scaleX(-1)' : 'none',
            transition: 'transform 0.3s ease-in-out'
          }}
        ></div>

        {/* Floating Control Buttons */}
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: 10
        }}>
          {/* Top Left - Back Button */}
          <Box sx={{ position: 'absolute', top: 20, left: 20, pointerEvents: 'auto' }}>
            <IconButton
              onClick={() => navigate('/absensi')}
              sx={{
                bgcolor: 'rgba(0,0,0,0.7)',
                color: 'white',
                border: '2px solid rgba(255,255,255,0.3)',
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  bgcolor: 'rgba(0,0,0,0.9)',
                  transform: 'scale(1.1)'
                },
                transition: 'all 0.2s ease-in-out'
              }}
              size="large"
            >
              <ArrowBackIcon fontSize="large" />
            </IconButton>
          </Box>

          {/* Top Right - Control Buttons */}
          <Box sx={{
            position: 'absolute',
            top: 20,
            right: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            pointerEvents: 'auto'
          }}>
            {/* Mirror Toggle */}
            <IconButton
              onClick={() => setMirrorMode(!mirrorMode)}
              sx={{
                bgcolor: mirrorMode ? 'primary.main' : 'rgba(0,0,0,0.7)',
                color: 'white',
                border: '2px solid rgba(255,255,255,0.3)',
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  transform: 'scale(1.1)',
                  bgcolor: mirrorMode ? 'primary.dark' : 'rgba(0,0,0,0.9)'
                },
                transition: 'all 0.2s ease-in-out'
              }}
              size="large"
              title={mirrorMode ? 'Nonaktifkan Mirror' : 'Aktifkan Mirror'}
            >
              <FlipCameraAndroidIcon />
            </IconButton>

            {/* Scanner Size Toggle */}
            <IconButton
              onClick={cycleScannerSize}
              sx={{
                bgcolor: 'rgba(0,0,0,0.7)',
                color: 'white',
                border: '2px solid rgba(255,255,255,0.3)',
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  transform: 'scale(1.1)',
                  bgcolor: 'rgba(0,0,0,0.9)'
                },
                transition: 'all 0.2s ease-in-out',
                position: 'relative'
              }}
              size="large"
              title={`Ukuran: ${getScannerSizeLabel()}`}
            >
              <CropSquareIcon />
              <Box sx={{
                position: 'absolute',
                top: -8,
                right: -8,
                bgcolor: 'primary.main',
                color: 'white',
                borderRadius: '50%',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.6rem',
                fontWeight: 'bold',
                border: '2px solid white'
              }}>
                {scannerSize + 1}
              </Box>
            </IconButton>

            {/* Camera Switch */}
            {cameras.length > 1 && (
              <IconButton
                onClick={() => {
                  const currentIndex = cameras.findIndex(c => c.id === selectedCamera);
                  const nextIndex = (currentIndex + 1) % cameras.length;
                  handleCameraChange(cameras[nextIndex].id);
                }}
                sx={{
                  bgcolor: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  border: '2px solid rgba(255,255,255,0.3)',
                  backdropFilter: 'blur(10px)',
                  '&:hover': {
                    transform: 'scale(1.1)',
                    bgcolor: 'rgba(0,0,0,0.9)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
                size="large"
                title="Switch Camera"
              >
                📷
              </IconButton>
            )}

          </Box>

          {/* Bottom Center - Status & Counter */}
          <Box sx={{
            position: 'absolute',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            pointerEvents: 'auto'
          }}>
            <Box sx={{
              bgcolor: isScanning ? (scanMode === 'early_departure' ? 'rgba(255,152,0,0.9)' : 'rgba(25,118,210,0.9)') : 'rgba(158,158,158,0.9)',
              color: 'white',
              px: 4,
              py: 2,
              borderRadius: 3,
              backdropFilter: 'blur(10px)',
              border: '2px solid rgba(255,255,255,0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1
            }}>
              <Typography variant="h6" fontWeight="bold">
                {isScanning ? (scanMode === 'early_departure' ? '🚪 PULANG CEPAT' : '📱 SCANNING') : '⏸️ STOPPED'}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {scanMode === 'early_departure' ? 'Selalu record sebagai "Pulang"' : 'Datang/Pulang berdasarkan waktu'}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 'bold' }}>
                ✅ {scanCount} scan berhasil
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Scan Result Overlay */}
      {scanResult && (
        <Box sx={{
          position: 'absolute',
          bottom: 120,
          left: '50%',
          transform: 'translateX(-50%)',
          bgcolor: 'rgba(0,0,0,0.8)',
          color: 'white',
          px: 3,
          py: 1,
          borderRadius: 2,
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.2)',
          animation: 'fadeIn 0.3s ease-in-out'
        }}>
          <Typography variant="body2">
            📱 Scanned: {scanResult}
          </Typography>
        </Box>
      )}

      {/* Custom Duplicate Attendance Dialog */}
      <AnimatedDialog
        open={duplicateDialog.open}
        onClose={() => setDuplicateDialog({ open: false, nama: '', status: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          bgcolor: 'warning.main',
          color: 'white',
          textAlign: 'center',
          py: 3,
          fontWeight: 'bold'
        }}>
          ⚠️ Absensi Sudah Tercatat
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: 'text.primary' }}>
            {duplicateDialog.nama}
          </Typography>
          <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
            Sudah absen <strong>{duplicateDialog.att}</strong> hari ini
          </Typography>
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            alignItems: 'center'
          }}>
            <Box sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: 'warning.light',
              color: 'warning.contrastText',
              px: 3,
              py: 2,
              borderRadius: 2,
              fontWeight: 'bold'
            }}>
              📊 Status: {duplicateDialog.status}
            </Box>
            <Box sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: 'info.light',
              color: 'info.contrastText',
              px: 3,
              py: 1,
              borderRadius: 2,
              fontSize: '0.9rem'
            }}>
              🕒 Tipe: {duplicateDialog.att}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button
            onClick={() => setDuplicateDialog({ open: false, nama: '', status: '' })}
            variant="contained"
            size="large"
            sx={{
              minWidth: 120,
              fontWeight: 'bold',
              borderRadius: 2
            }}
          >
            Mengerti
          </Button>
        </DialogActions>
      </AnimatedDialog>
    </Box>
    </>
  );
};

export default Scan;