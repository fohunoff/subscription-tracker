/**
 * Проставляет status: 'active' подпискам, созданным до появления архива.
 *
 * Запуск: node scripts/migrate-add-status.js (из папки server)
 *
 * Скрипт идемпотентен: повторный запуск ничего не меняет. Строго говоря,
 * приложение работает и без него — выборки активных подписок написаны как
 * { status: { $ne: 'archived' } } именно для того, чтобы документы без поля
 * считались активными. Миграция нужна для единообразия данных.
 */
import process from 'process';
import mongoose from 'mongoose';
import { env } from '../config.js';
import Subscription from '../models/Subscription.js';

const run = async () => {
  await mongoose.connect(env.mongodbUri);
  console.log(`✅ MongoDB подключена: ${mongoose.connection.host}`);

  const missing = await Subscription.countDocuments({ status: { $exists: false } });
  console.log(`Подписок без поля status: ${missing}`);

  if (missing > 0) {
    const result = await Subscription.updateMany(
      { status: { $exists: false } },
      { $set: { status: 'active' } }
    );
    console.log(`Обновлено: ${result.modifiedCount}`);
  }

  const active = await Subscription.countDocuments({ status: 'active' });
  const archived = await Subscription.countDocuments({ status: 'archived' });
  console.log(`Итого — активных: ${active}, в архиве: ${archived}`);

  await mongoose.connection.close();
  console.log('🔌 Подключение закрыто');
};

run().catch(async (error) => {
  console.error('❌ Миграция не выполнена:', error.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
