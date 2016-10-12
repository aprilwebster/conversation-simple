'use strict';

/**
 * Public functions for this module
 */
module.exports = {
  initUser: initUser, 
  initTone: initTone,
  initPersonality: initPersonality
};


/**
 * initToneContext initializes a user object containing tone data (from the Watson Tone Analyzer)
 * @returns {Json} user json object with the emotion, language and social tones.  The current
 * tone identifies the tone for a specific conversation turn, and the history provides the conversation for
 * all tones up to the current tone for a conversation instance with a user.
 */
function initUser() {
  return (
    {
      'tone': initTone(),
      'personality': initPersonality()
    });
}


function initTone() {
  return (
    {
      'emotion': {
        'current': null
      },
      'language': {
        'current': null
      },
      'social': {
        'current': null
      }
    });
}

/**
 * "id": "Neuroticism",
                "name": "Emotional range",
                "category": "personality",
                "percentage": 0.3520083771560689,
                "sampling_error": 0.0899635058,
 */

/**
 * 
 * @returns 
 * IDEA: add a timestamp for this - it's not specific to the conversation, but if want to persist it, might be important...
 * value for facet is the percentage
 * immoderation, emotional range, conscientiousness, self-discipline, dutifulness
 */
function initPersonality() {
  return (
    {
      
      'conscientiousness': null,
      'immoderation': null,
      'dutifulness': null,
      'neuroticism': null,
      'self-discipline': null
    });
}