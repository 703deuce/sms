/** Curated ElevenLabs voices for Phone greetings (auto attendant, voicemail). */

export type PhoneElevenLabsVoice = {
  id: string;
  label: string;
  description: string;
  role?: "sales" | "billing" | "general";
};

export const PHONE_ELEVENLABS_VOICES: PhoneElevenLabsVoice[] = [
  {
    id: "cgSgspJ2msm6clMCkdW9",
    label: "Jessica",
    description: "Warm, professional — good default for sales",
    role: "sales",
  },
  {
    id: "21m00Tcm4TlvDq8ikWAM",
    label: "Rachel",
    description: "Calm and articulate — billing and account messages",
    role: "billing",
  },
  {
    id: "Bmj4Yi69e7b67di5IKVn",
    label: "Jade",
    description: "Warm, natural professional",
    role: "general",
  },
  {
    id: "xbIuSyF7FdqvuiiHz4Rb",
    label: "Eddie",
    description: "Clear male voice — general business",
    role: "general",
  },
];
