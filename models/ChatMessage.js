const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  result: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Result',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  parentMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatMessage'
  }
}, {
  timestamps: true
});

// Indexes for better performance
chatMessageSchema.index({ result: 1, createdAt: -1 });
chatMessageSchema.index({ sender: 1, receiver: 1 });
chatMessageSchema.index({ isRead: 1 });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = ChatMessage;