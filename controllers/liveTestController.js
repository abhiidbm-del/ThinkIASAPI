// controllers/liveTestController.js
const LiveTest = require('../models/LiveTest');
const LiveTestSubmission = require('../models/LiveTestSubmission');
const { getPublicR2Url } = require('../config/r2');
const { publishSystemNotification } = require('../services/firebaseNotificationService');

// ============================================
// ADMIN CONTROLLERS
// ============================================

// Create a new live test
exports.createLiveTest = async (req, res) => {
  try {
    const {
      title,
      titleHi,
      type,
      subject,
      description,
      descriptionHi,
      questionPaperPDF,
      questionPaperPDFHi,
      questions,
      meetLink,
      instructions,
      startDateTime,
      endDateTime,
      duration,
      order,
      isActive
    } = req.body;

    // Validate required fields
    if (!title || !type || !subject || !meetLink || !startDateTime || !endDateTime) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const liveTest = new LiveTest({
      title,
      titleHi,
      type,
      subject,
      description,
      descriptionHi,
      questionPaperPDF,
      questionPaperPDFHi,
      questions: questions || [],
      meetLink,
      instructions,
      startDateTime,
      endDateTime,
      duration: duration || calculateDuration(startDateTime, endDateTime),
      order: order || 0,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user?._id
    });

    await liveTest.save();
    if (liveTest.isActive) publishSystemNotification({
      title: `New test: ${liveTest.title}`,
      body: liveTest.description || 'A new test series is available.',
      titleHindi: `नया टेस्ट: ${liveTest.titleHi || liveTest.title}`, bodyHindi: liveTest.descriptionHi || 'नई टेस्ट सीरीज़ उपलब्ध है।',
      type: 'test_series', audience: 'mains',
      link: '/live-test', createdBy: req.user._id
    }).catch(error => console.error('Test notification failed:', error.message));

    res.status(201).json({
      success: true,
      message: 'Live test created successfully',
      data: liveTest
    });
  } catch (error) {
    console.error('Error creating live test:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating live test',
      error: error.message
    });
  }
};

// Get all live tests (admin)
exports.getAllLiveTests = async (req, res) => {
  try {
    const { search, status, fromDate, toDate, page = 1, limit = 50 } = req.query;
    
    let filter = {};
    
    // Search filter
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { titleHi: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { descriptionHi: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Status filter
    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    }
    
    // Date range filter
    if (fromDate || toDate) {
      filter.startDateTime = {};
      if (fromDate) filter.startDateTime.$gte = new Date(fromDate);
      if (toDate) filter.startDateTime.$lte = new Date(toDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [tests, total] = await Promise.all([
      LiveTest.find(filter)
        .sort({ startDateTime: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      LiveTest.countDocuments(filter)
    ]);

    const counts = await LiveTestSubmission.aggregate([
      { $match: { testId: { $in: tests.map(test => test._id) } } },
      { $group: { _id: '$testId', count: { $sum: 1 } } }
    ]);
    const byTest = new Map(counts.map(item => [String(item._id), item.count]));

    res.status(200).json({
      success: true,
      data: tests.map(test => ({ ...test.toObject(), submissionCount: byTest.get(String(test._id)) || 0 })),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching live tests:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching live tests',
      error: error.message
    });
  }
};

// Get single live test
exports.getLiveTestById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const test = await LiveTest.findById(id);
    
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Live test not found'
      });
    }

    res.status(200).json({
      success: true,
      data: test
    });
  } catch (error) {
    console.error('Error fetching live test:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching live test',
      error: error.message
    });
  }
};

// Update live test
exports.updateLiveTest = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Calculate duration if start and end times are provided
    if (updateData.startDateTime && updateData.endDateTime) {
      updateData.duration = calculateDuration(updateData.startDateTime, updateData.endDateTime);
    }

    const test = await LiveTest.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Live test not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Live test updated successfully',
      data: test
    });
  } catch (error) {
    console.error('Error updating live test:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating live test',
      error: error.message
    });
  }
};

// Toggle live test status
exports.toggleLiveTestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const test = await LiveTest.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    );

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Live test not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Live test ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: test
    });
  } catch (error) {
    console.error('Error toggling live test status:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling live test status',
      error: error.message
    });
  }
};

// Delete live test
exports.deleteLiveTest = async (req, res) => {
  try {
    const { id } = req.params;

    const test = await LiveTest.findByIdAndDelete(id);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Live test not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Live test deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting live test:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting live test',
      error: error.message
    });
  }
};

// ============================================
// STUDENT CONTROLLERS
// ============================================

