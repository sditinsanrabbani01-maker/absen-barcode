import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Alert } from '@mui/material';
import { Html5Qrcode } from 'html5-qrcode';
import {
  ArrowBack as ArrowBackIcon, FlipCameraAndroid as FlipCameraAndroidIcon, CropSquare as CropSquareIcon, QrCodeScanner, VolumeUp, VolumeOff,
  Cloud, Settings, Refresh, Error as ErrorIcon, CheckCircle
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { db } from '../database';
import { supabase, TABLES } from '../config/supabase';
import { useRealtime } from '../context/RealtimeContext';
import { DateTimeUtils } from '../utils/dateTime';
import { PerformanceService } from '../services/PerformanceService';

// Mobile viewport fixes
const mobileViewportStyles = `
  .mobile-camera-container {
    height: 100dvh !important;
    height: 100vh !important;
  }
  @supports (-webkit-touch-callout: none) {
    .mobile-camera-container {
      height: -webkit-fill-available !important;
      min-height: 100vh !important;
    }
  }
  #qr-reader video {
    object-fit: cover !important;
    width: 100% !important;
    height: 100% !important;
  }
  #qr-reader { touch-action: manipulation; }
`;

const Scan = () => {
  // Core state
  const [scanResult, setScanResult] = useState('');
  const [scanMode, setScanMode] = useState('normal');
  const [selectedCamera, setSelectedCamera] = useState('');
  const [cameras, setCameras] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [processedCodes, setProcessedCodes] = useState(new Set());
  const [scanCount, setScanCount] = useState(0);

  // UI state
  const [duplicateDialog, setDuplicateDialog] = useState({ open: false, nama: '', status: '', att: '' });
  const [mirrorMode, setMirrorMode] = useState(true);
  const [scannerSize, setScannerSize] = useState(3);
  const [beepEnabled, setBeepEnabled] = useState(true);

  // Refs
  const html5QrCodeRef = useRef(null);
  const audioContextRef = useRef(null);
  const navigate = useNavigate();
  const { subscribeToTable } = useRealtime();

  // Initialize audio context
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Play scanner beep sound
  const playBeepSound = useCallback(() => {
    if (!beepEnabled) return;

    try {
      const audioContext = initAudioContext();
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);

    } catch (error) {
      console.warn('Could not play beep sound:', error);
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    }
  }, [beepEnabled, initAudioContext]);

  // Initialize component
  useEffect(() => {
    initializeScanner();
    setupSubscriptions();
    preloadUserData();

    // Handle window resize
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      cleanup();
    };
  }, []);

  // Initialize scanner and camera
  const initializeScanner = async () => {
    try {
      // Read scan mode from URL
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode') || 'normal';
      setScanMode(mode);

      // Get available cameras
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length) {
        setCameras(devices);

        // Auto-select back camera
        const backCamera = devices.find(device =>
          device.label.toLowerCase().includes('back') ||
          device.label.toLowerCase().includes('environment') ||
          device.label.toLowerCase().includes('rear')
        );
        const selectedDevice = backCamera || devices[0];
        setSelectedCamera(selectedDevice.id);
      }
    } catch (error) {
      console.error('Error initializing scanner:', error);
    }
  };

  // Setup real-time subscriptions
  const setupSubscriptions = () => {
    console.log('📡 Setting up real-time attendance subscriptions...');

    const attendanceSubscription = subscribeToTable(TABLES.ATTENDANCE, (change) => {
      console.log('🔄 Real-time attendance change detected in Scan:', change);
    });

    // Store cleanup function
    window.attendanceSubscription = attendanceSubscription;
  };

  // Preload user data for faster scanning
  const preloadUserData = async () => {
    setTimeout(async () => {
      try {
        const count = await PerformanceService.preloadAllActiveUsers();
        if (count > 0) {
          console.log(`⚡ Preloaded ${count} users for faster scanning`);
        }
      } catch (error) {
        console.warn('Failed to preload user data:', error);
      }
    }, 2000);
  };

  // Cleanup function
  const cleanup = async () => {
    await stopScanning();
    if (window.attendanceSubscription) {
      window.attendanceSubscription.unsubscribe?.();
    }
  };

  // Start scanning when camera is selected
  useEffect(() => {
    if (selectedCamera && !isScanning) {
      startScanning(selectedCamera);
    }
  }, [selectedCamera, isScanning]);

  // Start scanning with optimized configuration
  const startScanning = useCallback(async (cameraId) => {
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("qr-reader");
      }

      const config = {
        fps: 30,
        qrbox: getScannerConfig(scannerSize).qrbox,
        aspectRatio: 1.0,
        experimentalFeatures: { useBarCodeDetectorIfSupported: false },
        supportedScanTypes: [Html5QrcodeSupportedFormats.QR_CODE],
        showTorchButtonIfSupported: true,
        showZoomSliderIfSupported: true,
        defaultZoomValueIfSupported: 2,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        useWebgl: false
      };

      await html5QrCodeRef.current.start(cameraId, config, onScanSuccess, onScanFailure);
      setIsScanning(true);
      console.log('🚀 Scanner started successfully');
    } catch (error) {
      console.error('Failed to start scanner:', error);
    }
  }, [scannerSize]);

  const stopScanning = useCallback(async () => {
    try {
      if (html5QrCodeRef.current && isScanning) {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
        setIsScanning(false);
      }
    } catch (error) {
      console.warn('Error stopping scanner:', error);
    }
  }, [isScanning]);

  // Handle window resize for responsive scanner sizing
  const handleResize = useCallback(() => {
    if (isScanning) {
      // Restart scanner with new dimensions when window resizes
      stopScanning().then(() => {
        startScanning(selectedCamera);
      });
    }
  }, [isScanning, stopScanning, startScanning, selectedCamera]);

  // Handle successful QR code scan
  const onScanSuccess = async (decodedText, decodedResult) => {
    const currentTime = Date.now();

    // Check for duplicates
    if (processedCodes.has(decodedText)) {
      const timeSinceLastScan = currentTime - lastScanTime;
      if (timeSinceLastScan > 600000) { // 10 minutes
        setProcessedCodes(new Set());
        console.log('🔄 Reset duplicate tracking after timeout');
      } else {
        try {
          const [guru, siswa] = await Promise.all([
            db.guru.where('niy').equals(decodedText).first(),
            db.siswa.where('nisn').equals(decodedText).first()
          ]);
          const user = guru || siswa;
          alert(user ? `Maaf ${user.nama} telah absen` : 'Kode QR sudah dipindai sebelumnya');
        } catch (error) {
          alert('Kode QR sudah dipindai sebelumnya');
        }
        return;
      }
    }

    // Mark as processed and update counters
    setProcessedCodes(prev => new Set([...prev, decodedText]));
    setScanResult(decodedText);
    setScanCount(prev => prev + 1);
    setLastScanTime(currentTime);

    console.log('✅ QR Code decoded:', decodedText);

    try {
      // Fast user lookup with caching
      let user = await PerformanceService.getCachedUser(decodedText);

      if (!user && enhancedMode) {
        // Fallback to fuzzy matching for damaged QR codes
        const allUsers = await Promise.all([
          db.guru.where('status').equals('active').toArray(),
          db.siswa.where('status').equals('active').toArray()
        ]);

        const allActiveUsers = [...allUsers[0], ...allUsers[1]];
        const similarUsers = allActiveUsers.filter(u => {
          const identifier = u.niy || u.nisn;
          return identifier && calculateStringSimilarity(identifier, decodedText) > 0.7;
        });

        if (similarUsers.length === 1) {
          user = similarUsers[0];
          console.log('🎯 Found similar match:', user.nama);
        }
      }

      if (user && user.status === 'active') {
        await recordAttendance(user);
        showSuccessNotification(user.nama);
      } else if (user) {
        alert('Pengguna ditemukan tetapi status tidak aktif. Status: ' + user.status);
      } else {
        const [activeGuru, activeSiswa] = await Promise.all([
          db.guru.where('status').equals('active').toArray(),
          db.siswa.where('status').equals('active').toArray()
        ]);

        const suggestions = [];
        activeGuru.slice(0, 3).forEach(g => suggestions.push(`Guru: ${g.niy} - ${g.nama}`));
        activeSiswa.slice(0, 3).forEach(s => suggestions.push(`Siswa: ${s.nisn} - ${s.nama}`));

        alert(`❌ Pengguna tidak ditemukan: ${decodedText}\n\n💡 Pastikan QR code tidak buram.\n\n📋 Contoh valid:\n${suggestions.join('\n')}`);
      }
    } catch (error) {
      console.error('Error processing scan:', error);
      alert('Terjadi kesalahan: ' + error.message);
    }
  };

  // Handle scan failure
  const onScanFailure = (error) => {
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



  // Send WhatsApp message using Whacenter API
  const sendWhatsAppMessage = async (user, today, currentTime, status, keterangan) => {
    // Ensure we're using local time for WhatsApp message
    const localTime = DateTimeUtils.getLocalTime();
    console.log('📱 Sending WhatsApp with local time:', {
      originalTime: currentTime,
      localTime: localTime,
      user: user.nama
    });
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

    // Use local time for WhatsApp Web fallback
    const localTimeForWeb = DateTimeUtils.getLocalTime();
    const message = `🌟 Assalamu'alaikum ${user.nama} 🌟

✅ Anda telah berhasil *ABSEN*
📅 Tanggal : ${today}
🕒 Pukul : ${localTimeForWeb} WITA
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

  // Fallback function to send WhatsApp via web interface
  const sendWhatsAppViaWeb = (user, today, currentTime, status, keterangan) => {
    if (!user.wa) {
      console.warn('No phone number available for WhatsApp Web fallback');
      return;
    }

    // Convert Indonesian phone numbers to international format
    let number = user.wa;
    if (number.startsWith('0')) {
      number = '62' + number.substring(1);
    } else if (number.startsWith('+62')) {
      number = number.substring(1);
    }

    // Use local time for WhatsApp message
    const localTime = DateTimeUtils.getLocalTime();
    const message = `🌟 Assalamu'alaikum ${user.nama} 🌟

✅ Anda telah berhasil *ABSEN*
📅 Tanggal : ${today}
🕒 Pukul : ${localTime} WITA
📌 Status : ${status}
📝 Keterangan : ${keterangan}

Terima kasih atas perhatian Anda 🙏`;

    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${number}?text=${encodedMessage}`;

    // Open WhatsApp Web in new window/tab
    window.open(whatsappUrl, '_blank');
  };

  const checkDuplicateAttendance = async (identifier, today, currentAtt) => {
    try {
      // Use PerformanceService for faster duplicate checking
      const attendanceRecords = await PerformanceService.getCachedAttendance(identifier, today);

      // Filter by attendance type
      const duplicateRecords = attendanceRecords.filter(record => record.att === currentAtt);

      if (duplicateRecords.length > 0) {
        console.log('🚫 Duplicate attendance found:', duplicateRecords.length, 'records');
        return true;
      }

      return false;

    } catch (error) {
      console.error('Error checking duplicate attendance:', error);
      // Fallback to local database only
      try {
        const todayAttendance = await db.attendance
          .where('identifier').equals(identifier)
          .and(a => a.tanggal === today && a.att === currentAtt)
          .toArray();

        return todayAttendance.length > 0;
      } catch (localError) {
        console.error('Local duplicate check also failed:', localError);
        return false;
      }
    }
  };

  // Show success notification
  // Show success notification
  const showSuccessNotification = (nama, syncStatus = 'success') => {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${syncStatus === 'success' ? '#4caf50' : '#ff9800'};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: 'Roboto', sans-serif;
      font-size: 14px;
      font-weight: 500;
      max-width: 300px;
    `;

    const syncIcon = syncStatus === 'success' ? '☁️' : '💾';
    const syncText = syncStatus === 'success' ? 'Tersinkronisasi' : 'Lokal';
    const currentTime = DateTimeUtils.getLocalTime();

    notification.innerHTML = `
      ✅ ${nama}<br>
      <small style="opacity: 0.9">${syncIcon} ${syncText}</small><br>
      <small style="opacity: 0.7">🕐 ${currentTime} WITA</small>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      document.body.removeChild(notification);
    }, 4000);
  };


  // Record attendance with real-time sync
  // Record attendance with real-time sync
  const recordAttendance = async (user) => {
    const today = DateTimeUtils.getLocalDate();
    const currentTime = DateTimeUtils.getLocalTime();

    console.log('📅 Recording attendance:', { date: today, time: currentTime, user: user.nama });

    // Determine attendance status
    let status, keterangan, att;
    if (scanMode === 'early_departure') {
      status = 'Pulang';
      keterangan = 'Pulang';
      att = 'Pulang';
    } else {
      const result = await calculateAttendanceStatus(currentTime, user.sebagai);
      status = result.att;
      keterangan = result.keterangan;
      att = result.att;
    }

    // Check for duplicates
    const isDuplicate = await checkDuplicateAttendance(user.niy || user.nisn, today, att);
    if (isDuplicate) {
      const lastEntry = await db.attendance
        .where('identifier').equals(user.niy || user.nisn)
        .and(a => a.tanggal === today && a.att === att)
        .last();
      setDuplicateDialog({ open: true, nama: user.nama, status: lastEntry?.status || 'Unknown', att });
      return;
    }

    // Create attendance record
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      // Save to Supabase first
      const { data: supabaseResult, error: supabaseError } = await supabase
        .from(TABLES.ATTENDANCE)
        .insert(newEntry)
        .select()
        .single();

      if (supabaseError) throw new Error('Failed to save to Supabase: ' + supabaseError.message);

      // Save to local database
      await db.attendance.add({
        ...newEntry,
        id: supabaseResult?.id
      });

      console.log('✅ Attendance recorded successfully');

      // Send WhatsApp notification
      sendWhatsAppMessage(user, today, currentTime, status, keterangan);
      showSuccessNotification(`${user.nama} - ${status} (${keterangan})`, 'success');

    } catch (error) {
      console.error('❌ Error recording attendance:', error);

      // Fallback to local only
      try {
        await db.attendance.add(newEntry);
        sendWhatsAppMessage(user, today, currentTime, status, keterangan);
        showSuccessNotification(`${user.nama} - ${status} (Local)`, 'local');
      } catch (localError) {
        alert('❌ Gagal menyimpan absensi: ' + error.message);
      }
    }
  };

  // Handle camera change
  const handleCameraChange = async (cameraId) => {
    await stopScanning();
    setScanResult('');
    setSelectedCamera(cameraId);
  };

  // Get scanner configuration based on size
  const getScannerConfig = (size) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const aspectRatio = viewportWidth / viewportHeight;

    let baseSize;
    if (aspectRatio > 1) {
      baseSize = Math.min(viewportWidth * 0.9, viewportHeight * 0.95);
    } else {
      baseSize = Math.min(viewportWidth * 0.95, viewportHeight * 0.9);
    }

    const configs = [
      { qrbox: { width: Math.floor(baseSize * 0.4), height: Math.floor(baseSize * 0.4) }, label: 'KECIL' },
      { qrbox: { width: Math.floor(baseSize * 0.6), height: Math.floor(baseSize * 0.6) }, label: 'SEDANG' },
      { qrbox: { width: Math.floor(baseSize * 0.8), height: Math.floor(baseSize * 0.8) }, label: 'BESAR' },
      { qrbox: { width: Math.floor(baseSize * 0.95), height: Math.floor(baseSize * 0.95) }, label: 'FULL' }
    ];
    return configs[size];
  };

  // Cycle through scanner sizes
  const cycleScannerSize = async () => {
    const newSize = (scannerSize + 1) % 4;
    setScannerSize(newSize);

    if (isScanning) {
      await stopScanning();
      await startScanning(selectedCamera);
    }
  };

  // Get scanner size label
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

        {/* QR Code Scanning Guide Overlay */}
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 5
        }}>
          {(() => {
            const currentConfig = getScannerConfig(scannerSize);
            return (
              <Box sx={{
                width: currentConfig.qrbox.width,
                height: currentConfig.qrbox.height,
                border: '3px solid #4caf50',
                borderRadius: 2,
                position: 'relative',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                background: 'transparent'
              }}>
            {/* Corner indicators */}
            <Box sx={{
              position: 'absolute',
              top: -2,
              left: -2,
              width: 20,
              height: 20,
              borderTop: '4px solid #4caf50',
              borderLeft: '4px solid #4caf50',
              borderTopLeftRadius: 8
            }} />
            <Box sx={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 20,
              height: 20,
              borderTop: '4px solid #4caf50',
              borderRight: '4px solid #4caf50',
              borderTopRightRadius: 8
            }} />
            <Box sx={{
              position: 'absolute',
              bottom: -2,
              left: -2,
              width: 20,
              height: 20,
              borderBottom: '4px solid #4caf50',
              borderLeft: '4px solid #4caf50',
              borderBottomLeftRadius: 8
            }} />
            <Box sx={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 20,
              height: 20,
              borderBottom: '4px solid #4caf50',
              borderRight: '4px solid #4caf50',
              borderBottomRightRadius: 8
            }} />

            {/* Center guide text */}
            <Box sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#4caf50',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              textAlign: 'center',
              background: 'rgba(0, 0, 0, 0.7)',
              px: 1,
              py: 0.5,
              borderRadius: 1
            }}>
              QR CODE
            </Box>
              </Box>
            );
          })()}
        </Box>

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

          {/* Connection Status */}
          <IconButton
            onClick={async () => {
              try {
                const { data, error } = await supabase.from(TABLES.ATTENDANCE).select('count').limit(1);
                if (error) {
                  alert('❌ Koneksi Supabase gagal!\n\nError: ' + error.message);
                } else {
                  alert('✅ Koneksi Supabase berhasil!\n\nReal-time sync aktif untuk absensi.');
                }
              } catch (error) {
                alert('❌ Error testing connection: ' + error.message);
              }
            }}
            sx={{
              bgcolor: 'rgba(0,0,0,0.7)',
              color: 'white',
              border: '2px solid rgba(76, 175, 80, 0.8)',
              backdropFilter: 'blur(10px)',
              '&:hover': {
                transform: 'scale(1.1)',
                bgcolor: 'rgba(0,0,0,0.9)'
              },
              transition: 'all 0.2s ease-in-out'
            }}
            size="large"
            title="Test Supabase Connection"
          >
            ☁️
          </IconButton>

          {/* Beep Sound Toggle */}
          <IconButton
            onClick={() => setBeepEnabled(!beepEnabled)}
            sx={{
              bgcolor: beepEnabled ? 'warning.main' : 'rgba(0,0,0,0.7)',
              color: 'white',
              border: '2px solid rgba(255,255,255,0.3)',
              backdropFilter: 'blur(10px)',
              '&:hover': {
                transform: 'scale(1.1)',
                bgcolor: beepEnabled ? 'warning.dark' : 'rgba(0,0,0,0.9)'
              },
              transition: 'all 0.2s ease-in-out'
            }}
            size="large"
            title={beepEnabled ? 'Nonaktifkan Suara Beep' : 'Aktifkan Suara Beep'}
          >
            {beepEnabled ? '🔊' : '🔇'}
          </IconButton>

          {/* Cache Management */}
          <IconButton
            onClick={() => {
              const metrics = PerformanceService.getPerformanceMetrics();
              const action = confirm(
                `📊 Performance Metrics:\n` +
                `• Cache Size: ${metrics.cacheSize} users\n` +
                `• Cache Hit Rate: ${metrics.cacheHitRate}\n` +
                `• Total Lookups: ${metrics.totalLookups}\n` +
                `• Average Lookup Time: ${metrics.averageLookupTime.toFixed(2)}ms\n\n` +
                `⚡ Clear cache to free memory?`
              );
              if (action) {
                PerformanceService.clearCache();
                alert('✅ Cache cleared! Performance metrics reset.');
              }
            }}
            sx={{
              bgcolor: 'rgba(0,0,0,0.7)',
              color: 'white',
              border: '2px solid rgba(76, 175, 80, 0.8)',
              backdropFilter: 'blur(10px)',
              '&:hover': {
                transform: 'scale(1.1)',
                bgcolor: 'rgba(0,0,0,0.9)'
              },
              transition: 'all 0.2s ease-in-out'
            }}
            size="large"
            title="View Performance Metrics & Clear Cache"
          >
            ⚡
          </IconButton>

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
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 'bold' }}>
                  ✅ {scanCount} scan berhasil
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 'bold', color: 'success.main' }}>
                  ☁️ Real-time Sync
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 'bold', color: 'info.main' }}>
                  ⚡ Cache: {PerformanceService.userCache.size}
                </Typography>
                {beepEnabled && (
                  <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 'bold', color: 'warning.main' }}>
                    🔊 Beep Sound Aktif
                  </Typography>
                )}
                {enhancedMode && (
                  <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 'bold', color: 'success.main' }}>
                    🎯 Mode Sensitif Aktif
                  </Typography>
                )}
                {retryCount > 0 && (
                  <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 'bold', color: 'warning.main' }}>
                    🔄 Retry: {retryCount}/{maxRetries}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Enhanced Mode Guidance */}
      {enhancedMode && (
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 4
        }}>
          <Box sx={{
            position: 'absolute',
            top: -60,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'rgba(76, 175, 80, 0.9)',
            color: 'white',
            px: 3,
            py: 1,
            borderRadius: 2,
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255,255,255,0.3)',
            textAlign: 'center',
            animation: 'pulse 2s infinite'
          }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              🎯 Mode Sensitif Aktif
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              Dapat scan QR buram/rusak
            </Typography>
          </Box>
        </Box>
      )}

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
            onClick={() => {
              // Resume scanner when dialog is closed
              setDuplicateDialog({ open: false, nama: '', status: '' });
              if (selectedCamera) {
                startScanning(selectedCamera);
                console.log('▶️ Scanner resumed after duplicate dialog');
              }
            }}
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