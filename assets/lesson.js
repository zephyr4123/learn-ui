/*
 * 课程页面公共脚本
 * - 眯眼测试 / 显示标注：给 .demo 切换 class
 * - 度量：直接读浏览器算好的样式（getComputedStyle），统计每个版本的字号、字重、颜色、按钮、对比度
 *   数字都是现场算出来的，不是手写的。
 */
(function () {
  "use strict";

  // ---------- 颜色工具 ----------
  function parseColor(str) {
    if (!str) return null;
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function parseHex(hex) {
    const h = hex.replace("#", "");
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  // 半透明颜色叠在底色上，得到人眼实际看到的颜色
  function over(fg, bg) {
    const a = fg.a;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
  }
  function luminance(c) {
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  // WCAG 2.x 对比度公式
  function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function hsl(c) {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return { s, l };
  }
  function colorKey(c) {
    return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${Math.round(c.a * 100) / 100})`;
  }

  // 元素背后实际的底色：从最外层往里逐层叠加背景色。用渐变/图片做背景的元素，用 data-bg 标出近似底色。
  function effectiveBg(el) {
    const chain = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.push(n);
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = chain.length - 1; i >= 0; i--) {
      const node = chain[i];
      if (node.dataset && node.dataset.bg) { bg = parseHex(node.dataset.bg); continue; }
      const c = parseColor(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0) bg = over(c, bg);
    }
    return bg;
  }

  // ---------- 度量 ----------
  function directText(el) {
    let t = "";
    el.childNodes.forEach((n) => { if (n.nodeType === 3) t += n.textContent; });
    return t.replace(/\s+/g, "");
  }

  function measure(root) {
    const texts = [];
    root.querySelectorAll("*").forEach((el) => {
      if (el.closest("[data-ignore]")) return;
      const t = directText(el);
      if (!t) return;
      if (el.getClientRects().length === 0) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return;
      texts.push({ el, chars: t.length, size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10), color: parseColor(cs.color) });
    });

    const sizes = new Map();
    let total = 0, boldChars = 0;
    const colors = new Set(), vivid = new Set(), weights = new Set();
    let minC = Infinity, minEl = null, fails = 0;

    texts.forEach((t) => {
      const s = Math.round(t.size * 10) / 10;
      sizes.set(s, (sizes.get(s) || 0) + t.chars);
      total += t.chars;
      if (t.weight >= 600) boldChars += t.chars;
      weights.add(t.weight);

      const bg = effectiveBg(t.el);
      const seen = over(t.color, bg);
      colors.add(colorKey(t.color));
      const h = hsl(seen);
      if (h.s > 0.3 && h.l > 0.12 && h.l < 0.9) vivid.add(colorKey(t.color));

      const ratio = contrast(seen, bg);
      // WCAG 大字号：≥24px，或 ≥18.66px 且加粗
      const large = t.size >= 24 || (t.size >= 18.66 && t.weight >= 700);
      if (ratio < (large ? 3 : 4.5)) fails++;
      if (ratio < minC) { minC = ratio; minEl = t.el; }
    });

    // 最常用的字号（按字数加权）≈ 正文字号
    let bodySize = 0, bodyCount = -1;
    sizes.forEach((count, size) => { if (count > bodyCount) { bodyCount = count; bodySize = size; } });
    const maxSize = Math.max(...sizes.keys());

    // 醒目按钮：实心背景，和周围底色反差大，或颜色鲜艳且不浅
    let prominent = 0;
    root.querySelectorAll("button, [data-btn]").forEach((b) => {
      if (b.closest("[data-ignore]")) return;
      const c = parseColor(getComputedStyle(b).backgroundColor);
      if (!c || c.a < 0.5) return;
      const parentBg = effectiveBg(b.parentElement);
      const seen = over(c, parentBg);
      const h = hsl(seen);
      if (contrast(seen, parentBg) >= 2.5 || (h.s > 0.45 && h.l < 0.75)) prominent++;
    });

    return {
      sizes: [...sizes.keys()].sort((a, b) => a - b),
      weights: [...weights].sort((a, b) => a - b),
      colorList: [...colors],
      ratio: maxSize / bodySize,
      bodySize, maxSize,
      boldShare: total ? boldChars / total : 0,
      colors: colors.size,
      vivid: vivid.size,
      prominent,
      minContrast: minC,
      minText: minEl ? directText(minEl).slice(0, 8) : "",
      fails,
    };
  }

  const ROWS = [
    {
      label: "字号种类",
      ref: "≤ 5 种", basis: "经验值",
      cell: (m) => ({ text: `${m.sizes.length} 种`, small: m.sizes.join(" / ") + " px", over: m.sizes.length > 5 }),
    },
    {
      label: "层级落差（最大字号 ÷ 正文字号）",
      ref: "明显拉开，通常 ≥ 1.5 倍", basis: "经验值",
      cell: (m) => ({ text: `${m.ratio.toFixed(2)} 倍`, small: `${m.maxSize} ÷ ${m.bodySize}`, over: m.ratio < 1.5 }),
    },
    {
      label: "加粗文字占比（按字数）",
      ref: "少数才有强调作用", basis: "经验值",
      cell: (m) => ({ text: `${Math.round(m.boldShare * 100)}%`, over: m.boldShare > 0.5 }),
    },
    {
      label: "文字颜色种类",
      ref: "3 级灰 + 1 个强调色，按钮白字另算", basis: "经验值",
      cell: (m) => ({ text: `${m.colors} 种`, over: m.colors > 5 }),
    },
    {
      label: "其中彩色文字种类",
      ref: "1–2 种（强调色 + 语义色）", basis: "经验值",
      cell: (m) => ({ text: `${m.vivid} 种`, over: m.vivid > 2 }),
    },
    {
      label: "醒目（实心）按钮数",
      ref: "一个视图 1–2 个，同一组按钮里只给 1 个", basis: "Apple HIG",
      cell: (m) => ({ text: `${m.prominent} 个`, over: m.prominent > 2 }),
    },
    {
      label: "最低文字对比度",
      ref: "正文 ≥ 4.5:1，大字 ≥ 3:1", basis: "WCAG 2.2 AA", hard: true,
      cell: (m) => ({
        text: `${m.minContrast.toFixed(2)}:1`,
        small: m.fails ? `不达标 ${m.fails} 处，最低是「${m.minText}」` : "全部达标",
        over: m.fails > 0,
      }),
    },
  ];

  function renderMetrics(demo) {
    const box = demo.querySelector(".metrics");
    if (!box) return;
    const frames = [...demo.querySelectorAll(".frame")];
    const results = frames.map((f) => ({ name: f.dataset.version, m: measure(f.querySelector(".screen-body, .browser-body")) }));

    let html = "<table><thead><tr><th>指标</th>";
    results.forEach((r) => { html += `<th>${r.name}</th>`; });
    html += "<th>参考线</th></tr></thead><tbody>";
    ROWS.forEach((row) => {
      html += `<tr><td>${row.label}</td>`;
      results.forEach((r) => {
        const c = row.cell(r.m);
        html += `<td class="v${c.over ? " over" : ""}">${c.text}${c.small ? `<small>${c.small}</small>` : ""}</td>`;
      });
      html += `<td class="ref">${row.ref}<span class="basis${row.hard ? " hard" : ""}">${row.basis}</span></td></tr>`;
    });
    html += "</tbody></table>";
    html += `<p class="metrics-note">以上数字由浏览器现场读取样式算出（标红 = 超出参考线）。"经验值"是业内常用做法，不是硬标准；只有对比度来自正式标准 WCAG。状态栏和外框不计入。</p>`;
    box.innerHTML = html;
  }

  // ---------- 控件 ----------
  document.querySelectorAll(".demo").forEach((demo) => {
    demo.querySelectorAll("[data-action]").forEach((btn) => {
      const initial = demo.classList.contains("is-" + btn.dataset.action);
      btn.setAttribute("aria-pressed", String(initial));
      if (initial && btn.dataset.action === "metrics") renderMetrics(demo);
      btn.addEventListener("click", () => {
        const cls = "is-" + btn.dataset.action;
        const on = !demo.classList.contains(cls);
        demo.classList.toggle(cls, on);
        btn.setAttribute("aria-pressed", String(on));
        if (btn.dataset.action === "metrics" && on) renderMetrics(demo);
      });
    });
  });

  // 状态栏图标（信号 / Wi-Fi / 电池），各页面共用
  const ICONS =
    '<svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>' +
    '<svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><path d="M8 2.6c2.3 0 4.4.9 6 2.4l1.2-1.3A10.4 10.4 0 0 0 8 .8 10.4 10.4 0 0 0 .8 3.7L2 5c1.6-1.5 3.7-2.4 6-2.4Zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.2-1.3A6.7 6.7 0 0 0 8 4.4c-1.8 0-3.4.7-4.6 1.8l1.2 1.3C5.5 6.7 6.7 6.2 8 6.2Zm0 3.5c-.5 0-1 .2-1.3.5L8 11.6l1.3-1.4c-.3-.3-.8-.5-1.3-.5Z"/></svg>' +
    '<svg width="27" height="13" viewBox="0 0 27 13" aria-hidden="true"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2"/><path d="M25 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2Z" opacity=".45"/></svg>';
  document.querySelectorAll(".statusbar .icons").forEach((el) => { el.innerHTML = ICONS; });

  // 给单页脚本复用
  window.UILesson = { measure, parseColor, contrast };
})();
