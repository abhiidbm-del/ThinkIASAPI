const ExamReopen = require('../models/ExamReopen');
const User = require('../models/User');

const activeReopen = async (testId, userId) => {
  if (!userId) return null;
  return ExamReopen.findOne({ test: testId, user: userId, until: { $gte: new Date() } }).lean();
};

const examWindow = (test, reopen) => {
  const now = Date.now();
  const start = +new Date(test.startTime || test.startDateTime);
  const end = +new Date(test.endTime || test.endDateTime);
  if (reopen && +new Date(reopen.until) >= now) {
    return { canTake: true, reopened: true, waiting: false, ended: false, startsInMs: 0, startTime: test.startTime || test.startDateTime, endTime: reopen.until };
  }
  return {
    canTake: now >= start && now <= end,
    reopened: false,
    waiting: now < start,
    ended: now > end,
    startsInMs: Math.max(0, start - now),
    startTime: test.startTime || test.startDateTime,
    endTime: test.endTime || test.endDateTime
  };
};

const grantReopen = async ({ examId, userId, email, until, createdBy }) => {
  const user = userId
    ? await User.findOne({ _id: userId, role: 'student' })
    : await User.findOne({ email: String(email || '').toLowerCase(), role: 'student' });
  if (!user) {
    const error = new Error('Student not found.');
    error.status = 404;
    throw error;
  }
  const untilDate = new Date(until);
  if (!Number.isFinite(+untilDate) || untilDate <= new Date()) {
    const error = new Error('Choose a future reopen window.');
    error.status = 400;
    throw error;
  }
  const record = await ExamReopen.findOneAndUpdate(
    { test: examId, user: user._id },
    { until: untilDate, createdBy },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { record, student: { _id: user._id, fullName: user.fullName, email: user.email } };
};

module.exports = { activeReopen, examWindow, grantReopen };
