const mongoose = require('mongoose');

const liveContentSchema = new mongoose.Schema({
  youtubeUrl: {
    type: String,
    required: [true, 'YouTube URL is required'],
    trim: true,
    validate: {
      validator: function(v) {
        // Basic YouTube URL validation
        const youtubeRegex = /^(https?\:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
        return youtubeRegex.test(v);
      },
      message: 'Please provide a valid YouTube URL'
    }
  },
  
  videoId: {
    type: String,
    trim: true
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

// Extract YouTube video ID before saving
liveContentSchema.pre('save', function(next) {
  if (this.youtubeUrl) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = this.youtubeUrl.match(regExp);
    this.videoId = (match && match[7].length == 11) ? match[7] : null;
  }
  next();
});

module.exports = mongoose.model('LiveContent', liveContentSchema);