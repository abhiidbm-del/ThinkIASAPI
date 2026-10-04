const JobApplication = require('../models/JobApplication');
const Job = require('../models/Job');
const path = require('path');
const fs = require('fs');

// @desc    Submit job application with optional demo video
// @route   POST /api/jobs/:jobId/apply
// @access  Public
exports.submitApplication = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { name, email, contactNo, demoVideoLink } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: 'Please upload your resume as a PDF.', messageHindi: 'कृपया अपना बायोडाटा PDF में अपलोड करें।' });
    
    // Check if job exists and is active
    const job = await Job.findOne({ _id: jobId, isActive: true });
    if (!job) {
      // Delete uploaded file if job doesn't exist
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'Job not found or is no longer active'
      });
    }
    
    // Check if demo video is required but not provided
    if (job.requireDemoVideo && !demoVideoLink) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'This job requires a demo video link. Please provide your video introduction URL (YouTube, Vimeo, etc.)'
      });
    }
    
    // Validate demo video link if provided
    if (demoVideoLink) {
      const urlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com|loom\.com|drive\.google\.com)\/.*$/i;
      if (!urlPattern.test(demoVideoLink)) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid video URL (YouTube, Vimeo, Loom, or Google Drive)'
        });
      }
    }
    
    // Check if already applied
    const existingApplication = await JobApplication.findOne({ jobId, email });
    if (existingApplication) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this position'
      });
    }
    
    // Create application
    const applicationData = {
      jobId,
      name,
      email,
      contactNo,
      resumePath: req.file.path,
      resumeOriginalName: req.file.originalname,
      status: 'pending'
    };
    
    // Add demo video link if provided
    if (demoVideoLink) {
      applicationData.demoVideoLink = demoVideoLink;
    }
    
    const application = await JobApplication.create(applicationData);
    
    res.status(201).json({
      success: true,
      message: job.requireDemoVideo ? 
        'Application submitted successfully! Our team will review your resume and demo video.' :
        'Application submitted successfully!',
      data: {
        id: application._id,
        name: application.name,
        email: application.email,
        appliedDate: application.appliedDate,
        demoVideoSubmitted: !!application.demoVideoLink
      }
    });
  } catch (error) {
    // Delete uploaded file if there's an error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all applications for a job (Admin)
// @route   GET /api/admin/jobs/:jobId/applications
// @access  Private (Admin only)
exports.getApplicationsByJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { page = 1, limit = 20, status, hasVideo } = req.query;
    
    const query = { jobId };
    if (status) query.status = status;
    if (hasVideo === 'true') query.demoVideoLink = { $exists: true, $ne: null };
    if (hasVideo === 'false') query.demoVideoLink = null;
    
    const applications = await JobApplication.find(query)
      .sort({ appliedDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('jobId', 'title location type requireDemoVideo');
    
    const total = await JobApplication.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: applications.length,
      data: applications,
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

// @desc    Get all applications (Admin)
// @route   GET /api/admin/applications
// @access  Private (Admin only)
exports.getAllApplications = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, hasVideo } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (hasVideo === 'true') query.demoVideoLink = { $exists: true, $ne: null };
    if (hasVideo === 'false') query.demoVideoLink = null;
    
    const applications = await JobApplication.find(query)
      .sort({ appliedDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('jobId', 'title location type requireDemoVideo');
    
    const total = await JobApplication.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: applications.length,
      data: applications,
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

// @desc    Get single application details (Admin)
// @route   GET /api/admin/applications/:applicationId
// @access  Private (Admin only)
exports.getApplicationById = async (req, res) => {
  try {
    const application = await JobApplication.findById(req.params.applicationId)
      .populate('jobId', 'title location type requireDemoVideo');
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: application
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update application status (Admin)
// @route   PATCH /api/admin/applications/:applicationId/status
// @access  Private (Admin only)
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status, notes, adminRating } = req.body;
    
    const application = await JobApplication.findByIdAndUpdate(
      applicationId,
      { 
        status, 
        notes, 
        adminRating,
        reviewedBy: req.user.id,
        reviewedAt: Date.now()
      },
      { new: true, runValidators: true }
    ).populate('jobId', 'title');
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Application status updated to ${status}`,
      data: application
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Download resume (Admin)
// @route   GET /api/admin/applications/:applicationId/resume
// @access  Private (Admin only)
exports.downloadResume = async (req, res) => {
  try {
    const application = await JobApplication.findById(req.params.applicationId);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    if (!fs.existsSync(application.resumePath)) {
      return res.status(404).json({
        success: false,
        message: 'Resume file not found'
      });
    }
    
    res.download(application.resumePath, application.resumeOriginalName);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Watch demo video (Admin)
// @route   GET /api/admin/applications/:applicationId/video
// @access  Private (Admin only)
exports.watchDemoVideo = async (req, res) => {
  try {
    const application = await JobApplication.findById(req.params.applicationId);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    if (!application.demoVideoLink) {
      return res.status(404).json({
        success: false,
        message: 'No demo video submitted for this application'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        candidateName: application.name,
        demoVideoLink: application.demoVideoLink,
        jobTitle: application.jobId
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
