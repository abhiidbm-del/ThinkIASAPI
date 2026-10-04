const FreeResource = require('../models/FreeResource');

// Get all public modules
// Get all public modules (with ordering)
const getPublicModules = async (req, res) => {
  try {
    // Get all modules (public access, no user filtering)
    const modules = await FreeResource.find({
      type: 'module',
      parent: null
    }).select('name nameHi type order createdAt updatedAt')
      .sort({ order: 1, createdAt: 1 }); // Sort by order first, then date

    res.json({
      message: 'Public modules retrieved successfully',
      modules
    });

  } catch (error) {
    console.error('Get public modules error:', error);
    res.status(500).json({ 
      message: 'Failed to get public modules',
      error: error.message 
    });
  }
};

// Get public directory tree
const getPublicDirectoryTree = async (req, res) => {
  try {
    const { parentId } = req.query;

    // Build query
    let query = { parent: parentId || null };
    
    // If no parentId, show modules
    if (!parentId) {
      query.type = 'module';
    }

    const items = await FreeResource.find(query)
      .select('name nameHi type fullPath fileLink fileDescription fileType createdAt updatedAt')
      .sort({ type: 1, name: 1 });

    res.json({
      message: 'Public directory tree retrieved successfully',
      items
    });

  } catch (error) {
    console.error('Get public directory tree error:', error);
    res.status(500).json({ 
      message: 'Failed to get public directory tree',
      error: error.message 
    });
  }
};

// Get public module tree
const getPublicModuleTree = async (req, res) => {
  try {
    const { id } = req.params;

    const module = await FreeResource.findOne({
      _id: id,
      type: 'module'
    }).select('name nameHi type createdAt updatedAt');

    if (!module) {
      return res.status(404).json({ 
        message: 'Module not found' 
      });
    }

    // Get all items in this module recursively
    const getAllChildren = async (parentId) => {
      const children = await FreeResource.find({
        parent: parentId
      }).select('name nameHi type fullPath fileLink fileDescription fileType createdAt updatedAt')
        .sort({ type: 1, name: 1 });

      for (let child of children) {
        if (child.type === 'folder') {
          child = child.toObject();
          child.children = await getAllChildren(child._id);
        }
      }

      return children;
    };

    const moduleWithTree = module.toObject();
    moduleWithTree.children = await getAllChildren(module._id);

    res.json({
      message: 'Public module tree retrieved successfully',
      module: moduleWithTree
    });

  } catch (error) {
    console.error('Get public module tree error:', error);
    res.status(500).json({ 
      message: 'Failed to get public module tree',
      error: error.message 
    });
  }
};

// Get public file info
const getPublicFile = async (req, res) => {
  try {
    const { id } = req.params;

    const file = await FreeResource.findOne({
      _id: id,
      type: 'file'
    }).select('name nameHi type fullPath fileLink fileDescription fileType createdAt updatedAt');

    if (!file) {
      return res.status(404).json({ 
        message: 'File not found' 
      });
    }

    res.json({
      message: 'File retrieved successfully',
      file
    });

  } catch (error) {
    console.error('Get public file error:', error);
    res.status(500).json({ 
      message: 'Failed to get file',
      error: error.message 
    });
  }
};

// Create Module
const createModule = async (req, res) => {
  try {
    const { name, nameHi } = req.body;
    const userId = req.user._id;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ 
        message: 'Module name is required' 
      });
    }

    // Check if module already exists
    const existingModule = await FreeResource.findOne({
      name,
      type: 'module',
      parent: null,
      createdBy: userId
    });

    if (existingModule) {
      return res.status(409).json({ 
        message: 'Module already exists' 
      });
    }

    const module = await FreeResource.create({
      name,
      nameHi: nameHi || '',
      type: 'module',
      fullPath: name,
      createdBy: userId
    });

    res.status(201).json({
      message: 'Module created successfully',
      module
    });

  } catch (error) {
    console.error('Create module error:', error);
    res.status(500).json({ 
      message: 'Failed to create module',
      error: error.message 
    });
  }
};

