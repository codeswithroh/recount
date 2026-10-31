// Open statistics sources exposed to models through the MCP endpoint.
const MAX_ROWS = 200;

type Indicator = { id: string; name: string };
let worldBankCache: Indicator[] | null = null;
let eurostatCache: Indicator[] | null = null;

const rank = (items: Indicator[], query: string) => {
  const words = query.toLowerCase().split(/\W+/).filter(Boolean);
  return items
    .map((item) => {
      const name = item.name.toLowerCase();
      return { item, score: words.filter((word) => name.includes(word)).length };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.length - b.item.name.length)
    .slice(0, 15)
    .map((row) => row.item);
};

async function worldBankIndicators() {
  if (worldBankCache) return worldBankCache;
  const res = await fetch("https://api.worldbank.org/v2/source/2/indicator?format=json&per_page=2000");
  const [, rows] = (await res.json()) as [unknown, { id: string; name: string }[]];
  worldBankCache = rows.map(({ id, name }) => ({ id, name }));
  return worldBankCache;
}

async function eurostatDatasets() {
  if (eurostatCache) return eurostatCache;
  const res = await fetch("https://ec.europa.eu/eurostat/api/dissemination/catalogue/toc/txt?lang=en");
  const lines = (await res.text()).split("\n").slice(1);
  eurostatCache = lines
    .map((line) => line.split("\t").map((cell) => cell.replace(/^"\s*|\s*"$/g, "")))
    .filter((cells) => cells[2] === "dataset" || cells[2] === "table")
    .map((cells) => ({ id: cells[1], name: cells[0] }));
  return eurostatCache;
}

export async function searchDatasets(query: string) {
  const [worldBank, eurostat] = await Promise.allSettled([worldBankIndicators(), eurostatDatasets()]);
  return {
    world_bank: worldBank.status === "fulfilled" ? rank(worldBank.value, query) : [],
    eurostat: eurostat.status === "fulfilled" ? rank(eurostat.value, query) : [],
  };
}

export async function worldBankSeries(indicator: string, country: string, start: number, end: number) {
  const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=${MAX_ROWS}&date=${start}:${end}`;
  const res = await fetch(url);
  const body = (await res.json()) as [unknown, { date: string; value: number | null; country: { value: string } }[]];
  const rows = (body[1] ?? []).map((row) => ({ year: row.date, value: row.value, country: row.country.value }));
  return { source_url: url, rows };
}

type JsonStat = {
  value: Record<string, number>;
  id: string[];
  size: number[];
  dimension: Record<string, { category: { index: Record<string, number>; label?: Record<string, string> } }>;
};

export async function eurostatSeries(dataset: string, filters: Record<string, string>) {
  const params = new URLSearchParams({ format: "JSON", lang: "EN", ...filters });
  const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${encodeURIComponent(dataset)}?${params}`;
  const res = await fetch(url);
  const stat = (await res.json()) as JsonStat;
  if (!stat.id) return { source_url: url, rows: [], error: JSON.stringify(stat).slice(0, 300) };

  const labels = stat.id.map((dim) => {
    const { index, label } = stat.dimension[dim].category;
    const byPosition: string[] = [];
    for (const [code, position] of Object.entries(index)) byPosition[position] = label?.[code] ?? code;
    return byPosition;
  });
  const rows = Object.entries(stat.value)
    .slice(0, MAX_ROWS)
    .map(([flat, value]) => {
      let rest = Number(flat);
      const row: Record<string, string | number> = { value };
      for (let dim = stat.id.length - 1; dim >= 0; dim--) {
        row[stat.id[dim]] = labels[dim][rest % stat.size[dim]];
        rest = Math.floor(rest / stat.size[dim]);
      }
      return row;
    });
  return { source_url: url, rows };
}
