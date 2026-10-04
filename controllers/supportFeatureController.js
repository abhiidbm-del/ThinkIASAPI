const SupportFeature = require('../models/SupportFeature');

const normalize = body => ({
  title: body.title?.trim(),
  titleHindi: body.titleHindi?.trim() || '',
  description: body.description?.trim(),
  descriptionHindi: body.descriptionHindi?.trim() || '',
  points: Array.isArray(body.points) ? body.points.map(String).map(value => value.trim()).filter(Boolean) : [],
  pointsHindi: Array.isArray(body.pointsHindi) ? body.pointsHindi.map(String).map(value => value.trim()).filter(Boolean) : [],
  footer: body.footer?.trim() || '',
  footerHindi: body.footerHindi?.trim() || '',
  icon: body.icon?.trim() || 'bi-check-circle',
  displayOrder: Number(body.displayOrder) || 0,
  isActive: body.isActive === undefined ? true : body.isActive === true || body.isActive === 'true'
});

const sendError = (res, error) => {
  if (error.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid support feature ID' });
  if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message });
  console.error('Support feature error:', error);
  return res.status(500).json({ success: false, message: 'Server error' });
};

exports.getPublicFeatures = async (_req, res) => {
  try {
    const data = await SupportFeature.find({ isActive: true }).sort({ displayOrder: 1, createdAt: 1 });
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, count: data.length, data });
  } catch (error) { sendError(res, error); }
};

exports.getFeatures = async (_req, res) => {
  try {
    const data = await SupportFeature.find().sort({ displayOrder: 1, createdAt: 1 });
    res.json({ success: true, count: data.length, data });
  } catch (error) { sendError(res, error); }
};

exports.getFeature = async (req, res) => {
  try {
    const data = await SupportFeature.findById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Support feature not found' });
    res.json({ success: true, data });
  } catch (error) { sendError(res, error); }
};

exports.createFeature = async (req, res) => {
  try {
    const payload = normalize(req.body);
    if (!payload.title || !payload.description) return res.status(400).json({ success: false, message: 'English title and description are required' });
    const data = await SupportFeature.create(payload);
    res.status(201).json({ success: true, message: 'Support feature created successfully', data });
  } catch (error) { sendError(res, error); }
};

exports.updateFeature = async (req, res) => {
  try {
    const payload = normalize(req.body);
    if (!payload.title || !payload.description) return res.status(400).json({ success: false, message: 'English title and description are required' });
    const data = await SupportFeature.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!data) return res.status(404).json({ success: false, message: 'Support feature not found' });
    res.json({ success: true, message: 'Support feature updated successfully', data });
  } catch (error) { sendError(res, error); }
};

exports.deleteFeature = async (req, res) => {
  try {
    const data = await SupportFeature.findByIdAndDelete(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Support feature not found' });
    res.json({ success: true, message: 'Support feature deleted successfully' });
  } catch (error) { sendError(res, error); }
};
