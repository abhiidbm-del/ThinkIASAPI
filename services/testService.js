const Test = require('../models/Test');
const Result = require('../models/Result');
const Question = require('../models/Question');

class TestService {
  static async createTest(testData) {
  // Validate endTime is after startTime
  if (testData.startTime && testData.endTime) {
    if (new Date(testData.endTime) <= new Date(testData.startTime)) {
      throw new Error('End time must be after start time');
    }
  }
  
  // Validate that all question UIDs exist
  if (testData.questionUids && testData.questionUids.length > 0) {
    const existingQuestions = await Question.find({ 
      uid: { $in: testData.questionUids },
      isActive: true 
    }).select('uid');
    
    const existingUids = existingQuestions.map(q => q.uid);
    const missingUids = testData.questionUids.filter(uid => !existingUids.includes(uid));
    
    if (missingUids.length > 0) {
      throw new Error(`Some questions not found or inactive: ${missingUids.join(', ')}`);
    }
  }
  
  return await Test.create(testData);
}

  static async getTestById(testId, options = {}) {
    const query = Test.findById(testId);
    
    if (options.populateCreator) {
      query.populate('createdBy', 'fullName email');
    }
    
    if (options.populateQuestions) {
      query.populate({
        path: 'questions',
        select: '_id question description options correctAnswer uid tags',
        populate: {
          path: 'tags',
          select: 'tag'
        }
      });
    }
    
    return await query.exec();
  }

  static async getAvailableTestsForStudent(userId) {
  const now = new Date();
  const User = require('../models/User');
  const ExamReopen = require('../models/ExamReopen');
  const user = await User.findById(userId).select('type').lean();
  const reopens = userId ? await ExamReopen.find({ user: userId, until: { $gte: now } }).select('test') : [];
  const reopenIds = new Set(reopens.map(item => String(item.test)));
  const seriesKinds = [];
  if (user?.type === 'pre' || user?.type === 'combo') seriesKinds.push('pre');
  const tests = await Test.find({
    isActive: true,
    $and: [
      { $or: [{ endTime: { $gt: now } }, { _id: { $in: reopens.map(item => item.test) } }] },
      { $or: [
        { seriesId: null },
        { seriesId: { $exists: false } },
        ...(seriesKinds.length ? [{ seriesKind: { $in: seriesKinds } }] : [])
      ] }
    ]
  })
    .populate({
      path: 'questions',
      select: '_id question uid',
      match: { isActive: true }
    })
    .sort({ startTime: 1 })
    .exec();

  return tests.filter(test => new Date(test.endTime) > now || reopenIds.has(String(test._id)));
}

  static async getTestWithValidation(testId, userId, userRole) {
    const test = await this.getTestById(testId, { populateQuestions: true });
    if (!test) throw new Error('Test not found');

    const now = new Date();
    const endTime = test.endTime;

    if (userRole === 'student') {
      if (now < test.startTime) throw new Error('Test has not started yet');
      if (now > endTime) throw new Error('Test has ended');

      const existingResult = await Result.findOne({ test: testId, student: userId });
      if (existingResult) throw new Error('Test already submitted');
    }

    return test;
  }

  static async updateTest(testId, updateData) {
  // Validate endTime is after startTime if both are being updated
  if (updateData.startTime && updateData.endTime) {
    if (new Date(updateData.endTime) <= new Date(updateData.startTime)) {
      throw new Error('End time must be after start time');
    }
  }
  
  // If only endTime is updated, fetch current startTime
  if (updateData.endTime && !updateData.startTime) {
    const existingTest = await Test.findById(testId);
    if (!existingTest) {
      throw new Error('Test not found');
    }
    if (new Date(updateData.endTime) <= existingTest.startTime) {
      throw new Error('End time must be after start time');
    }
  }
  
  // If only startTime is updated, fetch current endTime
  if (updateData.startTime && !updateData.endTime) {
    const existingTest = await Test.findById(testId);
    if (!existingTest) {
      throw new Error('Test not found');
    }
    if (new Date(updateData.startTime) >= existingTest.endTime) {
      throw new Error('Start time must be before end time');
    }
  }
  
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
  
  return await Test.findByIdAndUpdate(
    testId, 
    updateData, 
    { new: true, runValidators: true }
  );
}

  static async deleteTest(testId) {
    const test = await Test.findByIdAndDelete(testId);
    if (test) {
      await Result.deleteMany({ test: testId });
    }
    return test;
  }

  static async getTestsByCreator(creatorId) {
    return await Test.find({ createdBy: creatorId, seriesId: { $in: [null, undefined] } })
      .populate({
        path: 'questions',
        select: '_id question.english uid',
        match: { isActive: true }
      })
      .sort({ createdAt: -1 });
  }

  static async getAllActiveTests() {
    return await Test.find({ isActive: true, seriesId: { $in: [null, undefined] } })
      .populate({
        path: 'questions',
        select: '_id question.english uid',
        match: { isActive: true }
      })
      .sort({ startTime: 1 });
  }

  static async getTestWithFullQuestions(testId) {
    return await Test.findById(testId)
      .populate({
        path: 'questions',
        select: '_id question description options correctAnswer uid tags',
        populate: {
          path: 'tags',
          select: 'tag'
        }
      })
      .populate('createdBy', 'fullName email')
      .exec();
  }
}

module.exports = TestService;