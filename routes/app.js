const router=require('express').Router();
const multer=require('multer');
const {body,param,query,validationResult}=require('express-validator');
const catalog=require('../controllers/appCatalogController');
const account=require('../controllers/appAccountController');
const {auth}=require('../middleware/auth');
const {apiLimiter}=require('../middleware/rateLimiter');

const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024}});
const validate=rules=>[...rules,(req,res,next)=>{
  const errors=validationResult(req);
  if(!errors.isEmpty())return res.status(400).json({success:false,message:'Please check the entered details.',errors:errors.array().map(e=>({field:e.path,message:e.msg}))});
  next();
}];
const student=(req,res,next)=>{
  if(!req.appSession||req.user.role!=='student')return res.status(401).json({success:false,message:'Please log in through the app.'});
  next();
};
const mongoId=field=>param(field).isMongoId().withMessage('A valid id is required.');
const group=(value)=>(req,_res,next)=>{req.query.group=value;next();};

router.get('/config',catalog.config);
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
router.patch('/profile',validate([
  body('fullName').optional().isString().bail().trim().isLength({min:2,max:100}),
  body('phone').optional().isString().bail().trim().matches(/^\+?[0-9]{10,15}$/).withMessage('Enter a valid mobile number.'),
  body('password').optional().isString().bail().isLength({min:6}).withMessage('Password must have at least 6 characters.'),
  body('confirmPassword').if(body('password').exists()).isString().bail().custom((value,{req})=>value===req.body.password).withMessage('Passwords do not match.'),
  body('preferredLanguage').optional().isIn(['en','hi']),
  body('notificationsEnabled').optional().isBoolean(),
  body('address').optional().isObject()
]),account.updateProfile);
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
