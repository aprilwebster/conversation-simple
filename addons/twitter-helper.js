
'use strict';
require( 'dotenv' ).config( {silent: true} );

var Promise = require('bluebird');


var watson = require('watson-developer-cloud');
var personalityInsights = new watson.PersonalityInsightsV2({
  version_date: '2016-08-31'
});


var Twitter = require('twitter');
var twitter = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});
 
var params = {screen_name: 'adele', count: 2};

/**
 * Public functions for this module
 */
module.exports = {
  getTweetsAsync: getTweetsAsync,
  getContentItems: getContentItems
};

function getTweetsAsync(params) {
  return new Promise(
      function(resolve, reject) {
        twitter.get(
            'statuses/user_timeline', params,
            (error, tweets, response) => {
              if (error) {
                reject(error);
              } else {
                resolve(tweets);
              }
            });
      });
}

function getContentItems(tweets){
  var contentItems = [];
  for (var i = 0, len = tweets.length; i < len; i++) {
    if(englishAndNoRetweet(tweets[i])){
      contentItems = contentItems.concat(toContentItem(tweets[i]));
    }
  }
  return contentItems;
}

function toContentItem(tweet) {
  return {
    id: tweet.id_str,
    userid: tweet.user.id_str,
    sourceid: 'twitter',
    language: 'en',
    contenttype: 'text/plain',
    content: tweet.text.replace('[^(\\x20-\\x7F)]*',''),
    created: Date.parse(tweet.created_at)
  };
}

/**
 * @return {boolean} True if tweet is not a re-tweet or not in english
 * source: yourcelebritymatch
 */
function englishAndNoRetweet(tweet) {
  return tweet.lang === 'en' && !tweet.retweeted;
};

