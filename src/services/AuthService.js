import { db } from '../database.js';

export class AuthService {
  static async login(username, password) {
    try {
      console.log('🔐 Attempting login for user:', username);

      // Find user by username
      const user = await db.users
        .where('username')
        .equals(username)
        .first();

      if (!user) {
        throw new Error('Username tidak ditemukan');
      }

      if (user.status !== 'active') {
        throw new Error('Akun tidak aktif');
      }

      // Check password (in production, this should be hashed)
      if (user.password !== password) {
        throw new Error('Password salah');
      }

      // Update last login
      await db.users.update(user.id, {
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Create session data (exclude password)
      const sessionUser = {
        id: user.id,
        username: user.username,
        role: user.role,
        nama: user.nama,
        email: user.email,
        wa: user.wa
      };

      // Store session in localStorage
      localStorage.setItem('currentUser', JSON.stringify(sessionUser));
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('loginTime', new Date().toISOString());

      console.log('✅ Login successful for user:', sessionUser);
      return sessionUser;

    } catch (error) {
      console.error('❌ Login failed:', error);
      throw error;
    }
  }

  static logout() {
    console.log('🔓 Logging out user');

    // Clear session data
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('loginTime');

    console.log('✅ Logout successful');
  }

  static getCurrentUser() {
    try {
      const userData = localStorage.getItem('currentUser');
      const isAuthenticated = localStorage.getItem('isAuthenticated');

      if (!userData || !isAuthenticated || isAuthenticated !== 'true') {
        return null;
      }

      return JSON.parse(userData);
    } catch (error) {
      console.error('❌ Error getting current user:', error);
      this.logout(); // Clear corrupted session
      return null;
    }
  }

  static isAuthenticated() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const loginTime = localStorage.getItem('loginTime');

    if (!isAuthenticated || isAuthenticated !== 'true') {
      return false;
    }

    // Check if session is not too old (24 hours)
    if (loginTime) {
      const loginDate = new Date(loginTime);
      const now = new Date();
      const hoursDiff = (now - loginDate) / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        console.log('⚠️ Session expired');
        this.logout();
        return false;
      }
    }

    return true;
  }

  static async getAllUsers() {
    try {
      return await db.users.orderBy('nama').toArray();
    } catch (error) {
      console.error('❌ Error getting all users:', error);
      throw error;
    }
  }

  static async createUser(userData) {
    try {
      console.log('👤 Creating new user:', userData.username);

      // Check if username already exists
      const existingUser = await db.users
        .where('username')
        .equals(userData.username)
        .first();

      if (existingUser) {
        throw new Error('Username sudah digunakan');
      }

      // Add timestamps
      const userWithTimestamp = {
        ...userData,
        status: userData.status || 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const id = await db.users.add(userWithTimestamp);
      console.log('✅ User created with ID:', id);

      return { id, ...userWithTimestamp };
    } catch (error) {
      console.error('❌ Error creating user:', error);
      throw error;
    }
  }

  static async updateUser(id, userData) {
    try {
      console.log('📝 Updating user:', id);

      // Add update timestamp
      const userWithTimestamp = {
        ...userData,
        updated_at: new Date().toISOString()
      };

      await db.users.update(id, userWithTimestamp);
      console.log('✅ User updated');

      return await db.users.get(id);
    } catch (error) {
      console.error('❌ Error updating user:', error);
      throw error;
    }
  }

  static async deleteUser(id) {
    try {
      console.log('🗑️ Deleting user:', id);
      await db.users.delete(id);
      console.log('✅ User deleted');
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      throw error;
    }
  }

  static async changePassword(id, newPassword) {
    try {
      console.log('🔑 Changing password for user:', id);

      await db.users.update(id, {
        password: newPassword,
        updated_at: new Date().toISOString()
      });

      console.log('✅ Password changed');
    } catch (error) {
      console.error('❌ Error changing password:', error);
      throw error;
    }
  }

  // Role-based access control
  static hasPermission(userRole, requiredRole) {
    const roleHierarchy = {
      'Admin': 4,
      'Bendahara': 3,
      'Operator': 2,
      'Viewer': 1
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }

  static canAccess(userRole, feature) {
    const permissions = {
      'Admin': [
        // Full access to all features
        'dashboard', 'database', 'absensi', 'rekap-absen', 'rekap-lengkap',
        'bintangku', 'data-guru', 'data-siswa', 'data-mutasi', 'penggajian',
        'user-management', 'settings', 'system-config', 'data-export',
        'data-import', 'bulk-operations', 'audit-log'
      ],
      'Bendahara': [
        // Financial and payroll management
        'dashboard', 'penggajian', 'rekap-absen', 'rekap-lengkap',
        'data-guru', 'data-export', 'settings'
      ],
      'Operator': [
        // Operational tasks only
        'dashboard', 'absensi', 'rekap-absen', 'rekap-lengkap',
        'data-guru', 'data-siswa', 'data-mutasi'
      ],
      'Viewer': [
        // Read-only access
        'dashboard', 'rekap-absen', 'rekap-lengkap'
      ]
    };

    return permissions[userRole]?.includes(feature) || false;
  }

  // Get role-specific capabilities
  static getRoleCapabilities(userRole) {
    const capabilities = {
      'Admin': {
        name: 'Administrator',
        description: 'Akses penuh ke semua fitur sistem',
        color: 'error',
        canEdit: true,
        canDelete: true,
        canExport: true,
        canImport: true,
        canManageUsers: true,
        canAccessSettings: true,
        canBulkEdit: true
      },
      'Bendahara': {
        name: 'Bendahara',
        description: 'Pengelolaan keuangan dan penggajian',
        color: 'warning',
        canEdit: true,
        canDelete: false,
        canExport: true,
        canImport: false,
        canManageUsers: false,
        canAccessSettings: true,
        canBulkEdit: true
      },
      'Operator': {
        name: 'Operator',
        description: 'Operasional harian dan input data',
        color: 'info',
        canEdit: true,
        canDelete: false,
        canExport: false,
        canImport: false,
        canManageUsers: false,
        canAccessSettings: false,
        canBulkEdit: false
      },
      'Viewer': {
        name: 'Viewer',
        description: 'Akses baca saja untuk laporan',
        color: 'success',
        canEdit: false,
        canDelete: false,
        canExport: false,
        canImport: false,
        canManageUsers: false,
        canAccessSettings: false,
        canBulkEdit: false
      }
    };

    return capabilities[userRole] || capabilities['Viewer'];
  }

  // Check if user can perform specific action
  static canPerformAction(userRole, action) {
    const actions = {
      'Admin': ['create', 'read', 'update', 'delete', 'export', 'import', 'bulk-edit', 'manage-users'],
      'Bendahara': ['create', 'read', 'update', 'export', 'bulk-edit'],
      'Operator': ['create', 'read', 'update'],
      'Viewer': ['read']
    };

    return actions[userRole]?.includes(action) || false;
  }
}

export default AuthService;