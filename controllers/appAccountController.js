const bcrypt=require('bcryptjs');
const User=require('../models/User');
const Payment=require('../models/Payment');
const Download=require('../models/AppDownload');
const Feedback=require('../models/AppFeedback');
const Report=require('../models/AppReport');
const Module=require('../models/Module');
const Notification=require('../models/Notification');
const LiveTestSubmission=require('../models/LiveTestSubmission');
const StudentAnswerSubmission=require('../models/StudentAnswerSubmission');
const Result=require('../models/Result');
const Session=require('../models/AppAuthSession');
const {visibleAudiences}=require('../utils/notificationAudience');
const {fail,handle,list,text,profile,mediaUrl}=require('../utils/appApi');
const {getPublicR2Url,deleteFromR2}=require('../config/r2');
const {getConfig}=require('./appCatalogController');

const DELETE_REASONS=['Something was broken','I am not getting any invites','I have a privacy concern','Other'];
const TXN={success:'completed',failed:'failed',pending:'pending'};
const uiStatus=status=>status==='completed'?'success':status;
const paymentDto=p=>({id:p._id,_id:p._id,title:p.planName,planName:p.planName,amount:p.amount,currency:'INR',status:uiStatus(p.status),date:p.createdAt,createdAt:p.createdAt,transactionId:p.transactionId,plan:p.plan,programId:p.programId||null,batchId:p.batchId||null});

