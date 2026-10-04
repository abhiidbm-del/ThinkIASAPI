const mongoose=require('mongoose');
const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},source:{type:String,enum:['free','pre','mains','modules'],required:true},resourceId:{type:mongoose.Schema.Types.ObjectId,required:true},name:String},{timestamps:true});
schema.index({user:1,source:1,resourceId:1},{unique:true});
module.exports=mongoose.model('AppDownload',schema);
