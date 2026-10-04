// routes/module.js
const express = require('express');
const router = express.Router();
const {
  // Module operations
  createModule,
  updateModule,
  getModules,
  deleteModule,
  toggleModuleStatus,
  updateModuleOrder,
  getAllActiveModules,
  // Directory operations
  createFolder,
  createFile,
  getDirectoryContents,
  getItem,
  updateFile,
  renameFolder,
  deleteDirectoryItem,
  // Public APIs
  getPublicDirectoryTree,
  getPublicModuleTree,
  getPublicFile,
  // Quiz integration
  attachQuizToModule,
  detachQuizFromModule,
  getModuleQuiz,
  submitModuleQuiz,
  getModuleQuizSubmissions,
  getModuleQuizLeaderboard,
  // ModuleTest integration
  attachModuleTestToModule,
  detachModuleTestFromModule,
  getModuleModuleTest,
  submitModuleModuleTest,
  getModuleModuleTestSubmissions,
  getModuleModuleTestLeaderboard
} = require('../controllers/moduleController');
const { auth, adminAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// ============ Public Routes (No Auth Required) ============
router.get('/public', getAllActiveModules);
router.get('/public/directory', getPublicDirectoryTree);
router.get('/public/module-tree/:id', getPublicModuleTree);
router.get('/public/file/:id', getPublicFile);

// Public Quiz Routes
router.get('/public/:id/quiz', getModuleQuiz);
router.post('/public/:id/submit-quiz', submitModuleQuiz);
router.get('/public/:id/quiz-leaderboard', getModuleQuizLeaderboard);

// Public ModuleTest Routes
router.get('/public/:id/module-test', getModuleModuleTest);
router.post('/public/:id/submit-module-test', submitModuleModuleTest);
router.get('/public/:id/module-test-leaderboard', getModuleModuleTestLeaderboard);

// ============ Admin Routes (require auth) ============
router.use(auth, apiLimiter);

// Module CRUD
router.post('/', adminAuth, createModule);
router.get('/admin', adminAuth, getModules);
router.put('/:id', adminAuth, updateModule);
router.delete('/:id', adminAuth, deleteModule);
router.patch('/:id/toggle-status', adminAuth, toggleModuleStatus);
router.patch('/:id/order', adminAuth, updateModuleOrder);

// Directory operations
router.post('/folders', adminAuth, createFolder);
router.post('/files', adminAuth, createFile);
router.get('/directory/:parentId', adminAuth, getDirectoryContents);
router.get('/item/:id', adminAuth, getItem);
router.put('/files/:id', adminAuth, updateFile);
router.put('/folders/:id', adminAuth, renameFolder);
router.delete('/directory/:id', adminAuth, deleteDirectoryItem);

// Admin Quiz Routes
router.post('/:id/attach-quiz', adminAuth, attachQuizToModule);
router.delete('/:id/detach-quiz', adminAuth, detachQuizFromModule);
router.get('/:id/quiz-submissions', adminAuth, getModuleQuizSubmissions);
router.get('/:id/quiz-leaderboard', adminAuth, getModuleQuizLeaderboard);

// Admin ModuleTest Routes
router.post('/:id/attach-module-test', adminAuth, attachModuleTestToModule);
router.delete('/:id/detach-module-test', adminAuth, detachModuleTestFromModule);
router.get('/:id/module-test-submissions', adminAuth, getModuleModuleTestSubmissions);
router.get('/:id/module-test-leaderboard', adminAuth, getModuleModuleTestLeaderboard);

module.exports = router;