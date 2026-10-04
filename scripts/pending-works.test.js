const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const mongoose = require('mongoose');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');
const Program = require('../models/Program');
const { applyPaymentAccess } = require('../utils/paymentEnrollment');
const { inactiveAccount } = require('../utils/accountStatus');
function load(file, dependencies) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    module, exports: module.exports, console, process, Buffer,
    require: name => name in dependencies ? dependencies[name] : require(require.resolve(name, { paths: [path.dirname(path.join(__dirname, '..', file))] }))
  });
  return module.exports;
}
function response() { return { code: 200, body: null, status(code) {this.code=code;return this;}, json(body) {this.body=body;return this;} }; }
test('new plan creation generates independent IDs without selecting an existing plan', async () => {
  const controller=load('controllers/planController.js',{'../models/Plan':{create:async input=>{const p=new Plan(input);await p.validate();return p;}}});
  const body={name:'New course',accessType:'combo',baseAmount:100,totalAmount:99};
  const a=response(),b=response();await controller.createPlan({body},a);await controller.createPlan({body},b);
  assert.equal(a.code,201);assert.match(a.body.data.id,/^new-course-/);assert.notEqual(a.body.data.id,b.body.data.id);assert.equal(a.body.data.accessType,'combo');
});
test('active ownership includes earlier purchases and allows expired renewals', async () => {
  const {collectActivePlanIds}=require('../utils/activePlanPurchases');const now=new Date('2026-09-12');
  const payments=[{plan:'pre-2027',status:'completed'},{plan:'failed-plan',status:'failed'}];
  assert.deepEqual(collectActivePlanIds({purchasedPlanId:'mains-2027'},payments,now),['pre-2027','mains-2027']);
  assert.deepEqual(collectActivePlanIds({purchasedPlanId:'mains-2027',planExpiryAt:'2026-09-01'},payments,now),[]);
  assert.deepEqual(collectActivePlanIds({type:'combo'},[],now),['combo']);
});
test('paid and free endpoints reject owned active plans before creating a payment', async () => {
  let gatewayCalls=0;
  const ownership=load('utils/activePlanPurchases.js',{'../models/Payment':{find:()=>({select:()=>({lean:async()=>[{plan:'custom-plan',status:'completed'}]})})}});
  const controller=load('controllers/paymentController.js',{'razorpay':class{orders={create:async()=>{gatewayCalls++;}}},'../utils/activePlanPurchases':ownership,'../utils/planPricing':{calculateServerPrice:async()=>({plan:{id:'custom-plan'},amount:99})}});
  for(const method of ['createRazorpayOrder','activateFreePlan']){const res=response();await controller[method]({body:{planId:'custom-plan'},user:{_id:'student'}},res);assert.equal(res.code,409);assert.match(res.body.message,/already have this active plan/);}
  assert.equal(gatewayCalls,0);
});
test('enrollment filters active programs and batches by inclusive end date', async () => {
  const {availableEnrollment}=require('../utils/availableEnrollment');
  const filter=availableEnrollment(new Date('2026-09-12T12:00:00Z'));assert.equal(filter.isActive,true);assert.equal(filter.endDate.$gte.toISOString(),'2026-09-12T00:00:00.000Z');
  const filters=[];
  const enrollment=load('utils/paymentEnrollment.js',{'../models/Program':{findOne:async f=>{filters.push(f);return {_id:'program'};}},'../models/Batch':{findOne:async f=>{filters.push(f);return {_id:'batch'};}}});
  await enrollment.validateEnrollment({programId:'program',batchId:'batch'});
  assert(filters.every(f=>f.isActive===true && f.endDate.$gte instanceof Date));assert.equal(filters[1].programId,'program');
});
test('submitted PDF is signed for owner/admin only and uses the original stored file key', async () => {
  let signed=0,input;
  const controller=load('controllers/submissionFileController.js',{'../models/LiveTestSubmission':{findById:()=>({lean:async()=>({studentId:'owner',answerPDFKey:'answers/original.pdf',originalName:'My answers.pdf'})})},'../config/r2':{s3Client:{}},'@aws-sdk/client-s3':{GetObjectCommand:class{constructor(value){input=value;}}},'@aws-sdk/s3-request-presigner':{getSignedUrl:async()=>{signed++;return 'https://example.com/signed.pdf';}}});
  const forbidden=response();await controller.getSubmissionFile({params:{submissionId:'s'},user:{_id:'other',role:'student'}},forbidden);assert.equal(forbidden.code,403);assert.equal(signed,0);
  for(const user of [{_id:'owner',role:'student'},{_id:'admin',role:'admin'}]){const res=response();res.set=()=>res;await controller.getSubmissionFile({params:{submissionId:'s'},user},res);assert.equal(res.code,200);assert.equal(res.body.filename,'My answers.pdf');assert.equal(input.Key,'answers/original.pdf');}
  assert.equal(signed,2);
});
test('admin live tests include per-test submission totals including zero', async () => {
  const tests=['one','two'].map(_id=>({_id,toObject(){return {_id};}}));
  const query={sort(){return this;},skip(){return this;},limit:async()=>tests};
  const controller=load('controllers/liveTestController.js',{'../models/LiveTest':{find:()=>query,countDocuments:async()=>2},'../models/LiveTestSubmission':{aggregate:async()=>[{_id:'one',count:3}]},'../config/r2':{},'../services/firebaseNotificationService':{}});
  const res=response();await controller.getAllLiveTests({query:{}},res);assert.equal(res.code,200);assert.equal(res.body.data[0].submissionCount,3);assert.equal(res.body.data[1].submissionCount,0);
});
test('inactive student receives the exact popup response and no token; active legacy accounts can log in', async () => {
  let user = { _id:'student',role:'student',type:'pre',isActive:false,comparePassword:async()=>true,toJSON(){return this;} };
  let issued=0;
  const auth=load('controllers/authController.js', {
    '../models/User': {findOne:async()=>user}, '../services/emailService': {},
    '../utils/helpers': {generateToken:()=>{issued++;return 'token';},getMenuItems:()=>[]}
  });
  const denied=response();await auth.login({body:{email:'student@example.com',password:'secret'}},denied);
  assert.equal(denied.code,403);assert.deepEqual(denied.body,inactiveAccount);assert.equal(issued,0);
  delete user.isActive;
  const allowed=response();await auth.login({body:{email:'student@example.com',password:'secret'}},allowed);
  assert.equal(allowed.code,200);assert.equal(allowed.body.token,'token');assert.equal(issued,1);
});
test('deactivation revokes access through an existing valid token', async () => {
  const auth=load('middleware/auth.js', {'jsonwebtoken':{verify:()=>({userId:'student'})},'../models/User':{findById:()=>({select:async()=>({isActive:false})})}}).auth;
  const res=response();let called=false;await auth({header:()=> 'Bearer valid'},res,()=>called=true);
  assert.equal(res.code,403);assert.equal(res.body.code,'ACCOUNT_INACTIVE');assert.equal(called,false);
});
test('custom plans retain a separate validated access type in the payment snapshot', async () => {
  const plan=new Plan({id:'mains-2027',accessType:'mains',name:'Mains 2027',baseAmount:999,totalAmount:999});await plan.validate();
  const payment=new Payment({user:new mongoose.Types.ObjectId(),plan:plan.id,accessType:plan.accessType,planName:plan.name,amount:999,paymentMethod:'razorpay'});await payment.validate();
  const student={type:'pre'};applyPaymentAccess(student,payment);
  assert.equal(student.type,'combo');assert.equal(student.purchasedPlanId,'mains-2027');
  await assert.rejects(new Plan({id:'bad',accessType:'admin',name:'Bad',baseAmount:0,totalAmount:0}).validate());
});
test('enrollment rejects another program batch and incomplete selections', async () => {
  const enrollment=load('utils/paymentEnrollment.js', {'../models/Program':{findOne:async()=>({_id:'program'})},'../models/Batch':{findOne:async()=>null}});
  await assert.rejects(enrollment.validateEnrollment({programId:'program'}),/program and its batch/);
  await assert.rejects(enrollment.validateEnrollment({programId:'program',batchId:'wrong'}),/unavailable/);
  assert.equal(Object.keys(await enrollment.validateEnrollment({})).length,0);
});
test('zero-price programs can be created while reversed dates and invalid discount fail', async () => {
  const values={programName:'Free course',programCategory:'Prelims Program',year:'2027',price:0,displayImage:'https://example.com/image.png',startDate:'2027-01-01',endDate:'2027-02-01'};
  const controller=load('controllers/programController.js',{'../models/Program':{create:async body=>{const p=new Program(body);await p.validate();return p;}}});
  const res=response();await controller.createProgram({body:values},res);assert.equal(res.code,201);assert.equal(res.body.data.price,0);
  await assert.rejects(new Program({...values,endDate:'2026-01-01'}).validate(),/End date/);
  await assert.rejects(new Program({...values,discountedPrice:1}).validate(),/Discounted price/);
});
test('submission listing returns populated tests, students and stored answer PDFs', async () => {
  const populated=[];const data=[{answerPDF:'https://example.com/answer.pdf'}];let filter;
  const query={populate(field){populated.push(field);return this;},sort(){return this;},lean:async()=>data};
  const controller=load('controllers/liveTestController.js',{'../models/LiveTestSubmission':{find(value){filter=value;return query;}},'../config/r2':{},'../services/firebaseNotificationService':{}});
  const res=response();await controller.getSubmissions({params:{}},res);
  assert.equal(Object.keys(filter).length,0);assert.deepEqual(populated,['studentId','testId']);assert.equal(res.body.data[0].answerPDF,data[0].answerPDF);
});
test('coupon preview uses stored custom-plan price, discount cap and authenticated-user limits', async () => {
  const coupon={code:'SAVE',validFrom:new Date('2020-01-01'),validUntil:new Date('2099-01-01'),maxUses:null,usedCount:0,applicablePlans:['mains-2027'],minPurchaseAmount:0,usedBy:[],perUserLimit:1,discountType:'percentage',discountValue:50,maxDiscountAmount:100};
  const pricing=load('utils/planPricing.js',{'../models/Plan':{findOne:()=>({lean:async()=>({id:'mains-2027',totalAmount:999})})},'../models/Coupon':{findOne:async()=>coupon}});
  const controller=load('controllers/couponController.js',{'../utils/planPricing':pricing});
  const res=response();await controller.validateCoupon({body:{code:'SAVE',planId:'mains-2027',amount:1,userId:'other'},user:{_id:'student'}},res);
  assert.equal(res.body.coupon.discountAmount,100);
  coupon.usedBy.push({user:'student'});
  const denied=response();await controller.validateCoupon({body:{code:'SAVE',planId:'mains-2027',userId:'other'},user:{_id:'student'}},denied);
  assert.equal(denied.code,400);assert.match(denied.body.message,/usage limit/);
});
test('zero-price custom plans activate without gateway or coupon and retain existing access', async () => {
  let savedPayment, savedUser=false;
  const student={type:'pre',save:async()=>{savedUser=true;}};
  class MockPayment {constructor(body){Object.assign(this,body);this._id='payment';}async save(){savedPayment=this;}}
  const controller=load('controllers/paymentController.js',{'razorpay':class {},'../models/User':{findById:async()=>student},'../models/Payment':MockPayment,'../utils/activePlanPurchases':{assertPlanNotOwned:async()=>{}},'../utils/planPricing':{calculateServerPrice:async()=>({plan:{id:'free-mains',accessType:'mains',name:'Free Mains',totalAmount:0},coupon:null,amount:0})}});
  const res=response();await controller.activateFreePlan({body:{planId:'free-mains'},user:{_id:'student'}},res);
  assert.equal(res.code,200);assert.equal(res.body.success,true);assert.equal(savedPayment.accessType,'mains');assert.equal(student.type,'combo');assert.equal(savedUser,true);
});
