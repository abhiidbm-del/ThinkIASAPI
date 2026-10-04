const Program = require('../models/Program');

// @desc    Get all programs
// @route   GET /api/programs
// @access  Public
const getPrograms = async (req, res) => {
  try {
    const { category, year, activeOnly } = req.query;
    
    let query = {};
    
    // Filter by category
    if (category) {
      query.programCategory = category;
    }
    
    // Filter by year
    if (year) {
      query.year = year;
    }
    
    // Filter active only
    if (activeOnly === 'true') {
      Object.assign(query, require('../utils/availableEnrollment').availableEnrollment());
    }
    
    const programs = await Program.find(query)
      .sort({ order: 1, startDate: 1, createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: programs.length,
      data: programs
    });
  } catch (error) {
    console.error('Error in getPrograms:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get single program by ID
// @route   GET /api/programs/:id
// @access  Public
const getProgramById = async (req, res) => {
  try {
    const program = await Program.findById(req.params.id);
    
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: program
    });
  } catch (error) {
    console.error('Error in getProgramById:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// Helper function to calculate duration
const calculateDuration = (startDate, endDate) => {
  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffMonths / 12);
  
  if (diffYears > 0) {
    const remainingMonths = diffMonths % 12;
    if (remainingMonths > 0) {
      return `${diffYears} year${diffYears > 1 ? 's' : ''} ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
    } else {
      return `${diffYears} year${diffYears > 1 ? 's' : ''}`;
    }
  } else if (diffMonths > 0) {
    const remainingDays = diffDays % 30;
    if (remainingDays > 0) {
      return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
    } else {
      return `${diffMonths} month${diffMonths > 1 ? 's' : ''}`;
    }
  } else {
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  }
};

// @desc    Create new program
// @route   POST /api/programs
// @access  Admin
const createProgram = async (req, res) => {
  try {
    const {
      programName,
      programCategory,
      year,
      price,
      discountedPrice,
      displayImage,
      description,
      features,
      startDate,
      endDate,
      order
    } = req.body;
    
    // Validation
    if (!programName || !programCategory || !year || price === undefined || price === null || price === '' || !Number.isFinite(Number(price)) || Number(price) < 0 || !displayImage) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: programName, programCategory, year, price, displayImage'
      });
    }
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }
    
    const program = await Program.create({
      programNameHindi: req.body.programNameHindi, descriptionHindi: req.body.descriptionHindi, durationHindi: req.body.durationHindi, featuresHindi: req.body.featuresHindi,
      programName,
      programCategory,
      year,
      price,
      discountedPrice: discountedPrice ?? null,
      displayImage,
      description: description || '',
      features: features || [],
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      order: order || 0,
      isActive: true
    });
    
    res.status(201).json({
      success: true,
      message: 'Program created successfully',
      data: program
    });
  } catch (error) {
    console.error('Error in createProgram:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Update program
// @route   PUT /api/programs/:id
// @access  Admin
const updateProgram = async (req, res) => {
  try {
    const {
      programName,
      programCategory,
      year,
      price,
      discountedPrice,
      displayImage,
      description,
      features,
      startDate,
      endDate,
      isActive,
      order
    } = req.body;
    
    let program = await Program.findById(req.params.id);
    
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      });
    }
    
    for (const field of ['programNameHindi', 'descriptionHindi', 'durationHindi', 'featuresHindi']) { if (req.body[field] !== undefined) program[field] = req.body[field]; }
    // Update fields
    program.programName = programName || program.programName;
    program.programCategory = programCategory || program.programCategory;
    program.year = year || program.year;
    program.price = price !== undefined ? price : program.price;
    program.discountedPrice = discountedPrice !== undefined ? discountedPrice : program.discountedPrice;
    program.displayImage = displayImage || program.displayImage;
    program.description = description !== undefined ? description : program.description;
    program.features = features || program.features;
    if (startDate) program.startDate = new Date(startDate);
    if (endDate) program.endDate = new Date(endDate);
    program.isActive = isActive !== undefined ? isActive : program.isActive;
    program.order = order !== undefined ? order : program.order;
    
    await program.save();
    
    res.status(200).json({
      success: true,
      message: 'Program updated successfully',
      data: program
    });
  } catch (error) {
    console.error('Error in updateProgram:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Delete program
// @route   DELETE /api/programs/:id
// @access  Admin
const deleteProgram = async (req, res) => {
  try {
    const program = await Program.findById(req.params.id);
    
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      });
    }
    
    await program.deleteOne();
    
    res.status(200).json({
      success: true,
      message: 'Program deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteProgram:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get programs by category (grouped)
// @route   GET /api/programs/grouped/by-category
// @access  Public
const getProgramsGroupedByCategory = async (req, res) => {
  try {
    const { activeOnly = 'true' } = req.query;
    
    let matchStage = {};
    if (activeOnly === 'true') {
      Object.assign(matchStage, require('../utils/availableEnrollment').availableEnrollment());
    }
    
    const groupedPrograms = await Program.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$programCategory',
          programs: {
            $push: {
              id: '$_id',
              programName: '$programName',
              year: '$year',
              price: '$price',
              discountedPrice: '$discountedPrice',
              displayImage: '$displayImage',
              description: '$description',
              features: '$features',
              duration: '$duration',
              startDate: '$startDate',
              endDate: '$endDate',
              order: '$order'
            }
          }
        }
      },
      {
        $project: {
          category: '$_id',
          programs: 1,
          _id: 0
        }
      },
      {
        $sort: { category: 1 }
      }
    ]);
    
    res.status(200).json({
      success: true,
      data: groupedPrograms
    });
  } catch (error) {
    console.error('Error in getProgramsGroupedByCategory:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Bulk create/update programs
// @route   POST /api/programs/bulk
// @access  Admin
const bulkCreatePrograms = async (req, res) => {
  try {
    const { programs } = req.body;
    
    if (!Array.isArray(programs) || programs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of programs'
      });
    }
    
    const createdPrograms = await Program.insertMany(programs, { ordered: false });
    
    res.status(201).json({
      success: true,
      message: `${createdPrograms.length} programs created successfully`,
      data: createdPrograms
    });
  } catch (error) {
    console.error('Error in bulkCreatePrograms:', error);
    
    if (error.insertedDocs) {
      return res.status(207).json({
        success: true,
        partial: true,
        message: `${error.insertedDocs.length} programs created, ${error.writeErrors?.length || 0} failed`,
        data: error.insertedDocs,
        errors: error.writeErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

module.exports = {
  getPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram,
  getProgramsGroupedByCategory,
  bulkCreatePrograms
};
