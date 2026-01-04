// src/utils/soundEmergencyStop.js
export const emergencySoundStop = async () => {
  console.log('🆘 EMERGENCY SOUND STOP INITIATED');
  
  try {
    // Stop all HTML5 audio elements
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        audio.load();
      } catch (e) {
        console.warn('Could not stop audio element:', e);
      }
    });

    // Stop all Web Audio API contexts
    if (window.AudioContext) {
      try {
        const contexts = window.audioContexts || [];
        contexts.forEach(ctx => {
          if (ctx && typeof ctx.close === 'function') {
            ctx.close();
          }
        });
      } catch (e) {
        console.warn('Could not close audio contexts:', e);
      }
    }

    // Clear all timeouts and intervals
    const maxTimeoutId = setTimeout(() => {}, 0);
    for (let i = 0; i < maxTimeoutId; i++) {
      clearTimeout(i);
      clearInterval(i);
    }

    // Remove all audio sources
    const audioSources = document.querySelectorAll('[src*=".mp3"], [src*=".wav"], [src*=".ogg"]');
    audioSources.forEach(source => {
      source.src = '';
    });

    // Force garbage collection (if possible)
    if (window.gc) {
      window.gc();
    }

    console.log('✅ Emergency sound stop completed');
    return true;
  } catch (error) {
    console.error('❌ Emergency sound stop failed:', error);
    return false;
  }
};

export default emergencySoundStop;