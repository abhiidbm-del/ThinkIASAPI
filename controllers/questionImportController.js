const Question = require('../models/Question');
const Tag = require('../models/Tag');
const { parseCSV, validateQuestions, parseQuestionImportFile, removeDuplicateQuestions, removeExistingQuestions } = require('../utils/questionImport');
const { fetchSheetQuestions } = require('../utils/googleSheetImport');

const mergeBilingualQuestions = (files, parsedFiles) => {
  if (files.length !== 2 || parsedFiles.some(items => !items.length)) {
    throw new Error('Both English and Hindi DOCX files must contain questions.');
  }

  const hindiIndex = files.findIndex(file => /hindi|हिंदी/i.test(file.originalname));
  const englishIndex = files.findIndex(file => /english|अंग्रेजी/i.test(file.originalname));
  const hindiQuestions = parsedFiles[hindiIndex >= 0 ? hindiIndex : 1];
  const englishQuestions = parsedFiles[englishIndex >= 0 ? englishIndex : 0];

  if (englishQuestions.length !== hindiQuestions.length) {
    throw new Error(`English and Hindi DOCX files must contain the same number of questions. Found ${englishQuestions.length} English and ${hindiQuestions.length} Hindi.`);
  }

  return englishQuestions.map((english, index) => {
    const hindi = hindiQuestions[index];
    return {
      question: { english: english.question.english, hindi: hindi.question.english },
      description: { english: english.description?.english || '', hindi: hindi.description?.english || '' },
      options: english.options.map((option, optionIndex) => ({
        english: option.english,
        hindi: hindi.options[optionIndex]?.english || ''
      })),
      correctAnswer: english.correctAnswer,
      tags: [...new Set([...(english.tags || []), ...(hindi.tags || [])])]
    };
  });
};

const applyImportTags = (input, body) => {
  let questionTags = body.questionTags;
  let importTags = body.importTags;

  if (typeof questionTags === 'string') questionTags = JSON.parse(questionTags);
  if (typeof importTags === 'string') importTags = JSON.parse(importTags);

  if (importTags !== undefined && (!Array.isArray(importTags) || importTags.some(tag => typeof tag !== 'string'))) {
    throw new Error('Import tags must be a list of tag IDs.');
  }

  if (questionTags !== undefined) {
    if (!Array.isArray(questionTags) || questionTags.length !== input.length || questionTags.some(tag => typeof tag !== 'string')) {
      throw new Error('Provide one tag selection for each imported question.');
    }
    return input.map((item, index) => ({
      ...item,
      tags: questionTags[index] ? [questionTags[index]] : []
    }));
  }

  if (Array.isArray(importTags) && importTags.length) {
    return input.map(item => ({ ...item, tags: [...new Set([...(item.tags || []), ...importTags])] }));
  }

  return input;
};

const prepareImportQuestions = async (input, body) => {
  validateQuestions(input);
  const fileDeduplication = removeDuplicateQuestions(input);
  const taggedQuestions = applyImportTags(fileDeduplication.questions, body);
  const existingQuestions = await Question.find().select('question.english question.hindi').lean();
  const bankDeduplication = removeExistingQuestions(taggedQuestions, existingQuestions, fileDeduplication.questionIndices);

  return {
    questions: bankDeduplication.questions,
    duplicateQuestions: [...fileDeduplication.duplicateQuestions, ...bankDeduplication.duplicateQuestions]
  };
};

const noNewQuestionsResponse = (duplicateQuestions) => ({
  success: true,
  count: 0,
  message: `No new questions imported. ${duplicateQuestions.length} repeated or already-added question(s) were skipped.`,
  messageHindi: `कोई नया प्रश्न आयात नहीं हुआ। ${duplicateQuestions.length} दोहराए गए या पहले से जोड़े गए प्रश्न छोड़ दिए गए।`,
  questions: [],
  duplicateQuestions
});

const saveQuestions = async (req, input) => {
  validateQuestions(input);
  const tags = await Tag.find().select('_id tag').lean();
  const tagLookup = new Map(tags.flatMap(tag => [[String(tag._id), String(tag._id)], [String(tag.tag).toLowerCase(), String(tag._id)]]));
  const documents = input.map((item, index) => ({
    question: item.question,
    description: item.description || { english: '', hindi: '' },
    options: item.options,
    correctAnswer: item.correctAnswer,
    tags: (item.tags || []).map(tag => {
      const id = tagLookup.get(tag.toLowerCase());
      if (!id) throw new Error(`Question ${index + 1}: unknown tag "${tag}". Create the tag first.`);
      return id;
    }),
    createdBy: req.user._id
  }));
  await Promise.all(documents.map(document => new Question(document).validate()));
  if (req.body.preview === 'true' || req.body.preview === true) return { preview: true, count: documents.length, questions: documents };
  const saved = await Question.insertMany(documents, { ordered: true });
  return { preview: false, count: saved.length, message: `${saved.length} questions imported.`, messageHindi: `${saved.length} प्रश्न आयात किए गए।` };
};

exports.importQuestions = async (req, res) => {
  try {
    let input = req.body.questions;
    const files = req.files || (req.file ? [req.file] : []);
    if (files.length) {
      const parsedFiles = await Promise.all(files.map(file => parseQuestionImportFile(file.buffer, file.originalname)));
      if (files.length === 2) {
        if (files.some(file => !/\.docx?$/i.test(file.originalname))) {
          throw new Error('Select two DOCX files when importing English and Hindi together.');
        }
        input = mergeBilingualQuestions(files, parsedFiles);
      } else {
        input = parsedFiles[0];
      }
      if (!Array.isArray(input)) input = input.questions;
    }
    const prepared = await prepareImportQuestions(input, req.body);
    input = prepared.questions;
    if (!input.length) {
      const response = noNewQuestionsResponse(prepared.duplicateQuestions);
      if (req.body.preview === 'true' || req.body.preview === true) return res.json(response);
      return res.json(response);
    }
    const result = await saveQuestions(req, input);
    if (result.preview) return res.json({ success: true, count: result.count, questions: result.questions, duplicateQuestions: prepared.duplicateQuestions });
    res.status(201).json({ success: true, count: result.count, message: result.message, messageHindi: result.messageHindi, duplicateQuestions: prepared.duplicateQuestions });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.importFromSheet = async (req, res) => {
  try {
    const input = await fetchSheetQuestions(req.body.url);
    const prepared = await prepareImportQuestions(input, req.body);
    if (!prepared.questions.length) {
      const response = noNewQuestionsResponse(prepared.duplicateQuestions);
      if (req.body.preview === 'true' || req.body.preview === true) return res.json(response);
      return res.json(response);
    }
    const result = await saveQuestions(req, prepared.questions);
    if (result.preview) return res.json({ success: true, count: result.count, questions: result.questions, duplicateQuestions: prepared.duplicateQuestions });
    res.status(201).json({ success: true, count: result.count, message: result.message, messageHindi: result.messageHindi, duplicateQuestions: prepared.duplicateQuestions });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.mergeBilingualQuestions = mergeBilingualQuestions;
