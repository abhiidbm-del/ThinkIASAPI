const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const calendarDay = (date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date(date));

const fromIst = (ymd, time = '00:00', second = 0, ms = 0) => {
  const [year, month, day] = String(ymd).split('-').map(Number);
  const [hours, minutes] = String(time).split(':').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, second, ms) - IST_OFFSET_MS);
};

const slotDateTime = (item) => fromIst(calendarDay(item.date), item.time || '09:00');
const endOfDay = (date) => fromIst(calendarDay(date), '23:59', 59, 999);

module.exports = { calendarDay, fromIst, slotDateTime, endOfDay };
