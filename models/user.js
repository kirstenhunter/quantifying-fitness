var mongoose = require('mongoose'),
	env = process.env.NODE_ENV || 'production',
	config = require('../config')[env],
	Schema = mongoose.Schema;

var UserSchema = new Schema({
	encodedId: {type: String, required: true, index: true, unique: true},
	accessToken: {type: String, required: true},
	accessSecret: {type: String, required: true},
	lastSync: Date,
	stepsToday: Number,
	stepsGoal: Number,
	proteinToday: Number,
	proteinGoal: Number,
	phoneNumber: String,
	timezoneOffset: Number
});

var User = mongoose.model('User', UserSchema);
