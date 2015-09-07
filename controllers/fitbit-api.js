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

var lastUpdate;
var currentTime;
var currentHours;

function updateUserData(encodedId, calldate, callback) {
	console.log("updateUserData for", encodedId);

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

				function fitbit_oauth_getP(path) {
				return new Promise (function(resolve, reject) {
					fitbit_oauth.get(path, user.accessToken, user.accessSecret, function(err, data, res) {
						if (err) {
							console.log(path);
							console.log(err);
							reject(err);
						} else {
							console.log(path);
							console.log(data);
							resolve(data);
						}
					}
				)
			})};


			date = moment().utc().add('ms', user.timezoneOffset).format('YYYY-MM-DD');

			prefix = 'https://api.fitbit.com/1/user/-';

			Promise.all([
							fitbit_oauth_getP(prefix + "/foods/log/date/" + date + '.json'),
							fitbit_oauth_getP(prefix + "/activities/date/" + date + '.json')
						])
						 .then(function(arrayOfResults) {
				    	
				    	food = JSON.parse(arrayOfResults[0]);
				    	console.log(food);
				    	water = food["summary"]["water"];
				    	protein = food["summary"]["protein"]
				    	activity = JSON.parse(arrayOfResults[1])["summary"]["caloriesOut"];
				    	console.log(JSON.parse(arrayOfResults[1]));
				    	previousactivity = user.lastactivity;

						console.log("protein: " + protein + " / " + user.proteinGoal);
						console.log("calories: " + activity + " / " + user.activityGoal);
						console.log("water: " + water + " / " + user.waterGoal);
						
						console.log("Fitbit Got Activities and Food");

						User.findOneAndUpdate(
							{
								encodedId: user.encodedId
							},
							{
								lastactivity: activity,
								lastprotein: protein,
								lastwater: water
							},
							null,
							function(err, user) {
								if (err) {
									console.error("Error updating user activity.", err);
								}
								callback(err, user);
							})});
			})};

function motivateUserCallback(err, user) {

	if (err) {
		console.error('motivateUserCallback error:', err);
		return;
	}

	if (previousactivity == activity) {
		console.log ("No activity since last update, bailing");
		return;
	}

	// 12 hours we're checking
	var currentTime = new Date();
	
	currentHours = currentTime.getHours();
	console.log("currentHours", currentHours);

	currentHours += 8;
	if (currentHours >= 24) {
		currentHours -= 24;
	}
	console.log("currentHours", currentHours);

	var smsBody = '';

	var checkTime = currentHours;
	var percentageCheck = checkTime * 8.25;
	var activityPercentage = user.lastactivity / user.activityGoal * 100;
	var proteinPercentage = user.lastprotein / user.proteinGoal * 100;
	var waterPercentage = user.lastwater / user.waterGoal * 100;

	console.log("checkTime", checkTime);
	console.log("Percentage Check", percentageCheck);
	console.log("Protein Percentage", proteinPercentage);
	console.log("Calorie Percentage", activityPercentage);
	smsBody = [];

	if (activityPercentage < percentageCheck) {
		var activityRemaining = user.activityGoal - user.lastactivity;

		smsBody.push(activityRemaining + ' calories to go today. ' 
			+ activityPercentage + '% of the way there!');
	}

	if (proteinPercentage < percentageCheck) {
		var proteinRemaining = user.proteinGoal - user.lastprotein;

		smsBody.push(proteinRemaining + ' grams of protein to go today. ' 
			+ proteinPercentage + '% of the way there!');
	}

	if (waterPercentage < percentageCheck) {
		var waterRemaining = user.waterGoal - user.lastwater;

		smsBody.push(waterRemaining + ' ml of water to go today. ' 
			+ waterPercentage + '% of the way there!');
	}

	smsMessage = smsBody.join('\n');

	if (proteinPercentage < percentageCheck) {
		var proteinRemaining = user.proteinGoal - user.lastprotein;
		smsBody.append += 'Log your foods! ' + proteinRemaining + ' grams of protein to go today. ' + proteinPercentage + '% of the way there!';
	} else {
		if (smsBody != '') {
			smsBody += 'Great job on the protein today! ' + user.proteinToday + ' protein so far today\n';
		}
	}

	if (smsBody != '') {
		console.log("Twilio.sendSms", user.phoneNumber, smsMessage);
		Twilio.sendSms(user.phoneNumber, smsMessage);
	}

	// Now update the philips hue with the right color.
	// First, figure out what the percentage is

	var totalPercentage = (proteinPercentage + activityPercentage + waterPercentage) / 3;
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
               consumer_key: '7fMGeCuccQGsKxap1Ho7y2Usj',
               consumer_secret: 'bFuQ29yq1dPZLdMplkXbjUiuliiooNMwAEmeFG8UoJ9mscYPNv',
               access_token: '2567964464-MNvWWWPD0gm0YaQ28tD9X0ML1885dr7TXGZkzVZ',
               access_token_secret: 'JSkyNEvcF1SdMIqNYVqueqzT2tE8RejESlGWGfsqjUkUR'	});

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
			updateUserData(data[i].ownerId, data[i].date, motivateUserCallback);
		}
	});
};

module.exports.notificationsReceived = notificationsReceived;
module.exports.updateUserData = updateUserData;	
