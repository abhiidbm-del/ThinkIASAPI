const AnswerWriting = require('../models/AnswerWriting');
const StudentAnswerSubmission = require('../models/StudentAnswerSubmission');
const { handleError } = require('../middleware/errorHandler');
const { deleteFromR2 } = require('../config/r2');

// Helper function to get bilingual content
const getBilingualContent = (item, lang) => {
  if (!item) return null;
  const obj = item.toObject ? item.toObject() : { ...item };
  
  if (lang === 'hi') {
    return {
      ...obj,
      name: obj.nameHi || obj.name,
      description: obj.descriptionHi || obj.description,
      questions: obj.questions?.map(q => ({
        ...q,
        questionText: q.questionTextHi || q.questionText
      })),
      questionPaperPDF: obj.questionPaperPDFHi || obj.questionPaperPDF
    };
  }
  return obj;
};

// @desc    Create a new answer writing exercise
// @route   POST /api/answer-writing
// @access  Private/Admin
const createAnswerWriting = async (req, res) => {
  try {
    const {
      name,
      nameHi,
      description,
      descriptionHi,
      questions,
      questionPaperPDF,
      questionPaperPDFHi,
      startDateTime,
      endDateTime,
      order
    } = req.body;

    if (!name || !description || !questions || !questions.length || !startDateTime || !endDateTime) {
      return res.status(400).json({
        success: false,
        message: 'Name, description, questions, start date time, and end date time are required'
      });
    }

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'End date time must be after start date time'
      });
    }

    const existingExercise = await AnswerWriting.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingExercise) {
      return res.status(400).json({
        success: false,
        message: 'An exercise with this name already exists'
      });
    }

    const processedQuestions = questions.map(q => ({
      questionText: q.questionText,
      questionTextHi: q.questionTextHi || '',
    }));

    const answerWriting = new AnswerWriting({
      name,
      nameHi: nameHi || '',
      description,
      descriptionHi: descriptionHi || '',
      questions: processedQuestions,
      questionPaperPDF: questionPaperPDF || '',
      questionPaperPDFHi: questionPaperPDFHi || '',
      startDateTime: start,
      endDateTime: end,
      order: order || 0,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await answerWriting.save();

    res.status(201).json({
      success: true,
      message: 'Answer writing exercise created successfully',
      data: answerWriting
    });

  } catch (error) {
    console.error('Create answer writing error:', error);
    handleError(res, error, 'Failed to create answer writing exercise');
  }
};

