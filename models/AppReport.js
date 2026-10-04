const mongoose=require('mongoose');
const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},message:{type:String,required:true,maxlength:5000},status:{type:String,enum:['open','in_progress','resolved'],default:'open'},adminReply:{type:String,maxlength:5000,default:''},screenshot:{contentType:String,data:{type:Buffer,select:false}}},{timestamps:true});
module.exports=mongoose.model('AppReport',schema);
