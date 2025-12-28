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
  }
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);
export default User;
