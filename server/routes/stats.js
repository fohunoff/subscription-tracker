import { Router } from 'express';
import authenticateToken from '../middlewares/authenticateToken.js';
import Subscription from '../models/Subscription.js';
import { getMonthlyCost, getAnnualCost } from '../utils/cycle.js';

const router = Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    // Архивные подписки в текущих тратах не участвуют.
    // Документы, созданные до появления status, поля не имеют — отсюда $ne.
    const subscriptions = await Subscription.find({
      userId: req.userDoc._id,
      status: { $ne: 'archived' }
    });

    const totalMonthlyCost = subscriptions.reduce((total, sub) => total + getMonthlyCost(sub), 0);

    const stats = {
      totalSubscriptions: subscriptions.length,
      totalMonthlyCost,
      totalAnnualCost: subscriptions.reduce((total, sub) => total + getAnnualCost(sub), 0),
      byCurrency: subscriptions.reduce((acc, sub) => {
        acc[sub.currency] = (acc[sub.currency] || 0) + 1;
        return acc;
      }, {}),
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

export default router;
