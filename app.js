/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

require( 'dotenv' ).config( {silent: true} );

var express = require( 'express' );  // app server
var bodyParser = require( 'body-parser' );  // parser for post requests

// The following requires are needed for logging purposes
var uuid = require( 'uuid' );
var vcapServices = require( 'vcap_services' );
var basicAuth = require( 'basic-auth-connect' );

// The app owner may optionally configure a cloudant db to track user input. Application will operate without cloudant.
// If logging is enabled the app must also enable basic auth to secure logging endpoints
var cloudantCredentials = vcapServices.getCredentials( 'cloudantNoSQLDB' );
var cloudantUrl = null;
if ( cloudantCredentials ) {
  cloudantUrl = cloudantCredentials.url;
}
cloudantUrl = cloudantUrl || process.env.CLOUDANT_URL; // || '<cloudant_url>';
var logs = null;

// define the application
var app = express();

// Bootstrap application settings
app.use( express.static( './public' ) ); // load UI from public folder
app.use( bodyParser.json() );

// Watson service requirements
var watson = require('watson-developer-cloud');
var toneDetection = require('./addons/tone_detection.js'); // required for tone detection
var maintainToneHistory = false;
var personalityInsightsHelper = require('./addons/personality-insights-helper');
var twitterHelper = require('./addons/twitter-helper');
var user = require('./addons/user');


/**
 * Instantiate the Watson Conversation Service as per WDC 2.2.0
 */
var conversation = new watson.ConversationV1({
  version_date: '2016-07-11'
});


/****** TONE INTEGRATION ******/
// Instantiate the Watson Tone Analyzer Service as per WDC 2.2.0
var toneAnalyzer =  new watson.ToneAnalyzerV3({
  version_date: '2016-05-19'
});


var personalityInsights = new watson.PersonalityInsightsV2({
  version_date: '2016-08-31'
});


