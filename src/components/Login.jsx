import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  Container,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Avatar,
  Grid
} from '@mui/material';
import {
  LockOutlined as LockIcon,
  School as SchoolIcon,
  Person as PersonIcon,
  AccountBalance as AccountIcon
} from '@mui/icons-material';
import { AuthService } from '../services/AuthService';

const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'Admin'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      // For demo purposes, we'll check against default credentials
      // In production, this would be handled by the AuthService
      const defaultCredentials = {
        'Admin': { username: 'admin', password: 'admin@IR' },
        'Operator': { username: 'operator', password: 'operator123' },
        'Bendahara': { username: 'bendahara', password: 'bendahara123' }
      };

      const expected = defaultCredentials[formData.role];

      if (formData.username === expected.username && formData.password === expected.password) {
        // Create user object for session
        const user = {
          id: Date.now(), // In real app, this would come from database
          username: formData.username,
          role: formData.role,
          nama: `${formData.role} User`,
          email: `${formData.username}@school.com`,
          wa: '08123456789'
        };

        // Store session
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('loginTime', new Date().toISOString());

        console.log('✅ Login successful');
        onLogin(user);
      } else {
        setError('Username atau password salah');
      }
    } catch (err) {
      console.error('❌ Login error:', err);
      setError('Terjadi kesalahan saat login');
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'Admin':
        return <PersonIcon />;
      case 'Operator':
        return <SchoolIcon />;
      case 'Bendahara':
        return <AccountIcon />;
      default:
        return <PersonIcon />;
    }
  };

  const getRoleDescription = (role) => {
    switch (role) {
      case 'Admin':
        return 'Akses penuh ke semua fitur sistem';
      case 'Operator':
        return 'Mengelola data guru, siswa, dan absensi';
      case 'Bendahara':
        return 'Mengelola penggajian dan keuangan';
      default:
        return '';
    }
  };

  return (
    <Container component="main" maxWidth="md">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #36aec1 0%, #2d9aa8 100%)'
        }}
      >
        <Card
          elevation={8}
          sx={{
            width: '100%',
            maxWidth: 500,
            borderRadius: 2
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                mb: 3
              }}
            >
              <Avatar
                sx={{
                  m: 1,
                  bgcolor: 'primary.main',
                  width: 56,
                  height: 56
                }}
              >
                <LockIcon fontSize="large" />
              </Avatar>
              <Typography component="h1" variant="h4" gutterBottom>
                INGAT WAKTU
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center">
                Sistem Absensi Barcode Sekolah
              </Typography>
            </Box>

            <Box component="form" onSubmit={handleSubmit} noValidate>
              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="Username"
                name="username"
                autoComplete="username"
                autoFocus
                value={formData.username}
                onChange={handleInputChange('username')}
                sx={{ mb: 2 }}
              />

              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleInputChange('password')}
                sx={{ mb: 2 }}
              />

              <FormControl fullWidth margin="normal" sx={{ mb: 3 }}>
                <InputLabel id="role-label">Role</InputLabel>
                <Select
                  labelId="role-label"
                  id="role"
                  value={formData.role}
                  label="Role"
                  onChange={handleInputChange('role')}
                >
                  <MenuItem value="Admin">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon />
                      <Box>
                        <Typography variant="subtitle2">Admin</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Akses penuh ke semua fitur
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="Operator">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SchoolIcon />
                      <Box>
                        <Typography variant="subtitle2">Operator</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Mengelola data dan absensi
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="Bendahara">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AccountIcon />
                      <Box>
                        <Typography variant="subtitle2">Bendahara</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Mengelola penggajian
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{
                  mt: 2,
                  mb: 2,
                  py: 1.5,
                  fontSize: '1.1rem'
                }}
              >
                {loading ? 'Sedang Login...' : 'Masuk'}
              </Button>

              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" color="text.secondary" align="center">
                  Demo Credentials:
                </Typography>
                <Grid container spacing={1} sx={{ mt: 1 }}>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 1, textAlign: 'center', bgcolor: 'grey.50' }}>
                      <Typography variant="caption" fontWeight="bold">Admin</Typography>
                      <Typography variant="caption" display="block">admin</Typography>
                      <Typography variant="caption">admin123</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 1, textAlign: 'center', bgcolor: 'grey.50' }}>
                      <Typography variant="caption" fontWeight="bold">Operator</Typography>
                      <Typography variant="caption" display="block">operator</Typography>
                      <Typography variant="caption">operator123</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 1, textAlign: 'center', bgcolor: 'grey.50' }}>
                      <Typography variant="caption" fontWeight="bold">Bendahara</Typography>
                      <Typography variant="caption" display="block">bendahara</Typography>
                      <Typography variant="caption">bendahara123</Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default Login;