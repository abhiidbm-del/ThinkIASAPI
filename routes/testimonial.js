const express = require('express');

const router = express.Router();

const {
  createTestimonial,
  getTestimonials,
  getTestimonial,
  updateTestimonial,
  deleteTestimonial
} = require('../controllers/testimonialController');

const { auth, adminAuth } = require('../middleware/auth');
const { testimonialImageUpload } = require('../config/r2');

const { apiLimiter } = require('../middleware/rateLimiter');


// Public route used by the student portal homepage. It must be declared before
// the protected routes so visitors can read testimonials without a token.
// GET /api/testimonials/public
router.get('/public', apiLimiter, getTestimonials);

// All management operations, including the full admin listing, require admin
// authentication.
router.use(auth, adminAuth, apiLimiter);

// POST /api/testimonials
router.post('/', testimonialImageUpload, createTestimonial);

// GET /api/testimonials
router.get('/', getTestimonials);

// GET /api/testimonials/:id
router.get('/:id', getTestimonial);

// PUT /api/testimonials/:id
router.put('/:id', testimonialImageUpload, updateTestimonial);

// DELETE /api/testimonials/:id
router.delete('/:id', deleteTestimonial);


// ==========================================
// EXPORT ROUTER
// ==========================================

module.exports = router;
