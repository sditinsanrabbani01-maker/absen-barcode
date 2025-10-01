import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Toolbar, AppBar, Typography, IconButton, Select, MenuItem, FormControl } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import StorageIcon from '@mui/icons-material/Storage';
import EventNoteIcon from '@mui/icons-material/EventNote';
import SchoolIcon from '@mui/icons-material/School';
import PersonIcon from '@mui/icons-material/Person';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import StarIcon from '@mui/icons-material/Star';
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
  const [mode, setMode] = useState('Admin');

  // Check if current route is scan mode, izin form, or standalone (full screen)
  const isScanMode = window.location.pathname.startsWith('/scan') ||
                     window.location.pathname.startsWith('/izin') ||
                     window.location.pathname.startsWith('/si-gesit-standalone') ||
                     window.location.pathname.startsWith('/si-santuy-standalone');

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleModeChange = (event) => {
    setMode(event.target.value);
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Database', icon: <StorageIcon />, path: '/database' },
    { text: 'Absensi', icon: <EventNoteIcon />, path: '/absensi' },
    { text: 'Rekap Absen', icon: <PictureAsPdfIcon />, path: '/rekap-absen' },
    { text: 'Rekap Lengkap', icon: <PictureAsPdfIcon />, path: '/rekap-lengkap' },
    { text: 'BintangKu', icon: <StarIcon />, path: '/bintangku' },
    { text: 'Data Guru', icon: <SchoolIcon />, path: '/data-guru' },
    { text: 'Data Siswa', icon: <PersonIcon />, path: '/data-siswa' },
    { text: 'Data Mutasi', icon: <EventNoteIcon />, path: '/data-mutasi' },
    { text: 'Penggajian', icon: <AccountBalanceIcon />, path: '/penggajian' },
  ];

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
          // Full screen mode - no sidebar, no appbar (for scan, izin form, and standalone)
          <Routes>
            <Route path="/scan" element={<Scan />} />
            <Route path="/izin" element={<IzinForm mode="Standalone" />} />
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
                <FormControl size="small">
                  <Select
                    value={mode}
                    onChange={handleModeChange}
                    displayEmpty
                    inputProps={{ 'aria-label': 'Without label' }}
                    sx={{ color: 'white', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'white' }, '& .MuiSvgIcon-root': { color: 'white' } }}
                  >
                    <MenuItem value="Admin">Admin</MenuItem>
                    <MenuItem value="Operator">Operator</MenuItem>
                    <MenuItem value="Bendahara">Bendahara</MenuItem>
                  </Select>
                </FormControl>
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
                <Route path="/" element={<Dashboard mode={mode} />} />
                <Route path="/database" element={<Database mode={mode} />} />
                <Route path="/absensi" element={<Absensi mode={mode} />} />
                <Route path="/rekap-absen" element={<RekapAbsen mode={mode} />} />
                <Route path="/rekap-lengkap" element={<RekapLengkap mode={mode} />} />
                <Route path="/bintangku" element={<BintangKu mode={mode} />} />
                <Route path="/si-gesit" element={<SiGesit mode={mode} />} />
                <Route path="/si-santuy" element={<SiSantuy mode={mode} />} />
                <Route path="/data-guru" element={<DataGuru mode={mode} />} />
                <Route path="/data-siswa" element={<DataSiswa mode={mode} />} />
                <Route path="/data-mutasi" element={<DataMutasi mode={mode} />} />
                <Route path="/penggajian" element={<Penggajian mode={mode} />} />
                <Route path="/scan" element={<Scan />} />
              </Routes>
            </Box>
          </Box>
        )}
      </Router>
    </ThemeProvider>
  );
}

export default App;