// @desc    Get all answer writing exercises (admin view)
// @route   GET /api/answer-writing/admin
// @access  Private/Admin
const getAllAnswerWritingAdmin = async (req, res) => {
  try {
    const { search, status, fromDate, toDate, lang = 'en' } = req.query;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { nameHi: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { descriptionHi: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }
    
    if (fromDate || toDate) {
      query.startDateTime = {};
      if (fromDate) {
        query.startDateTime.$gte = new Date(fromDate);
      }
      if (toDate) {
        query.startDateTime.$lte = new Date(toDate);
      }
    }

    const exercises = await AnswerWriting.find(query)
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .sort({ order: -1, createdAt: -1 });

    const data = exercises.map(ex => getBilingualContent(ex, lang));

    res.json({
      success: true,
      count: data.length,
      data
    });

  } catch (error) {
    console.error('Get all answer writing error:', error);
    handleError(res, error, 'Failed to fetch exercises');
  }
};

// @desc    Get available exercises for students
// @route   GET /api/answer-writing/available
// @access  Private (Student)
const getAvailableExercises = async (req, res) => {
  try {
    const { lang = 'en' } = req.query;
    const now = new Date();
    
    const userSubmissions = await StudentAnswerSubmission.find({
      studentId: req.user._id
    });
    
    const submittedExerciseIds = userSubmissions.map(sub => sub.answerWritingId.toString());
    
    const exercises = await AnswerWriting.find({ 
      isActive: true,
      endDateTime: { $gte: now },
      _id: { $nin: submittedExerciseIds }
    })
      .select('-createdBy -updatedBy -__v')
      .sort({ order: -1, startDateTime: 1 });

    const exercisesWithStatus = exercises.map(exercise => {
      const exerciseObj = getBilingualContent(exercise, lang);
      
      const isAvailable = exercise.isAvailable;
      const isUpcoming = exercise.isUpcoming;
      const isExpired = exercise.isExpired;
      
      if (isAvailable) {
        exerciseObj.questions = exercise.questions;
        exerciseObj.questionPaperPDF = exercise.questionPaperPDF;
        exerciseObj.questionPaperPDFHi = exercise.questionPaperPDFHi;
      } else {
        exerciseObj.questions = [];
        exerciseObj.questionPaperPDF = '';
        exerciseObj.questionPaperPDFHi = '';
        exerciseObj.message = isUpcoming 
          ? (lang === 'hi' ? 'प्रश्न ' + new Date(exercise.startDateTime).toLocaleString() + ' को उपलब्ध होंगे' : 'Questions will be available on ' + new Date(exercise.startDateTime).toLocaleString())
          : (lang === 'hi' ? 'यह अभ्यास समाप्त हो चुका है' : 'This exercise has expired');
      }
      
      exerciseObj.status = 'pending';
      exerciseObj.isAvailable = isAvailable;
      exerciseObj.isUpcoming = isUpcoming;
      exerciseObj.isExpired = isExpired;
      exerciseObj.startDateTime = exercise.startDateTime;
      exerciseObj.endDateTime = exercise.endDateTime;
      
      return exerciseObj;
    });

    res.json({
      success: true,
      count: exercisesWithStatus.length,
      data: exercisesWithStatus
    });

  } catch (error) {
    console.error('Get available exercises error:', error);
    handleError(res, error, 'Failed to fetch exercises');
  }
};

// @desc    Get single exercise by ID with student's submission
// @route   GET /api/answer-writing/:id
// @access  Private
const getAnswerWritingById = async (req, res) => {
  try {
    const { lang = 'en' } = req.query;
    const exercise = await AnswerWriting.findById(req.params.id);

    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
    }

    const exerciseObj = getBilingualContent(exercise, lang);
    
    if (req.user.role !== 'admin') {
      const submission = await StudentAnswerSubmission.findOne({
        answerWritingId: exercise._id,
        studentId: req.user._id
      });
      
      exerciseObj.userSubmission = submission;
      exerciseObj.hasSubmitted = !!submission;
    }

    res.json({
      success: true,
      data: exerciseObj
    });

  } catch (error) {
    console.error('Get exercise by ID error:', error);
    handleError(res, error, 'Failed to fetch exercise');
  }
};

// @desc    Update answer writing exercise
// @route   PUT /api/answer-writing/:id
// @access  Private/Admin
const updateAnswerWriting = async (req, res) => {
  try {
    const exercise = await AnswerWriting.findById(req.params.id);

    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
    }

    if (req.body.name && req.body.name !== exercise.name) {
      const existingExercise = await AnswerWriting.findOne({
        name: { $regex: new RegExp(`^${req.body.name}$`, 'i') },
        _id: { $ne: exercise._id }
      });

      if (existingExercise) {
        return res.status(400).json({
          success: false,
          message: 'An exercise with this name already exists'
        });
      }
    }

    if (req.body.startDateTime && req.body.endDateTime) {
      const start = new Date(req.body.startDateTime);
      const end = new Date(req.body.endDateTime);
      
      if (start >= end) {
        return res.status(400).json({
          success: false,
          message: 'End date time must be after start date time'
        });
      }
    }

    const updates = {};
    const updateableFields = ['name', 'nameHi', 'description', 'descriptionHi', 'questions', 'questionPaperPDF', 'questionPaperPDFHi', 'startDateTime', 'endDateTime', 'isActive', 'order'];
    
    updateableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'startDateTime' || field === 'endDateTime') {
          updates[field] = new Date(req.body[field]);
        } else if (field === 'questions') {
          updates[field] = req.body[field].map(q => ({
            questionText: q.questionText,
            questionTextHi: q.questionTextHi || ''
          }));
        } else {
          updates[field] = req.body[field];
        }
      }
    });

    updates.updatedBy = req.user._id;

    const updatedExercise = await AnswerWriting.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Exercise updated successfully',
      data: updatedExercise
    });

  } catch (error) {
    console.error('Update exercise error:', error);
    handleError(res, error, 'Failed to update exercise');
  }
};

