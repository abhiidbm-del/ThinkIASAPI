const router=require('express').Router();
const multer=require('multer');
const {body,param,query,validationResult}=require('express-validator');
const catalog=require('../controllers/appCatalogController');
const account=require('../controllers/appAccountController');
const {auth,adminAuth}=require('../middleware/auth');
const {apiLimiter}=require('../middleware/rateLimiter');

const {profileImageUpload}=require('../config/r2');
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024}});
const imageUpload=(req,res,next)=>profileImageUpload(req,res,err=>{
  if(err)return res.status(400).json({success:false,message:err.code==='LIMIT_FILE_SIZE'?'Image must be 5 MB or smaller.':(err.message||'Upload a JPEG, PNG, WebP or GIF image.')});
  next();
});
const acceptProfileImage=(req,res,next)=>{
  const type=req.headers['content-type']||'';
  if(!type.includes('multipart/form-data'))return next();
  imageUpload(req,res,()=>{
    if(res.headersSent)return;
    if(typeof req.body.address==='string'){try{req.body.address=JSON.parse(req.body.address);}catch(_){}}
    if(req.body.notificationsEnabled==='true')req.body.notificationsEnabled=true;
    if(req.body.notificationsEnabled==='false')req.body.notificationsEnabled=false;
    next();
  });
};
const validate=rules=>[...rules,(req,res,next)=>{
  const errors=validationResult(req);
  if(!errors.isEmpty())return res.status(400).json({success:false,message:'Please check the entered details.',errors:errors.array().map(e=>({field:e.path,message:e.msg}))});
  next();
}];
const student=(req,res,next)=>{
  if(!req.user||req.user.role!=='student')return res.status(401).json({success:false,message:'Please log in as a student.'});
  next();
};
const mongoId=field=>param(field).isMongoId().withMessage('A valid id is required.');
const group=(value)=>(req,_res,next)=>{req.query.group=value;next();};

router.get('/config',catalog.config);
router.put('/config',auth,adminAuth,apiLimiter,validate([
  body('version').isString().trim().isLength({min:1,max:30}).withMessage('Enter a valid app version.'),
  body('phone').isString().trim().isLength({max:30}),
  body('email').isString().trim().isLength({max:254}).bail().custom(value=>!value||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)).withMessage('Enter a valid email address.'),
  body('whatsapp').isString().trim().isLength({max:30}),
  ...['androidUrl','iosUrl','shareUrl'].map(field=>body(field).isString().trim().isLength({max:2048}).bail().custom(value=>!value||/^https?:\/\/\S+$/i.test(value)).withMessage('Enter a valid http or https URL.')),
  body('banners').isArray({max:20}).withMessage('Add no more than 20 banners.'),
  body('banners.*').isString().trim().isLength({min:1,max:2048}).bail().custom(value=>/^https?:\/\/\S+$/i.test(value)).withMessage('Each banner must be a valid http or https URL.')
]),catalog.updateConfig);
router.get('/onboarding',catalog.onboarding);
router.get('/support',catalog.support);
router.get('/share',catalog.share);
router.get('/legal/:kind',validate([param('kind').isIn(['terms','privacy'])]),catalog.legal);
router.get('/faqs',catalog.faqs);
router.get('/programs/filters',catalog.filters);
router.get('/courses',group('mentorship'),catalog.programs);
router.get('/tests',group('test-series'),catalog.programs);
router.get('/programs',catalog.programs);
router.get('/programs/:id/batches/:batchId/brochure',validate([mongoId('id'),mongoId('batchId')]),catalog.brochure);
router.get('/programs/:id/batches',validate([mongoId('id')]),catalog.batches);
router.get('/programs/:id',validate([mongoId('id')]),catalog.program);
router.get('/plans',catalog.plans);
router.get('/news',catalog.news);
router.get('/videos',catalog.videos);
router.get('/testimonials',catalog.testimonials);

router.use(auth,student,apiLimiter);
router.get('/dashboard',catalog.dashboard);
router.get('/profile',account.profile);
router.post('/profile/image',imageUpload,account.updateProfileImage);
router.delete('/profile/image',account.deleteProfileImage);
router.patch('/profile',acceptProfileImage,validate([
  body('fullName').optional({values:'falsy'}).isString().bail().trim().isLength({min:2,max:100}),
  body('name').optional({values:'falsy'}).isString().bail().trim().isLength({min:2,max:100}),
  body('phone').optional({values:'falsy'}).isString().bail().trim().matches(/^\+?[0-9]{10,15}$/).withMessage('Enter a valid mobile number.'),
  body('mobileNo').optional({values:'falsy'}).isString().bail().trim().matches(/^\+?[0-9]{10,15}$/).withMessage('Enter a valid mobile number.'),
  body('email').optional({values:'falsy'}).isEmail().withMessage('Enter a valid email address.'),
  body('password').optional({values:'falsy'}).isString().bail().isLength({min:6}).withMessage('Password must have at least 6 characters.'),
  body('confirmPassword').optional({values:'falsy'}).isString(),
  body('preferredLanguage').optional({values:'falsy'}).isIn(['en','hi']),
  body('notificationsEnabled').optional().isBoolean(),
  body('address').optional().isObject(),
  body('pincode').optional().isString(),
  body('houseNo').optional().isString(),
  body('locality').optional().isString(),
  body('colony').optional().isString(),
  body('city').optional().isString()
]),account.updateProfile);
router.patch('/profile/picture',upload.fields([{name:'profileImage',maxCount:1},{name:'profilePic',maxCount:1}]),account.updateProfilePicture);
router.patch('/preferences',validate([
  body('preferredLanguage').optional().isIn(['en','hi']),
  body('notificationsEnabled').optional().isBoolean()
]),account.preferences);
router.post('/account/delete',validate([
  body('reason').isIn(account.DELETE_REASONS).withMessage('Select a valid deletion reason.'),
  body('note').optional().isString().bail().trim().isLength({max:500})
]),account.deleteAccount);
router.get('/transactions',validate([query('status').optional().isIn(['success','failed','pending'])]),account.transactions);
router.get('/orders',account.orders);
router.get('/downloads',account.downloads);
router.post('/downloads',validate([
  body('resourceId').isMongoId(),
  body('source').optional().isIn(['free','pre','mains','modules'])
]),account.saveDownload);
router.get('/submissions',account.submissions);
router.post('/feedback',validate([
  body('enjoying').isBoolean(),
  body('platform').optional().isIn(['android','ios'])
]),account.feedback);
router.post('/reports',upload.single('screenshot'),account.report);
router.get('/resources',catalog.resources);
router.get('/resources/:id',validate([mongoId('id')]),catalog.resource);
router.get('/notifications',account.notifications);
router.patch('/notifications/:id/read',validate([mongoId('id')]),account.readNotification);

module.exports=router;
