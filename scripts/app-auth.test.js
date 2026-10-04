const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const express=require('express');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const RealUser=require('../models/User');
function load(file,deps){const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{module,exports:module.exports,console,process,Buffer,Date,require:name=>name in deps?deps[name]:require(require.resolve(name,{paths:[path.dirname(path.join(__dirname,'..',file))]}))});return module.exports;}
function match(row,filter){return Object.entries(filter).every(([key,value])=>{
 if(value && typeof value==='object' && Object.keys(value).some(k=>k.startsWith('$')))return Object.entries(value).every(([op,v])=>op==='$gt'?row[key]>v:op==='$lt'?row[key]<v:op==='$exists'?(row[key]!==undefined)===v:false);
 return value instanceof Date?new Date(row[key]).getTime()===value.getTime():String(row[key])===String(value);
});}
function store(){const rows=[];return {rows,async create(input){const row={attempts:0,createdAt:new Date(),updatedAt:new Date(),...input};rows.push(row);return row;},async findOne(filter){return rows.find(r=>match(r,filter))||null;},async findOneAndUpdate(filter,update){const row=rows.find(r=>match(r,filter));if(!row)return null;Object.assign(row,update.$set);for(const [k,v] of Object.entries(update.$inc||{}))row[k]=(row[k]||0)+v;row.updatedAt=new Date();return row;},async deleteMany(filter){for(let i=rows.length-1;i>=0;i--)if(match(rows[i],filter))rows.splice(i,1);},async deleteOne(filter){const i=rows.findIndex(r=>match(r,filter));if(i>=0)rows.splice(i,1);}};}
test('app auth HTTP flow: email-first signup, fixed OTP, password reset and revocable logout',async t=>{
 const challenges=store(),sessions=store(),users=[];
 const User={
  exists:async filter=>users.some(u=>match(u,filter)),
  findOne:async filter=>users.find(u=>match(u,filter))||null,
  findById:id=>({select:async()=>users.find(u=>String(u._id)===String(id))||null}),
  async create(input){const doc=new RealUser(input);await doc.validate();await new Promise((resolve,reject)=>RealUser.schema.s.hooks.execPre('save',doc,[],e=>e?reject(e):resolve()));users.push(doc);return doc;},
  async updateOne(filter,update){const doc=users.find(u=>match(u,filter));Object.assign(doc,update.$set);for(const[k,v]of Object.entries(update.$inc||{}))doc[k]=(doc[k]||0)+v;}
 };
 const deps={'../models/User':User,'../models/AppAuthChallenge':challenges,'../models/AppAuthSession':sessions};
 const controller=load('controllers/appAuthController.js',deps);
 const middleware=load('middleware/auth.js',deps);
 const router=load('routes/appAuth.js',{'../controllers/appAuthController':controller,'../middleware/auth':middleware,'../middleware/rateLimiter':{authLimiter:(_req,_res,next)=>next()}});
 const app=express();app.use(express.json());app.use('/api/app/auth',router);app.get('/protected-resource',middleware.auth,(req,res)=>res.json({ok:true}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const base=`http://127.0.0.1:${server.address().port}`;
 async function request(endpoint,body,token,expected=200){const r=await fetch(base+(endpoint==='/protected-resource'?endpoint:'/api/app/auth'+endpoint),{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await r.json();assert.equal(r.status,expected,JSON.stringify(value));return value;}
 const email='app+test@example.education',password='Start123!';
 await request('/me',undefined,'not-a-valid-token',401);
 const expiredJwt=jwt.sign({userId:'000000000000000000000000'},require('../config/constants').JWT.SECRET,{expiresIn:-1});await request('/me',undefined,expiredJwt,401);
 await request('/send-otp',{email:'bad'},null,400);
 const issued=await request('/send-otp',{email:' APP+TEST@EXAMPLE.EDUCATION '});assert.equal(issued.data.email,email);assert.equal(issued.data.otpLength,4);assert.equal(issued.data.testMode,true);
 const otpBody={email,challengeId:issued.data.challengeId,otp:'1234'};
 await request('/resend-otp',{email,challengeId:otpBody.challengeId},null,429);
 challenges.rows[0].updatedAt=new Date(Date.now()-121000);await request('/resend-otp',{email,challengeId:otpBody.challengeId});
 await request('/verify-email',{...otpBody,otp:'9999'},null,400);
 const verified=await request('/verify-email',otpBody);assert(verified.data.verificationToken);
 await request('/verify-email',otpBody,null,400);
 const registration={email,fullName:'App Student',phone:'9876543210',password,confirmPassword:password,verificationToken:verified.data.verificationToken,role:'admin',type:'combo'};
 await request('/register',{...registration,confirmPassword:'wrong'},null,400);
 const registered=await request('/register',registration,null,201);let token=registered.data.token;
 assert.equal(registered.data.user.role,'student');assert.equal(registered.data.user.type,'fresh');assert.equal(registered.data.user.emailVerified,true);assert.equal(registered.data.user.password,undefined);assert(await bcrypt.compare(password,users[0].password));
 await request('/me',undefined,token);await request('/protected-resource',undefined,token);
 await request('/register',registration,null,409);await request('/send-otp',{email},null,409);
 await request('/logout',{},token);await request('/me',undefined,token,401);await request('/protected-resource',undefined,token,401);
 await request('/login',{email,password:'wrong'},null,401);
 token=(await request('/login',{email,password})).data.token;
 const reset=await request('/forgot-password',{email});
 await request('/verify-email',{email,challengeId:reset.data.challengeId,otp:'1234'},null,400);
 const resetToken=(await request('/verify-reset-otp',{email,challengeId:reset.data.challengeId,otp:'1234'})).data.resetToken;
 const resetBody={email,resetToken,password:'Changed123!',confirmPassword:'Changed123!'};
 await request('/reset-password',{...resetBody,email:'other@example.com'},null,404);
 await request('/reset-password',resetBody);await request('/reset-password',resetBody,null,400);
 await request('/me',undefined,token,401);await request('/login',{email,password},null,401);
 token=(await request('/login',{email,password:resetBody.password})).data.token;
 users[0].isActive=false;await request('/me',undefined,token,403);await request('/login',{email,password:resetBody.password},null,403);users[0].isActive=true;
 // Expiry is enforced by the application, independent of Mongo TTL cleanup.
 sessions.rows[0].expiresAt=new Date(0);await request('/me',undefined,token,401);
 const lock=await request('/send-otp',{email:'lock@example.com'});for(let i=0;i<5;i++)await request('/verify-email',{email:'lock@example.com',challengeId:lock.data.challengeId,otp:'0000'},null,i===4?429:400);
 await request('/verify-email',{email:'lock@example.com',challengeId:lock.data.challengeId,otp:'1234'},null,400);
 const expired=await request('/send-otp',{email:'expired@example.com'});challenges.rows.find(c=>c._id===expired.data.challengeId).expiresAt=new Date(0);await request('/verify-email',{email:'expired@example.com',challengeId:expired.data.challengeId,otp:'1234'},null,400);
 const noSession=jwt.sign({userId:String(users[0]._id)},require('../config/constants').JWT.SECRET);await request('/me',undefined,noSession,401);
 assert.equal(users.length,1);
 // Execute the delivered Postman requests and scripts against the same isolated API.
 const collection=JSON.parse(fs.readFileSync(path.join(__dirname,'../postman/ThinkIAS-App-Auth.postman_collection.json'),'utf8'));
 const variables=new Map(collection.variable.map(v=>[v.key,v.value]));variables.set('baseUrl',base);
 const expand=value=>value.replace(/\{\{([^}]+)\}\}/g,(_m,key)=>variables.get(key)||'');
 for(const item of collection.item){
  const pm={environment:{get:()=>undefined},collectionVariables:{set:(key,value)=>variables.set(key,value)},test:(name,fn)=>fn(),expect:value=>({to:{be:{oneOf:values=>assert(values.includes(value),item.name)}}})};
  for(const event of item.event.filter(e=>e.listen==='prerequest'))vm.runInNewContext(event.script.exec.join('\n'),{pm,Date});
  const headers={'Content-Type':'application/json'};if(item.request.auth.type==='bearer')headers.Authorization='Bearer '+variables.get('token');
  const res=await fetch(expand(item.request.url),{method:item.request.method,headers,...(item.request.body?{body:expand(item.request.body.raw)}:{})});const json=await res.json();
  pm.response={code:res.status,json:()=>json,to:{have:{status:expected=>assert.equal(res.status,expected,item.name+': '+JSON.stringify(json))}}};
  for(const event of item.event.filter(e=>e.listen==='test'))vm.runInNewContext(event.script.exec.join('\n'),{pm});
 }
 assert.equal(users.length,2);assert.equal(sessions.rows.filter(s=>String(s.user)===String(users[1]._id)).length,0);
});
