# Minimal self-contained Chart.js dashboard

```html
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Units sold, 2026</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  body { font: 16px/1.4 system-ui, sans-serif; margin: 24px; max-width: 900px; }
  table { border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
</style>
<h1>Units sold, 2026</h1>
<canvas id="c" width="800" height="320"></canvas>
<table>
  <thead><tr><th>Month</th><th>Units</th></tr></thead>
  <tbody>
    <tr><td>Jan</td><td>10</td></tr>
    <!-- ... -->
  </tbody>
</table>
<script>
const labels = ["Jan","Feb","Mar","Apr"];
const values = [10,14,9,18];
new Chart(document.getElementById("c"), {
  type: "bar",
  data: { labels, datasets: [{ label: "Units", data: values }] },
  options: { responsive: true, plugins: { legend: { display: false } } }
});
</script>
```

