// models/StudentAnswerSubmission.js

const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  answerPDF: {
    type: String,
    required: true
  },
  language: {
    type: String,
    enum: ['en', 'hi'],
    default: 'en'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  // NEW: Evaluation fields
  evaluation: {
    evaluatedPDF: {
      type: String,
      default: ''
    },
    evaluatedAt: {
      type: Date
    },
    evaluatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    remarks: {
      type: String,
      default: ''
    },
    score: {
      type: Number,
      min: 0,
      max: 100
    }
  }
});

const studentAnswerSubmissionSchema = new mongoose.Schema({
  answerWritingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnswerWriting',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  answers: [answerSchema],
  isLate: {
    type: Boolean,
    default: false
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  submissionLanguage: {
    type: String,
    enum: ['en', 'hi'],
    default: 'en'
  }
}, {
  timestamps: true
});

// Indexes
studentAnswerSubmissionSchema.index({ answerWritingId: 1, studentId: 1 }, { unique: true });
studentAnswerSubmissionSchema.index({ studentId: 1, submittedAt: -1 });

module.exports = mongoose.model('StudentAnswerSubmission', studentAnswerSubmissionSchema);