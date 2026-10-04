const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const express=require('express');
const jwt=require('jsonwebtoken');
const RealUser=require('../models/User');
function load(file,deps){const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{module,exports:module.exports,console,process,Buffer,Date,URL,Promise,Object,Array,String,Number,Boolean,JSON,Math,Error,require:name=>name in deps?deps[name]:require(require.resolve(name,{paths:[path.dirname(path.join(__dirname,'..',file))]}) )});return module.exports;}
function match(row,filter){return Object.entries(filter||{}).every(([key,value])=>{
  if(key==='$or')return value.some(part=>match(row,part));
  if(value&&typeof value==='object'&&!(value instanceof Date)&&!Array.isArray(value)){
    if('$in' in value)return value.$in.includes(row[key])||(Array.isArray(row[key])&&row[key].some(v=>value.$in.includes(v)));
    if('$ne' in value)return String(row[key])!==String(value.$ne);
    if('$gte' in value)return new Date(row[key])>=value.$gte;
    if('$gt' in value)return row[key]>value.$gt;
    if('$lt' in value)return (row[key]||0)<value.$lt;
    if('$exists' in value)return (row[key]!==undefined)===value.$exists;
    if('$regex' in value)return new RegExp(value.$regex,value.$options||'').test(row[key]||'');
  }
  if(Array.isArray(row[key])&&!Array.isArray(value))return row[key].map(String).includes(String(value));
  return value instanceof Date?new Date(row[key]).getTime()===value.getTime():String(row[key])===String(value);
});}
function chain(rows){const q={sort(){return q;},skip(){return q;},limit(){return q;},select(){return q;},populate(){return q;},lean:async()=>rows,then:(onF,onR)=>Promise.resolve(rows).then(onF,onR)};return q;}
function one(row){const q={select(){return q;},populate(){return q;},lean:async()=>row,then:(onF,onR)=>Promise.resolve(row).then(onF,onR)};return q;}
function model(rows,opts={}){return {
  rows,
  find:filter=>chain(rows.filter(r=>match(r,filter))),
  findOne:filter=>one(rows.find(r=>match(r,filter))||null),
  countDocuments:async filter=>rows.filter(r=>match(r,filter)).length,
  distinct:async field=>[...new Set(rows.map(r=>r[field]).filter(v=>v!=null))],
  create:async input=>{const row={_id:'created-'+rows.length,...input,createdAt:new Date(),status:input.status||'open'};rows.push(row);return row;},
  findOneAndUpdate:async(filter,update,options)=>{let row=rows.find(r=>match(r,filter));if(!row&&options?.upsert){row={_id:'up-'+rows.length,...filter,...(update.$set||{})};rows.push(row);}if(!row)return null;Object.assign(row,update.$set||{});if(update.$addToSet){for(const [k,v] of Object.entries(update.$addToSet)){row[k]=row[k]||[];if(!row[k].map(String).includes(String(v)))row[k].push(v);}}return row;},
  updateOne:async(filter,update)=>{const row=rows.find(r=>match(r,filter));if(row)Object.assign(row,update.$set||{});},
  findByIdAndUpdate:async(id,update)=>{const row=rows.find(r=>String(r._id)===String(id));if(row)Object.assign(row,update.$set||{});return row;},
  aggregate:opts.aggregate,
  deleteMany:async filter=>{for(let i=rows.length-1;i>=0;i--)if(match(rows[i],filter))rows.splice(i,1);}
};}
test('app catalog and account APIs match ThinkIAS-APP-UI screens',async t=>{
  const now=new Date();
  const later=new Date(now.getTime()+86400000*60);
  const programId='64a000000000000000000001';
  const batchId='64a000000000000000000002';
  const resourceId='64a000000000000000000003';
  const noteId='64a000000000000000000004';
  const programs=[{_id:programId,programName:'Praartak Program',programNameHindi:'प्रारंभ',programCategory:'Mentorship Course',year:'2026',price:29000,discountedPrice:25000,displayImage:'https://example.com/p.png',description:'Course details',overview:'Overview',features:['Unlimited papers'],medium:'Bilingual',startDate:now,endDate:later,duration:'24 days',isActive:true,order:1,createdAt:now}];
  const batches=[{_id:batchId,programId,batchName:'Morning Batch',batchNameHindi:'सुबह',isActive:true,endDate:later,startDate:now,brochureEnglish:'https://example.com/en.pdf',brochureHindi:'https://example.com/hi.pdf',order:1}];
  const modules=[{_id:resourceId,name:{english:'Class-11-History',hindi:'कक्षा-11'},type:'file',isActive:true,parent:null,fileLink:'https://example.com/file.pdf',fileType:'pdf',order:1}];
  const payments=[];
  const downloads=[];
  const reports=[];
  const feedback=[];
  const notifications=[{_id:noteId,title:'New Updates',titleHindi:'अपडेट',body:'Exam update',bodyHindi:'',type:'news',audience:'all',link:'',readBy:[],createdAt:now}];
  const users=[];
  const sessions={rows:[],async create(input){sessions.rows.push(input);return input;},async findOne(filter){return sessions.rows.find(r=>String(r._id)===String(filter._id)&&String(r.user)===String(filter.user)&&(!filter.expiresAt||r.expiresAt>filter.expiresAt.$gt))||null;},async deleteMany(filter){sessions.rows=sessions.rows.filter(r=>String(r.user)!==String(filter.user));},async deleteOne(filter){sessions.rows=sessions.rows.filter(r=>String(r._id)!==String(filter._id));}};
  const challenges={rows:[],async create(input){const row={attempts:0,createdAt:new Date(),updatedAt:new Date(),...input};challenges.rows.push(row);return row;},async findOne(filter){return challenges.rows.find(r=>match(r,filter))||null;},async findOneAndUpdate(filter,update){const row=await challenges.findOne(filter);if(!row)return null;Object.assign(row,update.$set||{});if(update.$inc)for(const[k,v]of Object.entries(update.$inc))row[k]=(row[k]||0)+v;row.updatedAt=new Date();return row;}};
  function queryMatch(row,filter){return Object.entries(filter||{}).every(([k,v])=>String(row[k])===String(v));}
  const User={
    exists:async filter=>users.some(u=>queryMatch(u,filter)),
    findOne:async filter=>users.find(u=>queryMatch(u,filter))||null,
    findById:id=>({select:async()=>users.find(u=>String(u._id)===String(id))||null}),
    findByIdAndUpdate:async(id,update)=>{const doc=users.find(u=>String(u._id)===String(id));Object.assign(doc,update.$set||{});return doc;},
    updateOne:async(filter,update)=>{const doc=users.find(u=>String(u._id)===String(filter._id));Object.assign(doc,update.$set||{});},
    async create(input){const doc=new RealUser(input);await doc.validate();await new Promise((resolve,reject)=>RealUser.schema.s.hooks.execPre('save',doc,[],e=>e?reject(e):resolve()));users.push(doc);return doc;}
  };
  const Program=model(programs,{aggregate:async pipeline=>{const skip=pipeline[2].$facet.data[0].$skip;const limit=pipeline[2].$facet.data[1].$limit;return [{data:programs.slice(skip,skip+limit),total:[{count:programs.length}]}];}});
  const Batch=model(batches);
  const Module=model(modules);
  const authDeps={'../models/User':User,'../models/AppAuthChallenge':challenges,'../models/AppAuthSession':sessions};
  const catalogDeps={
    '../models/Program':Program,'../models/Batch':Batch,'../models/Plan':model([]),'../models/ProgramFaq':model([]),
    '../models/AppContent':{findById:id=>one((id==='config'?{data:{version:'1.0.1',phone:'+919876543210',email:'contact@thinkias.com',whatsapp:'919876543210',shareUrl:'https://thinkcivilias.com',banners:[]}}:id==='onboarding'?{data:[{title:'Welcome'}]}:id==='terms'?{data:{title:'Terms & Conditions',body:'Rules',url:null,published:true}}:id==='faqs'?{data:[{id:'1',question:'Q1',answer:'A1'}]}:null))},
    '../models/SimpleNews':model([]),'../models/LiveContent':model([]),'../models/Testimonial':model([]),'../models/Notification':model(notifications),'../models/Module':Module
  };
  const accountDeps={
    '../models/User':User,'../models/Payment':model(payments),'../models/AppDownload':model(downloads),'../models/AppFeedback':model(feedback),
    '../models/AppReport':model(reports),'../models/Module':Module,'../models/Notification':model(notifications),
    '../models/LiveTestSubmission':model([]),'../models/StudentAnswerSubmission':model([]),'../models/Result':model([]),'../models/AppAuthSession':sessions,
    './appCatalogController':null
  };
  const catalog=load('controllers/appCatalogController.js',catalogDeps);
  accountDeps['./appCatalogController']=catalog;
  const account=load('controllers/appAccountController.js',accountDeps);
  const middleware=load('middleware/auth.js',authDeps);
  const authRouter=load('routes/appAuth.js',{'../controllers/appAuthController':load('controllers/appAuthController.js',authDeps),'../middleware/auth':middleware,'../middleware/rateLimiter':{authLimiter:(_r,_s,n)=>n()}});
  const appRouter=load('routes/app.js',{'../controllers/appCatalogController':catalog,'../controllers/appAccountController':account,'../middleware/auth':middleware,'../middleware/rateLimiter':{apiLimiter:(_r,_s,n)=>n()}});
  const app=express();app.use(express.json());app.use('/api/app/auth',authRouter);app.use('/api/app',appRouter);
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
  const base=`http://127.0.0.1:${server.address().port}`;
  async function request(path,opts={}){const r=await fetch(base+path,{method:opts.method||(opts.body?'POST':'GET'),headers:{'Content-Type':'application/json',...(opts.token?{Authorization:'Bearer '+opts.token}:{})},body:opts.body?JSON.stringify(opts.body):undefined});const json=await r.json();assert.equal(r.status,opts.status||200,path+' '+JSON.stringify(json));return json;}
  const onboarding=await request('/api/app/onboarding');assert.equal(onboarding.data[0].title,'Welcome');
  const support=await request('/api/app/support');assert.equal(support.data.version,'1.0.1');assert.equal(support.data.phone,'+919876543210');
  const terms=await request('/api/app/legal/terms');assert.equal(terms.data.title,'Terms & Conditions');
  const faqs=await request('/api/app/faqs');assert.equal(faqs.data[0].question,'Q1');
  const listed=await request('/api/app/programs?group=mentorship');assert.equal(listed.data[0].title,'Praartak Program');assert.equal(listed.data[0].price.selling,25000);assert.equal(listed.data[0].price.onSale,true);
  const hindi=await request('/api/app/programs?lang=hi');assert.equal(hindi.data[0].title,'प्रारंभ');
  const detail=await request('/api/app/programs/'+programId);assert.ok(detail.data.overview);
  const batch=await request(`/api/app/programs/${programId}/batches`);assert.equal(batch.data[0].title,'Morning Batch');
  const brochure=await request(`/api/app/programs/${programId}/batches/${batchId}/brochure`);assert.match(brochure.data.url,/example.com\/en.pdf/);
  await request('/api/app/dashboard',{status:401});
  const email='app.ui@example.com',password='Student123!';
  const otp=await request('/api/app/auth/send-otp',{body:{email}});
  const verified=await request('/api/app/auth/verify-email',{body:{email,challengeId:otp.data.challengeId,otp:'1234'}});
  const registered=await request('/api/app/auth/register',{status:201,body:{email,fullName:'Yamini',phone:'9415778282',password,confirmPassword:password,verificationToken:verified.data.verificationToken}});
  const token=registered.data.token;
  const home=await request('/api/app/dashboard',{token});assert.equal(home.data.user.fullName,'Yamini');assert.equal(home.data.unreadNotifications,1);
  const profile=await request('/api/app/profile',{token});assert.equal(profile.data.version,'1.0.1');
  await request('/api/app/profile',{method:'PATCH',token,body:{fullName:'Abhishek',address:{pincode:'226014',houseNo:'12',colony:'Your Colony',city:'Lucknow'}}});
  assert.equal(users[0].address.city,'Lucknow');
  const resources=await request('/api/app/resources',{token});assert.equal(resources.data[0].type,'file');
  await request('/api/app/downloads',{method:'POST',status:201,token,body:{resourceId}});
  const tx=await request('/api/app/transactions?status=pending',{token});assert.equal(tx.data.length,0);
  await request('/api/app/feedback',{token,body:{enjoying:true,platform:'android'}});
  await request('/api/app/reports',{method:'POST',status:201,token,body:{message:'Something was broken on checkout'}});
  const notes=await request('/api/app/notifications',{token});assert.equal(notes.data[0].isRead,false);
  await request('/api/app/notifications/'+noteId+'/read',{method:'PATCH',token});
  const websiteJwt=jwt.sign({userId:String(users[0]._id)},require('../config/constants').JWT.SECRET);
  await request('/api/app/dashboard',{token:websiteJwt,status:401});
  await request('/api/app/account/delete',{token,body:{reason:'I have a privacy concern'}});
  await request('/api/app/dashboard',{token,status:401});
  assert.equal(users[0].isActive,false);
});
