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

require('dotenv').config({silent: true});

var extend = require('extend');  // app server
var express = require('express');  // app server
var bodyParser = require('body-parser');  // parser for post requests
var watson = require('watson-developer-cloud');  // watson sdk
var nodeSdk = require('../node-sdk');  

var app = express();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());


// Create the service wrapper
//var conversation = watson.conversation({  // Using watson-developer-cloud
var conversation = nodeSdk.conversation({	// Using local nodeSdk
  url: 'https://gateway.watsonplatform.net/conversation-experimental/api',
  username: process.env.CONVERSATION_USERNAME || '<username>',
  password: process.env.CONVERSATION_PASSWORD || '<password>',
  version_date: '2016-05-19',
  version: 'v1-experimental',
});


//Create the tone_analyzer service wrapper
var tone_analyzer = watson.tone_analyzer({
	url: 'https://gateway.watsonplatform.net/tone-analyzer/api',
	username: process.env.TONE_ANALYZER_USERNAME, //'8ab73753-faeb-42f5-96ad-604b5b1c146e'
	password: process.env.TONE_ANALYZER_PASSWORD,  //'1VRWJmmypy15'
	version_date: '2016-05-19',
	version: 'v3'
});


// message endpoint to be called from the client side
app.post('/api/message', function(req, res) {
	var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
	  	if (!workspace || workspace === '<workspace-id>') {
	  		return res.json({'output': {'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' +
	  			'<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' +
	  			'Once a workspace has been defined the intents may be imported from ' +
	  			'<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_intents.csv">here</a> in order to get a working application.'}});
	  	}
	  
	// Payload object to send to the dialog interpreter
	// workspace_id is the identifier for the workspace containing the dialog (nodes) for this application
	// context contains both client state (e.g., current_tone, tone_history, etc) and dialog service state
	var conversation_payload = {
		workspace_id: workspace,
		//context: {}
		/*
		
		context: {
			user: {
				current_emotion: null,
				emotion_history: []
			}
		}
		*/
	};
	

	// Add the input and context to the payload
	if (req.body) {
		
		console.log('app.post: the request has a body.  This should be called!');
		
		// INPUT - check for input in the body of the request; this is required to converse with the conversation service 
		if (req.body.input) {
			console.log('app.post: the request has input.  This should be called!');
			conversation_payload.input = req.body.input;
		}else{
			console.log('ERROR - no input');
			return res.json({'output': {'text': 'No input has been provided.  Please state your intent.'}});
		}
		

		// CONTEXT - check for context in the body of the request; this should be the context for the conversation payload!
		if (req.body.context) { // The client must maintain context/state
			console.log('app.post: the request body has a context.  This will not be called with first user input!');	
			
			// Add the request context to the conversation_payload
			conversation_payload.context = req.body.context;
			
			// USER - if there is not user, initialize this object in the context
			if(typeof req.body.context.user == 'undefined'){
				console.log('app.post: user is undefined.  Add empty user to context');
				conversation_payload.context = extend(conversation_payload.context, {
					user: {
						current_emotion: null,
						emotion_history: []
					}
				});
				console.log('app.post: user should be defined at this point: ' + JSON.stringify(conversation_payload.context,2,null));
				
			}else{ //USER exists
				// EMOTION_HISTORY - initialize it if it doesn't exist in the user
				if(typeof req.body.context.user.emotion_history == 'undefined'){
					console.log('app.post: emotion_history is undefined.  Add it to context.user');
					user.emotion_history = [];  
				}
			}
		} else{
			console.log('app.post: the request has no context.  Add an empty user to the conversation_payload.');
			console.log('app.post: conversation_payload is ' + JSON.stringify(conversation));
			
			var user = {
				user: {
					current_emotion: null,
					emotion_history: []
				}
			}
			conversation_payload.context = user;
			
			console.log('app.post: the request has no context.  Conversation_payload is now: ' + JSON.stringify(conversation_payload,2,null));
		}
		
			
		console.log('app.post: user is ' + JSON.stringify(user,2,null));
		console.log('app.post: context before adding user to payload is ' + JSON.stringify(conversation_payload.context,2,null));
			
			
		// this is NOT working!!
		conversation_payload.context = extend(conversation_payload.context,{
			user: user
		});
			
		console.log('app.post: context after adding user to payload is ' + JSON.stringify(conversation_payload.context,2,null));
		
	}
  
	// Pull the user input from the body of the request - this is the text that will be analyzed by 
	// the dialog service to determine its intent and the appropriate response
	var input = req.body.input;

	invokeTone(req.body.input.text, 
		//function(err, data){	
		function(data){
		// after invokeTone returns a primary_emotion (err or data), this function needs to be called to add
		// the primary_emotion to the payload.context

			/*
			if(err){
				console.log(err);
				data = "No emotion was returned by tone_analyzer.";
			}
			*/
			
			var emotion_history = conversation_payload.context.user.emotion_history;
			if(typeof conversation_payload.context.user.emotion_history == 'undefined'){
				emotion_history = [data];
			}else{
				conversation_payload.context.user.emotion_history.push(data);
			}
			
			conversation_payload.context.user = extend(conversation_payload.context.user, {
				current_emotion: data,
				emotion_history: emotion_history
			})
			console.log('app.post.invokeTone: conversation_payload is ' + JSON.stringify(conversation_payload,null,2));
	
			// Send the input to the conversation service
			conversation.message(conversation_payload, function(err, data) {
				if (err) {
					return res.status(err.code || 500).json(err);
				}
				return res.json(updateMessage(data));
			});
	});	

});

