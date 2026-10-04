const { publishSystemNotification } = require('../services/firebaseNotificationService');
const TestService = require('../services/testService');
const ResultService = require('../services/resultService');
const AnalyticsService = require('../services/analyticsService');
const User = require('../models/User');
const { handleError } = require('../middleware/errorHandler');
const messages = require('../utils/messages');

const createTest = async (req, res) => {
  try {
    // Validate endTime is after startTime
    const { startTime, endTime } = req.body;
    if (new Date(endTime) <= new Date(startTime)) {
      return res.status(400).json({ 
        message: 'End time must be after start time' 
      });
    }

    const processedData = {
      ...req.body,
      questionUids: req.body.questionUids || [],
      createdBy: req.user._id
    };

    const test = await TestService.createTest(processedData);
    if (test.isActive) {
      const series = !!test.seriesId;
      publishSystemNotification({
        title: `New test: ${test.title}`.slice(0,120),
        titleHindi: `नया टेस्ट: ${test.title}`.slice(0,120),
        body: series ? 'A new test series exam is available.' : 'A new Prelims test is available.',
        bodyHindi: series ? 'टेस्ट सीरीज़ का नया एग्जाम उपलब्ध है।' : 'प्रारंभिक परीक्षा का नया टेस्ट उपलब्ध है।',
        type: 'test_series',
        audience: test.seriesKind === 'mains' ? 'mains' : 'pre',
        link: test.seriesKind === 'mains' ? '/mains-test-series' : series ? '/prelims-test-series' : '/prelims-tests',
        createdBy: req.user._id
      }).catch(error => console.error('Test notification failed:', error.message));
    }
    
    // Populate questions for response
    const testWithQuestions = await TestService.getTestWithFullQuestions(test._id);
    
    res.status(201).json({
      message: messages.en.testCreated,
      test: testWithQuestions
    });
  } catch (error) {
    console.error('Test creation error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const getTests = async (req, res) => {
  try {
    const tests = await TestService.getTestsByCreator(req.user._id);
    res.json(tests);
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const updateTest = async (req, res) => {
  try {
    const { startTime, endTime } = req.body;
    
    // Validate endTime is after startTime if both are provided
    if (startTime && endTime) {
      if (new Date(endTime) <= new Date(startTime)) {
        return res.status(400).json({ 
          message: 'End time must be after start time' 
        });
      }
    }
    
    // If only endTime is provided, check against existing startTime
    if (endTime && !startTime) {
      const existingTest = await TestService.getTestById(req.params.id);
      if (!existingTest) {
        return res.status(404).json({ message: messages.en.testNotFound });
      }
      if (new Date(endTime) <= existingTest.startTime) {
        return res.status(400).json({ 
          message: 'End time must be after start time' 
        });
      }
    }
    
    // If only startTime is provided, check against existing endTime
    if (startTime && !endTime) {
      const existingTest = await TestService.getTestById(req.params.id);
      if (!existingTest) {
        return res.status(404).json({ message: messages.en.testNotFound });
      }
      if (new Date(startTime) >= existingTest.endTime) {
        return res.status(400).json({ 
          message: 'Start time must be before end time' 
        });
      }
    }

    const test = await TestService.updateTest(req.params.id, req.body);
    if (!test) {
      return res.status(404).json({ message: messages.en.testNotFound });
    }

    // Populate questions for response
    const testWithQuestions = await TestService.getTestWithFullQuestions(test._id);

    res.json({
      message: messages.en.testUpdated,
      test: testWithQuestions
    });
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const deleteTest = async (req, res) => {
  try {
    const test = await TestService.deleteTest(req.params.id);
    if (!test) {
      return res.status(404).json({ message: messages.en.testNotFound });
    }

    res.json({ message: messages.en.testDeleted });
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const getTestResults = async (req, res) => {
  try {
    const results = await ResultService.getTestResults(req.params.testId);
    const resultsWithRanking = await ResultService.calculateRankings(results);

    res.json(resultsWithRanking);
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const getTestAnalytics = async (req, res) => {
  try {
    const analytics = await AnalyticsService.getTestAnalytics(req.params.testId);
    res.json(analytics);
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const getAllResults = async (req, res) => {
  try {
    const results = await Result.find()
      .populate('test', 'title startTime duration')
      .populate('student', 'fullName email')
      .sort({ submittedAt: -1 });

    const resultsWithPercentage = results.map(result => ({
      ...result.toObject(),
      percentage: result.totalMarks > 0 ? ((result.score / result.totalMarks) * 100).toFixed(2) : 0
    }));

    res.json(resultsWithPercentage);
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const getPlatformStatistics = async (req, res) => {
  try {
    const statistics = await AnalyticsService.getPlatformStatistics();
    res.json(statistics);
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const getDashboardCharts = async (req, res) => {
  try {
    const charts = await AnalyticsService.getDashboardCharts();
    res.json(charts);
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const getStudents = async (req, res) => {
  try {
    const students = await User.find({ role: 'student' })
      .select('isActive fullName email phone type planActivatedAt planExpiryAt createdAt updatedAt')
      .sort({ createdAt: -1 });
    
    res.json(students);
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const updateUserType = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { type },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User type updated successfully',
      user: user.toJSON()
    });
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const getUsersByType = async (req, res) => {
  try {
    const { type } = req.query;
    
    const filter = { role: 'student' };
    if (type) {
      filter.type = type;
    }

    const users = await User.find(filter)
      .select('fullName email phone type createdAt')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the user
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    // Delete the user permanently
    await User.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'User deleted successfully',
      deletedUser: {
        id: user._id,
        email: user.email,
        fullName: user.fullName
      }
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: messages.en.serverError,
      error: error.message
    });
  }
};

const reopenExam = async (req, res) => {
  try {
    const Test = require('../models/Test');
    const { grantReopen } = require('../utils/examAccess');
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ success: false, message: 'Exam not found.' });
    const { record, student } = await grantReopen({ examId: test._id, userId: req.body.userId, email: req.body.email, until: req.body.until, createdBy: req.user._id });
    res.json({ success: true, data: record, student });
  } catch (error) {
    handleError(res, error, error.message);
  }
};

module.exports = {
  createTest,
  getTests,
  updateTest,
  deleteTest,
  getTestResults,
  getTestAnalytics,
  getAllResults,
  getPlatformStatistics,
  getDashboardCharts,
  getStudents,
  updateUserType,
  getUsersByType,
  deleteUser,
  reopenExam
};
