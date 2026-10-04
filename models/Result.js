const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  test: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  answers: [{
    questionUid: {
      type: String,
      required: true
    },
    questionIndex: {
      type: Number,
      required: true
    },
    selectedOption: {
      type: Number,
      required: true,
      min: -1, // -1 for unattempted
      max: 3
    },
    isCorrect: {
      type: Boolean,
      default: false
    },
    isAttempted: {
      type: Boolean,
      default: false
    },
    correctAnswer: {
      type: Number,
      required: true
    },
    marksObtained: {
      type: Number,
      default: 0
    }
  }],
  score: {
    type: Number,
    default: 0
  },
  totalMarks: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    default: 0
  },
  timeTaken: {
    type: Number, // in seconds
    required: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  summary: {
    totalQuestions: Number,
    correctAnswers: Number,
    wrongAnswers: Number,
    unattempted: Number,
    marksPerQuestion: Number,
    negativeMarks: Number
  }
}, {
  timestamps: true
});

// Index for better performance
resultSchema.index({ test: 1, student: 1 }, { unique: true });
resultSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('Result', resultSchema);