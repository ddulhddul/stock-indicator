// FRED 시계열 최근 값을 JSON으로 돌려주는 서버 함수
// 사용: /api/fred?id=VIXCLS  → { id, rows:[{time, value}] } (최근 약 3개월)
module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || "").toUpperCase();
  if (!/^[A-Z0-9_]{1,40}$/.test(id)) {
    res.status(400).json({ error: "잘못된 지표 코드" });
    return;
  }
  const start = new Date();
  start.setDate(start.getDate() - 100);
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start.toISOString().slice(0, 10)}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 stock-indicator-dashboard" } });
    if (!r.ok) throw new Error("FRED 응답 " + r.status);
    const rows = parseCsv(await r.text());
    if (!rows.length) throw new Error("데이터 없음");
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
    res.status(200).json({ id, rows });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
};

function parseCsv(text) {
  const out = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) { // 첫 줄은 헤더
    const [time, raw] = line.split(",");
    const value = Number(raw);
    if (/^\d{4}-\d{2}-\d{2}$/.test(time) && raw && raw !== "." && Number.isFinite(value)) {
      out.push({ time, value });
    }
  }
  return out;
}
module.exports.parseCsv = parseCsv;
