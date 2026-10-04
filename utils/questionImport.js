const mammoth = require('mammoth');

function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && c === ',') { row.push(cell); cell = ''; }
    else if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); if (row.some(value => value.trim())) rows.push(row);
      row = []; cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  row.push(cell); if (row.some(value => value.trim())) rows.push(row);
  const headers = rows.shift();
  if (!headers) throw new Error('The file is empty.');
  const keys = headers.map(header => header.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  if (new Set(keys).size !== keys.length) throw new Error('CSV contains duplicate headers.');
  return rows.map((values, index) => {
    if (values.length !== keys.length) throw new Error(`Row ${index + 2}: column count does not match the header.`);
    const item = Object.fromEntries(keys.map((key, i) => [key, values[i].trim()]));
    const answer = item.correctanswer?.trim().toUpperCase();
    return {
      question: { english: item.questionenglish || '', hindi: item.questionhindi || '' },
      description: { english: item.descriptionenglish || '', hindi: item.descriptionhindi || '' },
      options: [0, 1, 2, 3].map(i => ({
        english: item[`option${'abcd'[i]}english`] ?? item.optionsenglish?.split(' | ')[i] ?? '',
        hindi: item[`option${'abcd'[i]}hindi`] ?? item.optionshindi?.split(' | ')[i] ?? ''
      })),
      correctAnswer: /^[A-D]$/.test(answer) ? answer.charCodeAt(0) - 65 : answer && /^[0-3]$/.test(answer) ? Number(answer) : -1,
      tags: (item.tags || '').split(/[,;]/).map(value => value.trim()).filter(Boolean)
    };
  });
}

function parseDocumentQuestionBlock(blockText) {
  const lines = blockText
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.replace(/\u00a0/g, ' ').trim())
    .filter(line => line.length > 0);

  if (!lines.length) return null;

  const answerMatch = blockText.match(/(?:Answer|उत्तर)\s*[:\-]?\s*(?:\(([A-Da-d])\)|\b([A-Da-d])\b)/i);
  const answerLetter = (answerMatch?.[1] || answerMatch?.[2] || '').toUpperCase();
  const answerIndex = 'ABCD'.indexOf(answerLetter);
  const answerStart = blockText.search(/(?:Answer|उत्तर)\s*[:\-]?/i);

  const explanationMatch = blockText.match(/(?:Explanation|व्याख्या)\s*[:\-]?\s*(.*)/is);
  const explanationText = explanationMatch ? explanationMatch[1].trim() : '';

  const optionStart = blockText.search(/\([A-Da-d]\)\s*/);
  const questionSection = optionStart >= 0 ? blockText.slice(0, optionStart) : blockText;
  const optionEnd = answerStart >= 0 ? answerStart : blockText.length;
  const inlineOptions = optionStart >= 0 ? blockText.slice(optionStart, optionEnd) : '';
  let questionParts = [];
  const optionParts = {};
  let inExplanation = false;

  for (const optionMatch of inlineOptions.matchAll(/\(([A-Da-d])\)\s*([\s\S]*?)(?=\([A-Da-d]\)\s*|$)/g)) {
    optionParts[optionMatch[1].toUpperCase()] = optionMatch[2].trim();
  }

  for (const line of questionSection.split('\n').map(value => value.trim()).filter(Boolean)) {
    if (/^(?:Answer|उत्तर)\s*[:\-]?/i.test(line)) {
      continue;
    }
    if (/^(?:Explanation|व्याख्या)\s*[:\-]?/i.test(line)) {
      inExplanation = true;
      continue;
    }
    if (inExplanation) {
      continue;
    }

    const optionMatch = line.match(/^\(?([A-Da-d])\)?[.)]\s*(.*)$/);
    if (optionMatch) {
      optionParts[optionMatch[1].toUpperCase()] = optionMatch[2].trim();
      continue;
    }

    questionParts.push(line);
  }

  const questionText = questionParts
    .join(' ')
    .replace(/^\d+[\.)]\s*/i, '')
    .replace(/^(?:Question|प्रश्न)\s*\d+\s*[:\.-]?\s*/i, '')
    .trim();
  const cleanExplanation = explanationText || '';

  const optionValues = ['A', 'B', 'C', 'D'].map(letter => {
    const value = optionParts[letter] || '';
    return { english: value, hindi: value };
  });

  if (!questionText || optionValues.every(option => !option.english)) {
    return null;
  }

  return {
    question: { english: questionText, hindi: questionText },
    description: { english: cleanExplanation, hindi: cleanExplanation },
    options: optionValues,
    correctAnswer: answerIndex >= 0 ? answerIndex : 0,
    tags: []
  };
}

