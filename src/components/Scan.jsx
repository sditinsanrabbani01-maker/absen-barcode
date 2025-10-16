import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Button, IconButton, Select, MenuItem, FormControl, InputLabel, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FlipCameraAndroidIcon from '@mui/icons-material/FlipCameraAndroid';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import { useNavigate } from 'react-router-dom';
import { db } from '../database';
import { DatabaseService, TABLES } from '../config/supabase';
import { supabase } from '../config/supabase';
import { useRealtime } from '../context/RealtimeContext';
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
  const [retryCount, setRetryCount] = useState(0);
  const [maxRetries] = useState(3);
  const [scanAttempts, setScanAttempts] = useState(0);
  const [lastScanTime, setLastScanTime] = useState(0);
  const [enhancedMode, setEnhancedMode] = useState(true); // Enable enhanced scanning by default
  const [beepEnabled, setBeepEnabled] = useState(true); // Enable beep sound by default
  const html5QrCodeRef = useRef(null);
  const navigate = useNavigate();

  // Real-time context
  const { subscribeToTable } = useRealtime();

  // Audio context for beep sound
  const audioContextRef = useRef(null);

  // Initialize audio context
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  // Play scanner beep sound
  const playBeepSound = () => {
    if (!beepEnabled) return;

    try {
      const audioContext = initAudioContext();

      // Resume audio context if suspended (required by some browsers)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      // Create oscillator for beep sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      // Configure beep sound (high-pitched, short duration)
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(2500, audioContext.currentTime); // 800Hz beep

      // Configure volume envelope
      gainNode.gain.setValueAtTime(10, audioContext.currentTime); // Start volume
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1); // Fade out

      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Play beep
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.05); // 100ms beep

    } catch (error) {
      console.warn('Could not play beep sound:', error);
      // Fallback: try to use system beep if available
      try {
        if (navigator.vibrate) {
          navigator.vibrate(100); // 100ms vibration on mobile
        }
      } catch (vibrationError) {
        console.warn('Could not vibrate:', vibrationError);
      }
    }
  };

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

    // Setup real-time subscriptions for attendance data
    console.log('📡 Setting up real-time attendance subscriptions...');

    const attendanceSubscription = subscribeToTable(TABLES.ATTENDANCE, (change) => {
      console.log('🔄 Real-time attendance change detected in Scan:', change);
      // Could trigger refresh of attendance data if needed
    });

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      stopScanning();
      attendanceSubscription?.unsubscribe?.();
    };
  }, [selectedCamera, subscribeToTable]);

  // Start scanning when camera is selected
  useEffect(() => {
    if (selectedCamera && !isScanning) {
      startScanning(selectedCamera);
    }
  }, [selectedCamera, isScanning]);

  const startScanning = useCallback(async (cameraId) => {
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("qr-reader");
      }

      const scannerConfig = getScannerConfig(scannerSize);

      // Enhanced configuration for better sensitivity with blurry/damaged QR codes
      const config = {
        fps: enhancedMode ? 30 : 15, // Higher FPS for more frequent scanning attempts
        qrbox: scannerConfig.qrbox,
        aspectRatio: 1.0,
        // Enhanced experimental features for better detection
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: false, // Use software decoder for better control
        },
        // Additional configuration for better QR detection
        supportedScanTypes: [
          Html5QrcodeSupportedFormats.QR_CODE // Focus only on QR codes
        ],
        // Show QR code outlines for debugging (development only)
        showTorchButtonIfSupported: true,
        showZoomSliderIfSupported: true,
        // Default zoom level for better focus
        defaultZoomValueIfSupported: 2,
        // Additional settings for better detection
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        // Improve detection of low quality QR codes
        useWebgl: false // Use CPU for better compatibility with low quality codes
      };

      // Add preprocessing for better QR detection
      if (enhancedMode) {
        console.log('🎯 Enhanced scanning mode activated - optimized for blurry/damaged QR codes');
      }

      // Enhanced success callback with retry mechanism
      const enhancedOnScanSuccess = async (decodedText, decodedResult) => {
    const currentTime = new Date(); // Waktu lokal perangkat
    const localTimeString = currentTime.toLocaleString('id-ID', { timeZone: 'Asia/Makassar' }); // Mengonversi waktu ke zona waktu WITA (Asia/Makassar)

    setLastScanTime(localTimeString); // Menyimpan waktu dalam format lokal WITA
    setScanAttempts(prev => prev + 1);

    console.log('🔍 QR Code detected:', decodedText);
    console.log('📊 Detection confidence:', decodedResult.result.correctionLevel || 'Unknown');
    console.log('📅 Scan Time (WITA):', localTimeString); // Menampilkan waktu dalam WITA

    // Reset retry count on successful scan
    setRetryCount(0);

    // Play success beep sound
    playBeepSound();

    // Process the scan result
    await onScanSuccess(decodedText);
};


      // Enhanced failure callback with retry logic
      const enhancedOnScanFailure = (error) => {
        const currentTime = Date.now();

        // Only log errors, don't show to user as it's normal for failed scans
        console.debug('Scan attempt failed:', error);

        // Implement retry mechanism for failed scans
        if (enhancedMode && currentTime - lastScanTime > 5000) { // If no successful scan in 5 seconds
          setRetryCount(prev => {
            const newCount = prev + 1;
            if (newCount >= maxRetries) {
              console.log('🔄 Switching to enhanced scanning mode due to repeated failures');
              // Could implement fallback scanning strategies here
              return 0; // Reset counter
            }
            return newCount;
          });
        }

        onScanFailure(error);
      };

      await html5QrCodeRef.current.start(
        cameraId,
        config,
        enhancedOnScanSuccess,
        enhancedOnScanFailure
      );

      setIsScanning(true);
      console.log('🚀 Enhanced QR Scanner started with improved sensitivity');
    } catch (error) {
      console.error('Failed to start enhanced scanner:', error);

      // Fallback to basic scanning if enhanced fails
      if (enhancedMode) {
        console.log('🔄 Falling back to basic scanning mode');
        setEnhancedMode(false);
        setTimeout(() => startScanning(cameraId), 1000);
      }
    }
  }, [enhancedMode, scannerSize, lastScanTime, maxRetries]);

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

  const onScanSuccess = async (decodedText, decodedResult) => {
    const currentTime = Date.now();

    // Enhanced duplicate checking with time-based reset
    if (processedCodes.has(decodedText)) {
      // Reset processed codes after 10 minutes to allow re-scanning
      const timeSinceLastScan = currentTime - lastScanTime;
      if (timeSinceLastScan > 600000) { // 10 minutes
        setProcessedCodes(new Set());
        console.log('🔄 Reset duplicate tracking after timeout');
      } else {
        // Find user to show name in duplicate message
        try {
          const [guru, siswa] = await Promise.all([
            db.guru.where('niy').equals(decodedText).first(),
            db.siswa.where('nisn').equals(decodedText).first()
          ]);
          const user = guru || siswa;

          if (user) {
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
    }

    // Mark code as processed
    setProcessedCodes(prev => new Set([...prev, decodedText]));
    setScanResult(decodedText);
    setScanCount(prev => prev + 1);
    setLastScanTime(currentTime);

    console.log('✅ QR Code successfully decoded:', {
      text: decodedText,
      confidence: decodedResult?.result?.correctionLevel || 'Unknown',
      format: decodedResult?.result?.format || 'QR_CODE',
      attempts: scanAttempts
    });

    try {
      // Enhanced user lookup with multiple search strategies
      let user = null;

      try {
        // Strategy 1: Direct identifier match in Supabase (real-time data)
        const { data: supabaseGuru, error: guruError } = await supabase
          .from(TABLES.GURU)
          .select('*')
          .eq('niy', decodedText)
          .single();

        const { data: supabaseSiswa, error: siswaError } = await supabase
          .from(TABLES.SISWA)
          .select('*')
          .eq('nisn', decodedText)
          .single();

        if (!guruError && supabaseGuru) {
          user = supabaseGuru;
          console.log('👤 User found in Supabase (Guru):', user.nama);
        } else if (!siswaError && supabaseSiswa) {
          user = supabaseSiswa;
          console.log('👤 User found in Supabase (Siswa):', user.nama);
        }
      } catch (supabaseError) {
        console.warn('⚠️ Supabase lookup failed, trying local database:', supabaseError);
      }

      // Strategy 2: Fallback to local database
      if (!user) {
        const [guru, siswa] = await Promise.all([
          db.guru.where('niy').equals(decodedText).first(),
          db.siswa.where('nisn').equals(decodedText).first()
        ]);

        user = guru || siswa;
        if (user) {
          console.log('👤 User found in local database:', user.nama);
        }
      }

      // Strategy 2: If no direct match, try fuzzy matching for damaged QR codes
      if (!user && enhancedMode) {
        console.log('🔍 No direct match found, trying fuzzy search...');

        // Try partial matches for damaged QR codes
        const allUsers = await Promise.all([
          db.guru.where('status').equals('active').toArray(),
          db.siswa.where('status').equals('active').toArray()
        ]);

        const allActiveUsers = [...allUsers[0], ...allUsers[1]];

        // Find users with similar identifiers (for damaged QR codes)
        const similarUsers = allActiveUsers.filter(u => {
          const identifier = u.niy || u.nisn;
          return identifier && (
            identifier.includes(decodedText) ||
            decodedText.includes(identifier) ||
            calculateStringSimilarity(identifier, decodedText) > 0.7
          );
        });

        if (similarUsers.length === 1) {
          user = similarUsers[0];
          console.log('🎯 Found similar match:', user.nama);
        } else if (similarUsers.length > 1) {
          console.log('⚠️ Multiple similar matches found:', similarUsers.length);
        }
      }

      if (user) {
        if (user.status === 'active') {
          await recordAttendance(user);
          showSuccessNotification(user.nama);
        } else {
          alert('Pengguna ditemukan tetapi status tidak aktif. Status: ' + user.status);
        }
      } else {
        // Enhanced error message with suggestions
        const [activeGuru, activeSiswa] = await Promise.all([
          db.guru.where('status').equals('active').toArray(),
          db.siswa.where('status').equals('active').toArray()
        ]);

        const suggestions = [];
        activeGuru.slice(0, 3).forEach(g => suggestions.push(`Guru: ${g.niy} - ${g.nama}`));
        activeSiswa.slice(0, 3).forEach(s => suggestions.push(`Siswa: ${s.nisn} - ${s.nama}`));

        alert(`❌ Pengguna tidak ditemukan dengan identifier: ${decodedText}\n\n💡 Pastikan QR code tidak buram atau rusak.\n\n📋 Contoh identifier yang valid:\n${suggestions.join('\n')}\n\n🔄 Coba scan ulang dengan posisi yang lebih jelas.`);
      }
    } catch (error) {
      console.error('Error during enhanced scan processing:', error);
      alert('Terjadi kesalahan saat memproses scan: ' + error.message);
    }

    // Scanner stays running for continuous scanning
  };

  const onScanFailure = (error) => {
    // Enhanced failure handling with retry logic
    const currentTime = Date.now();

    // Only log errors, don't show to user as it's normal for failed scans
    console.debug('Scan attempt failed:', error);

    // Implement retry mechanism for failed scans
    if (enhancedMode && currentTime - lastScanTime > 5000) { // If no successful scan in 5 seconds
      setRetryCount(prev => {
        const newCount = prev + 1;
        if (newCount >= maxRetries) {
          console.log('🔄 Switching to enhanced scanning mode due to repeated failures');
          // Could implement fallback scanning strategies here
          return 0; // Reset counter
        }
        return newCount;
      });
    }
  };

  // Calculate string similarity for fuzzy matching (for damaged QR codes)
  const calculateStringSimilarity = (str1, str2) => {
    if (!str1 || !str2) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  // Calculate Levenshtein distance for string similarity
  const levenshteinDistance = (str1, str2) => {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  };

  // Toggle enhanced scanning mode
  const toggleEnhancedMode = async () => {
    setEnhancedMode(!enhancedMode);

    // Restart scanner with new settings
    if (isScanning) {
      await stopScanning();
      await startScanning(selectedCamera);
    }
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

    const message = `🌟 Assalamu'alaikum ${user.nama} 🌟

✅ Anda telah berhasil *ABSEN*
📅 Tanggal : ${today}
🕒 Pukul : ${currentTime}
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
      // Check Supabase first (real-time data)
      const { data: supabaseAttendance, error: supabaseError } = await supabase
        .from(TABLES.ATTENDANCE)
        .select('*')
        .eq('identifier', identifier)
        .eq('tanggal', today)
        .eq('att', currentAtt);

      if (!supabaseError && supabaseAttendance && supabaseAttendance.length > 0) {
        console.log('🚫 Duplicate attendance found in Supabase');
        return true;
      }

      // Fallback to local database
      const todayAttendance = await db.attendance
        .where('identifier').equals(identifier)
        .and(a => a.tanggal === today && a.att === currentAtt)
        .toArray();

      return todayAttendance.length > 0;

    } catch (error) {
      console.error('Error checking duplicate attendance:', error);
      // Fallback to local only
      const todayAttendance = await db.attendance
        .where('identifier').equals(identifier)
        .and(a => a.tanggal === today && a.att === currentAtt)
        .toArray();

      return todayAttendance.length > 0;
    }
  };

  const showSuccessNotification = (nama, syncStatus = 'success') => {
    // Create a temporary notification that disappears after 4 seconds
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
      animation: slideIn 0.3s ease-out;
      max-width: 300px;
    `;

    const syncIcon = syncStatus === 'success' ? '☁️' : '💾';
    const syncText = syncStatus === 'success' ? 'Tersinkronisasi' : 'Lokal';
    notification.innerHTML = `
      ✅ ${nama}<br>
      <small style="opacity: 0.9">${syncIcon} ${syncText}</small>
    `;

    // Add slide-in animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.05); opacity: 0.9; }
        100% { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Remove after 4 seconds
    setTimeout(() => {
      notification.style.animation = 'slideIn 0.3s ease-in reverse';
      setTimeout(() => {
        document.body.removeChild(notification);
        document.head.removeChild(style);
      }, 300);
    }, 4000);
  };


  const recordAttendance = async (user) => {
    // Get local date in Asia/Makassar timezone (UTC+8)
    const getLocalDate = () => {
      const now = new Date();
      const makassarTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
      return makassarTime.toISOString().split('T')[0];
    };

    const today = getLocalDate();
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      console.log('💾 Recording attendance with real-time sync...');

      // Save to Supabase first (for real-time sync)
      const { data: supabaseResult, error: supabaseError } = await supabase
        .from(TABLES.ATTENDANCE)
        .insert(newEntry)
        .select()
        .single();

      if (supabaseError) {
        console.error('❌ Supabase attendance save error:', supabaseError);
        throw new Error('Failed to save to Supabase: ' + supabaseError.message);
      }

      // Save to local database with Supabase ID
      const localResult = await db.attendance.add({
        ...newEntry,
        id: supabaseResult?.id // Use Supabase ID for consistency
      });

      console.log('✅ Attendance recorded successfully:', {
        supabaseId: supabaseResult?.id,
        localId: localResult,
        user: user.nama,
        status: status
      });

      // Send WhatsApp message after successful recording
      sendWhatsAppMessage(user, today, currentTime, status, keterangan);

      // Show enhanced success notification with sync status
      showSuccessNotification(`${user.nama} - ${status} (${keterangan})`, 'success');

    } catch (error) {
      console.error('❌ Error recording attendance:', error);

      // Fallback to local only if Supabase fails
      try {
        console.log('🔄 Fallback: Saving to local database only...');
        await db.attendance.add(newEntry);
        console.log('✅ Attendance saved to local database as fallback');

        // Still send WhatsApp message
        sendWhatsAppMessage(user, today, currentTime, status, keterangan);
        showSuccessNotification(`${user.nama} - ${status} (Local)`, 'local');

      } catch (localError) {
        console.error('❌ Local database fallback also failed:', localError);
        alert('❌ Gagal menyimpan absensi: ' + error.message);
      }
    }

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


  const getScannerConfig = (size) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const aspectRatio = viewportWidth / viewportHeight;

    // Responsive sizing based on screen orientation - increased base size for better visibility
    let baseSize;
    if (aspectRatio > 1) {
      // Landscape (16:9) - use more screen space
      baseSize = Math.min(viewportWidth * 0.9, viewportHeight * 0.95);
    } else {
      // Portrait (9:16) - use more screen space
      baseSize = Math.min(viewportWidth * 0.95, viewportHeight * 0.9);
    }

    const configs = [
      { qrbox: { width: Math.floor(baseSize * 0.4), height: Math.floor(baseSize * 0.4) }, label: 'KECIL' }, // 0: Kecil - 40% (increased from 30%)
      { qrbox: { width: Math.floor(baseSize * 0.6), height: Math.floor(baseSize * 0.6) }, label: 'SEDANG' }, // 1: Sedang - 60% (increased from 50%)
      { qrbox: { width: Math.floor(baseSize * 0.8), height: Math.floor(baseSize * 0.8) }, label: 'BESAR' }, // 2: Besar - 80% (increased from 70%)
      { qrbox: { width: Math.floor(baseSize * 0.95), height: Math.floor(baseSize * 0.95) }, label: 'FULL' } // 3: Full - 95% (increased from 90%)
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
            {/* Enhanced Mode Toggle */}
            <IconButton
              onClick={toggleEnhancedMode}
              sx={{
                bgcolor: enhancedMode ? 'success.main' : 'rgba(0,0,0,0.7)',
                color: 'white',
                border: '2px solid rgba(255,255,255,0.3)',
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  transform: 'scale(1.1)',
                  bgcolor: enhancedMode ? 'success.dark' : 'rgba(0,0,0,0.9)'
                },
                transition: 'all 0.2s ease-in-out'
              }}
              size="large"
              title={enhancedMode ? 'Mode Sensitif Aktif - Nonaktifkan' : 'Aktifkan Mode Sensitif'}
            >
              {enhancedMode ? '🎯' : '⚡'}
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