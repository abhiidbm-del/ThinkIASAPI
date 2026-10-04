require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cheerio = require('cheerio');
const SupportFeature = require('../models/SupportFeature');

const text = element => element.text().replace(/\s+/g, ' ').trim();

const run = async () => {
  if (!process.env.MONGO_URL) throw new Error('MONGO_URL is not configured');
  await mongoose.connect(process.env.MONGO_URL);

  const existingCount = await SupportFeature.countDocuments();
  if (existingCount > 0) {
    console.log(`Skipped migration: ${existingCount} support feature record(s) already exist.`);
    return;
  }

  const templatePath = path.join(__dirname, '..', 'web', 'student-portal', 'student-portal', 'src', 'app', 'modules', 'homepage', 'integrated-program', 'integrated-program.component.html');
  const $ = cheerio.load(fs.readFileSync(templatePath, 'utf8'), { xmlMode: false });
  const features = [];

  $('#program-details .feature-card').each((index, card) => {
    const root = $(card);
    const descriptionsEn = root.find('.feature-description').map((_i, node) => text($(node).find('.en'))).get().filter(Boolean);
    const descriptionsHi = root.find('.feature-description').map((_i, node) => text($(node).find('.hi'))).get().filter(Boolean);
    const icon = (root.find('.feature-icon i').attr('class') || '').split(/\s+/).find(value => value.startsWith('bi-')) || 'bi-check-circle';

    features.push({
      title: text(root.find('.feature-title .en')).replace(/^\d+\.\s*/, ''),
      titleHindi: text(root.find('.feature-title .hi')).replace(/^\d+\.\s*/, ''),
      description: descriptionsEn.slice(0, -1).join('\n\n') || descriptionsEn[0],
      descriptionHindi: descriptionsHi.slice(0, -1).join('\n\n') || descriptionsHi[0] || '',
      points: root.find('.feature-list li .en').map((_i, node) => text($(node))).get(),
      pointsHindi: root.find('.feature-list li .hi').map((_i, node) => text($(node))).get(),
      footer: descriptionsEn.length > 1 ? descriptionsEn.at(-1) : '',
      footerHindi: descriptionsHi.length > 1 ? descriptionsHi.at(-1) : '',
      icon,
      displayOrder: index + 1,
      isActive: true
    });
  });

  if (features.length !== 6) throw new Error(`Expected 6 static support cards, found ${features.length}`);
  await SupportFeature.insertMany(features);
  console.log(`Migrated ${features.length} support features to MongoDB.`);
};

run()
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
