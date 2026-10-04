const express = require('express');
const router = express.Router();
const {
  createBatch,
  getAllBatchesAdmin,
  getActiveBatches,
  getBatchById,
  updateBatch,
  deleteBatch,
  toggleBatchStatus
} = require('../controllers/batchController');
const { auth, adminAuth } = require('../middleware/auth');

// Public routes
router.get('/programs/:programId/batches', getActiveBatches);
router.get('/batches/:id', getBatchById);

// Admin routes (protected)
router.get('/programs/:programId/batches/admin', auth, adminAuth, getAllBatchesAdmin);
router.post('/programs/:programId/batches', auth, adminAuth, createBatch);
router.put('/batches/:id', auth, adminAuth, updateBatch);
router.delete('/batches/:id', auth, adminAuth, deleteBatch);
router.patch('/batches/:id/toggle-status', auth, adminAuth, toggleBatchStatus);

module.exports = router;