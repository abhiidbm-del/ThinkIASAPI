const ChatMessage = require('../models/ChatMessage');
const Result = require('../models/Result');
const User = require('../models/User');

// Send a new message
const sendMessage = async (req, res) => {
  try {
    const { result: resultId, message, parentMessage } = req.body;
    const senderId = req.user._id;

    // Validate input
    if (!resultId || !message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Result ID and message are required'
      });
    }

    // Verify result exists
    const result = await Result.findById(resultId);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Test result not found'
      });
    }

    // Determine receiver based on sender role
    let receiverId;
    if (req.user.role === 'student') {
      // Student sending to admin - find any admin
      const admin = await User.findOne({ role: 'admin' });
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'No admin found'
        });
      }
      receiverId = admin._id;
    } else if (req.user.role === 'admin') {
      // Admin sending to student (from result)
      receiverId = result.student;
    } else {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized role'
      });
    }

    // Create new message
    const newMessage = new ChatMessage({
      result: resultId,
      sender: senderId,
      receiver: receiverId,
      message: message.trim(),
      parentMessage: parentMessage || null
    });

    await newMessage.save();

    // Populate sender details
    await newMessage.populate('sender', 'fullName email role');
    
    res.status(201).json(newMessage);
    
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
};

// Get chat messages for a result
const getChatMessages = async (req, res) => {
  try {
    const { resultId } = req.params;
    const userId = req.user._id;

    // Verify result exists and user has access
    const result = await Result.findById(resultId);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Test result not found'
      });
    }

    // Check authorization
    if (req.user.role === 'student' && result.student.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Get messages
    const chatMessages = await ChatMessage.find({ result: resultId })
      .populate('sender', 'fullName email role')
      .populate('receiver', 'fullName email role')
      .sort({ createdAt: 1 });

    // Mark unread messages as read for current user
    await ChatMessage.updateMany(
      {
        result: resultId,
        receiver: userId,
        isRead: false
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    res.json(chatMessages);
    
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load messages'
    });
  }
};

// Update a message
const updateMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message text is required'
      });
    }

    // Find and verify message
    const existingMessage = await ChatMessage.findById(messageId);
    if (!existingMessage) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is the sender
    if (existingMessage.sender.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this message'
      });
    }

    // Update message
    existingMessage.message = message.trim();
    existingMessage.isEdited = true;
    await existingMessage.save();

    // Populate sender details
    await existingMessage.populate('sender', 'fullName email role');
    
    res.json(existingMessage);
    
  } catch (error) {
    console.error('Update message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update message'
    });
  }
};

// Delete a message
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await ChatMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is the sender or admin
    if (message.sender.toString() !== userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message'
      });
    }

    await message.deleteOne();

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message'
    });
  }
};

module.exports = {
  sendMessage,
  getChatMessages,
  updateMessage,
  deleteMessage
};