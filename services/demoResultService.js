const DemoResult = require('../models/DemoResult');
const DemoTest = require('../models/DemoTest');
const Question = require('../models/Question');

class DemoResultService {
  static async submitDemoTest(testId, studentId, answers, timeTaken) {
  console.log('Submitting demo test:', { testId, studentId, answersCount: answers.length, timeTaken });
  
  // Get test with populated questions
  const test = await DemoTest.findById(testId)
    .populate({
      path: 'questions',
      select: 'uid correctAnswer'
    });
  
  if (!test) throw new Error('Demo test not found');

  console.log('Test found:', { title: test.title, questionsCount: test.questions.length });

  // Validate that we have questions populated
  if (!test.questions || test.questions.length === 0) {
    throw new Error('No questions found for this demo test');
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

  // Get the next attempt number
  const previousAttempts = await DemoResult.countDocuments({
    test: testId,
    student: studentId
  });
  
  const attemptNumber = previousAttempts + 1;

  // Use findOneAndUpdate with upsert to create or update
  const result = await DemoResult.findOneAndUpdate(
    // Filter: find by test and student
    { 
      test: testId, 
      student: studentId 
    },
    // Update: set all fields
    {
      test: testId,
      student: studentId,
      attemptNumber,
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
    },
    { 
      upsert: true,           // Create if doesn't exist
      new: true,              // Return the updated document
      setDefaultsOnInsert: true,
      runValidators: true      // Run schema validators
    }
  );

  console.log('Result saved:', { 
    resultId: result._id, 
    score, 
    totalMarks, 
    percentage,
    attemptNumber 
  });

  return { 
    result, 
    score, 
    totalMarks, 
    percentage,
    attemptNumber,
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

  static async getStudentDemoResults(studentId) {
    return await DemoResult.find({ student: studentId })
      .populate('test', 'title duration marksPerQuestion negativeMarks')
      .sort({ submittedAt: -1 });
  }

  static async getTestResults(testId) {
    return await DemoResult.find({ test: testId })
      .populate('student', 'fullName email')
      .sort({ score: -1, submittedAt: 1 });
  }

 static async getStudentDemoTestResult(testId, studentId) {
  try {
    // First, get the result
    const result = await DemoResult.findOne({ test: testId, student: studentId })
      .sort({ submittedAt: -1 })
      .populate('student', 'fullName email')
      .lean();

    if (!result) {
      return null;
    }

    // Then, get the test with questions - use exec() for more control
    const test = await DemoTest.findById(testId)
      .populate({
        path: 'questions',
        select: 'uid question description options correctAnswer tags',
        populate: {
          path: 'tags',
          select: 'tag'
        }
      })
      .lean()
      .exec();

    if (!test) {
      return null;
    }

    // Manually ensure questions are in the test object
    console.log('Test questions before assign:', test.questions ? test.questions.length : 0);

    // Create a new object to avoid any reference issues
    const resultWithTest = {
      ...result,
      test: {
        ...test,
        // Explicitly set questions to ensure they're there
        questions: test.questions || []
      }
    };

    console.log('Final test questions count:', resultWithTest.test.questions.length);

    return resultWithTest;
  } catch (error) {
    console.error('Error in getStudentDemoTestResult:', error);
    throw error;
  }
}

  static async getStudentResultsForTests(studentId, testIds) {
    return await DemoResult.find({ 
      student: studentId, 
      test: { $in: testIds } 
    })
    .populate('test', '_id')
    .select('test');
  }

  static async calculateStudentRank(testId, studentId) {
    const results = await DemoResult.find({ test: testId })
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
    return await DemoResult.findById(resultId)
      .populate('test', 'title questionUids marksPerQuestion negativeMarks')
      .populate('student', 'fullName email');
  }
}

module.exports = DemoResultService;