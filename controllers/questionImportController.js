const Question = require('../models/Question');
const Tag = require('../models/Tag');
const { parseCSV, validateQuestions, parseQuestionImportFile } = require('../utils/questionImport');
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
    let importTags = req.body.importTags;
    if (typeof importTags === 'string') importTags = JSON.parse(importTags);
    if (importTags !== undefined && (!Array.isArray(importTags) || importTags.some(tag => typeof tag !== 'string'))) {
      throw new Error('Import tags must be a list of tag IDs.');
    }
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
    if (Array.isArray(importTags) && importTags.length) {
      input = input.map(item => ({ ...item, tags: [...new Set([...(item.tags || []), ...importTags])] }));
    }
    const result = await saveQuestions(req, input);
    if (result.preview) return res.json({ success: true, count: result.count, questions: result.questions });
    res.status(201).json({ success: true, count: result.count, message: result.message, messageHindi: result.messageHindi });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.importFromSheet = async (req, res) => {
  try {
    const input = await fetchSheetQuestions(req.body.url);
    let importTags = req.body.importTags;
    if (typeof importTags === 'string') importTags = JSON.parse(importTags);
    const taggedInput = Array.isArray(importTags) && importTags.length
      ? input.map(item => ({ ...item, tags: [...new Set([...(item.tags || []), ...importTags])] }))
      : input;
    const result = await saveQuestions(req, taggedInput);
    if (result.preview) return res.json({ success: true, count: result.count, questions: result.questions });
    res.status(201).json({ success: true, count: result.count, message: result.message, messageHindi: result.messageHindi });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.mergeBilingualQuestions = mergeBilingualQuestions;
