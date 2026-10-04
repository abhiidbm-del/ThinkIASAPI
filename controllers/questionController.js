const Question = require('../models/Question');
const { handleError } = require('../middleware/errorHandler');

// Create multiple questions
const createQuestions = async (req, res) => {
  try {
    require('../utils/questionImport').validateQuestions(req.body.questions);
    const processedQuestions = req.body.questions.map(question => ({
      question: {
        english: question.question.english || '',
        hindi: question.question.hindi || ''
      },
      description: {
        english: question.description?.english || '',
        hindi: question.description?.hindi || ''
      },
      options: question.options.map(option => ({
        english: option.english || '',
        hindi: option.hindi || ''
      })),
      correctAnswer: question.correctAnswer,
      tags: question.tags || [],
      createdBy: req.user._id
    }));

    const questions = await Question.insertMany(processedQuestions);

    res.status(201).json({
      message: 'Questions created successfully',
      questions: questions.map(q => ({
        _id: q._id,
        uid: q.uid,
        question: q.question,
        description: q.description,
        options: q.options,
        correctAnswer: q.correctAnswer,
        tags: q.tags
      }))
    });
  } catch (error) {
    console.error('Question creation error:', error);
    handleError(res, error, 'Failed to create questions');
  }
};

// Get all questions with filtering
const getQuestions = async (req, res) => {
  try {
    console.log('🚀 GET QUESTIONS called');
    
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get questions with HTML content
    const questions = await Question.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-__v');

    const total = await Question.countDocuments({});
    const totalPages = Math.ceil(total / limitNum);

    console.log(`✅ Found ${questions.length} of ${total} total questions`);

    res.setHeader('Cache-Control', 'no-cache');
    res.json({
      questions,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalQuestions: total,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('❌ Get questions error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch questions',
      error: error.message 
    });
  }
};

// Get question by ID or UID
const getQuestionByUid = async (req, res) => {
  try {
    const { uid } = req.params;
    
    // Check if it's MongoDB ObjectId or custom UID
    let question;
    if (/^[0-9a-fA-F]{24}$/.test(uid)) {
      question = await Question.findById(uid)
        .populate('tags', 'tag')
        .select('-__v');
    } else {
      question = await Question.findOne({ uid: uid })
        .populate('tags', 'tag')
        .select('-__v');
    }

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    res.json(question);
  } catch (error) {
    handleError(res, error, 'Failed to fetch question');
  }
};

const getQuestionsByTag = async (req, res) => {
  try {
    const { tagId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const questions = await Question.find({ 
      tags: tagId, 
      isActive: true 
    })
      .populate('tags', 'tag')
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-__v');

    const total = await Question.countDocuments({ tags: tagId, isActive: true });
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      questions,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalQuestions: total,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch questions by tag');
  }
};

// Update question
const updateQuestion = async (req, res) => {
  try {
    const { uid } = req.params;
    
    // Check if the parameter is a MongoDB ObjectId
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(uid);
    
    let question;
    const updateData = {
      question: {
        english: req.body.question?.english || '',
        hindi: req.body.question?.hindi || ''
      },
      description: {
        english: req.body.description?.english || '',
        hindi: req.body.description?.hindi || ''
      },
      options: req.body.options?.map(option => ({
        english: option.english || '',
        hindi: option.hindi || ''
      })) || [],
      correctAnswer: req.body.correctAnswer,
      tags: req.body.tags || [],
    };

    if (isObjectId) {
      question = await Question.findByIdAndUpdate(
        uid,
        updateData,
        { new: true, runValidators: true }
      ).select('-__v');
    } else {
      question = await Question.findOneAndUpdate(
        { uid: uid },
        updateData,
        { new: true, runValidators: true }
      ).select('-__v');
    }

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    res.json({
      message: 'Question updated successfully',
      question
    });
  } catch (error) {
    handleError(res, error, 'Failed to update question');
  }
};

// Delete question
const deleteQuestion = async (req, res) => {
  try {
    const { uid } = req.params;
    
    let question;
    if (/^[0-9a-fA-F]{24}$/.test(uid)) {
      question = await Question.findByIdAndDelete(uid);
    } else {
      question = await Question.findOneAndDelete({ uid: uid });
    }

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    res.json({
      message: 'Question deleted successfully'
    });
  } catch (error) {
    handleError(res, error, 'Failed to delete question');
  }
};

// Get all questions without pagination
const getAllQuestions = async (req, res) => {
  try {
    console.log('📋 GET ALL QUESTIONS called');
    
    const questions = await Question.find({})
      .sort({ createdAt: -1 })
      .select('_id question uid options correctAnswer tags createdAt updatedAt');

    console.log(`✅ FOUND ${questions.length} total questions`);

    res.setHeader('Cache-Control', 'no-cache');
    res.json({
      questions,
      totalCount: questions.length
    });
  } catch (error) {
    console.error('❌ Get all questions error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch all questions',
      error: error.message 
    });
  }
};

module.exports = {
  createQuestions,
  getQuestions,
  getQuestionByUid,
  getQuestionsByTag,
  updateQuestion,
  deleteQuestion,
  getAllQuestions
};
