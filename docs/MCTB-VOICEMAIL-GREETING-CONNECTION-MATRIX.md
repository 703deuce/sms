# MCTB Voicemail — greeting connection matrix

| Control | Read | Write | Persistence | Production effect | Errors | Status |
|---------|------|-------|-------------|-----------------|--------|--------|
| Preview active | box.greetingUrl | — | — | playback | no URL | CONNECTED_AND_WORKING |
| Greeting studio | box | update_box | voicemailBox + provisionActiveVoicemailGreeting | caller hears greeting | save failed | CONNECTED_AND_WORKING |
| Write & generate | script + voiceId | audio/generate then update_box on activate | greetingUrl/text | TeXML greeting token | gen/upload errors | CONNECTED_AND_WORKING |
| ElevenLabs picker | GreetingVoicePicker API | draft voiceId | — | on activate | voice load | CONNECTED_AND_WORKING |
| Voice preview | picker | — | — | — | preview unavailable | CONNECTED_AND_WORKING |
| Record | MediaRecorder | upload → update_box | greetingUrl | active greeting | mic denied | CONNECTED_AND_WORKING |
| Upload | file input | upload API | greetingUrl | active greeting | invalid file | CONNECTED_AND_WORKING |
| Use default | — | update_box text, clear url | box | default script | no number | CONNECTED_AND_WORKING |
| Library list | derived from box | — | — | informational | — | READ_ONLY_BY_DESIGN |
| Explicit activate | generatedUrl draft | update_box | only on “Use this greeting” | no premature swap | activation error | CONNECTED_AND_WORKING |
