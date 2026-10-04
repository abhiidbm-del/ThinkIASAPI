const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
test('dashboard counts survive results with deleted student and test references',async()=>{
 const module={exports:{}};
 const query={populate(){return this;},sort(){return this;},limit:async()=>[{student:null,test:null,score:5,totalMarks:10}]};
 const models={
  '../models/Test':{countDocuments:async filter=>filter?2:12},
  '../models/User':{countDocuments:async filter=>{assert.deepEqual(filter.role,'student');return 34;}},
  '../models/Result':{countDocuments:async()=>56,find:()=>query},
  '../models/Question':{}
 };
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../services/analyticsService.js'),'utf8'),{module,require:name=>models[name]});
 const stats=await module.exports.getPlatformStatistics();
 assert.equal(stats.totalTests,12);assert.equal(stats.totalStudents,34);assert.equal(stats.totalResults,56);
 assert.equal(stats.recentResults[0].studentName,'Deleted student');assert.equal(stats.recentResults[0].testTitle,'Deleted test');
});
