import axios from 'axios';
import { API_BASE_URL } from '../config';

// Create axios instance with better configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increased timeout
  headers: {
    'Content-Type': 'application/json',
  },
  validateStatus: function (status) {
    return status >= 200 && status < 500; // Resolve only if the status code is less than 500
  }
});

// Helper function to get token from localStorage
const getAuthToken = () => {
  // Try both keys for compatibility
  return localStorage.getItem('notifyflow_token') || localStorage.getItem('token');
};

// Helper function to clear all tokens
const clearAuthTokens = () => {
  localStorage.removeItem('notifyflow_token');
  localStorage.removeItem('token');
};

// Helper function to set token
const setAuthToken = (token) => {
  localStorage.setItem('notifyflow_token', token);
  // Also store with generic key for compatibility
  localStorage.setItem('token', token);
};

// Request interceptor to add auth token with better error handling
api.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('✅ Token attached to request');
    } else {
      console.log('⚠️ No token found in localStorage');
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Enhanced Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    
    // Log response data for debugging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('Response data:', response.data);
    }
    
    return response;
  },
  (error) => {
    console.error('❌ API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message,
      response: error.response?.data
    });
    
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
      
      if (error.response.status === 401) {
        // Token expired or invalid
        console.log('🔒 Unauthorized - Removing token and redirecting to login');
        clearAuthTokens();
        
        // Only redirect if not already on login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      } else if (error.response.status === 404) {
        console.error('🔍 Route not found:', error.config.url);
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('🌐 No response received:', error.request);
      console.error('Network error - check your internet connection or if the server is running');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('⚡ Request setup error:', error.message);
    }
    
    // Return a consistent error format
    return Promise.reject({
      message: error.response?.data?.message || error.message || 'Network error',
      status: error.response?.status,
      data: error.response?.data
    });
  }
);

// Helper function to test API connection
const testApiConnection = async () => {
  try {
    const response = await api.get('/api/test');
    return {
      success: true,
      message: 'API connection successful',
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: 'API connection failed',
      error: error.message
    };
  }
};

// Helper function to test notifications endpoint
const testNotificationsEndpoint = async () => {
  try {
    const response = await api.get('/api/notifications/test');
    return {
      success: true,
      message: 'Notifications endpoint is working',
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: 'Notifications endpoint test failed',
      error: error.message
    };
  }
};

// Helper function to check authentication
const checkAuthStatus = async () => {
  try {
    const token = getAuthToken();
    if (!token) {
      return { isAuthenticated: false, message: 'No token found' };
    }
    
    const response = await api.get('/api/auth/me');
    if (response.data && response.data.success) {
      return { 
        isAuthenticated: true, 
        user: response.data.user 
      };
    } else {
      clearAuthTokens();
      return { 
        isAuthenticated: false, 
        message: response.data?.message || 'Invalid token' 
      };
    }
  } catch (error) {
    console.error('Auth check error:', error);
    clearAuthTokens();
    return { 
      isAuthenticated: false, 
      message: error.message || 'Auth check failed' 
    };
  }
};

// Helper function to handle registration
const registerUser = async (userData) => {
  try {
    const response = await api.post('/api/auth/register', userData);
    
    if (response.data && response.data.success) {
      const { token, user } = response.data;
      
      // Store the token
      setAuthToken(token);
      
      return { 
        success: true, 
        user,
        token 
      };
    } else {
      return { 
        success: false, 
        message: response.data?.message || 'Registration failed' 
      };
    }
  } catch (error) {
    console.error('Registration error:', error);
    return { 
      success: false, 
      message: error.response?.data?.message || 
              error.response?.data?.errors?.join(', ') || 
              'Registration failed. Please try again.' 
    };
  }
};

// Helper function to handle login
const loginUser = async (email, password) => {
  try {
    const response = await api.post('/api/auth/login', { email, password });
    
    if (response.data && response.data.success) {
      const { token, user } = response.data;
      
      // Store the token
      setAuthToken(token);
      
      return { 
        success: true, 
        user,
        token 
      };
    } else {
      return { 
        success: false, 
        message: response.data?.message || 'Login failed' 
      };
    }
  } catch (error) {
    console.error('Login error:', error);
    return { 
      success: false, 
      message: error.response?.data?.message || 'Login failed. Please try again.' 
    };
  }
};

// Helper function to handle logout
const logoutUser = async () => {
  try {
    await api.post('/api/auth/logout');
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    clearAuthTokens();
  }
};

