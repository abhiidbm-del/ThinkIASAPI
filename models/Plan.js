const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  nameHindi: { type: String, trim: true, default: '' },
  subtitleHindi: { type: String, trim: true, default: '' },
  badgeHindi: { type: String, trim: true, default: '' },
  durationHindi: { type: String, trim: true, default: '' },
  featuresHindi: { type: [String], default: [] },
  id: { type: String, required: true, unique: true, match: /^[a-z0-9][a-z0-9-]{0,79}$/, lowercase: true, trim: true },
  accessType: { type: String, enum: ['pre', 'mains', 'combo'], required: true, default: function() { return ['pre', 'mains', 'combo'].includes(this.id) ? this.id : 'pre'; } },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  subtitle: { type: String, default: '', trim: true, maxlength: 300 },
  badge: { type: String, default: '', trim: true, maxlength: 80 },
  baseAmount: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  duration: { type: String, default: '', trim: true, maxlength: 100 },
  features: [{ type: String, trim: true }],
  displayOrder: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);
