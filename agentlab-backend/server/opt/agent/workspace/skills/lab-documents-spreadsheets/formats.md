# Snippets for documents and spreadsheets

## openpyxl: formula column and a bar chart

```python
from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
wb = Workbook()
ws = wb.active
ws.title = "Items"
ws.append(["item", "qty", "price", "total"])
rows = [("Paper", 10, 3.5), ("Pens", 25, 1.2), ("Tape", 8, 4.0)]
for i, (name, qty, price) in enumerate(rows, start=2):
    ws[f"A{i}"], ws[f"B{i}"], ws[f"C{i}"] = name, qty, price
    ws[f"D{i}"] = f"=B{i}*C{i}"
ws["A6"], ws["D6"] = "Grand total", "=SUM(D2:D4)"
# optional chart of qty
chart = BarChart()
chart.title = "Qty"
data = Reference(ws, min_col=2, min_row=1, max_row=4)
cats = Reference(ws, min_col=1, min_row=2, max_row=4)
chart.add_data(data, titles_from_data=True)
chart.set_categories(cats)
ws.add_chart(chart, "F2")
wb.save("out/supplies.xlsx")
```

Reload and check: `openpyxl.load_workbook(..., data_only=False)` and assert `ws["D2"].value.startswith("=")`.

## python-docx: heading, paragraph, table

```python
from docx import Document
doc = Document()
doc.add_heading("Q4 Office Supplies", level=1)
doc.add_paragraph("A short memo body.")
table = doc.add_table(rows=1, cols=2)
table.rows[0].cells[0].text = "Item"
table.rows[0].cells[1].text = "Notes"
doc.save("out/memo.docx")
```

Reload with `Document("out/memo.docx")` and check paragraphs and table cell text.

## PDF via pandoc or soffice

```bash
pandoc out/memo.docx -o out/memo.pdf
# or
soffice --headless --convert-to pdf --outdir out out/memo.docx
pdftotext -layout out/memo.pdf -
```

