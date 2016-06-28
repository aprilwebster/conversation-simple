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
var conversation = watson.conversation({  // Using watson-developer-cloud
//var conversation = nodeSdk.conversation({	// Using local nodeSdk
  url: 'https://gateway.watsonplatform.net/conversation-experimental/api',
  username: process.env.CONVERSATION_USERNAME || '<username>',
  password: process.env.CONVERSATION_PASSWORD || '<password>',
  version_date: '2016-05-19',
  version: 'v1-experimental',
});


//Create the tone_analyzer service wrapper
var tone_analyzer = watson.tone_analyzer({
	url: 'https://gateway.watsonplatform.net/tone-analyzer/api',
	username: process.env.TONE_ANALYZER_USERNAME,
	password: process.env.TONE_ANALYZER_PASSWORD,  
	version_date: '2016-05-19',
	version: 'v3'
});

//Create the personality insights service wrapper
// There does not appear to be a version_date required for personality insights - any particular reason?
/*
var personality_insights = watson.personality_insights({
	url: 'https://gateway.watsonplatform.net/personality-insights/api',
	username: process.env.PERSONALITY_INSIGHTS_USERNAME,
	password: process.env.PERSONALITY_INSIGHTS_PASSWORD,  
	//version_date: '2016-05-19',
	version: 'v2'
});
*/


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
	};
	
	// Add the input and context to the payload
	if (req.body) {
		
		// INPUT - check for input in the body of the request; this is required to converse with the conversation service 
		if (req.body.input) {
			conversation_payload.input = req.body.input;
		}else{
			return res.json({'output': {'text': 'No input has been provided.  Please state your intent.'}});
		}
		

		// CONTEXT - check for context in the body of the request; this should be the context for the conversation payload!
		if (req.body.context) { // The client must maintain context/state
			
			// Add the request context to the conversation_payload
			conversation_payload.context = req.body.context;
			
			// USER - if there is no user, initialize this object in the context
			if(typeof req.body.context.user == 'undefined'){
				conversation_payload.context = extend(conversation_payload.context, {
					user: {
						current_emotion: null,
						emotion_history: []
					}
				});
				
				
			}else{ //USER exists
				// EMOTION_HISTORY - initialize it if it doesn't exist in the user
				if(typeof req.body.context.user.emotion_history == 'undefined'){
					user.emotion_history = [];  
				}
			}
		} else{
			var user = {
				user: {
					current_emotion: null,
					emotion_history: []
				}
			}
			conversation_payload.context = user;
		}	
	}
  
	// Pull the user input from the body of the request - this is the text that will be analyzed by 
	// the dialog service to determine its intent and the appropriate response
	var input = req.body.input;

	invokeTone(req.body.input.text, 
		function(data){
		// error handled by invokeTone - if no emotion is returned by the Tone Analyzer, the emotion is set to null
		// after invokeTone returns a primary_emotion (err or data), this function needs to be called to add
		// the primary_emotion to the payload.context
		
			console.log('app.post: invokeTone called and return value is ' + JSON.stringify(data,2,null));
			
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

			// Send the input to the conversation service
			conversation.message(conversation_payload, function(err, data) {
				if (err) {
					return res.status(err.code || 500).json(err);
				}
				return res.json(personalizeMessage(data));
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
	          callback(null);
	        }
	        else{
	          callback(getPrimaryEmotion(tone));
	        }
	    });
}



//function updateUser(tone_payload)
// parse response from conversation service - pull user out of context object and update

/**
 * 
 */

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
	  
	  return primary_emotion;
}



/**
 * Get the tone expression
 */



/**
 * Personalizes the output text of the conversation service response
 * @param  {Object} conversationResopnse 	The response from the Conversation service
 * @return {Object}          				The response from the Conversation service with a personalized output.text.
 */
function personalizeMessage(conversationResponse) {
	var personalizedMessage = null;

	if (conversationResponse == 'undefined') {
		conversationResponse = {
			'output' : {
				'text' : 'ERROR: I\'m sorry, an error was returned by the Watson Conversation service.  Please try again later.'
			}

		};
		return conversationResponse;
	}

	if (!conversationResponse.output) {
		conversationResponse.output = {
				'text' : 'There was no output provided by the Conversation service.'
		};
	}

	// If a current_emotion (tone) is provided for the user input, 
	// prepend the output text from the Conversation Service with the matching tone expression header
	if (conversationResponse.context.user.current_emotion) {
		var toneHeader = getToneExpression(conversationResponse.context.user.current_emotion);
		if(toneHeader){
			personalizedMessage = toneHeader + ' ' + conversationResponse.output.text;
		}
	}

	conversationResponse.output.text = personalizedMessage;
	return conversationResponse;
}

function getToneExpression(tone){
	var toneExpression = null;
	
	switch(tone) {
    	case "anger":
	        toneExpression = "I'm sorry you're frustrated.";
	        break;
	    case "joy":
	    	toneExpression = "Great!";
	        break;
	    case "sadness":
	    	toneExpression = "Cheer up!";
	        break;
	    case "disgust":
	    	toneExpression = "Ugh, I'm sorry you feel that way.";
	        break;
	    case "fear":
	    	toneExpression = "Not to worry, I'm here to help you.";
	        break;
	    default:
	    	console.log('tone is neutral or null ' + tone);
	        toneExpression = "";
	}
	return toneExpression;
}

module.exports = app;
