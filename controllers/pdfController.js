const PDFDocument = require('pdfkit');
const Test = require('../models/Test');
const { handleError } = require('../middleware/errorHandler');
const fs = require('fs');
const path = require('path');

// Simple test function
const testAPI = (req, res) => {
  console.log('✅ Test API called');
  res.json({ 
    message: 'PDF API is working!',
    timestamp: new Date().toISOString() 
  });
};

// Base64 question paper generation
const getQuestionPaperBase64 = async (req, res) => {
  try {
    console.log('📄 Request received for PDF base64');
    console.log('📦 Request Body:', req.body);
    
    const { testId, type = 'en' } = req.body || {};
    
    if (!testId) {
      return res.status(400).json({ 
        message: 'Test ID is required',
        receivedBody: req.body
      });
    }
    
    console.log(`🔍 Fetching test: ${testId}, Language: ${type}`);
    
    // Get test with questions
    const test = await Test.findById(testId)
      .populate({
        path: 'questions',
        select: '_id question description options uid'
      })
      .lean();
    
    if (!test) {
      console.log('❌ Test not found');
      return res.status(404).json({ message: 'Test not found' });
    }
    
    console.log(`✅ Test found: ${test.title}, Questions: ${test.questions?.length || 0}`);
    
    // Create PDF
    return new Promise((resolve, reject) => {
      // Try to load Hindi font if needed
      let hindiFontBuffer = null;
      const hindiFontPath = path.join(__dirname, '../public/fonts/NotoSansDevanagari-Regular.ttf');
      
      if (type === 'hi' && fs.existsSync(hindiFontPath)) {
        try {
          hindiFontBuffer = fs.readFileSync(hindiFontPath);
          console.log('✅ Hindi font loaded successfully');
        } catch (fontError) {
          console.log('⚠️ Could not load Hindi font:', fontError.message);
          hindiFontBuffer = null;
        }
      } else if (type === 'hi') {
        console.log('⚠️ Hindi font not found at:', hindiFontPath);
      }
      
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4'
      });
      
      // Register Hindi font if available
      if (hindiFontBuffer) {
        doc.registerFont('Hindi', hindiFontBuffer);
      }
      
      const chunks = [];
      
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('error', reject);
      
      doc.on('end', () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          const base64String = pdfBuffer.toString('base64');
          
          console.log(`✅ PDF generated: ${pdfBuffer.length} bytes`);
          
          res.json({
            success: true,
            message: 'Question paper generated successfully',
            base64: base64String,
            fileName: `question-paper-${testId}-${type}.pdf`,
            testTitle: test.title,
            totalQuestions: test.questions?.length || 0
          });
        } catch (error) {
          reject(error);
        }
      });
      
      // Add content to PDF
      addContentToPDF(doc, test, type, hindiFontBuffer);
      
      doc.end();
    });
    
  } catch (error) {
    console.error('❌ Error in getQuestionPaperBase64:', error);
    handleError(res, error, 'Failed to generate question paper');
  }
};

