var fs = require('fs'),
	OAuth = require('oauth'),
	mongoose = require('mongoose'),
	User = mongoose.model('User'),
	Twilio = require('./twilio-api'),
	moment = require('moment'),
	env = process.env.NODE_ENV || 'production',
	config = require('../config')[env];

var fitbit_oauth = new OAuth.OAuth(
	'https://api.fitbit.com/oauth/request_token',
	'https://api.fitbit.com/oauth/access_token',
	config.fitbitClientKey,
	config.fitbitClientSecret,
	'1.0',
	null,
	'HMAC-SHA1'
);

var stepsTodayGlobal = 0;
var stepsGoalGlobal  = 0;
var proteinTodayGlobal = 0;
var proteinGoalGlobal  = 0;

var currentTime;
var currentHours;

function updateUserData(encodedId, callback) {
	console.log("updateUserData for", encodedId);
	var currentTime = new Date();
	
	currentHours = currentTime.getHours();
	console.log("currentHours", currentHours);

	currentHours += 8;
	if (currentHours >= 24) {
		currentHours -= 24;
	}
	console.log("currentHours", currentHours);
	
	//if ((currentHours > 12) || (currentHours < 1)) {
	//	return;
	//}

	User.findOne(
		{
			'encodedId': encodedId
		},
		function(err, user) {
			if (err) {
				console.error("Error finding user", err);
				callback(err);
				return;
			}

			foodpath = 'https://api.fitbit.com/1/user/-/foods/log/date/' + moment().utc().add('ms', user.timezoneOffset).format('YYYY-MM-DD') + '.json';
			activitypath = 'https://api.fitbit.com/1/user/-/activities/date/' + moment().utc().add('ms', user.timezoneOffset).format('YYYY-MM-DD') + '.json';

			function fitbit_oauth_getP(path, accessToken, accessSecret) {
				return new Promise (function(resolve, reject) {
					fitbit_oauth.get(path, accessToken, accessSecret, function(err, data, res) {
						if (err) {
							reject(err);
						} else {
							resolve(data);
						}
					}
				)
			})};

			Promise.all([fitbit_oauth_getP(foodpath, user.accessToken, user.accessSecret), 
						 fitbit_oauth_getP(activitypath, user.accessToken, user.accessSecret)])
						 .then(function(arrayOfResults) {
						console.log(arrayOfResults);
				    
						foodObject = JSON.parse(arrayOfResults[0]);
						activityObject = JSON.parse(arrayOfResults[1]);

						console.log(activityObject.summary.steps);
						console.log(activityObject.goals.steps);
						console.log(foodObject.summary.protein);
						console.log(config.fitbitProteinTarget);
						

						console.log("Fitbit Got Activities and Food");

						User.findOneAndUpdate(
							{
								encodedId: user.encodedId
							},
							{
								stepsToday: activityObject.summary.steps,
								stepsGoal: activityObject.goals.steps,
								proteinToday: foodObject.summary.protein,
								proteinGoal: config.fitbitProteinTarget
							},
							null,
							function(err, user) {
								if (err) {
									console.error("Error updating user activity.", err);
								}
								callback(err, user);
							}
						);
					}
				);
			}
	);
};

function motivateUserCallback(err, user) {

	if (err) {
		console.error('motivateUserCallback error:', err);
		return;
	}

	// 12 hours we're checking
	var smsBody = '';

	var checkTime = currentHours;
	var percentageCheck = checkTime * 8.25;
	var stepsPercentage = user.stepsToday / user.stepsGoal * 100;
	var proteinPercentage = user.proteinToday / user.proteinGoal * 100;

	console.log("checkTime", checkTime);
	console.log("Percentage Check", percentageCheck);
	console.log("Protein Percentage", proteinPercentage);
	console.log("Steps Percentage", stepsPercentage);

	if (stepsPercentage < percentageCheck) {
		var stepsRemaining = user.stepsGoal - user.stepsToday;

		smsBody += 'Get Moving! ' + stepsRemaining + ' steps to go today. ' + stepsPercentage + '% of the way there!\n';
	}

	if (proteinPercentage < percentageCheck) {
		var proteinRemaining = user.proteinGoal - user.proteinToday;
		if (smsBody == '') {
			smsBody = 'Great job moving today! ' + stepsTodayGlobal + ' steps so far today\n';
		}
		smsBody += 'Log your foods! ' + proteinRemaining + ' grams of protein to go today. ' + proteinPercentage + '% of the way there!';
	} else {
		if (smsBody != '') {
			smsBody += 'Great job on the protein today! ' + user.proteinToday + ' protein so far today\n';
		}
	}

	if (smsBody != '') {
		console.log("Twilio.sendSms", user.phoneNumber, smsBody);
		Twilio.sendSms(user.phoneNumber, smsBody);
	}

	// Now update the philips hue with the right color.
	// First, figure out what the percentage is

	var totalPercentage = (proteinPercentage + stepsPercentage) / 2;
	var currentTime = new Date();
	var seconds = currentTime.getTime();

	if (totalPercentage < 25) {
		twitstring = 'synedra0 ' + seconds;
	} else if (totalPercentage < 50) {
		twitstring = 'synedra1 ' + seconds;
	} else if (totalPercentage < 75) {
		twitstring = 'synedra2 ' + seconds;
	} else {
		twitstring = 'synedra3 ' + seconds;
	}
	console.log("Twitstring: " + twitstring);

	var Twitter = require('twit');
	var twitter = new Twitter({
   		consumer_key: '',
 		consumer_secret: '',
  		access_token: '',
  		access_token_secret: ''
	});

	twitter.post('statuses/update', { status: twitstring }, function(err, data, response) {
  		console.log(data);
	});
}

function notificationsReceived(req, res) {
	// Immediately send HTTP 204 No Content
	res.send(204);

	fs.readFile(req.files.updates.path, {encoding: 'utf8'}, function (err, data) {
		if (err) console.error(err);
		data = JSON.parse(data);

		// [
		// 	 {
		// 		collectionType: 'activities',
		// 		date: '2013-10-21',
		// 		ownerId: '23RJ9B',
		// 		ownerType: 'user',
		// 		subscriptionId: '23RJ9B-all'
		// 	}
		// ]

		for (var i = 0; i < data.length; i++) {
			console.log(data[i]);
			updateUserData(data[i].ownerId, motivateUserCallback);
		}
	});
};

module.exports.notificationsReceived = notificationsReceived;
module.exports.updateUserData = updateUserData;	
