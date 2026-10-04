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
const {fail,handle,list,text,profile}=require('../utils/appApi');
const {getConfig}=require('./appCatalogController');

const DELETE_REASONS=['Something was broken','I am not getting any invites','I have a privacy concern','Other'];
const TXN={success:'completed',failed:'failed',pending:'pending'};
const uiStatus=status=>status==='completed'?'success':status;
const paymentDto=p=>({id:p._id,title:p.planName,amount:p.amount,currency:'INR',status:uiStatus(p.status),date:p.createdAt,transactionId:p.transactionId,plan:p.plan,programId:p.programId||null,batchId:p.batchId||null});

exports.profile=handle(async(req,res)=>res.json({success:true,data:{user:profile(req.user),version:(await getConfig()).version}}));
exports.updateProfile=handle(async(req,res)=>{
  const {fullName,phone,password,address,preferredLanguage,notificationsEnabled}=req.body;
  const $set={};
  if(fullName!=null)$set.fullName=String(fullName).trim();
  if(phone!=null)$set.phone=String(phone).trim();
  if(address&&typeof address==='object')$set.address={pincode:address.pincode||'',houseNo:address.houseNo||'',colony:address.colony||address.locality||'',city:address.city||''};
  if(preferredLanguage)$set.preferredLanguage=preferredLanguage;
  if(typeof notificationsEnabled==='boolean')$set.notificationsEnabled=notificationsEnabled;
  if(password)$set.password=await bcrypt.hash(password,10);
  if(!Object.keys($set).length)throw fail(400,'No profile fields to update.');
  const user=await User.findByIdAndUpdate(req.user._id,{$set},{new:true});
  res.json({success:true,message:'Profile updated.',data:{user:profile(user)}});
});
exports.preferences=handle(async(req,res)=>{
  const $set={};
  if(req.body.preferredLanguage)$set.preferredLanguage=req.body.preferredLanguage;
  if(typeof req.body.notificationsEnabled==='boolean')$set.notificationsEnabled=req.body.notificationsEnabled;
  if(!Object.keys($set).length)throw fail(400,'Send preferredLanguage or notificationsEnabled.');
  const user=await User.findByIdAndUpdate(req.user._id,{$set},{new:true});
  res.json({success:true,data:{user:profile(user)}});
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
  const resource=await Module.findOne({_id:req.body.resourceId,isActive:true,type:'file'}).lean();
  if(!resource)throw fail(404,'File not found.');
  const name=text(req,resource.name?.english,resource.name?.hindi);
  const doc=await Download.findOneAndUpdate({user:req.user._id,source,resourceId:resource._id},{$set:{name}},{new:true,upsert:true,setDefaultsOnInsert:true});
  res.status(201).json({success:true,data:{id:doc._id,source:doc.source,resourceId:doc.resourceId,name:doc.name,url:resource.fileLink||null}});
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
