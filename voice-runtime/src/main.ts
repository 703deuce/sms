import dotenv from "dotenv";

dotenv.config();

console.error(
  JSON.stringify({
    service: "transovo-voice-runtime-ts",
    event: "runtime_removed",
    message:
      "The TypeScript LiveKit voice worker has been removed. Use voice-runtime-python only.",
  }),
);

process.exit(1);
