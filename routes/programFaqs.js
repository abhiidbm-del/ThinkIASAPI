const { availableEnrollment } = require('../utils/availableEnrollment');
const router = require('express').Router();
const Faq = require('../models/ProgramFaq');
const Program = require('../models/Program');
const { auth, adminAuth } = require('../middleware/auth');
const handle = fn => async (req, res) => { try { await fn(req, res); } catch (e) { res.status(400).json({ message: e.message }); } };
const fields = ['programId', 'question', 'questionHindi', 'answer', 'answerHindi', 'order', 'isActive'];
const payload = body => Object.fromEntries(fields.filter(k => body[k] !== undefined).map(k => [k, body[k]]));
router.get('/', handle(async (req, res) => {
  const programs = await Program.find({ ...availableEnrollment(), ...(req.query.programId ? { _id: req.query.programId } : {}) }).select('_id');
  const data = await Faq.find({ isActive: true, programId: { $in: programs.map(p => p._id) } }).populate('programId', 'programName programNameHindi').sort({ order: 1, createdAt: 1 });
  res.json({ success: true, data });
}));
router.use(auth, adminAuth);
router.get('/admin', handle(async (_req, res) => res.json({ success: true, data: await Faq.find().populate('programId', 'programName').sort({ order: 1, createdAt: 1 }) })));
router.post('/', handle(async (req, res) => {
  if (!await Program.exists({ _id: req.body.programId, ...availableEnrollment() })) return res.status(400).json({ message: 'Select an active, unexpired program.' });
  res.status(201).json({ success: true, data: await Faq.create(payload(req.body)) });
}));
router.put('/:id', handle(async (req, res) => {
  if (req.body.programId && !await Program.exists({ _id: req.body.programId, ...availableEnrollment() })) return res.status(400).json({ message: 'Select an active, unexpired program.' });
  const data = await Faq.findByIdAndUpdate(req.params.id, payload(req.body), { new: true, runValidators: true });
  if (!data) return res.status(404).json({ message: 'FAQ not found.' });
  res.json({ success: true, data });
}));
router.delete('/:id', handle(async (req, res) => {
  const data = await Faq.findByIdAndDelete(req.params.id);
  if (!data) return res.status(404).json({ message: 'FAQ not found.' });
  res.json({ success: true });
}));
module.exports = router;
