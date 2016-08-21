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
var watson = require( 'watson-developer-cloud' );  // watson sdk

/**aw**/
require('json-query');
var extend = require('extend');  // app server
/**end aw**/

// The following requires are needed for logging purposes
var uuid = require( 'uuid' );
var vcapServices = require( 'vcap_services' );
var basicAuth = require( 'basic-auth-connect' );
//var nodeSdk = require('../node-sdk');

var tone_detection = require(../node-sdk/tone_detection.js");

/**aw**/
var tone_conversation_addon = require("./addons/tone_conversation_detection_addon.js");
var tone_conversation_expression = require("./addons/tone_conversation_expression_addon.js");
var personality_addon = require("./addons/personality_conversation_addon.js");
/**end aw**/

// The app owner may optionally configure a cloudand db to track user input.
// This cloudand db is not required, the app will operate without it.
// If logging is enabled the app must also enable basic auth to secure logging
// endpoints
var cloudantCredentials = vcapServices.getCredentials( 'cloudantNoSQLDB' );
var cloudantUrl = null;
if ( cloudantCredentials ) {
  cloudantUrl = cloudantCredentials.url;
}
cloudantUrl = cloudantUrl || process.env.CLOUDANT_URL; // || '<cloudant_url>';
var logs = null;
var app = express();

// Bootstrap application settings
app.use( express.static( './public' ) ); // load UI from public folder
app.use( bodyParser.json() );



// Create the conversation service wrapper
var conversation = watson.conversation( {
  url: 'https://gateway.watsonplatform.net/conversation/api',
  username: process.env.CONVERSATION_USERNAME || '<username>',
  password: process.env.CONVERSATION_PASSWORD || '<password>',
  version_date: '2016-07-01',
  version: 'v1',
} );

//Create the tone_analyzer service wrapper
var tone_analyzer = watson.tone_analyzer({
	url: 'https://gateway.watsonplatform.net/tone-analyzer/api',
	username: process.env.TONE_ANALYZER_USERNAME,
	password: process.env.TONE_ANALYZER_PASSWORD,  
	version_date: '2016-05-19',
	version: 'v3'
});


var USER_TWITTER_HANDLE = 'adele';


// message endpoint to converse with the Watson Conversation Service
app.post( '/api/message', function(req, res) {

	
	
	

	// Extract the input and context from the request, and add it to the payload to be sent to the 
	// conversation service
	if (req.body) {

		// INPUT - check for input in the body of the request 
		if (req.body.input) {
			conversation_payload.input = req.body.input;
		}else{
			return new Error('Error: no input provided in request.');
		}
		
		// INPUT - user's input text is whitespace - no intent provided
		if (!(req.body.input.text).trim().length){
			return res.json({'output': {'text': 'No input has been provided.  Please state your intent.'}});
		}
		
		// CONTEXT - context/state maintained by client app
		if (req.body.context) { 		
			conversation_payload.context = req.body.context;				
			
			// USER - if there is no user in the context, initialize one and add to the context
			if(typeof req.body.context.user == 'undefined'){
				var emptyUser = tone_conversation_addon.initToneContext(tone_analyzer);
				conversation_payload.context = extend(conversation_payload.context, { emptyUser });
				invokeAddOns_PersonalityAndTone(conversation_payload,req,res);
	
		}
		else {
			invokeAddOns_Tone(conversation_payload,req,res);
		}
              } 
		// If there is no context, create it and add a user object to it
		else {
			conversation_payload.context = tone_conversation_addon.initToneContext(tone_analyzer);
			invokeAddOns_PersonalityAndTone(conversation_payload,req,res);
		}	

	
	}
});
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

/*// Payload object to send to the Watson Conversation Service
  // workspace_id is the identifier for the workspace containing the dialog (nodes) for this application
  // input is what the user of the web app 'said'
  // context contains both client state (e.g., current_tone, tone_history, etc) and Conversation service state
  var conversation_payload = {
      workspace_id: workspace
};
*/

  var payload = {
    workspace_id: workspace,
    context: {},
    input: {}
  };
  if ( req.body ) {
    if ( req.body.input ) {
      payload.input = req.body.input;
    }
    if ( req.body.context ) {
      // The client must maintain context/state
      payload.context = req.body.context;
    }
  }
  // Send the input to the conversation service
  conversation.message( payload, function(err, data) {
    if ( err ) {
      return res.status( err.code || 500 ).json( err );
    }
    return res.json( updateMessage( payload, data ) );
  } );
} );


