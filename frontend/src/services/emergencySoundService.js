// frontend/src/services/emergencySoundService.js
class EmergencySoundService {
  constructor() {
    this.activeSounds = new Set();
    this.isStopping = false;
    this.maxStopAttempts = 3;
  }

  // Register a sound that needs to be stopped
  registerSound(soundId, stopFunction) {
    if (this.isStopping) {
      console.warn('⚠️ Emergency stop in progress, stopping new sound immediately');
      this.immediateStop(stopFunction);
      return;
    }

    this.activeSounds.add({ id: soundId, stop: stopFunction });
    console.log(`📝 Registered sound: ${soundId}, total active: ${this.activeSounds.size}`);
  }

  // Unregister a sound
  unregisterSound(soundId) {
    const soundToRemove = Array.from(this.activeSounds).find(s => s.id === soundId);
    if (soundToRemove) {
      this.activeSounds.delete(soundToRemove);
      console.log(`✅ Unregistered sound: ${soundId}, remaining: ${this.activeSounds.size}`);
    }
  }

  // Emergency stop ALL sounds with retry mechanism
  async emergencyStopAll() {
    if (this.isStopping) {
      console.warn('⚠️ Emergency stop already in progress');
      return;
    }

    this.isStopping = true;
    console.log('🆘 EMERGENCY STOP INITIATED - Stopping all sounds...');

    const stopPromises = [];
    
    // Stop all registered sounds
    this.activeSounds.forEach(sound => {
      if (sound && sound.stop && typeof sound.stop === 'function') {
        stopPromises.push(
          this.stopWithRetry(sound.id, sound.stop)
        );
      }
    });

    // Clear the registry
    this.activeSounds.clear();

    // Additional emergency measures
    await this.additionalEmergencyMeasures();

    try {
      await Promise.allSettled(stopPromises);
      console.log('✅ All sounds emergency stopped');
    } catch (error) {
      console.error('❌ Some sounds failed to stop:', error);
    } finally {
      this.isStopping = false;
    }
  }

  // Stop with retry mechanism
  async stopWithRetry(soundId, stopFunction, attempt = 1) {
    try {
      console.log(`🛑 Stopping sound ${soundId} (attempt ${attempt}/${this.maxStopAttempts})`);
      stopFunction();
    } catch (error) {
      console.error(`❌ Error stopping sound ${soundId}:`, error);
      
      if (attempt < this.maxStopAttempts) {
        // Wait and retry
        await this.delay(100 * attempt);
        return this.stopWithRetry(soundId, stopFunction, attempt + 1);
      } else {
        // Final attempt with force
        this.forceStop(soundId);
      }
    }
  }

  // Immediate stop without retry
  immediateStop(stopFunction) {
    try {
      if (stopFunction && typeof stopFunction === 'function') {
        stopFunction();
      }
    } catch (error) {
      console.error('❌ Immediate stop failed:', error);
    }
  }

  // Force stop by any means necessary
  forceStop(soundId) {
    console.log(`💥 Force stopping sound: ${soundId}`);
    
    // Stop HTML5 audio elements
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        audio.load();
      } catch (e) {
        console.warn('⚠️ Could not force stop audio element:', e);
      }
    });

    // Stop Web Audio API contexts
    this.stopAllAudioContexts();
  }

  // Stop all Web Audio API contexts
  stopAllAudioContexts() {
    if (window.AudioContext) {
      try {
        // Get all audio contexts
        const contexts = [];
        if (window.audioContexts) {
          contexts.push(...window.audioContexts);
        }
        
        contexts.forEach(context => {
          try {
            if (context && typeof context.close === 'function') {
              context.close();
            }
          } catch (e) {
            console.warn('⚠️ Could not close audio context:', e);
          }
        });
      } catch (error) {
        console.error('❌ Error stopping audio contexts:', error);
      }
    }
  }

  // Additional emergency measures
  async additionalEmergencyMeasures() {
    console.log('🚨 Applying additional emergency measures...');
    
    // 1. Clear all timeouts
    const highestId = setTimeout(() => {}, 0);
    for (let i = 0; i < highestId; i++) {
      clearTimeout(i);
    }

    // 2. Clear all intervals
    const intervalId = setInterval(() => {}, 0);
    for (let i = 0; i < intervalId; i++) {
      clearInterval(i);
    }

    // 3. Stop any pending promises
    await this.delay(50);

    console.log('✅ Additional emergency measures applied');
  }

  // Utility: Delay function
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get status
  getStatus() {
    return {
      isStopping: this.isStopping,
      activeSoundsCount: this.activeSounds.size,
      soundIds: Array.from(this.activeSounds).map(s => s.id)
    };
  }

  // Clear all (for cleanup)
  clearAll() {
    this.activeSounds.clear();
    this.isStopping = false;
    console.log('🧹 Emergency sound service cleared');
  }
}

// Singleton instance
const emergencySoundService = new EmergencySoundService();

// Export for use in soundService and other files
export default emergencySoundService;