/**
 * invokeTone calls the tone_analyzer.tone function to get the tone, and calls the callback function on the primary_emotion
 * @param text
 * @param callback
 */
function invokeTone(text, callback)
{
	var tone_analyzer_payload = {
			text: text
	}
	
	 tone_analyzer.tone( tone_analyzer_payload,
	    function(err, tone) {
	        if (err){
	          console.log(err);
	          callback(null);
	        }
	        else{
	          //console.log(JSON.stringify(tone, null, 2));  //works, but don't want it printing right now
	          callback(getPrimaryEmotion(tone));
	        }
	    });
}


/**
 * 
 */
//function parseTone(tone_payload)
function getPrimaryEmotion(tone_analyzer_payload)
{
	  var emotion_tone = null;
	  tone_analyzer_payload.document_tone.tone_categories.forEach(function(toneCategory){
		  if(toneCategory.category_id == 'emotion_tone'){
			  emotion_tone = toneCategory;
		  }
		});
	  
	  var max_score = 0;
	  var primary_emotion = null;
	  
	  emotion_tone.tones.forEach(function(emotion){
		  if (emotion.score > max_score){
			  max_score = emotion.score;
			  primary_emotion = emotion.tone_id;
		  }
	  });
	  
	  // There is a primary emotion only if the highest score is > 0.5
	  if(max_score <= 0.5){
		  primary_emotion = 'neutral';
	  }
	  
	  console.log("The primary emotion is " + primary_emotion);
	  return primary_emotion;
}

/**
 * Updates the response text using the intent confidence
 * @param  {Object} response The response from the Conversation service
 * @return {Object}          The response with the updated message
 */
function updateMessage(response) {
  var responseText = null;
  if (response.intents && response.intents[0]) {
    var intent = response.intents[0];
    if (!response.output) {
      response.output = {};
    }
    // Depending on the confidence of the response the app can return different messages.
    // The confidence will vary depending on how well the system is trained. The service will always try to assign
    // a class/intent to the input. If the confidence is low, then it suggests the service is unsure of the
    // user's intent. In these cases it is usually best to return a disambiguation message
    // ('I did not understand your intent, please rephrase your question', etc..)
    if (intent.confidence >= 0.75) {
      responseText = 'I understood your intent was ' + intent.intent;
    } else if (intent.confidence >= 0.5) {
      responseText = 'I think your intent was ' + intent.intent;
    } else {
      responseText = 'I did not understand your intent';
    }
  }
  
  // Added by AW
  if(response == 'undefined'){
	  console.log('app.js: the response is undefined');
	  responseText = 'An error was returned from the dialog service.';
  }
  //end of addition by AW

  response.output.text = responseText;
  return response;
}

module.exports = app;
