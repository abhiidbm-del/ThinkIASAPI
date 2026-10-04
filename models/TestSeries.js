const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  kind: { type: String, enum: ['pre', 'mains'], required: true, index: true },
  name: { type: String, required: true, trim: true }, nameHi: { type: String, default: '' },
  description: { type: String, required: true }, descriptionHi: { type: String, default: '' },
  intro: { type: String, default: '', maxlength: 20000 }, introHi: { type: String, default: '', maxlength: 20000 },
  startDate: { type: Date, required: true }, endDate: { type: Date, required: true },
  testDates: [{ date: { type: Date, required: true }, time: { type: String, default: '09:00', match: /^([01]\d|2[0-3]):[0-5]\d$/ }, duration: { type: Number, min: 1, max: 1440, required: true } }],
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
schema.pre('validate', function(next) {
  if (!Number.isFinite(+this.startDate) || !Number.isFinite(+this.endDate) || this.endDate < this.startDate) this.invalidate('endDate', 'Select a valid start and end date.');
  if (!this.testDates.length || this.testDates.length > 1000) this.invalidate('testDates', 'Provide between 1 and 1000 test dates.');
  const seen = new Set();
  for (const item of this.testDates) {
    if (!Number.isFinite(+item.date) || item.date < this.startDate || item.date > this.endDate) this.invalidate('testDates', 'Every test date must be within the series date range.');
    const key = `${+item.date}:${item.time}`;
    if (seen.has(key)) this.invalidate('testDates', 'Duplicate test date and time.');
    seen.add(key);
  }
  next();
});
module.exports = mongoose.model('TestSeries', schema);
