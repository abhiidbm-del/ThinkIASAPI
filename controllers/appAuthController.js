const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Challenge = require('../models/AppAuthChallenge');
const Session = require('../models/AppAuthSession');
const {JWT} = require('../config/constants');
const {inactiveAccount} = require('../utils/accountStatus');
const {findLoginUser} = require('../utils/loginAccount');

// Explicit app test flow requested by the client. No email service is invoked.
const TEST_OTP = '1234';
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_SECONDS = 120;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const error = (status, message, code) => Object.assign(new Error(message), {status, code});
const handle = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (err) {
    const status = err.code === 11000 ? 409 : err.status || (err.name === 'ValidationError' ? 400 : 500);
    res.status(status).json({success:false, message:err.code === 11000 ? 'This email is already registered. Please log in.' : status === 500 ? 'Unable to complete the request. Please try again.' : err.message, ...(typeof err.code === 'string' ? {code:err.code} : {})});
  }
};
const publicUser = user => ({_id:user._id,fullName:user.fullName,email:user.email,phone:user.phone,role:user.role,type:user.type,isActive:user.isActive !== false,emailVerified:!!user.emailVerifiedAt});
const available = (email, purpose) => ({email,purpose,expiresAt:{$gt:new Date()},consumedAt:{$exists:false}});
function challengeResponse(res, challenge) {
  res.json({success:true,message:'Test OTP ready. Use 1234; no email is sent.',data:{challengeId:challenge._id,email:challenge.email,purpose:challenge.purpose,expiresAt:challenge.expiresAt,resendAfterSeconds:RESEND_SECONDS,otpLength:4,testMode:true}});
}
async function issue(email, purpose) {
  const challenge = await Challenge.create({_id:crypto.randomUUID(),email,purpose,expiresAt:new Date(Date.now()+OTP_TTL_MS)});
  return challenge;
}
async function student(email) {
  const user = await findLoginUser(email);
  if (!user || user.role !== 'student') throw error(404,'No student account found with this email.','ACCOUNT_NOT_FOUND');
  if (user.isActive === false) throw error(403,inactiveAccount.message,'ACCOUNT_INACTIVE');
  return user;
}
async function sessionResponse(res,user,status=200) {
  const expiresAt = new Date(Date.now()+24*60*60*1000);
  const appSessionId = crypto.randomUUID();
  const token = jwt.sign({userId:String(user._id),appSessionId,appAuthVersion:user.appAuthVersion||0},JWT.SECRET,{expiresIn:'24h'});
  await Session.create({_id:appSessionId,user:user._id,expiresAt});
  res.status(status).json({success:true,message:status===201?'Registration successful.':'Login successful.',data:{token,tokenType:'Bearer',expiresAt,user:publicUser(user)}});
}
exports.sendOtp = handle(async (req,res) => {
  if (await User.exists({email:req.body.email})) throw error(409,'This email is already registered. Please log in.','EMAIL_EXISTS');
  challengeResponse(res,await issue(req.body.email,'registration'));
});
exports.forgotPassword = handle(async (req,res) => {
  await student(req.body.email);
  challengeResponse(res,await issue(req.body.email,'password_reset'));
});
exports.resendOtp = handle(async (req,res) => {
  const filter = {_id:req.body.challengeId,email:req.body.email,consumedAt:{$exists:false},verifiedAt:{$exists:false}};
  const current = await Challenge.findOne(filter);
  if (!current) throw error(400,'OTP request is invalid or already verified. Start again.','INVALID_CHALLENGE');
  const retryAfterSeconds = Math.ceil((new Date(current.updatedAt).getTime()+RESEND_SECONDS*1000-Date.now())/1000);
  if (retryAfterSeconds>0) return res.status(429).json({success:false,message:'Please wait before requesting another code.',data:{retryAfterSeconds}});
  const challenge = await Challenge.findOneAndUpdate({...filter,updatedAt:current.updatedAt},{$set:{expiresAt:new Date(Date.now()+OTP_TTL_MS),attempts:0}},{new:true});
  if (!challenge) throw error(409,'OTP request changed. Please retry.');
  challengeResponse(res,challenge);
});
function verify(purpose,tokenField) {
  return handle(async (req,res) => {
    const filter = {...available(req.body.email,purpose),_id:req.body.challengeId,verifiedAt:{$exists:false},attempts:{$lt:5}};
    if (req.body.otp !== TEST_OTP) {
      const challenge = await Challenge.findOneAndUpdate(filter,{$inc:{attempts:1}},{new:true});
      if (!challenge) throw error(400,'OTP expired, used or attempts exhausted. Request a new code.','INVALID_CHALLENGE');
      return res.status(challenge.attempts>=5?429:400).json({success:false,message:'Incorrect verification code.',data:{attemptsRemaining:Math.max(0,5-challenge.attempts)}});
    }
    const proof = crypto.randomBytes(32).toString('hex');
    const challenge = await Challenge.findOneAndUpdate(filter,{$set:{verifiedAt:new Date(),proofHash:hash(proof),expiresAt:new Date(Date.now()+OTP_TTL_MS)}},{new:true});
    if (!challenge) throw error(400,'OTP expired, used or attempts exhausted. Request a new code.','INVALID_CHALLENGE');
    res.json({success:true,message:purpose==='registration'?'Email verified. Complete your registration.':'Code verified. Set your new password.',data:{email:challenge.email,[tokenField]:proof,expiresAt:challenge.expiresAt}});
  });
}
exports.verifyEmail = verify('registration','verificationToken');
exports.verifyResetOtp = verify('password_reset','resetToken');
async function consume(email,purpose,proof) {
  const challenge = await Challenge.findOneAndUpdate({...available(email,purpose),proofHash:hash(proof),verifiedAt:{$exists:true}},{$set:{consumedAt:new Date()}},{new:true});
  if (!challenge) throw error(400,'Verification token is invalid, expired or already used. Verify your email again.','INVALID_VERIFICATION');
  return challenge;
}
exports.consumeEmailVerification = (email,proof) => consume(email,'registration',proof);
exports.register = handle(async (req,res) => {
  const {fullName,email,phone,password,verificationToken}=req.body;
  if (await User.exists({email})) throw error(409,'This email is already registered. Please log in.','EMAIL_EXISTS');
  await consume(email,'registration',verificationToken);
  const user = await User.create({fullName,email,phone,password,role:'student',type:'fresh',emailVerifiedAt:new Date()});
  await sessionResponse(res,user,201);
});
exports.login = handle(async (req,res) => {
  const user = await findLoginUser(req.body.email);
  if (!user || user.role !== 'student' || !await user.comparePassword(req.body.password)) throw error(401,'Invalid email or password.','INVALID_CREDENTIALS');
  if (user.isActive === false) throw error(403,inactiveAccount.message,'ACCOUNT_INACTIVE');
  await sessionResponse(res,user);
});
exports.resetPassword = handle(async (req,res) => {
  const user = await student(req.body.email);
  const password = await bcrypt.hash(req.body.password,10);
  await consume(req.body.email,'password_reset',req.body.resetToken);
  await User.updateOne({_id:user._id},{$set:{password},$inc:{appAuthVersion:1}});
  await Session.deleteMany({user:user._id});
  res.json({success:true,message:'Password reset successfully. Please log in with your new password.'});
});
exports.me = handle(async(req,res)=>res.json({success:true,data:{user:publicUser(req.user)}}));
exports.logout = handle(async(req,res)=>{
  await Session.deleteOne({_id:req.appSession._id,user:req.user._id});
  res.json({success:true,message:'Logged out successfully.'});
});
