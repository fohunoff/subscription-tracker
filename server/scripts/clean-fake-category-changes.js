/**
 * Убирает из лога подписок ложные «смены категории».
 *
 * До исправления normalize() (server/services/subscriptionEvents.js) снимки
 * «до» и «после» приводили populated-категорию к строке по-разному:
 * «[object Object]» против inspect-вывода документа mongoose. Из-за этого
 * любая правка подписки записывалась в историю как смена категории, а в
 * интерфейсе выглядела как «Категория: другая категория → другая категория».
 *
 * Скрипт удаляет ключ categoryId из changes у таких записей; если других
 * изменений в событии не было, удаляет и само событие — «Изменения» без
 * единого изменения ничего не значат.
 *
 * Запуск (из папки server):
 *   node scripts/clean-fake-category-changes.js          # только показать
 *   node scripts/clean-fake-category-changes.js --apply  # применить
 *
 * Идемпотентен: повторный запуск ничего не находит. Настоящие смены категории
 * не трогает — у них оба значения являются идентификаторами.
 */
import process from 'process';
import mongoose from 'mongoose';
import { env } from '../config.js';
import SubscriptionEvent from '../models/SubscriptionEvent.js';

const OBJECT_ID = /^[0-9a-f]{24}$/i;

// Настоящее изменение категории: обе стороны — идентификаторы (или пусто,
// если поле почему-то не заполнено). Всё остальное — след старого бага.
const isRealCategoryChange = (change) =>
  [change?.from, change?.to].every(
    value => value === null || value === undefined || OBJECT_ID.test(String(value))
  );

const run = async () => {
  const apply = process.argv.includes('--apply');

  await mongoose.connect(env.mongodbUri);
  console.log(`✅ MongoDB подключена: ${mongoose.connection.host}`);
  console.log(apply ? 'Режим: применение изменений' : 'Режим: проверка (--apply, чтобы применить)');

  const events = await SubscriptionEvent.find({
    type: 'updated',
    'changes.categoryId': { $exists: true }
  });

  let cleaned = 0;
  let removed = 0;

  for (const event of events) {
    const changes = event.changes || {};
    if (isRealCategoryChange(changes.categoryId)) continue;

    const rest = { ...changes };
    delete rest.categoryId;
    const restKeys = Object.keys(rest);

    if (restKeys.length === 0) {
      removed += 1;
      console.log(`  удалить событие ${event._id} («${event.subscriptionName}», ${event.createdAt.toISOString().slice(0, 10)})`);
      if (apply) await SubscriptionEvent.deleteOne({ _id: event._id });
    } else {
      cleaned += 1;
      console.log(`  почистить событие ${event._id} («${event.subscriptionName}»), останется: ${restKeys.join(', ')}`);
      if (apply) {
        event.changes = rest;
        // changes объявлено как Mixed — без markModified mongoose не заметит правку
        event.markModified('changes');
        await event.save();
      }
    }
  }

  console.log(
    `\nСобытий с изменением категории: ${events.length}; ` +
    `${apply ? 'почищено' : 'будет почищено'}: ${cleaned}, ` +
    `${apply ? 'удалено' : 'будет удалено'}: ${removed}`
  );

  if (!apply && cleaned + removed > 0) {
    console.log('Ничего не изменено. Повторите с флагом --apply.');
  }

  await mongoose.connection.close();
  console.log('🔌 Подключение закрыто');
};

run().catch(async (error) => {
  console.error('❌ Чистка не выполнена:', error.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
