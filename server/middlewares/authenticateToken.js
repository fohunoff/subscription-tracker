import process from 'process';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  const token = authHeader?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Токен не предоставлен' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
    const user = await User.findOne({ googleId: decoded.userId });
    if (!user) {
      return res.status(401).json({ message: 'Пользователь не найден' });
    }
    req.user = decoded;
    req.userDoc = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Токен истек' });
    }
    return res.status(403).json({ message: 'Неверный токен' });
  }
};

export default authenticateToken;
