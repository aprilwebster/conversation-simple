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
require('json-query');

var extend = require('extend');  // app server
var express = require('express');  // app server
var bodyParser = require('body-parser');  // parser for post requests
var watson = require('watson-developer-cloud');  // watson sdk
//var nodeSdk = require('../node-sdk');  
var personality_insights_helper = require('./personality_insights_helper');
var jsonQuery = require('json-query');


var app = express();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());


// WATSON SERVICE WRAPPERS 
// Create the conversation service wrapper
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

var USER_TWITTER_HANDLE = 'adele';
var TWEET_COUNT = 300;


// message endpoint to converse with the Watson Conversation Service
app.post('/api/message', function(req, res) {

	// a workspace-id is required to locate a dialog
	var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
	  	if (!workspace || workspace === '<workspace-id>') {
	  		return res.json({'output': {'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' +
	  			'<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' +
	  			'Once a workspace has been defined the intents may be imported from ' +
	  			'<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_intents.csv">here</a> in order to get a working application.'}});
	  	}
	  
	
	// Payload object to send to the Watson Conversation Service
	// workspace_id is the identifier for the workspace containing the dialog (nodes) for this application
	// input is what the user of the web app 'said'
	// context contains both client state (e.g., current_tone, tone_history, etc) and Conversation service state
	var conversation_payload = {
		workspace_id: workspace
	};
	

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
				var emptyUser = initUser();
				conversation_payload.context = extend(conversation_payload.context, { emptyUser });
			}
		} 
		// If there is no context, create it and add a user object to it
		else {
			conversation_payload.context = initUser();
		}	
	}

	
	invokePersonality(USER_TWITTER_HANDLE, 
		function(personality_payload){
			var updated_user = updateUserPersonality(conversation_payload.context.user, personality_payload);

			invokeTone(req.body.input.text, 
					function(tone_payload){
						updateUserTone(conversation_payload.context.user, tone_payload);

						// Send the input to the conversation service
						conversation.message(conversation_payload, function(err, data) {
							if (err) {
								return res.status(err.code || 500).json(err);
							}
							return res.json(personalizeMessage(data));
						});
				});	

		});	

	//invokeTone should be here after separate personality and tone

});


/**
 * invokeTone calls the tone_analyzer.tone function to get the tone, and calls the callback function on the primary_emotion
 * @param text
 * @param callback
 */
function invokeTone(text, callback)
{
	var tone_analyzer_payload = { text: text };
	
	 tone_analyzer.tone( tone_analyzer_payload,
	    function(err, tone) {
	        if (err){
	          callback(null);
	        }
	        else{
	          callback(tone);
	        }
	    });
}

function invokePersonality(twitterHandle, callback)
{
	personality_insights_helper.personalityProfile(twitterHandle, TWEET_COUNT, function (profile) {
		callback(profile);
	});
}


function getPrimaryEmotion(emotionTone){
	var max_score = 0;
	var primary_emotion = null;
	  
	emotionTone.tones.forEach(function(emotion){
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


function updateUserPersonality(user, personality_payload)
{
	user.personality_profile = personality_payload;
	return user;
}

function updateUserTone(user, tone_analyzer_payload)
{
	var emotionTone = null;
	var languageTone = null;
	var socialTone = null;
	  
	tone_analyzer_payload.document_tone.tone_categories.forEach(function(toneCategory){
		if(toneCategory.category_id == 'emotion_tone'){
			emotionTone = toneCategory;
		}
		if(toneCategory.category_id == 'language_tone'){
			languageTone = toneCategory;
		}
		if(toneCategory.category_id == 'social_tone'){
			socialTone = toneCategory;
		} 
	});
	
	var primaryEmotion = getPrimaryEmotion(emotionTone);
	user.tone.emotion.current = primaryEmotion;
	if(typeof user.tone.emotion.history == 'undefined'){
		user.tone.emotion.history = [primaryEmotion];
	}else{
		user.tone.emotion.history.push(primaryEmotion);
	}
	
	user.tone.language.analytical = jsonQuery('tones[tone_id=analytical].score', { data: languageTone }).value;
	user.tone.language.confident = jsonQuery('tones[tone_id=confident].score', { data: languageTone }).value;
	user.tone.language.tentative = jsonQuery('tones[tone_id=tentative].score', { data: languageTone }).value;
	
	user.tone.social.openness_big5 = jsonQuery('tones[tone_id=openness_big5].score', { data: socialTone }).value;
	user.tone.social.conscientiousness_big5 = jsonQuery('tones[tone_id=conscientiousness_big5].score', { data: socialTone }).value;
	user.tone.social.extraversion_big5 = jsonQuery('tones[tone_id=extraversion_big5].score', { data: socialTone }).value;
	user.tone.social.agreeableness_big5 = jsonQuery('tones[tone_id=agreeableness_big5].score', { data: socialTone }).value;
	user.tone.social.emotional_range_big5 = jsonQuery('tones[tone_id=emotional_range_big5].score', { data: socialTone }).value;

	return user;
}


/**
 * Personalizes the output text of the conversation service response
 * @param  {Object} conversationResopnse 	The response from the Conversation service
 * @return {Object}          				The response from the Conversation service with personalized output.text.
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

	// If a current_emotion (tone) is provided for the user input, prepend the output.text from the Conversation Service with the matching tone expression header
	if (conversationResponse.context.user.tone.emotion.current) {
		var toneHeader = getToneExpression(conversationResponse.context.user.tone.emotion.current);
		if(toneHeader){
			personalizedMessage = toneHeader + ' ' + conversationResponse.output.text;
		}
	}

	conversationResponse.output.text = personalizedMessage;
	return conversationResponse;
}

function getToneExpression(emotion_tone){
	var toneExpression = null;
	
	switch(emotion_tone) {
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
	    	console.log('tone is neutral or null ' + emotion_tone);
	        toneExpression = "NEUTRAL";
	}
	return toneExpression;
}

function initUser(){
	return { 
		"user": {
			"tone": {
		      	"emotion": {      
		      		"current": null,
		      		"history": []
		      	},
		      	"language": {
		      		"confident": null,
		      		"tentative": null,
		      		"analytical": null
		      	},
		      	"social": {
		      		"openness_big5": null,
		      		"conscientiousness_big5": null,
		      		"extraversion_big5": null,
		      		"agreeableness_big5": null,
		      		"emotional_range_big5": null
		      	}
		    },
		    "personality_profile": {}
		 }
	}
};

module.exports = app;
