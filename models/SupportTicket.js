const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  key: { type: String, default: '' },
  name: { type: String, required: true, maxlength: 200 },
  mime: { type: String, default: '' }
}, { _id: false });

const messageSchema = new mongoose.Schema({
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['student', 'admin'], required: true },
  body: { type: String, required: true, trim: true, maxlength: 5000 },
  attachments: [attachmentSchema]
}, { timestamps: true });

const supportTicketSchema = new mongoose.Schema({
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  status: { type: String, enum: ['open', 'in_progress', 'closed'], default: 'open', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  messages: { type: [messageSchema], validate: v => v.length > 0 && v.length <= 200 }
}, { timestamps: true });

supportTicketSchema.index({ createdBy: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
