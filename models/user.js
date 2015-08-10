var mongoose = require('mongoose'),
	env = process.env.NODE_ENV || 'production',
	config = require('../config')[env],
	Schema = mongoose.Schema;

var UserSchema = new Schema({
	encodedId: {type: String, required: true, index: true, unique: true},
	accessToken: {type: String, required: true},
	accessSecret: {type: String, required: true},
	phoneNumber: String,
	timezoneOffset: Number,
	lastSync: String,
	activityGoal: String,
	proteinGoal: String,
	waterGoal: String,
	lastprotein: String,
	lastwater: String,
	lastactivity: String
});


var User = mongoose.model('User', UserSchema);
