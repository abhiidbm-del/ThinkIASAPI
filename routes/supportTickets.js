const express = require('express');
const router = express.Router();
const { auth, adminAuth } = require('../middleware/auth');
const { ticketAttachmentUpload } = require('../config/r2');
const controller = require('../controllers/supportTicketController');

const files = (req, res, next) => ticketAttachmentUpload(req, res, error => {
  if (!error) return next();
  res.status(400).json({ success: false, message: error.message });
});

router.use(auth);
router.get('/', controller.listTickets);
router.get('/:id', controller.getTicket);
router.post('/', files, controller.createTicket);
router.post('/:id/replies', files, controller.replyTicket);
router.patch('/:id/status', adminAuth, controller.updateStatus);

module.exports = router;
