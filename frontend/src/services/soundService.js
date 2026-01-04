// frontend/src/services/soundService.js
import emergencySoundService from './emergencySoundService';

class SoundService {
  constructor() {
    this.sounds = {};
    this.currentSound = null;
    this.isMuted = false;
    this.volume = 0.7;
    this.soundQueue = [];
    this.isPlaying = false;
    this.activeSounds = new Map();
    this.timeoutIds = new Map();
    this.intervalIds = new Map();
    this.soundCounter = 0;
    this.maxRetryAttempts = 3;
    this.currentlyPlayingSounds = new Set();
    
    this.initializeSounds();
    this.setupEventListeners();
  }

  initializeSounds() {
    const soundTypes = ['chime', 'bell', 'digital', 'nature'];
    
    soundTypes.forEach(soundType => {
      try {
        this.sounds[soundType] = new Audio(`/sounds/${soundType}.mp3`);
        this.sounds[soundType].volume = this.volume;
        this.sounds[soundType].preload = 'auto';
        
        this.sounds[soundType].addEventListener('canplaythrough', () => {
          console.log(`✅ Sound loaded: ${soundType}`);
        });
        
        this.sounds[soundType].addEventListener('error', (e) => {
          console.error(`❌ Sound load error (${soundType}):`, e);
          this.handleSoundError(soundType, e);
        });
        
        this.sounds[soundType].addEventListener('ended', () => {
          this.handleSoundEnded(soundType);
        });
        
      } catch (error) {
        console.error(`Error initializing sound ${soundType}:`, error);
        this.createFallbackSound(soundType);
      }
    });
  }

  createFallbackSound(soundType) {
    console.log(`Creating fallback sound for: ${soundType}`);
    this.sounds[soundType] = new Audio();
    this.sounds[soundType].volume = this.volume;
  }