// @desc    Delete answer writing exercise (HARD DELETE - also deletes all submissions)
// @route   DELETE /api/answer-writing/:id
// @access  Private/Admin
const deleteAnswerWriting = async (req, res) => {
  try {
    const exercise = await AnswerWriting.findById(req.params.id);

    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
    }

    // Delete all submissions and their files from R2
    const submissions = await StudentAnswerSubmission.find({ answerWritingId: exercise._id });
    for (const submission of submissions) {
      for (const answer of submission.answers) {
        await deleteFromR2(answer.answerPDF);
      }
    }
    
    const deletedSubmissions = await StudentAnswerSubmission.deleteMany({ answerWritingId: exercise._id });
    await exercise.deleteOne();

    res.json({
      success: true,
      message: `Exercise deleted successfully. ${deletedSubmissions.deletedCount} submissions also deleted.`,
      data: {
        exerciseDeleted: true,
        submissionsDeleted: deletedSubmissions.deletedCount
      }
    });

  } catch (error) {
    console.error('Delete exercise error:', error);
    handleError(res, error, 'Failed to delete exercise');
  }
};

// @desc    Toggle exercise status
// @route   PATCH /api/answer-writing/:id/toggle-status
// @access  Private/Admin
const toggleExerciseStatus = async (req, res) => {
  try {
    const exercise = await AnswerWriting.findById(req.params.id);

    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
    }

    exercise.isActive = !exercise.isActive;
    exercise.updatedBy = req.user._id;
    await exercise.save();

    const status = exercise.isActive ? 'activated' : 'deactivated';

    res.json({
      success: true,
      message: `Exercise ${status} successfully`,
      data: exercise
    });

  } catch (error) {
    console.error('Toggle exercise status error:', error);
    handleError(res, error, 'Failed to toggle exercise status');
  }
};

// @desc    Submit answers for an exercise (student) with R2 file upload
// @route   POST /api/answer-writing/:id/submit
// @access  Private (Student)
const submitAnswers = async (req, res) => {
  try {
    const { id } = req.params;
    const { language } = req.body;
    const studentId = req.user._id;
    const answerFile = req.file;

    if (!answerFile) {
      return res.status(400).json({
        success: false,
        message: 'Please upload your answer PDF file'
      });
    }

    const exercise = await AnswerWriting.findById(id);
    if (!exercise || !exercise.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found or not active'
      });
    }

    const now = new Date();
    if (now < exercise.startDateTime) {
      return res.status(400).json({
        success: false,
        message: 'Submission has not started yet'
      });
    }

    const existingSubmission = await StudentAnswerSubmission.findOne({
      answerWritingId: id,
      studentId
    });

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted for this exercise'
      });
    }

    const isLate = now > exercise.endDateTime;
    
    // Get the file URL from multer-s3
    let fileUrl = answerFile.location;
    console.log('Original R2 URL:', fileUrl);
    
    // Store as public URL format
    if (process.env.R2_PUBLIC_URL) {
      // Extract the key correctly
      let key = '';
      if (fileUrl.includes('.r2.cloudflarestorage.com/')) {
        const parts = fileUrl.split('.r2.cloudflarestorage.com/');
        if (parts[1]) {
          let path = parts[1];
          // Remove bucket name from the path
          if (path.startsWith(`${process.env.R2_BUCKET_NAME}/`)) {
            path = path.substring(process.env.R2_BUCKET_NAME.length + 1);
          }
          key = path;
        }
      }
      
      if (key) {
        fileUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
        console.log('Stored as public URL:', fileUrl);
      }
    }
    
    const processedAnswers = [{
      questionId: exercise._id,
      answerPDF: fileUrl,
      language: language || 'en',
      submittedAt: now
    }];

    const submission = new StudentAnswerSubmission({
      answerWritingId: id,
      studentId,
      answers: processedAnswers,
      isLate,
      submittedAt: now,
      submissionLanguage: language || 'en'
    });

    await submission.save();

    res.status(201).json({
      success: true,
      message: isLate ? 'Answers submitted successfully (Late Submission)' : 'Answers submitted successfully',
      data: {
        submissionId: submission._id,
        fileUrl: fileUrl
      }
    });

  } catch (error) {
    console.error('Submit answers error:', error);
    handleError(res, error, 'Failed to submit answers');
  }
};

