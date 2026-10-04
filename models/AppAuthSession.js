const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id:{type:String,required:true},
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  expiresAt:{type:Date,required:true}
},{timestamps:true});
schema.index({expiresAt:1},{expireAfterSeconds:0});
module.exports=mongoose.model('AppAuthSession',schema);
