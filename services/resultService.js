const Result = require('../models/Result');
const Test = require('../models/Test');
const Question = require('../models/Question');

class ResultService {
  static async submitTest(testId, studentId, answers, timeTaken) {
    // Get test with populated questions
    const test = await Test.findById(testId)
      .populate({
        path: 'questions',
        select: 'uid correctAnswer'
      });
    
    if (!test) throw new Error('Test not found');

    const { examWindow, activeReopen } = require('../utils/examAccess');
    const reopen = await activeReopen(testId, studentId);
    const window = examWindow(test, reopen);
    if (window.waiting) throw new Error('Test has not started yet');
    if (!window.canTake) throw new Error('This exam window has ended.');

    // Validate that we have questions populated
    if (!test.questions || test.questions.length === 0) {
      throw new Error('No questions found for this test');
    }

    // Validate that answers count matches questions count
    if (answers.length !== test.questionUids.length) {
      throw new Error(`Expected ${test.questionUids.length} answers, but got ${answers.length}`);
    }

    let score = 0;
    let correctAnswers = 0;
    let wrongAnswers = 0;
    let unattempted = 0;

    // Create a map of questions by UID for easy lookup
    const questionMap = {};
    test.questions.forEach(question => {
      questionMap[question.uid] = question;
    });

    const evaluatedAnswers = answers.map((answer, index) => {
      const questionUid = test.questionUids[index];
      const question = questionMap[questionUid];
      
      if (!question) {
        throw new Error(`Question with UID ${questionUid} not found`);
      }

      // Convert to number for consistent comparison
      const selectedOption = parseInt(answer.selectedOption);
      const correctAnswer = parseInt(question.correctAnswer);
      
      // Check if question was attempted (-1 means unattempted)
      const isAttempted = !isNaN(selectedOption) && selectedOption >= 0 && selectedOption <= 3;
      
      const isCorrect = isAttempted && (selectedOption === correctAnswer);
      
      let marksForThisQuestion = 0;
      
      if (isAttempted) {
        if (isCorrect) {
          marksForThisQuestion = test.marksPerQuestion;
          correctAnswers++;
        } else {
          marksForThisQuestion = -test.negativeMarks;
          wrongAnswers++;
        }
      } else {
        unattempted++;
      }
      
      score += marksForThisQuestion;
      
      return {
        questionUid: questionUid,
        questionIndex: index,
        selectedOption: answer.selectedOption,
        isCorrect,
        isAttempted,
        correctAnswer: question.correctAnswer,
        marksObtained: parseFloat(marksForThisQuestion.toFixed(2))
      };
    });

    // Ensure score doesn't go below zero
    score = Math.max(0, parseFloat(score.toFixed(2)));
    
    const totalMarks = test.totalMarks;
    const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;

    const result = await Result.create({
      test: testId,
      student: studentId,
      answers: evaluatedAnswers,
      score,
      totalMarks,
      percentage,
      timeTaken,
      submittedAt: new Date(),
      summary: {
        totalQuestions: test.questionUids.length,
        correctAnswers,
        wrongAnswers,
        unattempted,
        marksPerQuestion: test.marksPerQuestion,
        negativeMarks: test.negativeMarks
      }
    });

    return { 
      result, 
      score, 
      totalMarks, 
      percentage,
      summary: {
        totalQuestions: test.questionUids.length,
        correctAnswers,
        wrongAnswers,
        unattempted,
        marksPerQuestion: parseFloat(test.marksPerQuestion.toFixed(2)),
        negativeMarks: parseFloat(test.negativeMarks.toFixed(2))
      }
    };
  }

  static async getStudentResults(studentId) {
    return await Result.find({ student: studentId })
      .populate('test', 'title startTime duration marksPerQuestion negativeMarks videoLink')
      .sort({ submittedAt: -1 });
  }

  

  static async getTestResults(testId) {
    return await Result.find({ test: testId })
      .populate('student', 'fullName email')
      .sort({ score: -1, submittedAt: 1 });
  }

  static async getStudentTestResult(testId, studentId) {
  return await Result.findOne({ test: testId, student: studentId })
    .populate({
      path: 'test',
      select: 'title description startTime duration marksPerQuestion negativeMarks questionUids',
      populate: {
        path: 'questions',
        select: 'uid question description options correctAnswer tags',
        populate: {  // This was missing a comma before it
          path: 'tags',
          select: 'tag'
        }
      }
    })
    .populate('student', 'fullName email');
}

  static async getStudentResultsForTests(studentId, testIds) {
    return await Result.find({ 
      student: studentId, 
      test: { $in: testIds } 
    })
    .populate('test', '_id')
    .select('test');
  }

  static async calculateStudentRank(testId, studentId) {
    const results = await Result.find({ test: testId })
      .populate('student', 'fullName email')
      .sort({ score: -1, submittedAt: 1 })
      .lean();

    const sortedResults = results.sort((a, b) => {
      // First sort by score (descending)
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // If scores are equal, sort by submission time (earlier first)
      return new Date(a.submittedAt) - new Date(b.submittedAt);
    });

    // Find the student's rank
    const rankIndex = sortedResults.findIndex(result => 
      result.student._id.toString() === studentId.toString()
    );

    return {
      rank: rankIndex >= 0 ? rankIndex + 1 : sortedResults.length + 1,
      totalStudents: sortedResults.length
    };
  }

  static async calculateRankings(results) {
    const sortedResults = results.sort((a, b) => b.score - a.score || a.submittedAt - b.submittedAt);
    
    return sortedResults.map((result, index) => ({
      ...result.toObject(),
      rank: index + 1,
      totalStudents: sortedResults.length
    }));
  }

  static async getResultById(resultId) {
    return await Result.findById(resultId)
      .populate('test', 'title questionUids marksPerQuestion negativeMarks')
      .populate('student', 'fullName email');
  }
}

module.exports = ResultService;