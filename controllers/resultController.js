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
const getStudentResults = async (req, res) => {
  try {
    const results = await ResultService.getStudentResults(req.user._id);
    
    // Group results by test to calculate ranking per test
    const resultsByTest = {};
    
    // Group results by test ID
    results.forEach(result => {
      const testId = result.test._id.toString();
      if (!resultsByTest[testId]) {
        resultsByTest[testId] = {
          test: result.test,
          results: []
        };
      }
      resultsByTest[testId].results.push(result);
    });
    
    // Calculate ranking for each test separately
    const resultsWithRanking = [];
    
    for (const testId in resultsByTest) {
      const { test, results: testResults } = resultsByTest[testId];
      
      // Get ALL results for this test (not just the student's)
      const allTestResults = await ResultService.getTestResults(testId);
      
      // Calculate ranking for each result in this test
      const rankedTestResults = allTestResults.map((testResult, index) => {
        const studentResult = testResults.find(r => 
          r.student._id.toString() === testResult.student._id.toString()
        );
        
        if (studentResult) {
          return {
            ...studentResult.toObject(),
            rank: index + 1,
            totalStudents: allTestResults.length
          };
        }
        return null;
      }).filter(Boolean); // Remove nulls
      
      resultsWithRanking.push(...rankedTestResults);
    }
    
    // Sort by submission date (most recent first)
    resultsWithRanking.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    res.json(resultsWithRanking);
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
    }).select('_id fullName email role');
    
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
    
    // Group results by test to calculate ranking per test
    const resultsByTest = {};
    
    // Group results by test ID
    results.forEach(result => {
      const testId = result.test._id.toString();
      if (!resultsByTest[testId]) {
        resultsByTest[testId] = {
          test: result.test,
          results: []
        };
      }
      resultsByTest[testId].results.push(result);
    });
    
    // Calculate ranking for each test separately
    const resultsWithRanking = [];
    
    for (const testId in resultsByTest) {
      const { test, results: testResults } = resultsByTest[testId];
      
      // Get ALL results for this test (not just the student's)
      const allTestResults = await Result.find({ test: testId })
        .populate('student', 'fullName email')
        .sort({ score: -1, submittedAt: 1 });
      
      // Calculate ranking for each result in this test
      const rankedTestResults = allTestResults.map((testResult, index) => {
        const studentResult = testResults.find(r => 
          r.student._id.toString() === testResult.student._id.toString()
        );
        
        if (studentResult) {
          // Return result with just student ID (not full object) to match first API
          return {
            ...studentResult.toObject(),
            rank: index + 1,
            totalStudents: allTestResults.length,
            student: studentId // Just the ID string, not the full object
          };
        }
        return null;
      }).filter(Boolean); // Remove nulls
      
      resultsWithRanking.push(...rankedTestResults);
    }
    
    // Sort by submission date (most recent first)
    resultsWithRanking.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    // Return direct array like first API (no wrapping success/data)
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