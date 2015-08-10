var env = process.env.NODE_ENV || 'production',
	config = require('./config')[env];

var express = require('express'),
	http = require('http'),
	path = require('path'),
	OAuth = require('oauth'),
	passport = require('passport'),
	mongoose = require('mongoose');

var app = express();

// All environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('TODO Random String: Fitbit is awesome!'));
app.use(express.session());
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// Development Environment
if ('development' == app.get('env')) {
	app.use(express.errorHandler());
}

// Connect to database and initialize model
mongoose.connect(config.db);
require('./models/user');

// Initialize controllers
var IndexController = require('./controllers/index'),
	FitbitAuthController = require('./controllers/fitbit-auth'),
	FitbitApiController = require('./controllers/fitbit-api'),
	TwilioApiController = require('./controllers/twilio-api');

// Define routes
// Index and Notification routes
app.get('/', IndexController.index);
app.get('/userinfo', IndexController.showUser);
app.post('/userinfo', IndexController.saveUser);
app.post('/notifications', FitbitApiController.notificationsReceived);
// OAuth routes
app.get('/auth/fitbit', passport.authenticate('fitbit'));
app.get('/auth/fitbit/callback', passport.authenticate('fitbit', { failureRedirect: '/?error=auth_failed' }),
	function(req, res) {
		// Successful authentication, redirect home.
		res.redirect('/userinfo');
	}
);

// Start the server
http.createServer(app).listen(app.get('port'), function(){
	console.log('Express server listening on port ' + app.get('port'));
});