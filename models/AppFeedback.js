const mongoose=require('mongoose');
const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,unique:true},enjoying:{type:Boolean,required:true},platform:{type:String,enum:['android','ios'],default:'android'}},{timestamps:true});
module.exports=mongoose.model('AppFeedback',schema);
