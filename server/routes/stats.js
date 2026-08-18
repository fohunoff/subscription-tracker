import { Router } from 'express';
import authenticateToken from '../middlewares/authenticateToken.js';
import Subscription from '../models/Subscription.js';
import SubscriptionEvent from '../models/SubscriptionEvent.js';
import { getMonthlyCostInBase, getAnnualCostInBase, getTotalsByCurrency } from '../utils/currency.js';
import { isSubscriptionExpired } from '../utils/cycle.js';
import {
  getLatestCurrencyRates,
  getDailyRatesHistory,
  ratesAtDate
} from '../services/currencyService.js';

const router = Router();

/**
 * Ключ месяца «2026-08». Считается по локальному календарю сервера — так же,
 * как даты платежей во всём остальном коде (getPaymentDateInMonth и прочие).
 * Срез ISO-строки дал бы месяц по UTC, и платёж первого числа уезжал бы
 * в предыдущий месяц, а сетка графика — расходилась с группировкой.
 */
const monthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

router.get('/', authenticateToken, async (req, res) => {
  try {
    // Архивные подписки в текущих тратах не участвуют.
    // Документы, созданные до появления status, поля не имеют — отсюда $ne.
    const activeSubscriptions = await Subscription.find({
      userId: req.userDoc._id,
      status: { $ne: 'archived' }
    });

    // Как и архивные, истёкшие подписки списаний больше не порождают: они
    // могли остаться в списке (archiveOnEnd выключен), но в суммах их нет.
    const subscriptions = activeSubscriptions.filter(sub => !isSubscriptionExpired(sub));
    const expiredCount = activeSubscriptions.length - subscriptions.length;

    // Суммы отдаются в одной валюте: подписки бывают в RUB, USD, EUR и RSD,
    // и без пересчёта итог не значил бы ничего. Считаем в валюте пользователя,
    // а пока он её не сохранил — в валюте курсов; какая вышла, говорим в ответе.
    const { rates, baseCurrency: ratesCurrency } = await getLatestCurrencyRates();
    const baseCurrency = req.userDoc.baseCurrency || ratesCurrency;

    const totalMonthlyCost = subscriptions.reduce(
      (total, sub) => total + getMonthlyCostInBase(sub, rates, baseCurrency),
      0
    );

    const stats = {
      totalSubscriptions: subscriptions.length,
      // Сколько подписок осталось в списке с истёкшим сроком — их стоимость
      // в суммы не входит, и это стоит показать рядом с цифрами
      expiredSubscriptions: expiredCount,
      baseCurrency,
      totalMonthlyCost,
      totalAnnualCost: subscriptions.reduce(
        (total, sub) => total + getAnnualCostInBase(sub, rates, baseCurrency),
        0
      ),
      byCurrency: subscriptions.reduce((acc, sub) => {
        acc[sub.currency] = (acc[sub.currency] || 0) + 1;
        return acc;
      }, {}),
      // Итог в базовой валюте зависит от сегодняшнего курса; разбивка — нет,
      // это суммы, которые действительно списываются. byCurrency оставлен как
      // был (количество подписок) — на него могли завязаться потребители.
      totalsByCurrency: getTotalsByCurrency(subscriptions),
      byCycle: subscriptions.reduce((acc, sub) => {
        acc[sub.cycle] = (acc[sub.cycle] || 0) + 1;
        return acc;
      }, {}),
      averageCost: subscriptions.length > 0 ? totalMonthlyCost / subscriptions.length : 0
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

/**
 * Сколько уже потрачено — по событиям payment из лога подписок.
 *
 * Считается по фактам списаний, а не по текущей цене: в каждом событии
 * записана сумма на момент платежа. Пересчёт в базовую валюту идёт по курсу
 * на дату платежа, иначе прошлогодние траты пересчитывались бы сегодняшним.
 *
 * Часть записей восстановлена бэкфиллом (estimated) — их доля отдаётся
 * отдельно, чтобы интерфейс мог честно сказать, где оценка.
 */
router.get('/spending', authenticateToken, async (req, res) => {
  try {
    // По умолчанию — последние 12 месяцев, включая текущий
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // «За всё время» — период без нижней границы: где он начинается, знает
    // только лог. Клиент не может подставить дату сам, не угадывая глубину
    // истории, а запас «лет на десять» дал бы график из пустых столбцов.
    const allTime = req.query.all === '1' || req.query.all === 'true';

    const from = req.query.from ? new Date(req.query.from) : defaultFrom;
    const to = req.query.to ? new Date(req.query.to) : now;

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return res.status(400).json({ message: 'Некорректные даты периода' });
    }

    const events = await SubscriptionEvent.find({
      userId: req.userDoc._id,
      type: 'payment',
      'changes.paidAt': allTime
        ? { $lte: to.toISOString() }
        : { $gte: from.toISOString(), $lte: to.toISOString() }
    }).lean();

    const { rates: latestRates, baseCurrency: ratesCurrency } = await getLatestCurrencyRates();
    const baseCurrency = req.userDoc.baseCurrency || ratesCurrency;
    const ratesHistory = await getDailyRatesHistory();

    // Названия подписок берём из самих событий: подписку могли удалить,
    // но потраченные на неё деньги от этого никуда не делись
    const byMonth = new Map();
    const bySubscription = new Map();

    let total = 0;
    let estimatedTotal = 0;
    // Дата первого платежа — начало периода для «за всё время».
    // paidAt хранится ISO-строкой, поэтому сравнение строк даёт хронологию.
    let earliestPaidAt = null;

    for (const event of events) {
      const { amount, currency, paidAt, estimated } = event.changes || {};
      if (typeof amount !== 'number' || !paidAt) continue;

      if (!earliestPaidAt || paidAt < earliestPaidAt) earliestPaidAt = paidAt;

      const rates = ratesHistory.length > 0 ? ratesAtDate(ratesHistory, paidAt) : latestRates;
      const rate = rates[currency] || 1;
      const rateToBase = rates[baseCurrency] || 1;
      const inBase = (amount * rate) / rateToBase;

      total += inBase;
      if (estimated) estimatedTotal += inBase;

      const month = monthKey(new Date(paidAt));
      const monthEntry = byMonth.get(month) || { month, total: 0, estimated: 0, count: 0 };
      monthEntry.total += inBase;
      monthEntry.count += 1;
      if (estimated) monthEntry.estimated += inBase;
      byMonth.set(month, monthEntry);

      const key = String(event.subscriptionId);
      const subEntry = bySubscription.get(key) || {
        subscriptionId: key,
        name: event.subscriptionName,
        total: 0,
        count: 0
      };
      subEntry.total += inBase;
      subEntry.count += 1;
      // Название могло меняться — показываем последнее известное
      subEntry.name = event.subscriptionName;
      bySubscription.set(key, subEntry);
    }

    // Период «за всё время» начинается месяцем первого платежа: месяцы до него
    // пусты по определению и только сжимали бы столбцы с данными.
    // Если платежей нет вовсе, показываем текущий месяц — пустой график
    // с осью честнее, чем пустой диапазон.
    const rangeStart = !allTime
      ? from
      : earliestPaidAt
        ? new Date(earliestPaidAt)
        : new Date(to.getFullYear(), to.getMonth(), 1);

    // Месяцы без платежей тоже нужны: в графике это провалы, а не пропуски
    const months = [];
    const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    const lastMonth = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= lastMonth) {
      const key = monthKey(cursor);
      months.push(byMonth.get(key) || { month: key, total: 0, estimated: 0, count: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const topSubscriptions = [...bySubscription.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    res.json({
      success: true,
      spending: {
        baseCurrency,
        from: rangeStart.toISOString(),
        to: to.toISOString(),
        total,
        estimatedTotal,
        paymentsCount: events.length,
        // Курсы известны не с начала времён: платежи старше первой записи
        // считаются по самой ранней из имеющихся
        ratesKnownFrom: ratesHistory.length > 0 ? ratesHistory[0].day : null,
        months,
        topSubscriptions
      }
    });
  } catch (error) {
    console.error('Ошибка получения статистики трат:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

export default router;
