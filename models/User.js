const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, USER_TYPES } = require('../config/constants');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please fill a valid email address']
  },
  phone: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.STUDENT
  },
  type: {
    type: String,
    enum: Object.values(USER_TYPES),
    default: USER_TYPES.FRESH,
    // Only required for students, not for admins
    required: function() {
      return this.role === ROLES.STUDENT;
    }
  },
  planActivatedAt: Date,
  emailVerifiedAt: Date,
  appAuthVersion: {type:Number,default:0},
  address: {pincode:String,houseNo:String,colony:String,city:String},
  preferredLanguage: {type:String,enum:['en','hi'],default:'en'},
  notificationsEnabled: {type:Boolean,default:true},
  deletedAt: Date,
  deletionReason: String,
  isActive: { type: Boolean, default: true },
  purchasedPlanId: String,
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  planExpiryAt: Date
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  
  // Remove type field for admin users
  if (user.role === 'admin') {
    delete user.type;
  }
  
  return user;
};

module.exports = mongoose.model('User', userSchema);
