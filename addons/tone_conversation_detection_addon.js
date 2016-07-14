module.exports = {
  
  initToneContext: function (tone_instance){
       tone_analyzer = tone_instance;
	return { 
		"user": {
			"tone": {
		      	"emotion": {      
		      		"current": null,
		      		"history": []
		      	},
		      	"language": {
		      		"current": null,
		      		"history": []
		      	},
		      	"social": {
		      		"current": null,
		      		"history": []
		      	}
		    },
		    "personality_profile": {}
		 }
	}
   },


   invokeTone: function (text, callback)
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
  },
  

  updateUserTone: function (user, tone_analyzer_payload)
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
	
	var emotionProfile = getEmotionProfile(emotionTone);
	user.tone.emotion.current = emotionProfile;
	if(typeof user.tone.emotion.history == 'undefined'){
		user.tone.emotion.history = [emotionProfile];
	}else{
		user.tone.emotion.history.push(emotionProfile);
	}
	
	var languageProfile = getLanguageProfile(languageTone);
	user.tone.language.current = languageProfile;
	if(typeof user.tone.language.history == 'undefined'){
		user.tone.language.history = [languageProfile];
	}else{
		user.tone.language.history.push(languageProfile);
	}
	
        var socialProfile = getSocialProfile(socialTone);
	user.tone.social.current = socialProfile;
	if(typeof user.tone.social.history == 'undefined'){
		user.tone.social.history = [socialProfile];
	}else{
		user.tone.social.history.push(socialProfile);
	}
	
	return user;
   }
};
 

   function getEmotionProfile(emotionTone){
	var max_score = 0;
	var primary_emotion = null;
	  
	emotionTone.tones.forEach(function(emotion){
		if (emotion.score > max_score){
			max_score = emotion.score;
			primary_emotion = emotion.tone_id;
		  }
	  });
	  
	  // There is a primary emotion only if the highest score is > 0.5
	  if(max_score <= emotion_score_cutoff){
		  primary_emotion = 'neutral';
	  }
	  
	  return primary_emotion;
    }
   
   function getLanguageProfile(languageTone){
	var language_profile = "";
	  
	languageTone.tones.forEach(function(lang){
		if (lang.score >= language_score_cutoff){
			language_profile += lang.tone_id + " ";
		  }
	  });
	  
	  return language_profile;
    }
   
   function getSocialProfile(socialTone){
	var social_profile = "";
	  
	socialTone.tones.forEach(function(social){
		if (social.score >= social_score_cutoff){
			social_profile += social.tone_id + " ";
		  }
	  });
	  
	  return social_profile;
    }

var tone_analyzer = null;
var jsonQuery = require('json-query');
var emotion_score_cutoff = 0.5;
var language_score_cutoff = 0.6;
var social_score_cutoff = 0.75;
