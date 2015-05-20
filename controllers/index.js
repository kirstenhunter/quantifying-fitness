var env = process.env.NODE_ENV || 'production',
	config = require('../config')[env];

var mongoose = require('mongoose'),
	User = mongoose.model('User');

// Index page that asks the user to sign in with Fitbit
module.exports.index = function(req, res) {
	res.render('../views/index.ejs');
}

// Page where a user can enter their cell phone number after signing in
module.exports.showUser = function(req, res) {
	// Retrieve the user's information from the session
	User.find().where('encodedId').equals(req.session.passport.user.id).findOne(
		function(err, user) {
			if (err) {
				res.send(500);
				return;
			}

			// Pass the user's info to the template
			res.render('../views/phone.ejs', {
				phoneNumber: user.phoneNumber,
				message: ''
			});
		}
	);
}

// POST version of showUsers page. Where the form on the showUser page submits to.
module.exports.saveUser = function(req, res) {
	// Save the user's cell phone number
	User.findOneAndUpdate(
		{
			encodedId: req.session.passport.user.id
		},
		{
			phoneNumber: req.body.phoneNumber
		},
		null,
		function(err, user) {
			if (err) {
				res.send(500);
				return;
			}

			// Display the phone number and confirmation message
			res.render('../views/phone.ejs', {
				phoneNumber: user.phoneNumber,
				message: "Cell phone number saved!"
			});
		}
	);
}