// src/components/NotificationModal.js - COMPLETE UPDATED VERSION
// FIX: Stop sound FIRST before any action

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { soundService } from '../services/soundService';
import notificationResponseHandler from '../utils/notificationResponseHandler';
import "./NotificationModal.css";

const NotificationModal = ({ notification, onResponse, onClose, responseTime }) => {
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [soundStopped, setSoundStopped] = useState(false);
  
  const responseRef = useRef({
    hasResponded: false,
    responseTime: responseTime
  });

  const cleanupRef = useRef(false);
  const soundStopRef = useRef(null);

  // Update ref when responseTime changes
  useEffect(() => {
    responseRef.current.responseTime = responseTime;
  }, [responseTime]);

  // CRITICAL FIX: Stop sound immediately when modal mounts if not already stopped
  useEffect(() => {
    if (notification && !soundStopped) {
      console.log('🔇 NotificationModal mounted - stopping any playing sounds first');
      soundService.emergencyStop();
      setSoundStopped(true);
    }
    
    return () => {
      if (!responseRef.current.hasResponded && !cleanupRef.current) {
        soundService.emergencyStop();
      }
    };
  }, [notification, soundStopped]);

  // Auto-dismiss after 5 minutes
  useEffect(() => {
    if (!notification || isProcessing) return;

    const autoDismissTimer = setTimeout(() => {
      if (!responseRef.current.hasResponded && !cleanupRef.current) {
        console.log('⏰ Auto-dismissing notification after 5 minutes');
        handleResponse('dismissed', responseRef.current.responseTime);
      }
    }, 300000);

    return () => {
      clearTimeout(autoDismissTimer);
    };
  }, [notification, isProcessing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current = true;
      if (!responseRef.current.hasResponded) {
        console.log('🧹 Cleaning up notification modal - stopping sounds');
        soundService.emergencyStop();
      }
    };
  }, []);

  // CRITICAL FIX: Stop sound FIRST before any action
  const stopSoundImmediately = useCallback(async () => {
    console.log('🔇 Stopping sound immediately before action...');
    
    // Multiple methods to ensure sound stops
    await soundService.emergencyStop();
    
    // Additional cleanup
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        audio.load();
      } catch (e) {
        // Ignore errors
      }
    });
    
    setSoundStopped(true);
    console.log('✅ Sound stopped successfully');
    
    // Small delay to ensure sound is fully stopped
    await new Promise(resolve => setTimeout(resolve, 50));
  }, []);

  const handleResponse = useCallback(async (action, customSnoozeMinutes = null) => {
    // Prevent double responses
    if (responseRef.current.hasResponded || isProcessing) {
      console.warn('⚠️ Already processing response or already responded');
      return;
    }

    console.log(`🔄 Processing ${action} response...`);
    
    // STEP 1: STOP SOUND IMMEDIATELY - CRITICAL FIX
    await stopSoundImmediately();
    
    // Mark as responded to prevent double execution
    responseRef.current.hasResponded = true;
    setIsProcessing(true);
    setError(null);
    setSyncStatus('syncing');

    try {
      // STEP 2: Use the enhanced response handler to update backend
      const result = await notificationResponseHandler.handleResponse(
        notification,
        action,
        responseRef.current.responseTime || 0,
        customSnoozeMinutes
      );

      if (!result.success) {
        throw new Error(result.message || 'Response failed');
      }

      console.log(`✅ ${action} response processed successfully`);
      
      // Update sync status
      setSyncStatus('success');
      
      // Small delay to show success state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reset state
      setShowSnoozeOptions(false);
      setIsProcessing(false);

      // Call parent callback if provided
      if (onResponse) {
        await onResponse(action, responseRef.current.responseTime || 0, customSnoozeMinutes);
      }

      // Auto-close after success
      setTimeout(() => {
        if (onClose) onClose();
      }, 300);

    } catch (error) {
      console.error('❌ Error in handleResponse:', error);
      setError(error.message || 'Failed to process response');
      setSyncStatus('error');
      
      // Reset flags to allow retry
      responseRef.current.hasResponded = false;
      setIsProcessing(false);
      
      // Show error but don't close modal
      setTimeout(() => {
        console.log('🔄 Ready for retry after error');
      }, 2000);
    }
  }, [notification, onResponse, onClose, isProcessing, stopSoundImmediately]);

  const handleSnooze = useCallback((minutes) => {
    console.log(`⏰ Snooze selected: ${minutes} minutes`);
    handleResponse('snoozed', minutes);
    setShowSnoozeOptions(false);
  }, [handleResponse]);

  const getSnoozeOptions = () => {
    const routineSnoozeDuration = notification?.routine?.notificationSettings?.snoozeDuration;
    
    if (routineSnoozeDuration) {
      return [
        { minutes: routineSnoozeDuration, label: `${routineSnoozeDuration} minutes` },
        { minutes: routineSnoozeDuration * 2, label: `${routineSnoozeDuration * 2} minutes` },
        { minutes: 15, label: '15 minutes' },
        { minutes: 30, label: '30 minutes' },
      ];
    }
    
    return [
      { minutes: 5, label: '5 minutes' },
      { minutes: 10, label: '10 minutes' },
      { minutes: 15, label: '15 minutes' },
      { minutes: 30, label: '30 minutes' },
    ];
  };

  // CRITICAL FIX: Emergency stop - stop sound immediately and then dismiss
  const handleEmergencyStop = useCallback(async () => {
    console.log('🆘 Emergency stop clicked - stopping sound immediately');
    
    // Stop sound FIRST
    await stopSoundImmediately();
    
    // Then dismiss the notification
    handleResponse('dismissed', responseRef.current.responseTime);
  }, [handleResponse, stopSoundImmediately]);

  if (!notification) return null;

  return (
    <div className="notification-overlay">
      <div className="notification-modal">
        {/* Header with processing indicator */}
        <div className="notification-header">
          <div className="pulse-animation">
            <div className="pulse-ring"></div>
            <div className="pulse-ring delay-1"></div>
            <div className="pulse-ring delay-2"></div>
            <div className="alarm-icon">
              {isProcessing ? '⏳' : (soundStopped ? '🔇' : '🔔')}
            </div>
          </div>
          <h2>Time for your routine!</h2>
          <p>Response time: {responseTime}s {syncStatus === 'syncing' && '(Syncing...)'}</p>
          {soundStopped && (
            <p className="sound-stopped-indicator">🔇 Sound stopped</p>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="notification-error">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{error}</span>
            <button 
              className="error-retry"
              onClick={() => {
                setError(null);
                responseRef.current.hasResponded = false;
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Notification Content */}
        <div className="notification-content">
          <div className="notification-title">
            <h3>{notification.title}</h3>
          </div>
          <div className="notification-message">
            <p>{notification.message}</p>
          </div>
          
          <div className="notification-meta">
            <span className="meta-item">
              🔊 Sound: {notification.sound || 'chime'} 
            </span>
            <span className="meta-item">
              🎚️ Volume: {Math.round((notification.volume || 0.7) * 100)}%
            </span>
            <span className="meta-item">
              ⏱️ Elapsed: {responseTime}s
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="notification-actions">
          {!showSnoozeOptions ? (
            <>
              <button 
                className={`action-btn complete-btn ${isProcessing ? 'processing' : ''}`}
                onClick={() => handleResponse('completed')}
                disabled={isProcessing}
                autoFocus
              >
                <span className="btn-icon">
                  {isProcessing ? '⏳' : '✅'}
                </span>
                <span className="btn-text">
                  {isProcessing ? 'Processing...' : 'Complete'}
                </span>
                <span className="btn-hint">Mark as done</span>
              </button>

              <button 
                className={`action-btn snooze-btn ${isProcessing ? 'processing' : ''}`}
                onClick={() => setShowSnoozeOptions(true)}
                disabled={isProcessing}
              >
                <span className="btn-icon">⏰</span>
                <span className="btn-text">Snooze</span>
                <span className="btn-hint">Remind me later</span>
              </button>

              <button 
                className={`action-btn dismiss-btn ${isProcessing ? 'processing' : ''}`}
                onClick={() => handleResponse('dismissed')}
                disabled={isProcessing}
              >
                <span className="btn-icon">❌</span>
                <span className="btn-text">Dismiss</span>
                <span className="btn-hint">Skip this time</span>
              </button>
            </>
          ) : (
            <div className="snooze-options">
              <h4>Snooze for:</h4>
              <div className="snooze-buttons">
                {getSnoozeOptions().map((option, index) => (
                  <button 
                    key={index}
                    className="snooze-option"
                    onClick={() => handleSnooze(option.minutes)}
                    disabled={isProcessing}
                  >
                    {option.label}
                  </button>
                ))}
                <button 
                  className="snooze-option custom"
                  onClick={() => {
                    const minutes = prompt('Enter custom snooze time (minutes):', '10');
                    if (minutes && !isNaN(minutes) && minutes > 0 && minutes <= 480) {
                      handleSnooze(parseInt(minutes));
                    } else {
                      alert('Please enter a valid number between 1 and 480 minutes.');
                    }
                  }}
                  disabled={isProcessing}
                >
                  Custom...
                </button>
              </div>
              <button 
                className="back-btn"
                onClick={() => setShowSnoozeOptions(false)}
                disabled={isProcessing}
              >
                ← Back
              </button>
            </div>
          )}
        </div>

        {/* Emergency Stop Button */}
        <div className="emergency-stop">
          <button 
            className="stop-btn emergency"
            onClick={handleEmergencyStop}
            disabled={isProcessing}
          >
            🆘 Emergency Stop All Sounds
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="response-timer">
          <div className="timer-bar">
            <div 
              className="timer-progress"
              style={{ width: `${Math.min(100, (responseTime / 300) * 100)}%` }}
            ></div>
          </div>
          <span className="timer-text">
            {responseTime}s / 300s (Auto-dismiss)
          </span>
        </div>

        {/* Processing Overlay - Only shows when syncing */}
        {syncStatus === 'syncing' && (
          <div className="processing-overlay">
            <div className="processing-spinner"></div>
            <p>Syncing with server...</p>
          </div>
        )}

        {/* Success Indicator */}
        {syncStatus === 'success' && (
          <div className="success-indicator">
            <span className="success-icon">✅</span>
            <span className="success-message">Response recorded!</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationModal;