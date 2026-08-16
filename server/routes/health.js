import process from 'process';
import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const usersCount = await User.countDocuments();
    const subscriptionsCount = await Subscription.countDocuments();
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      },
      database: {
        status: dbStatus,
        users: usersCount,
        subscriptions: subscriptionsCount
      },
      version: process.env.npm_package_version || '1.0.0',
      node: process.version
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

export default router;
