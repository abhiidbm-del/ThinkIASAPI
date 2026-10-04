const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
test('Firebase delivery selects related students, batches 500 tokens and uses Hindi content', async () => {
  let userFilter, tokenFilter; const calls = [];
  const devices = Array.from({length:1101},(_,i)=>({token:`token-${i}`, language:i<600?'en':'hi'}));
  const module = {exports:{}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../services/firebaseNotificationService.js'),'utf8'), {module, console, process:{env:{}}, require(name){
    if(name==='firebase-admin')return {apps:[{}],messaging:()=>({sendEachForMulticast:async payload=>{calls.push(payload);return {successCount:payload.tokens.length,failureCount:0,responses:payload.tokens.map(()=>({success:true}))};}})};
    if(name.endsWith('/User'))return {find:filter=>{userFilter=filter;return {distinct:async()=>['student-1']};}};
    if(name.endsWith('/DeviceToken'))return {find:filter=>{tokenFilter=filter;return {select:()=>({lean:async()=>devices})};}};
    if(name.endsWith('/Notification'))return {};
    if(name.endsWith('/notificationAudience'))return require('../utils/notificationAudience');
    throw new Error(name);
  }});
  const result = await module.exports.pushNotification({_id:'notice',audience:'mains',title:'New test',titleHindi:'नया टेस्ट',body:'Available now',bodyHindi:'अभी उपलब्ध',type:'test_series',link:'/live-test'});
  assert.equal(userFilter.role,'student');
  assert.deepEqual(userFilter.type.$in,['mains','combo']);
  assert.deepEqual(tokenFilter.user.$in,['student-1']);
  assert.deepEqual(calls.map(call=>call.tokens.length),[500,100,500,1]);
  assert.equal(calls[2].notification.title,'नया टेस्ट');
  assert.equal(result.sent,1101);
});
