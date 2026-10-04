const mongoose = require('mongoose');

const jobApplicationSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: [true, 'Job ID is required']
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  contactNo: {
    type: String,
    required: [true, 'Contact number is required'],
    trim: true
  },
  resumePath: {
    type: String,
    required: [true, 'Resume file is required']
  },
  resumeOriginalName: {
    type: String,
    required: true
  },
  demoVideoLink: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        // Validate YouTube, Vimeo, Loom, or other video URLs
        const urlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com|loom\.com|drive\.google\.com)\/.*$/i;
        return urlPattern.test(v);
      },
      message: 'Please provide a valid video URL (YouTube, Vimeo, Loom, or Google Drive)'
    }
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'],
    default: 'pending'
  },
  appliedDate: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true
  },
  adminRating: {
    type: Number,
    min: 1,
    max: 5,
    description: 'Admin rating for the candidate (1-5)'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Prevent duplicate applications for same job by same email
jobApplicationSchema.index({ jobId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('JobApplication', jobApplicationSchema);