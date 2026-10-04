const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  titleHindi: { type: String, trim: true, maxlength: 120, default: '' },
  bodyHindi: { type: String, trim: true, maxlength: 500, default: '' },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  body: { type: String, required: true, trim: true, maxlength: 500 },
  type: { type: String, enum: ['news', 'test_series', 'general'], default: 'general' },
  audience: { type: String, enum: ['all', 'fresh', 'pre', 'mains', 'combo'], default: 'all' },
  link: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

notificationSchema.index({ audience: 1, createdAt: -1 });
module.exports = mongoose.model('Notification', notificationSchema);
