const mongoose = require('mongoose');
module.exports = mongoose.model('ProgramFaq', new mongoose.Schema({
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true, index: true },
  question: { type: String, required: true, trim: true, maxlength: 500 },
  questionHindi: { type: String, default: '', trim: true, maxlength: 500 },
  answer: { type: String, required: true, trim: true, maxlength: 10000 },
  answerHindi: { type: String, default: '', trim: true, maxlength: 10000 },
  order: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true }));
