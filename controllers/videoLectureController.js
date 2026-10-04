const VideoLecture = require('../models/VideoLecture');

// Create folder for a specific category
const createFolder = async (req, res) => {
  try {
    const { category, name, parentId } = req.body;
    const userId = req.user._id;

    if (!category || !name) {
      return res.status(400).json({ 
        success: false,
        message: 'Category and name are required' 
      });
    }

    const validCategories = [
      'gs1-videos', 'gs2-videos', 'gs3-videos', 
      'gs4-videos', 'essay-videos', 'strategy-sessions',
      'current-affairs', 'mock-interviews'
    ];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid category' 
      });
    }

    if (name.includes('/') || name.includes('\\')) {
      return res.status(400).json({ 
        success: false,
        message: 'Folder name cannot contain / or \\' 
      });
    }

    let parent = null;
    let parentPath = '';

    if (parentId) {
      parent = await VideoLecture.findById(parentId);
      if (!parent) {
        return res.status(404).json({ 
          success: false,
          message: 'Parent folder not found' 
        });
      }
      
      if (parent.createdBy.toString() !== userId.toString()) {
        return res.status(403).json({ 
          success: false,
          message: 'Access denied' 
        });
      }
      
      if (parent.category !== category) {
        return res.status(400).json({ 
          success: false,
          message: 'Parent folder belongs to different category' 
        });
      }
      
      parentPath = parent.fullPath;
    }

    const fullPath = parentId ? `${parentPath}/${name}` : name;

    // Check if folder already exists
    const existingFolder = await VideoLecture.pathExists(category, fullPath, userId);
    if (existingFolder) {
      return res.status(409).json({ 
        success: false,
        message: 'Folder already exists' 
      });
    }

    // Create new folder
    const folder = await VideoLecture.create({
      name,
      type: 'folder',
      category,
      path: parentPath,
      fullPath,
      parent: parentId,
      createdBy: userId
    });

    res.status(201).json({
      success: true,
      message: 'Folder created successfully',
      folder
    });

  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create folder',
      error: error.message 
    });
  }
};

// Create video file
const createVideo = async (req, res) => {
  try {
    const userId = req.user._id;
    const { category, name, parentId, fileLink, description, duration, thumbnail } = req.body;

    if (!category || !name || !fileLink) {
      return res.status(400).json({ 
        success: false,
        message: 'Category, name and video link are required' 
      });
    }

    const validCategories = [
      'gs1-videos', 'gs2-videos', 'gs3-videos', 
      'gs4-videos', 'essay-videos', 'strategy-sessions',
      'current-affairs', 'mock-interviews'
    ];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid category' 
      });
    }

    if (name.includes('/') || name.includes('\\')) {
      return res.status(400).json({ 
        success: false,
        message: 'Video name cannot contain / or \\' 
      });
    }

    let parent = null;
    let parentPath = '';

    if (parentId) {
      parent = await VideoLecture.findById(parentId);
      if (!parent) {
        return res.status(404).json({ 
          success: false,
          message: 'Parent folder not found' 
        });
      }
      
      if (parent.createdBy.toString() !== userId.toString()) {
        return res.status(403).json({ 
          success: false,
          message: 'Access denied' 
        });
      }
      
      if (parent.category !== category) {
        return res.status(400).json({ 
          success: false,
          message: 'Parent folder belongs to different category' 
        });
      }
      
      parentPath = parent.fullPath;
    }

    const fullPath = parentId ? `${parentPath}/${name}` : name;

    // Check if video already exists
    const existingVideo = await VideoLecture.pathExists(category, fullPath, userId);
    if (existingVideo) {
      return res.status(409).json({ 
        success: false,
        message: 'Video already exists' 
      });
    }

    // Determine video type based on link
    let fileType = 'video';
    const fileLinkLower = fileLink.toLowerCase();
    
    if (fileLinkLower.includes('youtube.com') || fileLinkLower.includes('youtu.be')) {
      fileType = 'youtube';
    } else if (fileLinkLower.includes('vimeo.com')) {
      fileType = 'vimeo';
    } else if (fileLinkLower.includes('drive.google.com')) {
      fileType = 'drive';
    } else if (fileLinkLower.endsWith('.mp4') || fileLinkLower.endsWith('.avi') || 
               fileLinkLower.endsWith('.mov') || fileLinkLower.endsWith('.wmv')) {
      fileType = 'video';
    }

    // Create video
    const video = await VideoLecture.create({
      name,
      type: 'file',
      category,
      path: parentPath,
      fullPath: fullPath,
      parent: parentId,
      fileLink,
      description: description || '',
      duration: duration || '',
      thumbnail: thumbnail || '',
      fileType,
      createdBy: userId
    });

    res.status(201).json({
      success: true,
      message: 'Video created successfully',
      video
    });

  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create video',
      error: error.message 
    });
  }
};

// Get directory tree for a category (admin)
const getDirectoryTree = async (req, res) => {
  try {
    const userId = req.user._id;
    const { category } = req.params;
    const { parentId } = req.query;

    const validCategories = [
      'gs1-videos', 'gs2-videos', 'gs3-videos', 
      'gs4-videos', 'essay-videos', 'strategy-sessions',
      'current-affairs', 'mock-interviews'
    ];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid category' 
      });
    }

    const items = await VideoLecture.getTreeByCategory(category, parentId, userId);

    res.json({
      success: true,
      message: 'Video directory tree retrieved successfully',
      items
    });

  } catch (error) {
    console.error('Get directory tree error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get video directory tree',
      error: error.message 
    });
  }
};

