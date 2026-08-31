import React, { useState, useEffect } from 'react';
import { soundService } from '../services/soundService';

const SoundSettings = ({ user }) => {
  const [preferences, setPreferences] = useState({
    defaultVolume: 0.7,
    defaultSound: 'chime',
    workingHours: { start: '09:00', end: '17:00' },
    breakInterval: 60
  });

  const [isMuted, setIsMuted] = useState(false);

  const soundOptions = [
    { value: 'chime', label: 'Gentle Chime', description: 'Soft and pleasant' },
    { value: 'bell', label: 'Classic Bell', description: 'Traditional bell sound' },
    { value: 'digital', label: 'Digital Beep', description: 'Modern digital beep' },
    { value: 'nature', label: 'Nature Sounds', description: 'Calming nature sounds' }
  ];

  useEffect(() => {
    // Initialize with user preferences
    if (user?.preferences) {
      setPreferences(user.preferences);
    }
  }, [user]);

  const handleVolumeChange = (volume) => {
    const newVolume = parseFloat(volume);
    setPreferences(prev => ({ ...prev, defaultVolume: newVolume }));
    soundService.setVolume(newVolume);
  };

  const handleSoundTest = (soundType) => {
    soundService.play(soundType, preferences.defaultVolume);
  };

  const toggleMute = () => {
    const muted = soundService.toggleMute();
    setIsMuted(muted);
  };

  const handleSaveSettings = async () => {
    try {
      // Save to backend
      // await apiService.users.updatePreferences(preferences);
      console.log('Settings saved:', preferences);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings');
    }
  };

  return (
    <div className="sound-settings">
      <div className="page-header">
        <h1>Sound & Notification Settings</h1>
        <p>Customize your alarm sounds and notification preferences</p>
      </div>

      <div className="settings-grid">
        <div className="settings-card">
          <h2>🔊 Sound Preferences</h2>
          
          <div className="setting-group">
            <label>Default Alarm Sound</label>
            <select
              value={preferences.defaultSound}
              onChange={(e) => setPreferences({...preferences, defaultSound: e.target.value})}
            >
              {soundOptions.map(sound => (
                <option key={sound.value} value={sound.value}>
                  {sound.label}
                </option>
              ))}
            </select>
            <button 
              className="test-sound-btn"
              onClick={() => handleSoundTest(preferences.defaultSound)}
            >
              🔈 Test Sound
            </button>
          </div>

          <div className="setting-group">
            <label>
              Default Volume: {Math.round(preferences.defaultVolume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={preferences.defaultVolume}
              onChange={(e) => handleVolumeChange(e.target.value)}
            />
          </div>

          <div className="setting-group">
            <label>Sound Controls</label>
            <div className="sound-controls">
              <button 
                className={`mute-btn ${isMuted ? 'muted' : ''}`}
                onClick={toggleMute}
              >
                {isMuted ? '🔇 Unmute' : '🔊 Mute'}
              </button>
              <button 
                className="stop-btn"
                onClick={() => soundService.stop()}
              >
                ⏹️ Stop All Sounds
              </button>
            </div>
          </div>
        </div>

        <div className="settings-card">
          <h2>🎵 Sound Preview</h2>
          <div className="sound-preview">
            <p>Test different sounds:</p>
            <div className="sound-test-buttons">
              {soundOptions.map(sound => (
                <button
                  key={sound.value}
                  className="sound-test-btn"
                  onClick={() => handleSoundTest(sound.value)}
                >
                  {sound.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="settings-card">
          <h2>🕐 Working Hours</h2>
          <div className="time-settings">
            <div className="setting-group">
              <label>Start Time</label>
              <input
                type="time"
                value={preferences.workingHours.start}
                onChange={(e) => setPreferences({
                  ...preferences, 
                  workingHours: {...preferences.workingHours, start: e.target.value}
                })}
              />
            </div>
            
            <div className="setting-group">
              <label>End Time</label>
              <input
                type="time"
                value={preferences.workingHours.end}
                onChange={(e) => setPreferences({
                  ...preferences, 
                  workingHours: {...preferences.workingHours, end: e.target.value}
                })}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="settings-actions">
        <button className="btn-primary" onClick={handleSaveSettings}>
          Save Settings
        </button>
      </div>
    </div>
  );
};

export default SoundSettings;
