const PDFDocument = require('pdfkit');
const Test = require('../models/Test');
const { handleError } = require('../middleware/errorHandler');
const { attachDevanagariShaping } = require('../utils/devanagariShape');
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
      .lean({ virtuals: true });
    
    if (!test) {
      console.log('❌ Test not found');
      return res.status(404).json({ message: 'Test not found' });
    }
    
    console.log(`✅ Test found: ${test.title}, Questions: ${test.questions?.length || 0}`);
    
    let hindiFontBuffer = null;
    const hindiFontPath = path.join(__dirname, '../public/fonts/NotoSansDevanagari-Regular.ttf');

    if (fs.existsSync(hindiFontPath)) {
      try {
        hindiFontBuffer = fs.readFileSync(hindiFontPath);
      } catch (fontError) {
        console.log('⚠️ Could not load Hindi font:', fontError.message);
        hindiFontBuffer = null;
      }
    }

    if (Array.isArray(test.questionUids) && Array.isArray(test.questions)) {
      const order = new Map(test.questionUids.map((uid, index) => [String(uid), index]));
      test.questions.sort((a, b) => (order.get(String(a.uid)) ?? 0) - (order.get(String(b.uid)) ?? 0));
    }

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 28, bottom: 18, left: 28, right: 28 }
    });

    if (hindiFontBuffer) {
      doc.registerFont('Hindi', hindiFontBuffer);
      doc.font('Hindi');
      await attachDevanagariShaping(doc._font.font, hindiFontBuffer);
    }

    // Create PDF
    return new Promise((resolve, reject) => {
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

// UPSC CSE booklet: cover with instructions, then two-column questions.
function addContentToPDF(doc, test, type, hindiFontAvailable) {
  const hindi = type === 'hi';
  const hiFont = hindiFontAvailable ? 'Hindi' : 'Times-Roman';
  const bodyFont = hindi ? hiFont : 'Times-Roman';
  const pageWidth = doc.page.width;
  const marginL = 32;
  const marginR = 32;
  const gutter = 16;
  const colW = (pageWidth - marginL - marginR - gutter) / 2;
  const top = 34;
  const bottom = 790;
  const contentWidth = pageWidth - marginL - marginR;
  const questions = Array.isArray(test.questions) ? test.questions : [];
  const questionCount = questions.length;
  const marksEach = Number(test.marksPerQuestion) || 2;
  const totalMarks = questionCount * marksEach;
  let pageNum = 1;
  let y = 40;
  let col = 0;

  const durationLabel = () => {
    const mins = Number(test.duration) || 0;
    if (mins === 120) return hindi ? 'दो घण्टे' : 'Two Hours';
    if (mins > 0 && mins % 60 === 0) {
      const hours = mins / 60;
      const words = { 1: 'एक', 2: 'दो', 3: 'तीन', 4: 'चार' };
      return hindi ? `${words[hours] || hours} घण्टे` : `${hours} Hour${hours > 1 ? 's' : ''}`;
    }
    return hindi ? `${mins} मिनट` : `${mins} Minutes`;
  };

  const paintFooter = () => {
    const footerY = 808;
    doc.font('Helvetica').fontSize(9).fillColor('#111111');
    doc.text('THINK-IAS', marginL, footerY, { width: 160, lineBreak: false });
    doc.text(`( ${pageNum} – A )`, 0, footerY, { width: pageWidth, align: 'center', lineBreak: false });
  };

  const paintDivider = () => {
    const midX = marginL + colW + gutter / 2;
    doc.save();
    doc.moveTo(midX, top).lineTo(midX, bottom).strokeColor('#111111').lineWidth(0.7).stroke();
    doc.restore();
  };

  const advanceColumn = () => {
    if (col === 0) {
      col = 1;
      y = top;
      return;
    }
    paintFooter();
    doc.addPage();
    pageNum += 1;
    col = 0;
    y = top;
    paintDivider();
  };

  const coverBreak = (height) => {
    if (y + height <= 800) return;
    paintFooter();
    doc.addPage();
    pageNum += 1;
    y = 40;
  };

  const writeInstruction = (label, body) => {
    const font = hindi ? hiFont : 'Times-Roman';
    const labelWidth = label.length > 2 ? 28 : 16;
    const bodyWidth = contentWidth - labelWidth - 4;
    doc.font(font).fontSize(8.4);
    const height = doc.heightOfString(body, { width: bodyWidth, align: 'justify' });
    coverBreak(height + 4);
    const shown = label.startsWith('(') ? label : `${label}.`;
    doc.font('Times-Bold').fontSize(8.4).fillColor('#111111')
      .text(shown, marginL, y, { width: labelWidth, lineBreak: false });
    doc.font(font).fontSize(8.4).fillColor('#111111')
      .text(body, marginL + labelWidth + 2, y, { width: bodyWidth, align: 'justify' });
    y = doc.y + 3;
  };

  const paperTitle = typeof test.title === 'string' && test.title.trim()
    ? test.title.trim()
    : (hindi ? 'सामान्य अध्ययन' : 'General Studies');

  doc.font('Times-Bold').fontSize(18).fillColor('#3f6fa3')
    .text('Civil Services (Preliminary)', marginL, y, { width: contentWidth, align: 'center' });
  y = doc.y + 1;
  doc.font('Times-Bold').fontSize(18).fillColor('#3f6fa3')
    .text('Examination', marginL, y, { width: contentWidth, align: 'center' });
  y = doc.y + 8;

  doc.moveTo(marginL, y).lineTo(pageWidth - marginR, y).strokeColor('#111111').lineWidth(1.2).stroke();
  y += 4;
  const warning = hindiFontAvailable
    ? 'जब तक आपको यह परीक्षा पुस्तिका खोलने के न कहा जाए तब तक न खोलें'
    : 'Do not open this test booklet until you are told to do so';
  doc.font(hindiFontAvailable ? hiFont : 'Times-Bold').fontSize(9).fillColor('#111111')
    .text(warning, marginL, y, { width: contentWidth, align: 'center' });
  y = doc.y + 3;
  doc.moveTo(marginL, y).lineTo(pageWidth - marginR, y).strokeColor('#111111').lineWidth(1.2).stroke();
  y += 10;

  doc.font('Times-Bold').fontSize(11).fillColor('#111111')
    .text('T.B.C. : THINK-IAS', marginL, y, { width: 280 });
  const serialTop = y;
  doc.font(hindi ? hiFont : 'Times-Bold').fontSize(9)
    .text(hindi ? 'परीक्षा पुस्तिका अनुक्रम' : 'Test Booklet Series', pageWidth - marginR - 180, serialTop, { width: 180, align: 'right' });
  y = Math.max(doc.y, serialTop + 16) + 8;

  const boxW = 72;
  const boxH = 84;
  const boxX = pageWidth - marginR - boxW;
  const boxY = y;
  doc.lineWidth(2.2).rect(boxX, boxY, boxW, boxH).strokeColor('#111111').stroke();
  doc.font('Helvetica-Bold').fontSize(48).fillColor('#111111')
    .text('A', boxX, boxY + 16, { width: boxW, align: 'center', lineBreak: false });

  const midWidth = boxX - marginL - 16;
  const midLines = hindi
    ? ['परीक्षा पुस्तिका', paperTitle, 'प्रश्न-पत्र']
    : ['Test Booklet', paperTitle, 'Question Paper'];
  let midY = y + 6;
  midLines.forEach((line) => {
    doc.font(hindi ? hiFont : 'Times-Bold').fontSize(13).fillColor('#111111')
      .text(line, marginL, midY, { width: midWidth, align: 'center' });
    midY = doc.y + 2;
  });
  y = Math.max(boxY + boxH, midY) + 8;

  doc.font(hindi ? hiFont : 'Times-BoldItalic').fontSize(11).fillColor('#111111')
    .text(hindi ? `समय : ${durationLabel()}` : `Time Allowed : ${durationLabel()}`, marginL, y, { width: contentWidth / 2 });
  doc.text(
    hindi ? `पूर्णांक : ${totalMarks}` : `Maximum Marks : ${totalMarks}`,
    marginL + contentWidth / 2,
    y,
    { width: contentWidth / 2, align: 'right' }
  );
  y = doc.y + 4;
  doc.moveTo(marginL, y).lineTo(pageWidth - marginR, y).strokeColor('#111111').lineWidth(1.2).stroke();
  y += 8;

  doc.font(hindi ? hiFont : 'Times-Bold').fontSize(12).fillColor('#111111')
    .text(hindi ? 'अनुदेश' : 'INSTRUCTIONS', marginL, y, { width: contentWidth, align: 'center', underline: true });
  y = doc.y + 6;

  const instructions = hindi ? [
    ['1', 'परीक्षा प्रारम्भ होने के तुरन्त बाद, आप इस परीक्षा पुस्तिका की पड़ताल अवश्य कर लें कि इसमें कोई बिना छपा, फटा या छूटा हुआ पृष्ठ अथवा प्रश्नांश आदि न हो। यदि ऐसा है, तो इसे सही परीक्षा पुस्तिका से बदल लें।'],
    ['2', 'OMR उत्तर-पत्रक में उचित स्थान पर रोल नम्बर और परीक्षा पुस्तिका अनुक्रम A, B, C या D को ध्यान से भरना केवल उम्मीदवार की जिम्मेदारी है। किसी भी चूक या विसंगति पर उत्तर-पत्रक निरस्त कर दिया जाएगा।'],
    ['3', 'इस परीक्षा पुस्तिका पर दिए गए कोष्ठक में अपना अनुक्रमांक लिखें। परीक्षा पुस्तिका पर और कुछ न लिखें।'],
    ['4', `इस परीक्षा पुस्तिका में ${questionCount} प्रश्नांश (प्रश्न) दिए गए हैं। प्रत्येक प्रश्नांश में चार प्रत्युत्तर (उत्तर) दिए गए हैं। इनमें से एक प्रत्युत्तर चुनें। यदि एक से अधिक प्रत्युत्तर सही लगें, तो वही अंकित करें जो सर्वाधिक सही लगे। प्रत्येक प्रश्नांश के लिए केवल एक ही प्रत्युत्तर चुनना है।`],
    ['5', 'अपने सभी प्रत्युत्तर अलग से दिए गए उत्तर-पत्रक पर ही अंकित करें। उत्तर-पत्रक में दिए गए निर्देश देखें।'],
    ['6', 'सभी प्रश्नांशों के अंक समान हैं।'],
    ['7', 'प्रत्युत्तर अंकित करने से पहले, प्रवेश प्रमाण-पत्र के साथ प्रेषित अनुदेशों के अनुसार उत्तर-पत्रक में आवश्यक विवरण भरें।'],
    ['8', 'उत्तर-पत्रक भरने के बाद तथा परीक्षा के समापन पर केवल उत्तर-पत्रक अधीक्षक को सौंप दें। परीक्षा पुस्तिका अपने साथ ले जा सकते हैं।'],
    ['9', 'कच्चे काम के लिए पत्रक परीक्षा पुस्तिका के अंत में संलग्न हैं।'],
    ['10', 'गलत उत्तरों के लिए दंड : उम्मीदवार द्वारा दिए गए गलत उत्तरों के लिए दंड दिया जाएगा।'],
    ['(i)', 'प्रत्येक प्रश्नांश के चार उत्तर हैं। प्रत्येक गलत उत्तर के लिए उस प्रश्न के अंकों का एक-तिहाई दंड के रूप में काटा जाएगा।'],
    ['(ii)', 'एक से अधिक उत्तर देने पर उत्तर गलत माना जाएगा, भले ही उनमें एक उत्तर सही हो, और उसी तरह का दंड दिया जाएगा।'],
    ['(iii)', 'यदि प्रश्न का उत्तर नहीं दिया जाता है, तो उस प्रश्न के लिए कोई दंड नहीं दिया जाएगा।']
  ] : [
    ['1', 'Immediately after the commencement of the examination, check that this test booklet does not have any unprinted, torn or missing page or item. If so, get it replaced by a complete test booklet.'],
    ['2', 'It is the candidate’s responsibility to fill and encode the Roll Number and Test Booklet Series A, B, C or D at the appropriate places on the OMR Answer Sheet. Any omission or discrepancy will render the Answer Sheet liable for rejection.'],
    ['3', 'Enter your Roll Number in the box provided on this test booklet. Do not write anything else on the test booklet.'],
    ['4', `This test booklet contains ${questionCount} items (questions). Each item has four responses (answers). Choose the response you consider the best. Choose only one response for each item.`],
    ['5', 'Mark all your responses only on the separate Answer Sheet provided. Read the directions on the Answer Sheet.'],
    ['6', 'All items carry equal marks.'],
    ['7', 'Before you mark your responses, fill in the particulars on the Answer Sheet as given in the instructions sent with your Admission Certificate.'],
    ['8', 'After the examination, hand over only the Answer Sheet to the Invigilator. You may take the test booklet with you.'],
    ['9', 'Sheets for rough work are appended at the end of the test booklet.'],
    ['10', 'Penalty for wrong answers: there will be a penalty for wrong answers marked by a candidate.'],
    ['(i)', 'Each question has four alternatives. For each wrong answer, one-third of the marks assigned to that question will be deducted as penalty.'],
    ['(ii)', 'If more than one answer is given, it will be treated as a wrong answer even if one of the given answers is correct, and the same penalty will apply.'],
    ['(iii)', 'If a question is left blank, there will be no penalty for that question.']
  ];

  instructions.forEach(([label, body]) => writeInstruction(label, body));

  if (hindi) {
    y += 6;
    coverBreak(20);
    doc.font('Times-Italic').fontSize(8).fillColor('#111111')
      .text('Note : English version of the instructions is printed on the back cover of this Booklet.', marginL, y, { width: contentWidth });
  }

  paintFooter();
  doc.addPage();
  pageNum += 1;
  col = 0;
  y = top;
  paintDivider();

  if (questionCount === 0) {
    doc.font(bodyFont).fontSize(12).fillColor('#111111')
      .text(hindi ? 'इस परीक्षा के लिए कोई प्रश्न उपलब्ध नहीं हैं।' : 'No questions available for this test.', marginL, top, { width: contentWidth, align: 'center' });
    paintFooter();
    return;
  }

  const placeBlock = (lines) => {
    const measure = () => lines.reduce((sum, line) => {
      doc.font(line.font).fontSize(line.size);
      return sum + doc.heightOfString(line.text, { width: colW - line.indent, lineGap: 1 }) + line.gap;
    }, 6);
    if (measure() <= bottom - top && y + measure() > bottom) advanceColumn();
    lines.forEach((line) => {
      doc.font(line.font).fontSize(line.size).fillColor('#111111');
      const width = colW - line.indent;
      const height = doc.heightOfString(line.text, { width, lineGap: 1 });
      if (y + height > bottom) advanceColumn();
      const x = marginL + col * (colW + gutter) + line.indent;
      doc.text(line.text, x, y, { width, lineGap: 1 });
      y = doc.y + line.gap;
    });
    y += 8;
  };

  questions.forEach((question, index) => {
    const lines = [];
    const questionText = getQuestionText(question.question, type);
    lines.push({ text: `${index + 1}.  ${questionText}`, font: bodyFont, size: 10.5, indent: 0, gap: 3 });
    (question.options || []).forEach((option, optIndex) => {
      const label = `(${String.fromCharCode(97 + optIndex)})`;
      lines.push({
        text: `${label}  ${getQuestionText(option, type)}`,
        font: bodyFont,
        size: 10,
        indent: 4,
        gap: 2
      });
    });
    placeBlock(lines);
  });

  paintFooter();
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
    if (type === 'hi') {
      if (multilingualText.hindi && multilingualText.hindi.trim() !== '') {
        return multilingualText.hindi;
      }
      if (multilingualText.english && multilingualText.english.trim() !== '') {
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
  getQuestionPaperBase64,
  addContentToPDF
};