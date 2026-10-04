const express = require('express');
const TestSeries = require('../models/TestSeries');
const Test = require('../models/Test');
const Result = require('../models/Result');
const ExamReopen = require('../models/ExamReopen');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');
const { publishSystemNotification } = require('../services/firebaseNotificationService');
const { examWindow } = require('../utils/examAccess');
const { slotDateTime, calendarDay, fromIst } = require('../utils/istTime');
const allowed = ['intro', 'introHi', 'name', 'nameHi', 'description', 'descriptionHi', 'startDate', 'endDate', 'testDates', 'isActive'];
const payload = body => Object.fromEntries(allowed.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
const slotTime = item => slotDateTime(item);
const serialize = (item, papers = []) => {
  const data = item.toObject();
  const bySlot = new Map(papers.map(paper => [String(paper.slotId), paper]));
  return {
    ...data,
    totalTests: data.testDates.length,
    testDates: data.testDates.map(slot => {
      const slotId = String(slot._id || slot.id);
      return { ...slot, _id: slot._id || slot.id, exam: bySlot.get(slotId) || null };
    })
  };
};
const papersFor = ids => Test.find({ seriesId: { $in: ids } }).select('title description startTime endTime duration marksPerQuestion negativeMarks questionUids seriesId slotId seriesKind isActive introPage').lean().then(papers => {
  papers.forEach(paper => { paper.slotId = paper.slotId != null ? String(paper.slotId) : paper.slotId; });
  return papers;
});
const ensurePapers = async item => {
  for (const slot of item.testDates) {
    const startTime = slotTime(slot);
    const endTime = new Date(startTime.getTime() + Number(slot.duration) * 60000);
    const existing = await Test.findOne({ seriesId: item._id, slotId: slot._id });
    if (existing) {
      existing.startTime = startTime;
      existing.endTime = endTime;
      existing.duration = slot.duration;
      if (!existing.title) existing.title = `${item.name} - ${startTime.toDateString()}`;
      await existing.save();
      continue;
    }
    await Test.create({
      title: `${item.name} - ${startTime.toDateString()}`,
      description: item.description,
      startTime,
      endTime,
      duration: slot.duration,
      marksPerQuestion: 2,
      negativeMarks: 0.66,
      questionUids: [],
      isActive: true,
      seriesId: item._id,
      seriesKind: item.kind,
      slotId: slot._id,
      createdBy: item.createdBy
    });
  }
  const slotIds = item.testDates.map(slot => slot._id);
  await Test.deleteMany({ seriesId: item._id, slotId: { $nin: slotIds } });
};

module.exports = kind => {
  const router = express.Router();
  const handle = fn => async (req, res) => { try { await fn(req, res); } catch (error) { res.status(400).json({ success: false, message: error.message }); } };
  const notify = (item, user) => {
    if (!item.isActive) return;
    publishSystemNotification({ title: String(item.name || '').slice(0,120), titleHindi: String(item.nameHi || item.name || '').slice(0,120), body: String(item.description || '').slice(0,500), bodyHindi: String(item.descriptionHi || item.description || '').slice(0,500), type: 'test_series', audience: kind, link: kind === 'pre' ? '/prelims-test-series' : '/mains-test-series', createdBy: user._id }).catch(error => console.error('Series notification:', error.message));
  };
  const withPapers = async items => {
    for (const item of items) await ensurePapers(item);
    const papers = await papersFor(items.map(item => item._id));
    const grouped = new Map();
    for (const paper of papers) {
      const key = String(paper.seriesId);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(paper);
    }
    return items.map(item => serialize(item, grouped.get(String(item._id)) || []));
  };
  router.use(auth);
  router.get('/student/:filter', handle(async (req, res) => {
    if (req.user.role !== 'admin' && ![kind, 'combo'].includes(req.user.type)) return res.status(403).json({ success: false, message: 'This test series requires the corresponding plan.' });
    const filter = { kind, isActive: true };
    const now = new Date();
    if (req.params.filter === 'available') { filter.startDate = { $lte: now }; filter.endDate = { $gte: fromIst(calendarDay(now), '00:00') }; }
    if (req.params.filter === 'upcoming') filter.startDate = { $gt: now };
    const data = await TestSeries.find(filter).sort({ startDate: 1 });
    const serialized = await withPapers(data);
    const results = req.user.role === 'student'
      ? await Result.find({ student: req.user._id, test: { $in: serialized.flatMap(item => item.testDates.map(slot => slot.exam?._id).filter(Boolean)) } }).select('test score totalMarks percentage submittedAt').lean()
      : [];
    const resultByTest = new Map(results.map(result => [String(result.test), result]));
    const reopens = req.user.role === 'student'
      ? await ExamReopen.find({ user: req.user._id, until: { $gte: new Date() } }).lean()
      : [];
    const reopenByTest = new Map(reopens.map(item => [String(item.test), item]));
    res.json({
      success: true,
      data: serialized.map(item => ({
        ...item,
        testDates: item.testDates.map(slot => {
          const exam = slot.exam;
          if (!exam) return { ...slot, window: null, result: null };
          const window = examWindow(exam, reopenByTest.get(String(exam._id)));
          return { ...slot, exam, window, result: resultByTest.get(String(exam._id)) || null };
        })
      }))
    });
  }));
  router.use(adminAuth);
  router.get('/admin', handle(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const filter = { kind };
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.search) { const search = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); filter.$or = ['name','nameHi','description','descriptionHi'].map(key => ({ [key]: { $regex: search, $options: 'i' } })); }
    const [items, totalItems] = await Promise.all([TestSeries.find(filter).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit), TestSeries.countDocuments(filter)]);
    res.json({ success: true, data: await withPapers(items), pagination: { currentPage: page, totalPages: Math.ceil(totalItems/limit), totalItems, itemsPerPage: limit } });
  }));
  router.post('/', handle(async (req, res) => { const item = await TestSeries.create({ ...payload(req.body), kind, createdBy: req.user._id }); notify(item, req.user); res.status(201).json({ success: true, data: (await withPapers([item]))[0] }); }));
  router.get('/:id', handle(async (req, res) => { const item = await TestSeries.findOne({ _id: req.params.id, kind }); if (!item) return res.status(404).json({ success: false, message: 'Test series not found.' }); res.json({ success: true, data: (await withPapers([item]))[0] }); }));
  router.put('/:id', handle(async (req, res) => { const item = await TestSeries.findOne({ _id: req.params.id, kind }); if (!item) return res.status(404).json({ success: false, message: 'Test series not found.' }); Object.assign(item, payload(req.body)); await item.save(); notify(item, req.user); res.json({ success: true, data: (await withPapers([item]))[0] }); }));
  router.patch('/:id/toggle-status', handle(async (req, res) => { const item = await TestSeries.findOne({ _id: req.params.id, kind }); if (!item) return res.status(404).json({ success: false, message: 'Test series not found.' }); item.isActive = !item.isActive; await item.save(); notify(item, req.user); res.json({ success: true, data: serialize(item) }); }));
  router.delete('/:id', handle(async (req, res) => { const item = await TestSeries.findOneAndDelete({ _id: req.params.id, kind }); if (!item) return res.status(404).json({ success: false, message: 'Test series not found.' }); await Test.deleteMany({ seriesId: item._id }); res.json({ success: true }); }));
  router.post('/:id/slots/:slotId/exam', handle(async (req, res) => {
    const item = await TestSeries.findOne({ _id: req.params.id, kind });
    if (!item) return res.status(404).json({ success: false, message: 'Test series not found.' });
    const slot = item.testDates.id(req.params.slotId);
    if (!slot) return res.status(404).json({ success: false, message: 'Test date not found.' });
    const startTime = slotTime(slot);
    const endTime = new Date(startTime.getTime() + Number(req.body.duration || slot.duration) * 60000);
    const existing = await Test.findOne({ seriesId: item._id, slotId: slot._id });
    const body = {
      title: req.body.title || `${item.name} - ${startTime.toDateString()}`,
      description: req.body.description || item.description,
      startTime, endTime,
      duration: req.body.duration || slot.duration,
      marksPerQuestion: req.body.marksPerQuestion ?? 2,
      negativeMarks: req.body.negativeMarks ?? 0.66,
      questionUids: req.body.questionUids || [],
      introPage: req.body.introPage || '',
      isActive: req.body.isActive !== false,
      seriesId: item._id, seriesKind: kind, slotId: slot._id, createdBy: req.user._id
    };
    const exam = existing ? Object.assign(existing, body) && await existing.save() : await Test.create(body);
    res.status(existing ? 200 : 201).json({ success: true, data: exam });
  }));
  router.post('/:id/exams/:examId/reopen', handle(async (req, res) => {
    const exam = await Test.findOne({ _id: req.params.examId, seriesId: req.params.id, seriesKind: kind });
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found in this series.' });
    const user = req.body.userId
      ? await User.findOne({ _id: req.body.userId, role: 'student' })
      : await User.findOne({ email: String(req.body.email || '').toLowerCase(), role: 'student' });
    if (!user) return res.status(404).json({ success: false, message: 'Student not found.' });
    const until = new Date(req.body.until);
    if (!Number.isFinite(+until) || until <= new Date()) return res.status(400).json({ success: false, message: 'Choose a future reopen window.' });
    const record = await ExamReopen.findOneAndUpdate({ test: exam._id, user: user._id }, { until, createdBy: req.user._id }, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.json({ success: true, data: record, student: { _id: user._id, fullName: user.fullName, email: user.email } });
  }));
  return router;
};

