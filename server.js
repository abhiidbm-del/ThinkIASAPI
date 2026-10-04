require('dotenv').config();

// console.log('=== Environment Variables Check ===');
// console.log('NODE_ENV:', process.env.NODE_ENV);
// console.log('PORT:', process.env.PORT);
// console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✓ Set' : '✗ Missing');
// console.log('R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME ? '✓ Set' : '✗ Missing');
// console.log('R2_ENDPOINT:', process.env.R2_ENDPOINT ? '✓ Set' : '✗ Missing');
// console.log('R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? '✓ Set' : '✗ Missing');
// console.log('R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? '✓ Set' : '✗ Missing');
// console.log('====================================');


const express = require('express');
const cors = require('cors');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./utils/logger');
const initializeAdmin = require('./utils/initializeAdmin');

const app = express();

// Connect to MongoDB
connectDB();


// const cors = require('cors');

// const allowedOrigins = [
//   'https://thinkcivilias.com',
//   'https://www.thinkcivilias.com',
//   'https://admin.thinkcivilias.com'
// ];

// app.use(cors({
//   origin: function (origin, callback) {
//     // allow server-to-server or Postman requests
//     if (!origin) return callback(null, true);

//     if (allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error('CORS not allowed'));
//     }
//   },
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));


// app.options('*', cors());

app.use(cors());

app.use(express.json({limit: '10mb'})); // Increase limit for file uploads
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Routes
app.use('/api/app/auth', require('./routes/appAuth'));
app.use('/api/app', require('./routes/app'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tests', require('./routes/tests'));
app.use('/api/results', require('./routes/results'));
app.use('/api/admin', require('./routes/admin'));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/tests', require('./routes/tests'));
app.use('/api/results', require('./routes/results'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/prelims-ts', require('./routes/testSeries')('pre'));
app.use('/api/mains-ts', require('./routes/testSeries')('mains'));
app.use('/api/jobs', require('./routes/job'));
app.use('/api', require('./routes/application'));
// Add this to your server.js file
app.use('/api/syllabus', require('./routes/syllabus'));
app.use('/api/tags', require('./routes/tags'));

app.use('/api/testimonials', require('./routes/testimonial'));
app.use('/api/support-features', require('./routes/supportFeature'));
app.use('/api/support-tickets', require('./routes/supportTickets'));

// Add this to your server.js routes
app.use('/api/questions', require('./routes/questions'));

app.use('/api/pdf', require('./routes/pdf'));
app.use('/api/directories', require('./routes/directory')); // Added directory routes
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/admin/results', require('./routes/results'));


app.use('/api/chat', require('./routes/chat'));
// Add after other route imports
app.use('/api/mentorship', require('./routes/mentorship'));
app.use('/api/announcements', require('./routes/announcement'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/proctoring', require('./routes/proctoring'));

// Add this to your Express app configuration
app.use('/api/topicwiseDirectory', require('./routes/topicwiseDirectory'));

app.use('/api/videoLecture', require('./routes/videoLecture'));

app.use('/api/freeResource', require('./routes/freeResource'));

app.use('/api/simpleNews', require('./routes/simpleNews'));

// Add this to your app.js or server.js
app.use('/api/live-content', require('./routes/liveContent'));

app.use('/api/demo-tests', require('./routes/demoTest'));
app.use('/api/demoResults', require('./routes/demoResults'));

app.use('/api/quizzes', require('./routes/quiz'));
// Add this with your other route declarations
app.use('/api/program-faqs', require('./routes/programFaqs'));
app.use('/api/programs', require('./routes/programs'));

// Add this with your other routes
app.use('/api', require('./routes/batches'));

app.use('/api/answer-writing', require('./routes/answerWriting'));





app.use('/api/coupons', require('./routes/coupon'));

app.use('/api/config', require('./routes/config'));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'ThinkCivil Backend is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root route to avoid 404 on "/"
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'ThinkCivil Backend is running',
    health: '/api/health',
  });
});

app.use('/api/module', require('./routes/module'));

app.use('/api/module-tests', require('./routes/moduleTest'));
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/live-tests', require('./routes/liveTest'));


// Error handling middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;




app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize admin user
  initializeAdmin();
});