// @desc    Get student's submissions
// @route   GET /api/answer-writing/my-submissions
// @access  Private (Student)
const getMySubmissions = async (req, res) => {
  try {
    const { lang = 'en' } = req.query;
    const { getPresignedUrl } = require('../config/r2');

    const submissions = await StudentAnswerSubmission.find({ studentId: req.user._id })
      .populate('answerWritingId', 'name nameHi description descriptionHi questions questionPaperPDF questionPaperPDFHi startDateTime endDateTime')
      .sort({ submittedAt: -1 });

    const data = await Promise.all(submissions.map(async (sub) => {
      const subObj = sub.toObject();
      const exercise = subObj.answerWritingId;
      
      // Generate presigned URLs for answers
      for (let i = 0; i < subObj.answers.length; i++) {
        const answer = subObj.answers[i];
        if (answer.answerPDF) {
          answer.answerPDF = await getPresignedUrl(answer.answerPDF);
        }
      }
      
      if (exercise) {
        if (lang === 'hi') {
          exercise.name = exercise.nameHi || exercise.name;
          exercise.description = exercise.descriptionHi || exercise.description;
          exercise.questionPaperPDF = exercise.questionPaperPDFHi || exercise.questionPaperPDF;
        }
        
        if (exercise.questions && exercise.questions.length) {
          subObj.answers = subObj.answers.map(answer => {
            const question = exercise.questions.find(q => q._id.toString() === answer.questionId.toString());
            if (question) {
              answer.questionText = lang === 'hi' 
                ? (question.questionTextHi || question.questionText) 
                : question.questionText;
              answer.questionTextHi = question.questionTextHi;
            }
            return answer;
          });
        }
      }
      
      return subObj;
    }));

    res.json({
      success: true,
      count: data.length,
      data
    });

  } catch (error) {
    console.error('Get my submissions error:', error);
    handleError(res, error, 'Failed to fetch submissions');
  }
};

// @desc    Get all submissions for an exercise (admin)
// @route   GET /api/answer-writing/:id/submissions
// @access  Private/Admin
const getExerciseSubmissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { getPresignedUrl } = require('../config/r2');

    const submissions = await StudentAnswerSubmission.find({ answerWritingId: id })
      .populate('studentId', 'fullName email phone')
      .sort({ submittedAt: -1 });

    // Generate presigned URLs for each submission
    const submissionsWithUrls = await Promise.all(submissions.map(async (submission) => {
      const subObj = submission.toObject();
      
      for (let i = 0; i < subObj.answers.length; i++) {
        const answer = subObj.answers[i];
        if (answer.answerPDF) {
          // Generate presigned URL for each answer
          answer.answerPDF = await getPresignedUrl(answer.answerPDF);
        }
      }
      
      return subObj;
    }));

    res.json({
      success: true,
      count: submissionsWithUrls.length,
      data: submissionsWithUrls
    });

  } catch (error) {
    console.error('Get exercise submissions error:', error);
    handleError(res, error, 'Failed to fetch submissions');
  }
};


