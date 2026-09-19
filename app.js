// app.js — F-01 v2 기간별 적정가 범위 계산 (계산·검증·표시 함수)
// 종목 줄에는 종목명·현재가·최근 EPS 1개만 넣는다. 목표 PER과 기간별 이익 증감률은 임의의 기본 시나리오로 미리 채워지고 고쳐 쓸 수 있다.
// 구현된 요구사항: R-01 정상 · R-02 빈값 · R-03 오류 · R-04 데이터 없음 · R-05 예시 종목 선택 · R-06 예시 목록 없음 · R-07 기본 시나리오.
// 서버·외부 요청·라이브러리 없음. 계산은 아래 함수가 한다(화면에 쓰는 값을 손으로 적지 않는다).
(function (global) {
  "use strict";

  var PERIODS = ["단기", "중기", "장기"];
  var DISCLAIMER = "주가 예측이 아니라 입력한 가정에 따른 시나리오이며, 종목 추천이나 매수·매도 권유가 아닙니다.";
  var RESULT_TITLE = "기간별 적정가 범위 (입력한 가정에 따른 시나리오)";

  // R-07 기본 시나리오: 근거 없는 임의의 값이다(예측·추천이 아님).
  var DEFAULTS = { per: { low: 8, base: 10, high: 12 }, growth: [-10, 0, 10] };
  var MSG_DEFAULTS_NOTE = "미리 채운 값(목표 PER 8·10·12, 이익 증감률 -10·0·+10 %)은 임의의 기본 시나리오이며 예측이나 추천이 아니에요. 자유롭게 고쳐 쓰세요.";

  // R-04 데이터 없음: 금리 참고 줄만 이 문구로 바꾸고 계산은 그대로 한다
  var MSG_RATE_MISSING = "금리 자료를 불러오지 못했습니다. 계산은 그대로 사용할 수 있습니다.";
  // R-05·R-06 예시 종목(가상) 안내 문구
  var MSG_EXAMPLE_NOTE = "직접 만든 예시 종목이며 실제 종목이 아닙니다. 값은 자유롭게 고칠 수 있어요.";
  var MSG_EXAMPLE_MISSING = "예시 종목을 불러오지 못했습니다. 값을 직접 입력해 주세요.";

  // R-02 빈값 안내 문구 (화면에 나오는 문장 그대로)
  var MSG_NO_ROWS = "종목 정보를 한 줄 이상 입력해 주세요.";
  var MSG_HAS_EMPTY = "빈 칸이 있어 계산하지 않았습니다. 표시된 칸을 채워 주세요.";
  var MSG_PRICE_EMPTY = "현재가를 입력해 주세요.";
  var MSG_EPS_EMPTY = "최근 EPS를 입력해 주세요.";
  // R-03 오류 안내 문구
  var MSG_HAS_INVALID = "입력값을 확인해 주세요. 표시된 칸을 고친 뒤 다시 계산해 주세요.";
  var MSG_NOT_NUMBER = "숫자만 입력해 주세요. (예: 60000)";
  var MSG_PRICE_POSITIVE = "현재가는 0보다 큰 숫자여야 합니다.";
  var MSG_EPS_POSITIVE = "최근 EPS는 0보다 큰 숫자여야 합니다.";
  var MSG_PER_POSITIVE = "목표 PER은 0보다 큰 숫자여야 합니다.";
  var MSG_PER_ORDER = "목표 PER은 비관 ≤ 기준 ≤ 낙관 순서로 입력해 주세요.";
  var MSG_G_NOT_NUMBER = "증감률은 숫자로 입력해 주세요. (예: -10, 0, 10)";
  var MSG_G_RANGE = "증감률은 -100보다 큰 숫자여야 합니다.";

  var PER_FIELDS = [
    { id: "per-low", label: "비관" },
    { id: "per-base", label: "기준" },
    { id: "per-high", label: "낙관" }
  ];
  var G_FIELDS = [
    { id: "g-0", label: "단기" },
    { id: "g-1", label: "중기" },
    { id: "g-2", label: "장기" }
  ];

  // 「60,000」 같은 쉼표 숫자를 받는다. 숫자가 아니면 NaN.
  function parseNumber(text) {
    if (typeof text === "number") return isFinite(text) ? text : NaN;
    var s = String(text === undefined || text === null ? "" : text).replace(/,/g, "").trim();
    if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  }

  function getDefaults() {
    return { per: { low: DEFAULTS.per.low, base: DEFAULTS.per.base, high: DEFAULTS.per.high }, growth: DEFAULTS.growth.slice() };
  }

  // 예상 EPS = 최근 EPS × (100 + 증감률) ÷ 100, 원 단위 반올림
  function calcExpectedEps(eps, growth) {
    return Math.round(eps * (100 + growth) / 100);
  }

  // 적정가 = 예상 EPS × 목표 PER, 원 단위 반올림
  function calcFairPrice(expectedEps, per) {
    return Math.round(expectedEps * per);
  }

  // 차이(%) = (기준 적정가 − 현재가) ÷ 현재가 × 100, 소수 첫째 자리 반올림
  function calcGap(fair, price) {
    var g = Math.round(((fair - price) / price) * 100 * 10) / 10;
    return g === 0 ? 0 : g;
  }

  // rows: [{name, price, eps(최근 EPS)}], assumptions: {per:{low,base,high}, growth:[단기,중기,장기]}
  function calcAll(rows, assumptions) {
    return rows.map(function (r) {
      return {
        name: r.name,
        price: r.price,
        periods: PERIODS.map(function (label, i) {
          var e = calcExpectedEps(r.eps, assumptions.growth[i]);
          var low = calcFairPrice(e, assumptions.per.low);
          var base = calcFairPrice(e, assumptions.per.base);
          var high = calcFairPrice(e, assumptions.per.high);
          return { label: label, expectedEps: e, low: low, base: base, high: high, gap: calcGap(base, r.price) };
        })
      };
    });
  }

  // 화면에 보이는 형식
  function fmtWon(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function fmtRange(lo, hi) {
    return fmtWon(lo) + " ~ " + fmtWon(hi);
  }
  function fmtGap(g) {
    if (g === 0) return "0.0%";
    return (g > 0 ? "+" : "") + g.toFixed(1) + "%";
  }

  // 결과 표 한 줄씩(화면 문자열). test.html이 이 값을 기대 문자열과 그대로 비교한다.
  function buildDisplayRows(results) {
    var out = [];
    results.forEach(function (s) {
      s.periods.forEach(function (p) {
        out.push({
          stock: s.name,
          period: p.label,
          range: fmtRange(p.low, p.high),
          base: fmtWon(p.base),
          gap: fmtGap(p.gap)
        });
      });
    });
    return out;
  }

  // 금리 참고: data.js의 마지막 행
  function getRateReference(data) {
    if (!data || !Array.isArray(data.rows) || data.rows.length === 0) return null;
    var last = data.rows[data.rows.length - 1];
    return { month: last.month, long: last.long_rate_pct, short: last.rate_3m_pct };
  }
  function formatRateLine(ref) {
    if (!ref) return MSG_RATE_MISSING; // R-04: data.js가 없거나 rows가 비어 있을 때
    return "참고: 한국 장기금리(10년 국채) " + ref.long + " %, 3개월 금리 " + ref.short +
      " % (" + ref.month + ", 출처: OECD Data Explorer, CC BY 4.0). 종목의 적정 배수를 알려 주는 값이 아닙니다.";
  }

  // ───────────── R-05·R-06 예시 종목(가상) ─────────────
  // data.js의 window.EXAMPLE_STOCKS = [{name, price, eps(최근 EPS)}, ...]
  function getExampleList(data) {
    return Array.isArray(data) ? data : [];
  }
  // R-06: 예시 목록이 비어 있으면 화면에 보일 안내 문구, 있으면 빈 문자열
  function getExampleMessage(list) {
    return getExampleList(list).length === 0 ? MSG_EXAMPLE_MISSING : "";
  }
  // 이름으로 예시 종목을 찾아 {name, price, eps}를 돌려준다. 「직접 입력」이거나 없는 이름이면 null.
  function applyExample(name, list) {
    var items = getExampleList(list === undefined ? global.EXAMPLE_STOCKS : list);
    for (var i = 0; i < items.length; i++) {
      if (items[i].name === name) return { name: items[i].name, price: items[i].price, eps: items[i].eps };
    }
    return null;
  }

  // ───────────── R-02 빈값 · R-03 오류 검사 ─────────────
  // rawRows: [{name, price, eps}] 칸에 적힌 글자 그대로(문자열)
  // rawAssump: {"per-low","per-base","per-high","g-0","g-1","g-2"} 칸에 적힌 글자
  // 반환: {ok, top, errors:[{id, message}]} — id는 화면 칸의 id, message는 그 칸 아래에 나올 문장
  // 상단 문구: 종목 줄이 하나도 없으면 MSG_NO_ROWS, 빈 칸이 있으면 MSG_HAS_EMPTY(빈 칸과 오류가 함께 있어도 이쪽), 오류만 있으면 MSG_HAS_INVALID
  function isBlank(s) {
    return String(s === undefined || s === null ? "" : s).trim() === "";
  }
  function rowIsUsed(r) {
    return !isBlank(r.name) || !isBlank(r.price) || !isBlank(r.eps);
  }
  function validateInputs(rawRows, rawAssump) {
    var used = [];
    rawRows.forEach(function (r, i) { if (rowIsUsed(r)) used.push(i); });
    if (used.length === 0) return { ok: false, top: MSG_NO_ROWS, errors: [] };

    var errors = [];
    var hasEmpty = false, hasInvalid = false;

    // 양수여야 하는 칸: 비어 있으면 R-02 문구, 값이 있는데 숫자가 아니거나 0 이하면 R-03 문구
    function checkPositive(id, text, emptyMsg, positiveMsg) {
      if (isBlank(text)) { errors.push({ id: id, message: emptyMsg }); hasEmpty = true; return; }
      var n = parseNumber(text);
      if (isNaN(n)) { errors.push({ id: id, message: MSG_NOT_NUMBER }); hasInvalid = true; return; }
      if (n <= 0) { errors.push({ id: id, message: positiveMsg }); hasInvalid = true; }
    }
    // 증감률 칸: 음수·0 허용, -100 이하만 오류
    function checkGrowth(id, text, label) {
      if (isBlank(text)) { errors.push({ id: id, message: label + " 증감률을 입력해 주세요." }); hasEmpty = true; return; }
      var n = parseNumber(text);
      if (isNaN(n)) { errors.push({ id: id, message: MSG_G_NOT_NUMBER }); hasInvalid = true; return; }
      if (n <= -100) { errors.push({ id: id, message: MSG_G_RANGE }); hasInvalid = true; }
    }

    used.forEach(function (i) {
      var r = rawRows[i];
      checkPositive("f-" + i + "-price", r.price, MSG_PRICE_EMPTY, MSG_PRICE_POSITIVE);
      checkPositive("f-" + i + "-eps", r.eps, MSG_EPS_EMPTY, MSG_EPS_POSITIVE);
    });
    PER_FIELDS.forEach(function (f) {
      checkPositive(f.id, rawAssump[f.id], f.label + " 목표 PER을 입력해 주세요.", MSG_PER_POSITIVE);
    });

    // 세 PER이 모두 올바른 숫자일 때만 순서를 본다: 비관 ≤ 기준 ≤ 낙관 (안내는 낙관 칸 아래)
    var perErr = errors.some(function (e) { return e.id.indexOf("per-") === 0; });
    if (!perErr) {
      var lo = parseNumber(rawAssump["per-low"]), ba = parseNumber(rawAssump["per-base"]), hi = parseNumber(rawAssump["per-high"]);
      if (!(lo <= ba && ba <= hi)) { errors.push({ id: "per-high", message: MSG_PER_ORDER }); hasInvalid = true; }
    }

    G_FIELDS.forEach(function (f) {
      checkGrowth(f.id, rawAssump[f.id], f.label);
    });

    if (hasEmpty) return { ok: false, top: MSG_HAS_EMPTY, errors: errors };
    if (hasInvalid) return { ok: false, top: MSG_HAS_INVALID, errors: errors };
    return { ok: true, top: "", errors: [] };
  }

  // ───────────── 화면(app.html에서만 동작) ─────────────
  var FIELDS = [
    { key: "name", label: "종목명(선택)", ph: "예: 예시A" },
    { key: "price", label: "현재가(원)", ph: "예: 60,000" },
    { key: "eps", label: "최근 EPS(원)", ph: "예: 4,500" }
  ];
  var ROW_COUNT = 5;

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // 고른 예시 종목으로 그 줄의 칸을 채운다(칸에 보이는 형식: 쉼표 숫자)
  function fillRow(i, s) {
    document.getElementById("f-" + i + "-name").value = s.name;
    document.getElementById("f-" + i + "-price").value = fmtWon(s.price);
    document.getElementById("f-" + i + "-eps").value = fmtWon(s.eps);
  }

  // 「예시 종목 고르기」 선택 상자 (기본 「직접 입력」). 목록이 없으면 만들지 않는다.
  function buildExamplePicker(i, list) {
    var wrap = el("div", { "class": "example-pick" });
    var selId = "ex-" + i;
    wrap.appendChild(el("label", { "for": selId }, "예시 종목 고르기"));
    var sel = el("select", { id: selId });
    sel.appendChild(el("option", { value: "" }, "직접 입력"));
    list.forEach(function (s) { sel.appendChild(el("option", { value: s.name }, s.name)); });
    sel.addEventListener("change", function () {
      var s = applyExample(sel.value);
      if (!s) return; // 「직접 입력」으로 되돌리면 칸 값은 그대로 둔다
      fillRow(i, s);
    });
    wrap.appendChild(sel);
    wrap.appendChild(el("p", { "class": "example-note" }, MSG_EXAMPLE_NOTE));
    return wrap;
  }

  function buildForm() {
    var box = document.getElementById("rows");
    var examples = getExampleList(global.EXAMPLE_STOCKS);
    // R-06: 예시 목록이 없으면 선택 상자를 그리지 않고 안내 문구만 보여 준다(직접 입력은 그대로)
    var missing = getExampleMessage(global.EXAMPLE_STOCKS);
    var msgBox = document.getElementById("exampleMsg");
    if (msgBox) { msgBox.textContent = missing; msgBox.hidden = missing === ""; }
    for (var i = 0; i < ROW_COUNT; i++) {
      var row = el("div", { "class": "stock-row", "data-row": i });
      row.appendChild(el("p", { "class": "row-title" }, "종목 " + (i + 1)));
      if (examples.length > 0) row.appendChild(buildExamplePicker(i, examples));
      var grid = el("div", { "class": "grid-row" });
      FIELDS.forEach(function (f) {
        var wrap = el("div", { "class": "field" + (f.key === "name" ? " wide" : "") });
        var id = "f-" + i + "-" + f.key;
        wrap.appendChild(el("label", { "for": id }, f.label));
        var input = el("input", { id: id, type: "text", inputmode: f.key === "name" ? "text" : "numeric", autocomplete: "off", placeholder: f.ph, "aria-describedby": "err-" + id });
        wrap.appendChild(input);
        wrap.appendChild(el("p", { "class": "err", id: "err-" + id, hidden: "" }));
        grid.appendChild(wrap);
      });
      row.appendChild(grid);
      box.appendChild(row);
    }
  }

  // R-07: 공통 가정 칸을 기본 시나리오로 미리 채우고 안내 문구를 보여 준다
  function fillDefaults() {
    var d = getDefaults();
    document.getElementById("per-low").value = d.per.low;
    document.getElementById("per-base").value = d.per.base;
    document.getElementById("per-high").value = d.per.high;
    for (var k = 0; k < 3; k++) document.getElementById("g-" + k).value = d.growth[k];
    var note = document.getElementById("defaultsNote");
    if (note) note.textContent = MSG_DEFAULTS_NOTE;
  }

  function val(id) { return document.getElementById(id).value; }

  // 칸에 적힌 글자 그대로 읽는다(빈 줄 포함 5줄)
  function readRawRows() {
    var rows = [];
    for (var i = 0; i < ROW_COUNT; i++) {
      rows.push({ name: val("f-" + i + "-name"), price: val("f-" + i + "-price"), eps: val("f-" + i + "-eps") });
    }
    return rows;
  }
  function readRawAssump() {
    var a = {};
    PER_FIELDS.concat(G_FIELDS).forEach(function (f) { a[f.id] = val(f.id); });
    return a;
  }

  // 사용하는 줄만 숫자로 바꾼다. 빈 줄은 무시한다.
  function toRows(rawRows) {
    var rows = [];
    rawRows.forEach(function (r, i) {
      if (!rowIsUsed(r)) return;
      rows.push({ name: r.name.trim() || "종목 " + (i + 1), price: parseNumber(r.price), eps: parseNumber(r.eps) });
    });
    return rows;
  }
  function toAssump(raw) {
    return {
      per: { low: parseNumber(raw["per-low"]), base: parseNumber(raw["per-base"]), high: parseNumber(raw["per-high"]) },
      growth: [parseNumber(raw["g-0"]), parseNumber(raw["g-1"]), parseNumber(raw["g-2"])]
    };
  }

  function clearErrors() {
    document.getElementById("status").textContent = "";
    Array.prototype.forEach.call(document.querySelectorAll(".err"), function (p) { p.textContent = ""; p.hidden = true; });
    Array.prototype.forEach.call(document.querySelectorAll("input.invalid"), function (i) { i.classList.remove("invalid"); i.removeAttribute("aria-invalid"); });
  }
  function hideResult() {
    document.getElementById("result").hidden = true;
    document.getElementById("resultBody").innerHTML = "";
  }
  function showErrors(v) {
    document.getElementById("status").textContent = v.top;
    var first = null;
    v.errors.forEach(function (e) {
      var p = document.getElementById("err-" + e.id);
      var input = document.getElementById(e.id);
      if (p) { p.textContent = e.message; p.hidden = false; }
      if (input) { input.classList.add("invalid"); input.setAttribute("aria-invalid", "true"); if (!first) first = input; }
    });
    var target = first || document.getElementById("f-0-name");
    if (target) target.focus();
  }

  function render(results) {
    var body = document.getElementById("resultBody");
    body.innerHTML = "";
    buildDisplayRows(results).forEach(function (r) {
      var tr = document.createElement("tr");
      [["stock", r.stock, "종목"], ["period", r.period, "기간"], ["range", r.range, "적정가 범위 (비관 ~ 낙관)"], ["base", r.base, "기준 적정가"], ["gap", r.gap, "현재가 대비"]].forEach(function (c) {
        tr.appendChild(el("td", { "data-label": c[2], "class": "c-" + c[0] }, c[1]));
      });
      body.appendChild(tr);
    });
    document.getElementById("resultTitle").textContent = RESULT_TITLE;
    document.getElementById("rateLine").textContent = formatRateLine(getRateReference(global.KOR_RATES_MONTHLY));
    document.getElementById("disclaimer").textContent = DISCLAIMER;
    document.getElementById("result").hidden = false;
  }

  function onCalc() {
    clearErrors();
    var rawRows = readRawRows();
    var rawAssump = readRawAssump();
    var v = validateInputs(rawRows, rawAssump); // R-02 빈 칸 · R-03 오류 검사
    if (!v.ok) { hideResult(); showErrors(v); return; }
    render(calcAll(toRows(rawRows), toAssump(rawAssump)));
  }

  function init() {
    if (!document.getElementById("calcBtn")) return; // test.html 등에서는 화면을 만들지 않는다
    buildForm();
    fillDefaults();
    // 「계산하기」 버튼(type=submit)과 Enter 키가 모두 form의 submit으로 들어온다
    document.getElementById("calcForm").addEventListener("submit", function (e) { e.preventDefault(); onCalc(); });
  }

  global.FairApp = {
    parseNumber: parseNumber, getDefaults: getDefaults, calcExpectedEps: calcExpectedEps, calcFairPrice: calcFairPrice, calcGap: calcGap, calcAll: calcAll,
    fmtWon: fmtWon, fmtRange: fmtRange, fmtGap: fmtGap, buildDisplayRows: buildDisplayRows,
    getRateReference: getRateReference, formatRateLine: formatRateLine, validateInputs: validateInputs,
    getExampleList: getExampleList, getExampleMessage: getExampleMessage, applyExample: applyExample,
    DISCLAIMER: DISCLAIMER, RESULT_TITLE: RESULT_TITLE, MSG_DEFAULTS_NOTE: MSG_DEFAULTS_NOTE
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(window);
