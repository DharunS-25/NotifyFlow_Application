import React, { useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { soundService } from '../services/soundService';

const TestNotification = () => {
  const { testNotificationSound, requestTestNotification } = useNotifications();
  const [soundType, setSoundType] = useState('chime');
  const [volume, setVolume] = useState(0.7);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const soundOptions = [
    { value: 'chime', label: 'Gentle Chime' },
    { value: 'bell', label: 'Classic Bell' },
    { value: 'digital', label: 'Digital Beep' },
    { value: 'nature', label: 'Nature Sounds' }
  ];

  const handleLocalTest = async () => {
    setTesting(true);
    setResult(null);
    
    try {
      console.log('🧪 Starting local sound test...');
      testNotificationSound(soundType, volume);
      
      setTimeout(() => {
        setResult({
          type: 'success',
          message: 'Local sound test completed successfully!'
        });
        setTesting(false);
      }, 2000);
      
    } catch (error) {
      console.error('Local test error:', error);
      setResult({
        type: 'error',
        message: `Local test failed: ${error.message}`
      });
      setTesting(false);
    }
  };

  const handleServerTest = async () => {
    setTesting(true);
    setResult(null);
    
    try {
      console.log('📡 Requesting server test notification...');
      const response = await requestTestNotification(soundType, volume);
      
      if (response.success) {
        setResult({
          type: 'success',
          message: 'Server test completed! Check for notification and sound.'
        });
      } else {
        setResult({
          type: 'error',
          message: `Server test failed: ${response.message}`
        });
      }
    } catch (error) {
      console.error('Server test error:', error);
      setResult({
        type: 'error',
        message: `Server test error: ${error.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleTestSoundOnly = () => {
    console.log('🔊 Testing sound only...');
    soundService.testSound(soundType, volume);
  };

  return (
    <div className="test-notification">
      <h3>🔔  Notifications & Sounds</h3>
      
      <div className="test-controls">
        <div className="form-group">
          <label>Sound Type</label>
          <select 
            value={soundType} 
            onChange={(e) => setSoundType(e.target.value)}
            disabled={testing}
          >
            {soundOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label>Volume: {Math.round(volume * 100)}%</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            disabled={testing}
          />
        </div>
      </div>
      
      <div className="test-buttons">
        <button 
          className="btn-secondary"
          onClick={handleTestSoundOnly}
          disabled={testing}
        >
          🔊  Sound Only
        </button>
        
        <button 
          className="btn-primary"
          onClick={handleLocalTest}
          disabled={testing}
        >
          {testing ? 'Testing...' : '🧪 Local Test'}
        </button>
        
        <button 
          className="btn-primary"
          onClick={handleServerTest}
          disabled={testing}
        >
          {testing ? 'Sending...' : '📡 Server Test'}
        </button>
      </div>
      
      {result && (
        <div className={`test-result ${result.type}`}>
          {result.type === 'success' ? '✅' : '❌'} {result.message}
        </div>
      )}
      
      <div className="test-tips">
        <p><strong>Tips:</strong></p>
        <ul>
          <li>Local test: Plays sound directly on your device</li>
          <li>Server test: Sends a real notification through the system</li>
          <li>Check browser console for detailed logs</li>
          <li>Ensure your volume is not muted</li>
        </ul>
      </div>
    </div>
  );
};

export default TestNotification;