function parseDocumentTextQuestions(text) {
  const normalized = String(text || '').replace(/\r/g, '\n').replace(/\u00a0/g, ' ');
  const blocks = [];
  const lines = normalized.split('\n');
  let current = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(?:Q(?:uestion)?\s*)?\d+\s*[\.)]/i.test(trimmed)) {
      if (current.length) {
        blocks.push(current.join('\n'));
      }
      current = [trimmed];
      continue;
    }

    if (trimmed) current.push(trimmed);
  }

  if (current.length) {
    blocks.push(current.join('\n'));
  }

  if (!blocks.length) {
    const fallback = normalized.trim();
    if (fallback) return [parseDocumentQuestionBlock(fallback)].filter(Boolean);
    return [];
  }

  return blocks.map(parseDocumentQuestionBlock).filter(Boolean);
}

async function parseQuestionImportFile(fileBuffer, fileName) {
  if (!Buffer.isBuffer(fileBuffer)) {
    throw new Error('No file content was provided.');
  }

  const lowerName = String(fileName || '').toLowerCase();
  const isZipDocument = fileBuffer.length >= 4 && fileBuffer.subarray(0, 4).toString('hex') === '504b0304';

  if (/\.json$/i.test(lowerName) && isZipDocument) {
    throw new Error('This file contains a DOCX document but has a .json extension. Rename it to .docx and upload it again.');
  }

  if (/\.csv$/i.test(lowerName)) {
    return parseCSV(fileBuffer.toString('utf8'));
  }

  if (/\.json$/i.test(lowerName)) {
    const parsed = JSON.parse(fileBuffer.toString('utf8'));
    return Array.isArray(parsed) ? parsed : (parsed.questions || []);
  }

  if (/\.docx?$/i.test(lowerName)) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    const questions = parseDocumentTextQuestions(result.value || '');
    if (!questions.length) {
      throw new Error('No questions could be detected inside the DOCX file. Please use the provided CSV template or a clearly formatted question list.');
    }
    return questions;
  }

  throw new Error('Unsupported file type. Please upload a CSV, JSON, or DOCX file.');
}

function validateQuestions(input) {
  if (!Array.isArray(input) || !input.length || input.length > 1000) throw new Error('Provide between 1 and 1000 questions.');
  const errors = [];
  input.forEach((item, index) => {
    const invalid = !item || typeof item.question?.english !== 'string' || !item.question.english.trim()
      || !Array.isArray(item.options) || item.options.length !== 4 || item.options.some(option => typeof option?.english !== 'string' || !option.english.trim())
      || !Number.isInteger(item.correctAnswer) || item.correctAnswer < 0 || item.correctAnswer > 3
      || (item.tags !== undefined && (!Array.isArray(item.tags) || item.tags.some(tag => typeof tag !== 'string')));
    if (invalid) errors.push(`Question ${index + 1}: English question, four English options and correctAnswer 0–3 are required.`);
    for (const value of [item?.question, item?.description, ...(Array.isArray(item?.options) ? item.options : [])]) {
      if (value?.hindi !== undefined && typeof value.hindi !== 'string') errors.push(`Question ${index + 1}: Hindi values must be text.`);
    }
  });
  if (errors.length) throw new Error(errors.slice(0, 20).join('\n'));
  return input;
}
module.exports = { parseCSV, validateQuestions, parseQuestionImportFile, parseDocumentTextQuestions };
