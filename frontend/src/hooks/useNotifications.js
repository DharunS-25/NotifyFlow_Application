// frontend/src/hooks/useNotifications.js - COMPLETE UPDATED VERSION
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/api';
import { socketService } from '../services/socket';
import { soundService } from '../services/soundService';
import notificationResponseHandler from '../utils/notificationResponseHandler';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [currentNotification, setCurrentNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [responseTime, setResponseTime] = useState(0);
  const [responseTimer, setResponseTimer] = useState(null);
  const [soundStatus, setSoundStatus] = useState({
    isPlaying: false,
    isMuted: false,
    volume: 0.7
  });
  const [processingAction, setProcessingAction] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'success', 'error'

  // Use refs for values that need to be accessed in cleanup
  const soundStopRef = useRef(null);
  const responseTimerRef = useRef(null);
  const currentNotificationRef = useRef(null);
  const isProcessingRef = useRef(false);
  const pendingActionsRef = useRef([]);
  const cleanupRef = useRef(false);

  // Sync refs with state
  useEffect(() => {
    currentNotificationRef.current = currentNotification;
  }, [currentNotification]);

  // Helper function to extract array from API response
  const extractNotificationsArray = (responseData) => {
    console.log('🔍 Extracting array from:', responseData);
    
    if (Array.isArray(responseData)) {
      return responseData;
    }
    
    if (responseData && typeof responseData === 'object') {
      if (responseData.notifications && Array.isArray(responseData.notifications)) {
        return responseData.notifications;
      }
      if (responseData.data && Array.isArray(responseData.data)) {
        return responseData.data;
      }
      if (responseData.results && Array.isArray(responseData.results)) {
        return responseData.results;
      }
      
      const values = Object.values(responseData);
      if (values.length > 0 && values.every(v => v && typeof v === 'object')) {
        return values;
      }
      
      if (responseData._id || responseData.id) {
        return [responseData];
      }
    }
    
    return [];
  };

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setSyncStatus('loading');
      
      console.log('📨 Loading notifications from API...');
      const response = await apiService.notifications.getAll();
      
      console.log('📨 API Response received:', {
        status: response.status,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data)
      });
      
      const notificationsArray = extractNotificationsArray(response.data);
      
      console.log('📨 Extracted notifications count:', notificationsArray.length);
      
      setNotifications(notificationsArray);
      setSyncStatus('success');
      
      return notificationsArray;
      
    } catch (err) {
      console.error('❌ Error loading notifications:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load notifications';
      setError(errorMessage);
      setSyncStatus('error');
      setNotifications([]);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Clean up all timers and sounds
  const cleanupAll = useCallback(() => {
    if (cleanupRef.current) return;
    
    console.log('🧹 Cleaning up all timers and sounds');
    
    // Stop response timer
    if (responseTimerRef.current) {
      clearInterval(responseTimerRef.current);
      responseTimerRef.current = null;
      setResponseTimer(null);
    }
    
    // Reset response time
    setResponseTime(0);
    
    // Emergency stop all sounds
    soundService.emergencyStop();
    
    // Clear sound stop function
    if (soundStopRef.current) {
      try {
        soundStopRef.current();
      } catch (e) {
        console.warn('Error in sound stop function:', e);
      }
      soundStopRef.current = null;
    }
    
    // Update sound status
    setSoundStatus(prev => ({
      ...prev,
      isPlaying: false,
      isMuted: false
    }));

    console.log('✅ Cleanup complete');
  }, []);

  const addNotification = useCallback((notificationData) => {
    console.log('🔔 Adding new notification:', notificationData);
    
    // Clean up any existing notification first
    cleanupAll();
    
    const newNotification = {
      ...notificationData,
      _id: notificationData.id || `temp-${Date.now()}`,
      status: 'delivered',
      deliveredAt: new Date(),
      createdAt: new Date()
    };

    setNotifications(prev => [newNotification, ...prev]);
    setCurrentNotification(newNotification);
    setProcessingAction(null);
    setSyncStatus('idle');

    // Start response timer
    setResponseTime(0);
    const timer = setInterval(() => {
      setResponseTime(prev => {
        if (prev >= 300 || cleanupRef.current) {
          clearInterval(timer);
          return 300;
        }
        return prev + 1;
      });
    }, 1000);
    
    responseTimerRef.current = timer;
    setResponseTimer(timer);

    // Play sound for the notification
    if (notificationData.sound) {
      console.log(`🎵 Playing sound: ${notificationData.sound} at ${notificationData.volume || 0.7} volume`);
      
      // Stop any previous sound
      if (soundStopRef.current) {
        soundStopRef.current();
      }

      // Play sound repeatedly
      const stopSound = soundService.playForNotification(
        notificationData.sound, 
        notificationData.volume || 0.7
      );

      soundStopRef.current = stopSound;
      
      // Update sound status
      setSoundStatus(prev => ({
        ...prev,
        isPlaying: true,
        volume: notificationData.volume || 0.7
      }));
    }

    // Show browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`NotifyFlow: ${notificationData.title}`, {
          body: notificationData.message,
          icon: '/favicon.ico',
          tag: 'notifyflow-notification',
          requireInteraction: true,
          silent: false
        });
      } catch (error) {
        console.warn('Could not show browser notification:', error);
      }
    }

    console.log('✅ New notification added:', notificationData.title);
  }, [cleanupAll]);

  // ENHANCED NOTIFICATION RESPONSE HANDLER
  const handleNotificationResponse = useCallback(async (action, responseTime, snoozeMinutes = null) => {
    if (isProcessingRef.current) {
      console.warn('⚠️ Already processing a response');
      pendingActionsRef.current.push({ action, responseTime, snoozeMinutes });
      return { success: false, message: 'Already processing a response' };
    }

    const notification = currentNotificationRef.current;
    if (!notification) {
      console.error('❌ No current notification to respond to');
      return { success: false, message: 'No notification to respond to' };
    }

    console.log(`📢 Processing ${action} response for: ${notification.title}`);
    console.log(`⏱️ Response time: ${responseTime} seconds`);
    
    isProcessingRef.current = true;
    setProcessingAction(action);
    setSyncStatus('syncing');

    try {
      // STEP 1: Use the enhanced response handler
      const result = await notificationResponseHandler.handleResponse(
        notification,
        action,
        responseTime || 0,
        snoozeMinutes
      );

      if (!result.success) {
        throw new Error(result.message || 'Response failed');
      }

      // STEP 2: Update local state
      const updatedNotification = {
        ...notification,
        status: action === 'snoozed' ? 'snoozed' : action,
        userResponse: {
          action,
          responseTime: responseTime || 0,
          timestamp: new Date()
        },
        ...(action === 'completed' && { completedAt: new Date() }),
        ...(action === 'snoozed' && { 
          snoozedUntil: new Date(Date.now() + (snoozeMinutes || 5) * 60000)
        })
      };

      // Update notifications list
      setNotifications(prev => 
        prev.map(n => 
          (n._id === notification._id || n.id === notification.id) 
            ? updatedNotification 
            : n
        )
      );

      // Clear current notification
      setCurrentNotification(null);

      // Clean up timers
      if (responseTimerRef.current) {
        clearInterval(responseTimerRef.current);
        responseTimerRef.current = null;
        setResponseTimer(null);
      }
      
      setResponseTime(0);
      setSyncStatus('success');

      console.log(`✅ Notification ${action} in ${responseTime}s`);
      
      // STEP 3: Load updated analytics data
      setTimeout(async () => {
        try {
          await loadNotifications(); // Reload notifications for updated analytics
        } catch (error) {
          console.warn('Could not reload notifications:', error);
        }
      }, 500);

      // Clear sync status after success
      setTimeout(() => {
        setSyncStatus('idle');
      }, 1000);

      return { 
        success: true, 
        message: `Notification ${action} successfully`,
        data: result 
      };

    } catch (err) {
      console.error('❌ Error handling notification response:', err);
      setError(err.message || 'Failed to process response');
      setSyncStatus('error');
      
      // Restore notification for retry
      setTimeout(() => {
        console.log('🔄 Restoring notification for retry');
        setCurrentNotification(notification);
        setResponseTime(0);
        
        // Restart timer
        const timer = setInterval(() => {
          setResponseTime(prev => {
            if (prev >= 300 || cleanupRef.current) {
              clearInterval(timer);
              return 300;
            }
            return prev + 1;
          });
        }, 1000);
        responseTimerRef.current = timer;
        setResponseTimer(timer);
        setSyncStatus('idle');
      }, 2000);
      
      return { 
        success: false, 
        message: err.message || 'Failed to sync response',
        error: err 
      };
    } finally {
      isProcessingRef.current = false;
      setProcessingAction(null);
      
      // Process any pending actions
      if (pendingActionsRef.current.length > 0) {
        const nextAction = pendingActionsRef.current.shift();
        setTimeout(() => {
          handleNotificationResponse(nextAction.action, nextAction.responseTime, nextAction.snoozeMinutes);
        }, 1000);
      }
    }
  }, [loadNotifications]);

  const clearCurrentNotification = useCallback(() => {
    console.log('🧹 Clearing current notification manually');
    cleanupAll();
    setCurrentNotification(null);
    setProcessingAction(null);
    setSyncStatus('idle');
  }, [cleanupAll]);

  // Test notification sound locally
  const testNotificationSound = useCallback((soundType = 'chime', volume = 0.7) => {
    console.log(`🧪 Testing notification sound: ${soundType} at ${volume} volume`);
    
    // Clean up any existing sounds first
    cleanupAll();
    
    // Create a test notification
    const testNotification = {
      id: 'test-' + Date.now(),
      title: 'Test Notification',
      message: 'This is a test notification to verify sound works',
      sound: soundType,
      volume: volume,
      type: 'alarm',
      timestamp: new Date(),
      user: { id: 'test-user' }
    };
    
    // Add to notifications list
    setNotifications(prev => [testNotification, ...prev]);
    
    // Set as current notification
    setCurrentNotification(testNotification);
    setSyncStatus('idle');
    
    // Start response timer for test notification
    setResponseTime(0);
    const timer = setInterval(() => {
      setResponseTime(prev => {
        if (prev >= 300 || cleanupRef.current) {
          clearInterval(timer);
          return 300;
        }
        return prev + 1;
      });
    }, 1000);
    
    responseTimerRef.current = timer;
    setResponseTimer(timer);
    
    // Play sound using the sound service
    const stopSound = soundService.playForNotification(soundType, volume);
    
    soundStopRef.current = stopSound;
    
    // Update sound status
    setSoundStatus(prev => ({
      ...prev,
      isPlaying: true,
      volume: volume
    }));
    
    console.log('✅ Test notification created and sound playing');
  }, [cleanupAll]);

  // Sync with backend
  const syncWithBackend = useCallback(async () => {
    try {
      setSyncStatus('syncing');
      await loadNotifications();
      console.log('✅ Synced with backend');
      setSyncStatus('success');
      
      // Clear success status after delay
      setTimeout(() => {
        setSyncStatus('idle');
      }, 2000);
      
    } catch (error) {
      console.error('❌ Sync failed:', error);
      setSyncStatus('error');
      
      // Clear error status after delay
      setTimeout(() => {
        setSyncStatus('idle');
      }, 3000);
    }
  }, [loadNotifications]);

  // Initialize socket listeners
  useEffect(() => {
    // Request notification permission on app start
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }

    // Listen for real-time notifications
    const handleSocketNotification = (notificationData) => {
      console.log('🔔 Received real-time notification:', notificationData);
      
      if (notificationData.broadcast) {
        console.log('📢 Broadcast notification:', notificationData);
      }
      
      addNotification(notificationData);
    };

    // Listen for notification updates
    const handleNotificationUpdate = (data) => {
      console.log('🔄 Notification update received:', data);
      
      // Update notification in state
      setNotifications(prev => 
        prev.map(notif => {
          const notifId = notif.id || notif._id;
          const updatedId = data.notificationId || data.id;
          
          if (notifId === updatedId) {
            return {
              ...notif,
              status: data.status,
              snoozedUntil: data.snoozedUntil,
              completedAt: data.completedAt,
              userResponse: {
                action: data.action,
                responseTime: data.responseTime,
                timestamp: data.timestamp
              }
            };
          }
          return notif;
        })
      );
    };

    // Listen for connection established
    const handleConnectionEstablished = (data) => {
      console.log('✅ Socket connection established:', data);
      // Sync data when connection is established
      syncWithBackend();
    };

    socketService.onNotification(handleSocketNotification);
    socketService.onNotificationUpdate(handleNotificationUpdate);
    socketService.on('connection-established', handleConnectionEstablished);

    // Load initial notifications
    syncWithBackend();

    // Cleanup
    return () => {
      cleanupRef.current = true;
      cleanupAll();
      socketService.off('notification', handleSocketNotification);
      socketService.off('notification-update', handleNotificationUpdate);
      socketService.off('connection-established', handleConnectionEstablished);
    };
  }, [addNotification, cleanupAll, syncWithBackend]);

  // Auto-dismiss notification after 5 minutes
  useEffect(() => {
    if (!currentNotification || responseTime < 300) return;

    const autoDismissTimer = setTimeout(() => {
      if (currentNotificationRef.current && !isProcessingRef.current) {
        console.log('⏰ Auto-dismissing notification after 5 minutes');
        handleNotificationResponse('dismissed', 300);
      }
    }, 300000);

    return () => clearTimeout(autoDismissTimer);
  }, [currentNotification, responseTime, handleNotificationResponse]);

  return {
    // State
    notifications,
    currentNotification,
    loading,
    error,
    responseTime,
    soundStatus,
    processingAction,
    syncStatus,
    
    // Actions
    addNotification,
    handleNotificationResponse,
    clearCurrentNotification,
    markAsRead: useCallback((notificationId) => {
      setNotifications(prev =>
        prev.map(notif =>
          (notif._id === notificationId || notif.id === notificationId)
            ? { ...notif, read: true }
            : notif
        )
      );
    }, []),
    deleteNotification: useCallback((notificationId) => {
      setNotifications(prev =>
        prev.filter(notif => !(notif._id === notificationId || notif.id === notificationId))
      );
    }, []),
    loadNotifications: syncWithBackend,
    testNotificationSound,
    
    // Sound control
    toggleSoundMute: useCallback(() => {
      const isMuted = soundService.toggleMute();
      setSoundStatus(prev => ({
        ...prev,
        isMuted,
        isPlaying: isMuted ? false : prev.isPlaying
      }));
      return isMuted;
    }, []),
    
    emergencyStopSound: useCallback(() => {
      soundService.emergencyStop();
      setSoundStatus(prev => ({
        ...prev,
        isPlaying: false,
        isMuted: false
      }));
      clearCurrentNotification();
    }, [clearCurrentNotification]),
    
    setSoundVolume: useCallback((volume) => {
      soundService.setVolume(volume);
      setSoundStatus(prev => ({
        ...prev,
        volume
      }));
    }, []),
    
    // Utilities
    getNotificationStats: useCallback(() => {
      const safeNotifications = Array.isArray(notifications) ? notifications : [];
      const total = safeNotifications.length;
      const completed = safeNotifications.filter(n => n.status === 'completed').length;
      const dismissed = safeNotifications.filter(n => n.status === 'dismissed').length;
      const snoozed = safeNotifications.filter(n => n.status === 'snoozed').length;
      const pending = safeNotifications.filter(n => n.status === 'delivered').length;

      const completionRate = total > 0 ? (completed / total) * 100 : 0;

      return {
        total,
        completed,
        dismissed,
        snoozed,
        pending,
        completionRate: Math.round(completionRate * 100) / 100
      };
    }, [notifications]),
    
    filterNotifications: useCallback((status) => {
      const safeNotifications = Array.isArray(notifications) ? notifications : [];
      return safeNotifications.filter(notif => notif.status === status);
    }, [notifications]),
    
    // Get current sound status
    getSoundStatus: () => soundStatus,
    
    // Manual cleanup for component unmount
    cleanup: cleanupAll
  };
};