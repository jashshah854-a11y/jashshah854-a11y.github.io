// Money Map page. Data: data/summary.json (aggregates) and data/orgs.json (one row per org).
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var PROPUBLICA = "https://projects.propublica.org/nonprofits/organizations/";
  var PAGE = 25;

  // ---------- formatting ----------
  function int(n) { return Math.round(n).toLocaleString("en-US"); }
  function pct(x, d) { return (x * 100).toFixed(d == null ? 0 : d) + "%"; }
  function money(n) {
    var a = Math.abs(n);
    if (a >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
    if (a >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
    if (a >= 1e3) return "$" + Math.round(n / 1e3) + "K";
    return "$" + int(n);
  }
  function ein(e) { return e.slice(0, 2) + "-" + e.slice(2); }

  var KEEP = { NY: 1, NYC: 1, NYS: 1, USA: 1, US: 1, YMCA: 1, YWCA: 1, YMHA: 1, YM: 1, YWHA: 1, LLC: 1, PC: 1, UJA: 1,
    AIDS: 1, HIV: 1, SUNY: 1, CUNY: 1, ARC: 1, II: 1, III: 1, IV: 1, PHSP: 1, MLTC: 1, NAACP: 1, CUNYS: 1, WNYC: 1, WNET: 1 };
  var FIX = { ST: "St", MT: "Mt", DR: "Dr", JR: "Jr", CTR: "Ctr", SVCS: "Svcs", SVC: "Svc", BKLYN: "Bklyn", CORP: "Corp" };
  var SMALL = { OF: 1, AND: 1, THE: 1, FOR: 1, IN: 1, ON: 1, AT: 1, TO: 1, A: 1, AN: 1, BY: 1, WITH: 1 };
  function cap(w, first) {
    if (!w) return w;
    var u = w.toUpperCase();
    if (KEEP[u]) return u;
    if (FIX[u]) return FIX[u];
    if (!first && SMALL[u]) return u.toLowerCase();
    if (u.length <= 3 && !/[AEIOUY]/.test(u) && /^[A-Z]+$/.test(u)) return u;
    return u.charAt(0) + u.slice(1).toLowerCase().replace(/'S\b/i, "'s");
  }
  function titleCase(s) {
    return s.split(" ").map(function (w, i) {
      return w.split(/([-/])/).map(function (p, j) { return /[-/]/.test(p) ? p : cap(p, i === 0 && j === 0); }).join("");
    }).join(" ");
  }

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  function sv(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  var S = null;           // summary
  var CAT = {};           // code -> name

  // ---------- Figure 1 ----------
  function drawDist(animate) {
    var box = document.getElementById("dist");
    var tip = box.querySelector(".tip");
    var old = box.querySelector("svg"); if (old) old.remove();
    var st = box.querySelector(".state"); if (st) st.remove();

    var W = box.clientWidth;
    var phone = W < 640;
    var top = phone ? 72 : 48, H = phone ? 300 : 368, axisY = H - 34;
    var noneW = phone ? 34 : 64, gap = phone ? 14 : 26;
    var x0 = noneW + gap, plotW = W - x0;
    var bins = S.bins, max = Math.max.apply(null, bins);
    var bw = plotW / bins.length;
    var y = function (c) { return axisY - (c / max) * (axisY - top); };
    var xAt = function (p) { return x0 + p * plotW; };

    var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, "aria-hidden": "true" });
    if (!animate) svg.style.setProperty("--a", "0");

    // "None" column is not to scale: it would be about 15 times the tallest bar.
    svg.appendChild(sv("rect", { class: "none", x: 0, y: top, width: noneW, height: axisY - top }));
    var by = top + (axisY - top) * 0.32;
    svg.appendChild(sv("path", { d: "M-3 " + (by + 5) + " L" + (noneW + 3) + " " + (by - 5) + " M-3 " + (by + 11) + " L" + (noneW + 3) + " " + (by + 1), stroke: "var(--paper)", "stroke-width": 4 }));
    svg.appendChild(sv("path", { d: "M-3 " + (by + 5) + " L" + (noneW + 3) + " " + (by - 5) + " M-3 " + (by + 11) + " L" + (noneW + 3) + " " + (by + 1), stroke: "var(--graphite)", "stroke-width": 1 }));
    svg.appendChild(sv("text", { x: 0, y: top - 8, class: "strong" }, phone ? int(S.none) : "None: " + int(S.none)));
    svg.appendChild(sv("text", { x: noneW / 2, y: axisY + 18, "text-anchor": "middle" }, "None"));

    // Grid and ticks.
    [0, 0.25, 0.5, 0.75, 1].forEach(function (t) {
      var x = xAt(t);
      if (t > 0 && t < 1 && t !== 0.5) svg.appendChild(sv("line", { class: "grid", x1: x, x2: x, y1: top, y2: axisY }));
      var lbl = sv("text", { x: x, y: axisY + 18, "text-anchor": t === 0 ? "start" : t === 1 ? "end" : "middle" }, Math.round(t * 100) + "%");
      if (t === 1) lbl.setAttribute("class", "red");
      svg.appendChild(lbl);
    });

    // Bars: bin i covers (2i%, 2i+2%]. Red from 50% up, matching "above 50%".
    bins.forEach(function (c, i) {
      var r = sv("rect", { class: "bar" + (i >= 25 ? " hi" : ""), x: x0 + i * bw + 0.5, y: y(c), width: Math.max(1, bw - (phone ? 1 : 2)), height: axisY - y(c) });
      if (animate) r.style.animationDelay = (i * 5) + "ms"; else r.style.animation = "none";
      var label = (i === 0 ? "Above 0%" : "Above " + (i * 2) + "%") + " to " + (i * 2 + 2) + "%: " + int(c) + " orgs";
      r.addEventListener("pointerenter", function () { show(r, label); });
      r.addEventListener("pointerleave", hide);
      r.addEventListener("click", function () { show(r, label); });
      svg.appendChild(r);
    });
    function show(r, label) {
      svg.querySelectorAll(".bar.on").forEach(function (b) { b.classList.remove("on"); });
      r.classList.add("on");
      tip.textContent = label;
      tip.style.display = "block";
      var bx = +r.getAttribute("x") + bw / 2;
      tip.style.left = Math.min(Math.max(bx, 90), W - 90) + "px";
      tip.style.top = (+r.getAttribute("y") + 20) + "px";
    }
    function hide() {
      tip.style.display = "none";
      svg.querySelectorAll(".bar.on").forEach(function (b) { b.classList.remove("on"); });
    }

    svg.appendChild(sv("line", { class: "axis", x1: 0, x2: W, y1: axisY, y2: axisY }));
    svg.appendChild(sv("line", { class: "half", x1: xAt(0.5), x2: xAt(0.5), y1: phone ? 40 : top - 22, y2: axisY }));

    // Brackets tie the side labels to the bins they count.
    function bracket(a, b, cls) {
      var yb = top - 4;
      svg.appendChild(sv("path", { class: "lead" + (cls ? " " + cls : ""), d: "M" + xAt(a) + " " + (yb + 5) + " V" + yb + " H" + xAt(b) + " V" + (yb + 5) }));
    }
    bracket(0, 0.1); bracket(0.9, 1, "red");

    // Annotations, stacked on phones so they never collide.
    var low10 = sv("text", { x: x0, y: phone ? 14 : top - 14, class: "strong" }, "0–10%: " + int(S.low10) + " orgs");
    svg.appendChild(low10);
    var half = sv("text", { x: xAt(0.5) + 8, y: phone ? 32 : top - 14, class: "strong" }, int(S.above50) + " orgs above 50%");
    svg.appendChild(half);
    var hiY = phone ? 50 : top - 14;
    svg.appendChild(sv("text", { x: W, y: hiY, "text-anchor": "end", class: "red" }, int(S.above90) + (phone ? " above 90%" : " get more than 90%")));

    box.insertBefore(svg, tip);
  }

  function distTable() {
    var t = el("table");
    var head = el("tr"); head.appendChild(el("th", null, "Government share")); head.appendChild(el("th", null, "Organizations"));
    t.appendChild(head);
    var r0 = el("tr"); r0.appendChild(el("td", null, "None")); r0.appendChild(el("td", null, int(S.none))); t.appendChild(r0);
    for (var d = 0; d < 10; d++) {
      var c = 0; for (var i = d * 5; i < d * 5 + 5; i++) c += S.bins[i];
      var r = el("tr");
      r.appendChild(el("td", null, (d === 0 ? "Above 0%" : "Above " + d * 10 + "%") + " to " + (d * 10 + 10) + "%"));
      r.appendChild(el("td", null, int(c)));
      t.appendChild(r);
    }
    document.getElementById("dist-table").appendChild(t);
  }

  // ---------- three numbers ----------
  function stats() {
    var box = document.getElementById("stats");
    var items = [
      { big: money(S.govTotal), cls: "", what: "government revenue identified",
        how: "Line 1e grants (" + money(S.gov1e) + ") plus program revenue that names a government payer (" + money(S.govLine2) + "). A lower bound." },
      { big: pct(S.above50GovShare), cls: "gov", what: "of it goes to organizations above 50%",
        how: money(S.govTotal * S.above50GovShare) + " across " + int(S.above50) + " organizations." },
      { big: pct(S.none / S.n), cls: "muted", what: "report none",
        how: int(S.none) + " filers report no government grants and no government-named program revenue." },
    ];
    items.forEach(function (it) {
      var d = el("div", { class: "stat" });
      d.appendChild(el("div", { class: "big " + it.cls }, it.big));
      d.appendChild(el("p", { class: "what" }, it.what));
      d.appendChild(el("p", { class: "how" }, it.how));
      box.appendChild(d);
    });
  }

  // ---------- categories ----------
  var showAll = false;
  function cats() {
    var body = document.getElementById("cats");
    body.textContent = "";
    var list = S.categories;
    var shown = showAll ? list : list.slice(0, 6);
    if (!showAll && !shown.some(function (c) { return c.lowerBound; })) shown = shown.concat(list.filter(function (c) { return c.lowerBound; }));
    shown.forEach(function (c) {
      var rate = c.hi / c.n;
      var tr = el("tr");
      tr.appendChild(el("td", { class: "name" }, c.name));
      tr.appendChild(el("td", { class: "rate" }, (c.lowerBound ? "≥" : "") + pct(rate)));
      var bc = el("td", { class: "barcell" });
      var track = el("div", { class: "track" });
      var fill = el("span", c.lowerBound ? { class: "lb" } : null);
      fill.style.width = (rate * 100) + "%";
      track.appendChild(fill); bc.appendChild(track);
      tr.appendChild(bc);
      tr.appendChild(el("td", { class: "count" }, int(c.hi) + " of " + int(c.n)));
      var sc = el("td", { class: "stripcell" });
      var strip = el("span", { class: "strip", title: c.name + ": organizations with any government revenue, by share in 10-point steps. " + int(c.none) + " report none." });
      var m = Math.max.apply(null, c.strip) || 1;
      c.strip.forEach(function (v, i) {
        var b = el("i", i >= 5 ? { class: "hi" } : null);
        b.style.height = Math.max(1, Math.round(22 * v / m)) + "px";
        strip.appendChild(b);
      });
      sc.appendChild(strip);
      tr.appendChild(sc);
      body.appendChild(tr);
      if (c.lowerBound) {
        tr.className = "lb-row";
        var nr = el("tr", { class: "lb-note" });
        nr.appendChild(el("td"));
        var nc = el("td", { colspan: "4" });
        nc.appendChild(el("span", { class: "note" }, "Lower bound: " + int(c.unknownPayerOrgs) + " health organizations get most of their revenue from patient care that names no payer, so some government money is uncounted."));
        nr.appendChild(nc);
        body.appendChild(nr);
      }
    });
    var btn = document.getElementById("cats-more");
    btn.textContent = showAll ? "Show fewer" : "Show all " + list.length + " categories";
  }

  // ---------- peers ----------
  function dumbbell(row) {
    var d = el("div", { class: "dumb" });
    var l = el("div", { class: "lbl" });
    l.appendChild(el("b", null, row.name));
    l.appendChild(el("small", null, row.def));
    d.appendChild(l);

    var svg = sv("svg", { viewBox: "0 0 400 44", preserveAspectRatio: "none", "aria-label": row.name + ": " + row.fmt(row.dep) + " above 50% government, " + row.fmt(row.peer) + " peers", role: "img" });
    var x = function (v) { return 10 + 380 * v / row.max; };
    svg.appendChild(sv("line", { x1: 10, x2: 390, y1: 14, y2: 14, stroke: "var(--rule)", "stroke-width": 1, "vector-effect": "non-scaling-stroke" }));
    svg.appendChild(sv("line", { x1: x(row.dep), x2: x(row.peer), y1: 14, y2: 14, stroke: "var(--ink)", "stroke-width": 1.5, "vector-effect": "non-scaling-stroke" }));
    // Dots and labels sit in HTML over the stretched SVG so circles stay round.
    var wrapLine = el("div"); wrapLine.style.position = "relative";
    wrapLine.appendChild(svg);
    d.appendChild(wrapLine);
    // Labels point away from each other: the lower value reads left of its dot, the higher right.
    [[row.peer, "var(--graphite)", "", row.peer < row.dep], [row.dep, "var(--gov)", "red", row.dep <= row.peer]].forEach(function (p) {
      var left = (x(p[0]) / 400 * 100) + "%";
      var dot = el("span"); dot.style.cssText = "position:absolute;top:8px;width:12px;height:12px;border-radius:50%;margin-left:-6px;background:" + p[1] + ";left:" + left;
      var t = el("span", null, row.fmt(p[0])); t.style.cssText = "position:absolute;top:24px;transform:translateX(" + (p[3] ? "calc(-100% + 6px)" : "-6px") + ");font-size:12px;white-space:nowrap;left:" + left + ";color:" + (p[2] ? "var(--gov);font-weight:600" : "var(--graphite)");
      wrapLine.appendChild(dot); wrapLine.appendChild(t);
    });

    var r = el("div", { class: "delta" });
    var b = el("b", row.red ? { class: "gov" } : null, row.delta);
    r.appendChild(b);
    r.appendChild(el("small", null, row.cells));
    d.appendChild(r);
    return d;
  }

  function peers() {
    var P = S.peers;
    document.getElementById("peer-groups").textContent = "Peers: same category and revenue band, " + P.cells + " groups";
    var pts = function (a, b) { return Math.abs((a - b) * 100).toFixed(1) + " points " + (a < b ? "lower" : "higher"); };
    var rows = [
      { name: "Overhead share of expenses", def: "Management and general plus fundraising, as a share of total expenses (Part IX, columns C and D).",
        dep: P.overhead.dep, peer: P.overhead.peer, max: 0.3, fmt: function (v) { return pct(v, 1); },
        delta: pts(P.overhead.dep, P.overhead.peer), cells: "Lower in " + P.overhead.cellsLower + " of " + P.cells + " groups" },
      { name: "Staff pay share of expenses", def: "Salaries, benefits, pension and payroll taxes, as a share of total expenses (Part IX, lines 5 to 10).",
        dep: P.pay.dep, peer: P.pay.peer, max: 0.7, fmt: function (v) { return pct(v, 1); }, red: true,
        delta: pts(P.pay.dep, P.pay.peer), cells: "Higher in " + P.pay.cellsHigher + " of " + P.cells + " groups" },
      { name: "Officer pay", def: "Pay to current officers, directors, trustees and key employees, where any is paid (Part IX, line 5).",
        dep: P.officer.dep, peer: P.officer.peer, max: 350000, fmt: money,
        delta: "$" + int(Math.round(Math.abs(P.officer.dep - P.officer.peer) / 100) * 100) + (P.officer.dep < P.officer.peer ? " lower" : " higher"),
        cells: "Higher in " + P.officer.cellsHigher + " of " + P.officer.cells + " groups" },
    ];
    var box = document.getElementById("peers");
    rows.forEach(function (r) { box.appendChild(dumbbell(r)); });
    document.getElementById("peer-note").textContent =
      "Each value is the median inside a peer group, averaged over " + P.cells + " groups and weighted by the number of organizations above 50% in each. " +
      "A group needs at least 10 organizations on each side; together the groups cover " + int(P.orgsCovered) + " of the " + int(S.above50) + " organizations above 50%. " +
      "Organizations with no category code are left out.";
  }

  // ---------- table ----------
  var ORGS = [], view = [], limit = PAGE, sortKey = null, sortDir = -1;
  var F = { ein: 0, name: 1, cat: 2, rev: 3, gs: 4, overhead: 5, payShare: 6, officerPay: 7, gov: 8, lb: 9 };

  function refilter() {
    var q = document.getElementById("q").value.trim().toLowerCase();
    var qd = q.replace(/[^0-9]/g, "");
    var onlyHi = document.getElementById("only-hi").checked;
    view = ORGS.filter(function (o) {
      if (onlyHi && !(o[F.gs] > 0.5)) return false;
      if (!q) return true;
      return o._n.indexOf(q) >= 0 || (qd.length >= 3 && o[F.ein].indexOf(qd) >= 0) || o._c.indexOf(q) >= 0;
    });
    if (sortKey) {
      var k = F[sortKey];
      var txt = sortKey === "name" || sortKey === "cat" || sortKey === "ein";
      view.sort(function (a, b) {
        var x = sortKey === "name" ? a._t : sortKey === "cat" ? a._c : a[k];
        var y = sortKey === "name" ? b._t : sortKey === "cat" ? b._c : b[k];
        if (txt) return sortDir * (x < y ? -1 : x > y ? 1 : 0);
        return sortDir * (x - y);
      });
    }
    limit = PAGE;
    render();
  }

  function render() {
    var body = document.getElementById("rows");
    body.textContent = "";
    var frag = document.createDocumentFragment();
    view.slice(0, limit).forEach(function (o) {
      var tr = el("tr");
      tr.appendChild(el("td", { class: "name" }, o._t));
      tr.appendChild(el("td", { class: "ein mono" }, ein(o[F.ein])));
      tr.appendChild(el("td", { class: "cat" }, CAT[o[F.cat]]));
      tr.appendChild(el("td", { class: "num rev" }, money(o[F.rev])));
      var sc = el("td", { class: "share" });
      var w = el("div", { class: "share-w" });
      w.appendChild(el("b", null, (o[F.lb] ? "≥" : "") + pct(o[F.gs])));
      var tk = el("div", { class: "track" });
      var fl = el("span", o[F.lb] ? { class: "lb" } : null); fl.style.width = (o[F.gs] * 100) + "%";
      tk.appendChild(fl); w.appendChild(tk); sc.appendChild(w); tr.appendChild(sc);
      tr.appendChild(el("td", { class: "num ovh" }, pct(o[F.overhead], 1)));
      tr.appendChild(el("td", { class: "num pay" }, pct(o[F.payShare], 1)));
      var lc = el("td", { class: "link" });
      lc.appendChild(el("a", { href: PROPUBLICA + o[F.ein], target: "_blank", rel: "noopener", "aria-label": "Filings for " + o._t + " on ProPublica" }, "Filing ↗"));
      tr.appendChild(lc);
      frag.appendChild(tr);
    });
    body.appendChild(frag);

    var stEl = document.getElementById("table-state");
    var q = document.getElementById("q").value.trim();
    if (!view.length) {
      stEl.hidden = false;
      stEl.textContent = q ? "No New York 501(c)(3) Form 990 filer matches “" + q + "”." : "No organizations match these filters.";
    } else stEl.hidden = true;
    var shown = Math.min(limit, view.length);
    document.getElementById("count").textContent = !view.length ? "0 matches" : "Showing " + int(shown) + " of " + int(view.length) +
      (view.length === ORGS.length ? (sortKey ? "" : ", largest government revenue first") : " matches");
    var more = document.getElementById("rows-more");
    more.hidden = view.length <= limit;
  }

  function setupTable(rows) {
    ORGS = rows.map(function (r) {
      r._t = titleCase(r[F.name]);
      r._n = r._t.toLowerCase();
      r._c = (CAT[r[F.cat]] || "").toLowerCase();
      return r;
    });
    var q = document.getElementById("q"), hi = document.getElementById("only-hi");
    q.disabled = false; hi.disabled = false;
    var t = null;
    q.addEventListener("input", function () { clearTimeout(t); t = setTimeout(refilter, 120); });
    hi.addEventListener("change", refilter);
    document.getElementById("rows-more").addEventListener("click", function () { limit += PAGE; render(); });
    document.querySelectorAll(".orgs th button").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-sort");
        if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = (k === "name" || k === "cat" || k === "ein") ? 1 : -1; }
        document.querySelectorAll(".orgs th").forEach(function (th) { th.removeAttribute("aria-sort"); });
        b.parentNode.setAttribute("aria-sort", sortDir > 0 ? "ascending" : "descending");
        refilter();
      });
    });
    refilter();
  }

  function fail(where) {
    var msg = el("p", { class: "state" });
    msg.appendChild(document.createTextNode("The data file did not load. "));
    msg.appendChild(el("a", { href: "method.html" }, "The method page"));
    msg.appendChild(document.createTextNode(" describes the data and how to rebuild it."));
    where.textContent = ""; where.appendChild(msg);
  }

  // ---------- boot ----------
  fetch("data/summary.json").then(function (r) { if (!r.ok) throw r; return r.json(); }).then(function (s) {
    S = s;
    s.categories.forEach(function (c) { CAT[c.code] = c.name; });
    document.querySelectorAll("[data-n]").forEach(function (n) { n.textContent = int(s.n); });
    drawDist(true); distTable(); stats(); cats(); peers();
    document.getElementById("cats-more").addEventListener("click", function () { showAll = !showAll; cats(); });
    var rt = null, lastW = document.getElementById("dist").clientWidth;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        var w = document.getElementById("dist").clientWidth;
        if (w !== lastW) { lastW = w; drawDist(false); }
      }, 150);
    });
    return fetch("data/orgs.json").then(function (r) { if (!r.ok) throw r; return r.json(); }).then(setupTable)
      .catch(function () { fail(document.getElementById("table-state")); document.getElementById("table-state").hidden = false; });
  }).catch(function () { fail(document.getElementById("dist")); });
})();
