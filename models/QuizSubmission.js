// models/QuizSubmission.js
const mongoose = require('mongoose');

const quizSubmissionSchema = new mongoose.Schema({
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
    index: true
  },
  // NEW: Link to module/folder
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
  // NEW: Quiz result fields
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
  // NEW: Detailed question overview for results page
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

// Compound index for leaderboard sorting
quizSubmissionSchema.index({ quiz: 1, score: -1, timeTaken: 1 });
quizSubmissionSchema.index({ quiz: 1, moduleId: 1, score: -1, timeTaken: 1 });
quizSubmissionSchema.index({ email: 1, quiz: 1, moduleId: 1 });
quizSubmissionSchema.index({ moduleId: 1, submittedAt: -1 });

// Method to check if user can retake quiz
quizSubmissionSchema.statics.canRetake = async function(quizId, moduleId, email, maxAttempts = 1) {
  const submissionCount = await this.countDocuments({
    quiz: quizId,
    moduleId: moduleId,
    email: email
  });
  return submissionCount < maxAttempts;
};

// Method to get user's best score
quizSubmissionSchema.statics.getBestScore = async function(quizId, moduleId, email) {
  const bestSubmission = await this.findOne({
    quiz: quizId,
    moduleId: moduleId,
    email: email
  }).sort({ score: -1, timeTaken: 1 });
  
  return bestSubmission;
};

module.exports = mongoose.model('QuizSubmission', quizSubmissionSchema);