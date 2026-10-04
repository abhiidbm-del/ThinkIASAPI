const mongoose = require('mongoose');

const proctorSessionSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  testModel: { type: String, enum: ['Test', 'LiveTest'], default: 'Test' },
  test: { type: mongoose.Schema.Types.ObjectId, refPath: 'testModel', required: true, index: true },
  status: { type: String, enum: ['active', 'completed', 'camera_denied', 'interrupted'], default: 'active' },
  consentedAt: Date,
  lastHeartbeatAt: Date,
  completedAt: Date,
  recordingUrl: String,
  recordingKey: String,
  latestSnapshotUrl: String,
  latestSnapshotKey: String,
  liveSignal: {
    requestId: String,
    offer: mongoose.Schema.Types.Mixed,
    answer: mongoose.Schema.Types.Mixed,
    requestedAt: Date,
    expiresAt: Date
  },
  snapshotCount: { type: Number, default: 0 },
  violations: [{ type: { type: String }, occurredAt: { type: Date, default: Date.now } }]
}, { timestamps: true });

proctorSessionSchema.index({ student: 1, test: 1 }, { unique: true });
module.exports = mongoose.model('ProctorSession', proctorSessionSchema);
