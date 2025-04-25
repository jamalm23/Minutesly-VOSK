// Debug script to verify Vosk loading
console.log('Vosk Loading Check: ', {
  voskType: typeof Vosk,
  voskKeys: typeof Vosk === 'object' ? Object.keys(Vosk) : 'not an object',
  hasRecognizer: typeof Vosk === 'object' && Vosk.SpeechRecognizer ? 'yes' : 'no'
});

// Create a global debug function
window.checkVosk = function() {
  console.log('Manual Vosk Check: ', {
    voskType: typeof Vosk,
    voskKeys: typeof Vosk === 'object' ? Object.keys(Vosk) : 'not an object',
    hasRecognizer: typeof Vosk === 'object' && Vosk.SpeechRecognizer ? 'yes' : 'no'
  });
  return typeof Vosk;
};
