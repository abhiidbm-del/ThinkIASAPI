const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema({
  language: { type: String, enum: ['en', 'hi'], default: 'en' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  token: { type: String, required: true, unique: true },
  platform: { type: String, enum: ['web', 'android', 'ios'], default: 'web' }
}, { timestamps: true });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
