const fs = require('node:fs');
const app = '{{baseUrl}}/api/app';
const authUrl = '{{baseUrl}}/api/app/auth';
const jsonHeader = [{ key: 'Content-Type', value: 'application/json' }];
const bearer = { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] };
const noauth = { type: 'noauth' };

function tests(lines) {
  return [{ listen: 'test', script: { type: 'text/javascript', exec: lines } }];
}
const ok = tests(["pm.test('HTTP 200', function () { pm.response.to.have.status(200); });"]);

function jsonReq(name, method, url, { body, auth = false, event, description } = {}) {
  return {
    name,
    request: {
      method,
      header: method === 'GET' || method === 'DELETE' ? jsonHeader : jsonHeader,
      auth: auth ? bearer : noauth,
      url,
      description,
      ...(body ? { body: { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } } } : {})
    },
    event: event || ok
  };
}

function formReq(name, method, url, formdata, { description, event } = {}) {
  return {
    name,
    request: {
      method,
      header: [],
      auth: bearer,
      url,
      description,
      body: { mode: 'formdata', formdata }
    },
    event: event || ok
  };
}

const saveToken = tests([
  "pm.test('HTTP 200', function () { pm.response.to.have.status(200); });",
  "if (pm.response.code === 200) { const data = pm.response.json().data || {}; if (data.token) pm.collectionVariables.set('token', data.token); }"
]);

