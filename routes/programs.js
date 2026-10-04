const express = require('express');
const router = express.Router();
const {
  getPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram,
  getProgramsGroupedByCategory,
  bulkCreatePrograms
} = require('../controllers/programController');
const { auth, adminAuth } = require('../middleware/auth');

// Public routes
router.get('/', getPrograms);
router.get('/grouped/by-category', getProgramsGroupedByCategory);
router.get('/:id', getProgramById);

// Admin routes
router.post('/', auth, adminAuth, createProgram);
router.post('/bulk', auth, adminAuth, bulkCreatePrograms);
router.put('/:id', auth, adminAuth, updateProgram);
router.delete('/:id', auth, adminAuth, deleteProgram);

module.exports = router;
