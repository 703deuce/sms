"""Dump the generated tools manifest: python3 -m clips_worker.motion_studio.tools"""
from clips_worker.motion_studio.tools.registry import default_registry, dump_manifest

if __name__ == "__main__":
    path = dump_manifest()
    doc = default_registry().document()
    print(f"wrote {path} sourceHash={doc['sourceHash']} tools={len(doc['tools'])} aliases={doc['aliases']}")
