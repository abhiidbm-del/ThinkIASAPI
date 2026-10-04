// routes/moduleTest.js
const express = require('express');
const router = express.Router();
const { 
  createModuleTest,
  getModuleTests,
  getModuleTestById,
  updateModuleTest,
  deleteModuleTest,
  toggleModuleTestActive,
  getModuleTestSubmissions,
  submitModuleTest,
  getModuleTestLeaderboard,
  checkModuleTestAvailability,
  getModuleTestsByModule,
  // Module integration functions
  attachModuleTestToModule,
  detachModuleTestFromModule,
  getModuleModuleTest,
  submitModuleModuleTest,
  getModuleModuleTestSubmissions,
  getModuleModuleTestLeaderboard,
  checkModuleHasTest
} = require('../controllers/moduleTestController');
const { auth, adminAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// ============ PUBLIC ROUTES (No Auth Required) ============
// Get module tests for public view (for students)
router.get('/module/:moduleId/tests', getModuleTestsByModule);
// Get module test for public view
router.get('/public/:moduleId/module-test', getModuleModuleTest);
// Submit module test (public)
router.post('/public/:moduleId/submit-module-test', submitModuleModuleTest);
// Get module test leaderboard (public)
router.get('/public/:moduleId/module-test-leaderboard', getModuleModuleTestLeaderboard);
// Check if module has a test (public)
router.get('/public/:moduleId/has-test', checkModuleHasTest);

// ============ ADMIN ROUTES (Auth Required) ============
// Module Test CRUD
router.post('/', auth, adminAuth, createModuleTest);
router.get('/admin', auth, adminAuth, getModuleTests);
router.get('/:id', getModuleTestById);
router.put('/:id', auth, adminAuth, updateModuleTest);
router.delete('/:id', auth, adminAuth, deleteModuleTest);
router.patch('/:id/toggle-active', auth, adminAuth, toggleModuleTestActive);
router.get('/:id/submissions', auth, adminAuth, getModuleTestSubmissions);

// Module integration (attach/detach) - Admin only
router.post('/:id/attach-module-test', auth, adminAuth, attachModuleTestToModule);
router.delete('/:id/detach-module-test', auth, adminAuth, detachModuleTestFromModule);

module.exports = router;