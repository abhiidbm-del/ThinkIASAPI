const express = require('express');
const router = express.Router();
const { getPlans, getPlanDetails, getAdminPlans, updatePlan, deletePlan } = require('../controllers/planController');
const { auth, adminAuth } = require('../middleware/auth');

// Plan cards are displayed on the public homepage.
router.get('/', getPlans);
router.get('/admin/all', auth, adminAuth, getAdminPlans);
router.post('/admin', auth, adminAuth, require('../controllers/planController').createPlan);
router.put('/admin/:id', auth, adminAuth, updatePlan);
router.delete('/admin/:id', auth, adminAuth, deletePlan);
router.get('/:planName', auth, getPlanDetails);

module.exports = router;
