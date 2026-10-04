// routes/answerWritingRoutes.js

const express = require('express');
const router = express.Router();
const {
  createAnswerWriting,
  getAllAnswerWritingAdmin,
  getAvailableExercises,
  getAnswerWritingById,
  updateAnswerWriting,
  deleteAnswerWriting,
  toggleExerciseStatus,
  submitAnswers,
  getMySubmissions,
  getExerciseSubmissions,
  submitEvaluation,
  getEvaluationStatus,
  getExerciseEvaluations,
  bulkSubmitEvaluations,
  updateModelAnswer,
  getModelAnswer,
  updateModelAnswerField,
  getMyEvaluation,
  getMyEvaluations
} = require('../controllers/answerWritingController');
const { auth, adminAuth } = require('../middleware/auth');
const { uploadAnswerSheet } = require('../config/r2');

// ============================================
// STUDENT ROUTES - SPECIFIC PATHS FIRST
// ============================================

// Student routes - Evaluations (SPECIFIC paths first)
router.get('/my-evaluations', auth, getMyEvaluations);
router.get('/my-submissions', auth, getMySubmissions);
router.get('/available', auth, getAvailableExercises);
router.get('/admin/all', auth, adminAuth, getAllAnswerWritingAdmin);

// Student routes - Dynamic paths (must come after specific paths)
router.get('/:exerciseId/my-evaluation', auth, getMyEvaluation);
router.get('/:id', auth, getAnswerWritingById);
router.post('/:id/submit', auth, uploadAnswerSheet, submitAnswers);

// ============================================
// ADMIN ROUTES
// ============================================

// Admin routes - Exercises
router.post('/', auth, adminAuth, createAnswerWriting);
router.put('/:id', auth, adminAuth, updateAnswerWriting);
router.delete('/:id', auth, adminAuth, deleteAnswerWriting);
router.patch('/:id/toggle-status', auth, adminAuth, toggleExerciseStatus);
router.get('/:id/submissions', auth, adminAuth, getExerciseSubmissions);

// Admin routes - Evaluations
router.post('/submissions/:submissionId/evaluate', auth, adminAuth, submitEvaluation);
router.get('/submissions/:submissionId/evaluation-status', auth, adminAuth, getEvaluationStatus);
router.get('/:exerciseId/evaluations', auth, adminAuth, getExerciseEvaluations);
router.post('/:exerciseId/evaluations/bulk', auth, adminAuth, bulkSubmitEvaluations);

// Admin routes - Model Answers
router.get('/:id/model-answer', auth, adminAuth, getModelAnswer);
router.put('/:id/model-answer', auth, adminAuth, updateModelAnswer);
router.patch('/:id/model-answer/:field', auth, adminAuth, updateModelAnswerField);

// Test endpoint
router.get('/test-r2', async (req, res) => {
  try {
    const { s3Client } = require('../config/r2');
    const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
    
    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      Prefix: 'answer-sheets/',
      MaxKeys: 5
    });
    
    const response = await s3Client.send(command);
    
    res.json({
      success: true,
      files: response.Contents || [],
      publicUrl: process.env.R2_PUBLIC_URL
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
