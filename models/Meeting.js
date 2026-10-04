const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Meeting title is required'],
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  meetingDate: {
    type: Date,
    required: [true, 'Meeting date and time is required']
  },
  duration: {
    type: Number, // in minutes
    required: [true, 'Duration is required'],
    min: [1, 'Duration must be at least 1 minute']
  },
  meetingLink: {
    type: String,
    required: [true, 'Meeting link is required']
  },
  videoLink: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['upcoming', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  audience: {
    type: String,
    enum: ['pre', 'mains'],
    default: 'pre',
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
meetingSchema.index({ meetingDate: 1 });
meetingSchema.index({ status: 1 });

// Calculate if meeting is completed based on current time
meetingSchema.methods.isCompleted = function() {
  const now = new Date();
  const meetingEnd = new Date(this.meetingDate.getTime() + (this.duration * 60000));
  return now > meetingEnd;
};

module.exports = mongoose.model('Meeting', meetingSchema);