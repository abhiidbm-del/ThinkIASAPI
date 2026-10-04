const Test = require('../models/Test');
const Result = require('../models/Result');
const User = require('../models/User');
const Question = require('../models/Question');
const SupportTicket = require('../models/SupportTicket');
const QuizSubmission = require('../models/QuizSubmission');
const DemoResult = require('../models/DemoResult');

const withExistingTest = () => [
  {
    $lookup: {
      from: Test.collection.name,
      localField: 'test',
      foreignField: '_id',
      as: 'linkedTest'
    }
  },
  { $unwind: '$linkedTest' },
  { $match: { 'linkedTest.isDeleted': { $ne: true } } }
];

class AnalyticsService {
  static async getTestAnalytics(testId) {
    // Get test with populated questions
    const test = await Test.findById(testId)
      .populate({
        path: 'questions',
        select: 'uid question description options correctAnswer'
      });
    
    if (!test) throw new Error('Test not found');

    const results = await Result.find({ test: testId }).populate('student', 'fullName email');
    const totalStudents = results.length;
    
    const scores = results.map(r => r.score);
    const averageScore = totalStudents > 0 ? scores.reduce((sum, score) => sum + score, 0) / totalStudents : 0;
    const highestScore = totalStudents > 0 ? Math.max(...scores) : 0;
    const lowestScore = totalStudents > 0 ? Math.min(...scores) : 0;
    const averageTime = totalStudents > 0 ? results.reduce((sum, r) => sum + (r.timeTaken || 0), 0) / totalStudents : 0;

    // Create a map of questions by UID for easy lookup
    const questionMap = {};
    test.questions.forEach(question => {
      questionMap[question.uid] = question;
    });

    const questionStats = test.questionUids.map((questionUid, index) => {
      const question = questionMap[questionUid];
      
      // Count correct answers for this question
      const correctAnswers = results.filter(result => {
        const answer = result.answers.find(ans => ans.questionUid === questionUid);
        return answer && answer.isCorrect;
      }).length;

      return {
        questionIndex: index + 1,
        question: question ? question.question : { english: 'Question not found', hindi: '' },
        description: question ? question.description : { english: '', hindi: '' },
        options: question ? question.options : [],
        correctAnswer: question ? question.correctAnswer : -1,
        correctAnswers,
        incorrectAnswers: totalStudents - correctAnswers,
        correctPercentage: totalStudents > 0 ? (correctAnswers / totalStudents) * 100 : 0
      };
    });

    return {
      testTitle: test.title,
      testDescription: test.description,
      totalQuestions: test.questionUids.length,
      totalStudents,
      averageScore: averageScore.toFixed(2),
      highestScore: highestScore.toFixed(2),
      lowestScore: lowestScore.toFixed(2),
      averageTime: Math.round(averageTime),
      marksPerQuestion: test.marksPerQuestion,
      negativeMarks: test.negativeMarks,
      questionStats,
      performanceDistribution: this.calculatePerformanceDistribution(results)
    };
  }

  static async getPlatformStatistics() {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totalTests, prelimsTests, mainsTests, totalStudents, resultCounts, totalQuestions, newSupportRequests, openSupportRequests, quizAttempts, recentQuizAttempts, demoAttempts, recentDemoAttempts] = await Promise.all([
      Test.countDocuments({ isDeleted: { $ne: true } }),
      Test.countDocuments({ isDeleted: { $ne: true }, seriesKind: 'pre' }),
      Test.countDocuments({ isDeleted: { $ne: true }, seriesKind: 'mains' }),
      User.countDocuments({ role: 'student' }),
      Result.aggregate([...withExistingTest(), { $count: 'count' }]),
      Question.countDocuments(),
      SupportTicket.countDocuments({ createdAt: { $gte: last24Hours } }),
      SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
      QuizSubmission.countDocuments(),
      QuizSubmission.countDocuments({ submittedAt: { $gte: last24Hours } }),
      DemoResult.countDocuments(),
      DemoResult.countDocuments({ submittedAt: { $gte: last24Hours } })
    ]);
    const totalResults = resultCounts[0]?.count || 0;

