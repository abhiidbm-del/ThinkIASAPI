const { body, validationResult } = require('express-validator');
const { handleError } = require('./errorHandler');

// const handleValidationErrors = (req, res, next) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     return res.status(400).json({
//       message: 'invalid method'
//     });
//   }
//   next();
// };

const sendOTPValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail()
];

const verifyOTPValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('otp')
    .trim()
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must contain only numbers')
];


const sendPasswordResetOTPValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail()
];


const verifyPasswordResetOTPValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('otp')
    .trim()
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must contain only numbers')
];

const resetPasswordValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('otp')
    .trim()
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must contain only numbers'),
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  body('confirmPassword')
    .notEmpty().withMessage('Please confirm your new password')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

// Update register validation to include OTP
const registerValidation = [
  body('fullName')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\d{10}$/).withMessage('Please enter a valid 10-digit phone number'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirmPassword')
    .notEmpty().withMessage('Please confirm your password')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  body('otp')
    .trim()
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must contain only numbers')
];

const loginValidation = [
  body('email').trim().notEmpty().withMessage('Email or mobile number is required'),
  body('password').notEmpty().withMessage('Password is required')
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'invalid method',
      errors: errors.array()
    });
  }
  next();
};

const testValidation = [
  body('title').notEmpty().withMessage('Test title is required'),
  body('startTime').isISO8601().withMessage('Valid start time is required'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be a positive number'),
  body('marksPerQuestion').isFloat({ min: 0 }).withMessage('Marks per question must be non-negative'),
  body('negativeMarks').isFloat({ min: 0 }).withMessage('Negative marks must be non-negative'),
  body('questionUids').isArray({ min: 1 }).withMessage('At least one question is required'),
  body('questionUids.*').isString().withMessage('Question UID must be a string')
];

// Add to your existing validation middleware
// const syllabusValidation = [
//   body('gs1.fileLink').notEmpty().withMessage('GS1 file link is required'),
//   body('gs2.fileLink').notEmpty().withMessage('GS2 file link is required'),
//   body('gs1.fileName').optional().isString(),
//   body('gs2.fileName').optional().isString(),
//   body('gs1.description').optional().isString(),
//   body('gs2.description').optional().isString()
// ];

// Add these validations
const prelimsValidation = [
  body('gs1.fileName').notEmpty().withMessage('GS1 file name is required'),
  body('gs1.fileLink').notEmpty().withMessage('GS1 file link is required'),
  body('gs2.fileName').notEmpty().withMessage('GS2 file name is required'),
  body('gs2.fileLink').notEmpty().withMessage('GS2 file link is required'),
  body('gs1.description').optional().isString(),
  body('gs2.description').optional().isString()
];

const mainsValidation = [
  body('essay.fileName').optional().isString(),
  body('essay.fileLink').optional().isString(),
  body('essay.description').optional().isString(),
  body('gs1.fileName').optional().isString(),
  body('gs1.fileLink').optional().isString(),
  body('gs1.description').optional().isString(),
  body('gs2.fileName').optional().isString(),
  body('gs2.fileLink').optional().isString(),
  body('gs2.description').optional().isString(),
  body('gs3.fileName').optional().isString(),
  body('gs3.fileLink').optional().isString(),
  body('gs3.description').optional().isString(),
  body('gs4.fileName').optional().isString(),
  body('gs4.fileLink').optional().isString(),
  body('gs4.description').optional().isString(),
  body('optionalSubjects').optional().isArray(),
  body('optionalSubjects.*.subjectName').optional().isString(),
  body('optionalSubjects.*.documents').optional().isArray(),
  body('optionalSubjects.*.documents.*.fileName').optional().isString(),
  body('optionalSubjects.*.documents.*.fileLink').optional().isString(),
  body('optionalSubjects.*.documents.*.description').optional().isString()
];

module.exports = {
  handleValidationErrors,
  registerValidation,
  loginValidation,
  testValidation,
  prelimsValidation,
  mainsValidation  ,
  verifyOTPValidation,
  sendOTPValidation,
  verifyPasswordResetOTPValidation,
  resetPasswordValidation,
  sendPasswordResetOTPValidation
};