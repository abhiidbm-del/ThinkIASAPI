const express = require('express');
const router = express.Router();
const {
  createModule,
  createFolder,
  createFile,
  getModules,
  getDirectoryTree,
  getModuleTree,
  updateFile,
  updateModule,
  renameItem,
  deleteItem,
  reorderModules,        // Make sure this is imported
  updateModuleOrder,      // Make sure this is imported
  // Public view methods
  getPublicModules,
  getPublicDirectoryTree,
  getPublicModuleTree,
  getPublicFile
} = require('../controllers/freeResourceController');
const { auth } = require('../middleware/auth');

// ========================
// PUBLIC VIEW ROUTES (No auth required)
// ========================

// Get all public modules
router.get('/public/modules', getPublicModules);

// Get public directory tree
router.get('/public/tree', getPublicDirectoryTree);

// Get complete public module tree
router.get('/public/modules/:id/tree', getPublicModuleTree);

// Get specific file info (for preview)
router.get('/public/files/:id', getPublicFile);

// ========================
// ADMIN ROUTES (Auth required)
// ========================

// All admin routes require authentication
router.use(auth);

// ========== MODULE ROUTES ==========
// IMPORTANT: Order matters - static routes BEFORE dynamic routes

// 1. STATIC ROUTES (no parameters) - MUST COME FIRST
router.put('/modules/reorder', reorderModules);  // This should match first
router.post('/modules', createModule);
router.get('/modules', getModules);

// 2. ROUTES WITH SPECIFIC PATHS
router.put('/modules/:id/order', updateModuleOrder);  // More specific than :id
router.get('/modules/:id/tree', getModuleTree);        // More specific than :id

// 3. DYNAMIC ROUTES (with parameters) - MUST COME LAST
router.put('/modules/:id', updateModule);  // This catches anything with /modules/:id

// ========== FOLDER ROUTES ==========
router.post('/folders', createFolder);

// ========== FILE ROUTES ==========
router.post('/files', createFile);
router.put('/files/:id', updateFile);

// ========== DIRECTORY ROUTES ==========
router.get('/tree', getDirectoryTree);

// ========== ITEM ROUTES ==========
router.put('/items/:id/rename', renameItem);
router.delete('/items/:id', deleteItem);

module.exports = router;