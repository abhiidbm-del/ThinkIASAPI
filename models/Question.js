const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const multilingualSchema = new mongoose.Schema({
  english: {
    type: String,
    required: true,
    trim: true
  },
  hindi: {
    type: String,
    default: '',
    trim: true
  }
});

const optionSchema = new mongoose.Schema({
  english: {
    type: String,
    required: true,
    trim: true
  },
  hindi: {
    type: String,
    default: '',
    trim: true
  }
});

const questionSchema = new mongoose.Schema({
  uid: {
    type: String,
    unique: true,
    index: true,
    default: () => uuidv4()
  },
  question: {
    type: multilingualSchema,
    required: true
  },
  description: {
    type: new mongoose.Schema({ english: { type: String, default: '', trim: true }, hindi: { type: String, default: '', trim: true } }),
    default: () => ({ english: '', hindi: '' })
  },
  options: [optionSchema],
  correctAnswer: {
    type: Number,
    required: true,
    min: 0,
    max: 3
  },
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
questionSchema.index({ uid: 1 });
questionSchema.index({ tags: 1 });
questionSchema.index({ isActive: 1 });

// Ensure HTML content is preserved
questionSchema.pre('save', function(next) {
  // Ensure all fields have HTML content preserved
  if (this.question && typeof this.question.english === 'string') {
    this.question.english = this.question.english.trim();
  }
  if (this.question && typeof this.question.hindi === 'string') {
    this.question.hindi = this.question.hindi.trim();
  }
  
  next();
});

module.exports = mongoose.model('Question', questionSchema);
