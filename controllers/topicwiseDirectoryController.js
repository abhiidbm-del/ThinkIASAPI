const TopicwiseDirectory = require('../models/TopicwiseDirectory');

// Create folder for a specific category
const createFolder = async (req, res) => {
  try {
    const { category, name, parentId } = req.body;
    const userId = req.user._id;

    if (!category || !name) {
      return res.status(400).json({ 
        message: 'Category and name are required' 
      });
    }

    const validCategories = [
      'gs1-analysis', 'gs2-analysis', 'gs3-analysis', 
      'gs4-analysis', 'essay-analysis', 'optional-subjects'
    ];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        message: 'Invalid category' 
      });
    }

    if (name.includes('/') || name.includes('\\')) {
      return res.status(400).json({ 
        message: 'Folder name cannot contain / or \\' 
      });
    }

    let parent = null;
    let parentPath = '';

    if (parentId) {
      parent = await TopicwiseDirectory.findById(parentId);
      if (!parent) {
        return res.status(404).json({ 
          message: 'Parent folder not found' 
        });
      }
      
      if (parent.createdBy.toString() !== userId.toString()) {
        return res.status(403).json({ 
          message: 'Access denied' 
        });
      }
      
      if (parent.category !== category) {
        return res.status(400).json({ 
          message: 'Parent folder belongs to different category' 
        });
      }
      
      parentPath = parent.fullPath;
    }

    const fullPath = parentId ? `${parentPath}/${name}` : name;

    // Check if folder already exists
    const existingFolder = await TopicwiseDirectory.pathExists(category, fullPath, userId);
    if (existingFolder) {
      return res.status(409).json({ 
        message: 'Folder already exists' 
      });
    }

    // Create new folder
    const folder = await TopicwiseDirectory.create({
      name,
      type: 'folder',
      category,
      path: parentPath,
      fullPath,
      parent: parentId,
      createdBy: userId
    });

    res.status(201).json({
      message: 'Folder created successfully',
      folder
    });

  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ 
      message: 'Failed to create folder',
      error: error.message 
    });
  }
};

// Create file (with link)
const createFile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { category, name, parentId, fileLink, description } = req.body;

    if (!category || !name || !fileLink) {
      return res.status(400).json({ 
        message: 'Category, name and file link are required' 
      });
    }

    const validCategories = [
      'gs1-analysis', 'gs2-analysis', 'gs3-analysis', 
      'gs4-analysis', 'essay-analysis', 'optional-subjects'
    ];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        message: 'Invalid category' 
      });
    }

    if (name.includes('/') || name.includes('\\')) {
      return res.status(400).json({ 
        message: 'File name cannot contain / or \\' 
      });
    }

    let parent = null;
    let parentPath = '';

    if (parentId) {
      parent = await TopicwiseDirectory.findById(parentId);
      if (!parent) {
        return res.status(404).json({ 
          message: 'Parent folder not found' 
        });
      }
      
      if (parent.createdBy.toString() !== userId.toString()) {
        return res.status(403).json({ 
          message: 'Access denied' 
        });
      }
      
      if (parent.category !== category) {
        return res.status(400).json({ 
          message: 'Parent folder belongs to different category' 
        });
      }
      
      parentPath = parent.fullPath;
    }

    const fullPath = parentId ? `${parentPath}/${name}` : name;

    // Check if file already exists
    const existingFile = await TopicwiseDirectory.pathExists(category, fullPath, userId);
    if (existingFile) {
      return res.status(409).json({ 
        message: 'File already exists' 
      });
    }

    // Determine file type
    let fileType = 'other';
    const fileNameLower = name.toLowerCase();
    const fileLinkLower = fileLink.toLowerCase();
    
    if (fileNameLower.endsWith('.pdf') || fileLinkLower.endsWith('.pdf')) {
      fileType = 'pdf';
    } else if (fileNameLower.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/) || 
               fileLinkLower.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)) {
      fileType = 'image';
    } else if (fileNameLower.match(/\.(mp4|avi|mov|wmv|flv|webm)$/) || 
               fileLinkLower.match(/\.(mp4|avi|mov|wmv|flv|webm)$/)) {
      fileType = 'video';
    } else if (fileNameLower.match(/\.(mp3|wav|ogg|flac)$/) || 
               fileLinkLower.match(/\.(mp3|wav|ogg|flac)$/)) {
      fileType = 'audio';
    } else if (fileNameLower.match(/\.(doc|docx|xls|xlsx|ppt|pptx|txt)$/) || 
               fileLinkLower.match(/\.(doc|docx|xls|xlsx|ppt|pptx|txt)$/)) {
      fileType = 'document';
    }

    // Create file
    const directoryFile = await TopicwiseDirectory.create({
      name,
      type: 'file',
      category,
      path: parentPath,
      fullPath: fullPath,
      parent: parentId,
      fileLink,
      description: description || '',
      fileType,
      createdBy: userId
    });

    res.status(201).json({
      message: 'File created successfully',
      file: directoryFile
    });

  } catch (error) {
    console.error('Create file error:', error);
    res.status(500).json({ 
      message: 'Failed to create file',
      error: error.message 
    });
  }
};