async function enrollmentUser(user){
  const query=User.findById(user._id);
  if(!query||typeof query.populate!=='function')return user;
  return await query.select('-password').populate('programId','programName programNameHindi displayImage').populate('batchId','batchName batchNameHindi')||user;
}
exports.profile=handle(async(req,res)=>res.json({success:true,data:{user:profile(await enrollmentUser(req.user),req),version:(await getConfig()).version}}));
function storedProfileImage(file,req){
  const stored=getPublicR2Url(file)||(file.filename?`/uploads/profiles/${file.filename}`:null);
  if(!stored)throw fail(400,'Unable to store the profile image.');
  return mediaUrl(stored,req);
}
const screenAddress=(body,current={})=>{
  const nested=body.address&&typeof body.address==='object'?body.address:{};
  const pick=(key,fallback='')=>nested[key]??body[key]??current[key]??fallback;
  return {pincode:String(pick('pincode')),houseNo:String(pick('houseNo')),locality:String(pick('locality')),colony:String(pick('colony')),city:String(pick('city'))};
};
exports.updateProfile=handle(async(req,res)=>{
  const body=req.body||{};
  const fullName=body.fullName??body.name;
  const phone=body.phone??body.mobileNo??body.mobile;
  const email=body.email;
  const password=body.password==null?'':String(body.password);
  const $set={};
  if(fullName!=null)$set.fullName=String(fullName).trim();
  if(phone!=null){
    const value=String(phone).trim();
    if(!/^\+?[0-9]{10,15}$/.test(value))throw fail(400,'Enter a valid mobile number.');
    $set.phone=value;
  }
  if(email!=null&&String(email).trim()){
    const next=String(email).trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next))throw fail(400,'Enter a valid email address.');
    if(next!==String(req.user.email||'').toLowerCase()&&await User.exists({email:next,_id:{$ne:req.user._id}}))throw fail(409,'This email is already registered.');
    $set.email=next;
  }
  const addressKeys=['pincode','houseNo','locality','colony','city'];
  if((body.address&&typeof body.address==='object')||addressKeys.some(key=>body[key]!=null))$set.address=screenAddress(body,req.user.address||{});
  if(body.preferredLanguage)$set.preferredLanguage=body.preferredLanguage;
  if(typeof body.notificationsEnabled==='boolean')$set.notificationsEnabled=body.notificationsEnabled;
  if(password){
    if(password.length<6)throw fail(400,'Password must have at least 6 characters.');
    if(String(body.confirmPassword??'')!==password)throw fail(400,'Passwords do not match.');
    $set.password=await bcrypt.hash(password,10);
  }
  if(req.file)$set.profileImage=storedProfileImage(req.file,req);
  if(!Object.keys($set).length)throw fail(400,'No profile fields to update.');
  const previous=req.user.profileImage;
  const user=await User.findByIdAndUpdate(req.user._id,{$set},{new:true});
  if(req.file&&previous&&previous!==$set.profileImage)await deleteFromR2(previous).catch(()=>false);
  res.json({success:true,message:'Profile updated.',data:{user:profile(await enrollmentUser(user),req)}});
});
exports.updateProfileImage=handle(async(req,res)=>{
  if(!req.file)throw fail(400,'Upload a JPEG, PNG, WebP or GIF image in the image field.');
  const previous=req.user.profileImage;
  const image=storedProfileImage(req.file,req);
  const user=await User.findByIdAndUpdate(req.user._id,{$set:{profileImage:image}},{new:true});
  if(previous&&previous!==image)await deleteFromR2(previous).catch(()=>false);
  res.json({success:true,message:'Profile image updated.',data:{user:profile(await enrollmentUser(user),req)}});
});
exports.deleteProfileImage=handle(async(req,res)=>{
  const previous=req.user.profileImage;
  const user=await User.findByIdAndUpdate(req.user._id,{$set:{profileImage:null}},{new:true});
  if(previous)await deleteFromR2(previous).catch(()=>false);
  res.json({success:true,message:'Profile image removed.',data:{user:profile(await enrollmentUser(user),req)}});
});
exports.updateProfilePicture=handle(async(req,res)=>{
  const uploaded=req.files?.profileImage?.[0]||req.files?.profilePic?.[0]||req.file;
  if(!uploaded)throw fail(400,'Please upload a profile image.');
  if(!/^image\/(jpeg|png|webp|gif)$/.test(uploaded.mimetype))throw fail(400,'Upload a JPEG, PNG, WebP or GIF image.');
  const profileImage=`data:${uploaded.mimetype};base64,${uploaded.buffer.toString('base64')}`;
  const user=await User.findByIdAndUpdate(req.user._id,{$set:{profileImage}},{new:true});
  res.json({success:true,message:'Profile picture updated.',data:{user:profile(user)}});
});
exports.preferences=handle(async(req,res)=>{
  const $set={};
  if(req.body.preferredLanguage)$set.preferredLanguage=req.body.preferredLanguage;
  if(typeof req.body.notificationsEnabled==='boolean')$set.notificationsEnabled=req.body.notificationsEnabled;
  if(!Object.keys($set).length)throw fail(400,'Send preferredLanguage or notificationsEnabled.');
  const user=await User.findByIdAndUpdate(req.user._id,{$set},{new:true});
  res.json({success:true,data:{user:profile(await enrollmentUser(user),req)}});
});
exports.deleteAccount=handle(async(req,res)=>{
  if(!DELETE_REASONS.includes(req.body.reason))throw fail(400,'Select a valid deletion reason.');
  await User.updateOne({_id:req.user._id},{$set:{isActive:false,deletedAt:new Date(),deletionReason:req.body.note?`${req.body.reason}: ${req.body.note}`:req.body.reason}});
  await Session.deleteMany({user:req.user._id});
  res.json({success:true,message:'Account deleted.'});
});
exports.transactions=handle(async(req,res)=>{
  const filter={user:req.user._id};
  if(req.query.status){const mapped=TXN[req.query.status];if(!mapped)throw fail(400,'status must be success, failed or pending.');filter.status=mapped;}
  await list(Payment,filter,req,res,{createdAt:-1},'plan planName amount status createdAt transactionId programId batchId',paymentDto);
});
exports.orders=handle(async(req,res)=>list(Payment,{user:req.user._id,status:'completed'},req,res,{createdAt:-1},'plan planName amount status createdAt transactionId programId batchId',paymentDto));
exports.downloads=handle(async(req,res)=>list(Download,{user:req.user._id},req,res,{createdAt:-1},null,d=>({id:d._id,source:d.source,resourceId:d.resourceId,name:d.name,downloadedAt:d.createdAt})));
exports.saveDownload=handle(async(req,res)=>{
  const source=req.body.source||'modules';
  const resource=await Module.findOne({_id:req.body.resourceId,isActive:{$ne:false},type:'file'}).lean();
  if(!resource)throw fail(404,'File not found.');
  const name=text(req,resource.name?.english,resource.name?.hindi);
  const doc=await Download.findOneAndUpdate({user:req.user._id,source,resourceId:resource._id},{$set:{name}},{new:true,upsert:true,setDefaultsOnInsert:true});
  res.status(201).json({success:true,data:{id:doc._id,source:doc.source,resourceId:doc.resourceId,name:doc.name,url:mediaUrl(resource.fileLink,req)}});
});
exports.submissions=handle(async(req,res)=>{
  const [live,writing,results]=await Promise.all([
    LiveTestSubmission.find({studentId:req.user._id}).populate('testId','title titleHi').sort({submittedAt:-1}).lean(),
    StudentAnswerSubmission.find({studentId:req.user._id}).populate('answerWritingId','name nameHi').sort({submittedAt:-1}).lean(),
    Result.find({student:req.user._id}).populate('test','title').sort({submittedAt:-1}).lean()
  ]);
  const data=[
    ...live.map(s=>({id:s._id,kind:'live-test',title:text(req,s.testId?.title,s.testId?.titleHi),status:s.status,score:null,submittedAt:s.submittedAt})),
    ...writing.map(s=>({id:s._id,kind:'answer-writing',title:text(req,s.answerWritingId?.name,s.answerWritingId?.nameHi),status:'submitted',score:null,submittedAt:s.submittedAt})),
    ...results.map(s=>({id:s._id,kind:'prelims',title:s.test?.title||'Prelims test',status:'submitted',score:s.score,totalMarks:s.totalMarks,submittedAt:s.submittedAt}))
  ].sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt));
  res.json({success:true,data});
});
exports.feedback=handle(async(req,res)=>{
  const doc=await Feedback.findOneAndUpdate({user:req.user._id},{$set:{enjoying:req.body.enjoying,platform:req.body.platform||'android'}},{new:true,upsert:true,setDefaultsOnInsert:true});
  res.json({success:true,message:'Thanks for rating the app.',data:{enjoying:doc.enjoying,platform:doc.platform}});
});
exports.report=handle(async(req,res)=>{
  const message=String(req.body.message||'').trim();
  if(message.length<10||message.length>5000)throw fail(400,'Describe the problem in 10 to 5000 characters.');
  const screenshot=req.file?{contentType:req.file.mimetype,data:req.file.buffer}:undefined;
  if(req.file&&!/^image\/(jpeg|png|webp|gif)$/.test(req.file.mimetype))throw fail(400,'Upload a JPEG, PNG, WebP or GIF screenshot.');
  const doc=await Report.create({user:req.user._id,message,screenshot});
  res.status(201).json({success:true,message:'Problem reported.',data:{id:doc._id,status:doc.status}});
});
exports.notifications=handle(async(req,res)=>{
  const filter={audience:{$in:visibleAudiences(req.user.type)}};
  await list(Notification,filter,req,res,{createdAt:-1},null,n=>({id:n._id,title:text(req,n.title,n.titleHindi),body:text(req,n.body,n.bodyHindi),type:n.type,link:n.link||null,isRead:Array.isArray(n.readBy)&&n.readBy.some(id=>String(id)===String(req.user._id)),createdAt:n.createdAt}));
});
exports.readNotification=handle(async(req,res)=>{
  const doc=await Notification.findOneAndUpdate({_id:req.params.id,audience:{$in:visibleAudiences(req.user.type)}},{$addToSet:{readBy:req.user._id}},{new:true});
  if(!doc)throw fail(404,'Notification not found.');
  res.json({success:true,data:{id:doc._id,isRead:true}});
});
exports.DELETE_REASONS=DELETE_REASONS;
