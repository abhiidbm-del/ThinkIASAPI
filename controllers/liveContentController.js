const LiveContent = require('../models/LiveContent');

// Admin: Create live content
const createLiveContent = async (req, res) => {
  try {
    const { youtubeUrl } = req.body;
    const userId = req.user._id;

    if (!youtubeUrl) {
      return res.status(400).json({ 
        message: 'YouTube URL is required' 
      });
    }

    // Check if video already exists
    const existingVideo = await LiveContent.findOne({ 
      youtubeUrl,
      createdBy: userId 
    });

    if (existingVideo) {
      return res.status(400).json({ 
        message: 'This YouTube video has already been added' 
      });
    }

    const liveContent = await LiveContent.create({
      youtubeUrl,
      createdBy: userId
    });

    res.status(201).json({
      message: 'Live content added successfully',
      data: liveContent
    });

  } catch (error) {
    console.error('Create live content error:', error);
    res.status(500).json({ 
      message: 'Failed to add live content',
      error: error.message 
    });
  }
};

// Admin: Get all live content
const getAllLiveContent = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const liveContents = await LiveContent.find({ createdBy: userId })
      .sort({ createdAt: -1 })
      .select('youtubeUrl videoId isActive createdAt');

    res.json({
      message: 'Live content retrieved successfully',
      data: liveContents
    });

  } catch (error) {
    console.error('Get all live content error:', error);
    res.status(500).json({ 
      message: 'Failed to get live content',
      error: error.message 
    });
  }
};

// Admin: Toggle active status
const toggleLiveContentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const liveContent = await LiveContent.findOne({
      _id: id,
      createdBy: userId
    });

    if (!liveContent) {
      return res.status(404).json({ 
        message: 'Live content not found' 
      });
    }

    liveContent.isActive = !liveContent.isActive;
    await liveContent.save();

    res.json({
      message: `Live content ${liveContent.isActive ? 'activated' : 'deactivated'} successfully`,
      data: liveContent
    });

  } catch (error) {
    console.error('Toggle live content status error:', error);
    res.status(500).json({ 
      message: 'Failed to toggle live content status',
      error: error.message 
    });
  }
};

// Admin: Delete live content
const deleteLiveContent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const liveContent = await LiveContent.findOneAndDelete({
      _id: id,
      createdBy: userId
    });

    if (!liveContent) {
      return res.status(404).json({ 
        message: 'Live content not found' 
      });
    }

    res.json({
      message: 'Live content deleted successfully'
    });

  } catch (error) {
    console.error('Delete live content error:', error);
    res.status(500).json({ 
      message: 'Failed to delete live content',
      error: error.message 
    });
  }
};

// Public: Get active live content
const getActiveLiveContent = async (req, res) => {
  try {
    // Get all active live content sorted by latest
    const liveContents = await LiveContent.find({
      isActive: true
    })
    .sort({ createdAt: -1 })
    .select('youtubeUrl videoId createdAt');

    // If no active content found, return empty array
    if (!liveContents || liveContents.length === 0) {
      return res.json({
        message: 'No active live content available',
        data: []
      });
    }

    res.json({
      message: 'Active live content retrieved successfully',
      data: liveContents
    });

  } catch (error) {
    console.error('Get active live content error:', error);
    res.status(500).json({ 
      message: 'Failed to get live content',
      error: error.message 
    });
  }
};

module.exports = {
  createLiveContent,
  getAllLiveContent,
  toggleLiveContentStatus,
  deleteLiveContent,
  getActiveLiveContent
};