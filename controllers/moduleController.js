// controllers/moduleController.js
const Module = require('../models/Module');
const Quiz = require('../models/Quiz');
const QuizSubmission = require('../models/QuizSubmission');
const ModuleTest = require('../models/ModuleTest');
const ModuleTestSubmission = require('../models/ModuleTestSubmission');
const Question = require('../models/Question');
const { handleError } = require('../middleware/errorHandler');
const messages = require('../utils/messages');
const { normalizeMaterialLink } = require('../utils/materialLink');

// ============ MODULE OPERATIONS (Existing) ============

const createModule = async (req, res) => {
  try {
    const { nameEnglish, nameHindi, icon, order, image } = req.body;

    if (!nameEnglish || !nameHindi || !image) {
      return res.status(400).json({ 
        message: 'Name (English & Hindi) and image are required' 
      });
    }

    if (!image.startsWith('data:image')) {
      return res.status(400).json({ 
        message: 'Invalid image format. Must be base64 encoded image' 
      });
    }

    const moduleData = {
      name: {
        english: nameEnglish,
        hindi: nameHindi
      },
      image: image,
      icon: icon || 'bi-book',
      order: parseInt(order) || 0,
      type: 'module',
      parent: null,
      createdBy: req.user._id
    };

    const module = await Module.create(moduleData);
    
    res.status(201).json({
      message: 'Module created successfully',
      module
    });
  } catch (error) {
    console.error('Module creation error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const updateModule = async (req, res) => {
  try {
    const { nameEnglish, nameHindi, icon, order, image } = req.body;

    const updateData = {
      name: {
        english: nameEnglish,
        hindi: nameHindi
      },
      icon: icon,
      order: parseInt(order) || 0
    };

    if (image && image.startsWith('data:image')) {
      updateData.image = image;
    }

    const module = await Module.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id, type: 'module' },
      updateData,
      { new: true }
    );
    
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    res.json({
      message: 'Module updated successfully',
      module
    });
  } catch (error) {
    console.error('Module update error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const getModules = async (req, res) => {
  try {
    const modules = await Module.find({ 
      createdBy: req.user._id, 
      type: 'module',
      parent: null 
    }).sort({ order: 1, createdAt: 1 });
    
    res.json(modules);
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const deleteModule = async (req, res) => {
  try {
    const module = await Module.findOneAndDelete({ 
      _id: req.params.id, 
      createdBy: req.user._id,
      type: 'module'
    });
    
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    // Delete all children recursively
    await Module.deleteRecursive(req.params.id);

    res.json({ message: 'Module deleted successfully' });
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const toggleModuleStatus = async (req, res) => {
  try {
    const module = await Module.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id, type: 'module' },
      { isActive: { $not: true } },
      { new: true }
    );
    
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }
    
    res.json({
      message: `Module ${module.isActive ? 'activated' : 'deactivated'} successfully`,
      module
    });
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const updateModuleOrder = async (req, res) => {
  try {
    const { order } = req.body;
    const module = await Module.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id, type: 'module' },
      { order: order },
      { new: true }
    );
    
    res.json({
      message: 'Module order updated successfully',
      module
    });
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

// ============ DIRECTORY OPERATIONS ============

const createFolder = async (req, res) => {
  try {
    const { nameEnglish, nameHindi, parentId } = req.body;
    const userId = req.user._id;

    if (!nameEnglish || !parentId) {
      return res.status(400).json({ 
        message: 'Folder name and parent ID are required' 
      });
    }

    const parent = await Module.findOne({ 
      _id: parentId, 
      createdBy: userId,
      type: { $in: ['module', 'folder'] }
    });
    
    if (!parent) {
      return res.status(404).json({ message: 'Parent not found' });
    }

    const existingFolder = await Module.findOne({
      parent: parentId,
      'name.english': nameEnglish,
      createdBy: userId,
      type: 'folder'
    });

    if (existingFolder) {
      return res.status(409).json({ message: 'Folder already exists' });
    }

    const folder = await Module.create({
      name: {
        english: nameEnglish,
        hindi: nameHindi || ''
      },
      type: 'folder',
      parent: parentId,
      image: parent.image,
      icon: 'bi-folder',
      order: 0,
      createdBy: userId
    });

    res.status(201).json({
      message: 'Folder created successfully',
      folder
    });
  } catch (error) {
    console.error('Create folder error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const createFile = async (req, res) => {
  try {
    const { nameEnglish, nameHindi, parentId, fileLink, fileDescription } = req.body;
    const userId = req.user._id;

    if (!nameEnglish || !parentId || !fileLink) {
      return res.status(400).json({ 
        message: 'File name, parent ID, and file link are required' 
      });
    }

    const parent = await Module.findOne({ 
      _id: parentId, 
      createdBy: userId,
      type: { $in: ['module', 'folder'] }
    });
    
    if (!parent) {
      return res.status(404).json({ message: 'Parent not found' });
    }

    const existingFile = await Module.findOne({
      parent: parentId,
      'name.english': nameEnglish,
      createdBy: userId,
      type: 'file'
    });

    if (existingFile) {
      return res.status(409).json({ message: 'File already exists' });
    }

    let fileType = 'other';
    const nameLower = nameEnglish.toLowerCase();
    
    if (nameLower.endsWith('.pdf')) {
      fileType = 'pdf';
    } else if (nameLower.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)) {
      fileType = 'image';
    } else if (nameLower.match(/\.(mp4|avi|mov|wmv|flv|webm)$/)) {
      fileType = 'video';
    } else if (nameLower.match(/\.(mp3|wav|ogg|flac)$/)) {
      fileType = 'audio';
    } else if (nameLower.match(/\.(doc|docx|xls|xlsx|ppt|pptx|txt)$/)) {
      fileType = 'document';
    }

    const file = await Module.create({
      name: {
        english: nameEnglish,
        hindi: nameHindi || ''
      },
      type: 'file',
      parent: parentId,
      fileLink: normalizeMaterialLink(fileLink),
      fileDescription: fileDescription || '',
      fileType: fileType,
      image: parent.image,
      icon: 'bi-file-earmark',
      order: 0,
      createdBy: userId
    });

    res.status(201).json({
      message: 'File created successfully',
      file
    });
  } catch (error) {
    console.error('Create file error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const getDirectoryContents = async (req, res) => {
  try {
    const { parentId } = req.params;
    const userId = req.user._id;

    let query = { createdBy: userId };
    
    if (parentId === 'root') {
      query.type = 'module';
      query.parent = null;
    } else {
      query.parent = parentId;
    }

    const items = await Module.find(query).sort({ type: 1, order: 1, 'name.english': 1 });
    
    res.json({ items });
  } catch (error) {
    console.error('Get directory contents error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const getItem = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const item = await Module.findOne({ _id: id, createdBy: userId });
    
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    res.json({ item });
  } catch (error) {
    console.error('Get item error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const updateFile = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { nameEnglish, nameHindi, fileLink, fileDescription } = req.body;

    const file = await Module.findOne({ 
      _id: id, 
      createdBy: userId, 
      type: 'file' 
    });
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (nameEnglish) {
      file.name.english = nameEnglish;
    }
    if (nameHindi !== undefined) {
      file.name.hindi = nameHindi;
    }
    if (fileLink) {
      file.fileLink = normalizeMaterialLink(fileLink);
      
      const nameLower = nameEnglish || file.name.english;
      if (nameLower.endsWith('.pdf')) {
        file.fileType = 'pdf';
      } else if (nameLower.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)) {
        file.fileType = 'image';
      } else if (nameLower.match(/\.(mp4|avi|mov|wmv|flv|webm)$/)) {
        file.fileType = 'video';
      } else if (nameLower.match(/\.(mp3|wav|ogg|flac)$/)) {
        file.fileType = 'audio';
      } else if (nameLower.match(/\.(doc|docx|xls|xlsx|ppt|pptx|txt)$/)) {
        file.fileType = 'document';
      } else {
        file.fileType = 'other';
      }
    }
    if (fileDescription !== undefined) {
      file.fileDescription = fileDescription;
    }

    await file.save();

    res.json({
      message: 'File updated successfully',
      file
    });
  } catch (error) {
    console.error('Update file error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const renameFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { nameEnglish, nameHindi } = req.body;

    const folder = await Module.findOne({ 
      _id: id, 
      createdBy: userId, 
      type: 'folder' 
    });
    
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    if (nameEnglish) {
      folder.name.english = nameEnglish;
    }
    if (nameHindi !== undefined) {
      folder.name.hindi = nameHindi;
    }

    await folder.save();

    const updateChildrenPaths = async (parentId, parentPath) => {
      const children = await Module.find({ parent: parentId });
      for (const child of children) {
        child.fullPath = `${parentPath}/${child.name.english}`;
        await child.save();
        if (child.type !== 'file') {
          await updateChildrenPaths(child._id, child.fullPath);
        }
      }
    };
    
    await updateChildrenPaths(folder._id, folder.fullPath);

    res.json({
      message: 'Folder renamed successfully',
      folder
    });
  } catch (error) {
    console.error('Rename folder error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const deleteDirectoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const item = await Module.findOne({ _id: id, createdBy: userId });
    
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.type === 'module') {
      return res.status(400).json({ 
        message: 'Use module delete endpoint for modules' 
      });
    }

    await Module.deleteRecursive(id);

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Delete directory item error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

// ============ PUBLIC APIs ============

const getAllActiveModules = async (req, res) => {
  try {
    const modules = await Module.find({ 
      isActive: true, 
      type: 'module',
      parent: null 
    }).sort({ order: 1, 'name.english': 1 });
    
    res.json(modules);
  } catch (error) {
    handleError(res, error, messages.en.serverError);
  }
};

const getPublicDirectoryTree = async (req, res) => {
  try {
    const { moduleId, parentId } = req.query;
    
    let query = { isActive: true };
    
    if (moduleId) {
      query.parent = parentId || moduleId;
    } else if (parentId) {
      query.parent = parentId;
    } else {
      query.type = 'module';
      query.parent = null;
    }

    const items = await Module.find(query).sort({ type: 1, order: 1, 'name.english': 1 });
    
    res.json({ items });
  } catch (error) {
    console.error('Get public directory tree error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const getPublicModuleTree = async (req, res) => {
  try {
    const { id } = req.params;

    const module = await Module.findOne({ _id: id, type: 'module', isActive: true });
    
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    const getChildren = async (parentId) => {
      const children = await Module.find({ 
        parent: parentId, 
        isActive: true 
      }).sort({ type: 1, order: 1, 'name.english': 1 });
      
      for (let child of children) {
        if (child.type !== 'file') {
          child = child.toObject();
          child.children = await getChildren(child._id);
        }
      }
      
      return children;
    };

    const moduleWithTree = module.toObject();
    moduleWithTree.children = await getChildren(module._id);

    res.json({ module: moduleWithTree });
  } catch (error) {
    console.error('Get public module tree error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const getPublicFile = async (req, res) => {
  try {
    const { id } = req.params;
    
    const file = await Module.findOne({ _id: id, type: 'file', isActive: true });
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    res.json({ file });
  } catch (error) {
    console.error('Get public file error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

// ============ QUIZ INTEGRATION FUNCTIONS ============

const attachQuizToModule = async (req, res) => {
  try {
    const { id } = req.params;
    const { quizId, quizSettings } = req.body;
    const userId = req.user._id;

    const module = await Module.findOne({ _id: id, createdBy: userId });
    
    if (!module) {
      return res.status(404).json({ message: 'Module/Folder not found' });
    }

    const quiz = await Quiz.findOne({ _id: quizId, createdBy: userId });
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    module.quizId = quizId;
    module.hasQuiz = true;
    if (quizSettings) {
      module.quizSettings = { ...module.quizSettings, ...quizSettings };
    }

    await module.save();

    res.json({
      message: 'Quiz attached successfully',
      module: {
        _id: module._id,
        hasQuiz: module.hasQuiz,
        quizId: module.quizId,
        quizSettings: module.quizSettings
      }
    });
  } catch (error) {
    console.error('Attach quiz error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const detachQuizFromModule = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const module = await Module.findOne({ _id: id, createdBy: userId });
    
    if (!module) {
      return res.status(404).json({ message: 'Module/Folder not found' });
    }

    module.quizId = null;
    module.hasQuiz = false;
    module.quizSettings = {
      passingScore: 70,
      timeLimit: null,
      allowRetake: false,
      maxAttempts: 1,
      showResults: true
    };

    await module.save();

    res.json({
      message: 'Quiz detached successfully',
      module: {
        _id: module._id,
        hasQuiz: module.hasQuiz,
        quizId: module.quizId
      }
    });
  } catch (error) {
    console.error('Detach quiz error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const getModuleQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    const module = await Module.findOne({ 
      _id: id, 
      isActive: true,
      hasQuiz: true 
    });
    
    if (!module || !module.quizId) {
      return res.status(404).json({ message: 'No quiz found for this module' });
    }

    const quiz = await Quiz.findOne({ 
      _id: module.quizId, 
      isActive: true 
    });

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not available' });
    }

    const questions = await Question.find({ 
      uid: { $in: quiz.questionUids },
      isActive: true 
    }).select('uid question description options');

    res.json({
      quiz: {
        _id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        totalQuestions: questions.length,
        timeLimit: module.quizSettings.timeLimit,
        passingScore: module.quizSettings.passingScore,
        allowRetake: module.quizSettings.allowRetake,
        questions: questions.map(q => ({
          uid: q.uid,
          question: q.question,
          description: q.description,
          options: q.options
        }))
      },
      settings: module.quizSettings
    });
  } catch (error) {
    console.error('Get module quiz error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const submitModuleQuiz = async (req, res) => {
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

    const module = await Module.findOne({ 
      _id: id, 
      isActive: true,
      hasQuiz: true 
    });
    
    if (!module || !module.quizId) {
      return res.status(404).json({ message: 'No quiz found for this module' });
    }

    const quiz = await Quiz.findOne({ _id: module.quizId, isActive: true });
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not available' });
    }

    if (answers.length !== quiz.questionUids.length) {
      return res.status(400).json({ 
        message: `Expected ${quiz.questionUids.length} answers, but got ${answers.length}` 
      });
    }

    if (!module.quizSettings.allowRetake) {
      const existingSubmission = await QuizSubmission.findOne({
        quiz: quiz._id,
        email: email,
        moduleId: module._id
      });
      
      if (existingSubmission) {
        return res.status(400).json({ 
          message: 'You have already completed this quiz. Retakes are not allowed.' 
        });
      }
    }

    const questions = await Question.find({ 
      uid: { $in: quiz.questionUids },
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

    quiz.questionUids.forEach((questionUid, index) => {
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

    const percentage = (score / quiz.questionUids.length) * 100;
    const passed = percentage >= module.quizSettings.passingScore;

    const submission = await QuizSubmission.create({
      quiz: quiz._id,
      moduleId: module._id,
      name,
      email,
      phone,
      score,
      totalQuestions: quiz.questionUids.length,
      correctAnswers,
      wrongAnswers,
      timeTaken,
      passed,
      percentage,
      answers: evaluatedAnswers,
      questionOverview,
      submittedAt: new Date()
    });

    const leaderboard = await QuizSubmission.find({ quiz: quiz._id, moduleId: module._id })
      .sort({ score: -1, timeTaken: 1 })
      .select('score timeTaken');

    const rank = leaderboard.findIndex(s => s._id.equals(submission._id)) + 1;

    res.json({
      message: 'Quiz submitted successfully',
      score,
      totalQuestions: quiz.questionUids.length,
      correctAnswers,
      wrongAnswers,
      percentage,
      passed,
      rank,
      totalParticipants: leaderboard.length,
      timeTaken,
      submittedAt: submission.submittedAt,
      passingScore: module.quizSettings.passingScore,
      showResults: module.quizSettings.showResults,
      questionOverview: module.quizSettings.showResults ? questionOverview : undefined
    });
  } catch (error) {
    console.error('Submit module quiz error:', error);
    handleError(res, error, error.message);
  }
};

const getModuleQuizSubmissions = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const module = await Module.findOne({ _id: id, createdBy: userId });
    
    if (!module || !module.quizId) {
      return res.status(404).json({ message: 'No quiz found for this module' });
    }

    const submissions = await QuizSubmission.find({ 
      quiz: module.quizId,
      moduleId: module._id
    }).sort({ submittedAt: -1 });

    res.json(submissions);
  } catch (error) {
    console.error('Get module quiz submissions error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const getModuleQuizLeaderboard = async (req, res) => {
  try {
    const { id } = req.params;

    const module = await Module.findOne({ 
      _id: id, 
      isActive: true,
      hasQuiz: true 
    });
    
    if (!module || !module.quizId) {
      return res.status(404).json({ message: 'No quiz found for this module' });
    }

    const submissions = await QuizSubmission.find({ 
      quiz: module.quizId,
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
      quizTitle: (await Quiz.findById(module.quizId))?.title || 'Quiz',
      passingScore: module.quizSettings.passingScore
    });
  } catch (error) {
    console.error('Get module quiz leaderboard error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

// ============ MODULE TEST INTEGRATION FUNCTIONS ============

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
    const { id } = req.params;

    const module = await Module.findOne({ 
      _id: id, 
      isActive: true,
      hasModuleTest: true 
    });
    
    if (!module || !module.moduleTestId) {
      return res.status(404).json({ message: 'No module test found for this module' });
    }

    const moduleTest = await ModuleTest.findOne({ 
      _id: module.moduleTestId, 
      isActive: true 
    });

    if (!moduleTest) {
      return res.status(404).json({ message: 'Module test not available' });
    }

    const questions = await Question.find({ 
      uid: { $in: moduleTest.questionUids },
      isActive: true 
    }).select('uid question description options');

    res.json({
      moduleTest: {
        _id: moduleTest._id,
        title: moduleTest.title,
        description: moduleTest.description,
        totalQuestions: questions.length,
        timeLimit: module.moduleTestSettings?.timeLimit || null,
        passingScore: module.moduleTestSettings?.passingScore || 70,
        allowRetake: module.moduleTestSettings?.allowRetake || false,
        questions: questions.map(q => ({
          uid: q.uid,
          question: q.question,
          description: q.description,
          options: q.options
        }))
      },
      settings: module.moduleTestSettings || {
        passingScore: 70,
        timeLimit: null,
        allowRetake: false,
        maxAttempts: 1,
        showResults: true
      }
    });
  } catch (error) {
    console.error('Get module module test error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const submitModuleModuleTest = async (req, res) => {
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

    const module = await Module.findOne({ 
      _id: id, 
      isActive: true,
      hasModuleTest: true 
    });
    
    if (!module || !module.moduleTestId) {
      return res.status(404).json({ message: 'No module test found for this module' });
    }

    const moduleTest = await ModuleTest.findOne({ _id: module.moduleTestId, isActive: true });
    if (!moduleTest) {
      return res.status(404).json({ message: 'Module test not available' });
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
      passingScore: passingScore,
      showResults: module.moduleTestSettings?.showResults !== false,
      questionOverview: module.moduleTestSettings?.showResults !== false ? questionOverview : undefined
    });
  } catch (error) {
    console.error('Submit module module test error:', error);
    handleError(res, error, error.message);
  }
};

const getModuleModuleTestSubmissions = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const module = await Module.findOne({ _id: id, createdBy: userId });
    
    if (!module || !module.moduleTestId) {
      return res.status(404).json({ message: 'No module test found for this module' });
    }

    const submissions = await ModuleTestSubmission.find({ 
      moduleTest: module.moduleTestId,
      moduleId: module._id
    }).sort({ submittedAt: -1 });

    res.json(submissions);
  } catch (error) {
    console.error('Get module module test submissions error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

const getModuleModuleTestLeaderboard = async (req, res) => {
  try {
    const { id } = req.params;

    const module = await Module.findOne({ 
      _id: id, 
      isActive: true,
      hasModuleTest: true 
    });
    
    if (!module || !module.moduleTestId) {
      return res.status(404).json({ message: 'No module test found for this module' });
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
    console.error('Get module module test leaderboard error:', error);
    handleError(res, error, messages.en.serverError);
  }
};

// ============ EXPORTS ============

module.exports = {
  // Module operations
  createModule,
  updateModule,
  getModules,
  deleteModule,
  toggleModuleStatus,
  updateModuleOrder,
  getAllActiveModules,
  
  // Directory operations
  createFolder,
  createFile,
  getDirectoryContents,
  getItem,
  updateFile,
  renameFolder,
  deleteDirectoryItem,
  
  // Public APIs
  getPublicDirectoryTree,
  getPublicModuleTree,
  getPublicFile,
  
  // Quiz integration
  attachQuizToModule,
  detachQuizFromModule,
  getModuleQuiz,
  submitModuleQuiz,
  getModuleQuizSubmissions,
  getModuleQuizLeaderboard,
  
  // ModuleTest integration
  attachModuleTestToModule,
  detachModuleTestFromModule,
  getModuleModuleTest,
  submitModuleModuleTest,
  getModuleModuleTestSubmissions,
  getModuleModuleTestLeaderboard
};
