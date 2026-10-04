const fs = require('fs').promises;
const path = require('path');

const logsDirectory = path.join(__dirname, '../logs');

const ensureDirectoryExists = async () => {
  try {
    await fs.mkdir(logsDirectory, { recursive: true });
  } catch (err) {
    console.error('Failed to create logs directory:', err);
  }
};

const logMessage = async (level, message, meta = {}) => {
  try {
    await ensureDirectoryExists();
    const currentDate = new Date().toISOString().slice(0, 10);
    const logFilePath = path.join(logsDirectory, `app-${currentDate}.log`);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta
    };
    
    await fs.appendFile(logFilePath, JSON.stringify(logEntry) + '\n');
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
};

const requestLogger = (req, res, next) => {
  const startTime = process.hrtime();
  const originalSend = res.send;

  res.send = function (body) {
    res.responseBody = body;
    return originalSend.apply(res, arguments);
  };

  res.on('finish', async () => {
    const [sec, nanosec] = process.hrtime(startTime);
    const durationMs = (sec * 1000 + nanosec / 1e6).toFixed(3);

    const log = {
      method: req.method,
      url: req.url,
      ip: req.ip,
      status: res.statusCode,
      duration: `${durationMs}ms`,
      userAgent: req.get('User-Agent'),
      userId: req.user?._id
    };

    await logMessage('info', 'HTTP Request', log);
  });

  next();
};

module.exports = { logMessage, requestLogger };