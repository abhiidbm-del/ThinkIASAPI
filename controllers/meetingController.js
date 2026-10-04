const Meeting = require('../models/Meeting');

// Create new meeting
const createMeeting = async (req, res) => {
  try {
    const { title, description, meetingDate, duration, meetingLink } = req.body;
    const userId = req.user._id;

    // Validation
    if (!title || !meetingDate || !duration || !meetingLink) {
      return res.status(400).json({
        message: 'Title, date, duration, and meeting link are required'
      });
    }

    // Check if meeting date is in the future
    const meetingDateTime = new Date(meetingDate);
    const now = new Date();
    if (meetingDateTime <= now) {
      return res.status(400).json({
        message: 'Meeting date must be in the future'
      });
    }

    // Validate duration
    if (parseInt(duration) <= 0) {
      return res.status(400).json({
        message: 'Duration must be greater than 0'
      });
    }

    // Create meeting
    const audience = req.body.audience === 'mains' ? 'mains' : 'pre';
    const meeting = new Meeting({
      title: title.trim(),
      description: (description || '').trim(),
      meetingDate: meetingDateTime,
      duration: parseInt(duration),
      meetingLink: meetingLink.trim(),
      audience,
      createdBy: userId,
      status: 'upcoming'
    });

    await meeting.save();

    res.status(201).json({
      message: 'Meeting created successfully',
      meeting
    });

  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({
      message: 'Failed to create meeting',
      error: error.message
    });
  }
};

// Get all meetings for admin (upcoming and completed)
const getAdminMeetings = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    // Get all meetings created by this admin
    const audienceFilter = req.query.audience === 'mains' ? { audience: 'mains' } : req.query.audience === 'pre' ? { $or: [{ audience: 'pre' }, { audience: { $exists: false } }] } : {};
    const meetings = await Meeting.find({ createdBy: userId, ...audienceFilter })
      .sort({ meetingDate: 1 });

    // Separate into upcoming and completed based on current time
    const upcomingMeetings = [];
    const completedMeetings = [];

    meetings.forEach(meeting => {
      const meetingEnd = new Date(meeting.meetingDate.getTime() + (meeting.duration * 60000));
      
      if (now <= meetingEnd) {
        upcomingMeetings.push(meeting);
      } else {
        // Update status to completed if not already
        if (meeting.status === 'upcoming') {
          meeting.status = 'completed';
          meeting.save();
        }
        completedMeetings.push(meeting);
      }
    });

    // Sort upcoming by date (earliest first)
    upcomingMeetings.sort((a, b) => new Date(a.meetingDate) - new Date(b.meetingDate));
    
    // Sort completed by date (most recent first)
    completedMeetings.sort((a, b) => new Date(b.meetingDate) - new Date(a.meetingDate));

    res.json({
      message: 'Meetings retrieved successfully',
      upcomingMeetings,
      completedMeetings
    });

  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({
      message: 'Failed to get meetings',
      error: error.message
    });
  }
};

// Update meeting
const updateMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, meetingDate, duration, meetingLink, videoLink, audience } = req.body;
    const userId = req.user._id;

    // Find meeting
    const meeting = await Meeting.findOne({
      _id: id,
      createdBy: userId
    });

    if (!meeting) {
      return res.status(404).json({
        message: 'Meeting not found'
      });
    }

    // Check if meeting is completed
    const now = new Date();
    const meetingEnd = new Date(meeting.meetingDate.getTime() + (meeting.duration * 60000));
    
    if (now > meetingEnd) {
      // If meeting is completed, allow updating videoLink, title, and description
      if (videoLink !== undefined) {
        meeting.videoLink = videoLink.trim();
      }
      if (title) {
        meeting.title = title.trim();
      }
      if (description !== undefined) {
        meeting.description = description.trim();
      }
    } else {
      // For upcoming meetings, allow all fields except status
      if (title) meeting.title = title.trim();
      if (description !== undefined) meeting.description = description.trim();
      if (meetingDate) {
        const meetingDateTime = new Date(meetingDate);
        if (meetingDateTime <= now) {
          return res.status(400).json({
            message: 'Meeting date must be in the future'
          });
        }
        meeting.meetingDate = meetingDateTime;
      }
      if (duration) {
        if (parseInt(duration) <= 0) {
          return res.status(400).json({
            message: 'Duration must be greater than 0'
          });
        }
        meeting.duration = parseInt(duration);
      }
      if (meetingLink) meeting.meetingLink = meetingLink.trim();
      if (audience === 'pre' || audience === 'mains') meeting.audience = audience;
    }

    await meeting.save();

    res.json({
      message: 'Meeting updated successfully',
      meeting
    });

  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({
      message: 'Failed to update meeting',
      error: error.message
    });
  }
};

// Delete meeting (works for both upcoming and history)
const deleteMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const meeting = await Meeting.findOneAndDelete({
      _id: id,
      createdBy: userId
    });

    if (!meeting) {
      return res.status(404).json({
        message: 'Meeting not found'
      });
    }

    res.json({
      message: 'Meeting deleted successfully',
      meeting
    });

  } catch (error) {
    console.error('Delete meeting error:', error);
    res.status(500).json({
      message: 'Failed to delete meeting',
      error: error.message
    });
  }
};

// Get meetings for students (all meetings created by any admin)
const getStudentMeetings = async (req, res) => {
  try {
    const now = new Date();

    // Get all meetings (students can see all admin-created meetings)
    const audience = req.query.audience === 'mains' ? 'mains' : req.query.audience === 'pre' ? 'pre' : null;
    const filter = { status: { $ne: 'cancelled' } };
    if (audience === 'mains') filter.audience = 'mains';
    if (audience === 'pre') filter.$or = [{ audience: 'pre' }, { audience: { $exists: false } }];
    const meetings = await Meeting.find(filter)
      .populate('createdBy', 'name email')
      .sort({ meetingDate: 1 });

    // Separate into upcoming and completed based on current time
    const upcomingMeetings = [];
    const completedMeetings = [];

    meetings.forEach(meeting => {
      const meetingEnd = new Date(meeting.meetingDate.getTime() + (meeting.duration * 60000));
      
      if (now <= meetingEnd) {
        upcomingMeetings.push(meeting);
      } else {
        completedMeetings.push(meeting);
      }
    });

    // Sort upcoming by date (earliest first)
    upcomingMeetings.sort((a, b) => new Date(a.meetingDate) - new Date(b.meetingDate));
    
    // Sort completed by date (most recent first)
    completedMeetings.sort((a, b) => new Date(b.meetingDate) - new Date(a.meetingDate));

    res.json({
      message: 'Meetings retrieved successfully',
      upcomingMeetings,
      completedMeetings
    });

  } catch (error) {
    console.error('Get student meetings error:', error);
    res.status(500).json({
      message: 'Failed to get meetings',
      error: error.message
    });
  }
};

module.exports = {
  createMeeting,
  getAdminMeetings,
  updateMeeting,
  deleteMeeting,
  getStudentMeetings
};