const Directory = require('../models/Directory');
const { normalizeMaterialLink } = require('../utils/materialLink');

// Create folder
const createFolder = async (req, res) => {
  try {
    const { name, parentId } = req.body;
    const userId = req.user._id;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ 
        message: 'Folder name is required' 
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
      parent = await Directory.findById(parentId);
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
      
      parentPath = parent.fullPath;
    }

    const fullPath = parentId ? `${parentPath}/${name}` : name;

    // Check if folder already exists
    const existingFolder = await Directory.pathExists(fullPath, userId);
    if (existingFolder) {
      return res.status(409).json({ 
        message: 'Folder already exists' 
      });
    }

    // Create new folder
    const folder = await Directory.create({
      name,
      type: 'folder',
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

// Create file (with link instead of file upload)
const createFile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, parentId, fileLink, description } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ 
        message: 'File name is required' 
      });
    }

    if (!fileLink || typeof fileLink !== 'string') {
      return res.status(400).json({ 
        message: 'File link is required' 
      });
    }

    let normalizedLink;
    try { normalizedLink = normalizeMaterialLink(fileLink); }
    catch (error) { return res.status(400).json({ message: error.message }); }

    if (name.includes('/') || name.includes('\\')) {
      return res.status(400).json({ 
        message: 'File name cannot contain / or \\' 
      });
    }

    let parent = null;
    let parentPath = '';

    if (parentId) {
      parent = await Directory.findById(parentId);
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
      
      parentPath = parent.fullPath;
    }

    const fullPath = parentId ? `${parentPath}/${name}` : name;

    // Check if file already exists
    const existingFile = await Directory.pathExists(fullPath, userId);
    if (existingFile) {
      return res.status(409).json({ 
        message: 'File already exists' 
      });
    }

    // Determine file type from file link or name
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

    // Create file in database with link
    const directoryFile = await Directory.create({
      name,
      type: 'file',
      path: parentPath,
      fullPath: fullPath,
      parent: parentId,
      fileLink: normalizedLink,
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

// Get all folders and files (tree structure)
const getDirectoryTree = async (req, res) => {
  try {
    const userId = req.user._id;
    const { parentId } = req.query;

    // For both admin and students, show ALL directories
    // Students will have read-only access on frontend
    let query = {};
    
    if (parentId) {
      query.parent = parentId;
    } else {
      query.parent = null;
    }

    const items = await Directory.find(query)
      .sort({ type: 1, name: 1 });

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

// Get item by ID
const getItemById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const item = await Directory.findOne({
      _id: id,
      createdBy: userId
    });

    if (!item) {
      return res.status(404).json({ 
        message: 'Item not found' 
      });
    }

    res.json({
      message: 'Item retrieved successfully',
      item
    });

  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({ 
      message: 'Failed to get item',
      error: error.message 
    });
  }
};

// Update file (link and metadata)
const updateFile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { name, fileLink, description } = req.body;

    const file = await Directory.findOne({
      _id: id,
      type: 'file',
      createdBy: userId
    });

    if (!file) {
      return res.status(404).json({ 
        message: 'File not found' 
      });
    }

    // Update fields if provided
    if (name && name !== file.name) {
      if (name.includes('/') || name.includes('\\')) {
        return res.status(400).json({ 
          message: 'File name cannot contain / or \\' 
        });
      }
      
      // Check if new name already exists in same parent
      const siblingExists = await Directory.findOne({
        parent: file.parent,
        name: name,
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
      try { file.fileLink = normalizeMaterialLink(fileLink); }
      catch (error) { return res.status(400).json({ message: error.message }); }
    }

    if (description !== undefined) {
      file.description = description;
    }

    // Update file type if file link changed
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

    if (!newName || typeof newName !== 'string') {
      return res.status(400).json({ 
        message: 'New name is required' 
      });
    }

    if (newName.includes('/') || newName.includes('\\')) {
      return res.status(400).json({ 
        message: 'Name cannot contain / or \\' 
      });
    }

    const item = await Directory.findOne({
      _id: id,
      createdBy: userId
    });

    if (!item) {
      return res.status(404).json({ 
        message: 'Item not found' 
      });
    }

    // Check if new name already exists in same parent
    const siblingExists = await Directory.findOne({
      parent: item.parent,
      name: newName,
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

    const item = await Directory.findOne({
      _id: id,
      createdBy: userId
    });

    if (!item) {
      return res.status(404).json({ 
        message: 'Item not found' 
      });
    }

    // Delete recursively (including all children)
    await Directory.deleteRecursive(id);

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

module.exports = {
  createFolder,
  createFile,
  getDirectoryTree,
  getItemById,
  updateFile,
  renameItem,
  deleteItem
};
