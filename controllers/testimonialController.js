const Testimonial = require('../models/Testimonial');

const uploadedImageUrl = file => {
  if (!file) return null;
  if (process.env.R2_PUBLIC_URL && file.key) {
    return `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${file.key}`;
  }
  return file.location || null;
};


// ==========================================
// CREATE TESTIMONIAL
// ==========================================

const createTestimonial = async (req, res) => {
  try {
    const {
      rating,
      description,
      descriptionHindi,
      name,
      subtitle,
      subtitleHindi,
      image
    } = req.body;

    // Required fields
    if (
      rating === undefined ||
      !description ||
      !name ||
      !subtitle
    ) {
      return res.status(400).json({
        success: false,
        message: 'Rating, description, name and subtitle are required'
      });
    }

    // Rating validation
    if (Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const testimonial = await Testimonial.create({
      nameHindi: req.body.nameHindi || '',
      rating: Number(rating),
      description,
      descriptionHindi: descriptionHindi || '',
      name,
      subtitle,
      subtitleHindi: subtitleHindi || '',
      image: uploadedImageUrl(req.file) || image || null
    });

    return res.status(201).json({
      success: true,
      message: 'Testimonial created successfully',
      data: testimonial
    });

  } catch (error) {
    console.error('Create testimonial error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


// ==========================================
// GET ALL TESTIMONIALS
// ==========================================

const getTestimonials = async (req, res) => {
  try {
    const isPublicRequest = req.route?.path === '/public';
    const testimonials = await Testimonial.find(isPublicRequest ? { isActive: true } : {})
      .sort({ createdAt: -1 });

    if (isPublicRequest) res.set('Cache-Control', 'no-store');

    return res.status(200).json({
      success: true,
      message: 'Testimonials fetched successfully',
      count: testimonials.length,
      data: testimonials
    });

  } catch (error) {
    console.error('Get testimonials error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


// ==========================================
// GET SINGLE TESTIMONIAL
// ==========================================

const getTestimonial = async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(
      req.params.id
    );

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: testimonial
    });

  } catch (error) {
    console.error('Get testimonial error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid testimonial ID'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


// ==========================================
// UPDATE TESTIMONIAL
// ==========================================

const updateTestimonial = async (req, res) => {
  try {
    const {
      rating,
      description,
      name,
      subtitle,
      image
    } = req.body;

    // Rating validation
    if (
      rating !== undefined &&
      (Number(rating) < 1 || Number(rating) > 5)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const updateData = {};
    for (const field of ['nameHindi', 'descriptionHindi', 'subtitleHindi']) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    if (rating !== undefined) {
      updateData.rating = Number(rating);
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    if (name !== undefined) {
      updateData.name = name;
    }

    if (subtitle !== undefined) {
      updateData.subtitle = subtitle;
    }

    if (req.file) {
      updateData.image = uploadedImageUrl(req.file);
    } else if (image !== undefined) {
      updateData.image = image || null;
    }

    const testimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Testimonial updated successfully',
      data: testimonial
    });

  } catch (error) {
    console.error('Update testimonial error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid testimonial ID'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


// ==========================================
// DELETE TESTIMONIAL
// ==========================================

const deleteTestimonial = async (req, res) => {
  try {
    const testimonial = await Testimonial.findByIdAndDelete(
      req.params.id
    );

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Testimonial deleted successfully'
    });

  } catch (error) {
    console.error('Delete testimonial error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid testimonial ID'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


module.exports = {
  createTestimonial,
  getTestimonials,
  getTestimonial,
  updateTestimonial,
  deleteTestimonial
};