const submitEvaluation = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { answerIndex, evaluatedPDF, remarks, score } = req.body;

    // Validate input
    if (answerIndex === undefined || !evaluatedPDF) {
      return res.status(400).json({
        success: false,
        message: 'Answer index and evaluated PDF URL are required'
      });
    }

    // Validate Google Drive URL
    if (!evaluatedPDF.includes('drive.google.com') && !evaluatedPDF.includes('docs.google.com')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Google Drive URL'
      });
    }

    // Find the submission
    const submission = await StudentAnswerSubmission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Check if answer index exists
    if (answerIndex >= submission.answers.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid answer index'
      });
    }

    // Update evaluation
    submission.answers[answerIndex].evaluation = {
      evaluatedPDF: evaluatedPDF.trim(),
      evaluatedAt: new Date(),
      evaluatedBy: req.user._id,
      remarks: remarks || '',
      score: score || null
    };

    await submission.save();

    // Populate student info for response
    await submission.populate('studentId', 'fullName email');

    res.json({
      success: true,
      message: 'Evaluation submitted successfully',
      data: {
        submissionId: submission._id,
        answerIndex: answerIndex,
        evaluatedPDF: evaluatedPDF,
        studentName: submission.studentId?.fullName,
        evaluatedAt: submission.answers[answerIndex].evaluation.evaluatedAt
      }
    });

  } catch (error) {
    console.error('Submit evaluation error:', error);
    handleError(res, error, 'Failed to submit evaluation');
  }
};

// @desc    Get evaluation status for a submission
// @route   GET /api/answer-writing/submissions/:submissionId/evaluation-status
// @access  Private/Admin
const getEvaluationStatus = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const submission = await StudentAnswerSubmission.findById(submissionId)
      .populate('studentId', 'fullName email');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    const evaluationStatus = submission.answers.map((answer, index) => ({
      answerIndex: index,
      questionId: answer.questionId,
      isEvaluated: !!(answer.evaluation && answer.evaluation.evaluatedPDF),
      evaluatedPDF: answer.evaluation?.evaluatedPDF || '',
      evaluatedAt: answer.evaluation?.evaluatedAt || null,
      remarks: answer.evaluation?.remarks || '',
      score: answer.evaluation?.score || null
    }));

    res.json({
      success: true,
      data: {
        submissionId: submission._id,
        studentName: submission.studentId?.fullName,
        studentEmail: submission.studentId?.email,
        submissionDate: submission.submittedAt,
        isLate: submission.isLate,
        evaluationStatus: evaluationStatus
      }
    });

  } catch (error) {
    console.error('Get evaluation status error:', error);
    handleError(res, error, 'Failed to get evaluation status');
  }
};

// @desc    Get all evaluations for an exercise
// @route   GET /api/answer-writing/:exerciseId/evaluations
// @access  Private/Admin
const getExerciseEvaluations = async (req, res) => {
  try {
    const { exerciseId } = req.params;

    const submissions = await StudentAnswerSubmission.find({ answerWritingId: exerciseId })
      .populate('studentId', 'fullName email phone')
      .sort({ submittedAt: -1 });

    const evaluationData = submissions.map(submission => {
      const subObj = submission.toObject();
      
      // Check if all answers are evaluated
      const allEvaluated = subObj.answers.every(answer => 
        answer.evaluation && answer.evaluation.evaluatedPDF
      );
      
      const anyEvaluated = subObj.answers.some(answer => 
        answer.evaluation && answer.evaluation.evaluatedPDF
      );

      return {
        submissionId: subObj._id,
        studentName: subObj.studentId?.fullName || 'Unknown',
        studentEmail: subObj.studentId?.email || '',
        submittedAt: subObj.submittedAt,
        isLate: subObj.isLate,
        answerCount: subObj.answers.length,
        evaluatedCount: subObj.answers.filter(a => a.evaluation && a.evaluation.evaluatedPDF).length,
        allEvaluated: allEvaluated,
        anyEvaluated: anyEvaluated,
        answers: subObj.answers.map((answer, index) => ({
          answerIndex: index,
          isEvaluated: !!(answer.evaluation && answer.evaluation.evaluatedPDF),
          evaluatedPDF: answer.evaluation?.evaluatedPDF || '',
          score: answer.evaluation?.score || null,
          remarks: answer.evaluation?.remarks || ''
        }))
      };
    });

    res.json({
      success: true,
      count: evaluationData.length,
      data: evaluationData
    });

  } catch (error) {
    console.error('Get exercise evaluations error:', error);
    handleError(res, error, 'Failed to fetch evaluations');
  }
};

