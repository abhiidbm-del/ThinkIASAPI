const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
require('dotenv').config();

// Configure Cloudflare R2 Client
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

// Configure multer for R2
const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.R2_BUCKET_NAME,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const uniqueName = `answer-sheets/${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
    metadata: function (req, file, cb) {
      cb(null, { 
        fieldName: file.fieldname,
        originalName: file.originalname,
        submittedBy: req.user?._id?.toString() || 'unknown'
      });
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

const uploadAnswerSheet = upload.single('answerPDF');

// Public profile images used in website testimonials.
const testimonialImageUpload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.R2_BUCKET_NAME,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const uniqueName = `testimonials/${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  }
}).single('image');

const proctorStorage = multerS3({
  s3: s3Client,
  bucket: process.env.R2_BUCKET_NAME,
  acl: 'public-read',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req, file, cb) => {
    const folder = file.fieldname === 'recording' ? 'proctor-recordings' : 'proctor-snapshots';
    cb(null, `${folder}/${req.user._id}/${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
  }
});

const uploadProctorRecording = multer({
  storage: proctorStorage,
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['video/webm', 'video/mp4'].includes(file.mimetype))
}).single('recording');

const uploadProctorSnapshot = multer({
  storage: proctorStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
}).single('snapshot');

const getPublicR2Url = file => {
  if (!file) return null;
  if (process.env.R2_PUBLIC_URL && file.key) {
    return `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${String(file.key).replace(/^\/+/, '')}`;
  }
  return file.location || null;
};

// Helper function to extract key from URL
const extractKeyFromUrl = (fileUrl) => {
  if (!fileUrl) return null;
  
  let key = '';
  
  // Handle different URL formats
  if (fileUrl.includes('.r2.dev/')) {
    // Public URL format: https://pub-xxx.r2.dev/answer-sheets/filename.pdf
    key = fileUrl.split('.r2.dev/')[1];
  } else if (fileUrl.includes('.r2.cloudflarestorage.com/')) {
    // Storage URL format: https://endpoint/bucket-name/answer-sheets/filename.pdf
    const parts = fileUrl.split('.r2.cloudflarestorage.com/');
    if (parts[1]) {
      // Remove bucket name from the path if present
      let path = parts[1];
      if (path.startsWith(`${process.env.R2_BUCKET_NAME}/`)) {
        path = path.substring(process.env.R2_BUCKET_NAME.length + 1);
      }
      key = path;
    }
  }
  
  // Remove any leading slashes
  key = key.replace(/^\/+/, '');
  
  return key;
};

// Function to generate presigned URL
const getPresignedUrl = async (fileUrl) => {
  try {
    if (!fileUrl) return null;
    
    const key = extractKeyFromUrl(fileUrl);
    if (!key) {
      console.log('Could not extract key from URL:', fileUrl);
      return fileUrl;
    }
    
    // console.log('Extracted key for presigned URL:', key);
    
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });
    
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return presignedUrl;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return fileUrl;
  }
};

// Function to extract key for deletion
const extractKeyForDeletion = (fileUrl) => {
  if (!fileUrl) return null;
  
  let key = '';
  
  if (fileUrl.includes('.r2.dev/')) {
    key = fileUrl.split('.r2.dev/')[1];
  } else if (fileUrl.includes('.r2.cloudflarestorage.com/')) {
    const parts = fileUrl.split('.r2.cloudflarestorage.com/');
    if (parts[1]) {
      let path = parts[1];
      if (path.startsWith(`${process.env.R2_BUCKET_NAME}/`)) {
        path = path.substring(process.env.R2_BUCKET_NAME.length + 1);
      }
      key = path;
    }
  }
  
  key = key.replace(/^\/+/, '');
  return key;
};

const deleteFromR2 = async (fileUrl) => {
  try {
    if (!fileUrl) return true;
    
    const key = extractKeyForDeletion(fileUrl);
    if (!key) return true;
    
    console.log('Deleting from R2, key:', key);
    
    await s3Client.deleteObject({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key
    });
    return true;
  } catch (error) {
    console.error('Error deleting from R2:', error);
    return false;
  }
};

const ticketAttachmentUpload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.R2_BUCKET_NAME,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => cb(null, `support-tickets/${req.user._id}/${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => cb(null, /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(file.mimetype))
}).array('attachments', 5);

module.exports = { uploadAnswerSheet, testimonialImageUpload, uploadProctorRecording, uploadProctorSnapshot, ticketAttachmentUpload, getPublicR2Url, deleteFromR2, getPresignedUrl, s3Client };