export const apiService = {
  // Auth APIs
  auth: {
    login: (credentials) => api.post('/api/auth/login', credentials),
    register: (userData) => api.post('/api/auth/register', userData),
    getProfile: () => api.get('/api/auth/me'),
    updateProfile: (profileData) => api.put('/api/auth/profile', profileData),
    changePassword: (passwordData) => api.put('/api/auth/change-password', passwordData),
    logout: () => api.post('/api/auth/logout'),
  },

  // User APIs
  users: {
    getProfile: () => api.get('/api/users/profile'),
    updatePreferences: (preferences) => api.put('/api/users/preferences', preferences),
    getMetrics: (period = '7d') => api.get(`/api/users/metrics?period=${period}`),
  },

  // Routine APIs
  routines: {
    getAll: () => api.get('/api/routines'),
    getById: (id) => api.get(`/api/routines/${id}`),
    create: (routineData) => api.post('/api/routines', routineData),
    update: (id, routineData) => api.put(`/api/routines/${id}`, routineData),
    delete: (id) => api.delete(`/api/routines/${id}`),
    toggleActive: (id) => api.patch(`/api/routines/${id}/toggle`),
    
    // Notification scheduling endpoints
    scheduleNotifications: (id) => api.post(`/api/routines/${id}/schedule`),
    cancelNotifications: (id) => api.delete(`/api/routines/${id}/notifications`),
    updateNotifications: (id, updates) => api.put(`/api/routines/${id}/notifications`, updates)
  },

  // Notification APIs - Updated with better error handling
  notifications: {
    getAll: (params = {}) => {
      console.log('📨 Fetching notifications with params:', params);
      
      return api.get('/api/notifications', { params })
        .then(response => {
          console.log('📨 Notifications API Response Details:', {
            status: response.status,
            dataType: typeof response.data,
            isArray: Array.isArray(response.data),
          });
          
          // Ensure we always return an array
          let notifications = [];
          
          if (Array.isArray(response.data)) {
            notifications = response.data;
          } else if (response.data && typeof response.data === 'object') {
            // Extract notifications from various response formats
            if (response.data.notifications && Array.isArray(responseData.notifications)) {
              notifications = response.data.notifications;
            } else if (response.data.data && Array.isArray(response.data.data)) {
              notifications = response.data.data;
            } else {
              // Convert object values to array
              const values = Object.values(response.data);
              notifications = values.filter(v => v && typeof v === 'object');
            }
          }
          
          console.log(`📨 Returning ${notifications.length} notifications`);
          return {
            ...response,
            data: notifications
          };
        })
        .catch(error => {
          console.error('❌ Notifications API error:', error);
          // Return empty array on error
          return {
            data: [],
            status: error.response?.status || 500,
            error: error.message
          };
        });
    },
    
    getStats: () => api.get('/api/notifications/stats'),
    sendResponse: (id, responseData) => api.post(`/api/notifications/${id}/response`, responseData),
    snooze: (id, minutes) => api.post(`/api/notifications/${id}/snooze`, { minutes }),
    // Add test notification endpoint
    test: (data) => api.post('/api/test/test-notification', data),
    getSchedulerStatus: () => api.get('/api/test/scheduler-status')
  },

  // Analytics APIs
  analytics: {
    getAnalytics: (period = '7d') => api.get(`/api/metrics/analytics?period=${period}`),
    getInsights: () => api.get('/api/metrics/insights'),
    getDaily: (date) => api.get(`/api/metrics/daily?date=${date}`),
  },

  // Test APIs
  test: {
    testConnection: () => api.get('/api/test'),
    testNotifications: () => api.get('/api/notifications/test'),
    debugRoutes: () => api.get('/api/debug/routes'),
    getDiagnostics: () => api.get('/api/test/diagnostics'),
    triggerSchedulerCheck: () => api.post('/api/test/trigger-scheduler-check')
  },

  // Health check
  health: () => api.get('/api/health'),
  
  // Helper functions
  testApiConnection,
  testNotificationsEndpoint,
  checkAuthStatus,
  registerUser,
  loginUser,
  logoutUser,
  
  // Token management functions
  getAuthToken,
  setAuthToken,
  clearAuthTokens
};

// Token management for external use
export const tokenService = {
  getToken: getAuthToken,
  setToken: setAuthToken,
  clearToken: clearAuthTokens,
  isAuthenticated: () => !!getAuthToken()
};

// Export everything correctly
export { 
  api, 
  testApiConnection, 
  testNotificationsEndpoint,
  getAuthToken,
  setAuthToken,
  clearAuthTokens
};