// Endpoint to be called from the client side
app.post( '/api/message', function(req, res) {
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if ( !workspace || workspace === '<workspace-id>' ) {
    return res.json( {
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' +
        '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' +
        'Once a workspace has been defined the intents may be imported from ' +
        '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    } );
  }
  var conversationRequestPayload = {
    workspace_id: workspace,
    context: {},
    input: {}
  };

  // pull input and context from the UI request if it exists
  if ( req.body ) {
    if ( req.body.input ) {
      conversationRequestPayload.input = req.body.input;
    }
    if ( req.body.context ) {
      conversationRequestPayload.context = req.body.context; //must maintain the context from the request
      /*
      if ( req.body.context.user ){
        console.log("testing");
      }
      */
    } else {
      // Add the user object (containing tone) to the context object for Conversation
      conversationRequestPayload.context = toneDetection.initUser();

    }

    // Invoke the tone-aware call to the Conversation Service
    //invokeToneConversation(responsePayload, res);

    invokePersonalizedConversation(conversationRequestPayload, res);
    }
});

/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Conversation service
 * @param  {Object} response The response from the Conversation service
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response) {
  var responseText = null;
  var id = null;

  if ( !response.output ) {
    response.output = {
        "text": null
    };
  } else {
    if ( logs ) {
      // If the logs db is set, then we want to record all input and responses
      id = uuid.v4();
      logs.insert( {'_id': id, 'request': input, 'response': response, 'time': new Date()});
    }
    console.log(JSON.stringify(response,null,2));
  }

  return response;
}

/**
 * @author April Webster
 * @returns {Object} return response from conversation service
 * invokeToneConversation calls the invokeToneAsync function to get the tone information for the user's
 * input text (input.text in the payload json object), adds/updates the user's tone in the payload's context,
 * and sends the payload to the conversation service to get a response which is printed to screen.
 * @param {Json} payload a json object containing the basic information needed to converse with the Conversation Service's
 *        message endpoint.
 * @param {Object} res response object
 *
 */
/*
function invokeToneConversation(payload, res) {
  console.log("invokeToneConversation");
  toneDetection.invokeToneAsync(payload, toneAnalyzer)
  .then( (tone) => {
    toneDetection.updateUserTone(payload, tone, maintainToneHistory);
    conversation.message(payload, function(err, data) {
      var returnObject = null;
      if (err) {
        console.error(JSON.stringify(err, null, 2));
        returnObject = res.status(err.code || 500).json(err);
      } else {
        
        if( data.context.user.twitter_handle && !data.context.user.personality){
          console.log("There's a twitter handle: " + data.context.user.twitter_handle + " but no personality!");
          //var test = personalityInsightsHelper.getPersonalityProfileAsync({screen_name: data.context.user.twitter_handle, count: 20});
          //personalityInsightsHelper.setUserPersonality(payload, personality);
          //console.log('this is the output from getPersonalityProfileAsync');
          //console.log(test);
          //console.log('AFTER output from getPersonalityProfileAsync');
        }
        
        console.log("no twitter handle");
        returnObject = res.json( updateMessage( payload, data ) );
      }
      return returnObject;
    });
  })
  .catch(function(err) {
    console.log(JSON.stringify(err, null, 2));
  });
}
*/

function invokePersonalizedConversation(conversationRequestPayload, res) {
  toneDetection.invokeToneAsync(conversationRequestPayload, toneAnalyzer)
  .then( (tone) => {
    toneDetection.updateUserTone(conversationRequestPayload, tone, maintainToneHistory);
    conversation.message(conversationRequestPayload, function(err, conversationResponsePayload) {
      var returnObject = null;
      if (err) {
        returnObject = res.status(err.code || 500).json(err);
        console.log("ERROR");
      } else {

        // Add personality to the user object of the Watson Conversation context object, if the user has provided a twitter handle
        // and there isn't yet a personality object in the user object
        if( conversationResponsePayload.context.user.twitter_handle && !conversationResponsePayload.context.user.personality){
          twitterHelper.getTweetsAsync({screen_name: conversationResponsePayload.context.user.twitter_handle, count: 20}) 
          .then( (tweets) => {
              personalityInsights.profile(
                  {'contentItems': twitterHelper.getContentItems(tweets)},
                  function(err, profile) {
                    var returnObject = null;
                    if (err) {
                      returnObject = res.status(err.code || 500).json(err);
                    } else {
                      var updatedPayload = personalityInsightsHelper.setUserPersonality(conversationResponsePayload, profile);
                      returnObject = res.json( updatedPayload );
                    }
                  }
              );
           })
        }else{
          returnObject = res.json( conversationResponsePayload );
        }
      }
      return returnObject;
      });
    })
    .catch(function(err) {
      console.log(JSON.stringify(err, null, 2));
    });
}



/**
 * Enable logging
 * Must add an instance of the Cloudant NoSQL DB to the application in BlueMix and add
 * the Cloudant credentials to the application's user-defined Environment Variables.
 */
if ( cloudantUrl ) {
  // If logging has been enabled (as signalled by the presence of the cloudantUrl) then the
  // app developer must also specify a LOG_USER and LOG_PASS env vars.
  if ( !process.env.LOG_USER || !process.env.LOG_PASS ) {
    throw new Error( 'LOG_USER OR LOG_PASS not defined, both required to enable logging!' );
  }
  // add basic auth to the endpoints to retrieve the logs!
  var auth = basicAuth( process.env.LOG_USER, process.env.LOG_PASS );
  // If the cloudantUrl has been configured then we will want to set up a nano client
  var nano = require( 'nano' )( cloudantUrl );
  // add a new API which allows us to retrieve the logs (note this is not secure)
  nano.db.get( 'food_coach', function(err) {
    if ( err ) {
      console.error(err);
      nano.db.create( 'food_coach', function(errCreate) {
        console.error(errCreate);
        logs = nano.db.use( 'food_coach' );
      } );
    } else {
      logs = nano.db.use( 'food_coach' );
    }
  } );

  // Endpoint which allows deletion of db
  app.post( '/clearDb', auth, function(req, res) {
    nano.db.destroy( 'food_coach', function() {
      nano.db.create( 'food_coach', function() {
        logs = nano.db.use( 'food_coach' );
      } );
    } );
    return res.json( {'message': 'Clearing db'} );
  } );

  // Endpoint which allows conversation logs to be fetched
  // csv - user input, conversation_id, timestamp

  app.get( '/chats', auth, function(req, res) {
    logs.list( {include_docs: true, 'descending': true}, function(err, body) {
      console.error(err);
      // download as CSV
      var csv = [];
      csv.push( ['Id', 'Question', 'Intent', 'Confidence', 'Entity', 'Emotion', 'Output', 'Time'] );
      body.rows.sort( function(a, b) {
        if ( a && b && a.doc && b.doc ) {
          var date1 = new Date( a.doc.time );
          var date2 = new Date( b.doc.time );
          var t1 = date1.getTime();
          var t2 = date2.getTime();
          var aGreaterThanB = t1 > t2;
          var equal = t1 === t2;
          if (aGreaterThanB) {
            return 1;
          }
          return  equal ? 0 : -1;
        }
      } );
      body.rows.forEach( function(row) {
        var question = '';
        var intent = '';
        var confidence = 0;
        var time = '';
        var entity = '';
        var outputText = '';
        var emotion = '';
        var id = '';

        if ( row.doc ) {
          var doc = row.doc;
          if ( doc.response.context ) {
            id = doc.response.context.conversation_id;
          }

          if ( doc.response.context && doc.response.context.user ) {
            emotion = doc.response.context.user.tone.emotion.current;
          }

          if ( doc.request && doc.request.input ) {
            question = doc.request.input.text;
          }
          if ( doc.response ) {
            intent = '<no intent>';
            if ( doc.response.intents && doc.response.intents.length > 0 ) {
              intent = doc.response.intents[0].intent;
              confidence = doc.response.intents[0].confidence;
            }
            entity = '<no entity>';
            if ( doc.response.entities && doc.response.entities.length > 0 ) {
              entity = doc.response.entities[0].entity + ' : ' + doc.response.entities[0].value;
            }
            outputText = '<no dialog>';
            if ( doc.response.output && doc.response.output.text ) {
              outputText = doc.response.output.text.join( ' ' );
            }
          }
          time = new Date( doc.time ).toLocaleString();
        }
        csv.push( [id, question, intent, confidence, entity, emotion, outputText, time] );
      } );
      res.json( csv );
    } );
  } );
}


module.exports = app;

