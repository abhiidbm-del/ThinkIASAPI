const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: {type:String,required:true},
  email: {type:String,required:true},
  purpose: {type:String,enum:['registration','password_reset'],required:true},
  attempts: {type:Number,default:0},
  verifiedAt: Date,
  consumedAt: Date,
  proofHash: String,
  expiresAt: {type:Date,required:true}
},{timestamps:true});
schema.index({expiresAt:1},{expireAfterSeconds:0});
module.exports=mongoose.model('AppAuthChallenge',schema);
