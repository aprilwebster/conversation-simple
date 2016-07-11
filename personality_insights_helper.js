require('dotenv').config({silent: true});

var Twitter = require('twitter-node-client').Twitter;
var watson = require('watson-developer-cloud');

module.exports = function()
{

    function getPersonalityProfile (screenName, count, callback) {

    	console.log('twitter_helper: getPersonalityProfile called');
    	
    	var twitter_payload = { 
    			screen_name: screenName, 
    			count: count
    	}
    	
    	var twitter = new Twitter({
    	    "consumerKey": process.env.TWITTER_KEY,
    	    "consumerSecret": process.env.TWITTER_SECRET,
    	    "accessToken": process.env.TWITTER_TOKEN,
    	    "accessTokenSecret": process.env.TWITTER_TOKEN_SECRET,
    	    "callBackUrl": process.env.TWITTER_CALLBACK
    	});
    	 
    	var personality_insights = watson.personality_insights({
    	    url: 'https://gateway.watsonplatform.net/personality-insights/api',
    	    username: process.env.PERSONALITY_INSIGHTS_USERNAME,
    	    password: process.env.PERSONALITY_INSIGHTS_PASSWORD,  
    	    version: 'v2'
    	});


    	return twitter.getUserTimeline(twitter_payload, handleError, function(tweets) {
            personality_insights.profile(createContentItemsJson(tweets), function(err, profile) {
            	if(err){
            		console.log(new Error(err));
            		callback(null);
            	}
            	else{
            		callback(profile);
            	}
                
            })
        });
    };

    
  //Callback functions
    var handleError = function (err, response) {
        console.log('ERROR [%s]', err);
        return new Error(err);
    };  


    /**
    * Parse tweets returned from twitter's get_user_timeline endpoint, and create a contentItems object 
    * as per the requirements for input for the Watson Personality Insight's service
    */ 
    function createContentItemsJson(tweets){
        var jsonObj = JSON.parse(tweets);
       
        var keys = Object.keys(jsonObj);
     
        var contentItemsJson = {
                   "contentItems":[]
        };
     
       
        for (var i = 0; i < keys.length; i++) {
            tweet = jsonObj[i];
            var contentItem = {
                'content': tweet.text.replace(/[^(\x20-\x7F)]*/g, ""),
                'contenttype': 'text/plain',
                'created': (new Date(tweet.created_at)).getTime()/1000.0,
                'id': tweet.user.id,
                'language': tweet.lang,
                'reply': (tweet.in_reply_to_screen_name != null).toString(),
                'forward': (typeof tweet.retweeted_status != 'undefined').toString()
            }
            contentItemsJson.contentItems.push(contentItem);   
        }
     
        return contentItemsJson;
    };

    
    // Expose the getTweetsFromUserTimeline to users of the module
    return {
    	personalityProfile: getPersonalityProfile
    };
}();

