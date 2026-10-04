const mongoose=require('mongoose');
const schema=new mongoose.Schema({_id:{type:String,enum:['config','onboarding','terms','privacy','faqs']},data:{type:mongoose.Schema.Types.Mixed,required:true},updatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}},{timestamps:true});
module.exports=mongoose.model('AppContent',schema);
