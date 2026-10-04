// controllers/planController.js
const { PLANS } = require('../config/plans');
const Plan = require('../models/Plan');
const Program = require('../models/Program');
const Batch = require('../models/Batch');

const defaults = Object.values(PLANS).map((plan, index) => ({
  ...plan,
  accessType: plan.id,
  subtitle: plan.name,
  subtitleHindi: plan.nameHindi,
  badgeHindi: plan.id === 'pre' ? 'सबसे लोकप्रिय' : plan.id === 'combo' ? 'बेहतर मूल्य' : '',
  badge: plan.id === 'pre' ? 'Most Popular' : plan.id === 'combo' ? 'Best Value' : '',
  displayOrder: index + 1,
  isActive: true
}));

const ensurePlans = async () => {
  await Plan.bulkWrite(defaults.map(plan => ({
    updateOne: { filter: { id: plan.id }, update: { $setOnInsert: plan }, upsert: true }
  })));
};

const getPlans = async (req, res) => {
  try {
    await ensurePlans();
    const plans = await Plan.find({ isActive: true }).sort({ displayOrder: 1, createdAt: 1 }).select('-__v').lean();

    res.json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ 
      message: 'Failed to fetch plans', 
      error: error.message 
    });
  }
};

const getPlanDetails = async (req, res) => {
  try {
    const { planName } = req.params;
    await ensurePlans();
    const plan = await Plan.findOne({ id: String(planName).toLowerCase(), isActive: true }).select('-__v').lean();

    if (!plan) {
      return res.status(404).json({ 
        message: 'Plan not found' 
      });
    }

    res.json(plan);
  } catch (error) {
    console.error('Error fetching plan details:', error);
    res.status(500).json({ 
      message: 'Failed to fetch plan details', 
      error: error.message 
    });
  }
};

const getAdminPlans = async (_req, res) => {
  try {
    await ensurePlans();
    res.json({ success: true, data: await Plan.find({ isDeleted: { $ne: true } }).sort({ displayOrder: 1 }).select('-__v').lean() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updatePlan = async (req, res) => {
  try {
    const id = String(req.params.id).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) return res.status(400).json({ success: false, message: 'Invalid plan id' });
    const allowed = ['accessType', 'nameHindi', 'subtitleHindi', 'badgeHindi', 'durationHindi', 'featuresHindi', 'name', 'subtitle', 'badge', 'baseAmount', 'totalAmount', 'duration', 'features', 'displayOrder', 'isActive'];
    const update = Object.fromEntries(allowed.filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]]));
    update.id = id;
    const data = await Plan.findOneAndUpdate({ id, isDeleted: { $ne: true } }, update, { new: true, runValidators: true });
    if (!data) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const createPlan = async (req, res) => {
  try {
    const fields = ['id', 'accessType', 'nameHindi', 'subtitleHindi', 'badgeHindi', 'durationHindi', 'featuresHindi', 'name', 'subtitle', 'badge', 'baseAmount', 'totalAmount', 'duration', 'features', 'displayOrder', 'isActive'];
    if (!req.body.accessType) return res.status(400).json({ message: 'Select the plan access type.' });
    const input = Object.fromEntries(fields.filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]]));
    if (!input.id) {
      const slug = String(input.name || 'plan').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55) || 'plan';
      input.id = `${slug}-${require('crypto').randomUUID().slice(0, 8)}`;
    }
    const data = await Plan.create(input);
    res.status(201).json({ success: true, data });
  } catch (error) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'A plan with this ID already exists.' : error.message }); }
};

const deletePlan = async (req, res) => {
  try {
    const id = String(req.params.id).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) return res.status(400).json({ success: false, message: 'Invalid plan id' });

    const plan = await Plan.findOne({ id, isDeleted: { $ne: true } });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });

    const programs = await Program.find({ accessType: plan.accessType }).select('_id').lean();
    if (programs.length) {
      const batchesCount = await Batch.countDocuments({ programId: { $in: programs.map(program => program._id) } });
      return res.status(409).json({
        success: false,
        programsCount: programs.length,
        batchesCount,
        message: `Cannot delete this plan: ${programs.length} program(s) and ${batchesCount} batch(es) use the ${plan.accessType} access type. First delete the batches, then the programs, and try deleting the plan again.`
      });
    }

    plan.isActive = false;
    plan.isDeleted = true;
    await plan.save();
    return res.json({ success: true, message: 'Plan deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Plan could not be deleted.' });
  }
};

module.exports = {
  createPlan,
  getPlans,
  getPlanDetails,
  getAdminPlans,
  updatePlan,
  deletePlan
};
