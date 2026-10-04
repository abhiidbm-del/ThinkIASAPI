const mongoose = require('mongoose');

// Updated document schema with English and Hindi fields
const documentSchema = new mongoose.Schema({
  // English fields
  fileNameEnglish: {
    type: String,
    required: false // Not required, at least one of English or Hindi is required
  },
  fileLinkEnglish: {
    type: String,
    required: false,
    validate: {
      validator: function(v) {
        // If fileNameEnglish exists, fileLinkEnglish is required
        if (this.fileNameEnglish && !v) return false;
        return true;
      },
      message: 'File link for English is required if English file name is provided'
    }
  },
  descriptionEnglish: {
    type: String,
    default: ''
  },
  
  // Hindi fields
  fileNameHindi: {
    type: String,
    required: false
  },
  fileLinkHindi: {
    type: String,
    required: false,
    validate: {
      validator: function(v) {
        // If fileNameHindi exists, fileLinkHindi is required
        if (this.fileNameHindi && !v) return false;
        return true;
      },
      message: 'File link for Hindi is required if Hindi file name is provided'
    }
  },
  descriptionHindi: {
    type: String,
    default: ''
  }
}, {
  _id: false // Prevent automatic _id for subdocuments
});

// Custom validation to ensure at least one language is provided
// documentSchema.pre('validate', function(next) {
//   const hasEnglish = this.fileNameEnglish || this.fileLinkEnglish;
//   const hasHindi = this.fileNameHindi || this.fileLinkHindi;
  
//   if (!hasEnglish && !hasHindi) {
//     const err = new Error('At least one language (English or Hindi) must be provided');
//     next(err);
//   } else {
//     next();
//   }
// });

const subjectSchema = new mongoose.Schema({
  subjectName: {
    type: String,
    required: true
  },
  documents: [documentSchema]
}, {
  _id: false
});

const syllabusSchema = new mongoose.Schema({
  prelims: {
    gs1: documentSchema,
    gs2: documentSchema
  },
  mains: {
    essay: documentSchema,
    gs1: documentSchema,
    gs2: documentSchema,
    gs3: documentSchema,
    gs4: documentSchema,
    optionalSubjects: [subjectSchema]
  },
  type: {
    type: String,
    enum: ['prelims', 'mains'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Add middleware to validate documents
syllabusSchema.pre('save', function(next) {
  // Validate all documents in the schema
  const validateDocuments = (docs) => {
    if (!docs) return true;
    
    if (Array.isArray(docs)) {
      return docs.every(doc => {
        const hasEnglish = doc.fileNameEnglish || doc.fileLinkEnglish;
        const hasHindi = doc.fileNameHindi || doc.fileLinkHindi;
        return hasEnglish || hasHindi;
      });
    } else if (typeof docs === 'object') {
      const hasEnglish = docs.fileNameEnglish || docs.fileLinkEnglish;
      const hasHindi = docs.fileNameHindi || docs.fileLinkHindi;
      return hasEnglish || hasHindi;
    }
    return true;
  };
  
  // Validate prelims
  if (this.prelims && !validateDocuments(this.prelims.gs1)) {
    return next(new Error('Prelims GS1: At least one language must be provided'));
  }
  if (this.prelims && !validateDocuments(this.prelims.gs2)) {
    return next(new Error('Prelims GS2: At least one language must be provided'));
  }
  
  // Validate mains
  // if (this.mains) {
  //   if (this.mains.essay && !validateDocuments(this.mains.essay)) {
  //     return next(new Error('Mains Essay: At least one language must be provided'));
  //   }
  //   for (let i = 1; i <= 4; i++) {
  //     const paper = this.mains[`gs${i}`];
  //     if (paper && !validateDocuments(paper)) {
  //       return next(new Error(`Mains GS${i}: At least one language must be provided`));
  //     }
  //   }
    
  //   if (this.mains.optionalSubjects) {
  //     for (const subject of this.mains.optionalSubjects) {
  //       if (subject.documents) {
  //         for (const doc of subject.documents) {
  //           const hasEnglish = doc.fileNameEnglish || doc.fileLinkEnglish;
  //           const hasHindi = doc.fileNameHindi || doc.fileLinkHindi;
  //           if (!hasEnglish && !hasHindi) {
  //             return next(new Error(`Optional Subject "${subject.subjectName}": At least one language must be provided`));
  //           }
  //         }
  //       }
  //     }
  //   }
  // }
  
  next();
});

module.exports = mongoose.model('Syllabus', syllabusSchema);