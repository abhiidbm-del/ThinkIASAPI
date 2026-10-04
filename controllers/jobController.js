const Job = require('../models/Job');

// @desc    Create a new job
// @route   POST /api/jobs
// @access  Private (Admin only)
exports.createJob = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      type, 
      location, 
      yearsOfExperience,
      requireDemoVideo 
    } = req.body;
    
    const job = await Job.create({
      titleHindi: req.body.titleHindi, descriptionHindi: req.body.descriptionHindi, locationHindi: req.body.locationHindi,
      title,
      description,
      type,
      location,
      yearsOfExperience,
      requireDemoVideo: requireDemoVideo || false,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Job created successfully',
      data: job
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all active jobs (Public)
// @route   GET /api/jobs
// @access  Public
exports.getActiveJobs = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, location, requireVideo } = req.query;
    
    const query = { isActive: true };
    
    // Apply filters
    if (type) query.type = type;
    if (location) query.location = { $regex: location, $options: 'i' };
    if (requireVideo === 'true') query.requireDemoVideo = true;
    if (requireVideo === 'false') query.requireDemoVideo = false;
    
    const jobs = await Job.find(query)
      .sort({ postedDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-__v -createdBy');
    
    const total = await Job.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single job by ID (Public)
// @route   GET /api/jobs/:id
// @access  Public
exports.getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .select('-__v -createdBy');
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Only show active jobs to public
    if (!job.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        _id: job._id, titleHindi: job.titleHindi, descriptionHindi: job.descriptionHindi, locationHindi: job.locationHindi,
        id: job._id,
        title: job.title,
        description: job.description,
        type: job.type,
        location: job.location,
        postedDate: job.postedDate,
        yearsOfExperience: job.yearsOfExperience,
        requireDemoVideo: job.requireDemoVideo, // Tell candidate if video is required
        isActive: job.isActive
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all jobs (admin - includes inactive)
// @route   GET /api/admin/jobs
// @access  Private (Admin only)
exports.getAllJobsAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive, requireVideo } = req.query;
    
    const query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (requireVideo !== undefined) query.requireDemoVideo = requireVideo === 'true';
    
    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'name email');
    
    const total = await Job.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update job (Admin)
// @route   PUT /api/jobs/:id
// @access  Private (Admin only)
exports.updateJob = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      type, 
      location, 
      yearsOfExperience,
      requireDemoVideo 
    } = req.body;
    
    let job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    const updateData = {
      titleHindi: req.body.titleHindi, descriptionHindi: req.body.descriptionHindi, locationHindi: req.body.locationHindi,
      title,
      description,
      type,
      location,
      yearsOfExperience
    };
    
    // Only update requireDemoVideo if provided
    if (requireDemoVideo !== undefined) {
      updateData.requireDemoVideo = requireDemoVideo;
    }
    
    job = await Job.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'Job updated successfully',
      data: job
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Toggle demo video requirement (Admin)
// @route   PATCH /api/jobs/:id/require-video
// @access  Private (Admin only)
exports.toggleVideoRequirement = async (req, res) => {
  try {
    const { requireDemoVideo } = req.body;
    
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    job.requireDemoVideo = requireDemoVideo;
    await job.save();
    
    res.status(200).json({
      success: true,
      message: `Demo video requirement ${requireDemoVideo ? 'enabled' : 'disabled'} for this job`,
      data: {
        id: job._id,
        title: job.title,
        requireDemoVideo: job.requireDemoVideo
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Toggle job active status
// @route   PATCH /api/jobs/:id/toggle
// @access  Private (Admin only)
exports.toggleJobStatus = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    job.isActive = !job.isActive;
    await job.save();
    
    res.status(200).json({
      success: true,
      data: job,
      message: `Job ${job.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete job
// @route   DELETE /api/jobs/:id
// @access  Private (Admin only)
exports.deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    await job.deleteOne();
    
    res.status(200).json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
