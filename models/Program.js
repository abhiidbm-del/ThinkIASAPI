const mongoose = require('mongoose');

const programSchema = new mongoose.Schema({
  programNameHindi: { type: String, trim: true, default: '' },
  accessType: {type:String,enum:['pre','mains','combo']},
  overview: {type:String,default:''},
  overviewHindi: {type:String,default:''},
  medium: {type:String,enum:['English','Hindi','Bilingual'],default:'Bilingual'},
  descriptionHindi: { type: String, trim: true, default: '' },
  durationHindi: { type: String, trim: true, default: '' },
  featuresHindi: { type: [String], default: [] },
  programName: {
    type: String,
    required: [true, 'Program name is required'],
    trim: true
  },
  programCategory: {
    type: String,
    required: [true, 'Program category is required'],
    enum: ['Mentorship Course', 'Optional Mentorship Course', 'Test Series', 'Optional Test Series', 'Essay', 'Prelims Program', 'Mains Program', 'Interview Program'],
    default: 'Mentorship Course'
  },
  year: {
    type: String,
    required: [true, 'Year is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  discountedPrice: {
    type: Number,
    min: [0, 'Discounted price cannot be negative'],
    default: null
  },
  displayImage: {
    type: String,
    required: [true, 'Display image URL is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  features: {
    type: [String],
    default: []
  },
  // New date fields
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
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

programSchema.pre('validate', function(next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) this.invalidate('endDate', 'End date must not be before start date.');
  if (this.discountedPrice != null && this.discountedPrice > this.price) this.invalidate('discountedPrice', 'Discounted price must not exceed the price.');
  next();
});
// Pre-save middleware to auto-calculate duration
programSchema.pre('save', function(next) {
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

// Virtual for formatted date range
programSchema.virtual('dateRange').get(function() {
  if (this.startDate && this.endDate) {
    const start = new Date(this.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const end = new Date(this.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    return `${start} - ${end}`;
  }
  return '';
});

// Indexes
programSchema.index({ programCategory: 1, year: -1 });
programSchema.index({ isActive: 1, order: 1 });
programSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('Program', programSchema);
