const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCSV, validateQuestions, parseQuestionImportFile } = require('../utils/questionImport');
const { mergePlanAccess } = require('../utils/planAccess');
const { visibleAudiences, audienceTypes } = require('../utils/notificationAudience');
const { normalizeMaterialLink } = require('../utils/materialLink');
const TestSeries = require('../models/TestSeries');
const Question = require('../models/Question');
const mongoose = require('mongoose');

const question = () => ({ question: {english: 'Capital of India?', hindi: 'भारत की राजधानी?'}, description: {english:'',hindi:''}, options: ['Delhi','Mumbai','Chennai','Kolkata'].map(english=>({english,hindi:''})), correctAnswer: 0, tags: [] });
const series = changes => new TestSeries({ kind:'mains', name:'Series', description:'Practice', startDate:'2026-09-01', endDate:'2026-09-30', testDates:[{date:'2026-09-10',time:'09:00',duration:180}], createdBy: new mongoose.Types.ObjectId(), ...changes });

test('CSV preserves Hindi, commas, escaped quotes and multiline fields', () => {
  const rows = parseCSV('\uFEFFQuestion (English),Question (Hindi),Option A (English),Option B (English),Option C (English),Option D (English),Correct Answer,Description (English)\r\n"Capital, of India?",भारत की राजधानी?,Delhi,Mumbai,Chennai,Kolkata,A,"Line 1\nA ""quoted"" explanation"');
  validateQuestions(rows);
  assert.equal(rows[0].question.hindi, 'भारत की राजधानी?');
  assert.equal(rows[0].description.english, 'Line 1\nA "quoted" explanation');
  assert.equal(rows[0].correctAnswer, 0);
});
test('malformed CSV and invalid question rows fail before persistence', () => {
  assert.throws(()=>parseCSV('Question (English)\n"unfinished'), /unclosed/);
  assert.throws(()=>parseCSV('a,b\n1,2,3'), /column count/);
  assert.throws(()=>parseCSV('a,a\n1,2'), /duplicate headers/);
  assert.throws(()=>validateQuestions([{...question(),correctAnswer:4}]), /correctAnswer/);
  assert.throws(()=>validateQuestions([{...question(),options:[]}]), /four English options/);
  assert.throws(()=>validateQuestions([]), /between 1 and 1000/);
});
test('questions may omit explanations while retaining bilingual options', async () => {
  const document = new Question({...question(),createdBy:new mongoose.Types.ObjectId()});
  await document.validate();
  assert.equal(document.question.hindi, 'भारत की राजधानी?');
});
test('series validates schedule range, unique slots and time format', async () => {
  await series({}).validate();
  await assert.rejects(series({endDate:'2026-08-01'}).validate(), /valid start and end date/);
  await assert.rejects(series({testDates:[]}).validate(), /between 1 and 1000/);
  await assert.rejects(series({testDates:[{date:'2026-10-01',time:'09:00',duration:180}]}).validate(), /within the series/);
  await assert.rejects(series({testDates:[{date:'2026-09-10',time:'25:00',duration:180}]}).validate());
  await assert.rejects(series({testDates:[{date:'2026-09-10',time:'09:00',duration:180},{date:'2026-09-10',time:'09:00',duration:180}]}).validate(), /Duplicate/);
});
test('upgrade retains previous access including combo', () => {
  assert.equal(mergePlanAccess('fresh','pre'),'pre');
  assert.equal(mergePlanAccess('pre','mains'),'combo');
  assert.equal(mergePlanAccess('mains','pre'),'combo');
  assert.equal(mergePlanAccess('combo','pre'),'combo');
});
test('notification feed and push audiences agree for combined subscriptions', () => {
  assert.deepEqual(visibleAudiences('combo'),['all','pre','mains','combo']);
  assert.deepEqual(audienceTypes('pre'),['pre','combo']);
  assert.deepEqual(audienceTypes('mains'),['mains','combo']);
  assert.ok(!visibleAudiences('fresh').includes('mains'));
});
test('Drive links keep the correct file or folder and resource key', () => {
  assert.equal(normalizeMaterialLink('https://drive.google.com/open?id=abc-123&resourcekey=secret'), 'https://drive.google.com/file/d/abc-123/view?resourcekey=secret');
  assert.equal(normalizeMaterialLink('https://drive.google.com/drive/folders/folder123'), 'https://drive.google.com/drive/folders/folder123');
  assert.equal(normalizeMaterialLink('https://docs.google.com/document/d/abc/edit'), 'https://docs.google.com/document/d/abc/edit');
  assert.throws(()=>normalizeMaterialLink('javascript:alert(1)'), /HTTP/);
});
test('Google Sheet links convert to CSV export and exam windows honour reopen', () => {
  const { sheetCsvUrl, sheetParts } = require('../utils/googleSheetImport');
  const { examWindow } = require('../utils/examAccess');
  const { getMenuItems } = require('../utils/helpers');
  const url = 'https://docs.google.com/spreadsheets/d/abc123XYZ/edit?gid=99#gid=99';
  assert.deepEqual(sheetParts(url), { id: 'abc123XYZ', gid: '99' });
  assert.equal(sheetCsvUrl(url), 'https://docs.google.com/spreadsheets/d/abc123XYZ/export?format=csv&gid=99');
  assert.throws(() => sheetParts('https://example.com/sheet'), /valid Google Sheet/);
  const future = new Date(Date.now() + 60 * 1000);
  const past = new Date(Date.now() - 60 * 1000);
  const later = new Date(Date.now() + 120 * 1000);
  assert.equal(examWindow({ startTime: future, endTime: later }, null).waiting, true);
  assert.equal(examWindow({ startTime: past, endTime: later }, null).canTake, true);
  assert.equal(examWindow({ startTime: past, endTime: past }, { until: later }).canTake, true);
  assert.equal(examWindow({ startDateTime: past, endDateTime: past }, { until: later }).canTake, true);
  assert.equal(examWindow({ startTime: past, endTime: past }, { until: later }).endTime, later);
  const combo = getMenuItems({ role: 'student', type: 'combo' });
  assert.ok(combo.some(item => item.path === '/prelims-test-series' && !item.children));
  assert.ok(combo.some(item => item.path === '/mains-test-series' && !item.children));
  assert.ok(combo.some(item => item.name === 'Prelims' && !item.children.some(child => child.path === '/prelims-test-series')));
  assert.ok(combo.some(item => item.path === '/support-tickets'));
  const { slotDateTime, calendarDay } = require('../utils/istTime');
  const slot = slotDateTime({ date: '2026-09-23T00:00:00.000Z', time: '09:00' });
  assert.equal(calendarDay(slot), '2026-09-23');
  assert.equal(slot.getUTCHours(), 3);
  assert.equal(slot.getUTCMinutes(), 30);
  const mainsMenu = getMenuItems({ role: 'student', type: 'mains' });
  const mainsGroup = mainsMenu.find(item => item.name === 'Mains');
  assert.ok(mainsGroup.children.some(child => child.path === '/mains-session'));
  assert.ok(!mainsGroup.children.some(child => child.path === '/pre-session'));
  assert.ok(mainsMenu.some(item => item.path === '/mains-test-series'));
});

