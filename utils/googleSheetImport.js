const { parseCSV } = require('./questionImport');

const sheetParts = url => {
  const value = String(url || '').trim();
  const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const match = normalized.match(/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/i);
  if (!match) throw new Error('Paste a valid Google Sheet link.');

  let gid = '0';
  try {
    const parsed = new URL(normalized);
    gid = parsed.searchParams.get('gid') || (parsed.hash.match(/gid=(\d+)/) || [])[1] || gid;
  } catch {
    gid = (normalized.match(/[?#&]gid=(\d+)/) || [])[1] || gid;
  }

  return { id: match[1], gid };
};

const sheetCsvUrl = url => {
  const { id, gid } = sheetParts(url);
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
};

const sheetCsvUrls = url => {
  const { id, gid } = sheetParts(url);
  const base = `https://docs.google.com/spreadsheets/d/${id}`;
  return [
    `${base}/export?format=csv&gid=${gid}`,
    `${base}/gviz/tq?tqx=out:csv&gid=${gid}`,
    `${base}/pub?output=csv&gid=${gid}`
  ];
};

const fetchSheetQuestions = async url => {
  let lastError = null;

  for (const candidateUrl of sheetCsvUrls(url)) {
    try {
      const response = await fetch(candidateUrl, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!response || !response.ok) {
        lastError = new Error('Unable to read the Google Sheet. Share it as Anyone with the link can view.');
        continue;
      }

      const text = await response.text();
      const normalizedText = text.slice(0, 500).replace(/\s+/g, ' ');
      if (!text || /<html|sign in|please sign|access denied|not found/i.test(normalizedText)) {
        lastError = new Error('Unable to read the Google Sheet. Share it as Anyone with the link can view.');
        continue;
      }

      return parseCSV(text);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Unable to read the Google Sheet. Share it as Anyone with the link can view.');
};

module.exports = { sheetParts, sheetCsvUrl, sheetCsvUrls, fetchSheetQuestions };
