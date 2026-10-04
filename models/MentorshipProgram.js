const mongoose = require('mongoose');

const mentorshipProgramSchema = new mongoose.Schema({
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', default: null },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', default: null },
  nameHindi: { type: String, trim: true, default: '' },
  descriptionHindi: { type: String, trim: true, default: '' },
  durationHindi: { type: String, trim: true, default: '' },
  name: {
    type: String,
    required: [true, 'Program name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Program description is required']
  },
  duration: {
    type: String,
    required: [true, 'Program duration is required'],
    trim: true
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  medium: {
    type: String,
    required: [true, 'Medium is required'],
    enum: ['english', 'hindi', 'english/hindi'],
  },
  fee: {
    type: Number,
    required: [true, 'Fee is required'],
    min: [0, 'Fee cannot be negative']
  },
  brochureHindi: {
    type: String,
    required: [true, 'Hindi brochure link is required'],
    trim: true
  },
  brochureEnglish: {
    type: String,
    required: [true, 'English brochure link is required'],
    trim: true
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

// Indexes for better performance
mentorshipProgramSchema.index({ isActive: 1, startDate: 1 });
mentorshipProgramSchema.index({ name: 'text', description: 'text' });

const MentorshipProgram = mongoose.model('MentorshipProgram', mentorshipProgramSchema);

module.exports = MentorshipProgram;
