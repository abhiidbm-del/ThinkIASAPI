const express = require('express');
const router = express.Router();
const {
  createTag,
  getTags,
  getCategories,
  updateTag,
  deleteTag
} = require('../controllers/tagController');
const { auth, adminAuth } = require('../middleware/auth');

// Get all tags
router.get('/', auth, adminAuth, getTags);

// Get categories
router.get('/categories', auth, adminAuth, getCategories);

// CRUD operations
router.post('/', auth, adminAuth, createTag);
router.put('/:id', auth, adminAuth, updateTag);
router.delete('/:id', auth, adminAuth, deleteTag);

module.exports = router;