// Create Folder in Module
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

    if (!parentId) {
      return res.status(400).json({ 
        message: 'Parent ID is required' 
      });
    }

    const parent = await FreeResource.findById(parentId);
    if (!parent) {
      return res.status(404).json({ 
        message: 'Parent not found' 
      });
    }
    
    if (parent.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ 
        message: 'Access denied' 
      });
    }

    const fullPath = `${parent.fullPath}/${name}`;

    // Check if folder already exists
    const existingFolder = await FreeResource.findOne({
      fullPath,
      createdBy: userId
    });

    if (existingFolder) {
      return res.status(409).json({ 
        message: 'Folder already exists' 
      });
    }

    const folder = await FreeResource.create({
      name,
      type: 'folder',
      parent: parentId,
      fullPath,
      path: parent.fullPath,
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

// Create File
const createFile = async (req, res) => {
  try {
    const { name, parentId, fileLink, fileDescription } = req.body;
    const userId = req.user._id;

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

    if (name.includes('/') || name.includes('\\')) {
      return res.status(400).json({ 
        message: 'File name cannot contain / or \\' 
      });
    }

    if (!parentId) {
      return res.status(400).json({ 
        message: 'Parent ID is required' 
      });
    }

    const parent = await FreeResource.findById(parentId);
    if (!parent) {
      return res.status(404).json({ 
        message: 'Parent not found' 
      });
    }
    
    if (parent.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ 
        message: 'Access denied' 
      });
    }

    const fullPath = `${parent.fullPath}/${name}`;

    // Check if file already exists
    const existingFile = await FreeResource.findOne({
      fullPath,
      createdBy: userId
    });

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

    const file = await FreeResource.create({
      name,
      type: 'file',
      parent: parentId,
      fullPath,
      path: parent.fullPath,
      fileLink,
      fileDescription: fileDescription || '', // ADD THIS LINE
      fileType,
      createdBy: userId
    });

    res.status(201).json({
      message: 'File created successfully',
      file
    });

  } catch (error) {
    console.error('Create file error:', error);
    res.status(500).json({ 
      message: 'Failed to create file',
      error: error.message 
    });
  }
};

// Get all modules
// Get all modules (with ordering)
const getModules = async (req, res) => {
  try {
    const userId = req.user._id;

    const modules = await FreeResource.find({
      type: 'module',
      parent: null,
      createdBy: userId
    }).select('name nameHi type order createdAt updatedAt')
      .sort({ order: 1, createdAt: 1 }); // Sort by order first, then date

    res.json({
      message: 'Modules retrieved successfully',
      modules
    });

  } catch (error) {
    console.error('Get modules error:', error);
    res.status(500).json({ 
      message: 'Failed to get modules',
      error: error.message 
    });
  }
};

// Get Directory Tree
const getDirectoryTree = async (req, res) => {
  try {
    const { parentId } = req.query;
    const userId = req.user._id;

    const items = await FreeResource.getDirectoryTree(parentId, userId);

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

// Get Module with Full Tree
const getModuleTree = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const module = await FreeResource.findOne({
      _id: id,
      type: 'module',
      createdBy: userId
    });

    if (!module) {
      return res.status(404).json({ 
        message: 'Module not found' 
      });
    }

    // Get all items in this module recursively
    const getAllChildren = async (parentId) => {
      const children = await FreeResource.find({
        parent: parentId,
        createdBy: userId
      }).sort({ type: 1, name: 1 });

      for (let child of children) {
        if (child.type === 'folder') {
          child = child.toObject();
          child.children = await getAllChildren(child._id);
        }
      }

      return children;
    };

    const moduleWithTree = module.toObject();
    moduleWithTree.children = await getAllChildren(module._id);

    res.json({
      message: 'Module tree retrieved successfully',
      module: moduleWithTree
    });

  } catch (error) {
    console.error('Get module tree error:', error);
    res.status(500).json({ 
      message: 'Failed to get module tree',
      error: error.message 
    });
  }
};

// Update File
const updateFile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { name, fileLink, fileDescription } = req.body;

    const file = await FreeResource.findOne({
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
      const siblingExists = await FreeResource.findOne({
        parent: file.parent,
        name: name,
        createdBy: userId,
        _id: { $ne: id }
      });

      if (siblingExists) {
        return res.status(409).json({ 
          message: 'A file with this name already exists' 
        });
      }
      
      file.name = name;
    }

    if (fileDescription !== undefined) { // ADD THIS SECTION
      file.fileDescription = fileDescription;
    }

    if (fileLink) {
      file.fileLink = fileLink;
      
      // Update file type if file link changed
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

// Update Module
const updateModule = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { name, nameHi } = req.body;

    const module = await FreeResource.findOne({
      _id: id,
      type: 'module',
      createdBy: userId
    });

    if (!module) {
      return res.status(404).json({ 
        message: 'Module not found' 
      });
    }

    // Update fields if provided
    if (name && name !== module.name) {
      if (name.includes('/') || name.includes('\\')) {
        return res.status(400).json({ 
          message: 'Module name cannot contain / or \\' 
        });
      }
      
      // Check if new name already exists
      const siblingExists = await FreeResource.findOne({
        type: 'module',
        parent: null,
        name: name,
        createdBy: userId,
        _id: { $ne: id }
      });

      if (siblingExists) {
        return res.status(409).json({ 
          message: 'A module with this name already exists' 
        });
      }
      
      module.name = name;
    }

    if (nameHi !== undefined) {
      module.nameHi = nameHi;
    }

    await module.save();

    res.json({
      message: 'Module updated successfully',
      module
    });

  } catch (error) {
    console.error('Update module error:', error);
    res.status(500).json({ 
      message: 'Failed to update module',
      error: error.message 
    });
  }
};

