const mongoose = require('mongoose');
const { TEST } = require('../config/constants');

const testSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  startTime: {
    type: Date,
    required: true,
    index: true
  },
  endTime: {
    type: Date,
    required: true,
    index: true,
    // validate: {
    //   validator: function(value) {
    //     return value > this.startTime;
    //   },
    //   message: 'End time must be after start time'
    // }
  },
  duration: {
    type: Number, // in minutes - how long the test lasts once started
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
  videoLink: {
    type: String,
    trim: true,
    default: ''
  },
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
  },
  seriesId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestSeries', default: null, index: true },
  seriesKind: { type: String, enum: ['pre', 'mains'] },
  slotId: { type: mongoose.Schema.Types.ObjectId, default: null }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total marks
testSchema.virtual('totalMarks').get(function() {
  if (!this.questionUids || !Array.isArray(this.questionUids)) {
    return 0;
  }
  return this.questionUids.length * (this.marksPerQuestion || 1);
});

// Virtual for status
testSchema.virtual('status').get(function() {
  const now = new Date();
  
  if (!this.startTime || !this.endTime) {
    return TEST.STATUS.UPCOMING;
  }
  
  if (now < this.startTime) return TEST.STATUS.UPCOMING;
  if (now <= this.endTime) return TEST.STATUS.ACTIVE;
  return TEST.STATUS.COMPLETED;
});

// Virtual for test completion deadline (when test must be submitted)
testSchema.virtual('completionDeadline').get(function() {
  if (!this.startTime || !this.duration) return null;
  
  // This would be calculated when a student starts the test
  // Not stored in the test model
  return null;
});

// Virtual for remaining time to start the test (in minutes)
testSchema.virtual('remainingStartTime').get(function() {
  const now = new Date();
  
  if (!this.endTime) {
    return 0;
  }
  
  const endTime = new Date(this.endTime);
  
  if (now > endTime) return 0;
  
  const remainingMs = endTime.getTime() - now.getTime();
  return Math.ceil(remainingMs / (1000 * 60)); // Convert to minutes
});

// Virtual to check if test can be started
testSchema.virtual('canBeStarted').get(function() {
  const now = new Date();
  
  if (!this.startTime || !this.endTime) {
    return false;
  }
  
  return now >= this.startTime && now <= this.endTime;
});

// Virtual to check if test has expired (past endTime)
testSchema.virtual('hasExpired').get(function() {
  const now = new Date();
  
  if (!this.endTime) {
    return false;
  }
  
  return now > this.endTime;
});

// Virtual to populate questions
testSchema.virtual('questions', {
  ref: 'Question',
  localField: 'questionUids',
  foreignField: 'uid',
  justOne: false
});

// Indexes
testSchema.index({ startTime: 1, isActive: 1 });
testSchema.index({ endTime: 1, isActive: 1 });
testSchema.index({ createdBy: 1 });
testSchema.index({ questionUids: 1 });
testSchema.index({ seriesId: 1, slotId: 1 });

module.exports = mongoose.model('Test', testSchema);