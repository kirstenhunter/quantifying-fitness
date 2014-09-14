var env = process.env.NODE_ENV || 'production',
	config = require('../config')[env],
	Twilio = require('twilio')(config.twilioAccountSid, config.twilioAuthToken);

module.exports.sendSms = function(to, message) {
	Twilio.sendMessage(
		{
	 		to: to,
			from: config.twilioPhoneNumber,
			body: message
		},
		function(err, responseData) {
			if (err) {
				console.error("Error sending SMS:", err);
			} else {
				console.log("SMS sent:", to, message);
			}
		}
	);
};
