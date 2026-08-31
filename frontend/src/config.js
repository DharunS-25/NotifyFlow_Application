// Application configuration
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Sound files configuration
export const SOUNDS = {
  chime: '/sounds/chime.mp3',
  bell: '/sounds/bell.mp3',
  digital: '/sounds/digital.mp3',
  nature: '/sounds/nature.mp3'
};

// Notification types
export const NOTIFICATION_TYPES = {
  ALARM: 'alarm',
  REMINDER: 'reminder',
  BREAK: 'break',
  URGENT: 'urgent'
};

// Routine categories
export const ROUTINE_CATEGORIES = [
  { value: 'work', label: 'Work', color: '#4CAF50', icon: '💼' },
  { value: 'break', label: 'Break', color: '#FF9800', icon: '☕' },
  { value: 'exercise', label: 'Exercise', color: '#2196F3', icon: '💪' },
  { value: 'meeting', label: 'Meeting', color: '#9C27B0', icon: '👥' },
  { value: 'personal', label: 'Personal', color: '#607D8B', icon: '🎯' },
  { value: 'health', label: 'Health', color: '#E91E63', icon: '❤️' }
];

// Days of week
export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' }
];

// Sound options
export const SOUND_OPTIONS = [
  { value: 'chime', label: 'Gentle Chime', description: 'Soft and pleasant' },
  { value: 'bell', label: 'Classic Bell', description: 'Traditional bell sound' },
  { value: 'digital', label: 'Digital Beep', description: 'Modern digital beep' },
  { value: 'nature', label: 'Nature Sounds', description: 'Calming nature sounds' }
];

// Priority levels
export const PRIORITY_LEVELS = [
  { value: 1, label: 'Low', color: '#4CAF50' },
  { value: 2, label: 'Medium', color: '#FF9800' },
  { value: 3, label: 'High', color: '#F44336' },
  { value: 4, label: 'Urgent', color: '#9C27B0' },
  { value: 5, label: 'Critical', color: '#FF0000' }
];

// Default settings
export const DEFAULT_SETTINGS = {
  volume: 0.7,
  sound: 'chime',
  workingHours: { start: '09:00', end: '17:00' },
  breakInterval: 60
};

// Local storage keys
export const STORAGE_KEYS = {
  USER_PREFERENCES: 'notifyflow_user_preferences',
  ROUTINES_CACHE: 'notifyflow_routines_cache',
  NOTIFICATIONS_CACHE: 'notifyflow_notifications_cache'
};
