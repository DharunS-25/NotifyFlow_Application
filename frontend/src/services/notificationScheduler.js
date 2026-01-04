import { apiService } from './api';

export const notificationScheduler = {
  
  // Schedule notifications for a routine
  scheduleForRoutine: async (routine) => {
    try {
      console.log('📅 Scheduling notifications for routine:', routine.title);
      
      // Call backend API to schedule notifications
      const response = await apiService.routines.scheduleNotifications(routine._id);
      
      if (response.data.success) {
        console.log('✅ Notifications scheduled successfully');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Error scheduling notifications:', error);
      throw error;
    }
  },
  
  // Cancel notifications for a routine
  cancelForRoutine: async (routineId) => {
    try {
      console.log('🗑️ Canceling notifications for routine:', routineId);
      
      const response = await apiService.routines.cancelNotifications(routineId);
      
      if (response.data.success) {
        console.log('✅ Notifications canceled successfully');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Error canceling notifications:', error);
      throw error;
    }
  },
  
  // Update notifications when routine changes
  updateForRoutine: async (routineId, updates) => {
    try {
      console.log('🔄 Updating notifications for routine:', routineId);
      
      const response = await apiService.routines.updateNotifications(routineId, updates);
      
      if (response.data.success) {
        console.log('✅ Notifications updated successfully');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Error updating notifications:', error);
      throw error;
    }
  }
};

export default notificationScheduler;