// Headless browser smoke checks with intercepted API fixtures; never contacts a live backend.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const chrome=process.env.CHROME_PATH || path.join(os.homedir(),'AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const plans=[{id:'pre',name:'Prelims Plan',baseAmount:699,totalAmount:699,duration:'1 year',features:['Tests'],isActive:true},{id:'mains',name:'Mains Plan',baseAmount:999,totalAmount:999,duration:'1 year',features:['Answer writing'],isActive:true}];
const programs=[{_id:'507f1f77bcf86cd799439011',programName:'Prelims 2027',programCategory:'Prelims Program',year:'2027',price:699,features:[],displayImage:'',startDate:'2027-01-01',endDate:'2027-05-01'}];
const job={_id:'job-1',title:'Faculty',description:'Teach students',type:'full-time',location:'Delhi',postedDate:'2026-09-01',yearsOfExperience:2};
let ownedPlans=['combo'];
let statisticsFail=false;
let batchesFail=false;
let programsEmpty=false;
let activeUser={_id:'507f1f77bcf86cd799439010',fullName:'Review Student',email:'student@example.com',role:'student',type:'combo',isActive:true};
let browser,socket;const servers=[];const failures=[];const requests=[];const pending=new Map();let sequence=0;
async function send(method,params={}) {const id=++sequence;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;}
async function waitFor(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100);}throw Error('Timed out: '+expression);}
async function clickText(text){await evaluate(`(()=>{const e=[...document.querySelectorAll('button,[role=tab]')].find(e=>e.textContent.trim().includes(${JSON.stringify(text)}));if(!e)throw Error('Missing button');e.click();})()`);await pause(200);}
async function fill(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
async function navigate(url){await send('Page.navigate',{url});await pause(1500);}
async function checkProgramCreation(){
 await navigate('http://127.0.0.1:4318/manage-program');await waitFor(`document.body.textContent.includes('Add New Program')`);await clickText('Add New Program');
 await fill('input[name=programName]','Review Program');await fill('input[name=year]','2027');await fill('input[name=price]','500');await fill('input[name=startDate]','2027-01-01');await fill('input[name=endDate]','2027-06-01');await fill('input[name=displayImage]','https://example.com/program.png');
 await clickText('Create Program');await waitFor(`!document.querySelector('input[name=programName]')`);
 const request=requests.find(r=>r.path==='/api/programs'&&r.method==='POST');assert(request);assert.equal(request.authorization,'Bearer review-token');assert.equal(JSON.parse(request.body).programName,'Review Program');console.log('PASS: Add New Program sends bearer token and completes creation');
}
async function checkDashboard(){
 await navigate('http://127.0.0.1:4318/dashboard');await waitFor(`!!document.querySelector('.admin-dashboard')`);assert.deepEqual(await evaluate(`[...document.querySelectorAll('.admin-dashboard mat-card-content h2')].map(e=>e.textContent.trim())`),['12','34','56']);
 statisticsFail=true;await navigate('http://127.0.0.1:4318/dashboard');await waitFor(`document.body.textContent.includes('Dashboard counts could not be loaded')`);assert.equal(await evaluate(`!!document.querySelector('.admin-dashboard')`),false);statisticsFail=false;await clickText('Retry');await waitFor(`!!document.querySelector('.admin-dashboard')`);console.log('PASS: admin dashboard counts, API error state and retry');
}
async function intercept(event){
 const {requestId,request}=event,url=new URL(request.url);let data={success:true,data:[]},code=200;
 if((url.port==='4317'||url.port==='4318')&&url.hostname==='127.0.0.1')return send('Fetch.continueRequest',{requestId});
 if((url.hostname==='localhost'&&url.port==='5000') || (url.hostname==='bytestech.online' && url.pathname.startsWith('/api/'))){
  const authorization=Object.entries(request.headers).find(([name])=>name.toLowerCase()==='authorization')?.[1];
  requests.push({path:url.pathname,method:request.method,body:request.postData,authorization});
  if(request.method==='OPTIONS')data={};
  else if(url.pathname==='/api/auth/me')data={user:activeUser,menuItems:[]};
  else if(url.pathname==='/api/auth/login'){code=403;data=require('../utils/accountStatus').inactiveAccount;}
  else if(url.pathname==='/api/payments/active-plans')data={planIds:ownedPlans};
  else if(url.pathname==='/api/jobs')data={success:true,data:[job],pagination:{pages:1,total:1}};
  else if(url.pathname==='/api/jobs/job-1')data={success:true,data:job};
  else if(url.pathname==='/api/jobs/job-1/apply')data={success:true,message:'Application submitted successfully!'};
  else if(url.pathname==='/api/programs/'+programs[0]._id)data={success:true,data:programs[0]};
  else if(url.pathname.endsWith('/file'))data={success:true,url:'https://example.com/answer.pdf',filename:'My answer.pdf'};
  else if(url.pathname==='/api/plans')data=plans;
  else if(url.pathname==='/api/plans/admin/all')data={success:true,data:plans};
  else if(url.pathname==='/api/config/razorpay-config')data={success:false};
  else if(url.pathname==='/api/programs'){
   if(request.method==='POST' && authorization!=='Bearer review-token'){code=401;data={message:'No token, authorization denied'};}
   else if(request.method==='POST'){data={success:true,message:'Program created successfully!',data:{...JSON.parse(request.postData),_id:'new-program'}};}
   else data={success:true,data:programsEmpty?[]:programs};
  }
  else if(url.pathname.endsWith('/batches')){code=batchesFail?500:200;data=batchesFail?{message:'Unavailable'}:{success:true,data:[{_id:'507f1f77bcf86cd799439012',batchName:'Morning Batch',startDate:'2027-01-01'}]};}
  else if(url.pathname==='/api/admin/students')data=[activeUser];
  else if(url.pathname==='/api/admin/statistics'){code=statisticsFail?500:200;data=statisticsFail?{message:'Statistics unavailable'}:{totalTests:12,totalStudents:34,totalResults:56};}
  else if(url.pathname.endsWith('/status'))data={success:true,data:{isActive:false}};
  else if(url.pathname==='/api/live-tests/admin/submissions')data={success:true,data:[{_id:'submission-1',answerPDFKey:'answers/file.pdf',originalName:'My answer.pdf',studentId:{fullName:'Review Student',email:'student@example.com'},testId:{title:'Mains Test'},answerPDF:'https://example.com/answer.pdf',submittedAt:'2026-09-10',status:'submitted'}]};
  else if(url.pathname==='/api/live-tests/admin')data={success:true,data:[],pagination:{total:0,page:1,pages:0}};
  else if(url.pathname==='/api/live-tests/student/my-participations')data={success:true,data:[{_id:'submission-1',testId:{_id:'test-1',title:'Mains Practice'},originalName:'My answer.pdf',answerPDF:'https://example.com/answer.pdf',status:'submitted',joinedAt:'2026-09-01',submittedAt:'2026-09-01'}]};
  else if(url.pathname==='/api/live-tests/student/all')data={success:true,data:[{_id:'507f1f77bcf86cd799439013',title:'Mains Practice',description:'Answer-writing practice',type:'Full-Length',subject:'GS',startDateTime:'2026-09-01T09:00:00Z',endDateTime:'2026-09-30T12:00:00Z',duration:180,status:'available'}]};
  else if(url.pathname.includes('/results')||url.pathname.includes('/tests'))data=[];
  else if(url.pathname.includes('/mains-ts/'))data={success:true,data:[{name:'Mains Series',description:'Practice',startDate:'2026-09-01',endDate:'2026-09-30',testDates:[{date:'2026-09-10',time:'09:00',duration:180}],intro:'Read the instructions.'}]};
 }
 return send('Fetch.fulfillRequest',{requestId,responseCode:code,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'*'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
}
async function main(){
 for(const [port,relative] of [[4317,'web/student-portal/student-portal/dist/thinkcivil-frontend/browser'],[4318,'web/admin-portal/dist/thinkcivil-admin/browser']]){
  const base=path.join(root,relative);const server=http.createServer((req,res)=>{let file=path.resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(base,'index.html');const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});await new Promise(r=>server.listen(port,'127.0.0.1',r));servers.push(server);
 }
 browser=spawn(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9337','--remote-allow-origins=*','--user-data-dir='+path.join(os.tmpdir(),'thinkias-review-'+Date.now()),'about:blank'],{windowsHide:true,stdio:'ignore'});
 let targets;for(let i=0;i<100;i++){try{targets=await(await fetch('http://127.0.0.1:9337/json')).json();if(targets.some(x=>x.type==='page'))break;}catch{}await pause(100);}if(!targets?.some(x=>x.type==='page'))throw Error('Headless browser did not start');
 socket=new WebSocket(targets.find(x=>x.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(Error(m.error.message));else p.resolve(m.result);}else if(m.method==='Fetch.requestPaused')intercept(m.params).catch(e=>failures.push(e.message));else if(m.method==='Runtime.exceptionThrown')failures.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
 await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 const init=await send('Page.addScriptToEvaluateOnNewDocument',{source:`if(!localStorage.getItem('review-initialized')){localStorage.setItem('token','review-token');const user=${JSON.stringify(activeUser)};if(location.port==='4318')user.role='admin';localStorage.setItem('user',JSON.stringify(user));localStorage.setItem('menuItems','[]');localStorage.setItem('review-initialized','1');}`});
 if(process.argv.includes('--program-only')){activeUser={...activeUser,role:'admin'};await checkProgramCreation();if(failures.length)throw Error(failures.join('\n'));return;}
 if(process.argv.includes('--program-refresh-only')){
  programsEmpty=true;await navigate('http://127.0.0.1:4317/dashboard');await waitFor(`document.querySelectorAll('.plan-card').length===2`);await clickText('Upgrade Plan');await waitFor(`document.body.textContent.includes('No active, unexpired programs')`);
  programsEmpty=false;await clickText('Refresh programs');await waitFor(`document.querySelector('mat-select[formcontrolname=programId]')?.textContent.includes('Prelims 2027')`);await evaluate(`document.querySelector('mat-select[formcontrolname=batchId]').click()`);await waitFor(`document.querySelector('mat-option')?.textContent.includes('Morning Batch')`);await evaluate(`document.querySelector('mat-option').click()`);
  await clickText('Refresh programs');await pause(500);assert.equal(await evaluate(`document.querySelector('mat-select[formcontrolname=batchId]').textContent.includes('Morning Batch')`),true);
  console.log('PASS: empty program list refreshes to newly available program and batches; refresh preserves selection');if(failures.length)throw Error(failures.join('\n'));return;
 }
 if(process.argv.includes('--dashboard-only')){activeUser={...activeUser,role:'admin'};await checkDashboard();if(failures.length)throw Error(failures.join('\n'));return;}
 await navigate('http://127.0.0.1:4317/dashboard');await waitFor(`document.querySelectorAll('.plan-card').length===2`);
 assert.equal(await evaluate(`!!document.querySelector('app-program')`),false);
 assert.equal(await evaluate(`!!(document.querySelector('.plans-section').compareDocumentPosition(document.querySelector('.testimonials-section')) & Node.DOCUMENT_POSITION_FOLLOWING)`),true);
 await clickText('Upgrade Plan');await waitFor(`!!document.querySelector('mat-select[formcontrolname=plan]')`);
 await waitFor(`document.querySelector('mat-select[formcontrolname=programId]')?.textContent.includes('Prelims 2027')`);
 await evaluate(`document.querySelector('mat-select[formcontrolname=batchId]').click()`);await waitFor(`document.querySelector('mat-option')?.textContent.includes('Morning Batch')`);await evaluate(`document.querySelector('mat-option').click()`);console.log('PASS: upgrade automatically loads batches for the sole available program');
 await evaluate(`document.querySelector('mat-select[formcontrolname=plan]').click()`);await waitFor(`document.querySelectorAll('mat-option').length===2`);
 // A real mouse click catches overlay/backdrop stacking failures that synthetic clicks miss.
 let pos=await evaluate(`(()=>{const r=[...document.querySelectorAll('mat-option')][1].getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...pos});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...pos});
 await waitFor(`document.querySelector('.selected-plan').textContent.includes('Mains Plan')`);
 await evaluate(`document.querySelector('mat-select[formcontrolname=programId]').click()`);await waitFor(`document.querySelectorAll('mat-option').length===2`);await evaluate(`[...document.querySelectorAll('mat-option')][1].click()`);
 await waitFor(`!!document.querySelector('mat-select[formcontrolname=batchId]')`);await evaluate(`document.querySelector('mat-select[formcontrolname=batchId]').click()`);await waitFor(`document.querySelector('mat-option')?.textContent.includes('Morning Batch')`);await evaluate(`document.querySelector('mat-option').click()`);
 console.log('PASS: combo dashboard plans, plan dropdown with real mouse input, program-specific batches');
 await evaluate(`document.querySelector('mat-select[formcontrolname=programId]').click()`);await waitFor(`document.querySelectorAll('mat-option').length===2`);await evaluate(`document.querySelector('mat-option').click()`);await waitFor(`document.querySelector('mat-select[formcontrolname=batchId]')?.getAttribute('aria-disabled')==='true'`);assert.equal(await evaluate(`document.body.textContent.includes('Select a program above to see its active batches.')`),true);
 batchesFail=true;await evaluate(`document.querySelector('mat-select[formcontrolname=programId]').click()`);await waitFor(`document.querySelectorAll('mat-option').length===2`);await evaluate(`[...document.querySelectorAll('mat-option')][1].click()`);await waitFor(`document.body.textContent.includes('Unable to load batches')`);batchesFail=false;await clickText('Reload batches');await waitFor(`!document.body.textContent.includes('Unable to load batches')`);await evaluate(`document.querySelector('mat-select[formcontrolname=batchId]').click()`);await waitFor(`document.querySelector('mat-option')?.textContent.includes('Morning Batch')`);await evaluate(`document.querySelector('mat-option').click()`);console.log('PASS: batch selection remains visible for Plan only and reload recovers failed batch requests');
 await clickText('Cancel');ownedPlans=['pre'];await clickText('Upgrade Plan');await waitFor(`document.body.textContent.includes('You already have this active plan')`);assert.equal(await evaluate(`document.querySelector('.pay-button').disabled`),true);console.log('PASS: already-owned plan cannot be purchased from payment dialog');ownedPlans=['combo'];
 await navigate('http://127.0.0.1:4317/live-test');await waitFor(`document.querySelectorAll('.test-summary-card').length===1`);await fill('input[aria-label="Search Mains tests"]','no matching test');await waitFor(`document.querySelectorAll('.test-summary-card').length===0`);console.log('PASS: Mains exam cards and search');
 await clickText('My Participation');await waitFor(`document.body.textContent.includes('My answer.pdf')`);await clickText('View answer sheet');await waitFor(`!!document.querySelector('iframe[title="Student submitted answer PDF"]')`);console.log('PASS: student opens own submitted PDF');
 await navigate('http://127.0.0.1:4317/mains-test-series');await waitFor(`document.querySelector('h1')?.textContent.includes('Mains Test Series')`);await waitFor(`document.body.textContent.includes('Mains Series')`);console.log('PASS: dedicated Mains series route and cards');
 await navigate('http://127.0.0.1:4317/careers-page');await waitFor(`!!document.querySelector('.job-card')`);assert.equal(await evaluate(`document.querySelectorAll('app-header').length===1 && document.querySelectorAll('app-public-footer').length===1 && !document.querySelector('.app-toolbar')`),true);
 await clickText('Apply Now');await waitFor(`!!document.querySelector('.modal form')`);await fill('input[formcontrolname=name]','Review Applicant');await fill('input[formcontrolname=email]','review@example.com');await fill('input[formcontrolname=contactNo]','9876543210');
 await evaluate(`(()=>{const input=document.querySelector('input[type=file]');const dt=new DataTransfer();dt.items.add(new File(['%PDF-1.4\\nReview resume'],'resume.pdf',{type:'application/pdf'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const jobReads=requests.filter(r=>r.path==='/api/jobs'&&r.method==='GET').length;await clickText('Submit Application');await waitFor(`!!document.querySelector('#career-success') && !document.querySelector('.modal')`);await pause(500);assert(requests.filter(r=>r.path==='/api/jobs'&&r.method==='GET').length>jobReads);assert.equal(await evaluate(`document.activeElement.id`),'career-success');
 console.log('PASS: careers submission success, form reset, focus and jobs refresh');
 for(const route of ['programs','program-faqs','program/'+programs[0]._id]){await navigate('http://127.0.0.1:4317/'+route);await waitFor(`document.querySelectorAll('app-header').length===1 && document.querySelectorAll('app-public-footer').length===1`);assert.equal(await evaluate(`!!document.querySelector('.app-toolbar')`),false);}console.log('PASS: shared public header/footer for careers, programs, batches and FAQs');
 await evaluate(`localStorage.removeItem('token');localStorage.removeItem('user')`);await navigate('http://127.0.0.1:4317/login');await fill('input[formcontrolname=email]','inactive@example.com');await fill('input[formcontrolname=password]','password123');await evaluate(`document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);await waitFor(`document.querySelector('mat-dialog-content')?.textContent.includes('Your account is currently inactive.')`);console.log('PASS: inactive login popup');
 activeUser={...activeUser,role:'admin'};await navigate('http://127.0.0.1:4318/manage-plans');await waitFor(`document.querySelectorAll('article.plan').length===2`);await clickText('Add Plan');assert.equal(await evaluate(`!!document.querySelector('input[name=id]')`),false);await fill('input[name=name]','Review Plan');await fill('input[name=totalAmount]','123');await evaluate(`document.querySelector('form.editor').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);await waitFor(`!document.querySelector('form.editor')`);assert(requests.some(r=>r.path==='/api/plans/admin'&&r.method==='POST'&&JSON.parse(r.body).name==='Review Plan' && JSON.parse(r.body).accessType==='pre'));console.log('PASS: Add Plan persists via POST');
 await checkDashboard();
 await checkProgramCreation();
 await navigate('http://127.0.0.1:4318/students-list');await waitFor(`!!document.querySelector('[role=switch]')`);await evaluate(`document.querySelector('[role=switch]').click()`);await waitFor(`document.querySelector('[role=switch]').getAttribute('aria-checked')==='false'`);console.log('PASS: student activation switch persists via PATCH');
 await navigate('http://127.0.0.1:4318/program-faqs');await waitFor(`document.body.textContent.includes('Add FAQ')`);await clickText('Add FAQ');await fill('select[name=program]',programs[0]._id);await fill('input[name=question]','When does this program start?');await fill('textarea[name=answer]','January 2027.');await clickText('Save');await waitFor(`document.body.textContent.includes('FAQ saved successfully.')`);assert(requests.some(r=>r.path==='/api/program-faqs'&&r.method==='POST'&&JSON.parse(r.body).programId===programs[0]._id));console.log('PASS: admin creates a new program FAQ');
 await navigate('http://127.0.0.1:4318/live-test');await waitFor(`document.querySelectorAll('[role=tab]').length===2`);await clickText('Submissions');await waitFor(`document.body.textContent.includes('Submissions: 1')`);await clickText('View submitted PDF');await waitFor(`document.querySelector('iframe[title="Student submitted answer PDF"]')?.src==='https://example.com/answer.pdf'`);console.log('PASS: submissions count and secure PDF viewer');
 if(failures.length)throw Error(failures.join('\n'));console.log('All headless smoke checks passed with mocked APIs.');
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{if(socket)socket.close();if(browser)browser.kill();for(const server of servers)server.close();});
