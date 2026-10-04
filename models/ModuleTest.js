// models/ModuleTest.js
const mongoose = require('mongoose');

const moduleTestSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  questionUids: [{
    type: String,
    required: true
  }],
  isActive: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Add moduleId field
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    default: null
  },
  // Add passingScore and timeLimit fields
  passingScore: {
    type: Number,
    default: 70
  },
  timeLimit: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
moduleTestSchema.index({ isActive: 1 });
moduleTestSchema.index({ createdBy: 1 });
moduleTestSchema.index({ moduleId: 1 });

module.exports = mongoose.model('ModuleTest', moduleTestSchema);