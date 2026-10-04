const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const ts=require('../web/admin-portal/node_modules/typescript');
test('admin remains authenticated during root-to-dashboard redirect',()=>{
  const source=fs.readFileSync(require('node:path').join(__dirname,'../web/admin-portal/src/app/shared/services/auth.service.ts'),'utf8');
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
  const exports={}; const storage=new Map();
  vm.runInNewContext(output,{exports,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},require(name){
    if(name==='@angular/core')return {Injectable:()=>value=>value,signal:initial=>{let value=initial;const getter=()=>value;getter.set=next=>value=next;return getter;},computed:fn=>fn,inject:()=>({events:{pipe:()=>({subscribe:()=>{}})}})};
    if(name.includes('environment'))return {environment:{apiUrl:'/api'}};
    if(name==='rxjs/operators')return {filter:()=>{},tap:()=>{}};
    return {};
  }});
  const auth=new exports.AuthService({});
  auth.setAuthData({token:'test-token',user:{_id:'admin',role:'admin'},menuItems:[]});
  auth.isOnAuthPageSignal.set(true);
  assert.equal(auth.isLoggedIn(),true);
  assert.equal(auth.currentUser().role,'admin');
});
