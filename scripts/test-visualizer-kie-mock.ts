import assert from "node:assert/strict";

async function main() {
  process.env.VISUALIZER_KIE_MOCK = "1";
  delete process.env.KIE_API_KEY;

  const { runKieBathroomGeneration } = await import("../src/lib/visualizer/generation/provider-kie");
  const { resolveVisualizerKieModel, resolveVisualizerKieResolution } = await import(
    "../src/lib/visualizer/generation/kie-config"
  );

  const room = Buffer.from("fake-room-image");
  const result = await runKieBathroomGeneration({
    workspaceId: "ws_test",
    prompt: "Convert tub to shower with wall panels",
    roomImage: room,
    roomMime: "image/jpeg",
    referenceImages: [{ bytes: Buffer.from("mat"), mime: "image/jpeg", label: "panel" }],
  });

  assert.equal(result.imageBytes.length, room.length);
  assert.ok(result.model.includes("mock"));
  assert.equal(resolveVisualizerKieModel(), "nano-banana-2-1");
  assert.equal(resolveVisualizerKieResolution(), "1K");

  console.log("test-visualizer-kie-mock: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
