const mongoose = require('mongoose');

const demoTestSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  duration: {
    type: Number, // in minutes
    required: true,
    min: 1
  },
  marksPerQuestion: {
    type: Number,
    default: 1,
    min: 0
  },
  negativeMarks: {
    type: Number,
    default: 0,
    min: 0
  },
  questionUids: [{
    type: String,
    required: true,
    ref: 'Question'
  }],
  introPage: {
    type: String,
    trim: true,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total marks
demoTestSchema.virtual('totalMarks').get(function() {
  if (!this.questionUids || !Array.isArray(this.questionUids)) {
    return 0;
  }
  return this.questionUids.length * (this.marksPerQuestion || 1);
});

// Virtual to populate questions
demoTestSchema.virtual('questions', {
  ref: 'Question',
  localField: 'questionUids',
  foreignField: 'uid',
  justOne: false
});

// Indexes
demoTestSchema.index({ isActive: 1 });
demoTestSchema.index({ createdBy: 1 });
demoTestSchema.index({ questionUids: 1 });

module.exports = mongoose.model('DemoTest', demoTestSchema);