import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Toolbar, AppBar, Typography, IconButton, Select, MenuItem, FormControl, Button, Avatar, Menu } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import StorageIcon from '@mui/icons-material/Storage';
import EventNoteIcon from '@mui/icons-material/EventNote';
import SchoolIcon from '@mui/icons-material/School';
import PersonIcon from '@mui/icons-material/Person';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import StarIcon from '@mui/icons-material/Star';
import LogoutIcon from '@mui/icons-material/Logout';
import Dashboard from './components/Dashboard';
import Database from './components/Database';
import Absensi from './components/Absensi';
import DataGuru from './components/DataGuru';
import DataSiswa from './components/DataSiswa';
import DataMutasi from './components/DataMutasi';
import Penggajian from './components/Penggajian';
import Scan from './components/Scan';
import IzinForm from './components/IzinForm';
import RekapAbsen from './components/RekapAbsen';
import RekapLengkap from './components/RekapLengkap';
import SiGesit from './components/SiGesit';
import SiSantuy from './components/SiSantuy';
import BintangKu from './components/BintangKu';
import SiGesitStandalone from './components/SiGesitStandalone';
import SiSantuyStandalone from './components/SiSantuyStandalone';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import Presensi from './components/Presensi';
import { DatabaseService } from './config/supabase';
import { AuthService } from './services/AuthService';
import SyncStatus from './components/SyncStatus';

