export const STORAGE_ROUTES_KEY = "navigatorRoutes";
export const CSV_PATH = "data/routes-example-social.csv";

export function removeAccents(text) {
  if (typeof text !== "string") return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  if (lines.length <= 1) return [];
  
  const routes = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values = parseCSVLine(line);
    if (values.length < 8) continue;
    
    const route = {
      domain: values[0] || "",
      id: values[1] || "",
      module: values[2] || "",
      title: values[3] || "",
      url: values[4] || "",
      tags: values[5] ? values[5].replace(/^"|"$/g, "") : "",
      description: values[6] || "",
      status: values[7] || "active"
    };
    
    if (route.domain && route.id && route.title) {
      routes.push(route);
    }
  }
  
  return routes;
}

export function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}