// Update video
const updateVideo = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { name, fileLink, description, duration, thumbnail } = req.body;

    const video = await VideoLecture.findOne({
      _id: id,
      type: 'file',
      createdBy: userId
    });

    if (!video) {
      return res.status(404).json({ 
        success: false,
        message: 'Video not found' 
      });
    }

    if (name && name !== video.name) {
      if (name.includes('/') || name.includes('\\')) {
        return res.status(400).json({ 
          success: false,
          message: 'Video name cannot contain / or \\' 
        });
      }
      
      const siblingExists = await VideoLecture.findOne({
        parent: video.parent,
        name: name,
        category: video.category,
        createdBy: userId,
        _id: { $ne: id }
      });

      if (siblingExists) {
        return res.status(409).json({ 
          success: false,
          message: 'A video with this name already exists in the same location' 
        });
      }
      
      video.name = name;
    }

    if (fileLink) {
      video.fileLink = fileLink;
      
      // Update file type based on new link
      const fileLinkLower = fileLink.toLowerCase();
      if (fileLinkLower.includes('youtube.com') || fileLinkLower.includes('youtu.be')) {
        video.fileType = 'youtube';
      } else if (fileLinkLower.includes('vimeo.com')) {
        video.fileType = 'vimeo';
      } else if (fileLinkLower.includes('drive.google.com')) {
        video.fileType = 'drive';
      } else if (fileLinkLower.endsWith('.mp4') || fileLinkLower.endsWith('.avi') || 
                 fileLinkLower.endsWith('.mov') || fileLinkLower.endsWith('.wmv')) {
        video.fileType = 'video';
      } else {
        video.fileType = 'other';
      }
    }

    if (description !== undefined) {
      video.description = description;
    }

    if (duration !== undefined) {
      video.duration = duration;
    }

    if (thumbnail !== undefined) {
      video.thumbnail = thumbnail;
    }

    await video.save();

    res.json({
      success: true,
      message: 'Video updated successfully',
      video
    });

  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update video',
      error: error.message 
    });
  }
};

// Rename item
const renameItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName) {
      return res.status(400).json({ 
        success: false,
        message: 'New name is required' 
      });
    }

    if (newName.includes('/') || newName.includes('\\')) {
      return res.status(400).json({ 
        success: false,
        message: 'Name cannot contain / or \\' 
      });
    }

    const item = await VideoLecture.findOne({
      _id: id,
      createdBy: userId
    });

    if (!item) {
      return res.status(404).json({ 
        success: false,
        message: 'Item not found' 
      });
    }

    const siblingExists = await VideoLecture.findOne({
      parent: item.parent,
      name: newName,
      category: item.category,
      createdBy: userId,
      _id: { $ne: id }
    });

    if (siblingExists) {
      return res.status(409).json({ 
        success: false,
        message: 'An item with this name already exists in the same location' 
      });
    }

    const oldName = item.name;
    item.name = newName;
    await item.save();

    res.json({
      success: true,
      message: 'Renamed successfully',
      oldName,
      newName,
      item
    });

  } catch (error) {
    console.error('Rename item error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to rename item',
      error: error.message 
    });
  }
};

// Delete item
const deleteItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const item = await VideoLecture.findOne({
      _id: id,
      createdBy: userId
    });

    if (!item) {
      return res.status(404).json({ 
        success: false,
        message: 'Item not found' 
      });
    }

    await VideoLecture.deleteRecursive(id);

    res.json({
      success: true,
      message: 'Deleted successfully',
      item: {
        _id: item._id,
        name: item.name,
        type: item.type
      }
    });

  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete item',
      error: error.message 
    });
  }
};

// Get public directory tree
const getPublicDirectoryTree = async (req, res) => {
  try {
    const { category } = req.params;
    const { parentId } = req.query;

    const validCategories = [
      'gs1-videos', 'gs2-videos', 'gs3-videos', 
      'gs4-videos', 'essay-videos', 'strategy-sessions',
      'current-affairs', 'mock-interviews'
    ];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid category' 
      });
    }

    const tree = await VideoLecture.getPublicTreeByCategory(category, parentId);

    res.json({
      success: true,
      message: 'Public video directory tree retrieved successfully',
      category,
      tree,
      itemCount: tree.length
    });

  } catch (error) {
    console.error('Get public directory tree error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get public video directory tree',
      error: error.message 
    });
  }
};

// Get all video categories (for dropdowns)
const getVideoCategories = async (req, res) => {
  try {
    const categories = [
      { value: 'gs1-videos', label: 'GS Papers 1 Videos' },
      { value: 'gs2-videos', label: 'GS Papers 2 Videos' },
      { value: 'gs3-videos', label: 'GS Papers 3 Videos' },
      { value: 'gs4-videos', label: 'GS Papers 4 Videos' },
      { value: 'essay-videos', label: 'Essay Writing Videos' },
      { value: 'strategy-sessions', label: 'Strategy Sessions' },
      { value: 'current-affairs', label: 'Current Affairs' },
      { value: 'mock-interviews', label: 'Mock Interviews' }
    ];

    res.json({
      success: true,
      message: 'Video categories retrieved successfully',
      categories
    });

  } catch (error) {
    console.error('Get video categories error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get video categories',
      error: error.message 
    });
  }
};

module.exports = {
  createFolder,
  createVideo,
  getDirectoryTree,
  updateVideo,
  renameItem,
  deleteItem,
  getPublicDirectoryTree,
  getVideoCategories
};