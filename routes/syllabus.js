const express = require('express');
const router = express.Router();
const {
  createOrUpdatePrelims,
  createOrUpdateMains,
  getPrelimsSyllabus,
  getMainsSyllabus
} = require('../controllers/syllabusController');
const { auth, adminAuth } = require('../middleware/auth');

// Public routes - no authentication required
router.get('/prelims', getPrelimsSyllabus);
router.get('/mains', getMainsSyllabus);

// Admin only routes - require authentication
router.post('/admin/syllabus/prelims', auth, adminAuth, createOrUpdatePrelims);
router.post('/admin/syllabus/mains', auth, adminAuth, createOrUpdateMains);

module.exports = router;