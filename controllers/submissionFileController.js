const Submission = require('../models/LiveTestSubmission');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client } = require('../config/r2');
exports.getSubmissionFile = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.submissionId).lean();
    if (!submission) return res.status(404).json({ message: 'Submitted answer sheet not found.' });
    if (req.user.role !== 'admin' && String(submission.studentId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You can only view your own answer sheet.' });
    }
    if (!submission.answerPDFKey) return res.status(404).json({ message: 'Stored file key is missing. Please contact the administrator.' });
    const filename = (submission.originalName || 'answer-sheet.pdf').replace(/[\r\n"\\]/g, '_');
    const url = await getSignedUrl(s3Client, new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME, Key: submission.answerPDFKey,
      ResponseContentType: 'application/pdf',
      ResponseContentDisposition: `inline; filename="answer-sheet.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`
    }), { expiresIn: 900 });
    res.set('Cache-Control', 'no-store').json({ success: true, url, filename });
  } catch (error) { res.status(500).json({ message: 'Unable to open the submitted PDF. Please try again.' }); }
};
