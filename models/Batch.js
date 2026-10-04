const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  batchNameHindi: { type: String, trim: true, default: '' },
  durationHindi: { type: String, trim: true, default: '' },
  programId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Program',
    required: [true, 'Program ID is required']
  },
  batchName: {
    type: String,
    required: [true, 'Batch name is required'],
    trim: true
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  duration: {
    type: String,
    default: ''
  },
  brochureHindi: {
    type: String,
    trim: true,
    default: ''
  },
  brochureEnglish: {
    type: String,
    trim: true,
    default: ''
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

// Pre-save middleware to auto-calculate duration
batchSchema.pre('save', function(next) {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate - this.startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffMonths / 12);
    
    if (diffYears > 0) {
      const remainingMonths = diffMonths % 12;
      if (remainingMonths > 0) {
        this.duration = `${diffYears} year${diffYears > 1 ? 's' : ''} ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
      } else {
        this.duration = `${diffYears} year${diffYears > 1 ? 's' : ''}`;
      }
    } else if (diffMonths > 0) {
      const remainingDays = diffDays % 30;
      if (remainingDays > 0) {
        this.duration = `${diffMonths} month${diffMonths > 1 ? 's' : ''} ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
      } else {
        this.duration = `${diffMonths} month${diffMonths > 1 ? 's' : ''}`;
      }
    } else {
      this.duration = `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    }
  }
  next();
});

// Indexes
batchSchema.index({ programId: 1, order: 1 });
batchSchema.index({ programId: 1, isActive: 1 });

module.exports = mongoose.model('Batch', batchSchema);