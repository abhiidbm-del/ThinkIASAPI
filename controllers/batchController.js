const Batch = require('../models/Batch');
const Program = require('../models/Program');
const { handleError } = require('../middleware/errorHandler');

// @desc    Create a new batch
// @route   POST /api/programs/:programId/batches
// @access  Private/Admin
const createBatch = async (req, res) => {
  try {
    const { programId } = req.params;
    const { batchName, startDate, endDate, brochureHindi, brochureEnglish, order } = req.body;

    // Check if program exists
    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      });
    }

    // Validate required fields
    if (!batchName || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Batch name, start date, and end date are required'
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Check for duplicate batch name within the same program
    const existingBatch = await Batch.findOne({
      programId,
      batchName: { $regex: new RegExp(`^${batchName}$`, 'i') }
    });

    if (existingBatch) {
      return res.status(400).json({
        success: false,
        message: 'A batch with this name already exists for this program'
      });
    }

    // Create new batch
    const batch = new Batch({
      batchNameHindi: req.body.batchNameHindi, durationHindi: req.body.durationHindi,
      programId,
      batchName,
      startDate: start,
      endDate: end,
      brochureHindi: brochureHindi || '',
      brochureEnglish: brochureEnglish || '',
      order: order || 0,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await batch.save();

    res.status(201).json({
      success: true,
      message: 'Batch created successfully',
      data: batch
    });

  } catch (error) {
    console.error('Create batch error:', error);
    handleError(res, error, 'Failed to create batch');
  }
};

// @desc    Get all batches for a program (admin view)
// @route   GET /api/programs/:programId/batches/admin
// @access  Private/Admin
const getAllBatchesAdmin = async (req, res) => {
  try {
    const { programId } = req.params;
    const { status } = req.query;
    
    let query = { programId };
    
    // Status filter
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    const batches = await Batch.find(query)
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .sort({ order: -1, startDate: 1 });

    res.json({
      success: true,
      count: batches.length,
      data: batches
    });

  } catch (error) {
    console.error('Get all batches error:', error);
    handleError(res, error, 'Failed to fetch batches');
  }
};

// @desc    Get active batches for public view
// @route   GET /api/programs/:programId/batches
// @access  Public
const getActiveBatches = async (req, res) => {
  try {
    const { programId } = req.params;
    
    const available = require('../utils/availableEnrollment').availableEnrollment();
    const parent = await require('../models/Program').exists({ _id: programId, ...available });
    if (!parent) return res.json({ success: true, count: 0, data: [] });
    let query = { programId, ...available };

    const batches = await Batch.find(query)
      .select('-createdBy -updatedBy -__v')
      .sort({ order: -1, startDate: 1 });

    res.json({
      success: true,
      count: batches.length,
      data: batches
    });

  } catch (error) {
    console.error('Get active batches error:', error);
    handleError(res, error, 'Failed to fetch batches');
  }
};

// @desc    Get single batch by ID
// @route   GET /api/batches/:id
// @access  Public
const getBatchById = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id)
      .populate('programId', 'programName programCategory');

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    // If public request, check if batch is active
    if (!req.user || req.user.role !== 'admin') {
      if (!batch.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Batch not found'
        });
      }
      
      const publicBatch = batch.toObject();
      delete publicBatch.createdBy;
      delete publicBatch.updatedBy;
      
      return res.json({
        success: true,
        data: publicBatch
      });
    }

    res.json({
      success: true,
      data: batch
    });

  } catch (error) {
    console.error('Get batch by ID error:', error);
    handleError(res, error, 'Failed to fetch batch');
  }
};

// @desc    Update batch
// @route   PUT /api/batches/:id
// @access  Private/Admin
const updateBatch = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    // Check for duplicate batch name within the same program
    if (req.body.batchName && req.body.batchName !== batch.batchName) {
      const existingBatch = await Batch.findOne({
        programId: batch.programId,
        batchName: { $regex: new RegExp(`^${req.body.batchName}$`, 'i') },
        _id: { $ne: batch._id }
      });

      if (existingBatch) {
        return res.status(400).json({
          success: false,
          message: 'A batch with this name already exists for this program'
        });
      }
    }

    // Validate dates if both are provided
    if (req.body.startDate && req.body.endDate) {
      const start = new Date(req.body.startDate);
      const end = new Date(req.body.endDate);
      
      if (start >= end) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date'
        });
      }
    }

    // Update fields
    const updates = {};
    const updateableFields = ['batchNameHindi', 'durationHindi', 'batchName', 'startDate', 'endDate', 'brochureHindi', 'brochureEnglish', 'isActive', 'order'];
    
    updateableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'startDate' || field === 'endDate') {
          updates[field] = new Date(req.body[field]);
        } else {
          updates[field] = req.body[field];
        }
      }
    });

    updates.updatedBy = req.user._id;

    const updatedBatch = await Batch.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('createdBy', 'fullName email')
     .populate('updatedBy', 'fullName email');

    res.json({
      success: true,
      message: 'Batch updated successfully',
      data: updatedBatch
    });

  } catch (error) {
    console.error('Update batch error:', error);
    handleError(res, error, 'Failed to update batch');
  }
};

// @desc    Delete batch
// @route   DELETE /api/batches/:id
// @access  Private/Admin
const deleteBatch = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    await batch.deleteOne();

    res.json({
      success: true,
      message: 'Batch deleted successfully'
    });

  } catch (error) {
    console.error('Delete batch error:', error);
    handleError(res, error, 'Failed to delete batch');
  }
};

// @desc    Toggle batch status
// @route   PATCH /api/batches/:id/toggle-status
// @access  Private/Admin
const toggleBatchStatus = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    batch.isActive = !batch.isActive;
    batch.updatedBy = req.user._id;
    await batch.save();

    const status = batch.isActive ? 'activated' : 'deactivated';

    res.json({
      success: true,
      message: `Batch ${status} successfully`,
      data: batch
    });

  } catch (error) {
    console.error('Toggle batch status error:', error);
    handleError(res, error, 'Failed to toggle batch status');
  }
};

module.exports = {
  createBatch,
  getAllBatchesAdmin,
  getActiveBatches,
  getBatchById,
  updateBatch,
  deleteBatch,
  toggleBatchStatus
};
