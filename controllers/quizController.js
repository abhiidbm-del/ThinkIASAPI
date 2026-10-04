const QuizService = require('../services/quizService');
const { handleError } = require('../middleware/errorHandler');

// All controller functions
const createQuiz = async (req, res) => {
  try {
    const quizData = {
      ...req.body,
      questionUids: req.body.questionUids || [], // Add this line
      createdBy: req.user._id
    };

    const quiz = await QuizService.createQuiz(quizData);
    
    res.status(201).json({
      message: 'Quiz created successfully',
      quiz
    });
  } catch (error) {
    handleError(res, error, 'Failed to create quiz');
  }
};

const getQuizzes = async (req, res) => {
  try {
    let quizzes;
    
    // Check if user is authenticated (has req.user)
    if (req.user && req.user.role === 'admin') {
      quizzes = await QuizService.getAllQuizzes();
    } else {
      quizzes = await QuizService.getActiveQuizzes();
    }

    res.json(quizzes);
  } catch (error) {
    handleError(res, error, 'Failed to get quizzes');
  }
};

const getQuizById = async (req, res) => {
  try {
    const quiz = await QuizService.getQuizWithQuestions(req.params.id);
    
    // For users, send questions without correct answers
    const quizResponse = {
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      isActive: quiz.isActive,
      totalQuestions: quiz.questions.length,
      questions: quiz.questions.map(q => ({
        uid: q.uid,
        question: q.question,
        // description: q.description || { english: '' },
        options: q.options || []
      }))
    };

    res.json(quizResponse);
  } catch (error) {
    handleError(res, error, error.message);
  }
};

const updateQuiz = async (req, res) => {
  try {
    const quizData = {
      ...req.body,
      questionUids: req.body.questionUids || [] // Add this line
    };
    
    const quiz = await QuizService.updateQuiz(req.params.id, quizData);
    
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    res.json({
      message: 'Quiz updated successfully',
      quiz
    });
  } catch (error) {
    handleError(res, error, 'Failed to update quiz');
  }
};

const deleteQuiz = async (req, res) => {
  try {
    const quiz = await QuizService.deleteQuiz(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    res.json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to delete quiz');
  }
};

const toggleQuizActive = async (req, res) => {
  try {
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive must be a boolean' });
    }

    const quiz = await QuizService.toggleQuizActive(req.params.id, isActive);
    
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    res.json({
      message: `Quiz ${isActive ? 'activated' : 'deactivated'}`,
      quiz
    });
  } catch (error) {
    handleError(res, error, 'Failed to toggle quiz');
  }
};

// Updated submitQuiz function in quizController.js
const submitQuiz = async (req, res) => {
  try {
    const { name, email, phone, answers, timeTaken } = req.body;
    
    // Validate required fields
    if (!name || !email || !phone) {
      return res.status(400).json({ 
        message: 'Name, email, and phone are required' 
      });
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: 'Answers must be an array' });
    }

    if (!timeTaken || typeof timeTaken !== 'number') {
      return res.status(400).json({ message: 'Time taken is required' });
    }

    const submission = await QuizService.submitQuiz(req.params.id, {
      name,
      email,
      phone,
      answers,
      timeTaken
    });

    // Get leaderboard for this quiz
    const leaderboard = await QuizService.getQuizLeaderboard(req.params.id);
    
    // Find this user's rank
    const userRank = leaderboard.findIndex(item => 
      item.email === email
    ) + 1;

    res.json({
      message: 'Quiz submitted successfully',
      score: submission.score,
      totalQuestions: submission.totalQuestions,
      correctAnswers: submission.correctAnswers,
      wrongAnswers: submission.wrongAnswers,
      rank: userRank,
      totalParticipants: leaderboard.length,
      timeTaken: submission.timeTaken,
      submittedAt: submission.submittedAt,
      // Add detailed question overview
      questionOverview: submission.questionOverview || []
    });
  } catch (error) {
    handleError(res, error, error.message);
  }
};

const getQuizLeaderboard = async (req, res) => {
  try {
    const leaderboard = await QuizService.getQuizLeaderboard(req.params.id);
    
    res.json({
      leaderboard,
      totalParticipants: leaderboard.length
    });
  } catch (error) {
    handleError(res, error, 'Failed to get leaderboard');
  }
};

const checkQuizAvailability = async (req, res) => {
  try {
    const availability = await QuizService.checkQuizAvailability(req.params.id);
    res.json(availability);
  } catch (error) {
    handleError(res, error, 'Failed to check availability');
  }
};

const getQuizSubmissions = async (req, res) => {
  try {
    const submissions = await QuizService.getQuizSubmissions(req.params.id);
    res.json(submissions);
  } catch (error) {
    handleError(res, error, 'Failed to get submissions');
  }
};

// Export all functions
module.exports = {
  createQuiz,
  getQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  toggleQuizActive,
  submitQuiz,
  getQuizLeaderboard,
  checkQuizAvailability,
  getQuizSubmissions
};