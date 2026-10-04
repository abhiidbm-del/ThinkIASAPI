const mongoose = require('mongoose');

const examReopenSchema = new mongoose.Schema({
  test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  until: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

examReopenSchema.index({ test: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('ExamReopen', examReopenSchema);
