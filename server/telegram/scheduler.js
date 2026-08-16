import cron from 'node-cron';
import { checkAndSendNotifications, checkAndSendMonthlyNotifications } from './notificationService.js';
import { updateCurrencyRates } from '../services/currencyService.js';

let schedulerTask = null;
let monthlySchedulerTask = null;
let currencyRatesTask = null;

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

  // Запускаем обновление курсов валют каждый час
  currencyRatesTask = cron.schedule('0 * * * *', async () => {
    try {
      await updateCurrencyRates();
    } catch (error) {
      console.error('[Scheduler] Error updating currency rates:', error);
    }
  });

  console.log('[Scheduler] Notification scheduler started (runs every minute)');
  console.log('[Scheduler] Monthly notification scheduler started (checks every minute for 1st day of month)');
  console.log('[Scheduler] Currency rates scheduler started (runs every hour)');
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
  if (currencyRatesTask) {
    currencyRatesTask.stop();
    console.log('[Scheduler] Currency rates scheduler stopped');
  }
}
