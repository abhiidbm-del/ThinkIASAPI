// controllers/moduleTestController.js
const ModuleTest = require('../models/ModuleTest');
const ModuleTestSubmission = require('../models/ModuleTestSubmission');
const Question = require('../models/Question');
const Module = require('../models/Module');
const { handleError } = require('../middleware/errorHandler');
const messages = require('../utils/messages');

// ============ MODULE TEST CRUD OPERATIONS ============

const createModuleTest = async (req, res) => {
  try {
    const testData = {
      ...req.body,
      questionUids: req.body.questionUids || [],
      createdBy: req.user._id
    };

    if (testData.questionUids && testData.questionUids.length > 0) {
      const existingQuestions = await Question.find({ 
        uid: { $in: testData.questionUids },
        isActive: true 
      }).select('uid');
      
      const existingUids = existingQuestions.map(q => q.uid);
      const missingUids = testData.questionUids.filter(uid => !existingUids.includes(uid));
      
      if (missingUids.length > 0) {
        return res.status(400).json({
          message: `Some questions not found or inactive: ${missingUids.join(', ')}`
        });
      }
    }

    if (req.body.moduleId) {
      const module = await Module.findOne({ 
        _id: req.body.moduleId, 
        createdBy: req.user._id 
      });
      if (!module) {
        return res.status(404).json({ message: 'Module not found' });
      }
      
      module.hasModuleTest = true;
      module.moduleTestSettings = {
        passingScore: req.body.passingScore || 70,
        timeLimit: req.body.timeLimit || null,
        allowRetake: req.body.allowRetake || false,
        maxAttempts: req.body.maxAttempts || 1,
        showResults: req.body.showResults !== undefined ? req.body.showResults : true
      };
    }

    const moduleTest = await ModuleTest.create(testData);
    
    if (req.body.moduleId) {
      await Module.findOneAndUpdate(
        { _id: req.body.moduleId, createdBy: req.user._id },
        { 
          $set: { 
            moduleTestId: moduleTest._id,
            hasModuleTest: true
          } 
        }
      );
    }
    
    res.status(201).json({
      message: 'Module test created successfully',
      moduleTest
    });
  } catch (error) {
    console.error('Module test creation error:', error);
    handleError(res, error, 'Failed to create module test');
  }
};

// UPDATED: Populate createdBy like quiz
const getModuleTests = async (req, res) => {
  try {
    let moduleTests;
    
    if (req.user && req.user.role === 'admin') {
      moduleTests = await ModuleTest.find()
        .populate('createdBy', 'fullName email')
        .sort({ createdAt: -1 });
    } else {
      moduleTests = await ModuleTest.find({ isActive: true })
        .populate('createdBy', 'fullName email')
        .sort({ createdAt: -1 });
    }

    res.json(moduleTests);
  } catch (error) {
    handleError(res, error, 'Failed to get module tests');
  }
};

// UPDATED: Populate createdBy
const getModuleTestById = async (req, res) => {
  try {
    const moduleTest = await ModuleTest.findById(req.params.id)
      .populate('createdBy', 'fullName email');
    
    if (!moduleTest) {
      return res.status(404).json({ message: 'Module test not found' });
    }

    const questions = await Question.find({ 
      uid: { $in: moduleTest.questionUids },
      isActive: true 
    }).select('uid question description options correctAnswer tags');

    const testResponse = {
      _id: moduleTest._id,
      title: moduleTest.title,
      description: moduleTest.description,
      isActive: moduleTest.isActive,
      createdBy: moduleTest.createdBy,
      totalQuestions: questions.length,
      questions: questions.map(q => ({
        uid: q.uid,
        question: q.question,
        description: q.description,
        options: q.options,
        correctAnswer: req.user?.role === 'admin' ? q.correctAnswer : undefined
      }))
    };

    res.json(testResponse);
  } catch (error) {
    handleError(res, error, error.message);
  }
};

const updateModuleTest = async (req, res) => {
  try {
    const testData = {
      ...req.body,
      questionUids: req.body.questionUids || []
    };
    
    if (testData.questionUids && testData.questionUids.length > 0) {
      const existingQuestions = await Question.find({ 
        uid: { $in: testData.questionUids },
        isActive: true 
      }).select('uid');
      
      const existingUids = existingQuestions.map(q => q.uid);
      const missingUids = testData.questionUids.filter(uid => !existingUids.includes(uid));
      
      if (missingUids.length > 0) {
        return res.status(400).json({
          message: `Some questions not found or inactive: ${missingUids.join(', ')}`
        });
      }
    }

    const moduleTest = await ModuleTest.findByIdAndUpdate(
      req.params.id,
      testData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'fullName email');
    
    if (!moduleTest) {
      return res.status(404).json({ message: 'Module test not found' });
    }

    res.json({
      message: 'Module test updated successfully',
      moduleTest
    });
  } catch (error) {
    handleError(res, error, 'Failed to update module test');
  }
};