const collection = {
  info: {
    name: 'ThinkIAS App — Full API',
    description: 'Complete mobile app collection. Login first so {{token}} is saved. Profile update matches the My Profile screen: name, mobileNo, email, password, confirmPassword, pincode, houseNo, locality, colony, city. Image upload is a separate form-data request; set the image row to File and use Select Files.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:5000' },
    { key: 'email', value: 'Abhishektripathi131@gmail.com' },
    { key: 'password', value: 'Student123!' },
    { key: 'token', value: '' },
    { key: 'challengeId', value: '' },
    { key: 'verificationToken', value: '' },
    { key: 'resetToken', value: '' },
    { key: 'programId', value: '' },
    { key: 'batchId', value: '' },
    { key: 'resourceId', value: '' },
    { key: 'notificationId', value: '' }
  ],
  item: [
    {
      name: '01 Auth',
      item: [
        jsonReq('Send OTP', 'POST', `${authUrl}/send-otp`, {
          body: { email: '{{email}}' },
          event: tests([
            "pm.test('OTP sent', function () { pm.response.to.have.status(200); });",
            "const data = pm.response.json().data || {};",
            "if (data.challengeId) pm.collectionVariables.set('challengeId', data.challengeId);"
          ])
        }),
        jsonReq('Resend OTP', 'POST', `${authUrl}/resend-otp`, {
          body: { email: '{{email}}', challengeId: '{{challengeId}}' }
        }),
        jsonReq('Verify email OTP 1234', 'POST', `${authUrl}/verify-email`, {
          body: { email: '{{email}}', challengeId: '{{challengeId}}', otp: '1234' },
          event: tests([
            "pm.test('Email verified', function () { pm.response.to.have.status(200); });",
            "const data = pm.response.json().data || {};",
            "if (data.verificationToken) pm.collectionVariables.set('verificationToken', data.verificationToken);"
          ])
        }),
        jsonReq('Register', 'POST', `${authUrl}/register`, {
          body: {
            email: '{{email}}',
            fullName: 'Abhishek',
            phone: '9415778282',
            password: '{{password}}',
            confirmPassword: '{{password}}',
            verificationToken: '{{verificationToken}}'
          },
          event: tests([
            "pm.test('Registered', function () { pm.expect([200, 201]).to.include(pm.response.code); });",
            "const data = pm.response.json().data || {};",
            "if (data.token) pm.collectionVariables.set('token', data.token);"
          ])
        }),
        jsonReq('Login', 'POST', `${authUrl}/login`, {
          body: { email: '{{email}}', password: '{{password}}' },
          event: saveToken
        }),
        jsonReq('Current student', 'GET', `${authUrl}/me`, { auth: true }),
        jsonReq('Forgot password', 'POST', `${authUrl}/forgot-password`, {
          body: { email: '{{email}}' },
          event: tests([
            "pm.test('Reset code sent', function () { pm.response.to.have.status(200); });",
            "const data = pm.response.json().data || {};",
            "if (data.challengeId) pm.collectionVariables.set('challengeId', data.challengeId);"
          ])
        }),
        jsonReq('Verify reset OTP 1234', 'POST', `${authUrl}/verify-reset-otp`, {
          body: { email: '{{email}}', challengeId: '{{challengeId}}', otp: '1234' },
          event: tests([
            "pm.test('Reset code verified', function () { pm.response.to.have.status(200); });",
            "const data = pm.response.json().data || {};",
            "if (data.resetToken) pm.collectionVariables.set('resetToken', data.resetToken);"
          ])
        }),
        jsonReq('Reset password', 'POST', `${authUrl}/reset-password`, {
          body: { email: '{{email}}', resetToken: '{{resetToken}}', password: '{{password}}', confirmPassword: '{{password}}' }
        }),
        jsonReq('Logout', 'POST', `${authUrl}/logout`, { auth: true, body: {} })
      ]
    },
    {
      name: '02 Public screens',
      item: [
        jsonReq('Config', 'GET', `${app}/config`),
        jsonReq('Onboarding', 'GET', `${app}/onboarding`),
        jsonReq('Support', 'GET', `${app}/support`),
        jsonReq('Share', 'GET', `${app}/share`),
        jsonReq('Terms', 'GET', `${app}/legal/terms`),
        jsonReq('Privacy', 'GET', `${app}/legal/privacy`),
        jsonReq('FAQs', 'GET', `${app}/faqs`),
        jsonReq('Program filters', 'GET', `${app}/programs/filters`),
        jsonReq('Programs', 'GET', `${app}/programs`, {
          event: tests([
            "pm.test('HTTP 200', function () { pm.response.to.have.status(200); });",
            "const rows = pm.response.json().data || [];",
            "if (rows[0] && rows[0].id) pm.collectionVariables.set('programId', rows[0].id);"
          ])
        }),
        jsonReq('Courses / mentorship', 'GET', `${app}/courses`),
        jsonReq('Test series', 'GET', `${app}/tests`),
        jsonReq('Program detail', 'GET', `${app}/programs/{{programId}}`),
        jsonReq('Program batches', 'GET', `${app}/programs/{{programId}}/batches`, {
          event: tests([
            "pm.test('HTTP 200', function () { pm.response.to.have.status(200); });",
            "const rows = pm.response.json().data || [];",
            "if (rows[0]) pm.collectionVariables.set('batchId', rows[0].id || rows[0]._id || '');"
          ])
        }),
        jsonReq('Batch brochure', 'GET', `${app}/programs/{{programId}}/batches/{{batchId}}/brochure`),
        jsonReq('Plans', 'GET', `${app}/plans`),
        jsonReq('News', 'GET', `${app}/news`),
        jsonReq('Videos', 'GET', `${app}/videos`),
        jsonReq('Testimonials', 'GET', `${app}/testimonials`)
      ]
    },
    {
      name: '03 Profile and account',
      item: [
        jsonReq('Get profile', 'GET', `${app}/profile`, {
          auth: true,
          description: 'My Profile screen. Returns name, mobileNo, email, pincode, houseNo, locality, colony and city.',
          event: tests([
            "pm.test('HTTP 200', function () { pm.response.to.have.status(200); });",
            "const user = pm.response.json().data.user;",
            "pm.test('Profile screen fields', function () {",
            "  ['name','mobileNo','email','pincode','houseNo','locality','colony','city'].forEach(function (key) { pm.expect(user).to.have.property(key); });",
            "});"
          ])
        }),
        jsonReq('Update profile', 'PATCH', `${app}/profile`, {
          auth: true,
          description: 'Same fields as the My Profile screen. Leave password empty to keep the current password.',
          body: {
            name: 'Abhishek',
            mobileNo: '9415778282',
            email: 'Abhishektripathi131@gmail.com',
            password: '',
            confirmPassword: '',
            pincode: '226014',
            houseNo: '',
            locality: '',
            colony: 'Your Colony',
            city: 'Lucknow'
          }
        }),
        formReq('Update profile with image', 'PATCH', `${app}/profile`, [
          { key: 'name', value: 'Abhishek', type: 'text' },
          { key: 'mobileNo', value: '9415778282', type: 'text' },
          { key: 'email', value: 'Abhishektripathi131@gmail.com', type: 'text' },
          { key: 'password', value: '', type: 'text' },
          { key: 'confirmPassword', value: '', type: 'text' },
          { key: 'pincode', value: '226014', type: 'text' },
          { key: 'houseNo', value: '', type: 'text' },
          { key: 'locality', value: '', type: 'text' },
          { key: 'colony', value: 'Your Colony', type: 'text' },
          { key: 'city', value: 'Lucknow', type: 'text' },
          { key: 'image', type: 'file', src: [] }
        ], { description: 'Body is form-data. Change the image row from Text to File, then Select Files.' }),
        formReq('Upload profile image', 'POST', `${app}/profile/image`, [
          { key: 'image', type: 'file', src: [] }
        ], { description: 'Photo only. image row must be type File.' }),
        jsonReq('Delete profile image', 'DELETE', `${app}/profile/image`, { auth: true }),
        jsonReq('Update preferences', 'PATCH', `${app}/preferences`, {
          auth: true,
          body: { preferredLanguage: 'en', notificationsEnabled: true }
        }),
        jsonReq('Transactions', 'GET', `${app}/transactions`, { auth: true }),
        jsonReq('Transactions pending', 'GET', `${app}/transactions?status=pending`, { auth: true }),
        jsonReq('Orders', 'GET', `${app}/orders`, { auth: true }),
        jsonReq('Downloads', 'GET', `${app}/downloads`, { auth: true }),
        jsonReq('Save download', 'POST', `${app}/downloads`, {
          auth: true,
          body: { resourceId: '{{resourceId}}', source: 'modules' }
        }),
        jsonReq('Submissions', 'GET', `${app}/submissions`, { auth: true }),
        jsonReq('Feedback', 'POST', `${app}/feedback`, {
          auth: true,
          body: { enjoying: true, platform: 'android' }
        }),
        jsonReq('Report a problem', 'POST', `${app}/reports`, {
          auth: true,
          body: { message: 'Something was broken on the profile screen' }
        }),
        jsonReq('Delete account', 'POST', `${app}/account/delete`, {
          auth: true,
          body: { reason: 'I have a privacy concern', note: '' }
        })
      ]
    },
    {
      name: '04 Home and study',
      item: [
        jsonReq('Dashboard', 'GET', `${app}/dashboard`, { auth: true }),
        jsonReq('Resources', 'GET', `${app}/resources`, {
          auth: true,
          event: tests([
            "pm.test('HTTP 200', function () { pm.response.to.have.status(200); });",
            "const rows = pm.response.json().data || [];",
            "if (rows[0] && rows[0].id) pm.collectionVariables.set('resourceId', rows[0].id);"
          ])
        }),
        jsonReq('Resource detail', 'GET', `${app}/resources/{{resourceId}}`, { auth: true }),
        jsonReq('Notifications', 'GET', `${app}/notifications`, {
          auth: true,
          event: tests([
            "pm.test('HTTP 200', function () { pm.response.to.have.status(200); });",
            "const rows = pm.response.json().data || [];",
            "if (rows[0] && rows[0].id) pm.collectionVariables.set('notificationId', rows[0].id);"
          ])
        }),
        jsonReq('Mark notification read', 'PATCH', `${app}/notifications/{{notificationId}}/read`, { auth: true })
      ]
    }
  ]
};

fs.mkdirSync('postman', { recursive: true });
fs.writeFileSync('postman/ThinkIAS-App-API.postman_collection.json', JSON.stringify(collection, null, 2) + '\n');
console.log('Wrote postman/ThinkIAS-App-API.postman_collection.json');