// Rename Item (for folders/files only)
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

    const item = await FreeResource.findOne({
      _id: id,
      createdBy: userId,
      type: { $in: ['folder', 'file'] } // Only allow folders and files
    });

    if (!item) {
      return res.status(404).json({ 
        message: 'Item not found or not allowed to rename modules' 
      });
    }

    // Check if new name already exists in same parent
    const siblingExists = await FreeResource.findOne({
      parent: item.parent,
      name: newName,
      createdBy: userId,
      _id: { $ne: id }
    });

    if (siblingExists) {
      return res.status(409).json({ 
        message: 'An item with this name already exists' 
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

// Delete Item
const deleteItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const item = await FreeResource.findOne({
      _id: id,
      createdBy: userId
    });

    if (!item) {
      return res.status(404).json({ 
        message: 'Item not found' 
      });
    }

    // Delete recursively (including all children)
    await FreeResource.deleteRecursive(id);

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

// Reorder modules
// Reorder modules
const reorderModules = async (req, res) => {
  try {
    const userId = req.user._id;
    const { modules } = req.body; // Expected: [{ id: 'moduleId', order: 0 }, ...]

    console.log('Reorder request received:', { modules, userId });

    if (!modules || !Array.isArray(modules)) {
      return res.status(400).json({ 
        message: 'Modules array is required' 
      });
    }

    // Update each module's order
    const updatePromises = modules.map((item) => {
      if (!item.id || item.order === undefined) {
        throw new Error('Each module must have id and order');
      }
      
      return FreeResource.findOneAndUpdate(
        { 
          _id: item.id, 
          type: 'module',
          createdBy: userId 
        },
        { order: item.order },
        { new: true }
      );
    });

    const results = await Promise.all(updatePromises);
    
    // Check if any modules weren't found
    const notFound = results.filter(r => !r);
    if (notFound.length > 0) {
      return res.status(404).json({ 
        message: `${notFound.length} module(s) not found or access denied` 
      });
    }

    // Fetch updated modules in correct order
    const updatedModules = await FreeResource.find({
      type: 'module',
      parent: null,
      createdBy: userId
    }).select('name nameHi type order createdAt updatedAt')
      .sort({ order: 1, createdAt: 1 });

    res.json({
      message: 'Modules reordered successfully',
      modules: updatedModules
    });

  } catch (error) {
    console.error('Reorder modules error:', error);
    res.status(500).json({ 
      message: 'Failed to reorder modules',
      error: error.message 
    });
  }
};

// Update single module order
const updateModuleOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { order } = req.body;

    if (order === undefined || typeof order !== 'number') {
      return res.status(400).json({ 
        message: 'Valid order number is required' 
      });
    }

    const module = await FreeResource.findOneAndUpdate(
      {
        _id: id,
        type: 'module',
        createdBy: userId
      },
      { order },
      { new: true }
    );

    if (!module) {
      return res.status(404).json({ 
        message: 'Module not found' 
      });
    }

    res.json({
      message: 'Module order updated successfully',
      module
    });

  } catch (error) {
    console.error('Update module order error:', error);
    res.status(500).json({ 
      message: 'Failed to update module order',
      error: error.message 
    });
  }
};

module.exports = {
  createModule,
  createFolder,
  createFile,
  getModules,
  getDirectoryTree,
  getModuleTree,
  updateFile,
  updateModule, // Make sure this is exported
  renameItem,
  deleteItem,
  reorderModules,        // Add this
  updateModuleOrder,
  getPublicModules,
  getPublicDirectoryTree,
  getPublicModuleTree,
  getPublicFile
};