const DemoTestService = require('../services/demoTestService');
const DemoResultService = require('../services/demoResultService');
const { handleError } = require('../middleware/errorHandler');
const messages = require('../utils/messages');

// Helper function to remove correct answers
const removeCorrectAnswers = (test) => {
  if (!test.questions || !Array.isArray(test.questions)) {
    return test;
  }
  
  return {
    ...test.toObject(),
    questions: test.questions.map(q => ({
      uid: q.uid,
      question: q.question,
      description: q.description || { english: '', hindi: '' },
      options: q.options
    }))
  };
};

// Admin APIs
const createDemoTest = async (req, res) => {
  try {
    const processedData = {
      ...req.body,
      questionUids: req.body.questionUids || [],
      createdBy: req.user._id
    };

    const test = await DemoTestService.createDemoTest(processedData);
    
    res.status(201).json({
      message: 'Demo test created successfully',
      test: test
    });
  } catch (error) {
    console.error('Demo test creation error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const getDemoTests = async (req, res) => {
  try {
    const tests = await DemoTestService.getDemoTestsByCreator(req.user._id);
    res.json(tests);
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const updateDemoTest = async (req, res) => {
  try {
    const test = await DemoTestService.updateDemoTest(req.params.id, req.body);
    if (!test) {
      return res.status(404).json({ message: 'Demo test not found' });
    }

    res.json({
      message: 'Demo test updated successfully',
      test: test
    });
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const deleteDemoTest = async (req, res) => {
  try {
    const test = await DemoTestService.deleteDemoTest(req.params.id);
    if (!test) {
      return res.status(404).json({ message: 'Demo test not found' });
    }

    res.json({ message: 'Demo test deleted successfully' });
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const toggleDemoTestStatus = async (req, res) => {
  try {
    const test = await DemoTestService.toggleDemoTestStatus(req.params.id);
    
    res.json({
      message: `Demo test ${test.isActive ? 'activated' : 'deactivated'} successfully`,
      test: {
        _id: test._id,
        title: test.title,
        isActive: test.isActive
      }
    });
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

// Public/Student APIs
const getAvailableDemoTests = async (req, res) => {
  try {
    let tests;
    
    if (req.user.role === 'admin') {
      tests = await DemoTestService.getAllActiveDemoTests();
      return res.json(tests);
    } 
    
    // For students
    tests = await DemoTestService.getAvailableDemoTestsForStudent();
    
    // Check submission status for each test
    const testsWithSubmissionStatus = await Promise.all(
      tests.map(async (test) => {
        // Check if student has already taken this demo test
        const existingResult = await DemoResultService.getStudentDemoTestResult(test._id, req.user._id);
        const isSubmitted = !!existingResult;
        
        const testWithoutAnswers = removeCorrectAnswers(test);
        
        return {
          ...testWithoutAnswers,
          submitted: isSubmitted
        };
      })
    );
    
    res.json(testsWithSubmissionStatus);
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const getDemoTestById = async (req, res) => {
  try {
    const test = await DemoTestService.getDemoTestById(req.params.id, { populateQuestions: true });
    
    if (!test) {
      return res.status(404).json({ message: 'Demo test not found' });
    }
    
    // Check if test is active (for students)
    if (req.user.role === 'student' && !test.isActive) {
      return res.status(400).json({ message: 'This demo test is not active' });
    }
    
    if (req.user.role === 'student') {
      // Remove correct answers for students
      const testWithoutAnswers = removeCorrectAnswers(test);
      
      return res.json({
        ...testWithoutAnswers,
        submitted: false
      });
    }

    // Admin gets full test with correct answers
    res.json(test);
  } catch (error) {
    handleError(res, error, error.message);
  }
};

const submitDemoTest = async (req, res) => {
  try {
    const { answers, timeTaken } = req.body;
    
    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: 'Invalid answers format' });
    }

    const { result, score, totalMarks, percentage, summary } = await DemoResultService.submitDemoTest(
      req.params.id,
      req.user._id,
      answers,
      timeTaken
    );

    res.json({
      message: 'Demo test submitted successfully',
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

const checkDemoTestAvailability = async (req, res) => {
  try {
    const test = await DemoTestService.getDemoTestById(req.params.id);
    
    if (!test) {
      return res.status(404).json({ message: 'Demo test not found' });
    }
    
    // Check if test is active
    if (!test.isActive) {
      return res.json({ 
        canTake: false, 
        reason: 'Demo test is not active'
      });
    }

    // For demo tests, always allow taking the test regardless of previous attempts
    res.json({ 
      canTake: true, 
      reason: 'Demo test is available'
    });
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const getStudentDemoTestResult = async (req, res) => {
  try {
    // Use the correct parameter name (id instead of testId)
    const testId = req.params.id; // or req.params.testId based on your route
    
    const result = await DemoResultService.getStudentDemoTestResult(testId, req.user._id);
    
    if (!result) {
      return res.status(404).json({ message: 'Demo test result not found' });
    }

    // Get all results for this test to calculate rank
    const allResults = await DemoResultService.getTestResults(testId);
    
    // Calculate rank
    const sortedResults = allResults.sort((a, b) => b.score - a.score);
    const rankIndex = sortedResults.findIndex(r => r._id.toString() === result._id.toString());
    const rank = rankIndex >= 0 ? rankIndex + 1 : sortedResults.length + 1;

    // Check if questions are populated
    if (!result.test.questions || !Array.isArray(result.test.questions) || result.test.questions.length === 0) {
      console.error('Questions not populated in demo result');
      return res.status(500).json({ 
        message: 'Unable to load test questions',
        error: 'Questions data not available',
        debug: {
          hasTest: !!result.test,
          hasQuestions: !!(result.test && result.test.questions),
          questionUids: result.test?.questionUids
        }
      });
    }

    // Create question map for easy lookup
    const questionMap = {};
    result.test.questions.forEach(question => {
      questionMap[question.uid] = question;
    });

    // Create detailed result with all question data
    const detailedResult = {
      _id: result._id,
      test: {
        _id: result.test._id,
        title: result.test.title,
        description: result.test.description,
        duration: result.test.duration,
        marksPerQuestion: result.test.marksPerQuestion,
        negativeMarks: result.test.negativeMarks,
        totalMarks: result.totalMarks,
        questionUids: result.test.questionUids,
        // Include full question details
        questions: result.answers.map(answer => {
          const question = questionMap[answer.questionUid];
          return {
            question: question ? question.question : { english: 'Question not found', hindi: '' },
            description: question ? (question.description || { english: '', hindi: '' }) : { english: '', hindi: '' },
            options: question ? question.options : [],
            tags: question && question.tags ? question.tags.map(tag => ({
              _id: tag._id,
              tag: tag.tag
            })) : [],
            studentAnswer: answer.selectedOption,
            correctAnswer: answer.correctAnswer,
            isCorrect: answer.isCorrect,
            marksObtained: answer.marksObtained
          };
        })
      },
      student: result.student,
      score: result.score,
      totalMarks: result.totalMarks,
      percentage: ((result.score / result.totalMarks) * 100).toFixed(2),
      timeTaken: result.timeTaken,
      submittedAt: result.submittedAt,
      summary: result.summary,
      rank: rank,
      totalStudents: sortedResults.length,
      answers: result.answers.map(answer => ({
        questionUid: answer.questionUid,
        questionIndex: answer.questionIndex,
        selectedOption: answer.selectedOption,
        isCorrect: answer.isCorrect,
        isAttempted: answer.isAttempted,
        correctAnswer: answer.correctAnswer,
        marksObtained: answer.marksObtained
      }))
    };

    res.json(detailedResult);
  } catch (error) {
    console.error('Get student demo test result error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const getStudentDemoResults = async (req, res) => {
  try {
    const results = await DemoResultService.getStudentDemoResults(req.user._id);
    
    // Sort by submission date (most recent first)
    results.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    // Add rank for each result
    const resultsWithRank = await Promise.all(
      results.map(async (result) => {
        const allResults = await DemoResultService.getTestResults(result.test._id);
        const sortedResults = allResults.sort((a, b) => b.score - a.score);
        const rankIndex = sortedResults.findIndex(r => r._id.toString() === result._id.toString());
        const rank = rankIndex >= 0 ? rankIndex + 1 : sortedResults.length + 1;
        
        return {
          ...result.toObject(),
          rank,
          totalStudents: sortedResults.length
        };
      })
    );

    res.json(resultsWithRank);
  } catch (error) {
    console.error('Get student demo results error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

module.exports = {
  createDemoTest,
  getDemoTests,
  updateDemoTest,
  deleteDemoTest,
  toggleDemoTestStatus,
  getAvailableDemoTests,
  getDemoTestById,
  submitDemoTest,
  checkDemoTestAvailability,
  getStudentDemoTestResult,
  getStudentDemoResults
};