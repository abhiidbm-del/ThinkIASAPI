const User = require('../models/User'); // Add this import
const Result = require('../models/Result'); // Make sure this is imported
const ResultService = require('../services/resultService');
const { calculateRanking } = require('../utils/helpers');
const { handleError } = require('../middleware/errorHandler');
const messages = require('../utils/messages');

const getStudentTestResult = async (req, res) => {
  try {
    const result = await ResultService.getStudentTestResult(req.params.testId, req.user._id);
    if (!result) {
      return res.status(404).json({ message: messages.en.resultNotFound });
    }

    const testResults = await ResultService.getTestResults(req.params.testId);
    const { rank, totalStudents } = calculateRanking(testResults, req.user._id);

    // Check if questions are populated
    if (!result.test.questions || !Array.isArray(result.test.questions)) {
      console.error('Questions not populated in result:', result.test);
      return res.status(500).json({ 
        message: 'Unable to load test questions',
        error: 'Questions data not available' 
      });
    }

    // Create question map for proper matching
    const questionMap = {};
    result.test.questions.forEach(question => {
      questionMap[question.uid] = question;
    });

    const detailedResult = {
      ...result.toObject(),
      rank,
      totalStudents,
      percentage: ((result.score / result.totalMarks) * 100).toFixed(2),
      test: {
        ...result.test.toObject(),
        questions: result.answers.map(answer => {
          const question = questionMap[answer.questionUid];
          return {
            question: question ? question.question : { english: 'Question not found', hindi: '' },
            description: question ? (question.description || { english: '', hindi: '' }) : { english: '', hindi: '' },
            options: question ? question.options : [],
            tags: question && question.tags ? question.tags.map(tag => ({
              _id: tag._id,
              // category: tag.category,
              // subCategory: tag.subCategory,
              // topic: tag.topic,
              tag: tag.tag
            })) : [], // Include full tag details
            studentAnswer: answer.selectedOption,
            correctAnswer: answer.correctAnswer,
            isCorrect: answer.isCorrect
          };
        })
      }
    };

    res.json(detailedResult);
  } catch (error) {
    console.error('Get student test result error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

// Other result controller functions...
const studentRefId = (doc) => {
  const student = doc?.student;
  if (!student) return '';
  return String(student._id || student);
};

const withRanks = async (results) => {
  const ranked = [];
  for (const result of results) {
    if (!result?.test?._id) continue;
    const testId = result.test._id.toString();
    const allTestResults = (await ResultService.getTestResults(testId)).filter((item) => item.student);
    const index = allTestResults.findIndex((item) => studentRefId(item) === studentRefId(result));
    const payload = typeof result.toObject === 'function' ? result.toObject() : result;
    ranked.push({
      ...payload,
      rank: index >= 0 ? index + 1 : allTestResults.length,
      totalStudents: allTestResults.length
    });
  }
  ranked.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  return ranked;
};

const getStudentResults = async (req, res) => {
  try {
    const results = await ResultService.getStudentResults(req.user._id);
    res.json(await withRanks(results));
  } catch (error) {
    console.error('Get student results error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const getResultById = async (req, res) => {
  try {
    const result = await ResultService.getResultById(req.params.id);
    if (!result) {
      return res.status(404).json({ message: messages.en.resultNotFound });
    }

    if (req.user.role === 'student' && result.student._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: messages.en.accessDenied });
    }

    res.json(result);
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const getStudentResultsByAdmin = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Validate studentId
    if (!studentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Student ID is required' 
      });
    }

    // Verify student exists and is actually a student
    const student = await User.findOne({ 
      _id: studentId, 
      role: 'student' 
    }).select('_id fullName email role profileImage');
    
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found or user is not a student' 
      });
    }

    // Get all results for this student
    const results = await Result.find({ student: studentId })
      .populate('test', 'title startTime duration marksPerQuestion negativeMarks category')
      .sort({ submittedAt: -1 });
    
    // If no results found
    if (results.length === 0) {
      return res.json([]); // Return empty array like first API
    }
    
    const resultsWithRanking = (await withRanks(results)).map((item) => ({
      ...item,
      student: studentId
    }));
    res.json(resultsWithRanking);
    
  } catch (error) {
    console.error('Get student results by admin error:', error);
    
    // Handle specific errors
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID format'
      });
    }
    
    handleError(res, error, messages.en.serverError);
  }
};

const getStudentTestResultByAdmin = async (req, res) => {
  try {
    const { testId, studentId } = req.params;
    
    // Validate required parameters
    if (!testId || !studentId) {
      return res.status(400).json({ 
        message: 'Missing required parameters: testId and studentId are required' 
      });
    }

    // Check if user is admin (you should have middleware for this, but adding check here too)
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: messages.en.unauthorizedAccess,
        error: 'Admin access required' 
      });
    }

    // Get result with testId and studentId
    const result = await ResultService.getStudentTestResult(testId, studentId);
    if (!result) {
      return res.status(404).json({ 
        message: messages.en.resultNotFound,
        details: `No result found for testId: ${testId} and studentId: ${studentId}`
      });
    }

    const testResults = await ResultService.getTestResults(testId);
    const { rank, totalStudents } = calculateRanking(testResults, studentId);

    // Check if questions are populated
    if (!result.test.questions || !Array.isArray(result.test.questions)) {
      console.error('Questions not populated in result:', result.test);
      return res.status(500).json({ 
        message: 'Unable to load test questions',
        error: 'Questions data not available' 
      });
    }

    // Create question map for proper matching
    const questionMap = {};
    result.test.questions.forEach(question => {
      questionMap[question.uid] = question;
    });

    const detailedResult = {
      ...result.toObject(),
      rank,
      totalStudents,
      percentage: ((result.score / result.totalMarks) * 100).toFixed(2),
      test: {
        ...result.test.toObject(),
        questions: result.answers.map(answer => {
          const question = questionMap[answer.questionUid];
          return {
            question: question ? question.question : { english: 'Question not found', hindi: '' },
            description: question ? (question.description || { english: '', hindi: '' }) : { english: '', hindi: '' },
            options: question ? question.options : [],
            tags: question && question.tags ? question.tags.map(tag => ({
              _id: tag._id,
              // category: tag.category,
              // subCategory: tag.subCategory,
              // topic: tag.topic,
              tag: tag.tag
            })) : [], // Include full tag details
            studentAnswer: answer.selectedOption,
            correctAnswer: answer.correctAnswer,
            isCorrect: answer.isCorrect
          };
        })
      }
    };

    res.json(detailedResult);
  } catch (error) {
    console.error('Get student test result by admin error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

module.exports = {
  getStudentResults,
  getStudentTestResult,
  getResultById,
  getStudentResultsByAdmin,
  getStudentTestResultByAdmin
};