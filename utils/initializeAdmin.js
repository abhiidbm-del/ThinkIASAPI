const mongoose = require('mongoose');
const User = require('../models/User');

const initializeAdmin = async () => {
  try {
    // Check if MongoDB is connected properly
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB not connected. Skipping admin initialization.');
      return;
    }

    const adminExists = await User.findOne({ email: 'admin@gmail.com' });
    
    if (!adminExists) {
      const admin = new User({
        fullName: 'Administrator',
        email: 'admin@gmail.com',
        phone: '0000000000',
        password: 'Admin@12345',
        role: 'admin'
        // No type field for admin
      });
      await admin.save();
      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
      
      // Update existing admin to remove type field if it exists
      if (adminExists.type) {
        adminExists.type = undefined;
        await adminExists.save();
        console.log('Admin user updated - type field removed');
      }
    }
  } catch (error) {
    console.log('Admin initialization skipped - MongoDB not available');
  }
};

module.exports = initializeAdmin;