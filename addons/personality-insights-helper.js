'use strict';

require( 'dotenv' ).config( {silent: true} );

/**
 * twitter-helper is required to interface with the Twitter API to retrieve tweets (getTweetsAsync), 
 * to determine which tweets are written in English and are not retweets (englishAndNoRetweet), and to
 * convert the retrieved tweets to a contentItems object to be consumed by the Personality Insights profile 
 * function.
 */
var twitterHelper = require('./twitter-helper');
var user = require('./user');

/**
 * Create an instance of the personality insights wrapper
 * Credentials are provided in the .env file
 */
var watson = require('watson-developer-cloud');
var personalityInsights = new watson.PersonalityInsightsV2({
  version_date: '2016-08-31'
});

/**
 * Public functions for this module
 */
module.exports = {
  getPersonalityProfileAsync: getPersonalityProfileAsync,
  initPersonality: initPersonality,
  setUserPersonality: setUserPersonality
};


/**
 * 
 * @param params
 * sample params JSON object: {screen_name: 'adele', count: 20}
 * @returns
 */

function getPersonalityProfileAsync(params) {
  console.log(params);
  console.log("getPersonalityProfileAsync call.");
  //console.log(JSON.stringify(conversationPayload,2,null));
  //console.log("</conversationPayload>");

  twitterHelper.getTweetsAsync(params) //get the tweets for the user
  .then(function(tweets) {
      personalityInsights.profile({'contentItems': twitterHelper.getContentItems(tweets)},
          function(err, data) {
            var returnObject = null;
             if (err) {
              console.error(JSON.stringify(err, null, 2));
            } else {
              console.log("getPersonalityProfile in main function")
              console.log(JSON.stringify(data, null, 2));
              return data;
            }
      });
  })
  .catch(function(err) {
    console.log(JSON.stringify(err, null, 2));
  });
}


function invokePersonalityAsync(tweets) {
  console.log('getPersonalityProfileAsync');
  return new Promise(
      function(resolve, reject) {
        personalityInsights.profile({'contentItems': twitterHelper.getContentItems(tweets)},
            (err, response) => {
              if (err) {
                reject(err);
              } else {
                console.log(response);
                resolve(response);
              }
            });
      });
}


/**
 * updateUserTone processes the Tone Analyzer payload to pull out the emotion, language and social
 * tones, and identify the meaningful tones (i.e., those tones that meet the specified thresholds).
 * The conversationPayload json object is updated to include these tones.
 * @param {Json} conversationPayload json object returned by the Watson Conversation Service
 * @param {Json} toneAnalyzerPayload json object returned by the Watson Tone Analyzer Service
 * @param {boolean} maintainHistory set history for each user turn in the  history context variable
 * @returns {void}
 */
function setUserPersonality(conversationPayload, personalityInsightsPayload) {
  var personality = null;
  var conscientiousness = null;
  var neuroticism = null; 
  var self_discipline = null;
  var immoderation = null;
  var dutifulness = null;

  console.log('setUserPersonality');
  //console.log(conversationPayload);
  //console.log(conversationPayload.context);
  
  conversationPayload.context.user.personality = initPersonality();
  
  
  var tree = personalityInsightsPayload.tree.children;

  personalityInsightsPayload.tree.children.forEach(
      function(category) {
        if (category.id === "personality") {
          personality = category;
        }
      });

  personality.children[0].children.forEach(
      function(facet) {
        //console.log(facet);
        if (facet.id === "Neuroticism") {
          neuroticism = facet;
        }
        if (facet.id === "Conscientiousness") {
          conscientiousness = facet;
        }
      });

  neuroticism.children.forEach(
      function(facet) {
        if (facet.id === "Immoderation") {
          immoderation = facet;
        }
      });

  conscientiousness.children.forEach(
      function(facet) {
        if (facet.id === "Self-discipline") {
          self_discipline = facet;
        }
        if (facet.id === "Dutifulness") {
          dutifulness = facet;
        }
      });

  conversationPayload.context.user.personality.neuroticism = neuroticism.percentage;
  conversationPayload.context.user.personality.conscientiousness = conscientiousness.percentage;
  conversationPayload.context.user.personality.dutifulness = dutifulness.percentage;
  conversationPayload.context.user.personality.immoderation = immoderation.percentage;
  conversationPayload.context.user.personality.self_discipline = self_discipline.percentage;
  //console.log(JSON.stringify(conversationPayload,2, null));
  
  return conversationPayload;
  /*
  console.log(neuroticism.id, neuroticism.percentage);
  console.log(conscientiousness.id,conscientiousness.percentage);
  console.log(immoderation.id, immoderation.percentage);
  console.log(self_discipline.id, self_discipline.percentage);
  console.log(dutifulness.id, dutifulness.percentage);
  */

}

function initPersonality() {
  return (
    {
      
      'conscientiousness': null,
      'immoderation': null,
      'dutifulness': null,
      'neuroticism': null,
      'self_discipline': null
    });
}