exports.reopenLiveTest = async (req, res) => {
  try {
    const { grantReopen } = require('../utils/examAccess');
    const test = await LiveTest.findById(req.params.id);
    if (!test) return res.status(404).json({ success: false, message: 'Live test not found' });
    const { record, student } = await grantReopen({ examId: test._id, userId: req.body.userId, email: req.body.email, until: req.body.until, createdBy: req.user._id });
    res.json({ success: true, data: record, student });
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
};

exports.submitLiveTestAnswer = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a PDF answer sheet' });
    const test = await LiveTest.findOne({ _id: req.params.id, isActive: true });
    if (!test) return res.status(404).json({ success: false, message: 'Live test not found' });
    const now = new Date();
    const { activeReopen, examWindow } = require('../utils/examAccess');
    const reopen = await activeReopen(test._id, req.user._id);
    const window = examWindow(test, reopen);
    if (window.waiting) return res.status(400).json({ success: false, message: 'Answer submission has not started yet' });
    if (!window.canTake) return res.status(400).json({ success: false, message: 'This exam window has ended.' });
    const isLate = now > new Date(test.endDateTime) && !window.reopened;
    const data = await LiveTestSubmission.findOneAndUpdate(
      { testId: test._id, studentId: req.user._id },
      { answerPDF: getPublicR2Url(req.file), answerPDFKey: req.file.key, originalName: req.file.originalname || 'answer-sheet.pdf', language: req.body.language === 'hi' ? 'hi' : 'en', submittedAt: now, isLate, status: 'submitted' },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ success: true, message: 'Answer sheet submitted successfully', data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getMyParticipations = async (req, res) => {
  try {
    const data = await LiveTestSubmission.find({ studentId: req.user._id }).populate('testId').sort({ submittedAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSubmissions = async (req, res) => {
  try {
    const filter = req.params.id ? { testId: req.params.id } : {};
    const data = await LiveTestSubmission.find(filter).populate('studentId', 'fullName email').populate('testId', 'title titleHi').sort({ submittedAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

// Get available tests for students
// controllers/liveTestController.js

// Get available tests for students
exports.getAvailableTests = async (req, res) => {
  try {
    const now = new Date();
    
    // Get all active tests
    const tests = await LiveTest.find({
      isActive: true
    }).sort({ startDateTime: 1 });

    const submittedIds = new Set((await LiveTestSubmission.find({ studentId: req.user._id }).select('testId').lean()).map(item => item.testId.toString()));
    const ExamReopen = require('../models/ExamReopen');
    const { examWindow } = require('../utils/examAccess');
    const reopens = await ExamReopen.find({ user: req.user._id, until: { $gte: now } }).lean();
    const reopenByTest = new Map(reopens.map(item => [String(item.test), item]));
    const testsWithStatus = tests.map(test => {
      const testObj = test.toObject();
      if (submittedIds.has(test._id.toString())) {
        testObj.status = 'submitted';
        testObj.isAvailable = false;
        return testObj;
      }
      const window = examWindow(test, reopenByTest.get(String(test._id)));
      testObj.startsInMs = window.startsInMs;
      testObj.reopened = window.reopened;
      if (window.reopened) testObj.reopenUntil = window.endTime;
      if (window.canTake) {
        testObj.status = 'available';
        testObj.isAvailable = true;
        testObj.isUpcoming = false;
        testObj.isExpired = false;
      } else if (window.waiting) {
        testObj.status = 'upcoming';
        testObj.isAvailable = false;
        testObj.isUpcoming = true;
        testObj.isExpired = false;
      } else {
        testObj.status = 'expired';
        testObj.isAvailable = false;
        testObj.isUpcoming = false;
        testObj.isExpired = true;
      }
      return testObj;
    });

    res.status(200).json({
      success: true,
      data: testsWithStatus
    });
  } catch (error) {
    console.error('Error fetching available tests:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available tests',
      error: error.message
    });
  }
};

// Get only currently available tests (active and within date range)
exports.getCurrentlyAvailableTests = async (req, res) => {
  try {
    const now = new Date();
    
    const ExamReopen = require('../models/ExamReopen');
    const reopens = await ExamReopen.find({ user: req.user._id, until: { $gte: now } }).lean();
    const tests = await LiveTest.find({
      isActive: true,
      $or: [
        { startDateTime: { $lte: now }, endDateTime: { $gte: now } },
        { _id: { $in: reopens.map(item => item.test) } }
      ]
    }).sort({ startDateTime: 1 });

    const reopenById = new Map(reopens.map(item => [String(item.test), item]));
    const testsWithStatus = tests.map(test => {
      const testObj = test.toObject();
      const reopen = reopenById.get(String(test._id));
      testObj.status = 'available';
      testObj.isAvailable = true;
      testObj.isUpcoming = false;
      testObj.isExpired = false;
      if (reopen) {
        testObj.reopened = true;
        testObj.reopenUntil = reopen.until;
      }
      return testObj;
    });

    res.status(200).json({
      success: true,
      data: testsWithStatus
    });
  } catch (error) {
    console.error('Error fetching currently available tests:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching currently available tests',
      error: error.message
    });
  }
};

// Get upcoming tests for students
exports.getUpcomingTests = async (req, res) => {
  try {
    const now = new Date();
    
    const tests = await LiveTest.find({
      isActive: true,
      startDateTime: { $gt: now }
    }).sort({ startDateTime: 1 });

    res.status(200).json({
      success: true,
      data: tests
    });
  } catch (error) {
    console.error('Error fetching upcoming tests:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching upcoming tests',
      error: error.message
    });
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateDuration(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
}
