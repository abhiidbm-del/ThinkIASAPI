const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URL;
  if (!uri) {
    console.error('MONGO_URL is missing in .env');
    return;
  }

  const tryConnect = async () => {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
      console.log('MongoDB Atlas Connected');
    } catch (error) {
      console.error('MongoDB Connection Failed:', error.message);
      console.error('Add this PC IP in Atlas → Network Access (or 0.0.0.0/0 for dev). API will retry in 15s.');
      setTimeout(tryConnect, 15000);
    }
  };

  await tryConnect();
};

module.exports = connectDB;