    const recentResults = await Result.aggregate([
      ...withExistingTest(),
      { $sort: { submittedAt: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: User.collection.name,
          localField: 'student',
          foreignField: '_id',
          as: 'studentRecord'
        }
      },
      { $unwind: { path: '$studentRecord', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          studentName: { $ifNull: ['$studentRecord.fullName', 'Deleted student'] },
          testTitle: '$linkedTest.title',
          score: 1,
          totalMarks: 1,
          submittedAt: 1
        }
      }
    ]);

    const activeTests = await Test.countDocuments({ 
      isActive: true,
      startTime: { $lte: new Date() },
      $expr: {
        $gt: [
          { $add: ["$startTime", { $multiply: ["$duration", 60000] }] },
          new Date()
        ]
      }
    });

    return {
      totalTests,
      prelimsTests,
      mainsTests,
      totalStudents,
      totalResults,
      totalQuestions,
      newSupportRequests,
      openSupportRequests,
      quizAttempts,
      recentQuizAttempts,
      demoAttempts,
      recentDemoAttempts,
      activeTests,
      recentResults: recentResults.map(result => ({
        studentName: result.studentName,
        testTitle: result.testTitle,
        score: result.score,
        totalMarks: result.totalMarks,
        submittedAt: result.submittedAt
      }))
    };
  }

  static calculatePerformanceDistribution(results) {
    if (!results || results.length === 0) {
      return {
        excellent: 0,
        good: 0,
        average: 0,
        poor: 0
      };
    }

    return {
      excellent: results.filter(r => (r.score / r.totalMarks) >= 0.8).length,
      good: results.filter(r => (r.score / r.totalMarks) >= 0.6 && (r.score / r.totalMarks) < 0.8).length,
      average: results.filter(r => (r.score / r.totalMarks) >= 0.4 && (r.score / r.totalMarks) < 0.6).length,
      poor: results.filter(r => (r.score / r.totalMarks) < 0.4).length
    };
  }

  // Aggregated payload for admin dashboard graphs (avoids sending full tests/results to the client)
  static async getDashboardCharts() {
    const [totalTests, totalStudents, resultCounts] = await Promise.all([
      Test.countDocuments({ isDeleted: { $ne: true } }),
      User.countDocuments({ role: 'student' }),
      Result.aggregate([...withExistingTest(), { $count: 'count' }])
    ]);
    const totalResults = resultCounts[0]?.count || 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const trendAgg = await Result.aggregate([
      ...withExistingTest(),
      { $match: { submittedAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const trendMap = new Map(trendAgg.map(entry => [entry._id, entry.count]));
    const resultsTrend = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(sevenDaysAgo);
      day.setDate(sevenDaysAgo.getDate() + i);
      const key = day.toISOString().slice(0, 10);
      resultsTrend.push({
        date: day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        count: trendMap.get(key) || 0
      });
    }

    const distributionAgg = await Result.aggregate([
      ...withExistingTest(),
      {
        $project: {
          ratio: { $cond: [{ $gt: ['$totalMarks', 0] }, { $divide: ['$score', '$totalMarks'] }, 0] }
        }
      },
      {
        $bucket: {
          groupBy: '$ratio',
          boundaries: [-Infinity, 0.4, 0.6, 0.8, Infinity],
          default: 'other',
          output: { count: { $sum: 1 } }
        }
      }
    ]);

    const scoreDistribution = { poor: 0, average: 0, good: 0, excellent: 0 };
    const bucketOrder = ['poor', 'average', 'good', 'excellent'];
    distributionAgg.forEach((bucket, index) => {
      if (bucketOrder[index]) scoreDistribution[bucketOrder[index]] = bucket.count;
    });

    return {
      overview: { totalStudents, totalTests, totalResults },
      activity: { totalTests, totalResults },
      resultsTrend,
      scoreDistribution
    };
  }
}

module.exports = AnalyticsService;
