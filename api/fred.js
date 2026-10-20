// 지표 최근 값을 JSON으로 돌려주는 서버 함수
// 사용: /api/fred?id=VIXCLS  → { id, source, rows:[{time, value}] } (최근 약 3개월)
// VIXCLS는 CBOE 공식 CSV를 먼저 쓰고, 나머지는 FRED CSV를 씁니다.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

module.exports = async (req, res) => {
  const q = req.query || {};
  const id = String(q.id || "").toUpperCase();
  if (!/^[A-Z0-9_]{1,40}$/.test(id)) {
    res.status(400).json({ error: "잘못된 지표 코드" });
    return;
  }
  const tries = id === "VIXCLS" ? [cboeVix, () => fred(id)] : [() => fred(id)];
  const errors = [];
  for (const t of tries) {
    try {
      const { source, rows } = await t();
      if (!rows.length) throw new Error(source + ": 데이터 없음");
      res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
      res.status(200).json({ id, source, rows: rows.slice(-70) });
      return;
    } catch (e) {
      errors.push(String(e.message || e));
    }
  }
  res.status(q.debug ? 200 : 502).json({ error: errors.join(" / ") });
};
module.exports.config = { maxDuration: 15 };

async function get(url, ms) {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "text/csv,*/*" }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(new URL(url).host + " 응답 " + r.status);
  return r.text();
}

async function fred(id) {
  const start = new Date();
  start.setDate(start.getDate() - 100);
  const text = await get(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start.toISOString().slice(0, 10)}`, 8000)
    .catch(e => { throw new Error("FRED: " + (e.name === "TimeoutError" ? "시간 초과" : e.message)); });
  return { source: "FRED", rows: parseCsv(text, 0, 1) };
}

async function cboeVix() {
  const text = await get("https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv", 15000)
    .catch(e => { throw new Error("CBOE: " + (e.name === "TimeoutError" ? "시간 초과" : e.message)); });
  // DATE,OPEN,HIGH,LOW,CLOSE  (MM/DD/YYYY)
  const rows = parseCsv(text, 0, 4, (d) => {
    const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[1]}-${m[2]}` : d;
  });
  return { source: "CBOE", rows };
}

function parseCsv(text, dateCol, valCol, fixDate) {
  const out = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) { // 첫 줄은 헤더
    const cells = line.split(",");
    const time = fixDate ? fixDate(cells[dateCol]) : cells[dateCol];
    const raw = cells[valCol];
    const value = Number(raw);
    if (/^\d{4}-\d{2}-\d{2}$/.test(time) && raw && raw !== "." && Number.isFinite(value)) out.push({ time, value });
  }
  return out.sort((a, b) => (a.time < b.time ? -1 : 1));
}
module.exports.parseCsv = parseCsv;
