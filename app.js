// app.js — F-01 기간별 적정가 범위 계산 (계산·검증·표시 함수)
// 구현된 요구사항: R-01 정상 · R-02 빈값 · R-03 오류 · R-04 데이터 없음 · R-05 예시 종목 선택 · R-06 예시 목록 없음.
// 서버·외부 요청·라이브러리 없음. 계산은 아래 함수가 한다(화면에 쓰는 값을 손으로 적지 않는다).
(function (global) {
  "use strict";

  var PERIODS = ["단기", "중기", "장기"];
  var DISCLAIMER = "주가 예측이 아니라 입력한 가정에 따른 시나리오이며, 종목 추천이나 매수·매도 권유가 아닙니다.";
  var RESULT_TITLE = "기간별 적정가 범위 (입력한 가정에 따른 시나리오)";
  // R-04 데이터 없음: 금리 참고 줄만 이 문구로 바꾸고 계산은 그대로 한다
  var MSG_RATE_MISSING = "금리 자료를 불러오지 못했습니다. 계산은 그대로 사용할 수 있습니다.";
  // R-05 예시 종목(가상) 안내 문구
  var MSG_EXAMPLE_NOTE = "직접 만든 예시 종목이며 실제 종목이 아닙니다. 값은 자유롭게 고칠 수 있어요.";
  var MSG_EXAMPLE_MISSING = "예시 종목을 불러오지 못했습니다. 값을 직접 입력해 주세요.";

  // R-02 빈값 안내 문구 (화면에 나오는 문장 그대로)
  var MSG_NO_ROWS = "종목 정보를 한 줄 이상 입력해 주세요.";
  var MSG_HAS_EMPTY = "빈 칸이 있어 계산하지 않았습니다. 표시된 칸을 채워 주세요.";
  var MSG_PRICE_EMPTY = "현재가를 입력해 주세요.";
  // R-03 오류 안내 문구 (화면에 나오는 문장 그대로)
  var MSG_HAS_INVALID = "입력값을 확인해 주세요. 표시된 칸을 고친 뒤 다시 계산해 주세요.";
  var MSG_NOT_NUMBER = "숫자만 입력해 주세요. (예: 60000)";
  var MSG_PRICE_POSITIVE = "현재가는 0보다 큰 숫자여야 합니다.";
  var MSG_EPS_POSITIVE = "예상 EPS는 0보다 큰 숫자여야 합니다.";
  var MSG_PER_POSITIVE = "목표 PER은 0보다 큰 숫자여야 합니다.";
  var MSG_PER_ORDER = "목표 PER은 비관 ≤ 기준 ≤ 낙관 순서로 입력해 주세요.";
  var PER_FIELDS = [
    { id: "per-low", label: "비관" },
    { id: "per-base", label: "기준" },
    { id: "per-high", label: "낙관" }
  ];

  // 「60,000」 같은 쉼표 숫자를 받는다. 숫자가 아니면 NaN.
  function parseNumber(text) {
    if (typeof text === "number") return isFinite(text) ? text : NaN;
    var s = String(text === undefined || text === null ? "" : text).replace(/,/g, "").trim();
    if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  }

  // 적정가 = 예상 EPS × 목표 PER, 원 단위 반올림
  function calcFairPrice(eps, per) {
    return Math.round(eps * per);
  }

  // 차이(%) = (기준 적정가 − 현재가) ÷ 현재가 × 100, 소수 첫째 자리 반올림
  function calcGap(fair, price) {
    var g = Math.round(((fair - price) / price) * 100 * 10) / 10;
    return g === 0 ? 0 : g;
  }

  // rows: [{name, price, eps:[단기,중기,장기]}], per: {low, base, high}
  function calcAll(rows, per) {
    return rows.map(function (r) {
      return {
        name: r.name,
        price: r.price,
        periods: PERIODS.map(function (label, i) {
          var low = calcFairPrice(r.eps[i], per.low);
          var base = calcFairPrice(r.eps[i], per.base);
          var high = calcFairPrice(r.eps[i], per.high);
          return { label: label, low: low, base: base, high: high, gap: calcGap(base, r.price) };
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

  // ───────────── R-05 예시 종목(가상) ─────────────
  // data.js의 window.EXAMPLE_STOCKS = [{name, price, eps:[단기,중기,장기]}, ...]
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
      if (items[i].name === name) return { name: items[i].name, price: items[i].price, eps: items[i].eps.slice() };
    }
    return null;
  }

  // ───────────── R-02 빈값 · R-03 오류 검사 ─────────────
  // rawRows: [{name, price, eps:[단기,중기,장기]}] 칸에 적힌 글자 그대로(문자열)
  // rawPer : {"per-low":"", "per-base":"", "per-high":""}
  // 반환: {ok, top, errors:[{id, message}]} — id는 화면 칸의 id, message는 그 칸 아래에 나올 문장
  // 상단 문구: 종목 줄이 하나도 없으면 MSG_NO_ROWS, 빈 칸이 있으면 MSG_HAS_EMPTY(빈 칸과 오류가 함께 있어도 이쪽), 오류만 있으면 MSG_HAS_INVALID
  function isBlank(s) {
    return String(s === undefined || s === null ? "" : s).trim() === "";
  }
  function rowIsUsed(r) {
    return !isBlank(r.name) || !isBlank(r.price) || r.eps.some(function (x) { return !isBlank(x); });
  }
  function validateInputs(rawRows, rawPer) {
    var used = [];
    rawRows.forEach(function (r, i) { if (rowIsUsed(r)) used.push(i); });
    if (used.length === 0) return { ok: false, top: MSG_NO_ROWS, errors: [] };

    var errors = [];
    var hasEmpty = false, hasInvalid = false;

    // 한 칸 검사: 비어 있으면 R-02 문구, 값이 있는데 숫자가 아니거나 0 이하면 R-03 문구
    function check(id, text, emptyMsg, positiveMsg) {
      if (isBlank(text)) { errors.push({ id: id, message: emptyMsg }); hasEmpty = true; return; }
      var n = parseNumber(text);
      if (isNaN(n)) { errors.push({ id: id, message: MSG_NOT_NUMBER }); hasInvalid = true; return; }
      if (n <= 0) { errors.push({ id: id, message: positiveMsg }); hasInvalid = true; }
    }

    used.forEach(function (i) {
      var r = rawRows[i];
      check("f-" + i + "-price", r.price, MSG_PRICE_EMPTY, MSG_PRICE_POSITIVE);
      r.eps.forEach(function (x, k) {
        check("f-" + i + "-eps" + k, x, PERIODS[k] + " 예상 EPS를 입력해 주세요.", MSG_EPS_POSITIVE);
      });
    });
    PER_FIELDS.forEach(function (f) {
      check(f.id, rawPer[f.id], f.label + " 목표 PER을 입력해 주세요.", MSG_PER_POSITIVE);
    });

    // 세 PER이 모두 올바른 숫자일 때만 순서를 본다: 비관 ≤ 기준 ≤ 낙관 (안내는 낙관 칸 아래)
    var perErr = errors.some(function (e) { return e.id.indexOf("per-") === 0; });
    if (!perErr) {
      var lo = parseNumber(rawPer["per-low"]), ba = parseNumber(rawPer["per-base"]), hi = parseNumber(rawPer["per-high"]);
      if (!(lo <= ba && ba <= hi)) { errors.push({ id: "per-high", message: MSG_PER_ORDER }); hasInvalid = true; }
    }

    if (hasEmpty) return { ok: false, top: MSG_HAS_EMPTY, errors: errors };
    if (hasInvalid) return { ok: false, top: MSG_HAS_INVALID, errors: errors };
    return { ok: true, top: "", errors: [] };
  }

  // ───────────── 화면(app.html에서만 동작) ─────────────
  var FIELDS = [
    { key: "name", label: "종목명(선택)", ph: "예: 예시A" },
    { key: "price", label: "현재가(원)", ph: "예: 60,000" },
    { key: "eps0", label: "예상 EPS 단기", ph: "예: 4,000" },
    { key: "eps1", label: "예상 EPS 중기", ph: "예: 4,500" },
    { key: "eps2", label: "예상 EPS 장기", ph: "예: 5,000" }
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
    for (var k = 0; k < 3; k++) document.getElementById("f-" + i + "-eps" + k).value = fmtWon(s.eps[k]);
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
      var grid = el("div", { "class": "grid5" });
      FIELDS.forEach(function (f) {
        var wrap = el("div", { "class": "field" });
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

  function val(id) { return document.getElementById(id).value; }

  // 칸에 적힌 글자 그대로 읽는다(빈 줄 포함 5줄)
  function readRawRows() {
    var rows = [];
    for (var i = 0; i < ROW_COUNT; i++) {
      rows.push({
        name: val("f-" + i + "-name"),
        price: val("f-" + i + "-price"),
        eps: [val("f-" + i + "-eps0"), val("f-" + i + "-eps1"), val("f-" + i + "-eps2")]
      });
    }
    return rows;
  }
  function readRawPer() {
    var per = {};
    PER_FIELDS.forEach(function (f) { per[f.id] = val(f.id); });
    return per;
  }

  // 사용하는 줄만 숫자로 바꾼다. 빈 줄은 무시한다.
  function toRows(rawRows) {
    var rows = [];
    rawRows.forEach(function (r, i) {
      if (!rowIsUsed(r)) return;
      rows.push({ name: r.name.trim() || "종목 " + (i + 1), price: parseNumber(r.price), eps: r.eps.map(parseNumber) });
    });
    return rows;
  }
  function toPer(rawPer) {
    return { low: parseNumber(rawPer["per-low"]), base: parseNumber(rawPer["per-base"]), high: parseNumber(rawPer["per-high"]) };
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
    var rawPer = readRawPer();
    var v = validateInputs(rawRows, rawPer); // R-02 빈 칸 · R-03 오류 검사
    if (!v.ok) { hideResult(); showErrors(v); return; }
    render(calcAll(toRows(rawRows), toPer(rawPer)));
  }

  function init() {
    if (!document.getElementById("calcBtn")) return; // test.html 등에서는 화면을 만들지 않는다
    buildForm();
    // 「계산하기」 버튼(type=submit)과 Enter 키가 모두 form의 submit으로 들어온다
    document.getElementById("calcForm").addEventListener("submit", function (e) { e.preventDefault(); onCalc(); });
  }

  global.FairApp = {
    parseNumber: parseNumber, calcFairPrice: calcFairPrice, calcGap: calcGap, calcAll: calcAll,
    fmtWon: fmtWon, fmtRange: fmtRange, fmtGap: fmtGap, buildDisplayRows: buildDisplayRows,
    getRateReference: getRateReference, formatRateLine: formatRateLine, validateInputs: validateInputs,
    getExampleList: getExampleList, getExampleMessage: getExampleMessage, applyExample: applyExample,
    DISCLAIMER: DISCLAIMER, RESULT_TITLE: RESULT_TITLE
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(window);