const drawerWidth = 240;

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#36aec1',
    },
    secondary: {
      main: '#2d9aa8',
    },
  },
});

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);

  // Check authentication status on app load
  useEffect(() => {
    const user = AuthService.getCurrentUser();
    if (user && AuthService.isAuthenticated()) {
      setCurrentUser(user);
      setIsAuthenticated(true);
    }
  }, []);

  // ============================================================================
  // NEW: Real-time system initialization instead of polling-based sync
  // ============================================================================
  useEffect(() => {
    if (isAuthenticated) {
      const initializeRealtimeSystem = async () => {
        try {
          console.log('🚀 Initializing real-time system...');

          // Initialize local database
          try {
            const { db } = await import('./database.js');
            await db.open();
            console.log('💾 Local database initialized');
          } catch (localError) {
            console.error('❌ Local database initialization failed:', localError);
          }

          // Check if Supabase is configured and available
          if (navigator.onLine && import.meta.env.VITE_SUPABASE_URL) {
            try {
              // Initial data load from Supabase (one-time)
              console.log('🌐 Online: Loading initial data from Supabase...');
              const syncResults = await DatabaseService.autoSyncFromSupabase();
              console.log('✅ Initial data load from Supabase completed:', syncResults);

              // Mark Supabase as available
              localStorage.setItem('last_supabase_sync', new Date().toISOString());
              localStorage.setItem('supabase_data_available', 'true');
              console.log('☁️ Supabase data loaded successfully');

            } catch (supabaseError) {
              console.warn('⚠️ Initial Supabase load failed, using local data:', supabaseError.message);
              localStorage.setItem('supabase_data_available', 'false');
            }
          } else {
            console.log('📴 Offline or Supabase not configured, using local data only');
            localStorage.setItem('supabase_data_available', 'false');
          }

          console.log('✅ Real-time system initialized');
        } catch (error) {
          console.error('❌ Real-time system initialization failed:', error);
        }
      };

      initializeRealtimeSystem();

      // No cleanup needed for real-time subscriptions (handled by individual components)
    }
  }, [isAuthenticated]);

  // Check if current route is scan mode, izin form, presensi, or standalone (full screen)
  const isScanMode = window.location.pathname.startsWith('/scan') ||
                      window.location.pathname.startsWith('/izin') ||
                      window.location.pathname.startsWith('/presensi') ||
                      window.location.pathname.startsWith('/si-gesit-standalone') ||
                      window.location.pathname.startsWith('/si-santuy-standalone');

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    AuthService.logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setUserMenuAnchor(null);
  };

  const handleUserMenuOpen = (event) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  // If not authenticated and not accessing standalone routes, show login page
  if (!isAuthenticated && !isScanMode) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Login onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  // Define menu items based on user role
  const getMenuItems = (userRole) => {
    const allMenuItems = [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/', feature: 'dashboard' },
      { text: 'Database', icon: <StorageIcon />, path: '/database', feature: 'database' },
      { text: 'Absensi', icon: <EventNoteIcon />, path: '/absensi', feature: 'absensi' },
      { text: 'Rekap Absen', icon: <PictureAsPdfIcon />, path: '/rekap-absen', feature: 'rekap-absen' },
      { text: 'Rekap Lengkap', icon: <PictureAsPdfIcon />, path: '/rekap-lengkap', feature: 'rekap-lengkap' },
      { text: 'BintangKu', icon: <StarIcon />, path: '/bintangku', feature: 'bintangku' },
      { text: 'Data Guru', icon: <SchoolIcon />, path: '/data-guru', feature: 'data-guru' },
      { text: 'Data Siswa', icon: <PersonIcon />, path: '/data-siswa', feature: 'data-siswa' },
      { text: 'Data Mutasi', icon: <EventNoteIcon />, path: '/data-mutasi', feature: 'data-mutasi' },
      { text: 'Penggajian', icon: <AccountBalanceIcon />, path: '/penggajian', feature: 'penggajian' },
    ];

    return allMenuItems.filter(item => AuthService.canAccess(userRole, item.feature));
  };

  const menuItems = getMenuItems(currentUser?.role);

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          INGAT WAKTU
        </Typography>
      </Toolbar>
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton component={Link} to={item.path}>
              <ListItemIcon>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        {isScanMode ? (
          // Full screen mode - no sidebar, no appbar (for scan, izin form, presensi, and standalone)
          <Routes>
            <Route path="/scan" element={<Scan />} />
            <Route path="/izin" element={<IzinForm mode="Standalone" />} />
            <Route path="/presensi" element={<Presensi />} />
            <Route path="/si-gesit-standalone" element={<SiGesitStandalone />} />
            <Route path="/si-santuy-standalone" element={<SiSantuyStandalone />} />
          </Routes>
        ) : (
          // Normal app layout with sidebar and appbar
          <Box sx={{ display: 'flex' }}>
            <AppBar
              position="fixed"
              sx={{
                width: { sm: `calc(100% - ${drawerWidth}px)` },
                ml: { sm: `${drawerWidth}px` },
              }}
            >
              <Toolbar>
                <IconButton
                  color="inherit"
                  aria-label="open drawer"
                  edge="start"
                  onClick={handleDrawerToggle}
                  sx={{ mr: 2, display: { sm: 'none' } }}
                >
                  <MenuIcon />
                </IconButton>
                <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                  INGAT WAKTU
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SyncStatus />
                  <Button
                    onClick={handleUserMenuOpen}
                    sx={{
                      color: 'white',
                      textTransform: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: 'primary.dark'
                      }}
                    >
                      {currentUser?.nama?.charAt(0) || 'U'}
                    </Avatar>
                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                      <Typography variant="body2">
                        {currentUser?.nama}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        {currentUser?.role}
                      </Typography>
                    </Box>
                  </Button>
                  <Menu
                    anchorEl={userMenuAnchor}
                    open={Boolean(userMenuAnchor)}
                    onClose={handleUserMenuClose}
                    onClick={handleUserMenuClose}
                  >
                    <Box sx={{ px: 2, py: 1, minWidth: 150 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {currentUser?.nama}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {currentUser?.role}
                      </Typography>
                    </Box>
                    <MenuItem onClick={handleLogout}>
                      <LogoutIcon sx={{ mr: 1 }} />
                      Logout
                    </MenuItem>
                  </Menu>
                </Box>
              </Toolbar>
            </AppBar>
            <Box
              component="nav"
              sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
              aria-label="mailbox folders"
            >
              <Drawer
                variant="temporary"
                open={mobileOpen}
                onClose={handleDrawerToggle}
                ModalProps={{
                  keepMounted: true, // Better open performance on mobile.
                }}
                sx={{
                  display: { xs: 'block', sm: 'none' },
                  '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                }}
              >
                {drawer}
              </Drawer>
              <Drawer
                variant="permanent"
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                }}
                open
              >
                {drawer}
              </Drawer>
            </Box>
            <Box
              component="main"
              sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` } }}
            >
              <Toolbar />
              <Routes>
                <Route path="/" element={
                  <ProtectedRoute requiredFeature="dashboard">
                    <Dashboard mode={currentUser?.role} />
                  </ProtectedRoute>
                } />
                <Route path="/database" element={
                  <ProtectedRoute requiredFeature="database">
                    <Database mode={currentUser?.role} />
                  </ProtectedRoute>
                } />
                <Route path="/absensi" element={
                  <ProtectedRoute requiredFeature="absensi">
                    <Absensi mode={currentUser?.role} />
                  </ProtectedRoute>
                } />
                <Route path="/rekap-absen" element={
                  <ProtectedRoute requiredFeature="rekap-absen">
                    <RekapAbsen mode={currentUser?.role} />
                  </ProtectedRoute>
                } />
                <Route path="/rekap-lengkap" element={
                  <ProtectedRoute requiredFeature="rekap-lengkap">
                    <RekapLengkap mode={currentUser?.role} />
                  </ProtectedRoute>
                } />
                <Route path="/bintangku" element={
                  <ProtectedRoute requiredFeature="bintangku">
                    <BintangKu mode={currentUser?.role} />
                  </ProtectedRoute>
                } />
                <Route path="/si-gesit" element={
                  <ProtectedRoute requiredFeature="bintangku">
                    <SiGesit mode={currentUser?.role} />
                  </ProtectedRoute>
                } />
                <Route path="/si-santuy" element={
                  <ProtectedRoute requiredFeature="bintangku">
                    <SiSantuy mode={currentUser?.role} />
                  </ProtectedRoute>
                } />
                <Route path="/data-guru" element={
                  <ProtectedRoute requiredFeature="data-guru">
                    <DataGuru mode={currentUser?.role} />
                  </ProtectedRoute>
                } />
                <Route path="/data-siswa" element={
                  <ProtectedRoute requiredFeature="data-siswa">
                    <DataSiswa mode={currentUser?.role} />
                  </ProtectedRoute>
                } />
                <Route path="/data-mutasi" element={
                  <ProtectedRoute requiredFeature="data-mutasi">
                    <DataMutasi mode={currentUser?.role} />
                  </ProtectedRoute>
                } />
                <Route path="/penggajian" element={
                  <ProtectedRoute requiredFeature="penggajian">
                    <Penggajian mode={currentUser?.role} />
                  </ProtectedRoute>
                } />
                <Route path="/login" element={<Login onLogin={handleLogin} />} />
              </Routes>
            </Box>
          </Box>
        )}
      </Router>
    </ThemeProvider>
  );
}

export default App;
