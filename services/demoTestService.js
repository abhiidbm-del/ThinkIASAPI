const DemoTest = require('../models/DemoTest');
const Question = require('../models/Question');

class DemoTestService {
  static async createDemoTest(testData) {
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
    
    return await DemoTest.create(testData);
  }

  static async getDemoTestById(testId, options = {}) {
    const query = DemoTest.findById(testId);
    
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

  static async getAvailableDemoTestsForStudent() {
    const tests = await DemoTest.find({ isActive: true })
      .populate({
        path: 'questions',
        select: '_id question uid',
        match: { isActive: true }
      })
      .sort({ createdAt: -1 })
      .exec();

    return tests;
  }

  static async getDemoTestWithValidation(testId, userId, userRole) {
    const test = await this.getDemoTestById(testId, { populateQuestions: true });
    if (!test) throw new Error('Demo test not found');

    if (userRole === 'student') {
      if (!test.isActive) throw new Error('Demo test is not active');
    }

    return test;
  }

  static async updateDemoTest(testId, updateData) {
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
    
    return await DemoTest.findByIdAndUpdate(
      testId, 
      updateData, 
      { new: true, runValidators: true }
    );
  }

  static async deleteDemoTest(testId) {
    const test = await DemoTest.findByIdAndDelete(testId);
    if (test) {
      // Optionally delete associated results or handle them as needed
      const DemoResult = require('../models/DemoResult');
      await DemoResult.deleteMany({ test: testId });
    }
    return test;
  }

  static async toggleDemoTestStatus(testId) {
    const test = await DemoTest.findById(testId);
    if (!test) throw new Error('Demo test not found');
    
    test.isActive = !test.isActive;
    await test.save();
    
    return test;
  }

  static async getDemoTestsByCreator(creatorId) {
    return await DemoTest.find({ createdBy: creatorId })
      .populate({
        path: 'questions',
        select: '_id question.english uid',
        match: { isActive: true }
      })
      .sort({ createdAt: -1 });
  }

  static async getAllActiveDemoTests() {
    return await DemoTest.find({ isActive: true })
      .populate({
        path: 'questions',
        select: '_id question.english uid',
        match: { isActive: true }
      })
      .sort({ createdAt: -1 });
  }

  static async getDemoTestWithFullQuestions(testId) {
    return await DemoTest.findById(testId)
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

module.exports = DemoTestService;