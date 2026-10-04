const Syllabus = require('../models/Syllabus');
const { handleError } = require('../middleware/errorHandler');

// Helper function to clean response (remove _id and __v)
const cleanResponse = (data) => {
  if (!data) return data;
  
  const cleanObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    // Remove mongoose specific fields
    delete obj._id;
    delete obj.__v;
    delete obj.id;
    
    // Recursively clean nested objects and arrays
    Object.keys(obj).forEach(key => {
      if (Array.isArray(obj[key])) {
        obj[key] = obj[key].map(item => cleanObject(item));
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        obj[key] = cleanObject(obj[key]);
      }
    });
    
    return obj;
  };
  
  return cleanObject(JSON.parse(JSON.stringify(data)));
};

// Create or Update Prelims Syllabus
const createOrUpdatePrelims = async (req, res) => {
  try {
    // Validate input
    if (!req.body.gs1 || !req.body.gs2) {
      return res.status(400).json({
        message: 'Both GS1 and GS2 are required'
      });
    }

    // Deactivate any existing active prelims syllabus
    await Syllabus.updateMany(
      { type: 'prelims', isActive: true },
      { isActive: false }
    );

    // Check if any prelims syllabus exists
    let existingSyllabus = await Syllabus.findOne({ type: 'prelims' });

    if (existingSyllabus) {
      // Update existing syllabus
      const updatedSyllabus = await Syllabus.findByIdAndUpdate(
        existingSyllabus._id,
        {
          prelims: req.body,
          type: 'prelims',
          isActive: true,
          createdBy: req.user._id
        },
        { new: true, runValidators: true }
      );

      return res.json({
        message: 'Prelims syllabus updated successfully',
        syllabus: cleanResponse(updatedSyllabus.prelims),
        action: 'updated'
      });
    } else {
      // Create new syllabus
      const syllabus = new Syllabus({
        prelims: req.body,
        type: 'prelims',
        isActive: true,
        createdBy: req.user._id
      });

      await syllabus.save();

      return res.status(201).json({
        message: 'Prelims syllabus created successfully',
        syllabus: cleanResponse(syllabus.prelims),
        action: 'created'
      });
    }
  } catch (error) {
    console.error('Prelims syllabus error:', error);
    handleError(res, error, 'Failed to process prelims syllabus');
  }
};

// Get Prelims Syllabus
const getPrelimsSyllabus = async (req, res) => {
  try {
    const syllabus = await Syllabus.findOne({ type: 'prelims', isActive: true })
      .select('prelims')
      .lean();

    if (!syllabus || !syllabus.prelims) {
      return res.status(404).json({ 
        message: 'No active prelims syllabus found' 
      });
    }

    res.json(cleanResponse(syllabus.prelims));
  } catch (error) {
    handleError(res, error, 'Failed to fetch prelims syllabus');
  }
};

// Create or Update Mains Syllabus
const createOrUpdateMains = async (req, res) => {
  try {
    // Validate required fields
    const requiredFields = ['essay', 'gs1', 'gs2', 'gs3', 'gs4'];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          message: `${field.toUpperCase()} is required`
        });
      }
    }

    // Deactivate ALL active mains syllabus
    await Syllabus.updateMany(
      { type: 'mains', isActive: true },
      { $set: { isActive: false } }
    );

    // Find any mains syllabus
    let existingSyllabus = await Syllabus.findOne({ type: 'mains' });

    let syllabus;
    if (existingSyllabus) {
      // Update existing syllabus
      syllabus = await Syllabus.findByIdAndUpdate(
        existingSyllabus._id,
        {
          $set: {
            mains: req.body,
            isActive: true,
            createdBy: req.user._id
          }
        },
        { new: true, runValidators: true }
      );
    } else {
      // Create new syllabus
      syllabus = new Syllabus({
        mains: req.body,
        type: 'mains',
        isActive: true,
        createdBy: req.user._id
      });
      await syllabus.save();
    }

    return res.json({
      message: 'Mains syllabus saved successfully',
      syllabus: cleanResponse(syllabus.mains),
      action: existingSyllabus ? 'updated' : 'created'
    });
  } catch (error) {
    console.error('Mains syllabus error:', error);
    handleError(res, error, 'Failed to process mains syllabus');
  }
};

// Get Mains Syllabus
const getMainsSyllabus = async (req, res) => {
  try {
    const syllabus = await Syllabus.findOne({ type: 'mains', isActive: true })
      .select('mains')
      .lean();

    if (!syllabus || !syllabus.mains) {
      return res.status(404).json({ 
        message: 'No active mains syllabus found' 
      });
    }

    res.json(cleanResponse(syllabus.mains));
  } catch (error) {
    handleError(res, error, 'Failed to fetch mains syllabus');
  }
};

module.exports = {
  createOrUpdatePrelims,
  createOrUpdateMains,
  getPrelimsSyllabus,
  getMainsSyllabus
};