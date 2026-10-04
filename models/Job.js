const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  titleHindi: { type: String, default: '' }, descriptionHindi: { type: String, default: '' }, locationHindi: { type: String, default: '' },
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: [100, 'Job title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Job description is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Job type is required'],
    enum: ['full-time', 'part-time', 'contract', 'internship', 'remote'],
    default: 'full-time'
  },
  location: {
    type: String,
    required: [true, 'Job location is required'],
    trim: true
  },
  postedDate: {
    type: Date,
    default: Date.now
  },
  yearsOfExperience: {
    type: Number,
    required: [true, 'Years of experience is required'],
    min: [0, 'Years of experience cannot be negative'],
    max: [50, 'Years of experience cannot exceed 50']
  },
  requireDemoVideo: {
    type: Boolean,
    default: false,
    description: 'Whether this job requires candidates to submit a demo video'
  },
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

// Index for better query performance
jobSchema.index({ isActive: 1, postedDate: -1 });
jobSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Job', jobSchema);
