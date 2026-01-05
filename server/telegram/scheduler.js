import cron from 'node-cron';
import { checkAndSendNotifications, checkAndSendMonthlyNotifications } from './notificationService.js';

let schedulerTask = null;
let monthlySchedulerTask = null;

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

  // Запускаем проверку месячных уведомлений каждую минуту
  // (внутри функции идёт проверка на 1 число месяца)
  monthlySchedulerTask = cron.schedule('* * * * *', async () => {
    try {
      await checkAndSendMonthlyNotifications();
    } catch (error) {
      console.error('[Scheduler] Error running monthly notification check:', error);
    }
  });

  console.log('[Scheduler] Notification scheduler started (runs every minute)');
  console.log('[Scheduler] Monthly notification scheduler started (checks every minute for 1st day of month)');
}

/**
 * Остановить scheduler
 */
export function stopScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    console.log('[Scheduler] Notification scheduler stopped');
  }
  if (monthlySchedulerTask) {
    monthlySchedulerTask.stop();
    console.log('[Scheduler] Monthly notification scheduler stopped');
  }
}
