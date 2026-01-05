import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  name: {
    type: String,
    required: true
  },
  avatar: String,
  provider: {
    type: String,
    enum: ['google'],
    default: 'google'
  },
  isEmailVerified: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  // Telegram integration fields
  telegramChatId: {
    type: String,
    unique: true,
    sparse: true, // Allows null values to be non-unique
    index: true
  },
  telegramUsername: {
    type: String
  },
  telegramConnectionToken: {
    type: String,
    unique: true,
    sparse: true
  },
  telegramConnectionTokenExpires: {
    type: Date
  },
  telegramConnectedAt: {
    type: Date
  },
  // Настройки уведомлений
  notificationTime: {
    type: String,
    default: '10:00', // Время в формате HH:MM
    validate: {
      validator: function(v) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Неверный формат времени. Используйте HH:MM'
    }
  },
  // Настройки месячных уведомлений
  monthlyNotificationsEnabled: {
    type: Boolean,
    default: true
  },
  lastMonthlyNotificationSent: {
    type: Date
  }
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);
export default User;
