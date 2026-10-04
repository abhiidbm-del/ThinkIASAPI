const mongoose = require('mongoose');

const freeResourceSchema = new mongoose.Schema({
  // English name (required for all items)
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  
  // Hindi name (only for modules, optional)
  nameHi: {
    type: String,
    default: ''
  },
  
  // Directory structure type
  type: {
    type: String,
    enum: ['module', 'folder', 'file'],
    required: true,
    default: 'module'
  },
  
  // Path tracking
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
    ref: 'FreeResource',
    default: null
  },
  
  // For files only
  fileLink: {
    type: String,
    default: null
  },
  fileDescription: {  // ADD THIS FIELD
    type: String,
    default: ''
  },
  fileType: {
    type: String,
    enum: ['pdf', 'image', 'video', 'audio', 'document', 'other'],
    default: 'other'
  },
  
  // Admin tracking
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
    order: {
    type: Number,
    default: 0
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for children
freeResourceSchema.virtual('children', {
  ref: 'FreeResource',
  localField: '_id',
  foreignField: 'parent'
});

// Indexes
freeResourceSchema.index({ order: 1, createdAt: -1 });
freeResourceSchema.index({ parent: 1 });
freeResourceSchema.index({ createdBy: 1 });
freeResourceSchema.index({ fullPath: 1, createdBy: 1 }, { unique: true });
freeResourceSchema.index({ name: 'text', nameHi: 'text' });
freeResourceSchema.index({ type: 1 });

// Pre-save middleware to generate fullPath
freeResourceSchema.pre('save', async function(next) {
  try {
    if (this.isNew || this.isModified('name') || this.isModified('parent')) {
      if (this.parent) {
        const parentItem = await this.constructor.findById(this.parent);
        if (!parentItem) {
          throw new Error('Parent item not found');
        }
        this.fullPath = `${parentItem.fullPath}/${this.name}`;
        this.path = parentItem.fullPath;
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

freeResourceSchema.statics.getAllModules = async function(userId) {
  return await this.find({
    type: 'module',
    parent: null,
    createdBy: userId
  }).sort({ createdAt: -1 });
};

// Pre-save validation for files
freeResourceSchema.pre('save', function(next) {
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

// Method to delete resource and all children
freeResourceSchema.statics.deleteRecursive = async function(resourceId) {
  const resource = await this.findById(resourceId);
  if (!resource) return null;

  // Get all children
  const children = await this.find({ parent: resourceId });
  
  // Recursively delete children
  for (const child of children) {
    await this.deleteRecursive(child._id);
  }

  // Delete the resource itself
  await this.findByIdAndDelete(resourceId);
  
  return resource;
};

// Method to check if path exists
freeResourceSchema.statics.pathExists = async function(fullPath, createdBy) {
  return await this.findOne({ fullPath, createdBy });
};

// Method to get all modules
freeResourceSchema.statics.getAllModules = async function(createdBy) {
  return await this.find({
    type: 'module',
    parent: null,
    createdBy: createdBy
  }).sort({ name: 1 });
};

// Method to get directory tree
freeResourceSchema.statics.getDirectoryTree = async function(parentId, createdBy) {
  const query = {
    createdBy: createdBy
  };
  
  if (parentId) {
    query.parent = parentId;
  } else {
    query.parent = null;
  }
  
  return await this.find(query).sort({ type: 1, name: 1 });
};

module.exports = mongoose.model('FreeResource', freeResourceSchema);