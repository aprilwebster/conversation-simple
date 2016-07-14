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

var tone_conversation_addon = require("./addons/tone_conversation_detection_addon.js");
var tone_conversation_expression = require("./addons/tone_conversation_expression_addon.js");
var personality_addon = require("./addons/personality_conversation_addon.js");

var app = express();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());


// WATSON SERVICE WRAPPERS 
// Create the conversation service wrapper
var conversation = watson.conversation({  // Using watson-developer-cloud
//var conversation = nodeSdk.conversation({	// Using local nodeSdk
  url: 'https://gateway.watsonplatform.net/conversation/api',
  username: process.env.CONVERSATION_USERNAME || '<username>',
  password: process.env.CONVERSATION_PASSWORD || '<password>',
  version_date: '2016-07-01',
  version: 'v1',
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

function invokeAddOns_PersonalityAndTone(conversation_payload,req,res)
{
				personality_addon.invokePersonality(USER_TWITTER_HANDLE, 
					function(personality_payload){
					var updated_user = personality_addon.updateUserPersonality(conversation_payload.context.user, personality_payload);
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
			});
}

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
}





module.exports = app;
