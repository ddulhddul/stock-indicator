# stock-indicator — 시장 위험 지표 대시보드

주식 매수 타이밍을 보는 시장 위험 지표를 한 페이지에 모은 대시보드입니다.

- 배포 주소: https://stock-indicator-snowy.vercel.app/
- 배포 방식: GitHub `main` 브랜치에 push하면 Vercel이 자동으로 다시 배포합니다.

## 맨 위 요약 줄

페이지 맨 위에 지표별 **최신 값 · 전일 대비 · 기준점 판정 · 기준 날짜**를 한 번에 보여 줍니다. 누르면 해당 차트로 이동합니다.

- 판정 방식은 `INDICATORS`의 `rule`로 정합니다.
  - `kind: "peakFall"`: 최근 10거래일 고점이 기준 이상이고, 지금 값이 고점보다 낮으면서 전일보다 하락 → "기준 이상에서 꺾임"(초록). 기준 이상인데 오르는 중 → 주황. 기준 미만 → 표시만.
  - `kind: "below"`: 기준 미만이면 "매수 구간"(초록), 아니면 기준까지 남은 거리.
- 데이터 출처
  - VIX: `/api/fred?id=VIXCLS` → CBOE 공식 CSV (FRED보다 하루 빠름)
  - 공포탐욕: `/api/feargreed` → CNN
  - 그 밖의 FRED 지표(하이일드 등): `data/<FRED코드>.json`. Vercel 서버에서는 FRED 접속이 시간 초과로 막혀 있어서, **GitHub Actions**(`.github/workflows/update-fred.yml`)가 하루 두 번(한국 08:15·23:15) FRED에서 받아 커밋합니다. 커밋되면 Vercel이 자동으로 다시 배포합니다.
  - Actions는 최근 6년치를 받아, 일간 지표는 최근 70개만, 월간 지표(CPI 등)는 전부 저장합니다.
  - `index.html`에 `fred: "코드"`(또는 `fredCore:` 같은 `fred…` 필드)가 있는 지표는 Actions가 자동으로 받아 옵니다. 새 FRED 지표를 추가하면 push할 때 Actions가 한 번 바로 실행됩니다.

## 지표와 내 기준점

| 탭 | 지표 | 데이터 | 내 기준점 |
|---|---|---|---|
| VIX | VIX 변동성 지수 | TradingView 위젯 `FRED:VIXCLS` (일별 종가) | 20 이상에서 꺾여서 하락할 때 매수 |
| 하이일드 | 미국 하이일드 스프레드 | TradingView 위젯 `FRED:BAMLH0A0HYM2` | 3.2% 이상에서 꺾여서 하락할 때 매수 |
| 공포탐욕 | CNN 공포·탐욕 지수 | `/api/feargreed` (CNN 데이터) → 직접 차트 | 10 미만이면 매수 |
| CPI | 미국 소비자물가 상승률 (전년 대비 %) | `data/CPIAUCSL.json`(헤드라인)·`data/CPILFESL.json`(근원) → 전년 같은 달 대비로 계산해 직접 차트 | (아직 없음) |

- 기준점은 각 차트 아래에 문구로만 표시합니다. 차트 위에 선은 긋지 않습니다.
- 참고 구간(VIX 15·20·30, 스프레드 3·5·7%, 공포탐욕 25·45·55·75)은 카드 위쪽에 칩으로 표시합니다.

## 파일 구조

```
index.html         페이지 전체 (HTML·CSS·JS 한 파일)
api/feargreed.js   Vercel 서버 함수: CNN 공포·탐욕 지수를 받아 JSON으로 변환
api/fred.js        Vercel 서버 함수: VIX(CBOE) 최근 값. FRED는 Vercel에서 시간 초과됨
scripts/update-fred.mjs          FRED 지표를 받아 data/*.json으로 저장
.github/workflows/update-fred.yml 위 스크립트를 하루 두 번 실행하고 커밋
data/              FRED 저장본 (Actions가 자동 관리, 직접 수정하지 않음)
```

