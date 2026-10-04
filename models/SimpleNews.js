const mongoose = require('mongoose');

const simpleNewsSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'News text is required'],
    trim: true,
    maxlength: [1000, 'News text cannot exceed 1000 characters']
  },
  
  textHi: {
    type: String,
    required: [true, 'Hindi news text is required'],
    trim: true,
    maxlength: [1000, 'Hindi news text cannot exceed 1000 characters']
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Admin tracking
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for active news
simpleNewsSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('SimpleNews', simpleNewsSchema);