function invokeToneConversation(payload)
{
  tone_detection.invokeToneAsync(payload,tone_analyzer)
  .then( (tone) => {
    tone_detection.updateUserTone(payload, tone);
    conversation.message(payload, function(err, data) {
      if (err) {
        // APPLICATION-SPECIFIC CODE TO PROCESS THE ERROR
        // FROM CONVERSATION SERVICE
        console.error(JSON.stringify(err, null, 2));
      }
      else {
        // APPLICATION-SPECIFIC CODE TO PROCESS THE DATA
        // FROM CONVERSATION SERVICE
        console.log(JSON.stringify(data, null, 2));
      }
    });
  })
  .catch(function(err){
    console.log(JSON.stringify(err, null, 2));
  })
}


/*

function invokeAddOns_Tone(conversation_payload,req,res)
{
			tone_conversation_addon.invokeTone(req.body.input.text, 
					function(tone_payload){
						tone_conversation_addon.updateUserTone(conversation_payload.context.user, tone_payload);

						// Send the input to the conversation service
						conversation.message(conversation_payload, function(err, data) {
							if (err) {
								return res.status(err.code || 500).json(err);
							}
							return res.json(tone_conversation_expression.personalizeMessage(data));
						});
				});

*/


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
    response.output = {};
  } else {
    if ( logs ) {
      // If the logs db is set, then we want to record all input and responses
      id = uuid.v4();
      logs.insert( {'_id': id, 'request': input, 'response': response, 'time': new Date()});
    }
    return response;
  }
  if ( response.intents && response.intents[0] ) {
    var intent = response.intents[0];
    // Depending on the confidence of the response the app can return different messages.
    // The confidence will vary depending on how well the system is trained. The service will always try to assign
    // a class/intent to the input. If the confidence is low, then it suggests the service is unsure of the
    // user's intent . In these cases it is usually best to return a disambiguation message
    // ('I did not understand your intent, please rephrase your question', etc..)
    if ( intent.confidence >= 0.75 ) {
      responseText = 'I understood your intent was ' + intent.intent;
    } else if ( intent.confidence >= 0.5 ) {
      responseText = 'I think your intent was ' + intent.intent;
    } else {
      responseText = 'I did not understand your intent';
    }
  }
  response.output.text = responseText;
  if ( logs ) {
    // If the logs db is set, then we want to record all input and responses
    id = uuid.v4();
    logs.insert( {'_id': id, 'request': input, 'response': response, 'time': new Date()});
  }
  return response;
}





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
  nano.db.get( 'car_logs', function(err) {
    if ( err ) {
      console.error(err);
      nano.db.create( 'car_logs', function(errCreate) {
        console.error(errCreate);
        logs = nano.db.use( 'car_logs' );
      } );
    } else {
      logs = nano.db.use( 'car_logs' );
    }
  } );

  // Endpoint which allows deletion of db
  app.post( '/clearDb', auth, function(req, res) {
    nano.db.destroy( 'car_logs', function() {
      nano.db.create( 'car_logs', function() {
        logs = nano.db.use( 'car_logs' );
      } );
    } );
    return res.json( {'message': 'Clearing db'} );
  } );

  // Endpoint which allows conversation logs to be fetched
  app.get( '/chats', auth, function(req, res) {
    logs.list( {include_docs: true, 'descending': true}, function(err, body) {
      console.error(err);
      // download as CSV
      var csv = [];
      csv.push( ['Question', 'Intent', 'Confidence', 'Entity', 'Output', 'Time'] );
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
        if ( row.doc ) {
          var doc = row.doc;
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
        csv.push( [question, intent, confidence, entity, outputText, time] );
      } );
      res.csv( csv );
    } );
  } );
}

module.exports = app;
