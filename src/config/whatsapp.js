// WhatsApp Configuration
// Ganti DEVICE_ID dengan Device ID WhaCenter Anda yang sebenarnya

export const WHATSAPP_CONFIG = {
  // Device ID dari WhaCenter Dashboard
  // Cara mencari: Login ke whacenter.com → Device Management → Copy Device ID
  deviceId: import.meta.env.VITE_WHATSAPP_DEVICE_ID || '9b33e3a9-e9ff-4f8b-a62a-90b5eee3f946', // ⚠️ GANTI DENGAN DEVICE ID ANDA

  // API Endpoints (sudah dikonfigurasi dengan proxy)
  endpoints: {
    sendGroup: '/api/whatsapp/sendgroup',
    sendMessage: '/api/whatsapp/send'
  },

  // Default group name (fallback jika tidak ada di database)
  defaultGroupName: 'Guru Sekolah'
};

// Helper function untuk mendapatkan group name dari database
export const getGroupName = async (db) => {
  try {
    const groupSetting = await db.attendance_settings.where('type').equals('group').first();
    return groupSetting?.group_name || WHATSAPP_CONFIG.defaultGroupName;
  } catch (error) {
    console.error('Error getting group name:', error);
    return WHATSAPP_CONFIG.defaultGroupName;
  }
};