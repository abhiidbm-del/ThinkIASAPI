const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema(
  {
    nameHindi: { type: String, trim: true, default: '' },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },

    description: {
      type: String,
      required: true,
      trim: true
    },

    descriptionHindi: {
      type: String,
      trim: true,
      default: ''
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    subtitle: {
      type: String,
      required: true,
      trim: true
    },

    subtitleHindi: {
      type: String,
      trim: true,
      default: ''
    },

    image: {
      type: String,
      default: null
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  'Testimonial',
  testimonialSchema
);

testimonialSchema.index({ isActive: 1, createdAt: -1 });
