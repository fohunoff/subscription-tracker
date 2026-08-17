/**
 * Достраивает прошлые платежи подписок в лог — те, что случились до того, как
 * приложение начало записывать списания само.
 *
 * Даты считаются по циклу от даты старта, цена берётся из лога изменений,
 * промежутки в архиве пропускаются. Записи помечаются estimated: true —
 * это оценка, а не наблюдённый факт: лог ведётся не с начала времён.
 *
 * Запуск (из папки server):
 *   node scripts/backfill-payments.js            # только показать
 *   node scripts/backfill-payments.js --apply    # применить
 *   node scripts/backfill-payments.js --apply --reset  # пересобрать заново
 *
 * Без --reset повторный запуск ничего не дублирует: платежи с уже известной
 * датой пропускаются. --reset сначала удаляет прежние оценочные записи —
 * он нужен, если поправили дату старта или цикл и прошлое надо пересчитать.
 */
import process from 'process';
import mongoose from 'mongoose';
import { env } from '../config.js';
import {
  backfillAllPayments,
  removeEstimatedPayments
} from '../services/paymentBackfill.js';

const formatAmount = (changes) => `${changes.amount} ${changes.currency}`;

const paymentsWord = (count) => {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'платежей';
  if (last === 1) return 'платёж';
  if (last >= 2 && last <= 4) return 'платежа';
  return 'платежей';
};

const run = async () => {
  const apply = process.argv.includes('--apply');
  const reset = process.argv.includes('--reset');

  await mongoose.connect(env.mongodbUri);
  console.log(`✅ MongoDB подключена: ${mongoose.connection.host}`);
  console.log(apply ? 'Режим: применение изменений' : 'Режим: проверка (--apply, чтобы применить)');

  if (reset) {
    if (apply) {
      const removed = await removeEstimatedPayments();
      console.log(`Удалено прежних оценочных платежей: ${removed}`);
    } else {
      console.log('С --apply прежние оценочные платежи будут удалены и созданы заново');
    }
  }

  const total = await backfillAllPayments({
    apply,
    onProgress: (subscription, created) => {
      if (created.length === 0) return;

      const first = created[0];
      const last = created[created.length - 1];
      const period = created.length === 1
        ? first.paidAt.slice(0, 10)
        : `${first.paidAt.slice(0, 10)} … ${last.paidAt.slice(0, 10)}`;

      console.log(
        `  «${subscription.name}»: ${created.length} ${paymentsWord(created.length)} (${period}), ` +
        `от ${formatAmount(first)} до ${formatAmount(last)}`
      );
    }
  });

  console.log(`\n${apply ? 'Записано' : 'Будет записано'} платежей: ${total}`);
  if (!apply && total > 0) {
    console.log('Ничего не изменено. Повторите с флагом --apply.');
  }

  await mongoose.connection.close();
  console.log('🔌 Подключение закрыто');
};

run().catch(async (error) => {
  console.error('❌ Бэкфилл не выполнен:', error.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
