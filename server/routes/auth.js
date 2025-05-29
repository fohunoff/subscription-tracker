import process from 'process';
import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { generateToken } from '../utils/index.js';
import User from '../models/User.js';

// Получение текущего пользователя
import authenticateToken from '../middlewares/authenticateToken.js';

const router = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google OAuth авторизация
router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Токен Google не предоставлен' });
    }
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture, email_verified } = payload;
    if (!email_verified) {
      return res.status(400).json({ message: 'Email не подтвержден в Google аккаунте' });
    }
    let user = await User.findOne({ googleId });
    if (!user) {
      user = await User.create({
        googleId,
        email,
        name,
        avatar: picture,
        provider: 'google',
        isEmailVerified: true,
        lastLogin: new Date()
      });
    } else {
      user.lastLogin = new Date();
      user.avatar = picture;
      user.name = name;
      await user.save();
    }
    const authToken = generateToken(user);
    res.json({
      success: true,
      token: authToken,
      user: {
        id: user.googleId,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Google OAuth ошибка:', error);
    if (error.message?.includes('Token used too early')) {
      return res.status(400).json({ message: 'Токен Google используется слишком рано. Попробуйте еще раз через несколько секунд.' });
    }
    res.status(401).json({ success: false, message: 'Неверный Google токен' });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  const user = req.userDoc;
  res.json({
    user: {
      id: user.googleId,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      provider: user.provider,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }
  });
});

// Выход
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ success: true, message: 'Выход выполнен успешно' });
});

export default router;
