// frontend/src/services/socket.js
import io from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { soundService } from './soundService';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.eventListeners = new Map();
    this.pendingResponses = [];
  }

  init() {
    try {
      const token = localStorage.getItem('notifyflow_token') || localStorage.getItem('token');
      
      this.socket = io(API_BASE_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        timeout: 20000,
        auth: {
          token: token
        }
      });

      this.setupEventListeners();
      return this.socket;
    } catch (error) {
      console.error('Socket initialization failed:', error);
      return null;
    }
  }

  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.isConnected = false;
      this.reconnectAttempts++;
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      this.isConnected = true;
      this.handleReconnect(); // Send any pending responses
    });

    this.socket.on('notification', (notification) => {
      console.log('📢 Received notification:', notification);
      this.emitEvent('notification', notification);
      
      if (notification.sound) {
        soundService.play(notification.sound, notification.volume || 0.7);
      }
    });

    this.socket.on('notification-update', (data) => {
      this.emitEvent('notification-update', data);
    });

    this.socket.on('connection-established', (data) => {
      console.log('Connection established:', data);
      this.emitEvent('connection-established', data);
    });

    this.socket.on('test-notification-sent', (data) => {
      this.emitEvent('test-notification-sent', data);
    });

    // Add acknowledgment listener
    this.socket.on('notification-ack', (data) => {
      console.log('✅ Server acknowledged notification response:', data);
      this.emitEvent('notification-ack', data);
    });
  }

  // Handle reconnection and send pending responses
  handleReconnect() {
    if (this.socket && this.isConnected && this.pendingResponses && this.pendingResponses.length > 0) {
      console.log('📤 Sending', this.pendingResponses.length, 'pending responses');
      
      this.pendingResponses.forEach((response, index) => {
        setTimeout(() => {
          this.sendNotificationResponse(response);
        }, index * 500); // Stagger sends
      });
      
      this.pendingResponses = [];
    }
  }

  // Event listener methods
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
    
    // Also listen directly on socket if it exists
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
    
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emitEvent(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  // Specific event methods for backward compatibility
  onNotification(callback) {
    this.on('notification', callback);
  }

  onNotificationUpdate(callback) {
    this.on('notification-update', callback);
  }

  onConnectionEstablished(callback) {
    this.on('connection-established', callback);
  }

  onNotificationAck(callback) {
    this.on('notification-ack', callback);
  }

  // Updated sendNotificationResponse method
  sendNotificationResponse(responseData) {
    if (this.socket && this.isConnected) {
      console.log('📤 Sending notification response via socket:', responseData);
      
      // Send the response
      this.socket.emit('notification-response', responseData);
      
      // Request acknowledgment
      this.socket.emit('notification-ack', {
        notificationId: responseData.notificationId,
        action: responseData.action,
        timestamp: new Date()
      });
    } else {
      console.warn('⚠️ Socket not connected, response not sent');
      
      // Store response for later retry
      this.pendingResponses.push({
        ...responseData,
        timestamp: new Date(),
        retryCount: 0
      });
      
      // Try to reconnect and send pending responses
      if (!this.isConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          console.log('🔄 Attempting to reconnect socket...');
          this.init();
        }, 1000);
      }
    }
  }

  joinUser(userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-user', userId);
      console.log('User joined socket room:', userId);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.eventListeners.clear();
      console.log('Socket disconnected');
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      socketId: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts,
      pendingResponses: this.pendingResponses.length
    };
  }

  // Clear pending responses
  clearPendingResponses() {
    console.log('🧹 Clearing pending responses:', this.pendingResponses.length);
    this.pendingResponses = [];
  }
}

// Create and export singleton instance
const socketService = new SocketService();
export { socketService };