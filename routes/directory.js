const express = require('express');
const router = express.Router();
const {
  createFolder,
  createFile,
  getDirectoryTree,
  getItemById,
  updateFile,
  renameItem,
  deleteItem
} = require('../controllers/directoryController');
const { auth } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Create folder
router.post('/folders', createFolder);

// Create file (with link)
router.post('/files', createFile);

// Get directory tree
router.get('/tree', getDirectoryTree);

// Get item by ID
router.get('/:id', getItemById);

// Update file (link and metadata)
router.put('/files/:id', updateFile);

// Rename item
router.put('/:id/rename', renameItem);

// Delete item
router.delete('/:id', deleteItem);



module.exports = router;