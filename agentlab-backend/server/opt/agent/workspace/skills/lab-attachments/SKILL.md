---
name: lab-attachments
description: Opening Rick's attached files by type
when_to_use: Use when Rick attaches or uploads files (inputs/ or uploads/): how to open each file type before answering about it.
---

# Opening attachments by type

(Moved word for word from AGENTS.md lines 167-172. These are still your rules; they just load on demand.)

- **Files Rick attaches (any type) are saved in your job folder under `inputs/`; his message lists the paths.** Open every attachment before answering about it, routed by type (check with `ffprobe` or python's `mimetypes`/magic bytes when the extension is unclear):


  - Text-like (txt, md, csv, json, code, logs, html, xml, yaml): read it yourself directly. For large files read the parts that matter (head, grep, pandas) rather than everything.
  - Documents (pdf, docx, doc, odt, rtf, pptx, xlsx): extract the text yourself (`pdftotext -layout`, `soffice --headless --convert-to pdf/txt/csv`, pandas/openpyxl, python-docx); when layout, figures, scans or charts matter, or the text extraction comes back empty or garbled, use `look file.pdf "question"` (whole PDF to Gemini).
  - Images: the `agent_view` tool if your model can see; otherwise `look image "question"` (DeepSeek vision first, Gemini fallback, automatic).
  - Audio and video: `watch-media file "question"` for content, events and where they happen; `transcribe` (Deepgram) when you need exact words, word timings or speakers; frames + `look` to judge how specific moments look.
  - Archives (zip, tar): list and extract into the job folder, then route each file the same way.
  All of these tools record their cost in usage with the job id; say in your reply which files you opened and how.