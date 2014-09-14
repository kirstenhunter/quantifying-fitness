var env = process.env.NODE_ENV || 'production',
	config = require('../config')[env],
	hue = require("node-hue-api"), HueApi = hue.HueApi, lightState = hue.lightState; 

var user = '20e735514fe29773a27f3857d377ab'
var api;

var getSummary = function(bridge) {
    console.log(JSON.stringify(bridge));
    var hostname = bridge[0].ipaddress;
    console.log(bridge[0].ipaddress);
    var username = user;

    api = new HueApi(hostname, username);
    changeColors(light, today, goal);
};

var changeColors = function(light,today,goal) {
    huenumber = today/goal*140;
    state = lightState.create().on().hsl(huenumber, 100, 50)
    	api.setLightState(light, state)
	    .then(displayResult)
	    .done();
};

var displayResult = function(result) {
    console.log(JSON.stringify(result, null, 2));
};

module.exports.updateLights = function(light, today, goal) {
	hue.locateBridges().then(getSummary).done();
};
