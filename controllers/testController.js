const TestService = require('../services/testService');
const ResultService = require('../services/resultService');
const { formatTestForStudent } = require('../utils/helpers');
const { handleError } = require('../middleware/errorHandler');
const messages = require('../utils/messages');
const { examWindow, activeReopen } = require('../utils/examAccess');

const getTests = async (req, res) => {
  try {
    let tests;
    
    if (req.user.role === 'admin') {
      tests = await TestService.getAllActiveTests();
    } else {
      tests = await TestService.getAvailableTestsForStudent(req.user._id);
      
      // Check submission status for each test
      const testsWithSubmissionStatus = await Promise.all(
        tests.map(async (test) => {
          const formattedTest = formatTestForStudent(test);
          
          // Check if student has already submitted this test
          const existingResult = await ResultService.getStudentTestResult(test._id, req.user._id);
          const isSubmitted = !!existingResult;
          const reopen = await activeReopen(test._id, req.user._id);
          const window = examWindow(test, reopen);
          
          return {
            ...formattedTest,
            submitted: isSubmitted,
            startsInMs: window.startsInMs,
            reopened: window.reopened,
            reopenUntil: window.reopened ? window.endTime : undefined,
            canTake: window.canTake,
            waiting: window.waiting
          };
        })
      );
      
      tests = testsWithSubmissionStatus;
    }

    res.json(tests);
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const getTestById = async (req, res) => {
  try {
    if (req.user.role === 'student') {
      const test = await TestService.getTestById(req.params.id, { populateQuestions: true });
      if (!test) return res.status(404).json({ message: messages.en.testNotFound });
      const existingResult = await ResultService.getStudentTestResult(req.params.id, req.user._id);
      const reopen = await activeReopen(req.params.id, req.user._id);
      const window = examWindow(test, reopen);
      if (existingResult) return res.status(400).json({ message: messages.en.testSubmitted, submitted: true });
      if (window.waiting) {
        return res.json({ waiting: true, _id: test._id, title: test.title, description: test.description, startTime: test.startTime, endTime: test.endTime, duration: test.duration, startsInMs: window.startsInMs });
      }
      if (!window.canTake) return res.status(400).json({ message: messages.en.testEnded, ended: true, endTime: window.endTime });
      return res.json({
        _id: test._id,
        title: test.title,
        description: test.description,
        startTime: test.startTime,
        endTime: window.endTime,
        duration: test.duration,
        marksPerQuestion: test.marksPerQuestion,
        negativeMarks: test.negativeMarks,
        totalMarks: test.totalMarks,
        submitted: false,
        reopened: window.reopened,
        questions: (test.questions || []).map(q => ({ uid: q.uid, question: q.question, options: q.options }))
      });
    }
    const test = await TestService.getTestWithValidation(req.params.id, req.user._id, req.user.role);
    res.json(test);
  } catch (error) {
    handleError(res, error, error.message);
  }
};

const submitTest = async (req, res) => {
  try {
    const { answers, timeTaken } = req.body;
    
    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: 'Invalid answers format' });
    }

    const { result, score, totalMarks, percentage, summary } = await ResultService.submitTest(
      req.params.id,
      req.user._id,
      answers,
      timeTaken
    );

    res.json({
      message: messages.en.submissionSuccess,
      score,
      totalMarks,
      percentage: percentage.toFixed(2),
      resultId: result._id,
      summary: summary || {
        totalQuestions: result.summary?.totalQuestions,
        correctAnswers: result.summary?.correctAnswers,
        wrongAnswers: result.summary?.wrongAnswers,
        unattempted: result.summary?.unattempted
      }
    });
  } catch (error) {
    handleError(res, error, error.message);
  }
};

const checkTestAvailability = async (req, res) => {
  try {
    const test = await TestService.getTestById(req.params.id);
    if (!test) {
      return res.status(404).json({ message: messages.en.testNotFound });
    }

    const now = new Date();
    const startTime = new Date(test.startTime);
    const endTime = new Date(test.endTime);
    const reopen = await activeReopen(req.params.id, req.user._id);
    const window = examWindow(test, reopen);

    if (req.user.role !== 'student') {
      return res.json({ canTake: true, reason: 'Admin user' });
    }

    const existingResult = await ResultService.getStudentTestResult(req.params.id, req.user._id);
    if (existingResult) {
      return res.json({
        canTake: false,
        reason: messages.en.testSubmitted,
        submittedAt: existingResult.submittedAt
      });
    }

    if (window.waiting) {
      return res.json({
        canTake: false,
        waiting: true,
        reason: messages.en.testNotStarted,
        startTime: test.startTime,
        startsInMs: window.startsInMs
      });
    }

    if (!window.canTake) {
      return res.json({
        canTake: false,
        reason: messages.en.testEnded,
        endTime: window.endTime
      });
    }

    res.json({ 
      canTake: true, 
      reason: 'Test is available',
      timeLeft: Math.max(0, endTime - now)
    });
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

module.exports = {
  getTests,
  getTestById,
  submitTest,
  checkTestAvailability
};