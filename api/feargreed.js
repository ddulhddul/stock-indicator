// CNN Fear & Greed 지수를 받아 정리된 JSON으로 돌려주는 서버 함수
// 사용: /api/feargreed
module.exports = async (req, res) => {
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  const url = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata/" + start.toISOString().slice(0, 10);
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": "https://edition.cnn.com/markets/fear-and-greed",
        "Origin": "https://edition.cnn.com"
      }
    });
    if (!r.ok) throw new Error("CNN 응답 " + r.status);
    const out = shape(await r.json());
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
    res.status(200).json(out);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
};

function shape(j) {
  const now = j.fear_and_greed || {};
  const hist = (j.fear_and_greed_historical && j.fear_and_greed_historical.data) || [];
  const byDay = new Map();
  for (const p of hist) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    byDay.set(new Date(p.x).toISOString().slice(0, 10), Math.round(p.y * 10) / 10);
  }
  const rows = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([time, value]) => ({ time, value }));
  if (!rows.length && !Number.isFinite(now.score)) throw new Error("데이터 없음");
  return {
    score: now.score, rating: now.rating, timestamp: now.timestamp,
    previous_close: now.previous_close, previous_1_week: now.previous_1_week,
    previous_1_month: now.previous_1_month, previous_1_year: now.previous_1_year,
    rows
  };
}
module.exports.shape = shape;