// @desc    Bulk submit evaluations for an exercise
// @route   POST /api/answer-writing/:exerciseId/evaluations/bulk
// @access  Private/Admin
const bulkSubmitEvaluations = async (req, res) => {
  try {
    const { exerciseId } = req.params;
    const { evaluations } = req.body;

    if (!evaluations || !Array.isArray(evaluations) || evaluations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Evaluations array is required'
      });
    }

    const results = [];
    const errors = [];

    for (const evalData of evaluations) {
      try {
        const { submissionId, answerIndex, evaluatedPDF, remarks, score } = evalData;

        const submission = await StudentAnswerSubmission.findById(submissionId);
        if (!submission) {
          errors.push({
            submissionId,
            error: 'Submission not found'
          });
          continue;
        }

        if (answerIndex >= submission.answers.length) {
          errors.push({
            submissionId,
            error: 'Invalid answer index'
          });
          continue;
        }

        // Update evaluation
        submission.answers[answerIndex].evaluation = {
          evaluatedPDF: evaluatedPDF.trim(),
          evaluatedAt: new Date(),
          evaluatedBy: req.user._id,
          remarks: remarks || '',
          score: score || null
        };

        await submission.save();
        results.push({
          submissionId,
          answerIndex,
          success: true
        });

      } catch (error) {
        errors.push({
          submissionId: evalData.submissionId,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Processed ${results.length} evaluations successfully`,
      data: {
        succeeded: results,
        failed: errors
      }
    });

  } catch (error) {
    console.error('Bulk submit evaluations error:', error);
    handleError(res, error, 'Failed to submit evaluations');
  }
};

const updateModelAnswer = async (req, res) => {
  try {
    const { id } = req.params;
    const { remark, answerEnglish, answerHindi, modelAnswerPDF, modelAnswerPDFHi, isActive } = req.body;

    const exercise = await AnswerWriting.findById(id);
    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
    }

    // Update model answer fields
    if (remark !== undefined) exercise.modelAnswer.remark = remark;
    if (answerEnglish !== undefined) exercise.modelAnswer.answerEnglish = answerEnglish;
    if (answerHindi !== undefined) exercise.modelAnswer.answerHindi = answerHindi;
    if (modelAnswerPDF !== undefined) exercise.modelAnswer.modelAnswerPDF = modelAnswerPDF;
    if (modelAnswerPDFHi !== undefined) exercise.modelAnswer.modelAnswerPDFHi = modelAnswerPDFHi;
    if (isActive !== undefined) exercise.modelAnswer.isActive = isActive;
    
    exercise.modelAnswer.updatedAt = new Date();
    exercise.modelAnswer.updatedBy = req.user._id;
    exercise.updatedBy = req.user._id;

    await exercise.save();

    res.json({
      success: true,
      message: 'Model answer updated successfully',
      data: exercise.modelAnswer
    });

  } catch (error) {
    console.error('Update model answer error:', error);
    handleError(res, error, 'Failed to update model answer');
  }
};

// @desc    Get model answer for an exercise
// @route   GET /api/answer-writing/:id/model-answer
// @access  Private/Admin
const getModelAnswer = async (req, res) => {
  try {
    const { id } = req.params;

    const exercise = await AnswerWriting.findById(id)
      .populate('modelAnswer.updatedBy', 'fullName email');

    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
    }

    res.json({
      success: true,
      data: {
        remark: exercise.modelAnswer.remark || '',
        answerEnglish: exercise.modelAnswer.answerEnglish || '',
        answerHindi: exercise.modelAnswer.answerHindi || '',
        modelAnswerPDF: exercise.modelAnswer.modelAnswerPDF || '',
        modelAnswerPDFHi: exercise.modelAnswer.modelAnswerPDFHi || '',
        isActive: exercise.modelAnswer.isActive !== undefined ? exercise.modelAnswer.isActive : true,
        updatedAt: exercise.modelAnswer.updatedAt,
        updatedBy: exercise.modelAnswer.updatedBy
      }
    });

  } catch (error) {
    console.error('Get model answer error:', error);
    handleError(res, error, 'Failed to get model answer');
  }
};

// @desc    Update specific model answer field
// @route   PATCH /api/answer-writing/:id/model-answer/:field
// @access  Private/Admin
const updateModelAnswerField = async (req, res) => {
  try {
    const { id, field } = req.params;
    const { value } = req.body;

    const validFields = ['remark', 'answerEnglish', 'answerHindi', 'modelAnswerPDF', 'modelAnswerPDFHi', 'isActive'];
    if (!validFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid field name'
      });
    }

    const exercise = await AnswerWriting.findById(id);
    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
    }

    // Update specific field
    if (field === 'isActive') {
      exercise.modelAnswer.isActive = value;
    } else {
      exercise.modelAnswer[field] = value;
    }

    exercise.modelAnswer.updatedAt = new Date();
    exercise.modelAnswer.updatedBy = req.user._id;
    exercise.updatedBy = req.user._id;

    await exercise.save();

    res.json({
      success: true,
      message: `${field} updated successfully`,
      data: {
        field,
        value: exercise.modelAnswer[field]
      }
    });

  } catch (error) {
    console.error('Update model answer field error:', error);
    handleError(res, error, 'Failed to update model answer field');
  }
};

// Add these functions to your answerWritingController.js

// @desc    Get student's submission with evaluation for a specific exercise
// @route   GET /api/answer-writing/:exerciseId/my-evaluation
// @access  Private (Student)
const getMyEvaluation = async (req, res) => {
  try {
    const { exerciseId } = req.params;
    const { lang = 'en' } = req.query;
    const studentId = req.user._id;

    // Get the exercise with model answer
    const exercise = await AnswerWriting.findById(exerciseId);
    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
    }

    // Get student's submission
    const submission = await StudentAnswerSubmission.findOne({
      answerWritingId: exerciseId,
      studentId: studentId
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'No submission found for this exercise'
      });
    }

    // Prepare response data
    const responseData = {
      exercise: {
        _id: exercise._id,
        name: lang === 'hi' ? (exercise.nameHi || exercise.name) : exercise.name,
        nameHi: exercise.nameHi,
        description: lang === 'hi' ? (exercise.descriptionHi || exercise.description) : exercise.description,
        descriptionHi: exercise.descriptionHi,
        questions: exercise.questions.map(q => ({
          _id: q._id,
          questionText: lang === 'hi' ? (q.questionTextHi || q.questionText) : q.questionText,
          questionTextHi: q.questionTextHi
        }))
      },
      submission: {
        _id: submission._id,
        submittedAt: submission.submittedAt,
        isLate: submission.isLate,
        submissionLanguage: submission.submissionLanguage,
        answers: submission.answers.map((answer, index) => ({
          index: index,
          questionId: answer.questionId,
          answerPDF: answer.answerPDF,
          language: answer.language,
          evaluation: answer.evaluation || null
        }))
      },
      modelAnswer: exercise.modelAnswer && exercise.modelAnswer.isActive ? {
        remark: exercise.modelAnswer.remark || '',
        answerEnglish: exercise.modelAnswer.answerEnglish || '',
        answerHindi: exercise.modelAnswer.answerHindi || '',
        modelAnswerPDF: exercise.modelAnswer.modelAnswerPDF || '',
        modelAnswerPDFHi: exercise.modelAnswer.modelAnswerPDFHi || '',
        isActive: exercise.modelAnswer.isActive
      } : null
    };

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Get my evaluation error:', error);
    handleError(res, error, 'Failed to get evaluation');
  }
};

// @desc    Get all evaluated submissions for a student
// @route   GET /api/answer-writing/my-evaluations
// @access  Private (Student)
const getMyEvaluations = async (req, res) => {
  try {
    const { lang = 'en' } = req.query;
    const studentId = req.user._id;

    // Get all submissions with populated exercise data
    const submissions = await StudentAnswerSubmission.find({ studentId: studentId })
      .populate('answerWritingId', 'name nameHi description descriptionHi questions modelAnswer startDateTime endDateTime')
      .sort({ submittedAt: -1 });

    // Filter to only show submissions that have at least one evaluated answer
    const evaluatedSubmissions = submissions.filter(sub => 
      sub.answers.some(a => a.evaluation && a.evaluation.evaluatedPDF)
    );

    const data = evaluatedSubmissions.map(sub => {
      const exercise = sub.answerWritingId;
      const evaluatedAnswers = sub.answers
        .map((answer, index) => ({
          index: index,
          questionId: answer.questionId,
          questionText: lang === 'hi' 
            ? (exercise.questions.find(q => q._id.toString() === answer.questionId.toString())?.questionTextHi || '')
            : (exercise.questions.find(q => q._id.toString() === answer.questionId.toString())?.questionText || ''),
          answerPDF: answer.answerPDF,
          language: answer.language,
          evaluation: answer.evaluation || null,
          isEvaluated: !!(answer.evaluation && answer.evaluation.evaluatedPDF)
        }))
        .filter(a => a.isEvaluated);

      // Get model answer if active
      const modelAnswer = exercise.modelAnswer && exercise.modelAnswer.isActive ? {
        remark: exercise.modelAnswer.remark || '',
        answerEnglish: exercise.modelAnswer.answerEnglish || '',
        answerHindi: exercise.modelAnswer.answerHindi || '',
        modelAnswerPDF: exercise.modelAnswer.modelAnswerPDF || '',
        modelAnswerPDFHi: exercise.modelAnswer.modelAnswerPDFHi || '',
        isActive: exercise.modelAnswer.isActive
      } : null;

      return {
        submissionId: sub._id,
        exercise: {
          _id: exercise._id,
          name: lang === 'hi' ? (exercise.nameHi || exercise.name) : exercise.name,
          nameHi: exercise.nameHi,
          description: lang === 'hi' ? (exercise.descriptionHi || exercise.description) : exercise.description,
          startDateTime: exercise.startDateTime,
          endDateTime: exercise.endDateTime
        },
        submittedAt: sub.submittedAt,
        isLate: sub.isLate,
        submissionLanguage: sub.submissionLanguage,
        evaluatedAnswers: evaluatedAnswers,
        modelAnswer: modelAnswer,
        evaluationCount: evaluatedAnswers.length,
        totalQuestions: exercise.questions?.length || 0,
        allEvaluated: evaluatedAnswers.length === (exercise.questions?.length || 0)
      };
    });

    res.json({
      success: true,
      count: data.length,
      data: data
    });

  } catch (error) {
    console.error('Get my evaluations error:', error);
    handleError(res, error, 'Failed to get evaluations');
  }
};

// Add to module.exports
module.exports = {
  createAnswerWriting,
  getAllAnswerWritingAdmin,
  getAvailableExercises,
  getAnswerWritingById,
  updateAnswerWriting,
  deleteAnswerWriting,
  toggleExerciseStatus,
  submitAnswers,
  getMySubmissions,
  getExerciseSubmissions,
  submitEvaluation,
  getEvaluationStatus,
  getExerciseEvaluations,
  bulkSubmitEvaluations,
  updateModelAnswer,
  getModelAnswer,
  updateModelAnswerField,
  getMyEvaluation,
  getMyEvaluations
};