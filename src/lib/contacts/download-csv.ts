type CsvContact = {
  firstName: string;
  lastName: string;
  mobile: string;
  email?: string;
  optIn?: string;
  created?: string;
};

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadContactsCsv(contacts: CsvContact[], filename = "contacts-export.csv") {
  const headers = ["firstName", "lastName", "mobile", "email", "optIn", "created"];
  const rows = contacts.map((c) =>
    [
      c.firstName || "",
      c.lastName || "",
      c.mobile || "",
      c.email || "",
      c.optIn || "",
      c.created || "",
    ]
      .map((v) => escapeCsv(String(v)))
      .join(","),
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
