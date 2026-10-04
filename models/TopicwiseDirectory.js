const mongoose = require('mongoose');

const topicwiseDirectorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['folder', 'file'],
    required: true,
    default: 'folder'
  },
  category: {
    type: String,
    required: true,
    enum: [
      'gs1-analysis', 
      'gs2-analysis', 
      'gs3-analysis', 
      'gs4-analysis', 
      'essay-analysis', 
      'optional-subjects'
    ],
    index: true
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
    ref: 'TopicwiseDirectory',
    default: null
  },
  
  // For files only
  fileLink: {
    type: String,
    default: null,
    validate: {
      validator: function(v) {
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
topicwiseDirectorySchema.virtual('children', {
  ref: 'TopicwiseDirectory',
  localField: '_id',
  foreignField: 'parent'
});

// Ensure virtuals are included
topicwiseDirectorySchema.set('toJSON', { virtuals: true });
topicwiseDirectorySchema.set('toObject', { virtuals: true });

// Indexes
topicwiseDirectorySchema.index({ parent: 1 });
topicwiseDirectorySchema.index({ createdBy: 1 });
topicwiseDirectorySchema.index({ category: 1 });
topicwiseDirectorySchema.index({ fullPath: 1, createdBy: 1, category: 1 }, { unique: true });
topicwiseDirectorySchema.index({ fileType: 1 });

// Pre-save middleware to generate fullPath
topicwiseDirectorySchema.pre('save', async function(next) {
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
topicwiseDirectorySchema.pre('save', function(next) {
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
topicwiseDirectorySchema.statics.deleteRecursive = async function(directoryId) {
  const dir = await this.findById(directoryId);
  if (!dir) return null;

  const children = await this.find({ parent: directoryId });
  
  for (const child of children) {
    await this.deleteRecursive(child._id);
  }

  await this.findByIdAndDelete(directoryId);
  
  return dir;
};

// Method to check if path exists
topicwiseDirectorySchema.statics.pathExists = async function(category, fullPath, userId) {
  return await this.findOne({ category, fullPath, createdBy: userId });
};

// Method to get directory tree for a category
topicwiseDirectorySchema.statics.getTreeByCategory = async function(category, parentId, userId) {
  let query = { category, createdBy: userId };
  
  if (parentId) {
    query.parent = parentId;
  } else {
    query.parent = null;
  }
  
  return await this.find(query)
    .sort({ type: 1, name: 1 });
};

// Add this method to your existing TopicwiseDirectory model

// Get public tree by category
topicwiseDirectorySchema.statics.getPublicTreeByCategory = async function(category, parentId = null) {
  const query = { category };
  
  if (parentId) {
    query.parent = parentId;
  } else {
    // Root level items have parent as null or undefined
    query.$or = [
      { parent: null },
      { parent: { $exists: false } }
    ];
  }

  const items = await this.find(query)
    .select('name type category path fullPath parent fileLink description fileType')
    .sort({ type: 1, name: 1 }) // Sort folders first, then files
    .lean();

  return this.buildTree(items);
};

// Helper method to build tree (already exists, but ensure it's available)
topicwiseDirectorySchema.statics.buildTree = function(items) {
  const itemMap = {};
  const rootItems = [];

  items.forEach(item => {
    itemMap[item._id] = {
      ...item,
      children: []
    };
  });

  items.forEach(item => {
    if (item.parent && itemMap[item.parent]) {
      itemMap[item.parent].children.push(itemMap[item._id]);
    } else {
      rootItems.push(itemMap[item._id]);
    }
  });

  return rootItems;
};

module.exports = mongoose.model('TopicwiseDirectory', topicwiseDirectorySchema);