// Helper function to add content to PDF
function addContentToPDF(doc, test, type, hindiFontAvailable) {
  try {
    // Function to set appropriate font
    const setFont = (useHindi = false) => {
      if (useHindi && hindiFontAvailable) {
        doc.font('Hindi');
      } else {
        doc.font('Helvetica');
      }
    };
    
    const setFontBold = (useHindi = false) => {
      if (useHindi && hindiFontAvailable) {
        doc.font('Hindi');
        // Hindi font might not have bold, so we can simulate with font size
      } else {
        doc.font('Helvetica-Bold');
      }
    };
    
    // Header (always in English for branding)
    setFontBold(false);
    doc.fontSize(20)
       .fillColor('#2c3e50')
       .text('Think Civil IAS Academy', { align: 'center' });
    
    doc.moveDown(0.5);
    
    // Test title (check if we have Hindi title)
    let testTitle = test.title || 'Untitled Test';
    let isTestTitleHindi = false;
    
    if (typeof testTitle === 'object') {
      testTitle = getQuestionText(testTitle, type);
      isTestTitleHindi = isDevanagariScript(testTitle);
    }
    
    setFontBold(type === 'hi' && isTestTitleHindi);
    doc.fontSize(16)
       .fillColor('#34495e')
       .text(testTitle, { align: 'center' });
    
    doc.moveDown(0.5);
    
    // Language indicator
    const languageText = type === 'hi' ? 'हिन्दी प्रश्न पत्र' : 'English Question Paper';
    setFont(type === 'hi');
    doc.fontSize(12)
       .fillColor('#7f8c8d')
       .text(languageText, { align: 'center' });
    
    doc.moveDown(1);
    
    // Test details (always in English for consistency)
    setFont(false);
    doc.fontSize(10)
       .fillColor('#2c3e50');
    
    doc.text(`Test Title: ${typeof test.title === 'string' ? test.title : 'Test'}`);
    doc.text(`Total Questions: ${test.questions?.length || 0}`);
    doc.text(`Duration: ${test.duration || 0} minutes`);
    
    if (test.startTime) {
      const startTime = new Date(test.startTime).toLocaleString();
      doc.text(`Start Time: ${startTime}`);
    }
    
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#bdc3c7').stroke();
    doc.moveDown(1);
    
    // Instructions in appropriate language
    setFontBold(type === 'hi');
    doc.fontSize(12);
    
    if (type === 'hi') {
      doc.text('सामान्य निर्देश:');
    } else {
      doc.text('Instructions:');
    }
    
    doc.moveDown(0.3);
    setFont(type === 'hi');
    doc.fontSize(10);
    
    if (type === 'hi') {
      doc.text('1. सभी प्रश्न अनिवार्य हैं।');
      doc.text(`2. परीक्षा की अवधि: ${test.duration || 0} मिनट`);
      doc.text('3. प्रत्येक प्रश्न का उत्तर देने से पहले ध्यानपूर्वक पढ़ें।');
    } else {
      doc.text('1. All questions are compulsory.');
      doc.text(`2. Duration: ${test.duration || 0} minutes`);
      doc.text('3. Read each question carefully before answering.');
    }
    
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#bdc3c7').stroke();
    doc.moveDown(1.5);
    
    // Questions
    if (!test.questions || test.questions.length === 0) {
      setFont(type === 'hi');
      doc.fontSize(14);
      
      if (type === 'hi') {
        doc.text('इस परीक्षा के लिए कोई प्रश्न उपलब्ध नहीं हैं।', { align: 'center' });
      } else {
        doc.text('No questions available.', { align: 'center' });
      }
      return;
    }
    
    // Questions header
    setFontBold(type === 'hi');
    doc.fontSize(14);
    
    if (type === 'hi') {
      doc.text('प्रश्न:');
    } else {
      doc.text('Questions:');
    }
    
    doc.moveDown(0.5);
    
    test.questions.forEach((question, index) => {
      const qNum = index + 1;
      
      // Check for new page
      if (doc.y > 700) {
        doc.addPage();
      }
      
      // Get question text
      const questionText = getQuestionText(question.question, type);
      const isQuestionHindi = isDevanagariScript(questionText);
      
      // Question prefix based on language
      let questionPrefix;
      if (type === 'hi') {
        questionPrefix = `प्र${qNum}.`;
      } else {
        questionPrefix = `Q${qNum}.`;
      }
      
      // Question number and text
      setFontBold(isQuestionHindi);
      doc.fontSize(11)
         .text(questionPrefix, { continued: true });
      
      setFont(isQuestionHindi);
      doc.fontSize(11)
         .text(` ${questionText}`);
      
      doc.moveDown(0.5);
      
      // Options
      if (question.options && question.options.length > 0) {
        const optionLabels = type === 'hi' ? ['क', 'ख', 'ग', 'घ'] : ['A', 'B', 'C', 'D'];
        
        question.options.forEach((option, optIndex) => {
          // Get option text
          const optionText = getQuestionText(option, type);
          const isOptionHindi = isDevanagariScript(optionText);
          
          // Option label and text
          setFont(isOptionHindi);
          doc.fontSize(10);
          
          const label = optionLabels[optIndex];
          doc.text(`  ${label}. ${optionText}`, { indent: 20 });
        });
      }
      
      doc.moveDown(1.2);
    });
    
  } catch (error) {
    console.error('Error in addContentToPDF:', error);
    throw error;
  }
}

// Improved helper function to get text based on language
function getQuestionText(multilingualText, type) {
  if (!multilingualText) return '';
  
  // If it's already a string, return it
  if (typeof multilingualText === 'string') {
    return multilingualText;
  }
  
  // If it's an object with language properties
  if (typeof multilingualText === 'object' && multilingualText !== null) {
    // For debugging
    console.log(`🔍 Checking text for type: ${type}`, multilingualText);
    
    // Try to get text in requested language
    if (type === 'hi') {
      // For Hindi: check hindi property first
      if (multilingualText.hindi && multilingualText.hindi.trim() !== '') {
        console.log(`✅ Found Hindi text: ${multilingualText.hindi.substring(0, 50)}...`);
        return multilingualText.hindi;
      }
      // If no Hindi, fallback to English
      if (multilingualText.english && multilingualText.english.trim() !== '') {
        console.log(`⚠️ No Hindi text, using English: ${multilingualText.english.substring(0, 50)}...`);
        return multilingualText.english;
      }
    } else if (type === 'en') {
      // For English: check english property first
      if (multilingualText.english && multilingualText.english.trim() !== '') {
        return multilingualText.english;
      }
      // If no English, fallback to Hindi
      if (multilingualText.hindi && multilingualText.hindi.trim() !== '') {
        return multilingualText.hindi;
      }
    }
    
    // Try any property that might contain text
    for (const key in multilingualText) {
      if (typeof multilingualText[key] === 'string' && multilingualText[key].trim() !== '') {
        return multilingualText[key];
      }
    }
  }
  
  console.log(`⚠️ No text found for type: ${type}`);
  return type === 'hi' ? 'कोई पाठ उपलब्ध नहीं' : 'No text available';
}

// Helper function to detect if text contains Devanagari (Hindi) characters
function isDevanagariScript(text) {
  if (!text || typeof text !== 'string') return false;
  
  // Devanagari Unicode range: U+0900 to U+097F
  const devanagariRegex = /[\u0900-\u097F]/;
  return devanagariRegex.test(text);
}

// Export functions
module.exports = {
  testAPI,
  getQuestionPaperBase64
};