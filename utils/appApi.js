const {mediaUrl}=require('./mediaUrl');
const fail=(status,message)=>Object.assign(new Error(message),{status});
const handle=fn=>async(req,res,next)=>{try{await fn(req,res,next);}catch(e){const status=e.status||(e.code===11000?409:['ValidationError','CastError'].includes(e.name)?400:500);res.status(status).json({success:false,message:status===500?'Unable to complete the request. Please try again.':e.message});}};
function page(query){
  const rawPage=Number(query.page);
  const rawLimit=Number(query.limit);
  const page=!Number.isFinite(rawPage)||rawPage<1?1:Math.floor(rawPage);
  const limit=!Number.isFinite(rawLimit)||rawLimit<1?20:Math.min(100,Math.floor(rawLimit));
  return {page,limit,skip:(page-1)*limit};
}
async function list(Model,filter,req,res,sort={createdAt:-1},select,mapper=x=>x){
  const p=page(req.query);
  let q=Model.find(filter).sort(sort).skip(p.skip).limit(p.limit);
  if(select)q=q.select(select);
  const[rows,total]=await Promise.all([q.lean(),Model.countDocuments(filter)]);
  const data=rows.map(mapper);
  res.json({success:true,data,items:data,count:data.length,pagination:{page:p.page,limit:p.limit,total,pages:Math.ceil(total/p.limit)||0}});
}
const regex=value=>String(value||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const text=(req,english,hindi)=>req.query.lang==='hi'?(hindi||english):english;
const profile=u=>({id:u._id,fullName:u.fullName,email:u.email,phone:u.phone,address:u.address||{},preferredLanguage:u.preferredLanguage||'en',notificationsEnabled:u.notificationsEnabled!==false,profileImage:u.profileImage||null,emailVerified:!!u.emailVerifiedAt,type:u.type});
module.exports={fail,handle,page,list,regex,text,profile};
