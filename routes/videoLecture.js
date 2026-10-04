const express = require('express');
const router = express.Router();
const {
    createFolder,
    createVideo,
    getDirectoryTree,
    updateVideo,
    renameItem,
    deleteItem,
    getPublicDirectoryTree,
    getVideoCategories
} = require('../controllers/videoLectureController');
const { auth, adminAuth } = require('../middleware/auth');

// Public routes
router.get('/public/tree/:category', getPublicDirectoryTree);
router.get('/public/categories', getVideoCategories);

// All admin routes require authentication and admin access
router.post('/folders', auth, adminAuth, createFolder);
router.post('/videos', auth, adminAuth, createVideo);
router.get('/tree/:category', auth, adminAuth, getDirectoryTree);
router.put('/videos/:id', auth, adminAuth, updateVideo);
router.put('/:id/rename', auth, adminAuth, renameItem);
router.delete('/:id', auth, adminAuth, deleteItem);

module.exports = router;