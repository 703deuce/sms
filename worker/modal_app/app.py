import os

import modal

app = modal.App(os.environ.get("MODAL_APP_NAME", "transovo-gpu"))

# Import registers @app.cls handlers
from modal_app import transcribe as _transcribe  # noqa: E402, F401