  setupEventListeners() {
    // Stop sounds when tab becomes inactive
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseAll();
      } else {
        this.resumeAll();
      }
    });

    // Handle page unload
    window.addEventListener('beforeunload', () => {
      this.emergencyStop();
    });

    // Handle online/offline status
    window.addEventListener('online', () => {
      this.preloadSounds();
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+S to stop all sounds
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        this.emergencyStop();
      }
    });
  }

  // ENHANCED EMERGENCY STOP METHOD
  async emergencyStop() {
    console.log('🆘 EMERGENCY STOP INITIATED');
    
    if (this.isEmergencyStopping) {
      console.log('⚠️ Emergency stop already in progress');
      return;
    }
    
    this.isEmergencyStopping = true;
    this.isPlaying = false;
    
    try {
      // Step 1: Stop all HTML5 audio elements
      await this.stopAllHTML5Audio();
      
      // Step 2: Stop all Web Audio API contexts
      await this.stopAllAudioContexts();
      
      // Step 3: Clear all timers and intervals
      this.clearAllTimers();
      
      // Step 4: Use emergency sound service
      await emergencySoundService.emergencyStopAll();
      
      // Step 5: Reset all internal state
      this.resetInternalState();
      
      console.log('✅ Emergency stop completed successfully');
      
    } catch (error) {
      console.error('❌ Error during emergency stop:', error);
      
      // Force cleanup as last resort
      this.forceCleanup();
      
    } finally {
      this.isEmergencyStopping = false;
    }
  }

  async stopAllHTML5Audio() {
    console.log('🔇 Stopping all HTML5 audio elements...');
    
    const audioElements = document.querySelectorAll('audio');
    const stopPromises = [];
    
    audioElements.forEach(audio => {
      try {
        const stopPromise = new Promise((resolve) => {
          audio.pause();
          audio.currentTime = 0;
          
          // Clear src to prevent any buffered playback
          audio.src = '';
          audio.load();
          
          setTimeout(resolve, 50);
        });
        
        stopPromises.push(stopPromise);
      } catch (e) {
        console.warn('⚠️ Could not stop audio element:', e);
      }
    });
    
    await Promise.allSettled(stopPromises);
  }

  stopAllAudioContexts() {
    console.log('🔇 Stopping all Web Audio contexts...');
    
    if (!window.AudioContext) {
      return;
    }
    
    try {
      // Get all audio contexts from global store
      const contexts = window.audioContexts || [];
      
      contexts.forEach(context => {
        try {
          if (context && typeof context.close === 'function') {
            context.close();
          }
        } catch (e) {
          console.warn('⚠️ Could not close audio context:', e);
        }
      });
      
      // Clear global store
      window.audioContexts = [];
      
    } catch (error) {
      console.error('❌ Error stopping audio contexts:', error);
    }
  }

  clearAllTimers() {
    console.log('⏰ Clearing all timers and intervals...');
    
    // Clear timeouts
    this.timeoutIds.forEach((timeoutId) => {
      try {
        clearTimeout(timeoutId);
      } catch (e) {
        console.warn('⚠️ Error clearing timeout:', e);
      }
    });
    this.timeoutIds.clear();
    
    // Clear intervals
    this.intervalIds.forEach((intervalId) => {
      try {
        clearInterval(intervalId);
      } catch (e) {
        console.warn('⚠️ Error clearing interval:', e);
      }
    });
    this.intervalIds.clear();
    
    // Clear all active sounds
    this.activeSounds.forEach((stopFunction, id) => {
      try {
        if (typeof stopFunction === 'function') {
          stopFunction();
        }
      } catch (e) {
        console.warn('⚠️ Error in active sound stop function:', e);
      }
    });
    this.activeSounds.clear();
    
    // Clear currently playing sounds set
    this.currentlyPlayingSounds.clear();
  }

  resetInternalState() {
    console.log('🔄 Resetting internal state...');
    
    this.isPlaying = false;
    this.currentSound = null;
    this.soundQueue = [];
    
    // Reset all sound objects
    Object.values(this.sounds).forEach(sound => {
      if (sound) {
        try {
          sound.pause();
          sound.currentTime = 0;
        } catch (e) {
          // Ignore errors during reset
        }
      }
    });
  }

  forceCleanup() {
    console.log('💥 Force cleanup initiated...');
    
    // Clear all timeouts and intervals (brute force)
    const highestId = setTimeout(() => {}, 0);
    for (let i = 0; i < highestId; i++) {
      clearTimeout(i);
      clearInterval(i);
    }
    
    // Remove all audio elements from DOM
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      try {
        audio.parentNode?.removeChild(audio);
      } catch (e) {
        // Ignore removal errors
      }
    });
    
    // Disconnect all audio nodes
    if (window.AudioContext) {
      try {
        const contexts = window.audioContexts || [];
        contexts.forEach(ctx => {
          if (ctx) {
            ctx.suspend();
            ctx.close();
          }
        });
      } catch (e) {
        console.warn('⚠️ Force cleanup audio context error:', e);
      }
    }
  }

  getSoundUrl(soundType) {
    const soundFile = soundType || 'chime';
    return `/sounds/${soundFile}.mp3`;
  }

  // ENHANCED PLAY FOR NOTIFICATION METHOD
  playForNotification(soundType, volume = 0.7, maxDuration = 300000) {
    if (this.isMuted) {
      console.log('🔇 Sound muted, skipping notification sound');
      return () => {
        console.log('🛑 No-op stop function (sound was muted)');
      };
    }
    
    const soundId = `notification-${Date.now()}-${++this.soundCounter}`;
    console.log(`🎵 Starting notification sound: ${soundId} (${soundType})`);
    
    let intervalId = null;
    let timeoutId = null;
    let isStopped = false;
    
    const playSoundOnce = () => {
      if (isStopped || this.isMuted) return;
      
      try {
        const sound = this.sounds[soundType];
        if (sound) {
          sound.volume = Math.max(0, Math.min(1, volume));
          sound.currentTime = 0;
          
          // Mark as currently playing
          this.currentlyPlayingSounds.add(soundId);
          
          const playPromise = sound.play();
          
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log(`▶️ Sound ${soundId} playing successfully`);
              })
              .catch(error => {
                console.error(`❌ Play error for ${soundId}:`, error);
                this.currentlyPlayingSounds.delete(soundId);
              });
          }
        } else {
          console.warn(`Sound ${soundType} not found for ${soundId}`);
          this.fallbackPlay(soundType, volume);
        }
      } catch (error) {
        console.error(`❌ Error playing sound ${soundId}:`, error);
        this.currentlyPlayingSounds.delete(soundId);
      }
    };
    
    const stopPlaying = () => {
      if (isStopped) return;
      
      console.log(`🛑 Stopping notification sound: ${soundId}`);
      isStopped = true;
      
      // Clear interval and timeout
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Stop the specific sound
      this.stopSpecificSound(soundId);
      
      // Remove from active sounds
      this.activeSounds.delete(soundId);
      
      // Remove from currently playing set
      this.currentlyPlayingSounds.delete(soundId);
      
      // Unregister from emergency service
      emergencySoundService.unregisterSound(soundId);
      
      console.log(`✅ Sound ${soundId} stopped`);
    };
    
    // Register with emergency service
    emergencySoundService.registerSound(soundId, stopPlaying);
    
    // Store stop function
    this.activeSounds.set(soundId, stopPlaying);
    
    // Play immediately
    playSoundOnce();
    
    // Set up repeating interval (every 8 seconds)
    intervalId = setInterval(() => {
      if (!isStopped && !this.isMuted) {
        playSoundOnce();
      }
    }, 8000);
    
    this.intervalIds.set(soundId, intervalId);
    
    // Auto-stop after max duration (5 minutes default)
    timeoutId = setTimeout(() => {
      console.log(`⏰ Auto-stopping notification sound ${soundId} after max duration`);
      stopPlaying();
    }, maxDuration);
    
    this.timeoutIds.set(soundId, timeoutId);
    
    return stopPlaying;
  }

  stopSpecificSound(soundId) {
    console.log(`🔇 Stopping specific sound: ${soundId}`);
    
    // Get the stop function
    const stopFunction = this.activeSounds.get(soundId);
    
    if (stopFunction) {
      try {
        stopFunction();
      } catch (error) {
        console.error(`❌ Error stopping sound ${soundId}:`, error);
      }
    } else {
      console.warn(`⚠️ No stop function found for sound: ${soundId}`);
    }
    
    // Also stop any related audio
    const sound = this.sounds[this.getSoundTypeFromId(soundId)];
    if (sound) {
      try {
        sound.pause();
        sound.currentTime = 0;
      } catch (e) {
        console.warn(`Could not stop sound object for ${soundId}:`, e);
      }
    }
  }

  getSoundTypeFromId(soundId) {
    // Extract sound type from soundId (notification-{timestamp}-{counter})
    const match = soundId.match(/notification-\d+-\d+-(.+)/);
    return match ? match[1] : 'chime';
  }

  // Stop method (alias for emergencyStop)
  stop() {
    console.log('🔇 SoundService.stop() called');
    return this.emergencyStop();
  }

  stopCurrentSound() {
    if (this.currentSound) {
      try {
        this.currentSound.pause();
        this.currentSound.currentTime = 0;
      } catch (e) {
        console.warn('Error stopping current sound:', e);
      }
      this.currentSound = null;
    }
    this.isPlaying = false;
  }

  play(soundType, volume = 0.7, options = {}) {
    if (this.isMuted) {
      console.log('🔇 Sound muted, skipping playback');
      return;
    }
    
    const { loop = false, onEnded = null, onError = null } = options;

    try {
      this.stopCurrentSound();

      if (this.sounds[soundType]) {
        const sound = this.sounds[soundType];
        sound.volume = Math.max(0, Math.min(1, volume));
        sound.currentTime = 0;
        sound.loop = loop;

        if (onEnded) {
          const endedHandler = () => {
            onEnded();
            sound.removeEventListener('ended', endedHandler);
          };
          sound.addEventListener('ended', endedHandler);
        }
        
        if (onError) {
          const errorHandler = (error) => {
            onError(error);
            sound.removeEventListener('error', errorHandler);
          };
          sound.addEventListener('error', errorHandler);
        }

        const playPromise = sound.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              this.currentSound = sound;
              this.isPlaying = true;
              console.log(`🔊 Playing ${soundType} sound at ${Math.round(volume * 100)}% volume`);
            })
            .catch(error => {
              console.error('Error playing sound:', error);
              this.handlePlayError(soundType, volume, error);
            });
        }
      } else {
        console.warn(`Sound type "${soundType}" not found, using fallback`);
        this.fallbackPlay(soundType, volume, options);
      }
    } catch (error) {
      console.error('Sound play error:', error);
      this.fallbackPlay(soundType, volume, options);
    }
  }

  fallbackPlay(soundType, volume = 0.7, options = {}) {
    try {
      const audio = new Audio(`/sounds/${soundType}.mp3`);
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.loop = options.loop || false;

      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.currentSound = audio;
            this.isPlaying = true;
            console.log(`🔊 Fallback playing ${soundType} sound`);
          })
          .catch(e => {
            console.error('Fallback play failed:', e);
            this.showUserNotification('Sound playback failed. Please check your browser permissions.');
          });
      }

      audio.addEventListener('ended', () => {
        this.handleSoundEnded(soundType);
      });

    } catch (error) {
      console.error('Fallback sound play error:', error);
      this.showUserNotification('Unable to play sound. Please check if sounds are available.');
    }
  }

  handleSoundError(soundType, error) {
    console.error(`Sound error for ${soundType}:`, error);
    
    // Try to recreate the sound
    setTimeout(() => {
      try {
        this.sounds[soundType] = new Audio(`/sounds/${soundType}.mp3`);
        this.sounds[soundType].volume = this.volume;
        this.sounds[soundType].preload = 'auto';
        console.log(`🔄 Recreated sound: ${soundType}`);
      } catch (recreateError) {
        console.error(`Failed to recreate sound ${soundType}:`, recreateError);
      }
    }, 1000);
  }

  handlePlayError(soundType, volume, error) {
    console.error(`Play error for ${soundType}:`, error);
    
    if (error.name === 'NotAllowedError') {
      this.showUserNotification('Please allow audio playback in your browser to hear notifications.');
    } else if (error.name === 'NotSupportedError') {
      this.showUserNotification('Sound format not supported. Please try a different browser.');
    } else {
      this.fallbackPlay(soundType, volume);
    }
  }

  handleSoundEnded(soundType) {
    this.isPlaying = false;
    this.currentSound = null;
    console.log(`✅ Sound finished: ${soundType}`);
  }

  pauseAll() {
    if (this.currentSound) {
      this.currentSound.pause();
    }
    this.isPlaying = false;
  }

  resumeAll() {
    if (this.currentSound && !this.isMuted) {
      this.currentSound.play().catch(error => {
        console.error('Error resuming sound:', error);
      });
    }
  }

  setVolume(volume) {
    const newVolume = Math.max(0, Math.min(1, volume));
    this.volume = newVolume;
    
    Object.values(this.sounds).forEach(sound => {
      if (sound && sound.volume !== newVolume) {
        sound.volume = newVolume;
      }
    });

    console.log(`🔊 Global volume set to: ${Math.round(newVolume * 100)}%`);
  }

  getVolume() {
    return this.volume;
  }

  mute() {
    this.isMuted = true;
    this.stop();
    console.log('🔇 Sounds muted');
  }

  unmute() {
    this.isMuted = false;
    console.log('🔊 Sounds unmuted');
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stop();
      console.log('🔇 Sounds muted');
    } else {
      console.log('🔊 Sounds unmuted');
    }
    return this.isMuted;
  }

  testSound(soundType, volume = null) {
    const testVolume = volume !== null ? volume : this.volume;
    console.log(`🧪 Testing sound: ${soundType} at ${Math.round(testVolume * 100)}% volume`);
    this.play(soundType, testVolume);
  }

  preloadSounds() {
    console.log('📥 Preloading all sounds...');
    
    Object.entries(this.sounds).forEach(([soundType, sound]) => {
      if (sound) {
        try {
          sound.load();
          console.log(`✅ Preloaded: ${soundType}`);
        } catch (error) {
          console.error(`❌ Failed to preload ${soundType}:`, error);
        }
      }
    });
  }

  showUserNotification(message) {
    console.warn('Sound Service Notification:', message);
    
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('NotifyFlow Sound', {
          body: message,
          icon: '/favicon.ico',
          silent: true
        });
      } catch (error) {
        console.warn('Could not show notification:', error);
      }
    }
  }

  destroy() {
    console.log('🧹 Destroying SoundService...');
    this.emergencyStop();
    emergencySoundService.clearAll();
    
    Object.values(this.sounds).forEach(sound => {
      if (sound) {
        sound.pause();
        sound.src = '';
        sound.load();
      }
    });
    
    this.sounds = {};
    console.log('✅ SoundService destroyed');
  }

  getStatus() {
    const emergencyStatus = emergencySoundService.getStatus();
    
    return {
      isMuted: this.isMuted,
      isPlaying: this.isPlaying,
      isEmergencyStopping: this.isEmergencyStopping || false,
      volume: this.volume,
      currentSound: this.currentSound ? 
        Object.keys(this.sounds).find(key => this.sounds[key] === this.currentSound) : null,
      loadedSounds: Object.keys(this.sounds).filter(key => this.isSoundReady(key)),
      availableSounds: Object.keys(this.sounds),
      activeSoundsCount: this.activeSounds.size,
      currentlyPlayingCount: this.currentlyPlayingSounds.size,
      timeoutIdsCount: this.timeoutIds.size,
      intervalIdsCount: this.intervalIds.size,
      emergencyService: emergencyStatus,
      browserSupport: this.checkBrowserSupport()
    };
  }

  checkBrowserSupport() {
    const audio = new Audio();
    const support = {
      basic: !!audio.canPlayType,
      mp3: audio.canPlayType('audio/mpeg'),
      wav: audio.canPlayType('audio/wav'),
      ogg: audio.canPlayType('audio/ogg')
    };
    
    console.log('Browser audio support:', support);
    return support;
  }

  isSoundReady(soundType) {
    return this.sounds[soundType] && 
           this.sounds[soundType].readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA;
  }
}

// Create singleton instance
const soundService = new SoundService();

export { soundService };
export default soundService;