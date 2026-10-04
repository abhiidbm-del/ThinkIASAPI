const express = require('express');
const router = express.Router();
const {
    createFolder,
    createFile,
    getDirectoryTree,
    updateFile,
    renameItem,
    deleteItem,
    getPublicDirectoryTree
} = require('../controllers/topicwiseDirectoryController');
const { auth, adminAuth } = require('../middleware/auth');


// All routes require admin access
router.post('/folders', auth, adminAuth, createFolder);
router.post('/files', auth, adminAuth, createFile);

router.get('/tree/:category', auth, adminAuth, getDirectoryTree);

router.put('/files/:id', auth, adminAuth, updateFile);
router.put('/:id/rename', auth, adminAuth, renameItem);

router.delete('/:id', auth, adminAuth, deleteItem);

router.get('/public/tree/:category', getPublicDirectoryTree);

module.exports = router;