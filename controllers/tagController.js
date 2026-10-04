const Tag = require('../models/Tag');
const { handleError } = require('../middleware/errorHandler');

// Create new tag
const createTag = async (req, res) => {
  try {
    const { category, subCategory, topic } = req.body;
    
    // Generate tag path
    const tagPath = `${category.toLowerCase()}/${subCategory.toLowerCase()}/${topic.toLowerCase()}`;
    
    // Check if tag already exists
    const existingTag = await Tag.findOne({ tag: tagPath });
    if (existingTag) {
      return res.status(400).json({
        message: 'Tag already exists'
      });
    }

    const tag = new Tag({
      category: category.toLowerCase(),
      subCategory: subCategory.toLowerCase(),
      topic: topic.toLowerCase(),
      createdBy: req.user._id
    });

    await tag.save();

    res.status(201).json({
      message: 'Tag created successfully',
      tag: {
        _id: tag._id,
        category: tag.category,
        subCategory: tag.subCategory,
        topic: tag.topic,
        tag: tag.tag
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'Tag already exists'
      });
    }
    handleError(res, error, 'Failed to create tag');
  }
};

// Get all tags
const getTags = async (req, res) => {
  try {
    const tags = await Tag.find()
      .select('_id category subCategory topic tag')
      .sort({ category: 1, subCategory: 1, topic: 1 });

    res.json(tags);
  } catch (error) {
    handleError(res, error, 'Failed to fetch tags');
  }
};

// Get unique categories
const getCategories = async (req, res) => {
  try {
    const categories = await Tag.distinct('category');
    res.json(categories.sort());
  } catch (error) {
    handleError(res, error, 'Failed to fetch categories');
  }
};

// Update tag
const updateTag = async (req, res) => {
  try {
    const { category, subCategory, topic } = req.body;
    
    // Generate new tag path
    const newTagPath = `${category.toLowerCase()}/${subCategory.toLowerCase()}/${topic.toLowerCase()}`;
    
    // Check if new path conflicts with existing tag
    const existingTag = await Tag.findOne({ 
      tag: newTagPath,
      _id: { $ne: req.params.id }
    });
    
    if (existingTag) {
      return res.status(400).json({
        message: 'Tag with this path already exists'
      });
    }

    const tag = await Tag.findByIdAndUpdate(
      req.params.id,
      { 
        category: category.toLowerCase(),
        subCategory: subCategory.toLowerCase(),
        topic: topic.toLowerCase()
      },
      { new: true, runValidators: true }
    ).select('_id category subCategory topic tag');

    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    res.json({
      message: 'Tag updated successfully',
      tag
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'Tag already exists'
      });
    }
    handleError(res, error, 'Failed to update tag');
  }
};

// Delete tag
const deleteTag = async (req, res) => {
  try {
    const tag = await Tag.findByIdAndDelete(req.params.id);

    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    res.json({
      message: 'Tag deleted successfully'
    });
  } catch (error) {
    handleError(res, error, 'Failed to delete tag');
  }
};

module.exports = {
  createTag,
  getTags,
  getCategories,
  updateTag,
  deleteTag
};