import { Router } from 'express';
import { getLatestCurrencyRates, updateCurrencyRates } from '../services/currencyService.js';
import authenticateToken from '../middlewares/authenticateToken.js';

const router = Router();

/**
 * Получить последние курсы валют
 * GET /api/currency-rates/latest
 */
router.get('/latest', async (req, res) => {
  try {
    const currencyData = await getLatestCurrencyRates();

    res.json({
      success: true,
      ...currencyData
    });

  } catch (error) {
    console.error('Ошибка получения курсов валют:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения курсов валют'
    });
  }
});

/**
 * Принудительно обновить курсы валют (только для авторизованных пользователей)
 * POST /api/currency-rates/update
 */
router.post('/update', authenticateToken, async (req, res) => {
  try {
    const currencyRate = await updateCurrencyRates();

    // Конвертируем Map в объект для ответа
    const rates = {};
    currencyRate.rates.forEach((value, key) => {
      rates[key] = value;
    });

    res.json({
      success: true,
      rates,
      baseCurrency: currencyRate.baseCurrency,
      source: currencyRate.source,
      fetchedAt: currencyRate.fetchedAt
    });

  } catch (error) {
    console.error('Ошибка обновления курсов валют:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления курсов валют'
    });
  }
});

export default router;
