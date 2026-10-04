const ProctorSession = require('../models/ProctorSession');
const { getPublicR2Url } = require('../config/r2');

const publicUrlFromKey = key => key && process.env.R2_PUBLIC_URL
  ? `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${String(key).replace(/^\/+/, '')}`
  : null;

// Older monitoring rows may contain multer-s3's private R2 endpoint URL.
// Convert those to the same public URL format used by the rest of the app.
const normalizeStoredR2Url = value => {
  if (!value || !process.env.R2_PUBLIC_URL || !value.includes('.r2.cloudflarestorage.com/')) return value;
  const pathAfterHost = value.split('.r2.cloudflarestorage.com/')[1]?.split(/[?#]/)[0];
  if (!pathAfterHost) return value;
  const bucketPrefix = `${process.env.R2_BUCKET_NAME}/`;
  const key = pathAfterHost.startsWith(bucketPrefix)
    ? pathAfterHost.slice(bucketPrefix.length)
    : pathAfterHost;
  return publicUrlFromKey(key) || value;
};

const liveSignalExpiry = () => new Date(Date.now() + 2 * 60 * 1000);

exports.iceConfig = (_req, res) => {
  const iceServers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (process.env.TURN_URL) iceServers.push({
    urls: process.env.TURN_URL.split(',').map(value => value.trim()).filter(Boolean),
    username: process.env.TURN_USERNAME || '',
    credential: process.env.TURN_CREDENTIAL || ''
  });
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: { iceServers } });
};

exports.createLiveOffer = async (req, res) => {
  const { offer } = req.body;
  if (!offer?.sdp || offer.type !== 'offer') return res.status(400).json({ success: false, message: 'Valid WebRTC offer is required' });
  const requestId = require('crypto').randomUUID();
  const data = await ProctorSession.findOneAndUpdate(
    { _id: req.params.id, status: 'active' },
    { liveSignal: { requestId, offer, answer: null, requestedAt: new Date(), expiresAt: liveSignalExpiry() } },
    { new: true }
  );
  if (!data) return res.status(404).json({ success: false, message: 'Active monitoring session not found' });
  res.json({ success: true, data: { requestId } });
};

exports.getLiveOffer = async (req, res) => {
  const session = await ProctorSession.findOne({ _id: req.params.id, student: req.user._id, status: 'active' }).select('liveSignal').lean();
  if (!session) return res.status(404).json({ success: false, message: 'Active monitoring session not found' });
  const signal = session.liveSignal;
  if (!signal?.offer || !signal?.expiresAt || new Date(signal.expiresAt) <= new Date()) return res.status(204).send();
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: { requestId: signal.requestId, offer: signal.offer } });
};

exports.submitLiveAnswer = async (req, res) => {
  const { requestId, answer } = req.body;
  if (!requestId || !answer?.sdp || answer.type !== 'answer') return res.status(400).json({ success: false, message: 'Valid WebRTC answer is required' });
  const data = await ProctorSession.findOneAndUpdate(
    { _id: req.params.id, student: req.user._id, status: 'active', 'liveSignal.requestId': requestId, 'liveSignal.expiresAt': { $gt: new Date() } },
    { $set: { 'liveSignal.answer': answer } }, { new: true }
  );
  if (!data) return res.status(404).json({ success: false, message: 'Live viewing request expired' });
  res.json({ success: true });
};

exports.getLiveAnswer = async (req, res) => {
  const session = await ProctorSession.findOne({ _id: req.params.id, 'liveSignal.requestId': req.query.requestId }).select('liveSignal').lean();
  if (!session) return res.status(404).json({ success: false, message: 'Live viewing request not found' });
  if (!session.liveSignal?.answer) return res.status(204).send();
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: { answer: session.liveSignal.answer } });
};

exports.closeLiveView = async (req, res) => {
  await ProctorSession.updateOne({ _id: req.params.id, 'liveSignal.requestId': req.query.requestId }, { $unset: { liveSignal: 1 } });
  res.json({ success: true });
};

