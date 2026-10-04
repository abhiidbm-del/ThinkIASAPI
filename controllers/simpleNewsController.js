const SimpleNews = require('../models/SimpleNews');
const { publishSystemNotification } = require('../services/firebaseNotificationService');
const notifyNews = (news, user) => {
  if (news.isActive) publishSystemNotification({ title: 'News update', titleHindi: 'समाचार अपडेट', body: news.text.slice(0,500), bodyHindi: news.textHi.slice(0,500), type: 'news', audience: 'all', link: '/dashboard', createdBy: user._id }).catch(error => console.error('News notification:', error.message));
};

// Admin: Create news
const createNews = async (req, res) => {
  try {
    const { text, textHi, isActive = false } = req.body;
    const userId = req.user._id;

    if (!text || !textHi) {
      return res.status(400).json({ 
        message: 'English and Hindi text are required' 
      });
    }

    const news = await SimpleNews.create({
      text,
      textHi,
      isActive,
      createdBy: userId
    });
    notifyNews(news, req.user);

    res.status(201).json({
      message: 'News created successfully',
      news
    });

  } catch (error) {
    console.error('Create news error:', error);
    res.status(500).json({ 
      message: 'Failed to create news',
      error: error.message 
    });
  }
};

// Admin: Get all news
const getAllNews = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const news = await SimpleNews.find({ createdBy: userId })
      .sort({ createdAt: -1 })
      .select('text textHi isActive createdAt');

    res.json({
      message: 'News retrieved successfully',
      news
    });

  } catch (error) {
    console.error('Get all news error:', error);
    res.status(500).json({ 
      message: 'Failed to get news',
      error: error.message 
    });
  }
};

// Admin: Toggle status
const toggleNewsStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const news = await SimpleNews.findOne({
      _id: id,
      createdBy: userId
    });

    if (!news) {
      return res.status(404).json({ 
        message: 'News not found' 
      });
    }

    news.isActive = !news.isActive;
    await news.save();
    notifyNews(news, req.user);

    res.json({
      message: `News ${news.isActive ? 'activated' : 'deactivated'} successfully`,
      news
    });

  } catch (error) {
    console.error('Toggle news status error:', error);
    res.status(500).json({ 
      message: 'Failed to toggle news status',
      error: error.message 
    });
  }
};

// Admin: Delete news
const deleteNews = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const news = await SimpleNews.findOneAndDelete({
      _id: id,
      createdBy: userId
    });

    if (!news) {
      return res.status(404).json({ 
        message: 'News not found' 
      });
    }

    res.json({
      message: 'News deleted successfully'
    });

  } catch (error) {
    console.error('Delete news error:', error);
    res.status(500).json({ 
      message: 'Failed to delete news',
      error: error.message 
    });
  }
};

// Public: Get active news
const getActiveNews = async (req, res) => {
  try {
    // Get only the latest active news
    const news = await SimpleNews.findOne({
      isActive: true
    })
    .sort({ createdAt: -1 })
    .select('text textHi');

    // If no active news found, return default
    if (!news) {
      return res.json({
        message: 'No active news',
        news: {
          text: 'Welcome to ThinkCivil IAS - Your partner in UPSC preparation journey!',
          textHi: 'थिंकसिविल आईएएस में आपका स्वागत है - यूपीएससी की तैयारी की यात्रा में आपका साथी!'
        }
      });
    }

    res.json({
      message: 'Active news retrieved successfully',
      news
    });

  } catch (error) {
    console.error('Get active news error:', error);
    res.status(500).json({ 
      message: 'Failed to get news',
      error: error.message 
    });
  }
};

module.exports = {
  createNews,
  getAllNews,
  toggleNewsStatus,
  deleteNews,
  getActiveNews
};
