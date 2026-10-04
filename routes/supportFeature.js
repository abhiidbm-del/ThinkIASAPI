const router = require('express').Router();
const controller = require('../controllers/supportFeatureController');
const { auth, adminAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

router.get('/public', apiLimiter, controller.getPublicFeatures);
router.use(auth, adminAuth, apiLimiter);
router.get('/', controller.getFeatures);
router.post('/', controller.createFeature);
router.get('/:id', controller.getFeature);
router.put('/:id', controller.updateFeature);
router.delete('/:id', controller.deleteFeature);

module.exports = router;
