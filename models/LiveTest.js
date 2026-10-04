const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
  },
  questionTextHi: {
    type: String
  },
  marks: {
    type: Number,
    default: 0
  }
}, { _id: true });

const liveTestSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  titleHi: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['Full-Length', 'Sectional'],
    required: true
  },
  subject: {
    type: String,
    required: true,
    enum: ['GS Paper I', 'GS Paper II', 'GS Paper III', 'GS Paper IV', 'Essay Paper', 'Optional Paper', 'Compulsory Paper']
  },
  description: {
    type: String,
    trim: true
  },
  descriptionHi: {
    type: String,
    trim: true
  },
  questionPaperPDF: {
    type: String,
    trim: true
  },
  questionPaperPDFHi: {
    type: String,
    trim: true
  },
  questions: [questionSchema],
  meetLink: {
    type: String,
    required: true,
    trim: true
  },
  instructions: {
    type: String,
    trim: true
  },
  startDateTime: {
    type: Date,
    required: true
  },
  endDateTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for efficient queries
liveTestSchema.index({ startDateTime: 1, endDateTime: 1 });
liveTestSchema.index({ isActive: 1 });
liveTestSchema.index({ subject: 1 });
liveTestSchema.index({ type: 1 });

module.exports = mongoose.model('LiveTest', liveTestSchema);