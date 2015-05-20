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

//var twitter_oauth = new OAuth.OAuth(
//	'https://api.fitbit.com/oauth/request_token',
//	'https://api.fitbit.com/oauth/access_token',
//	config.fitbitClientKey,
//	config.fitbitClientSecret,
//	'1.0',
//	null,
//	'HMAC-SHA1'
//);

function updateUserData(encodedId, callback) {
	console.log("updateUserData for", encodedId);
	currentTime = new Date();
	currentHours = currentTime.getHours();
	console.log("currentHours", currentHours);

	currentHours += 8;
	if (currentHours >= 24) {
		currentHours -= 24;
	}
	console.log("currentHours", currentHours);

	if ((currentHours > 12) || (currentHours < 1)) {
		return;
	}

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

			// Get updated steps from Fitbit API
			fitbit_oauth.get(
				'https://api.fitbit.com/1/user/-/activities/date/' + moment().utc().add('ms', user.timezoneOffset).format('YYYY-MM-DD') + '.json',
				user.accessToken,
				user.accessSecret,
				function (err, data, res) {
					if (err) {
						console.error("Error fetching activity data. ", err);
						callback(err);
						return;
					}

					data = JSON.parse(data);
					
					stepsTodayGlobal = data.summary.steps;
					stepsGoalGlobal = data.goals.steps;

					console.log("Fitbit Get Activities", data);

					// Update (and return) the user
					User.findOneAndUpdate(
						{
							encodedId: user.encodedId
						},
						{
							stepsToday: data.summary.steps,
							stepsGoal: data.goals.steps
						},
						null,
						function(err, user) {
							if (err) {
								console.error("Error updating user activity.", err);
							}
						}
					);
				}
			);

			fitbit_oauth.get(
				'https://api.fitbit.com/1/user/-/foods/log/date/' + moment().utc().add('ms', user.timezoneOffset).format('YYYY-MM-DD') + '.json',
				user.accessToken,
				user.accessSecret,
				function (err, data, res) {
					if (err) {
						console.error("Error fetching food data. ", err);
						callback(err);
						return;
					}

					data = JSON.parse(data);
					proteinTodayGlobal = data.summary.protein;
					proteinGoalGlobal = config.fitbitProteinTarget;

					console.log("Fitbit Get Food", data);

					// Update (and return) the user
					User.findOneAndUpdate(
						{
							encodedId: user.encodedId
						},
						{
							proteinToday: data.summary.protein,
							proteinGoal: config.fitbitProteinTarget
						},
						null,
						function(err, user) {
							if (err) {
								console.error("Error updating user food.", err);
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

	checkTime = currentHours;
	console.log("checkTime", checkTime);
	
	var percentageCheck = checkTime * 8.25;
	console.log("Percentage Check", percentageCheck);

	// Percentage of steps (compare to 8.25 * Hour - 9)
	var stepsPercentage = stepsTodayGlobal / stepsGoalGlobal * 100;
	console.log("Steps Percentage", stepsPercentage);

	// Percentage of protein (compare to 8.25 * Hour - 9)
	var proteinPercentage = user.proteinToday / user.proteinGoal * 100;
	console.log("Protein Percentage", proteinPercentage);


	if (stepsPercentage < percentageCheck) {
		var stepsRemaining = stepsGoalGlobal - stepsTodayGlobal;

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
			smsBody += 'Great job on the protein today! ' + user.proteinToday + ' steps so far today\n';
		}
	}

	if (smsBody != '') {
		console.log("Twilio.sendSms", user.phoneNumber, smsBody);
		Twilio.sendSms(user.phoneNumber, smsBody);
	}

	// Now update the philips hue with the right color.
	// First, figure out what the percentage is

	var totalPercentage = (proteinPercentage + stepsPercentage) / 2;

	if (totalPercentage < 25) {
		twitstring = 'synedra0';
	} else if (totalPercentage < 50) {
		twitstring = 'synedra1';
	} else if (totalPercentage < 75) {
		twitstring = 'synedra2';
	} else {
		twitstring = 'synedra3';
	}

	var Twitter = require('twit');
	var twitter = new Twitter({
   		consumer_key: '7fMGeCuccQGsKxap1Ho7y2Usj',
  		consumer_secret: 'bFuQ29yq1dPZLdMplkXbjUiuliiooNMwAEmeFG8UoJ9mscYPNv',
  		access_token: '2567964464-MNvWWWPD0gm0YaQ28tD9X0ML1885dr7TXGZkzVZ',
  		access_token_secret: 'JSkyNEvcF1SdMIqNYVqueqzT2tE8RejESlGWGfsqjUkUR'
	});

	twitter.post('statuses/update', { status: twitstring }, function(err, data, response) {
  		console.log(data);
  		console.log('Error: ' + err);
  		console.error('response status:', err.statusCode);
  		console.error('data:', err.data);
  		console.log('Response: ' + response);
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