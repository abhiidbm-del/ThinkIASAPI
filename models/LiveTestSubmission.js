const mongoose = require('mongoose');

const liveTestSubmissionSchema = new mongoose.Schema({
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveTest', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  answerPDF: { type: String, required: true },
  answerPDFKey: { type: String, required: true },
  originalName: { type: String, default: 'answer-sheet.pdf' },
  language: { type: String, enum: ['en', 'hi'], default: 'en' },
  joinedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date, default: Date.now },
  isLate: { type: Boolean, default: false },
  status: { type: String, enum: ['submitted', 'evaluated'], default: 'submitted' }
}, { timestamps: true });

liveTestSubmissionSchema.index({ testId: 1, studentId: 1 }, { unique: true });
module.exports = mongoose.model('LiveTestSubmission', liveTestSubmissionSchema);