const deleteModuleTest = async (req, res) => {
  try {
    const moduleTest = await ModuleTest.findByIdAndDelete(req.params.id);
    
    if (!moduleTest) {
      return res.status(404).json({ message: 'Module test not found' });
    }

    await ModuleTestSubmission.deleteMany({ moduleTest: req.params.id });

    res.json({ message: 'Module test deleted successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to delete module test');
  }
};

const toggleModuleTestActive = async (req, res) => {
  try {
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive must be a boolean' });
    }

    const moduleTest = await ModuleTest.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).populate('createdBy', 'fullName email');
    
    if (!moduleTest) {
      return res.status(404).json({ message: 'Module test not found' });
    }

    res.json({
      message: `Module test ${isActive ? 'activated' : 'deactivated'}`,
      moduleTest
    });
  } catch (error) {
    handleError(res, error, 'Failed to toggle module test');
  }
};

const getModuleTestSubmissions = async (req, res) => {
  try {
    const submissions = await ModuleTestSubmission.find({ moduleTest: req.params.id })
      .sort({ submittedAt: -1 });
    
    res.json(submissions);
  } catch (error) {
    handleError(res, error, 'Failed to get submissions');
  }
};

// UPDATED: Populate createdBy
// controllers/moduleTestController.js - Complete updated section

// ============ MODULE TEST SUBMISSION OPERATIONS ============

const getModuleTestsByModule = async (req, res) => {
  try {
    const { moduleId } = req.params;
    
    // Build query - only filter by moduleId
    let query = { moduleId: moduleId };
    
    // If user is authenticated and is admin, show all tests
    // If not, only show active tests
    if (!req.user || req.user.role !== 'admin') {
      query.isActive = true;
    }
    
    const tests = await ModuleTest.find(query)
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 });
    
    res.json(tests);
  } catch (error) {
    console.error('Get module tests by module error:', error);
    handleError(res, error, 'Failed to get module tests');
  }
};

// ============ MODULE TEST SUBMISSION OPERATIONS ============

const submitModuleTest = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, answers, timeTaken } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ 
        message: 'Name, email, and phone are required' 
      });
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: 'Answers must be an array' });
    }

    const moduleTest = await ModuleTest.findById(id);
    if (!moduleTest) {
      return res.status(404).json({ message: 'Module test not found' });
    }

    if (!moduleTest.isActive) {
      return res.status(400).json({ message: 'Module test is not active' });
    }

    if (answers.length !== moduleTest.questionUids.length) {
      return res.status(400).json({ 
        message: `Expected ${moduleTest.questionUids.length} answers, but got ${answers.length}` 
      });
    }

    const existingSubmission = await ModuleTestSubmission.findOne({
      moduleTest: moduleTest._id,
      email: email
    });

    if (existingSubmission) {
      return res.status(400).json({ 
        message: 'You have already submitted this test' 
      });
    }

    const questions = await Question.find({ 
      uid: { $in: moduleTest.questionUids },
      isActive: true 
    });

    const questionMap = {};
    questions.forEach(q => {
      questionMap[q.uid] = q;
    });

    let score = 0;
    let correctAnswers = 0;
    let wrongAnswers = 0;
    const questionOverview = [];
    const evaluatedAnswers = [];

    moduleTest.questionUids.forEach((questionUid, index) => {
      const question = questionMap[questionUid];
      if (!question) {
        throw new Error(`Question with UID ${questionUid} not found`);
      }

      const selectedOption = parseInt(answers[index]?.selectedOption);
      const correctAnswer = parseInt(question.correctAnswer);
      const isCorrect = selectedOption === correctAnswer;

      if (isCorrect) {
        score++;
        correctAnswers++;
      } else {
        wrongAnswers++;
      }

      evaluatedAnswers.push({
        questionUid,
        selectedOption,
        isCorrect
      });

      questionOverview.push({
        questionNumber: index + 1,
        questionUid: question.uid,
        questionText: question.question,
        description: question.description,
        options: question.options?.map((opt, optIndex) => ({
          optionNumber: optIndex,
          optionLetter: String.fromCharCode(65 + optIndex),
          optionText: opt,
          isCorrect: optIndex === correctAnswer,
          isSelected: optIndex === selectedOption
        })),
        selectedOption: selectedOption,
        correctOption: correctAnswer,
        selectedOptionLetter: selectedOption >= 0 ? String.fromCharCode(65 + selectedOption) : null,
        correctOptionLetter: String.fromCharCode(65 + correctAnswer),
        isCorrect: isCorrect,
      });
    });

    const percentage = (score / moduleTest.questionUids.length) * 100;
    const passed = percentage >= 70;

    const submission = await ModuleTestSubmission.create({
      moduleTest: moduleTest._id,
      name,
      email,
      phone,
      score,
      totalQuestions: moduleTest.questionUids.length,
      correctAnswers,
      wrongAnswers,
      timeTaken,
      passed,
      percentage,
      answers: evaluatedAnswers,
      questionOverview,
      submittedAt: new Date()
    });

    const leaderboard = await ModuleTestSubmission.find({ moduleTest: moduleTest._id })
      .sort({ score: -1, timeTaken: 1 })
      .select('score timeTaken');

    const rank = leaderboard.findIndex(s => s._id.equals(submission._id)) + 1;

    res.json({
      message: 'Module test submitted successfully',
      score,
      totalQuestions: moduleTest.questionUids.length,
      correctAnswers,
      wrongAnswers,
      percentage,
      passed,
      rank,
      totalParticipants: leaderboard.length,
      timeTaken,
      submittedAt: submission.submittedAt,
      questionOverview
    });
  } catch (error) {
    console.error('Submit module test error:', error);
    handleError(res, error, error.message);
  }
};

