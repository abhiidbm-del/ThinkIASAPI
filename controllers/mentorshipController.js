const MentorshipProgram = require('../models/MentorshipProgram');
const { handleError } = require('../middleware/errorHandler');
const Batch = require('../models/Batch');
const Program = require('../models/Program');

async function validateRelation(programId, batchId) {
  if (batchId && !programId) throw new Error('Select a program for the batch.');
  if (programId && !await Program.exists({ _id: programId })) throw new Error('Program not found.');
  if (batchId && !await Batch.exists({ _id: batchId, programId })) throw new Error('The batch must belong to the selected program.');
}

// @desc    Create a new mentorship program
// @route   POST /api/mentorship
// @access  Private/Admin
const createMentorshipProgram = async (req, res) => {
  try {
    const {
      name,
      description,
      duration,
      startDate,
      medium,
      fee,
      brochureHindi,
      brochureEnglish
    } = req.body;

    // Validate required fields
    const requiredFields = ['name', 'description', 'duration', 'startDate', 'medium', 'fee', 'brochureHindi', 'brochureEnglish'];
    const missingFields = requiredFields.filter(field => req.body[field] === undefined || req.body[field] === null || req.body[field] === '');
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Check if program with same name already exists (case insensitive)
    const existingProgram = await MentorshipProgram.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      programId: req.body.programId || null,
      batchId: req.body.batchId || null,
      isActive: true
    });

    if (existingProgram) {
      return res.status(400).json({
        success: false,
        message: 'A mentorship program with this name already exists'
      });
    }

    await validateRelation(req.body.programId, req.body.batchId);
    // Create new program
    const mentorshipProgram = new MentorshipProgram({
      programId: req.body.programId || null, batchId: req.body.batchId || null,
      nameHindi: req.body.nameHindi, descriptionHindi: req.body.descriptionHindi, durationHindi: req.body.durationHindi,
      name,
      description,
      duration,
      startDate,
      medium,
      fee: parseFloat(fee),
      brochureHindi,
      brochureEnglish,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await mentorshipProgram.save();

    res.status(201).json({
      success: true,
      message: 'Mentorship program created successfully',
      data: mentorshipProgram
    });

  } catch (error) {
    console.error('Create mentorship program error:', error);
    handleError(res, error, 'Failed to create mentorship program');
  }
};

// @desc    Get all mentorship programs (admin view - includes inactive)
// @route   GET /api/mentorship/admin
// @access  Private/Admin
const getAllMentorshipProgramsAdmin = async (req, res) => {
  try {
    const { search, status } = req.query;
    
    let query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Status filter
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    const programs = await MentorshipProgram.find(query)
      .populate('programId', 'programName programNameHindi')
      .populate('batchId', 'batchName batchNameHindi startDate endDate')
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: programs.length,
      data: programs
    });

  } catch (error) {
    console.error('Get all mentorship programs error:', error);
    handleError(res, error, 'Failed to fetch mentorship programs');
  }
};

// @desc    Get active mentorship programs for public
// @route   GET /api/mentorship
// @access  Public
const getActiveMentorshipPrograms = async (req, res) => {
  try {
    const { search, medium } = req.query;
    
    let query = { isActive: true };
    if (req.query.programId) query.programId = req.query.programId;
    if (req.query.batchId) query.batchId = req.query.batchId;
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Medium filter
    if (medium) {
      query.medium = medium;
    }

    const programs = await MentorshipProgram.find(query)
      .populate('programId', 'programName programNameHindi')
      .populate('batchId', 'batchName batchNameHindi startDate endDate')
      .select('-createdBy -updatedBy -__v')
      .sort({ startDate: 1 });

    res.json({
      success: true,
      count: programs.length,
      data: programs
    });

  } catch (error) {
    console.error('Get active mentorship programs error:', error);
    handleError(res, error, 'Failed to fetch mentorship programs');
  }
};

