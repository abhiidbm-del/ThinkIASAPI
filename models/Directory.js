const mongoose = require('mongoose');

const directorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Directory name is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['folder', 'file'],
    required: true,
    default: 'folder'
  },
  path: {
    type: String,
    default: ''
  },
  fullPath: {
    type: String,
    required: true,
    index: true
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Directory',
    default: null
  },
  
  // For files only - using links instead of file content
  fileLink: {
    type: String,
    default: null,
    validate: {
      validator: function(v) {
        // Only validate for files, not folders
        if (this.type === 'folder') return true;
        return v && v.length > 0;
      },
      message: 'File link is required for files'
    }
  },
  description: {
    type: String,
    default: ''
  },
  fileType: {
    type: String,
    enum: ['pdf', 'image', 'video', 'audio', 'document', 'other'],
    default: 'other'
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Virtual for children
directorySchema.virtual('children', {
  ref: 'Directory',
  localField: '_id',
  foreignField: 'parent'
});

// Ensure virtuals are included
directorySchema.set('toJSON', { virtuals: true });
directorySchema.set('toObject', { virtuals: true });

// Indexes
directorySchema.index({ parent: 1 });
directorySchema.index({ createdBy: 1 });
directorySchema.index({ fullPath: 1, createdBy: 1 }, { unique: true });
directorySchema.index({ fileType: 1 });
directorySchema.index({ name: 'text', description: 'text' });

// Pre-save middleware to generate fullPath
directorySchema.pre('save', async function(next) {
  try {
    if (this.isNew || this.isModified('name') || this.isModified('parent')) {
      if (this.parent) {
        const parentDir = await this.constructor.findById(this.parent);
        if (!parentDir) {
          throw new Error('Parent directory not found');
        }
        this.fullPath = `${parentDir.fullPath}/${this.name}`;
        this.path = parentDir.fullPath;
      } else {
        this.fullPath = this.name;
        this.path = '';
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save validation for files
directorySchema.pre('save', function(next) {
  if (this.type === 'file' && !this.fileLink) {
    const err = new mongoose.Error.ValidationError(this);
    err.errors.fileLink = new mongoose.Error.ValidatorError({
      message: 'File link is required for files',
      path: 'fileLink',
      value: this.fileLink
    });
    return next(err);
  }
  next();
});

// Method to delete directory and all children
directorySchema.statics.deleteRecursive = async function(directoryId) {
  const dir = await this.findById(directoryId);
  if (!dir) return null;

  // Get all children
  const children = await this.find({ parent: directoryId });
  
  // Recursively delete children
  for (const child of children) {
    await this.deleteRecursive(child._id);
  }

  // Delete the directory itself
  await this.findByIdAndDelete(directoryId);
  
  return dir;
};

// Method to check if path exists
directorySchema.statics.pathExists = async function(fullPath, userId) {
  return await this.findOne({ fullPath, createdBy: userId });
};

// Method to get all files of a specific type for a user
directorySchema.statics.getFilesByType = async function(userId, fileType) {
  return await this.find({
    createdBy: userId,
    type: 'file',
    fileType: fileType
  }).sort({ name: 1 });
};

// Method to search files by name or description
directorySchema.statics.searchFiles = async function(userId, searchQuery) {
  return await this.find({
    createdBy: userId,
    type: 'file',
    $or: [
      { name: { $regex: searchQuery, $options: 'i' } },
      { description: { $regex: searchQuery, $options: 'i' } }
    ]
  }).sort({ name: 1 });
};

module.exports = mongoose.model('Directory', directorySchema);