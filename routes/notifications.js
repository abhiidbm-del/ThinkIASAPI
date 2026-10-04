const router = require('express').Router();
const { auth, adminAuth } = require('../middleware/auth');
const controller = require('../controllers/notificationController');

router.use(auth);
router.get('/', controller.getMyNotifications);
router.post('/device-token', controller.registerToken);
router.patch('/:id/read', controller.markRead);
router.post('/', adminAuth, controller.createNotification);
module.exports = router;