exports.start = async (req, res) => {
  try {
    const { testId, consent, testType } = req.body;
    if (!testId) return res.status(400).json({ success: false, message: 'testId is required' });
    const status = consent ? 'active' : 'camera_denied';
    const update = { status, testModel: testType === 'LiveTest' ? 'LiveTest' : 'Test', consentedAt: consent ? new Date() : undefined, lastHeartbeatAt: new Date() };
    if (!consent) update.$push = { violations: { type: 'camera_denied' } };
    const data = await ProctorSession.findOneAndUpdate(
      { student: req.user._id, test: testId },
      update,
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.heartbeat = async (req, res) => {
  const update = { lastHeartbeatAt: new Date() };
  if (req.body.violation) update.$push = { violations: { type: String(req.body.violation) } };
  const data = await ProctorSession.findOneAndUpdate({ _id: req.params.id, student: req.user._id }, update, { new: true });
  if (!data) return res.status(404).json({ success: false, message: 'Monitoring session not found' });
  res.json({ success: true });
};

exports.snapshot = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'A JPEG, PNG or WebP snapshot is required' });
  const snapshotUrl = getPublicR2Url(req.file);
  const data = await ProctorSession.findOneAndUpdate(
    { _id: req.params.id, student: req.user._id },
    { latestSnapshotUrl: snapshotUrl, latestSnapshotKey: req.file.key, lastHeartbeatAt: new Date(), $inc: { snapshotCount: 1 } }, { new: true }
  );
  if (!data) return res.status(404).json({ success: false, message: 'Monitoring session not found' });
  res.json({ success: true, data: { latestSnapshotUrl: snapshotUrl, latestSnapshotKey: req.file.key } });
};

exports.end = async (req, res) => {
  try {
    const data = await ProctorSession.findOneAndUpdate(
      { _id: req.params.id, student: req.user._id, status: { $ne: 'completed' } },
      { $set: { status: 'completed', completedAt: new Date() }, $unset: { liveSignal: 1 } },
      { new: true }
    );
    if (!data && !await ProctorSession.exists({ _id: req.params.id, student: req.user._id })) {
      return res.status(404).json({ success: false, message: 'Monitoring session not found' });
    }
    res.json({ success: true });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.complete = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'A WebM or MP4 recording is required' });
  const recordingUrl = getPublicR2Url(req.file);
  const data = await ProctorSession.findOneAndUpdate(
    { _id: req.params.id, student: req.user._id },
    {
      $set: { status: 'completed', completedAt: new Date(), lastHeartbeatAt: new Date(), recordingUrl, recordingKey: req.file.key },
      $unset: { liveSignal: 1 }
    },
    { new: true }
  );
  if (!data) return res.status(404).json({ success: false, message: 'Monitoring session not found' });
  res.json({ success: true, data });
};

exports.adminDelete = async (req, res) => {
  const data = await ProctorSession.findByIdAndDelete(req.params.id);
  if (!data) return res.status(404).json({ success: false, message: 'Monitoring session not found' });
  res.json({ success: true });
};

exports.adminDeleteAll = async (req, res) => {
  const result = await ProctorSession.deleteMany({});
  res.json({ success: true, deleted: result.deletedCount || 0 });
};

exports.adminList = async (req, res) => {
  const cutoff = new Date(Date.now() - 2 * 60 * 1000);
  const data = await ProctorSession.find().populate('student', 'fullName email phone').populate('test', 'title').sort({ lastHeartbeatAt: -1 }).limit(200).lean();
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: data.map(item => ({
    ...item,
    latestSnapshotUrl: publicUrlFromKey(item.latestSnapshotKey) || normalizeStoredR2Url(item.latestSnapshotUrl),
    recordingUrl: publicUrlFromKey(item.recordingKey) || normalizeStoredR2Url(item.recordingUrl),
    online: item.status === 'active' && item.lastHeartbeatAt >= cutoff
  })) });
};
