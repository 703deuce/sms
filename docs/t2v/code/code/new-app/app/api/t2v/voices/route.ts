// GET ?search=&gender=&accent=&language=&category=&cursor= -> ElevenLabs GET /v2/voices (cached 10 min per query)
//   merged with workspace T2vSavedVoice (favourites + clones on top).
// POST multipart {name, files[], consent:true} -> cloneVoice() (POST /v1/voices/add); requires consent checkbox.
export { GET, POST } from '@/lib/server/t2v/routes/voices'
