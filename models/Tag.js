const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    lowercase: true
  },
  subCategory: {
    type: String,
    required: [true, 'Sub-category is required'],
    trim: true,
    lowercase: true
  },
  topic: {
    type: String,
    required: [true, 'Topic is required'],
    trim: true,
    lowercase: true
  },
  tag: {
    type: String,
    unique: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Generate tag (full path) before saving
tagSchema.pre('save', function(next) {
  this.tag = `${this.category}/${this.subCategory}/${this.topic}`;
  next();
});

// Update tag before updating
tagSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.category || update.subCategory || update.topic) {
    const category = update.category || this._conditions.category;
    const subCategory = update.subCategory || this._conditions.subCategory;
    const topic = update.topic || this._conditions.topic;
    update.tag = `${category}/${subCategory}/${topic}`;
  }
  next();
});

module.exports = mongoose.model('Tag', tagSchema);