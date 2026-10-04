// models/Module.js - Updated with ModuleTest fields
const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema({
  name: {
    english: {
      type: String,
      required: true,
      trim: true
    },
    hindi: {
      type: String,
      required: true,
      trim: true
    }
  },
  image: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: 'bi-book'
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Directory structure fields
  type: {
    type: String,
    enum: ['module', 'folder', 'file'],
    default: 'module'
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    default: null
  },
  fullPath: {
    type: String,
    default: ''
  },
  // For files only
  fileLink: {
    type: String,
    default: null
  },
  fileDescription: {
    type: String,
    default: ''
  },
  fileType: {
    type: String,
    enum: ['pdf', 'image', 'video', 'audio', 'document', 'other'],
    default: 'other'
  },
  // Quiz integration fields
  // quizId: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'Quiz',
  //   default: null
  // },
  // hasQuiz: {
  //   type: Boolean,
  //   default: false
  // },
  // quizSettings: {
  //   passingScore: { type: Number, default: 70 },
  //   timeLimit: { type: Number, default: null },
  //   allowRetake: { type: Boolean, default: false },
  //   maxAttempts: { type: Number, default: 1 },
  //   showResults: { type: Boolean, default: true }
  // },
  // ModuleTest integration fields
  moduleTestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ModuleTest',
    default: null
  },
  hasModuleTest: {
    type: Boolean,
    default: false
  },
  moduleTestSettings: {
    passingScore: { type: Number, default: 70 },
    timeLimit: { type: Number, default: null },
    allowRetake: { type: Boolean, default: false },
    maxAttempts: { type: Number, default: 1 },
    showResults: { type: Boolean, default: true }
  }
}, {
  timestamps: true
});

// Pre-save middleware to generate fullPath
moduleSchema.pre('save', async function(next) {
  try {
    if (this.isNew || this.isModified('name') || this.isModified('parent')) {
      if (this.parent) {
        const parentItem = await this.constructor.findById(this.parent);
        if (!parentItem) {
          throw new Error('Parent item not found');
        }
        this.fullPath = `${parentItem.fullPath}/${this.name.english}`;
      } else {
        this.fullPath = this.name.english;
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Method to delete resource and all children
moduleSchema.statics.deleteRecursive = async function(resourceId) {
  const resource = await this.findById(resourceId);
  if (!resource) return null;

  const children = await this.find({ parent: resourceId });
  
  for (const child of children) {
    await this.deleteRecursive(child._id);
  }

  await this.findByIdAndDelete(resourceId);
  
  return resource;
};

// Indexes
moduleSchema.index({ order: 1, createdAt: -1 });
moduleSchema.index({ parent: 1 });
moduleSchema.index({ createdBy: 1 });
moduleSchema.index({ type: 1 });
moduleSchema.index({ fullPath: 1 });
moduleSchema.index({ hasQuiz: 1, quizId: 1 });
moduleSchema.index({ hasModuleTest: 1, moduleTestId: 1 });
moduleSchema.index({ parent: 1, type: 1 });

module.exports = mongoose.model('Module', moduleSchema);