// models/ModuleTestSubmission.js
const mongoose = require('mongoose');

const moduleTestSubmissionSchema = new mongoose.Schema({
  moduleTest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ModuleTest',
    required: true,
    index: true
  },
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    default: null,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  score: {
    type: Number,
    default: 0
  },
  totalQuestions: {
    type: Number,
    default: 0
  },
  correctAnswers: {
    type: Number,
    default: 0
  },
  wrongAnswers: {
    type: Number,
    default: 0
  },
  timeTaken: {
    type: Number, // in seconds
    required: true
  },
  passed: {
    type: Boolean,
    default: false
  },
  percentage: {
    type: Number,
    default: 0
  },
  answers: [{
    questionUid: String,
    selectedOption: Number,
    isCorrect: Boolean
  }],
  questionOverview: {
    type: Array,
    default: []
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
moduleTestSubmissionSchema.index({ moduleTest: 1, score: -1, timeTaken: 1 });
moduleTestSubmissionSchema.index({ moduleTest: 1, moduleId: 1, score: -1, timeTaken: 1 });
moduleTestSubmissionSchema.index({ email: 1, moduleTest: 1, moduleId: 1 });
moduleTestSubmissionSchema.index({ moduleId: 1, submittedAt: -1 });

module.exports = mongoose.model('ModuleTestSubmission', moduleTestSubmissionSchema);