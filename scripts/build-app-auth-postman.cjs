const fs=require('node:fs');
const base='{{baseUrl}}/api/app/auth';
const assertCode=code=>`pm.test('HTTP ${code}', function () { pm.response.to.have.status(${code}); });`;
function item(name,method,path,body,status=200,save,auth=false){
 const script=[assertCode(status)];
 if(save)script.push(`if (pm.response.code === ${status}) { const data=pm.response.json().data; ${Object.entries(save).map(([variable,key])=>`pm.collectionVariables.set('${variable}', data.${key});`).join(' ')} }`);
 return {name,request:{method,header:[{key:'Content-Type',value:'application/json'}],auth:auth?{type:'bearer',bearer:[{key:'token',value:'{{token}}',type:'string'}]}:{type:'noauth'},url:base+path,...(body?{body:{mode:'raw',raw:JSON.stringify(body,null,2),options:{raw:{language:'json'}}}}:{})},event:[{listen:'test',script:{type:'text/javascript',exec:script}}]};
}
const otp={email:'{{email}}',challengeId:'{{registrationChallengeId}}',otp:'{{otp}}'};
const collection={info:{name:'ThinkIAS App Auth — UI flow / test OTP 1234',description:'Email-first registration matching ThinkIAS-APP-UI PDFs. No email is sent. Test OTP is 1234. Run requests in order. The first request generates a unique test email unless an environment email is set. App tokens expire after 24h and are revoked on logout or app password reset.',schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},variable:[{key:'baseUrl',value:'http://localhost:5000'},{key:'email',value:''},{key:'password',value:'Student123!'},{key:'newPassword',value:'Changed123!'},{key:'otp',value:'1234'},{key:'registrationChallengeId',value:''},{key:'verificationToken',value:''},{key:'resetChallengeId',value:''},{key:'resetToken',value:''},{key:'token',value:''}],item:[]};
const send=item('01 — Sign up: Send email code','POST','/send-otp',{email:'{{email}}'},200,{registrationChallengeId:'challengeId'});
send.event.unshift({listen:'prerequest',script:{type:'text/javascript',exec:["if (!pm.environment.get('email')) pm.collectionVariables.set('email', 'app.student.'+Date.now()+'@example.com');"]}});
const resend=item('02 — Resend code / countdown','POST','/resend-otp',{email:'{{email}}',challengeId:'{{registrationChallengeId}}'});
resend.request.description='Before the UI 120-second timer finishes, 429 plus retryAfterSeconds is expected. After the timer it returns 200. Both are valid in this collection.';
resend.event[0].script.exec=["pm.test('Resend or countdown', function(){pm.expect(pm.response.code).to.be.oneOf([200,429]);});"];
collection.item=[send,resend,
 item('03 — Wrong OTP is rejected','POST','/verify-email',{...otp,otp:'9999'},400),
 item('04 — Verify email: OTP 1234','POST','/verify-email',otp,200,{verificationToken:'verificationToken'}),
 item('05 — Submit registration form','POST','/register',{email:'{{email}}',verificationToken:'{{verificationToken}}',fullName:'App Test Student',phone:'9876543210',password:'{{password}}',confirmPassword:'{{password}}'},201,{token:'token'}),
 item('06 — Current student','GET','/me',null,200,null,true),
 item('07 — Confirm Logout','POST','/logout',{},200,null,true),
 item('08 — Logged-out token must fail','GET','/me',null,401,null,true),
 item('09 — Login','POST','/login',{email:'{{email}}',password:'{{password}}'},200,{token:'token'}),
 item('10 — Forgot password: Send code','POST','/forgot-password',{email:'{{email}}'},200,{resetChallengeId:'challengeId'}),
 item('11 — Verify password-reset OTP','POST','/verify-reset-otp',{email:'{{email}}',challengeId:'{{resetChallengeId}}',otp:'{{otp}}'},200,{resetToken:'resetToken'}),
 item('12 — Set new password','POST','/reset-password',{email:'{{email}}',resetToken:'{{resetToken}}',password:'{{newPassword}}',confirmPassword:'{{newPassword}}'}),
 item('13 — Old session must fail after reset','GET','/me',null,401,null,true),
 item('14 — Old password must fail','POST','/login',{email:'{{email}}',password:'{{password}}'},401),
 item('15 — Login with new password','POST','/login',{email:'{{email}}',password:'{{newPassword}}'},200,{token:'token'}),
 item('16 — Current student after reset','GET','/me',null,200,null,true),
 item('17 — Logout','POST','/logout',{},200,null,true)
];
fs.mkdirSync('postman',{recursive:true});
fs.writeFileSync('postman/ThinkIAS-App-Auth.postman_collection.json',JSON.stringify(collection,null,2)+'\n');
fs.writeFileSync('postman/ThinkIAS-App-Local.postman_environment.json',JSON.stringify({name:'ThinkIAS App — Local',values:[{key:'baseUrl',value:'http://localhost:5000',enabled:true,type:'default'},{key:'email',value:'',enabled:true,type:'default'}],_postman_variable_scope:'environment'},null,2)+'\n');
console.log('Postman collection and local environment generated.');
