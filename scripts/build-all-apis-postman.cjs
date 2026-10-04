const fs = require('node:fs');
const path = require('node:path');

const mounts = [
  ['App auth', '/api/app/auth', 'appAuth.js'],
  ['App', '/api/app', 'app.js'],
  ['Website auth', '/api/auth', 'auth.js'],
  ['Tests', '/api/tests', 'tests.js'],
  ['Results', '/api/results', 'results.js'],
  ['Admin', '/api/admin', 'admin.js'],
  ['Payments', '/api/payments', 'payments.js'],
  ['Plans', '/api/plans', 'plans.js'],
  ['Prelims test series', '/api/prelims-ts', 'testSeries.js'],
  ['Mains test series', '/api/mains-ts', 'testSeries.js'],
  ['Jobs', '/api/jobs', 'job.js'],
  ['Job applications', '/api', 'application.js'],
  ['Syllabus', '/api/syllabus', 'syllabus.js'],
  ['Tags', '/api/tags', 'tags.js'],
  ['Testimonials', '/api/testimonials', 'testimonial.js'],
  ['Support features', '/api/support-features', 'supportFeature.js'],
  ['Support tickets', '/api/support-tickets', 'supportTickets.js'],
  ['Questions', '/api/questions', 'questions.js'],
  ['PDF', '/api/pdf', 'pdf.js'],
  ['Directories', '/api/directories', 'directory.js'],
  ['Meetings', '/api/meetings', 'meetings.js'],
  ['Admin results', '/api/admin/results', 'results.js'],
  ['Chat', '/api/chat', 'chat.js'],
  ['Mentorship', '/api/mentorship', 'mentorship.js'],
  ['Announcements', '/api/announcements', 'announcement.js'],
  ['Notifications', '/api/notifications', 'notifications.js'],
  ['Proctoring', '/api/proctoring', 'proctoring.js'],
  ['Topicwise directory', '/api/topicwiseDirectory', 'topicwiseDirectory.js'],
  ['Video lectures', '/api/videoLecture', 'videoLecture.js'],
  ['Free resources', '/api/freeResource', 'freeResource.js'],
  ['Simple news', '/api/simpleNews', 'simpleNews.js'],
  ['Live content', '/api/live-content', 'liveContent.js'],
  ['Demo tests', '/api/demo-tests', 'demoTest.js'],
  ['Demo results', '/api/demoResults', 'demoResults.js'],
  ['Quizzes', '/api/quizzes', 'quiz.js'],
  ['Program FAQs', '/api/program-faqs', 'programFaqs.js'],
  ['Programs', '/api/programs', 'programs.js'],
  ['Batches', '/api', 'batches.js'],
  ['Answer writing', '/api/answer-writing', 'answerWriting.js'],
  ['Coupons', '/api/coupons', 'coupon.js'],
  ['Config', '/api/config', 'config.js'],
  ['Study modules', '/api/module', 'module.js'],
  ['Module tests', '/api/module-tests', 'moduleTest.js'],
  ['Live tests', '/api/live-tests', 'liveTest.js']
];

const bearer = { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] };
const noauth = { type: 'noauth' };
const jsonHeader = [{ key: 'Content-Type', value: 'application/json' }];
const routeRe = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;

function toUrl(mount, routePath) {
  const full = `${mount}${routePath === '/' ? '' : routePath}`.replace(/\/+/g, '/');
  return '{{baseUrl}}' + full.replace(/:([A-Za-z0-9_]+)/g, '{{$1}}');
}

function bodyFor(method, url) {
  if (!['POST', 'PUT', 'PATCH'].includes(method)) return undefined;
  if (url.endsWith('/api/auth/login') || url.endsWith('/api/app/auth/login')) {
    return { email: '{{email}}', password: '{{password}}' };
  }
  if (url.endsWith('/api/app/auth/register') || url.endsWith('/api/auth/register')) {
    return { fullName: 'Abhishek', email: '{{email}}', phone: '9415778282', password: '{{password}}', confirmPassword: '{{password}}' };
  }
  if (url.endsWith('/api/app/profile') && method === 'PATCH') {
    return {
      name: 'Abhishek',
      mobileNo: '9415778282',
      email: '{{email}}',
      password: '',
      confirmPassword: '',
      pincode: '226014',
      houseNo: '',
      locality: '',
      colony: 'Your Colony',
      city: 'Lucknow'
    };
  }
  if (url.endsWith('/send-otp') || url.endsWith('/forgot-password')) return { email: '{{email}}' };
  return {};
}

function requestItem(method, url) {
  const upper = method.toUpperCase();
  const body = bodyFor(upper, url);
  const isLogin = url.endsWith('/login');
  const item = {
    name: `${upper} ${url.replace('{{baseUrl}}', '')}`,
    request: {
      method: upper,
      header: jsonHeader,
      auth: isLogin ? noauth : bearer,
      url
    }
  };
  if (body) {
    item.request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } };
  }
  if (isLogin) {
    item.event = [{
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: [
          "const json = pm.response.json();",
          "const token = (json.data && json.data.token) || json.token;",
          "if (token) pm.collectionVariables.set('token', token);"
        ]
      }
    }];
  }
  return item;
}

const items = mounts.map(([name, mount, file]) => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'routes', file), 'utf8');
  const seen = new Set();
  const requests = [];
  for (const match of source.matchAll(routeRe)) {
    const key = `${match[1]} ${match[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    requests.push(requestItem(match[1], toUrl(mount, match[2])));
  }
  requests.sort((a, b) => a.name.localeCompare(b.name));
  return { name: `${name} (${requests.length})`, item: requests };
});

items.unshift({
  name: 'Health',
  item: [
    requestItem('get', '{{baseUrl}}/api/health'),
    requestItem('get', '{{baseUrl}}/')
  ]
});

const variables = ['baseUrl', 'token', 'email', 'password', 'id', 'programId', 'batchId', 'testId', 'userId', 'uid', 'tagId', 'moduleId', 'category', 'filter', 'slotId', 'examId', 'submissionId', 'messageId', 'resultId', 'planName', 'jobId', 'applicationId', 'exerciseId', 'studentId', 'parentId', 'field', 'kind'];
const collection = {
  info: {
    name: 'ThinkIAS — All APIs',
    description: 'Every route mounted in server.js. Run Website auth → POST /api/auth/login or App auth → POST /api/app/auth/login first. The test script saves {{token}}. Path parameters such as {{id}} are collection variables.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  auth: bearer,
  variable: variables.map(key => ({
    key,
    value: key === 'baseUrl' ? 'http://localhost:5000' : key === 'email' ? 'Abhishektripathi131@gmail.com' : key === 'password' ? 'Student123!' : key === 'filter' ? 'all' : ''
  })),
  item: items
};

const total = items.reduce((sum, folder) => sum + folder.item.length, 0);
const out = path.join(__dirname, '..', 'postman', 'ThinkIAS-All-APIs.postman_collection.json');
fs.writeFileSync(out, JSON.stringify(collection, null, 2) + '\n');
console.log(`Wrote ${out} with ${total} requests in ${items.length} folders`);
