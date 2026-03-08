const dataset = window.RICHEST_PARTNER_DATA;
if (!dataset || !Array.isArray(dataset.rows)) {
  throw new Error("Missing dataset. Run build_dataset.py first.");
}

const state = {
  query: "",
  sort: "rank",
  minWorth: 0,
};

const controls = {
  search: document.getElementById("search"),
  sort: document.getElementById("sort"),
  minWorth: document.getElementById("min-worth"),
  worthLabel: document.getElementById("worth-label"),
  reset: document.getElementById("reset"),
};

const tableBody = document.getElementById("rows");
const scatter = document.getElementById("scatter");

function filteredRows() {
  let rows = dataset.rows.filter((row) => {
    const matchesWorth = row.worth_billion_usd >= state.minWorth;
    const q = state.query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      row.person_name.toLowerCase().includes(q) ||
      row.partner_name.toLowerCase().includes(q);
    return matchesWorth && matchesQuery;
  });

  rows = [...rows];
  if (state.sort === "rank") {
    rows.sort((a, b) => a.rank - b.rank);
  } else if (state.sort === "worth") {
    rows.sort((a, b) => b.worth_billion_usd - a.worth_billion_usd);
  } else if (state.sort === "partner_age") {
    rows.sort((a, b) => b.partner_age - a.partner_age);
  } else if (state.sort === "age_gap") {
    rows.sort((a, b) => b.age_gap_partner_minus_billionaire - a.age_gap_partner_minus_billionaire);
  }
  return rows;
}

function avg(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function renderMetrics(rows) {
  if (!rows.length) {
    document.getElementById("avg-worth").textContent = "-";
    document.getElementById("avg-rich-age").textContent = "-";
    document.getElementById("avg-partner-age").textContent = "-";
    document.getElementById("avg-gap").textContent = "-";
    return;
  }
  document.getElementById("avg-worth").textContent = `${avg(rows.map((r) => r.worth_billion_usd)).toFixed(1)}B`;
  document.getElementById("avg-rich-age").textContent = `${avg(rows.map((r) => r.billionaire_age)).toFixed(1)}`;
  document.getElementById("avg-partner-age").textContent = `${avg(rows.map((r) => r.partner_age)).toFixed(1)}`;
  document.getElementById("avg-gap").textContent = `${avg(rows.map((r) => r.age_gap_partner_minus_billionaire)).toFixed(1)}`;
}

function renderTable(rows) {
  tableBody.innerHTML = "";
  rows.forEach((row) => {
    const gapClass = row.age_gap_partner_minus_billionaire >= 0 ? "positive" : "negative";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>#${row.rank}</td>
      <td>${row.person_name}</td>
      <td>${row.worth_billion_usd.toFixed(1)}</td>
      <td>${row.billionaire_age}</td>
      <td>${row.partner_name}</td>
      <td>${row.partner_age}</td>
      <td class="${gapClass}">${row.age_gap_partner_minus_billionaire}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function renderScatter(rows) {
  const w = 680;
  const h = 360;
  const pad = { top: 24, right: 20, bottom: 40, left: 54 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  scatter.innerHTML = "";

  if (!rows.length) {
    return;
  }

  const worthValues = rows.map((r) => r.worth_billion_usd);
  const partnerAgeValues = rows.map((r) => r.partner_age);
  const minX = Math.min(...worthValues) - 5;
  const maxX = Math.max(...worthValues) + 5;
  const minY = Math.min(...partnerAgeValues) - 2;
  const maxY = Math.max(...partnerAgeValues) + 2;

  const x = (value) => pad.left + ((value - minX) / (maxX - minX || 1)) * innerW;
  const y = (value) => pad.top + innerH - ((value - minY) / (maxY - minY || 1)) * innerH;

  const axisColor = "#8ea0ba";
  const draw = (tag, attrs) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    scatter.appendChild(el);
    return el;
  };

  draw("line", { x1: pad.left, y1: pad.top + innerH, x2: pad.left + innerW, y2: pad.top + innerH, stroke: axisColor });
  draw("line", { x1: pad.left, y1: pad.top, x2: pad.left, y2: pad.top + innerH, stroke: axisColor });

  for (let i = 0; i <= 4; i += 1) {
    const t = i / 4;
    const xVal = minX + t * (maxX - minX);
    const yVal = minY + t * (maxY - minY);
    const xPos = x(xVal);
    const yPos = y(yVal);

    draw("line", { x1: xPos, y1: pad.top + innerH, x2: xPos, y2: pad.top + innerH + 5, stroke: axisColor });
    draw("line", { x1: pad.left - 5, y1: yPos, x2: pad.left, y2: yPos, stroke: axisColor });

    const xt = draw("text", { x: xPos, y: pad.top + innerH + 18, fill: "#5f6f87", "text-anchor": "middle", "font-size": "11" });
    xt.textContent = xVal.toFixed(0);
    const yt = draw("text", { x: pad.left - 9, y: yPos + 3, fill: "#5f6f87", "text-anchor": "end", "font-size": "11" });
    yt.textContent = yVal.toFixed(0);
  }

  const xLabel = draw("text", {
    x: pad.left + innerW / 2,
    y: h - 10,
    fill: "#33415c",
    "text-anchor": "middle",
    "font-size": "12",
  });
  xLabel.textContent = "Worth (USD billions)";

  const yLabel = draw("text", {
    x: 14,
    y: pad.top + innerH / 2,
    fill: "#33415c",
    "text-anchor": "middle",
    "font-size": "12",
    transform: `rotate(-90, 14, ${pad.top + innerH / 2})`,
  });
  yLabel.textContent = "Partner age";

  rows.forEach((row) => {
    const circle = draw("circle", {
      cx: x(row.worth_billion_usd),
      cy: y(row.partner_age),
      r: 6,
      fill: "#0b7285",
      opacity: "0.85",
      stroke: "#083344",
      "stroke-width": "1",
    });
    const tip = document.createElementNS("http://www.w3.org/2000/svg", "title");
    tip.textContent = `${row.person_name}: worth ${row.worth_billion_usd}B, partner age ${row.partner_age}`;
    circle.appendChild(tip);
  });
}

function render() {
  const rows = filteredRows();
  renderMetrics(rows);
  renderTable(rows);
  renderScatter(rows);
  controls.worthLabel.textContent = `$${state.minWorth}B`;
}

function setup() {
  const subtitle = document.getElementById("subhead");
  subtitle.textContent =
    `As of ${dataset.as_of_date}. Data skips people with unknown partner age and keeps the richest-ranked 10 with full fields.`;

  controls.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });
  controls.sort.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });
  controls.minWorth.addEventListener("input", (event) => {
    state.minWorth = Number(event.target.value);
    render();
  });
  controls.reset.addEventListener("click", () => {
    state.query = "";
    state.sort = "rank";
    state.minWorth = 0;
    controls.search.value = "";
    controls.sort.value = "rank";
    controls.minWorth.value = "0";
    render();
  });

  render();
}

setup();
