// index.html의 INDICATORS에 있는 fred 코드들을 FRED에서 받아 data/<코드>.json으로 저장
// GitHub Actions가 하루 두 번 실행합니다. (Vercel 서버에서는 FRED 접속이 막혀 있어서)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SKIP = new Set(["VIXCLS"]); // VIX는 /api/fred가 CBOE에서 직접 받음
const html = readFileSync("index.html", "utf8");
const ids = [...new Set([...html.matchAll(/^\s*fred\w*:\s*"([A-Z0-9_]+)"/gm)].map(m => m[1]))].filter(id => !SKIP.has(id));
mkdirSync("data", { recursive: true });

const start = new Date();
start.setFullYear(start.getFullYear() - 6); // 월간 지표 전년 대비 계산용으로 넉넉히
let failed = 0;
for (const id of ids) {
  try {
    const r = await fetchRetry(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start.toISOString().slice(0, 10)}`);
    const rows = [];
    for (const line of (await r.text()).trim().split(/\r?\n/).slice(1)) {
      const [time, raw] = line.split(",");
      const value = Number(raw);
      if (/^\d{4}-\d{2}-\d{2}$/.test(time) && raw && raw !== "." && Number.isFinite(value)) rows.push({ time, value });
    }
    if (!rows.length) throw new Error("데이터 없음");
    // 일간 지표는 최근 70개만, 월간·분기 지표(간격 20일 이상)는 전부 저장
    const gap = rows.length > 1 ? (Date.parse(rows[rows.length - 1].time) - Date.parse(rows[rows.length - 2].time)) / 864e5 : 0;
    const keep = gap >= 20 ? rows : rows.slice(-70);
    writeFileSync(`data/${id}.json`, JSON.stringify({ id, source: "FRED", rows: keep }) + "\n");
    console.log(id, rows.length, "rows, last", rows[rows.length - 1]);
  } catch (e) {
    failed++;
    console.error(id, "실패:", e.message);
  }
}
// 실패해도 기존 저장본을 그대로 두고 정상 종료 (다음 실행에서 다시 시도)
if (failed) console.warn(`경고: ${failed}/${ids.length}개 지표를 받지 못했습니다. 기존 저장본을 유지합니다.`);

async function fetchRetry(url) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 stock-indicator (GitHub Actions)" }, signal: AbortSignal.timeout(60000) });
      if (r.ok) return r;
      last = new Error("HTTP " + r.status);
    } catch (e) { last = e; }
    await new Promise(res => setTimeout(res, 5000 * (i + 1)));
  }
  throw last;
}