// @desc    Get single mentorship program by ID
// @route   GET /api/mentorship/:id
// @access  Public
const getMentorshipProgramById = async (req, res) => {
  try {
    const program = await MentorshipProgram.findById(req.params.id)
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email');

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Mentorship program not found'
      });
    }

    // If public request, don't send creator/updater info if program is inactive
    if (!req.user || req.user.role !== 'admin') {
      if (!program.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Mentorship program not found'
        });
      }
      
      // Remove sensitive data for public
      const publicProgram = program.toObject();
      delete publicProgram.createdBy;
      delete publicProgram.updatedBy;
      delete publicProgram.__v;
      
      return res.json({
        success: true,
        data: publicProgram
      });
    }

    res.json({
      success: true,
      data: program
    });

  } catch (error) {
    console.error('Get mentorship program by ID error:', error);
    handleError(res, error, 'Failed to fetch mentorship program');
  }
};

// @desc    Update mentorship program
// @route   PUT /api/mentorship/:id
// @access  Private/Admin
const updateMentorshipProgram = async (req, res) => {
  try {
    const program = await MentorshipProgram.findById(req.params.id);

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Mentorship program not found'
      });
    }

    // Check for duplicate name (case insensitive, excluding current program)
    if (req.body.name !== undefined || req.body.programId !== undefined || req.body.batchId !== undefined) {
      const existingProgram = await MentorshipProgram.findOne({
        name: { $regex: new RegExp(`^${req.body.name || program.name}$`, 'i') },
        programId: req.body.programId !== undefined ? req.body.programId || null : program.programId,
        batchId: req.body.batchId !== undefined ? req.body.batchId || null : program.batchId,
        _id: { $ne: program._id }
      });

      if (existingProgram) {
        return res.status(400).json({
          success: false,
          message: 'A mentorship program with this name already exists'
        });
      }
    }

    // Update fields
    const updates = {};
    await validateRelation(req.body.programId !== undefined ? req.body.programId : program.programId, req.body.batchId !== undefined ? req.body.batchId : program.batchId);
    const updateableFields = ['programId', 'batchId', 'nameHindi', 'descriptionHindi', 'durationHindi', 'name', 'description', 'duration', 'startDate', 'medium', 'fee', 'brochureHindi', 'brochureEnglish', 'isActive'];
    
    updateableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'fee') {
          updates[field] = parseFloat(req.body[field]);
        } else if (field === 'programId' || field === 'batchId') {
          updates[field] = req.body[field] || null;
        } else {
          updates[field] = req.body[field];
        }
      }
    });

    updates.updatedBy = req.user._id;

    const updatedProgram = await MentorshipProgram.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('createdBy', 'fullName email')
     .populate('updatedBy', 'fullName email');

    res.json({
      success: true,
      message: 'Mentorship program updated successfully',
      data: updatedProgram
    });

  } catch (error) {
    console.error('Update mentorship program error:', error);
    handleError(res, error, 'Failed to update mentorship program');
  }
};

// @desc    Delete mentorship program
// @route   DELETE /api/mentorship/:id
// @access  Private/Admin
const deleteMentorshipProgram = async (req, res) => {
  try {
    const program = await MentorshipProgram.findById(req.params.id);

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Mentorship program not found'
      });
    }

    await program.deleteOne();

    res.json({
      success: true,
      message: 'Mentorship program deleted successfully'
    });

  } catch (error) {
    console.error('Delete mentorship program error:', error);
    handleError(res, error, 'Failed to delete mentorship program');
  }
};

// @desc    Toggle program status (active/inactive)
// @route   PATCH /api/mentorship/:id/toggle-status
// @access  Private/Admin
const toggleProgramStatus = async (req, res) => {
  try {
    const program = await MentorshipProgram.findById(req.params.id);

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Mentorship program not found'
      });
    }

    program.isActive = !program.isActive;
    program.updatedBy = req.user._id;
    await program.save();

    const status = program.isActive ? 'activated' : 'deactivated';

    res.json({
      success: true,
      message: `Mentorship program ${status} successfully`,
      data: program
    });

  } catch (error) {
    console.error('Toggle program status error:', error);
    handleError(res, error, 'Failed to toggle program status');
  }
};

module.exports = {
  createMentorshipProgram,
  getAllMentorshipProgramsAdmin,
  getActiveMentorshipPrograms,
  getMentorshipProgramById,
  updateMentorshipProgram,
  deleteMentorshipProgram,
  toggleProgramStatus
};
