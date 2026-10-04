// controllers/configController.js
exports.getRazorpayConfig = async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ success: false, message: 'Payment gateway is not configured' });
    }
    // Only send the key_id, never send the key_secret to frontend
    res.json({
      success: true,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      currency: 'INR'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get payment configuration'
    });
  }
};
