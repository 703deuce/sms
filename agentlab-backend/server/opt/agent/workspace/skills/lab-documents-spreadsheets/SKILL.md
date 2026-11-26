---
name: lab-documents-spreadsheets
when_to_use: Use when creating or editing a Word document, PDF, Excel workbook, or CSV, including charts and Excel formulas. Not for slide decks, HTML dashboards, or a data question that needs only a chat answer and no file.
description: Create and edit docx, xlsx, csv, and pdf files with charts and formulas.
---

# Documents and spreadsheets

Put deliverables in `out/`. Use the pre-installed libraries in this container (don't invent new paid APIs).

## Tools

- **Excel / xlsx:** Python `openpyxl` (formulas, multiple sheets, charts). `pandas` for tabular work, then write with `openpyxl` when you need formulas or an Excel chart.
- **CSV:** `pandas` or the `csv` module. UTF-8, header row, no stray index column unless asked.
- **Word / docx:** Python `docx` (`python-docx`). Headings, paragraphs, tables.
- **PDF:** prefer writing a docx or markdown and converting with `pandoc` or `soffice` (`/opt/tools/soffice` or `soffice --headless --convert-to pdf`). Extract with `pdftotext -layout`. Python `pypdf` for merge/split/page count.
- **Charts in a workbook:** an actual Excel chart (`openpyxl.chart`), not only a PNG pasted into the sheet, unless Rick asked for an image.

## Formulas

When the request wants a spreadsheet (not just a computed table), write **real Excel formulas** (`=B2*C2`, `=SUM(D2:D10)`) so the file still works if a value changes. Don't hard-code a calculated total in a cell that should be a formula.

## Checks (run these before you say done)

- **Run `doc-verify out/FILE` first** (docx, pptx, xlsx, pdf): it opens the file, recalculates every xlsx formula in LibreOffice and lists cells that give errors or blanks, lists charts, renders pages to PNG in log/verify/ (look at them with agent_view), and checks `--expect "phrase"` text. Fix everything it reports. Libraries available: python-docx, python-pptx, openpyxl (formulas, charts), xlsxwriter, reportlab, pymupdf, pdfplumber, pandas, matplotlib.

- Open the file back with the same library and assert the required sheets, columns, heading text, row counts, and formulas (cells whose value starts with `=`).
- For PDF: `pdftotext -layout out/file.pdf -` and confirm the expected phrases; check page count with `pypdf` or `pdfinfo` if present.
- For a chart: the xlsx zip should contain `xl/charts/` (or you listed the chart with openpyxl).
- Describe the output by measured properties (sheets, rows, page count, file size), not by intent.

See `formats.md` in this folder for copy-paste snippets (`read_section` or `agent_skill_file`).

## Conversions keep everything
A converted file keeps the title, every heading, table, date and number. After converting, compare the headings and numbers of the input with the output (e.g. `pandoc -t plain` or `pdftotext` both sides) and fix anything missing.
