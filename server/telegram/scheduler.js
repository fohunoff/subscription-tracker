import cron from 'node-cron';
import { checkAndSendNotifications } from './notificationService.js';

let schedulerTask = null;

/**
 * Запустить scheduler для проверки уведомлений
 */
export function startScheduler() {
  // Запускаем проверку каждую минуту
  schedulerTask = cron.schedule('* * * * *', async () => {
    try {
      await checkAndSendNotifications();
    } catch (error) {
      console.error('[Scheduler] Error running notification check:', error);
    }
  });

  console.log('[Scheduler] Notification scheduler started (runs every minute)');
}

/**
 * Остановить scheduler
 */
export function stopScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    console.log('[Scheduler] Notification scheduler stopped');
  }
}
