/* ============================================================
 * charts.js —— 手绘 Canvas 图表
 * ------------------------------------------------------------
 * 全部用原生 Canvas 2D 画，不依赖任何第三方库，断网也能正常显示。
 * 提供三种图：radar 雷达图、donut 环形进度、bars 横向条形图。
 * 每次绘制都会登记到 registry，窗口缩放时自动按新尺寸重画。
 * ============================================================ */
window.AICS = window.AICS || {};

(function (AICS) {
  'use strict';

  var registry = [];

  /* 统一处理高清屏缩放，返回已经按 dpr 缩放好的绘图上下文和逻辑尺寸 */
  function prepare(canvas, fallbackHeight) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || canvas.parentNode.clientWidth || 480;
    var h = canvas.clientHeight || fallbackHeight || 320;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  /* 把一个绘图任务登记下来，窗口变化时可以重放 */
  function register(canvas, fn) {
    registry = registry.filter(function (item) { return item.canvas !== canvas; });
    registry.push({ canvas: canvas, fn: fn });
  }

  /* 主题色，从 CSS 变量里读，保证跟随主题切换 */
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v && v.trim()) || fallback;
  }

  /* ---------- 雷达图 ----------
     config = {
       axes: ['数学','编程',...],                  // 轴标签
       series: [{ name, values: [0~100], color }]  // 一组或多组对比数据
       max: 100
     } */
  function radar(canvas, config) {
    var draw = function () {
      var p = prepare(canvas, 340);
      var ctx = p.ctx, w = p.w, h = p.h;
      var axes = config.axes || [];
      var series = config.series || [];
      var max = config.max || 100;
      var n = axes.length;
      if (!n) return;

      /* 窄屏上要留出更多边距、用更小的字，否则八个轴标签会挤在一起 */
      var compact = w < 420;
      var pad = compact ? 28 : 46;
      var cx = w / 2, cy = h / 2 + (compact ? 2 : 6);
      var radius = Math.min(w, h) / 2 - pad;
      if (radius < 34) radius = 34;

      var gridColor = cssVar('--chart-grid', 'rgba(255,255,255,0.10)');
      var axisColor = cssVar('--chart-axis', 'rgba(255,255,255,0.16)');
      var textColor = cssVar('--text-muted', '#8b97b0');

      /* 每个轴的角度，从正上方开始顺时针 */
      function angleOf(i) {
        return -Math.PI / 2 + (Math.PI * 2 * i) / n;
      }
      function pointOf(i, ratio) {
        var a = angleOf(i);
        return [cx + Math.cos(a) * radius * ratio, cy + Math.sin(a) * radius * ratio];
      }

      /* 背景网格：四圈同心多边形 */
      var rings = 4;
      ctx.lineWidth = 1;
      for (var r = 1; r <= rings; r++) {
        ctx.beginPath();
        for (var i = 0; i < n; i++) {
          var pt = pointOf(i, r / rings);
          if (i === 0) ctx.moveTo(pt[0], pt[1]); else ctx.lineTo(pt[0], pt[1]);
        }
        ctx.closePath();
        ctx.strokeStyle = r === rings ? axisColor : gridColor;
        ctx.stroke();
      }

      /* 从中心射出的轴线 */
      for (var k = 0; k < n; k++) {
        var end = pointOf(k, 1);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(end[0], end[1]);
        ctx.strokeStyle = gridColor;
        ctx.stroke();
      }

      /* 轴标签放在最外圈稍微靠外的位置 */
      ctx.fillStyle = textColor;
      ctx.font = (compact ? 10 : 12) + 'px system-ui, -apple-system, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var labelRatio = compact ? 1.13 : 1.19;
      for (var m = 0; m < n; m++) {
        var lp = pointOf(m, labelRatio);
        ctx.fillText(axes[m], lp[0], lp[1]);
      }

      /* 每组数据画一个多边形 */
      series.forEach(function (s) {
        var vals = s.values || [];
        ctx.beginPath();
        for (var i2 = 0; i2 < n; i2++) {
          var ratio = Math.max(0, Math.min(1, (vals[i2] || 0) / max));
          var q = pointOf(i2, ratio);
          if (i2 === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
        }
        ctx.closePath();
        ctx.fillStyle = s.color + '33';       // 半透明填充
        ctx.fill();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        /* 在每个顶点画一个小圆点 */
        for (var j = 0; j < n; j++) {
          var ratio2 = Math.max(0, Math.min(1, (vals[j] || 0) / max));
          var d = pointOf(j, ratio2);
          ctx.beginPath();
          ctx.arc(d[0], d[1], 3, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.fill();
        }
      });
    };
    draw();
    register(canvas, draw);
  }

  /* ---------- 环形进度 ----------
     opts = { label, sub, color, size } */
  function donut(canvas, percent, opts) {
    opts = opts || {};
    var draw = function () {
      var p = prepare(canvas, 160);
      var ctx = p.ctx, w = p.w, h = p.h;
      var cx = w / 2, cy = h / 2;
      var radius = Math.min(w, h) / 2 - 12;
      var lineWidth = opts.size || 12;
      var value = Math.max(0, Math.min(100, percent || 0));

      /* 底层轨道 */
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = cssVar('--chart-grid', 'rgba(255,255,255,0.10)');
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      /* 进度弧，从正上方顺时针 */
      if (value > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (value / 100));
        ctx.strokeStyle = opts.color || cssVar('--accent', '#00e5ff');
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      /* 中间的大数字 */
      ctx.fillStyle = cssVar('--text', '#e8edf7');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 ' + Math.round(radius * 0.52) + 'px system-ui, -apple-system, sans-serif';
      ctx.fillText(Math.round(value), cx, cy - 4);

      if (opts.label) {
        ctx.fillStyle = cssVar('--text-muted', '#8b97b0');
        ctx.font = '12px system-ui, -apple-system, "Microsoft YaHei", sans-serif';
        ctx.fillText(opts.label, cx, cy + radius * 0.45);
      }
    };
    draw();
    register(canvas, draw);
  }

  /* ---------- 横向条形图 ----------
     items = [{ label, value, max, color, note }] */
  function bars(canvas, items, opts) {
    opts = opts || {};
    var draw = function () {
      var rowH = opts.rowHeight || 34;
      canvas.style.height = (items.length * rowH + 8) + 'px';
      var p = prepare(canvas, items.length * rowH + 8);
      var ctx = p.ctx, w = p.w;
      var labelW = opts.labelWidth || 96;
      var valueW = 54;
      var trackX = labelW;
      var trackW = Math.max(40, w - labelW - valueW);

      ctx.font = '13px system-ui, -apple-system, "Microsoft YaHei", sans-serif';
      ctx.textBaseline = 'middle';

      items.forEach(function (item, i) {
        var y = i * rowH + rowH / 2 + 4;
        var max = item.max || 100;
        var ratio = Math.max(0, Math.min(1, (item.value || 0) / max));

        /* 左侧标签 */
        ctx.fillStyle = cssVar('--text-muted', '#8b97b0');
        ctx.textAlign = 'right';
        ctx.fillText(item.label, labelW - 12, y);

        /* 灰色轨道 */
        var trackH = 10;
        ctx.fillStyle = cssVar('--chart-grid', 'rgba(255,255,255,0.10)');
        roundRect(ctx, trackX, y - trackH / 2, trackW, trackH, trackH / 2);
        ctx.fill();

        /* 实际数值条 */
        var barW = Math.max(2, trackW * ratio);
        ctx.fillStyle = item.color || cssVar('--accent', '#00e5ff');
        roundRect(ctx, trackX, y - trackH / 2, barW, trackH, trackH / 2);
        ctx.fill();

        /* 右侧数值 */
        ctx.fillStyle = cssVar('--text', '#e8edf7');
        ctx.textAlign = 'left';
        ctx.fillText(Math.round(item.value) + (opts.suffix || ''), trackX + trackW + 10, y);
      });
    };
    draw();
    register(canvas, draw);
  }

  /* ---------- 折线图（成长曲线用） ----------
     config = {
       labels: ['1/5', '3/2', ...],                 // 横轴刻度
       series: [{ name, values: [0~100], color }],  // 一条或多条线
       max: 100
     } */
  function line(canvas, config) {
    var draw = function () {
      var p = prepare(canvas, 260);
      var ctx = p.ctx, w = p.w, h = p.h;
      var labels = config.labels || [];
      var series = config.series || [];
      var max = config.max || 100;
      var n = labels.length;
      if (!n || !series.length) return;

      var padL = 32, padR = 12, padT = 12, padB = 24;
      var plotW = Math.max(20, w - padL - padR);
      var plotH = Math.max(20, h - padT - padB);
      var gridColor = cssVar('--chart-grid', 'rgba(255,255,255,0.10)');
      var textColor = cssVar('--text-muted', '#8b97b0');

      /* 只有一个数据点时画在正中间 */
      function xAt(i) { return n === 1 ? padL + plotW / 2 : padL + plotW * i / (n - 1); }
      function yAt(v) {
        var ratio = Math.max(0, Math.min(1, (v || 0) / max));
        return padT + plotH - plotH * ratio;
      }

      /* 横向网格线和纵轴刻度 */
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (var g = 0; g <= 4; g++) {
        var y = padT + plotH - plotH * g / 4;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = textColor;
        ctx.fillText(String(Math.round(max * g / 4)), padL - 6, y);
      }

      /* 横轴标签：点太多时抽稀显示，避免重叠 */
      var step = Math.max(1, Math.ceil(n / 8));
      ctx.textBaseline = 'top';
      for (var i = 0; i < n; i++) {
        if (i % step !== 0 && i !== n - 1) continue;
        /* 首尾两个标签要贴边对齐，不能居中。
           首尾两个点正好落在绘图区的左右边缘上，居中画的话有一半会跑到
           画布外面。原来标签只有「10/5」这么短，溢出的十几个像素看不出来；
           同一天有多条记录时标签变成「10/5 13:43」，右半边整个被切掉——
           实测截图里显示成「10/5 13:」。 */
        ctx.textAlign = (n === 1) ? 'center' : (i === 0 ? 'left' : (i === n - 1 ? 'right' : 'center'));
        ctx.fillStyle = textColor;
        ctx.fillText(labels[i], xAt(i), padT + plotH + 7);
      }

      /* 逐条画线 */
      series.forEach(function (s) {
        var vals = s.values || [];
        ctx.beginPath();
        for (var j = 0; j < n; j++) {
          if (j === 0) ctx.moveTo(xAt(j), yAt(vals[j]));
          else ctx.lineTo(xAt(j), yAt(vals[j]));
        }
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        /* 数据点 */
        for (var k = 0; k < n; k++) {
          ctx.beginPath();
          ctx.arc(xAt(k), yAt(vals[k]), n > 20 ? 2 : 3, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.fill();
        }
      });
    };
    draw();
    register(canvas, draw);
  }

  /* ---------- 四年时间轴 ----------
     config = {
       stages:     [{ year, color, done, total, percent }],
       position:   0~1，0 = 刚入学、1 = 毕业；null 表示年级没填
       milestones: [{ abs, name }]，abs 是入学后第几个月
     }

     只画色带、主轴和刻度，**文字说明全部交给 DOM**。两个原因：
       · 轴上的标签挤不下——大三暑假在第 34 个月、秋招在第 36 个月，
         只差两个月，两行字会直接叠在一起
       · 文字放进 DOM 才能自动换行、能被读屏软件读出来；
         画在 canvas 上就是一张图，对读屏等于不存在 */
  function timeline(canvas, config) {
    var draw = function () {
      var p = prepare(canvas, 88);
      var ctx = p.ctx, w = p.w;
      var stages = config.stages || [];
      if (!stages.length) return;

      var padL = 5, padR = 5, padT = 8;
      var bandH = 46;
      var axisY = padT + bandH + 7;
      var trackW = Math.max(40, w - padL - padR);
      var unit = trackW / 48;                 // 一个月占多少像素

      var gridColor = cssVar('--chart-grid', 'rgba(255,255,255,0.10)');
      var axisColor = cssVar('--chart-axis', 'rgba(255,255,255,0.18)');
      var textColor = cssVar('--text-muted', '#8b97b0');
      var textStrong = cssVar('--text', '#e8eef8');
      var compact = w < 460;

      /* 四个学年的色带 */
      stages.forEach(function (s, i) {
        var x = padL + i * 12 * unit;
        var bw = 12 * unit;

        ctx.fillStyle = gridColor;
        roundRect(ctx, x + 1, padT, bw - 2, bandH, 7);
        ctx.fill();

        /* 完成度用"水位"从下往上填，不是横条。
           横条在这个形状里不好读——一格只有 12 个月宽，
           横着填到一半和填满看着差不多；水位的高度差一眼就能比出来。 */
        var ratio = Math.max(0, Math.min(1, (s.percent || 0) / 100));
        if (ratio > 0) {
          ctx.save();
          roundRect(ctx, x + 1, padT, bw - 2, bandH, 7);
          ctx.clip();
          ctx.fillStyle = s.color + 'bb';
          ctx.fillRect(x + 1, padT + bandH * (1 - ratio), bw - 2, bandH * ratio);
          ctx.restore();
        }

        /* 学年名 + 完成度 */
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textStrong;
        ctx.font = (compact ? 11 : 12.5) + 'px system-ui, -apple-system, "Microsoft YaHei", sans-serif';
        ctx.fillText(s.year, x + bw / 2, padT + bandH / 2 - (compact ? 7 : 8));
        ctx.fillStyle = textColor;
        ctx.font = (compact ? 9.5 : 10.5) + 'px system-ui, -apple-system, sans-serif';
        ctx.fillText(s.done + '/' + s.total, x + bw / 2, padT + bandH / 2 + (compact ? 8 : 9));
      });

      /* 主轴 + 三个学年分界刻度 */
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, axisY);
      ctx.lineTo(padL + trackW, axisY);
      ctx.stroke();

      for (var g = 1; g < 4; g++) {
        var gx = padL + g * 12 * unit;
        ctx.beginPath();
        ctx.moveTo(gx, axisY - 3);
        ctx.lineTo(gx, axisY + 3);
        ctx.strokeStyle = axisColor;
        ctx.stroke();
      }

      /* 关键节点：主轴下方一个小三角。
         这里只标"有个节点"，不写名字——名字在下面的文字列表里，
         两边分工，轴上就不会糊成一片。 */
      (config.milestones || []).forEach(function (ms) {
        if (ms.abs < 0 || ms.abs > 48) return;
        var mx = padL + ms.abs * unit;
        ctx.beginPath();
        ctx.moveTo(mx, axisY + 2);
        ctx.lineTo(mx - 3.5, axisY + 8);
        ctx.lineTo(mx + 3.5, axisY + 8);
        ctx.closePath();
        ctx.fillStyle = axisColor;
        ctx.fill();
      });

      /* 当前位置：一条贯穿色带的竖线 + 顶部圆点。
         整张图里最该被一眼看到的就是它，所以用主色。 */
      if (typeof config.position === 'number') {
        var px = padL + Math.max(0, Math.min(1, config.position)) * 48 * unit;
        var accent = cssVar('--accent', '#00e5ff');

        ctx.beginPath();
        ctx.moveTo(px, padT - 3);
        ctx.lineTo(px, axisY);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px, padT - 3, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.fill();
      }
    };
    draw();
    register(canvas, draw);
  }

  /* 画圆角矩形路径，条形图和卡片都用得到 */
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /* 窗口尺寸变化时重画所有还挂在页面上的图 */
  function redrawAll() {
    registry = registry.filter(function (item) {
      if (!document.body.contains(item.canvas)) return false;   // 页面已经换掉了，丢弃
      try { item.fn(); } catch (e) { console.warn('[charts] 重绘失败', e); }
      return true;
    });
  }

  var timer = null;
  window.addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(redrawAll, 120);   // 防抖，避免拖动窗口时疯狂重画
  });

  AICS.Charts = {
    radar: radar,
    donut: donut,
    bars: bars,
    line: line,
    timeline: timeline,
    roundRect: roundRect,
    redrawAll: redrawAll,
    clear: function () { registry = []; }
  };

})(window.AICS);
