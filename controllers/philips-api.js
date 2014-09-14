var env = process.env.NODE_ENV || 'production',
	config = require('../config')[env];
var HueRemote = require('node-hue-remote');

var hue = new HueRemote({
  'account' : {
    'email': 'synedra@gmail.com',
    'password': '3urfew'
  }
});

var api;

var displayResult = function(result) {
    console.log(JSON.stringify(result, null, 2));
};

var displayError = function(err) {
    console.log(err);
};

module.exports.updateLights = function(light, today, goal) {
	hue.sendCommand({

	  	'url' : '/api/0/lights/' + light + '/state',
  		'method' : 'PUT',
  		'body' : {
  		  'bri' : '255',
		  'hue' : 36210 * today/goal
  		}
}, function (error, sessionId, bridgeId, accessToken, body) {
  var response = JSON.parse(body);
  if (error || (response.result !== 'ok')) {
    throw new Error(error || body);
  }
  // save to cache.
  hue.setSessionId(sessionId);
  hue.setBridgeId(bridgeId);
  hue.setAccessToken(accessToken);
})};

