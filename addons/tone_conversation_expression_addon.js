module.exports = {
  

    personalizeMessage: function(conversationResponse) {
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

  
};
  
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
