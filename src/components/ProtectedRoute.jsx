import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, Typography, Alert } from '@mui/material';
import { AuthService } from '../services/AuthService';

const ProtectedRoute = ({ children, requiredRole, requiredFeature }) => {
  const location = useLocation();
  const currentUser = AuthService.getCurrentUser();

  // Check if user is authenticated
  if (!AuthService.isAuthenticated() || !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user has required role (if specified)
  if (requiredRole && !AuthService.hasPermission(currentUser.role, requiredRole)) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          p: 3
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 500 }}>
          <Typography variant="h6" gutterBottom>
            Akses Ditolak
          </Typography>
          <Typography variant="body2">
            Anda tidak memiliki izin untuk mengakses halaman ini.
            Halaman ini memerlukan role: {requiredRole}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Role Anda saat ini: {currentUser.role}
          </Typography>
        </Alert>
      </Box>
    );
  }

  // Check if user has permission for specific feature (if specified)
  if (requiredFeature && !AuthService.canAccess(currentUser.role, requiredFeature)) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          p: 3
        }}
      >
        <Alert severity="warning" sx={{ maxWidth: 500 }}>
          <Typography variant="h6" gutterBottom>
            Fitur Tidak Tersedia
          </Typography>
          <Typography variant="body2">
            Role Anda ({currentUser.role}) tidak memiliki akses ke fitur ini.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Hubungi administrator untuk mengubah role Anda jika diperlukan.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return children;
};

export default ProtectedRoute;