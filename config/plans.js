// config/plans.js
const PLANS = {
  PRE: {
    id: 'pre',
    name: 'PRELIMS Mentorship with Test Series (2026)',
    nameHindi: 'प्रारंभिक परीक्षा मार्गदर्शन और टेस्ट सीरीज़ (2026)',
    featuresHindi: ['प्रारंभिक परीक्षा के पूरे पाठ्यक्रम की तैयारी', 'विस्तृत विश्लेषण के साथ 50 से अधिक मॉक टेस्ट', 'दैनिक समसामयिकी अपडेट', 'व्यक्तिगत मार्गदर्शन', 'शंका समाधान सत्र', 'अध्ययन सामग्री PDF'],
    baseAmount: 5999,
    totalAmount: 5999, // GST included
    duration: '',
    features: [
      'Complete Prelims syllabus coverage',
      '50+ Mock Tests with detailed analysis',
      'Daily current affairs updates',
      'Personal mentorship',
      'Doubt clearing sessions',
      'Study material PDFs'
    ]
  },
  MAINS: {
    id: 'mains',
    name: 'MAINS Mentorship',
    nameHindi: 'मुख्य परीक्षा मार्गदर्शन',
    featuresHindi: ['मुख्य परीक्षा के पूरे पाठ्यक्रम की तैयारी', 'उत्तर लेखन अभ्यास', '30 से अधिक मॉक टेस्ट', 'व्यक्तिगत मार्गदर्शन', 'निबंध मार्गदर्शन', 'वैकल्पिक विषय सहायता'],
    baseAmount: 14999,
    totalAmount: 14999, // GST included
    duration: '',
    features: [
      'Complete Mains syllabus coverage',
      'Answer writing practice',
      '30+ Mock Tests',
      'One-on-one mentorship',
      'Essay guidance',
      'Optional subject support'
    ]
  },
  COMBO: {
    id: 'combo',
    name: 'COMBO Mentorship (Prelims + Mains)',
    nameHindi: 'संयुक्त मार्गदर्शन (प्रारंभिक और मुख्य परीक्षा)',
    featuresHindi: ['प्रारंभिक और मुख्य परीक्षा की संपूर्ण तैयारी', 'सभी टेस्ट सीरीज़ शामिल', 'संपूर्ण मार्गदर्शन', 'प्राथमिकता से शंका समाधान', 'साक्षात्कार मार्गदर्शन', '₹4,999 बचाएँ'],
    baseAmount: 19999,
    totalAmount: 19999, // GST included
    duration: '',
    features: [
      'Complete Prelims + Mains coverage',
      'All test series included',
      'Comprehensive mentorship',
      'Priority doubt resolution',
      'Interview guidance',
      'Save ₹4,999'
    ]
  }
};

// Since GST is included, totalAmount is same as baseAmount
const calculateTotal = (baseAmount) => baseAmount;

const getPlanDetails = (planId) => {
  return PLANS[planId.toUpperCase()] || null;
};

module.exports = {
  PLANS,
  calculateTotal,
  getPlanDetails
};
