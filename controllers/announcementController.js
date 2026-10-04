const Announcement = require('../models/Announcement');
const { publishSystemNotification } = require('../services/firebaseNotificationService');

// Create announcement (Admin only)
const createAnnouncement = async (req, res) => {
  try {
    const { title, titleHindi, shortDescription, shortDescriptionHindi } = req.body;
    
    // Validate input
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Announcement title is required'
      });
    }
    
    const announcement = await Announcement.create({
      title: title.trim(),
      titleHindi: titleHindi ? titleHindi.trim() : '',
      shortDescription: shortDescription ? shortDescription.trim() : '',
      shortDescriptionHindi: shortDescriptionHindi ? shortDescriptionHindi.trim() : '',
      createdBy: req.user._id
    });
    publishSystemNotification({
      title: announcement.title, titleHindi: announcement.titleHindi, bodyHindi: announcement.shortDescriptionHindi,
      body: announcement.shortDescription || 'A new announcement is available.',
      type: 'news', audience: 'all', link: '/dashboard', createdBy: req.user._id
    }).catch(error => console.error('Announcement push failed:', error.message));
    
    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement
    });
    
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating announcement',
      error: error.message
    });
  }
};

// Get all announcements (Admin - for management)
const getAllAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate('createdBy', 'fullName email')
      .populate('lastUpdatedBy', 'fullName email')
      .sort({ publishDate: -1 });
    
    res.json({
      success: true,
      count: announcements.length,
      data: announcements
    });
    
  } catch (error) {
    console.error('Get all announcements error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements'
    });
  }
};

// Get active announcements (Public) - supports language parameter
const getActiveAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true })
      .select('title titleHindi shortDescription shortDescriptionHindi publishDate isActive createdBy')
      .populate('createdBy', 'fullName email')
      .sort({ publishDate: -1 })
      .limit(20);
    
    // Return all fields as they are
    const responseAnnouncements = announcements.map(ann => ({
      _id: ann._id,
      title: ann.title,
      titleHindi: ann.titleHindi || '',
      shortDescription: ann.shortDescription,
      shortDescriptionHindi: ann.shortDescriptionHindi || '',
      publishDate: ann.publishDate,
      isActive: ann.isActive,
      createdBy: ann.createdBy,
      hasHindi: !!(ann.titleHindi || ann.shortDescriptionHindi)
    }));
    
    res.json({
      success: true,
      count: responseAnnouncements.length,
      data: responseAnnouncements
    });
    
  } catch (error) {
    console.error('Get active announcements error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements'
    });
  }
};

// Get single announcement
const getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findById(id)
      .populate('createdBy', 'fullName email')
      .populate('lastUpdatedBy', 'fullName email');
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    res.json({
      success: true,
      data: announcement
    });
    
  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcement'
    });
  }
};

// Update announcement
const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, titleHindi, shortDescription, shortDescriptionHindi, isActive } = req.body;
    
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    // Prepare update data
    const updateData = { lastUpdatedBy: req.user._id };
    
    if (title !== undefined) updateData.title = title.trim();
    if (titleHindi !== undefined) updateData.titleHindi = titleHindi.trim();
    if (shortDescription !== undefined) updateData.shortDescription = shortDescription.trim();
    if (shortDescriptionHindi !== undefined) updateData.shortDescriptionHindi = shortDescriptionHindi.trim();
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const updatedAnnouncement = await Announcement.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'fullName email')
     .populate('lastUpdatedBy', 'fullName email');
    if (updatedAnnouncement.isActive) publishSystemNotification({ title: updatedAnnouncement.title.slice(0,120), titleHindi: updatedAnnouncement.titleHindi.slice(0,120), body: (updatedAnnouncement.shortDescription || 'Announcement updated.').slice(0,500), bodyHindi: (updatedAnnouncement.shortDescriptionHindi || 'घोषणा अपडेट हुई है।').slice(0,500), type: 'news', audience: 'all', link: '/dashboard', createdBy: req.user._id }).catch(error => console.error('Announcement notification:', error.message));
    
    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: updatedAnnouncement
    });
    
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating announcement',
      error: error.message
    });
  }
};

// Delete announcement
const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    await announcement.deleteOne();
    
    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting announcement'
    });
  }
};

// Toggle announcement status
const toggleAnnouncementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    announcement.isActive = !announcement.isActive;
    announcement.lastUpdatedBy = req.user._id;
    
    await announcement.save();
    
    res.json({
      success: true,
      message: `Announcement ${announcement.isActive ? 'activated' : 'deactivated'} successfully`,
      data: announcement
    });
    
  } catch (error) {
    console.error('Toggle announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling announcement status'
    });
  }
};

module.exports = {
  createAnnouncement,
  getAllAnnouncements,
  getActiveAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementStatus
};
