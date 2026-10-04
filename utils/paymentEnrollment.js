const Program = require('../models/Program');
const Batch = require('../models/Batch');
const { mergePlanAccess } = require('./planAccess');
const { availableEnrollment } = require('./availableEnrollment');
async function validateEnrollment({ programId, batchId }) {
  if (!programId && !batchId) return {};
  if (!programId || !batchId) throw Object.assign(new Error('Select a program and its batch.'), { status: 400 });
  const [program, batch] = await Promise.all([
    Program.findOne({ _id: programId, ...availableEnrollment() }),
    Batch.findOne({ _id: batchId, programId, ...availableEnrollment() })
  ]);
  if (!program || !batch) throw Object.assign(new Error('Selected program or batch is unavailable.'), { status: 400 });
  return { programId: program._id, batchId: batch._id };
}
function applyPaymentAccess(user, payment) {
  const access = payment.accessType || payment.plan;
  if (!['pre', 'mains', 'combo'].includes(access)) throw new Error('Payment access type is invalid.');
  user.type = mergePlanAccess(user.type, access);
  user.purchasedPlanId = payment.plan;
  if (payment.programId) user.programId = payment.programId;
  if (payment.batchId) user.batchId = payment.batchId;
}
module.exports = { validateEnrollment, applyPaymentAccess };
