// src/utils/notificationResponseHandler.js - ENHANCED VERSION
import { soundService } from '../services/soundService';
import { apiService } from '../services/api';
import { socketService } from '../services/socket';

class NotificationResponseHandler {
  constructor() {
    this.isProcessing = false;
    this.pendingResponses = [];
  }

  // Enhanced method to completely stop all sounds
  async stopAllSoundsCompletely() {
    console.log('🔇 Stopping ALL sounds completely...');
    
    // Multiple methods to ensure sound stops
    await soundService.emergencyStop();
    
    // Additional cleanup
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
    });
    
    // Clear any remaining timeouts
    const maxTimeoutId = setTimeout(() => {}, 0);
    for (let i = 0; i < maxTimeoutId; i++) {
      clearTimeout(i);
      clearInterval(i);
    }
    
    console.log('✅ All sounds stopped completely');
    return true;
  }

  async handleResponse(notification, action, responseTime, snoozeMinutes = null) {
    if (this.isProcessing) {
      console.warn('Already processing a response');
      return { success: false, message: 'Already processing' };
    }

    this.isProcessing = true;
    
    try {
      console.log(`📢 Processing ${action} response for: ${notification.title}`);
      
      // STEP 1: IMMEDIATE SOUND STOPPING
      await this.stopAllSoundsCompletely();
      
      // STEP 2: Prepare response data
      const responseData = {
        notificationId: notification.id || notification._id,
        action,
        responseTime: responseTime || 0,
        timestamp: new Date().toISOString(),
        ...(action === 'snoozed' && { snoozeMinutes: snoozeMinutes || 5 })
      };

      console.log('📤 Sending response data:', responseData);

      // STEP 3: Send to backend via multiple channels
      const backendResult = await this.sendResponseToBackend(notification, responseData);

      if (!backendResult.success) {
        throw new Error(backendResult.message || 'Backend response failed');
      }

      // STEP 4: Update local state (for immediate UI update)
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
        }),
        processing: false
      };

      // STEP 5: Show success feedback
      this.showUserFeedback(action, responseTime);

      console.log(`✅ ${action.toUpperCase()} response processed successfully`);

      return {
        success: true,
        message: `Notification ${action} successfully`,
        notification: updatedNotification,
        backendResult
      };

    } catch (error) {
      console.error('❌ Error in notification response:', error);
      
      // Re-enable sounds for retry
      setTimeout(() => {
        console.log('🔄 Re-initializing sound system for retry');
        soundService.initializeSounds();
      }, 1000);
      
      return {
        success: false,
        message: error.message || 'Failed to process response',
        error
      };
    } finally {
      this.isProcessing = false;
    }
  }

  async sendResponseToBackend(notification, responseData) {
    const results = {
      socket: false,
      api: false,
      errors: []
    };

    // Try Socket.io first (real-time)
    try {
      if (socketService.getConnectionStatus().isConnected) {
        socketService.sendNotificationResponse(responseData);
        results.socket = true;
        console.log('✅ Response sent via WebSocket');
      } else {
        throw new Error('Socket not connected');
      }
    } catch (socketError) {
      console.error('❌ WebSocket failed:', socketError);
      results.errors.push({ type: 'socket', error: socketError });
    }

    // Try REST API for redundancy
    try {
      const response = await apiService.notifications.sendResponse(
        responseData.notificationId,
        {
          action: responseData.action,
          responseTime: responseData.responseTime,
          ...(responseData.snoozeMinutes && { snoozeMinutes: responseData.snoozeMinutes })
        }
      );
      
      if (response.data && response.data.success) {
        results.api = true;
        console.log('✅ API response successful:', response.data);
      } else {
        throw new Error(response.data?.message || 'API response unsuccessful');
      }
    } catch (apiError) {
      console.error('❌ API failed:', apiError);
      results.errors.push({ type: 'api', error: apiError });
    }

    // If both failed, store for retry
    if (!results.socket && !results.api) {
      console.warn('⚠️ All communication failed, storing for retry');
      this.pendingResponses.push({
        ...responseData,
        timestamp: new Date(),
        retryCount: 0
      });
      
      // Schedule retry
      setTimeout(() => this.retryPendingResponses(), 3000);
    }

    return {
      success: results.socket || results.api,
      ...results
    };
  }

  showUserFeedback(action, responseTime) {
    // Show subtle browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      const messages = {
        completed: 'Task completed!',
        snoozed: 'Reminder snoozed',
        dismissed: 'Reminder dismissed'
      };
      
      try {
        new Notification('NotifyFlow', {
          body: `${messages[action]} (${responseTime}s)`,
          icon: '/favicon.ico',
          silent: true
        });
      } catch (error) {
        console.warn('Could not show notification:', error);
      }
    }
    
    // Visual feedback
    console.log(`✅ ${action} action completed in ${responseTime} seconds`);
  }

  async retryPendingResponses() {
    if (this.pendingResponses.length === 0) return;
    
    console.log(`🔄 Retrying ${this.pendingResponses.length} pending responses`);
    
    for (let i = this.pendingResponses.length - 1; i >= 0; i--) {
      const response = this.pendingResponses[i];
      
      if (response.retryCount >= 3) {
        console.warn(`Max retries reached for response ${response.notificationId}`);
        this.pendingResponses.splice(i, 1);
        continue;
      }
      
      try {
        const apiResponse = await apiService.notifications.sendResponse(
          response.notificationId,
          {
            action: response.action,
            responseTime: response.responseTime,
            ...(response.snoozeMinutes && { snoozeMinutes: response.snoozeMinutes })
          }
        );
        
        if (apiResponse.data && apiResponse.data.success) {
          console.log(`✅ Successfully synced pending response ${response.notificationId}`);
          this.pendingResponses.splice(i, 1);
        } else {
          response.retryCount += 1;
          console.warn(`Retry ${response.retryCount} failed for ${response.notificationId}`);
        }
      } catch (error) {
        response.retryCount += 1;
        console.warn(`Retry ${response.retryCount} error for ${response.notificationId}:`, error);
      }
    }
  }
}

// Export singleton instance
const notificationResponseHandler = new NotificationResponseHandler();
export default notificationResponseHandler;