const Quiz = require('../models/Quiz');
const QuizSubmission = require('../models/QuizSubmission');
const Question = require('../models/Question');

class QuizService {
  static async createQuiz(quizData) {
    // Validate that all question UIDs exist
    if (quizData.questionUids && quizData.questionUids.length > 0) {
      const existingQuestions = await Question.find({ 
        uid: { $in: quizData.questionUids },
        isActive: true 
      }).select('uid');
      
      const existingUids = existingQuestions.map(q => q.uid);
      const missingUids = quizData.questionUids.filter(uid => !existingUids.includes(uid));
      
      if (missingUids.length > 0) {
        throw new Error(`Some questions not found or inactive: ${missingUids.join(', ')}`);
      }
    }
    
    return await Quiz.create(quizData);
  }

  static async getQuizById(quizId) {
    return await Quiz.findById(quizId);
  }

  static async getActiveQuizzes() {
    return await Quiz.find({ isActive: true })
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 });
  }

  static async getQuizWithQuestions(quizId) {
    const quiz = await Quiz.findById(quizId);
    
    if (!quiz) throw new Error('Quiz not found');
    if (!quiz.isActive && !req.user?.role === 'admin') {
      throw new Error('Quiz is not active');
    }
    
    // Get questions for this quiz
    const questions = await Question.find({ 
      uid: { $in: quiz.questionUids },
      isActive: true 
    }).select('uid question description options correctAnswer tags');
    
    return {
      ...quiz.toObject(),
      questions
    };
  }

  static async toggleQuizActive(quizId, isActive) {
    return await Quiz.findByIdAndUpdate(
      quizId,
      { isActive },
      { new: true }
    );
  }

  // Updated submitQuiz method in quizService.js
static async submitQuiz(quizId, submissionData) {
  const { name, email, phone, answers, timeTaken } = submissionData;
  
  // Get quiz with question UIDs
  const quiz = await Quiz.findById(quizId);
  
  if (!quiz) throw new Error('Quiz not found');
  if (!quiz.isActive) throw new Error('Quiz is not active');

  // Validate answers count matches question UIDs count
  if (answers.length !== quiz.questionUids.length) {
    throw new Error(`Expected ${quiz.questionUids.length} answers, but got ${answers.length}`);
  }

  // Get ALL question details including options and descriptions
  const questions = await Question.find({ 
    uid: { $in: quiz.questionUids },
    isActive: true 
  }).select('uid question description options correctAnswer tags'); // Add explanation if available

  // Create a map for quick lookup
  const questionMap = {};
  questions.forEach(q => {
    questionMap[q.uid] = q;
  });

  let score = 0;
  let correctAnswers = 0;
  let wrongAnswers = 0;
  const questionOverview = [];

  // Evaluate answers and build detailed overview
  const evaluatedAnswers = quiz.questionUids.map((questionUid, index) => {
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

    // Build detailed question overview for response
    const questionDetail = {
      questionNumber: index + 1,
      questionUid: question.uid,
      questionText: question.question,
      description: question.description || null,
      options: question.options?.map((opt, optIndex) => ({
        optionNumber: optIndex,
        optionLetter: String.fromCharCode(65 + optIndex),
        optionText: opt,
        isCorrect: optIndex === correctAnswer,
        isSelected: optIndex === selectedOption
      })) || [],
      selectedOption: selectedOption,
      correctOption: correctAnswer,
      selectedOptionLetter: selectedOption >= 0 ? String.fromCharCode(65 + selectedOption) : null,
      correctOptionLetter: String.fromCharCode(65 + correctAnswer),
      isCorrect: isCorrect,
    };

    questionOverview.push(questionDetail);

    return {
      questionUid,
      selectedOption,
      isCorrect
    };
  });

  // Check if user has already submitted this quiz
  const existingSubmission = await QuizSubmission.findOne({
    quiz: quizId,
    email: email
  });

  if (existingSubmission) {
    throw new Error('You have already submitted this quiz');
  }

  // Create submission with evaluated answers
  const submission = await QuizSubmission.create({
    quiz: quizId,
    name,
    email,
    phone,
    score,
    totalQuestions: quiz.questionUids.length,
    correctAnswers,
    wrongAnswers,
    timeTaken,
    answers: evaluatedAnswers,
    questionOverview: questionOverview, // Store overview in database
    submittedAt: new Date()
  });

  // Add questionOverview to the submission object for immediate response
  submission.questionOverview = questionOverview;

  return submission;
}

  static async getQuizLeaderboard(quizId) {
    const submissions = await QuizSubmission.find({ quiz: quizId })
      .sort({ score: -1, timeTaken: 1, submittedAt: 1 })
      .select('name email phone score timeTaken totalQuestions correctAnswers submittedAt')
      .lean();

    // Add ranks
    return submissions.map((sub, index) => ({
      rank: index + 1,
      ...sub
    }));
  }

  static async getQuizSubmissions(quizId) {
    return await QuizSubmission.find({ quiz: quizId })
      .sort({ submittedAt: -1 });
  }

  static async getAllQuizzes() {
    return await Quiz.find()
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 });
  }

  static async updateQuiz(quizId, updateData) {
    // Validate question UIDs if they are being updated
    if (updateData.questionUids && updateData.questionUids.length > 0) {
      const existingQuestions = await Question.find({ 
        uid: { $in: updateData.questionUids },
        isActive: true 
      }).select('uid');
      
      const existingUids = existingQuestions.map(q => q.uid);
      const missingUids = updateData.questionUids.filter(uid => !existingUids.includes(uid));
      
      if (missingUids.length > 0) {
        throw new Error(`Some questions not found or inactive: ${missingUids.join(', ')}`);
      }
    }
    
    return await Quiz.findByIdAndUpdate(
      quizId,
      updateData,
      { new: true, runValidators: true }
    );
  }

  static async deleteQuiz(quizId) {
    const quiz = await Quiz.findByIdAndDelete(quizId);
    if (quiz) {
      await QuizSubmission.deleteMany({ quiz: quizId });
    }
    return quiz;
  }

  static async checkQuizAvailability(quizId) {
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return { available: false, message: 'Quiz not found' };
    }
    
    return {
      available: quiz.isActive,
      message: quiz.isActive ? 'Quiz is available' : 'Quiz is not active',
      totalQuestions: quiz.questionUids.length,
      title: quiz.title,
      description: quiz.description
    };
  }
}

module.exports = QuizService;