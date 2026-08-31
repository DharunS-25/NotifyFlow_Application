import React, { useState, useEffect } from 'react';
import { ROUTINE_CATEGORIES, DAYS_OF_WEEK, SOUND_OPTIONS, PRIORITY_LEVELS } from '../config';

const AddRoutine = ({ routine, onSaveRoutine, onCancel, onDelete, onTestSound, isEditing = false }) => {
  // Initialize form data with empty values or routine data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'personal',
    schedule: [{ time: '09:00', days: [1, 2, 3, 4, 5] }],
    sound: 'chime',
    volume: 0.7,
    priority: 1,
    adaptiveTiming: { enabled: true }
  });

  const [errors, setErrors] = useState({});
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize form data when routine prop changes
  useEffect(() => {
    console.log('🔄 AddRoutine useEffect triggered', {
      isEditing,
      hasRoutine: !!routine,
      routineId: routine?._id,
      routineTitle: routine?.title
    });
    
    if (isEditing && routine) {
      console.log('📝 Initializing form with routine data:', {
        title: routine.title,
        description: routine.description,
        schedule: routine.schedule,
        category: routine.category
      });
      
      // Safely initialize form data
      setFormData({
        title: routine.title || '',
        description: routine.description || '',
        category: routine.category || 'personal',
        schedule: Array.isArray(routine.schedule) && routine.schedule.length > 0 
          ? routine.schedule.map(s => ({
              time: s.time || '09:00',
              days: Array.isArray(s.days) ? [...s.days] : [1, 2, 3, 4, 5]
            }))
          : [{ time: '09:00', days: [1, 2, 3, 4, 5] }],
        sound: routine.sound || 'chime',
        volume: typeof routine.volume === 'number' ? routine.volume : 0.7,
        priority: routine.priority || 1,
        adaptiveTiming: routine.adaptiveTiming || { enabled: true }
      });
      
      setIsInitialized(true);
    } else if (!isEditing) {
      // Reset to default values for new routine
      console.log('🆕 Setting up form for new routine');
      setFormData({
        title: '',
        description: '',
        category: 'personal',
        schedule: [{ time: '09:00', days: [1, 2, 3, 4, 5] }],
        sound: 'chime',
        volume: 0.7,
        priority: 1,
        adaptiveTiming: { enabled: true }
      });
      setIsInitialized(true);
    }
  }, [routine, isEditing]);

  // Log when formData changes
  useEffect(() => {
    console.log('📋 Form data updated:', {
      title: formData.title,
      scheduleCount: formData.schedule?.length,
      isInitialized
    });
  }, [formData, isInitialized]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    console.log(`✏️ Field changed: ${name} = ${value}`);
    
    setFormData(prev => ({
      ...prev,
      [name]: name === 'volume' ? parseFloat(value) : value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleScheduleChange = (index, field, value) => {
    console.log(`📅 Schedule ${index} changed: ${field} = ${value}`);
    
    const updatedSchedule = [...formData.schedule];
    updatedSchedule[index] = { 
      ...updatedSchedule[index], 
      [field]: field === 'days' ? (Array.isArray(value) ? value : [value]) : value 
    };
    
    setFormData(prev => ({ 
      ...prev, 
      schedule: updatedSchedule 
    }));
  };

  const addSchedule = () => {
    console.log('➕ Adding new schedule slot');
    setFormData(prev => ({
      ...prev,
      schedule: [...prev.schedule, { time: '09:00', days: [1, 2, 3, 4, 5] }]
    }));
  };

  const removeSchedule = (index) => {
    if (formData.schedule.length > 1) {
      console.log(`🗑️ Removing schedule at index ${index}`);
      const updatedSchedule = formData.schedule.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, schedule: updatedSchedule }));
    }
  };

  const toggleDay = (scheduleIndex, day) => {
    console.log(`📅 Toggling day ${day} in schedule ${scheduleIndex}`);
    
    const updatedSchedule = [...formData.schedule];
    const currentDays = updatedSchedule[scheduleIndex].days || [];
    
    if (currentDays.includes(day)) {
      updatedSchedule[scheduleIndex].days = currentDays.filter(d => d !== day);
    } else {
      updatedSchedule[scheduleIndex].days = [...currentDays, day].sort();
    }
    
    setFormData(prev => ({ ...prev, schedule: updatedSchedule }));
  };

  const validateForm = () => {
    console.log('🔍 Validating form...');
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    // Validate schedule
    formData.schedule.forEach((schedule, index) => {
      if (!schedule.time) {
        newErrors[`schedule-${index}-time`] = 'Time is required';
      }
      if (!schedule.days || schedule.days.length === 0) {
        newErrors[`schedule-${index}-days`] = 'Select at least one day';
      }
    });

    setErrors(newErrors);
    console.log('✅ Validation errors:', newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('🚀 Form submitted, isEditing:', isEditing);
    
    if (validateForm()) {
      console.log('✅ Form valid, saving routine:', formData.title);
      onSaveRoutine(formData);
    } else {
      console.log('❌ Form has errors');
    }
  };

  // Show loading state while initializing
  if (!isInitialized && isEditing) {
    return (
      <div className="add-routine">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading routine data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="add-routine">
      <div className="page-header">
        <h1>{isEditing ? 'Edit Routine' : 'Create New Routine'}</h1>
        <p>{isEditing ? 'Update your routine details' : 'Set up a new routine with custom schedule and notifications'}</p>
      </div>

      {isEditing && routine && (
        <div className="routine-info-banner">
          <p>Editing: <strong>{routine.title}</strong></p>
          <p>Created: {new Date(routine.createdAt).toLocaleDateString()}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="routine-form">
        <div className="form-section">
          <h3>Basic Information</h3>
          
          <div className="form-group">
            <label htmlFor="title">Routine Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Morning Meditation, Lunch Break"
              className={errors.title ? 'error' : ''}
              disabled={!isInitialized}
            />
            {errors.title && <span className="error-text">{errors.title}</span>}
            {!isInitialized && <span className="loading-text">Loading...</span>}
          </div>

          <div className="form-group">
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe what this routine involves..."
              rows="3"
              className={errors.description ? 'error' : ''}
              disabled={!isInitialized}
            />
            {errors.description && <span className="error-text">{errors.description}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                disabled={!isInitialized}
              >
                {ROUTINE_CATEGORIES.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.icon} {category.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="priority">Priority</label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                disabled={!isInitialized}
              >
                {PRIORITY_LEVELS.map(priority => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Schedule</h3>
          {formData.schedule.map((schedule, index) => (
            <div key={index} className="schedule-item">
              <div className="schedule-time">
                <label>Time *</label>
                <input
                  type="time"
                  value={schedule.time || ''}
                  onChange={(e) => handleScheduleChange(index, 'time', e.target.value)}
                  className={errors[`schedule-${index}-time`] ? 'error' : ''}
                  disabled={!isInitialized}
                />
                {errors[`schedule-${index}-time`] && (
                  <span className="error-text">{errors[`schedule-${index}-time`]}</span>
                )}
              </div>
              
              <div className="schedule-days">
                <label>Days *</label>
                <div className="days-selector">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      className={`day-btn ${(schedule.days || []).includes(day.value) ? 'selected' : ''}`}
                      onClick={() => toggleDay(index, day.value)}
                      disabled={!isInitialized}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
                {errors[`schedule-${index}-days`] && (
                  <span className="error-text">{errors[`schedule-${index}-days`]}</span>
                )}
              </div>

              {formData.schedule.length > 1 && (
                <button
                  type="button"
                  className="remove-schedule-btn"
                  onClick={() => removeSchedule(index)}
                  title="Remove this schedule"
                  disabled={!isInitialized}
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
          <button 
            type="button" 
            className="add-schedule-btn" 
            onClick={addSchedule}
            disabled={!isInitialized}
          >
            ➕ Add Another Time
          </button>
        </div>

        <div className="form-section">
          <h3>Notification Settings</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sound">Alarm Sound</label>
              <select
                id="sound"
                name="sound"
                value={formData.sound}
                onChange={handleChange}
                disabled={!isInitialized}
              >
                {SOUND_OPTIONS.map(sound => (
                  <option key={sound.value} value={sound.value}>
                    {sound.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Volume: {Math.round(formData.volume * 100)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={formData.volume}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  volume: parseFloat(e.target.value) 
                }))}
                disabled={!isInitialized}
              />
            </div>
          </div>
          
          <div className="form-group">
            <button
              type="button"
              className="test-sound-btn"
              onClick={() => onTestSound && onTestSound(formData.sound, formData.volume)}
              disabled={!isInitialized}
            >
              🔊 Test Sound
            </button>
          </div>
        </div>

        <div className="form-section">
          <h3>Advanced Settings</h3>
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.adaptiveTiming?.enabled || false}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  adaptiveTiming: { ...formData.adaptiveTiming, enabled: e.target.checked } 
                })}
                disabled={!isInitialized}
              />
              <span className="checkmark"></span>
              Enable Smart Timing
              <span className="setting-description">
                Adjust notification timing based on your responsiveness patterns
              </span>
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={onCancel}
            disabled={!isInitialized}
          >
            Cancel
          </button>
          
          {isEditing && onDelete && (
            <button 
              type="button" 
              className="btn-danger" 
              onClick={onDelete}
              disabled={!isInitialized}
            >
              Delete Routine
            </button>
          )}
          
          <button 
            type="submit" 
            className="btn-primary"
            disabled={!isInitialized}
          >
            {isInitialized ? (isEditing ? 'Update Routine' : 'Create Routine') : 'Loading...'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddRoutine;