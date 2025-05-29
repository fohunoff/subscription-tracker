import { Router } from 'express';
import authenticateToken from '../middlewares/authenticateToken.js';
import Subscription from '../models/Subscription.js';

const router = Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ userId: req.userDoc._id });
    const stats = {
      totalSubscriptions: subscriptions.length,
      totalMonthlyCost: subscriptions.reduce((total, sub) => {
        const monthlyCost = sub.cycle === 'annually' ? sub.cost / 12 : sub.cost;
        return total + monthlyCost;
      }, 0),
      totalAnnualCost: subscriptions.reduce((total, sub) => {
        const annualCost = sub.cycle === 'monthly' ? sub.cost * 12 : sub.cost;
        return total + annualCost;
      }, 0),
      byCurrency: subscriptions.reduce((acc, sub) => {
        acc[sub.currency] = (acc[sub.currency] || 0) + 1;
        return acc;
      }, {}),
      byCycle: subscriptions.reduce((acc, sub) => {
        acc[sub.cycle] = (acc[sub.cycle] || 0) + 1;
        return acc;
      }, {}),
      averageCost: subscriptions.length > 0 ? 
        subscriptions.reduce((total, sub) => {
          const monthlyCost = sub.cycle === 'annually' ? sub.cost / 12 : sub.cost;
          return total + monthlyCost;
        }, 0) / subscriptions.length : 0
    };
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

export default router;
