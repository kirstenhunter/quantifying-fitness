var fs = require('fs'),
	OAuth = require('oauth'),
	mongoose = require('mongoose'),
	User = mongoose.model('User'),
	Twilio = require('./twilio-api'),
	Hue    = require('./philips-api'),
	moment = require('moment'),
	env = process.env.NODE_ENV || 'production',
	config = require('../config')[env];

var oauth = new OAuth.OAuth(
	'https://api.fitbit.com/oauth/request_token',
	'https://api.fitbit.com/oauth/access_token',
	config.fitbitClientKey,
	config.fitbitClientSecret,
	'1.0',
	null,
	'HMAC-SHA1'
);

function updateUserSteps(encodedId, callback) {
	console.log("updateUserSteps for", encodedId);

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
			oauth.get(
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
							callback(err, user);
						}
					);
				}
			);
		}
	);
};

function updateUserFoods(encodedId, callback) {
        console.log("updateUserSteps for", encodedId);

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
                        oauth.get(
                                'https://api.fitbit.com/1/user/-/foods/date/' + moment().utc().add('ms', user.timezoneOffset).format('YYYY-MM-DD') + '.json',
                                user.accessToken,
                                user.accessSecret,
                                function (err, data, res) {
                                        if (err) {
                                                console.error("Error fetching activity data. ", err);
                                                callback(err);
                                                return;
                                        }

                                        data = JSON.parse(data);
                                        console.log("Fitbit Get Activities", data);

                                        // Update (and return) the user
                                        User.findOneAndUpdate(
                                                {
                                                        encodedId: user.encodedId
                                                },
                                                {
                                                        proteinToday: data.summary.protein,
                                                        fiberToday: data.summary.fiber
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

function updateLightsCallback(err, user) {
	if (err) {
		console.error('updateLightsCallback error:', err);
		return;
	}

	var smsBody = '';

	console.log("Hue.updateLights", user.proteinToday, user.fiberToday);
 	Hue.updateLights(2,user.proteinToday, 80);
 	Hue.updateLights(3,user.fiberToday, 20);
}

function motivateUserCallback(err, user) {
        if (err) {
                console.error('motivateUserCallback error:', err);
                return;
        }

        var smsBody = '';

        if (user.stepsToday > user.stepsGoal) {
                smsBody = 'Overachiever! You are ' + (user.stepsToday - user.stepsGoal) + ' over your daily goal of ' + user.stepsGoal + ' steps!';
        } else {
                var stepsRemaining = user.stepsGoal - user.stepsToday;

                smsBody = 'Keep it up! ' + stepsRemaining + ' to go today.';
        }

        console.log("Twilio.sendSms", user.phoneNumber, smsBody);
        Twilio.sendSms(user.phoneNumber, smsBody);
	console.log("Hue.updateLights", user.stepsToday, user.stepsGoal);
        Hue.updateLights(1,user.stepsToday/user.stepsGoal);
}

function notificationsReceived(req, res) {
	// Immediately send HTTP 204 No Content
	res.send(204);

	// TODO: Verify req.headers['x-fitbit-signature'] to ensure it's Fitbit

	fs.readFile(req.files.updates.path, {encoding: 'utf8'}, function (err, data) {
		if (err) console.error(err);
		data = JSON.parse(data);

		for (var i = 0; i < data.length; i++) {
			console.log(data[i]);
			updateUserSteps(data[i].ownerId, motivateUserCallback);
			updateUserFoods(data[i].ownerId, updateLightsCallback);
		}
	});
};

module.exports.notificationsReceived = notificationsReceived;

module.exports.updateUserSteps = updateUserSteps;
