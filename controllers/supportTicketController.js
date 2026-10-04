const SupportTicket = require('../models/SupportTicket');
const { getPublicR2Url } = require('../config/r2');

const filesFrom = req => (req.files || []).map(file => ({
  url: getPublicR2Url(file) || file.location,
  key: file.key || '',
  name: file.originalname,
  mime: file.mimetype
}));

const serialize = ticket => {
  const item = ticket.toObject ? ticket.toObject() : ticket;
  return { ...item, lastMessage: item.messages[item.messages.length - 1] };
};

const owned = async (req) => {
  const ticket = await SupportTicket.findById(req.params.id).populate('createdBy', 'fullName email').populate('messages.by', 'fullName role');
  if (!ticket) { const error = new Error('Ticket not found.'); error.status = 404; throw error; }
  if (req.user.role !== 'admin' && String(ticket.createdBy._id || ticket.createdBy) !== String(req.user._id)) {
    const error = new Error('You can only view your own tickets.'); error.status = 403; throw error;
  }
  return ticket;
};

exports.createTicket = async (req, res) => {
  try {
    const subject = String(req.body.subject || '').trim();
    const body = String(req.body.body || req.body.description || '').trim();
    if (!subject || !body) return res.status(400).json({ success: false, message: 'Subject and message are required.' });
    const ticket = await SupportTicket.create({
      subject,
      createdBy: req.user._id,
      messages: [{ by: req.user._id, role: 'student', body, attachments: filesFrom(req) }]
    });
    res.status(201).json({ success: true, data: serialize(ticket) });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.listTickets = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const filter = req.user.role === 'admin' ? {} : { createdBy: req.user._id };
    if (req.query.status && ['open', 'in_progress', 'closed'].includes(req.query.status)) filter.status = req.query.status;
    const [items, total] = await Promise.all([
      SupportTicket.find(filter).populate('createdBy', 'fullName email').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
      SupportTicket.countDocuments(filter)
    ]);
    res.json({ success: true, data: items.map(serialize), pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalItems: total } });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.getTicket = async (req, res) => {
  try {
    res.json({ success: true, data: serialize(await owned(req)) });
  } catch (error) { res.status(error.status || 400).json({ success: false, message: error.message }); }
};

exports.replyTicket = async (req, res) => {
  try {
    const ticket = await owned(req);
    const body = String(req.body.body || '').trim();
    if (!body && !filesFrom(req).length) return res.status(400).json({ success: false, message: 'Reply text or an attachment is required.' });
    if (ticket.status === 'closed' && req.user.role !== 'admin') return res.status(400).json({ success: false, message: 'This ticket is closed.' });
    ticket.messages.push({ by: req.user._id, role: req.user.role === 'admin' ? 'admin' : 'student', body: body || 'Attachment', attachments: filesFrom(req) });
    if (req.user.role === 'admin' && ticket.status === 'open') ticket.status = 'in_progress';
    await ticket.save();
    res.json({ success: true, data: serialize(ticket) });
  } catch (error) { res.status(error.status || 400).json({ success: false, message: error.message }); }
};

exports.updateStatus = async (req, res) => {
  try {
    if (!['open', 'in_progress', 'closed'].includes(req.body.status)) return res.status(400).json({ success: false, message: 'Status must be open, in_progress or closed.' });
    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }).populate('createdBy', 'fullName email');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
    res.json({ success: true, data: serialize(ticket) });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};
