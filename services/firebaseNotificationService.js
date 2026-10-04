const admin = require('firebase-admin');
const DeviceToken = require('../models/DeviceToken');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { audienceTypes } = require('../utils/notificationAudience');

function initializeFirebase() {
  if (admin.apps.length) return true;
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const credential = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({ credential: admin.credential.cert(credential) });
      return true;
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
      return true;
    }
  } catch (error) {
    console.error('Firebase initialization failed:', error.message);
  }
  return false;
}

async function pushNotification(notification) {
  if (!initializeFirebase()) return { sent: 0, skipped: true };
  const users = await User.find({ role: 'student', ...(notification.audience === 'all' ? {} : { type: { $in: audienceTypes(notification.audience) } }) }).distinct('_id');
  const devices = await DeviceToken.find({ user: { $in: users } }).select('token language').lean();
  const invalid = [];
  let sent = 0, failed = 0;
  for (const language of ['en', 'hi']) {
    const tokens = devices.filter(device => (device.language || 'en') === language).map(device => device.token);
    for (let offset = 0; offset < tokens.length; offset += 500) {
      const batch = tokens.slice(offset, offset + 500);
      const response = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        notification: { title: language === 'hi' ? notification.titleHindi || notification.title : notification.title, body: language === 'hi' ? notification.bodyHindi || notification.body : notification.body },
        data: { type: notification.type, link: notification.link || '', notificationId: String(notification._id) }
      });
      sent += response.successCount; failed += response.failureCount;
      response.responses.forEach((item, index) => {
        if (!item.success && ['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'].includes(item.error?.code)) invalid.push(batch[index]);
      });
    }
  }
  if (invalid.length) await DeviceToken.deleteMany({ token: { $in: invalid } });
  return { sent, failed };
}

module.exports = { pushNotification };
module.exports.publishSystemNotification = async (payload) => {
  const notification = await Notification.create(payload);
  await pushNotification(notification);
  return notification;
};
