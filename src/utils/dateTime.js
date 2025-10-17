// Date and Time utility functions for Asia/Makassar timezone (UTC+8)

export class DateTimeUtils {
  // Asia/Makassar timezone offset in milliseconds (UTC+8)
  static MAKASSAR_OFFSET = 8 * 60 * 60 * 1000;

  /**
   * Get current date in Asia/Makassar timezone
   * @returns {string} Date in YYYY-MM-DD format
   */
  static getLocalDate() {
    const now = new Date();
    const makassarTime = new Date(now.getTime() + this.MAKASSAR_OFFSET);
    return makassarTime.toISOString().split('T')[0];
  }

  /**
   * Get current time in Asia/Makassar timezone
   * @returns {string} Time in HH:MM:SS format
   */
  static getLocalTime() {
    const now = new Date();
    const makassarTime = new Date(now.getTime() + this.MAKASSAR_OFFSET);
    return makassarTime.toTimeString().split(' ')[0];
  }

  /**
   * Get current date and time in Asia/Makassar timezone
   * @returns {string} DateTime in YYYY-MM-DD HH:MM:SS format
   */
  static getLocalDateTime() {
    const now = new Date();
    const makassarTime = new Date(now.getTime() + this.MAKASSAR_OFFSET);
    return makassarTime.toISOString().replace('T', ' ').split('.')[0];
  }

  /**
   * Convert UTC date to local Asia/Makassar date
   * @param {string|Date} utcDate - UTC date
   * @returns {string} Local date in YYYY-MM-DD format
   */
  static utcToLocalDate(utcDate) {
    const date = new Date(utcDate);
    const localDate = new Date(date.getTime() + this.MAKASSAR_OFFSET);
    return localDate.toISOString().split('T')[0];
  }

  /**
   * Convert UTC datetime to local Asia/Makassar datetime
   * @param {string|Date} utcDateTime - UTC datetime
   * @returns {string} Local datetime in YYYY-MM-DD HH:MM:SS format
   */
  static utcToLocalDateTime(utcDateTime) {
    const dateTime = new Date(utcDateTime);
    const localDateTime = new Date(dateTime.getTime() + this.MAKASSAR_OFFSET);
    return localDateTime.toISOString().replace('T', ' ').split('.')[0];
  }

  /**
   * Format date for display in local timezone
   * @param {string|Date} date - Date to format
   * @param {object} options - Intl.DateTimeFormat options
   * @returns {string} Formatted date string
   */
  static formatLocalDate(date, options = {}) {
    const dateObj = new Date(date);
    const localDate = new Date(dateObj.getTime() + this.MAKASSAR_OFFSET);

    return localDate.toLocaleDateString('id-ID', {
      timeZone: 'Asia/Makassar',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options
    });
  }

  /**
   * Format time for display in local timezone
   * @param {string|Date} dateTime - DateTime to format
   * @param {object} options - Intl.DateTimeFormat options
   * @returns {string} Formatted time string
   */
  static formatLocalTime(dateTime, options = {}) {
    const dateTimeObj = new Date(dateTime);
    const localDateTime = new Date(dateTimeObj.getTime() + this.MAKASSAR_OFFSET);

    return localDateTime.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Makassar',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      ...options
    });
  }

  /**
   * Get month name in Indonesian for local date
   * @param {number} month - Month number (1-12)
   * @param {number} year - Year
   * @returns {string} Month name in Indonesian
   */
  static getLocalMonthName(month, year) {
    const date = new Date(year, month - 1, 1);
    const localDate = new Date(date.getTime() + this.MAKASSAR_OFFSET);

    return localDate.toLocaleDateString('id-ID', {
      timeZone: 'Asia/Makassar',
      month: 'long',
      year: 'numeric'
    });
  }

  /**
   * Check if date is today in local timezone
   * @param {string|Date} date - Date to check
   * @returns {boolean} True if date is today
   */
  static isToday(date) {
    const today = this.getLocalDate();
    const checkDate = typeof date === 'string' ? date : this.utcToLocalDate(date);
    return checkDate === today;
  }

  /**
   * Get start and end of month in local timezone
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @returns {object} Object with startDate and endDate
   */
  static getMonthBounds(year, month) {
    const startDate = this.utcToLocalDate(new Date(year, month - 1, 1));
    const endDate = this.utcToLocalDate(new Date(year, month, 0));

    return { startDate, endDate };
  }

  /**
   * Convert time string to minutes (for attendance calculations)
   * @param {string} timeStr - Time in HH:MM format
   * @returns {number} Minutes from midnight
   */
  static timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Get working days in month (Monday-Friday) for local timezone
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @returns {number} Number of working days
   */
  static getWorkingDaysInMonth(year, month) {
    let workingDays = 0;
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const utcDate = new Date(year, month - 1, day);
      const localDate = new Date(utcDate.getTime() + this.MAKASSAR_OFFSET);
      const dayOfWeek = localDate.getDay();
      // Count weekdays (Monday = 1 to Friday = 5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDays++;
      }
    }

    return workingDays;
  }
}

export default DateTimeUtils;