## 화면 구성

- 상단에 고정된 탭이 있습니다. 스크롤하면 보고 있는 지표의 탭이 자동으로 선택되고, 탭을 누르면 해당 카드로 이동합니다.
- 카드는 한 줄에 하나씩 쌓입니다.
- 차트 높이는 화면 높이의 41%이며, 최소 300px·최대 450px입니다 (`index.html`의 `CHART_H`).
- 라이트·다크 모드를 자동으로 따릅니다.

## 지표 추가하는 법

`index.html` 아래쪽 `INDICATORS` 배열에 항목을 하나 추가하면 카드와 탭이 함께 생깁니다.

```js
{ type:"tv", tab:"금리차", name:"미국 10년-2년 금리차",
  symbol:"FRED:T10Y2Y", fred:"T10Y2Y",
  baseline:"내 기준 문구", zones:[["0 미만 역전","warn"]] },
```

| 필드 | 설명 |
|---|---|
| `type` | `"tv"`(TradingView 위젯), `"feargreed"`(전용 카드), `"cpi"`(FRED 월간 지수 → 전년 대비 %) |
| `tab` | 탭에 보일 짧은 이름 |
| `name` | 카드 제목 |
| `symbol` | TradingView 심볼 (`type: "tv"`일 때) |
| `fred` | FRED 코드 (있으면 원본 링크 표시, Actions가 자동으로 받음) |
| `fredCore` 등 `fred…` | 보조 FRED 코드 (Actions가 같이 받음. CPI의 근원 지수) |
| `summary` | `true`면 `rule` 없이도 요약 줄에 값만 표시 |
| `baseline` | 내 기준점 문구 (차트 아래에 표시) |
| `rule` | 요약 줄 판정 `{level, kind:"peakFall"\|"below", unit}` (없으면 요약 줄에 안 나옴) |
| `releases` | 발표 일정 `[[대상월, 발표시각 ISO]]` (CPI). 다음 발표일과 D-day를 카드·요약 칩에 표시 |
| `zones` | 참고 구간 `[문구, "ok"\|"warn"\|"bad"]` |

## 알아둘 점 (지금까지 확인한 것)

- TradingView 무료 위젯은 `TVC:VIX` 같은 원본 VIX 심볼을 표시하지 않습니다. FRED 심볼(`FRED:...`)은 표시됩니다.
- TradingView 위젯 안에는 선이나 표시를 추가할 수 없습니다 (외부 iframe).
- 위젯은 카드가 화면에 붙은 뒤에 로드해야 크기가 맞습니다. 그래서 높이를 픽셀로 고정했습니다.
- FRED의 하이일드 스프레드는 최근 약 3년치만 제공됩니다.
- Vercel 서버 함수에서 `fred.stlouisfed.org` 접속은 응답이 없어 시간 초과됩니다. 그래서 FRED 값은 GitHub Actions로 받습니다.
- CPI 다음 발표일은 BLS 공식 일정(https://www.bls.gov/schedule/news_release/cpi.htm)을 `releases`에 직접 적어 둔 것입니다. 지금은 2027년 12월 10일(11월분)까지 들어 있으니, 그 전에 다음 해 일정을 추가해야 합니다. 목록이 끝나면 "일정 확인 필요"가 뜹니다.
- CNN 공포·탐욕 데이터는 비공식 경로(`production.dataviz.cnn.io`)라 CNN이 바꾸면 끊길 수 있습니다. 그러면 카드에 "불러오지 못했습니다"가 뜹니다.
- TradingView나 FRED에 없는 지표는 `api/`에 Vercel 서버 함수를 만들어 데이터를 받고, lightweight-charts(4.2.0)로 직접 그립니다. 공포·탐욕 카드가 그 예시입니다.

*투자 자문이 아닌 개인 판단용 참고 페이지입니다.*