const getModuleTestLeaderboard = async (req, res) => {
  try {
    const { id } = req.params;

    const moduleTest = await ModuleTest.findById(id);
    if (!moduleTest) {
      return res.status(404).json({ message: 'Module test not found' });
    }

    const submissions = await ModuleTestSubmission.find({ moduleTest: moduleTest._id })
      .sort({ score: -1, timeTaken: 1, submittedAt: 1 })
      .select('name email phone score totalQuestions correctAnswers timeTaken submittedAt passed percentage');

    const leaderboardWithRank = submissions.map((sub, index) => ({
      rank: index + 1,
      ...sub.toObject()
    }));

    res.json({
      leaderboard: leaderboardWithRank,
      totalParticipants: submissions.length,
      testTitle: moduleTest.title
    });
  } catch (error) {
    console.error('Get module test leaderboard error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const checkModuleTestAvailability = async (req, res) => {
  try {
    const moduleTest = await ModuleTest.findById(req.params.id);
    if (!moduleTest) {
      return res.status(404).json({ message: 'Module test not found' });
    }
    
    res.json({
      available: moduleTest.isActive,
      message: moduleTest.isActive ? 'Module test is available' : 'Module test is not active',
      totalQuestions: moduleTest.questionUids.length,
      title: moduleTest.title,
      description: moduleTest.description
    });
  } catch (error) {
    handleError(res, error, 'Failed to check availability');
  }
};

// ============ MODULE INTEGRATION FUNCTIONS ============

const attachModuleTestToModule = async (req, res) => {
  try {
    const { id } = req.params;
    const { moduleTestId, testSettings } = req.body;
    const userId = req.user._id;

    const module = await Module.findOne({ _id: id, createdBy: userId });
    
    if (!module) {
      return res.status(404).json({ message: 'Module/Folder not found' });
    }

    const moduleTest = await ModuleTest.findOne({ _id: moduleTestId, createdBy: userId });
    if (!moduleTest) {
      return res.status(404).json({ message: 'Module test not found' });
    }

    module.moduleTestId = moduleTestId;
    module.hasModuleTest = true;
    if (testSettings) {
      module.moduleTestSettings = { ...module.moduleTestSettings, ...testSettings };
    }

    await module.save();

    res.json({
      message: 'Module test attached successfully',
      module: {
        _id: module._id,
        hasModuleTest: module.hasModuleTest,
        moduleTestId: module.moduleTestId,
        moduleTestSettings: module.moduleTestSettings
      }
    });
  } catch (error) {
    console.error('Attach module test error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const detachModuleTestFromModule = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const module = await Module.findOne({ _id: id, createdBy: userId });
    
    if (!module) {
      return res.status(404).json({ message: 'Module/Folder not found' });
    }

    module.moduleTestId = null;
    module.hasModuleTest = false;
    module.moduleTestSettings = {
      passingScore: 70,
      timeLimit: null,
      allowRetake: false,
      maxAttempts: 1,
      showResults: true
    };

    await module.save();

    res.json({
      message: 'Module test detached successfully',
      module: {
        _id: module._id,
        hasModuleTest: module.hasModuleTest,
        moduleTestId: module.moduleTestId
      }
    });
  } catch (error) {
    console.error('Detach module test error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const getModuleModuleTest = async (req, res) => {
  try {
    const { moduleId } = req.params;

    const module = await Module.findOne({ 
      _id: moduleId, 
      isActive: true 
    });
    
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    let moduleTest = null;
    
    if (module.hasModuleTest && module.moduleTestId) {
      moduleTest = await ModuleTest.findOne({ 
        _id: module.moduleTestId, 
        isActive: true 
      });
    }
    
    if (!moduleTest) {
      const tests = await ModuleTest.find({ 
        moduleId: moduleId,
        isActive: true 
      }).sort({ createdAt: -1 }).limit(1);
      
      if (tests.length > 0) {
        moduleTest = tests[0];
        module.moduleTestId = moduleTest._id;
        module.hasModuleTest = true;
        await module.save();
      }
    }

    if (!moduleTest) {
      return res.status(404).json({ message: 'No test found for this module' });
    }

    const questions = await Question.find({ 
      uid: { $in: moduleTest.questionUids },
      isActive: true 
    }).select('uid question description options');

    const settings = module.moduleTestSettings || {
      passingScore: 70,
      timeLimit: null,
      allowRetake: false,
      maxAttempts: 1,
      showResults: true
    };

    res.json({
      moduleTest: {
        _id: moduleTest._id,
        title: moduleTest.title,
        description: moduleTest.description,
        totalQuestions: questions.length,
        timeLimit: settings.timeLimit || null,
        passingScore: settings.passingScore || 70,
        allowRetake: settings.allowRetake || false,
        questions: questions.map(q => ({
          uid: q.uid,
          question: q.question,
          description: q.description,
          options: q.options
        }))
      },
      settings: settings
    });
  } catch (error) {
    console.error('Get module test error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const submitModuleModuleTest = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { name, email, phone, answers, timeTaken } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ 
        message: 'Name, email, and phone are required' 
      });
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: 'Answers must be an array' });
    }

    const module = await Module.findOne({ 
      _id: moduleId, 
      isActive: true,
      hasModuleTest: true 
    });
    
    if (!module || !module.moduleTestId) {
      return res.status(404).json({ message: 'No test found for this module' });
    }

    const moduleTest = await ModuleTest.findOne({ _id: module.moduleTestId, isActive: true });
    if (!moduleTest) {
      return res.status(404).json({ message: 'Test not available' });
    }

    if (answers.length !== moduleTest.questionUids.length) {
      return res.status(400).json({ 
        message: `Expected ${moduleTest.questionUids.length} answers, but got ${answers.length}` 
      });
    }

    if (!module.moduleTestSettings?.allowRetake) {
      const existingSubmission = await ModuleTestSubmission.findOne({
        moduleTest: moduleTest._id,
        email: email,
        moduleId: module._id
      });
      
      if (existingSubmission) {
        return res.status(400).json({ 
          message: 'You have already completed this test. Retakes are not allowed.' 
        });
      }
    }

    const questions = await Question.find({ 
      uid: { $in: moduleTest.questionUids },
      isActive: true 
    });

    const questionMap = {};
    questions.forEach(q => {
      questionMap[q.uid] = q;
    });

    let score = 0;
    let correctAnswers = 0;
    let wrongAnswers = 0;
    const questionOverview = [];
    const evaluatedAnswers = [];

    moduleTest.questionUids.forEach((questionUid, index) => {
      const question = questionMap[questionUid];
      if (!question) {
        throw new Error(`Question with UID ${questionUid} not found`);
      }

      const selectedOption = parseInt(answers[index]?.selectedOption);
      const correctAnswer = parseInt(question.correctAnswer);
      const isCorrect = selectedOption === correctAnswer;

      if (isCorrect) {
        score++;
        correctAnswers++;
      } else {
        wrongAnswers++;
      }

      evaluatedAnswers.push({
        questionUid,
        selectedOption,
        isCorrect
      });

      questionOverview.push({
        questionNumber: index + 1,
        questionUid: question.uid,
        questionText: question.question,
        description: question.description,
        options: question.options?.map((opt, optIndex) => ({
          optionNumber: optIndex,
          optionLetter: String.fromCharCode(65 + optIndex),
          optionText: opt,
          isCorrect: optIndex === correctAnswer,
          isSelected: optIndex === selectedOption
        })),
        selectedOption: selectedOption,
        correctOption: correctAnswer,
        selectedOptionLetter: selectedOption >= 0 ? String.fromCharCode(65 + selectedOption) : null,
        correctOptionLetter: String.fromCharCode(65 + correctAnswer),
        isCorrect: isCorrect,
      });
    });

    const percentage = (score / moduleTest.questionUids.length) * 100;
    const passingScore = module.moduleTestSettings?.passingScore || 70;
    const passed = percentage >= passingScore;

    const submission = await ModuleTestSubmission.create({
      moduleTest: moduleTest._id,
      moduleId: module._id,
      name,
      email,
      phone,
      score,
      totalQuestions: moduleTest.questionUids.length,
      correctAnswers,
      wrongAnswers,
      timeTaken,
      passed,
      percentage,
      answers: evaluatedAnswers,
      questionOverview,
      submittedAt: new Date()
    });

    const leaderboard = await ModuleTestSubmission.find({ 
      moduleTest: moduleTest._id, 
      moduleId: module._id 
    })
    .sort({ score: -1, timeTaken: 1 })
    .select('score timeTaken');

    const rank = leaderboard.findIndex(s => s._id.equals(submission._id)) + 1;

    res.json({
      message: 'Test submitted successfully',
      score,
      totalQuestions: moduleTest.questionUids.length,
      correctAnswers,
      wrongAnswers,
      percentage,
      passed,
      rank,
      totalParticipants: leaderboard.length,
      timeTaken,
      submittedAt: submission.submittedAt,
      passingScore,
      showResults: module.moduleTestSettings?.showResults !== false,
      questionOverview: module.moduleTestSettings?.showResults !== false ? questionOverview : undefined
    });
  } catch (error) {
    console.error('Submit module test error:', error);
    handleError(res, error, error.message);
  }
};

const getModuleModuleTestSubmissions = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const module = await Module.findOne({ _id: id, createdBy: userId });
    
    if (!module || !module.moduleTestId) {
      return res.status(404).json({ message: 'No test found for this module' });
    }

    const submissions = await ModuleTestSubmission.find({ 
      moduleTest: module.moduleTestId,
      moduleId: module._id
    }).sort({ submittedAt: -1 });

    res.json(submissions);
  } catch (error) {
    console.error('Get module test submissions error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const getModuleModuleTestLeaderboard = async (req, res) => {
  try {
    const { moduleId } = req.params;

    const module = await Module.findOne({ 
      _id: moduleId, 
      isActive: true,
      hasModuleTest: true 
    });
    
    if (!module || !module.moduleTestId) {
      return res.status(404).json({ message: 'No test found for this module' });
    }

    const submissions = await ModuleTestSubmission.find({ 
      moduleTest: module.moduleTestId,
      moduleId: module._id
    })
    .sort({ score: -1, timeTaken: 1, submittedAt: 1 })
    .select('name email phone score totalQuestions correctAnswers timeTaken submittedAt passed percentage');

    const leaderboardWithRank = submissions.map((sub, index) => ({
      rank: index + 1,
      ...sub.toObject()
    }));

    res.json({
      leaderboard: leaderboardWithRank,
      totalParticipants: submissions.length,
      testTitle: (await ModuleTest.findById(module.moduleTestId))?.title || 'Module Test',
      passingScore: module.moduleTestSettings?.passingScore || 70
    });
  } catch (error) {
    console.error('Get module test leaderboard error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

// controllers/moduleTestController.js - Add this function

const checkModuleHasTest = async (req, res) => {
  try {
    const { moduleId } = req.params;
    
    const module = await Module.findOne({ 
      _id: moduleId, 
      isActive: true 
    });
    
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }
    
    let hasTest = false;
    let testId = null;
    let testTitle = null;
    let testCount = 0;
    
    // Check if module has tests
    const tests = await ModuleTest.find({ 
      moduleId: moduleId,
      isActive: true 
    });
    
    testCount = tests.length;
    
    if (testCount > 0) {
      hasTest = true;
      testId = tests[0]._id;
      testTitle = tests[0].title;
    }
    
    res.json({
      hasTest,
      testId,
      testTitle,
      testCount,
      moduleName: module.name.english
    });
  } catch (error) {
    console.error('Check module has test error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

module.exports = {
  // ModuleTest CRUD
  createModuleTest,
  getModuleTests,
  getModuleTestById,
  updateModuleTest,
  deleteModuleTest,
  toggleModuleTestActive,
  getModuleTestSubmissions,
  getModuleTestsByModule,
  // ModuleTest submission
  submitModuleTest,
  getModuleTestLeaderboard,
  checkModuleTestAvailability,
  // Module integration
  attachModuleTestToModule,
  detachModuleTestFromModule,
  getModuleModuleTest,
  submitModuleModuleTest,
  getModuleModuleTestSubmissions,
  getModuleModuleTestLeaderboard,
  checkModuleHasTest
};