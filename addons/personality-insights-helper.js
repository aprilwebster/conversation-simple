'use strict';

require( 'dotenv' ).config( {silent: true} );

var twitterHelper = require('./twitter-helper');

var watson = require('watson-developer-cloud');
var personalityInsights = new watson.PersonalityInsightsV2({
  version_date: '2016-08-31'
});

/**
 * Public functions for this module
 */
module.exports = {
  getPersonalityProfileAsync: getPersonalityProfileAsync
};


function getPersonalityProfileAsync(params) {
  console.log(params);
  twitterHelper.getTweetsAsync(params)
  .then(function(tweets) {
      personalityInsights.profile({'contentItems': twitterHelper.getContentItems(tweets)},
          function(err, data) {
            var returnObject = null;
             if (err) {
              console.error(JSON.stringify(err, null, 2));
              
            } else {
              console.log(JSON.stringify(data, null, 2));
              return data;
            }
      });
  })
  .catch(function(err) {
    console.log(JSON.stringify(err, null, 2));
  });
}

/*
function getPersonalityProfile(params) {
  twitterHelper.getTweetsAsync(params)
  .then(function(tweets) {
      personalityInsights.profile({'contentItems': twitterHelper.getContentItems(tweets)},
          function(err, data) {
            var returnObject = null;
             if (err) {
              console.error(JSON.stringify(err, null, 2));
              
            } else {
              console.log(JSON.stringify(data, null, 2));
              return data;
            }
      });
  });
}

function invokePersonalityInsightsAsync(params) {
  if (!conversationPayload.input || !conversationPayload.input.text) conversationPayload.input.text = ' ';
  return new Promise(
      function(resolve, reject) {
        toneAnalyzer.tone(
            {text: conversationPayload.input.text},
            (error, data) => {
              if (error) {
                reject(error);
              } else {
                resolve(data);
              }
            });
      });
}
*/

