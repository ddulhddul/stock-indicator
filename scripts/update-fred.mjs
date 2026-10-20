// index.html의 INDICATORS에 있는 fred 코드들을 FRED에서 받아 data/<코드>.json으로 저장
// GitHub Actions가 하루 두 번 실행합니다. (Vercel 서버에서는 FRED 접속이 막혀 있어서)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SKIP = new Set(["VIXCLS"]); // VIX는 /api/fred가 CBOE에서 직접 받음
const html = readFileSync("index.html", "utf8");
const ids = [...new Set([...html.matchAll(/^\s*fred:\s*"([A-Z0-9_]+)"/gm)].map(m => m[1]))].filter(id => !SKIP.has(id));
mkdirSync("data", { recursive: true });

const start = new Date();
start.setDate(start.getDate() - 100);
let failed = 0;
for (const id of ids) {
  try {
    const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start.toISOString().slice(0, 10)}`,
      { headers: { "User-Agent": "Mozilla/5.0 stock-indicator (GitHub Actions)" }, signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const rows = [];
    for (const line of (await r.text()).trim().split(/\r?\n/).slice(1)) {
      const [time, raw] = line.split(",");
      const value = Number(raw);
      if (/^\d{4}-\d{2}-\d{2}$/.test(time) && raw && raw !== "." && Number.isFinite(value)) rows.push({ time, value });
    }
    if (!rows.length) throw new Error("데이터 없음");
    writeFileSync(`data/${id}.json`, JSON.stringify({ id, source: "FRED", rows: rows.slice(-70) }) + "\n");
    console.log(id, rows.length, "rows, last", rows[rows.length - 1]);
  } catch (e) {
    failed++;
    console.error(id, "실패:", e.message);
  }
}
if (failed === ids.length && ids.length) process.exit(1);