// Get directory tree for a category
const getDirectoryTree = async (req, res) => {
  try {
    const userId = req.user._id;
    const { category } = req.params;
    const { parentId } = req.query;

    const validCategories = [
      'gs1-analysis', 'gs2-analysis', 'gs3-analysis', 
      'gs4-analysis', 'essay-analysis', 'optional-subjects'
    ];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        message: 'Invalid category' 
      });
    }

    const items = await TopicwiseDirectory.getTreeByCategory(category, parentId, userId);

    res.json({
      message: 'Directory tree retrieved successfully',
      items
    });

  } catch (error) {
    console.error('Get directory tree error:', error);
    res.status(500).json({ 
      message: 'Failed to get directory tree',
      error: error.message 
    });
  }
};

// Update file
const updateFile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { name, fileLink, description } = req.body;

    const file = await TopicwiseDirectory.findOne({
      _id: id,
      type: 'file',
      createdBy: userId
    });

    if (!file) {
      return res.status(404).json({ 
        message: 'File not found' 
      });
    }

    if (name && name !== file.name) {
      if (name.includes('/') || name.includes('\\')) {
        return res.status(400).json({ 
          message: 'File name cannot contain / or \\' 
        });
      }
      
      const siblingExists = await TopicwiseDirectory.findOne({
        parent: file.parent,
        name: name,
        category: file.category,
        createdBy: userId,
        _id: { $ne: id }
      });

      if (siblingExists) {
        return res.status(409).json({ 
          message: 'A file with this name already exists in the same location' 
        });
      }
      
      file.name = name;
    }

    if (fileLink) {
      file.fileLink = fileLink;
    }

    if (description !== undefined) {
      file.description = description;
    }

    if (fileLink) {
      const fileLinkLower = fileLink.toLowerCase();
      let fileType = 'other';
      
      if (fileLinkLower.endsWith('.pdf')) {
        fileType = 'pdf';
      } else if (fileLinkLower.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)) {
        fileType = 'image';
      } else if (fileLinkLower.match(/\.(mp4|avi|mov|wmv|flv|webm)$/)) {
        fileType = 'video';
      } else if (fileLinkLower.match(/\.(mp3|wav|ogg|flac)$/)) {
        fileType = 'audio';
      } else if (fileLinkLower.match(/\.(doc|docx|xls|xlsx|ppt|pptx|txt)$/)) {
        fileType = 'document';
      }
      
      file.fileType = fileType;
    }

    await file.save();

    res.json({
      message: 'File updated successfully',
      file
    });

  } catch (error) {
    console.error('Update file error:', error);
    res.status(500).json({ 
      message: 'Failed to update file',
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
        message: 'New name is required' 
      });
    }

    if (newName.includes('/') || newName.includes('\\')) {
      return res.status(400).json({ 
        message: 'Name cannot contain / or \\' 
      });
    }

    const item = await TopicwiseDirectory.findOne({
      _id: id,
      createdBy: userId
    });

    if (!item) {
      return res.status(404).json({ 
        message: 'Item not found' 
      });
    }

    const siblingExists = await TopicwiseDirectory.findOne({
      parent: item.parent,
      name: newName,
      category: item.category,
      createdBy: userId,
      _id: { $ne: id }
    });

    if (siblingExists) {
      return res.status(409).json({ 
        message: 'An item with this name already exists in the same location' 
      });
    }

    const oldName = item.name;
    item.name = newName;
    await item.save();

    res.json({
      message: 'Renamed successfully',
      oldName,
      newName,
      item
    });

  } catch (error) {
    console.error('Rename item error:', error);
    res.status(500).json({ 
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

    const item = await TopicwiseDirectory.findOne({
      _id: id,
      createdBy: userId
    });

    if (!item) {
      return res.status(404).json({ 
        message: 'Item not found' 
      });
    }

    await TopicwiseDirectory.deleteRecursive(id);

    res.json({
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
      message: 'Failed to delete item',
      error: error.message 
    });
  }
};

// Updated getPublicDirectoryTree method
const getPublicDirectoryTree = async (req, res) => {
  try {
    const { category } = req.params;
    const { parentId } = req.query;

    const validCategories = [
      'gs1-analysis', 'gs2-analysis', 'gs3-analysis', 
      'gs4-analysis', 'essay-analysis', 'optional-subjects'
    ];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid category' 
      });
    }

    // Use the model method
    const tree = await TopicwiseDirectory.getPublicTreeByCategory(category, parentId);

    res.json({
      success: true,
      message: 'Public directory tree retrieved successfully',
      category,
      tree,
      itemCount: tree.length
    });

  } catch (error) {
    console.error('Get public directory tree error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get public directory tree',
      error: error.message 
    });
  }
};

module.exports = {
  createFolder,
  createFile,
  getDirectoryTree,
  updateFile,
  renameItem,
  deleteItem,
  getPublicDirectoryTree
};