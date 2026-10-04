const mongoose = require('mongoose');

const supportFeatureSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  titleHindi: { type: String, trim: true, default: '', maxlength: 250 },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  descriptionHindi: { type: String, trim: true, default: '', maxlength: 3000 },
  points: [{ type: String, trim: true, maxlength: 500 }],
  pointsHindi: [{ type: String, trim: true, maxlength: 500 }],
  footer: { type: String, trim: true, default: '', maxlength: 1500 },
  footerHindi: { type: String, trim: true, default: '', maxlength: 1500 },
  icon: { type: String, trim: true, default: 'bi-check-circle', maxlength: 80 },
  displayOrder: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

supportFeatureSchema.index({ isActive: 1, displayOrder: 1 });

module.exports = mongoose.model('SupportFeature', supportFeatureSchema);
