// Course end dates are calendar dates. Keep today's courses selectable until the day ends.
function availableEnrollment(now = new Date()) {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  return { isActive: true, endDate: { $gte: date } };
}
module.exports = { availableEnrollment };
