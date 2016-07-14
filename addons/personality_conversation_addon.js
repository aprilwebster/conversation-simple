module.exports = {

setPersonalityInsightsHelper: function(helper)
{
  personality_insights_helper = helper;
},

invokePersonality: function(twitterHandle, callback)
{
	personality_insights_helper.personalityProfile(twitterHandle, TWEET_COUNT, function (profile) {
		callback(profile);
	});
},

updateUserPersonality: function(user, personality_payload)
{
	user.personality_profile = personality_payload;
	return user;
}
};

var personality_insights_helper = null;
var personality_insights_helper = require('./personality_insights_helper');
var TWEET_COUNT = 300;