test('Google Sheet import retries alternate CSV export endpoints when the first export is blocked', async () => {
  const { fetchSheetQuestions } = require('../utils/googleSheetImport');
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/export?format=csv')) {
      return { ok: false, status: 403, text: async () => 'Forbidden' };
    }
    if (String(url).includes('/gviz/tq')) {
      return { ok: true, text: async () => 'Question (English),Question (Hindi),Option A (English),Option B (English),Option C (English),Option D (English),Correct Answer\nCapital of India?,भारत की राजधानी?,Delhi,Mumbai,Chennai,Kolkata,A' };
    }
    return { ok: false, status: 404, text: async () => 'Not found' };
  };

  try {
    const rows = await fetchSheetQuestions('https://docs.google.com/spreadsheets/d/abc123XYZ/edit?gid=99#gid=99');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].question.english, 'Capital of India?');
    assert.ok(calls.some(call => call.includes('/gviz/tq')));
  } finally {
    global.fetch = originalFetch;
  }
});

test('DOCX uploads are converted into the same question schema as CSV files', async () => {
  const mammoth = require('mammoth');
  const originalExtract = mammoth.extractRawText;
  mammoth.extractRawText = async () => {
    return {
      value: `Question 1\nWhat is the capital of India?\nA) Delhi\nB) Mumbai\nC) Chennai\nD) Kolkata\nAnswer: A\nExplanation: Delhi is the capital city.`
    };
  };

  try {
    const rows = await parseQuestionImportFile(Buffer.from('fake-docx'), 'questions.docx');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].question.english, 'What is the capital of India?');
    assert.deepEqual(rows[0].options.map(item => item.english), ['Delhi', 'Mumbai', 'Chennai', 'Kolkata']);
    assert.equal(rows[0].correctAnswer, 0);
    assert.ok(rows[0].description.english.includes('Delhi is the capital city'));
  } finally {
    mammoth.extractRawText = originalExtract;
  }
});
test('web and app login accept the same student email regardless of case, and mobile number', () => {
  const { loginQuery } = require('../utils/loginAccount');
  const byEmail = loginQuery('  App.User@Email.COM ');
  assert.ok(byEmail.$or.some(item => item.email === 'app.user@email.com'));
  const byPhone = loginQuery('9415778282');
  assert.ok(byPhone.$or.some(item => item.phone === '9415778282'));
  assert.ok(byPhone.$or.some(item => item.phone === '+919415778282'));
});

