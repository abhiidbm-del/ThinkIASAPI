// models/AnswerWriting.js

const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true
  },
  questionTextHi: {
    type: String,
    trim: true,
    default: ''
  }
});

const answerWritingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Exercise name is required'],
    trim: true
  },
  nameHi: {
    type: String,
    trim: true,
    default: ''
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  descriptionHi: {
    type: String,
    trim: true,
    default: ''
  },
  questions: [questionSchema],
  questionPaperPDF: {
    type: String,
    trim: true,
    default: ''
  },
  questionPaperPDFHi: {
    type: String,
    trim: true,
    default: ''
  },
  // NEW: Model Answer Fields
  modelAnswer: {
    remark: {
      type: String,
      default: ''
    },
    answerEnglish: {
      type: String,
      default: ''
    },
    answerHindi: {
      type: String,
      default: ''
    },
    modelAnswerPDF: {
      type: String,
      default: ''
    },
    modelAnswerPDFHi: {
      type: String,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  startDateTime: {
    type: Date,
    required: [true, 'Start date and time is required']
  },
  endDateTime: {
    type: Date,
    required: [true, 'End date and time is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
answerWritingSchema.index({ startDateTime: 1, endDateTime: 1 });
answerWritingSchema.index({ isActive: 1, order: -1 });

// Virtual to check if exercise is available for submission
answerWritingSchema.virtual('isAvailable').get(function() {
  const now = new Date();
  return this.isActive && now >= this.startDateTime && now <= this.endDateTime;
});

// Virtual to check if exercise is upcoming
answerWritingSchema.virtual('isUpcoming').get(function() {
  const now = new Date();
  return this.isActive && now < this.startDateTime;
});

// Virtual to check if exercise is expired
answerWritingSchema.virtual('isExpired').get(function() {
  const now = new Date();
  return this.isActive && now > this.endDateTime;
});

module.exports = mongoose.model('AnswerWriting', answerWritingSchema);