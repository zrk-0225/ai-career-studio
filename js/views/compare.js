/* ============================================================
 * views/compare.js —— 方向并排对比
 * ------------------------------------------------------------
 * 左边勾选最多两个方向，右边用雷达图叠加它们的岗位能力要求，
 * 下面列一张逐项对比表。做完测评的话还会把"我的能力"一起画进去。
 * 用途：在两个都挺合适的方向之间做取舍。
 * ============================================================ */
window.AICS = window.AICS || {};
AICS.Views = AICS.Views || {};

(function (AICS) {
  'use strict';

  var UI = AICS.UI;

  /* 已勾选的方向 id，最多两个。存在内存里，切页面不丢 */
  var picked = [];

  /* 这两个是画在 canvas 上的，必须按主题取色：
     荧光青/紫在浅色主题的白底画布上几乎看不见 */
  function COLORS() { return [UI.tone('accent'), UI.tone('accent2')]; }
  function ME_COLOR() { return UI.tone('warn'); }

  /* 默认选中：做完测评就取匹配度前两名，否则取前两个方向 */
  function defaultPicked(analysis) {
    if (analysis && analysis.ranked.length >= 2) {
      return [analysis.ranked[0].id, analysis.ranked[1].id];
    }
    return [AICS.DIRECTIONS[0].id, AICS.DIRECTIONS[1].id];
  }

  /* 左侧可选列表 */
  function pickList(analysis) {
    var scoreMap = {};
    if (analysis) analysis.ranked.forEach(function (r) { scoreMap[r.id] = r; });

    return AICS.DIRECTIONS.map(function (d) {
      var on = picked.indexOf(d.id) >= 0;
      var s = scoreMap[d.id];
      /* 这里显示档位而不是分数。两栏对比时最容易犯的错，
         就是拿着"87.1 对 89.2"去纠结——那 2.1 分根本不存在。 */
      return '<button class="pick-card' + (on ? ' is-on' : '') +
        '" data-action="pick-compare" data-id="' + d.id + '">' +
        '<span class="pick-card__check">' + UI.icon('check') + '</span>' +
        '<span style="flex:1">' + UI.esc(d.name) + '</span>' +
        (s ? '<span class="pick-card__band">第 ' + (s.band + 1) + ' 档</span>' : '') +
      '</button>';
    }).join('');
  }

  /* 一行对比数据。
     传进来的 a / b 必须是原始值，显示格式交给 opts.fmt——
     之前是先把数字拼成 '3.8 / 5' 这种字符串再传进来，
     下面那句 typeof a === 'number' 就永远不成立，
     "高分项标绿"整整一行从来没生效过。 */
  function row(label, a, b, opts) {
    opts = opts || {};
    var fmt = opts.fmt || function (v) { return String(v); };
    function cell(v, cls) {
      return '<td' + cls + '>' +
        (v === null || v === undefined ? '—' : UI.esc(fmt(v))) + '</td>';
    }
    /* 数值型可以标出谁更高 */
    var aCls = '', bCls = '';
    if (opts.numeric && typeof a === 'number' && typeof b === 'number') {
      if (a > b) aCls = ' class="win"';
      else if (b > a) bCls = ' class="win"';
    }
    return '<tr><td>' + UI.esc(label) + '</td>' + cell(a, aCls) + cell(b, bCls) + '</tr>';
  }

  AICS.Views.compare = {
    title: '方向对比',
    desc: '两个方向并排看，帮你做取舍',

    render: function () {
      var state = AICS.Store.get();
      var analysis = AICS.Calc.analyse(state);

      /* 第一次进来给一组默认选中 */
      if (!picked.length) picked = defaultPicked(analysis);

      var dirs = picked.map(function (id) { return AICS.Directions.byId(id); }).filter(Boolean);

      var head = UI.pageHeader('方向并排对比',
        '最多选两个方向，雷达图会叠在一起显示它们的岗位要求',
        '<button class="btn" data-action="go-match">' + UI.icon('chart') + ' 看匹配诊断</button>');

      var left = '<div class="panel">' +
        '<div class="panel__head"><h3>选择要对比的方向</h3>' +
          '<span class="muted">已选 ' + picked.length + ' / 2</span></div>' +
        '<div class="pick-list">' + pickList(analysis) + '</div>' +
        (analysis
          ? '<p class="rank-note">卡片右边是它落在第几档。<strong>同一档内的方向，匹配度没有实质差别</strong>，' +
            '对比时该看能力要求和学历门槛，而不是谁的分数高一点。</p>'
          : '<p class="rank-note">还没做测评。做完之后这里会显示各方向的匹配度，对比会更有针对性。</p>') +
      '</div>';

      if (dirs.length < 2) {
        return head + '<div class="compare-grid">' + left +
          '<div class="panel">' + UI.empty({
            icon: 'scale',
            title: '再选一个方向就能对比了',
            desc: '至少勾选两个方向，雷达图和对比表才会出现。'
          }) + '</div></div>';
      }

      var a = dirs[0], b = dirs[1];

      /* 雷达图：两个方向的要求叠加，有测评就再加上"我的能力" */
      var series = [
        { name: a.name, values: AICS.DIMS.map(function (d) { return a.req[d.key] || 0; }), color: COLORS()[0] },
        { name: b.name, values: AICS.DIMS.map(function (d) { return b.req[d.key] || 0; }), color: COLORS()[1] }
      ];
      if (analysis) {
        series.push({
          name: '我的能力',
          values: AICS.DIMS.map(function (d) { return analysis.ability[d.key] || 0; }),
          color: ME_COLOR()
        });
      }

      var legend = '<div class="compare-legend">' + series.map(function (s) {
        return '<span><i style="background:' + s.color + '"></i>' + UI.esc(s.name) + '</span>';
      }).join('') + '</div>';

      var scoreA = analysis ? analysis.ranked.filter(function (r) { return r.id === a.id; })[0] : null;
      var scoreB = analysis ? analysis.ranked.filter(function (r) { return r.id === b.id; })[0] : null;

      /* 逐项对比表 */
      var table = '<table class="compare-table">' +
        '<thead><tr><th>对比项</th><th>' + UI.esc(a.name) + '</th><th>' + UI.esc(b.name) + '</th></tr></thead>' +
        '<tbody>' +
        /* 匹配度取整，而且不标绿——这一页开头刚说完
           "该看能力要求和学历门槛，而不是谁的分数高一点"，
           再给分数高的那一边标个绿就是在自打脸。
           需求热度是市场属性不是个人得分，保留一位小数没问题。 */
        row('匹配度', scoreA ? Math.round(scoreA.total) : null,
                       scoreB ? Math.round(scoreB.total) : null,
            { fmt: function (v) { return v + ' 分'; } }) +
        row('学历建议', AICS.Directions.degreeOf(a).text, AICS.Directions.degreeOf(b).text) +
        row('能力门槛', a.threshold, b.threshold) +
        row('需求热度', a.demand, b.demand,
            { numeric: true, fmt: function (v) { return v + ' / 5'; } }) +
        row('薪资参考', a.salary.replace('一线城市应届：', ''), b.salary.replace('一线城市应届：', '')) +
        AICS.DIMS.map(function (d) {
          return row(d.name + ' 要求', a.req[d.key], b.req[d.key], { numeric: true });
        }).join('') +
        (analysis ? AICS.DIMS.map(function (d) {
          return row(d.name + ' 与我差距',
            Math.max(0, (a.req[d.key] || 0) - (analysis.ability[d.key] || 0)),
            Math.max(0, (b.req[d.key] || 0) - (analysis.ability[d.key] || 0)),
            { numeric: false });
        }).join('') : '') +
        '</tbody></table>';

      var right = '<div class="panel">' +
        '<div class="panel__head"><h3>能力要求对比</h3></div>' +
        '<div class="compare-canvas-wrap">' +
          '<canvas id="compare-radar" class="chart-canvas" style="height:380px"></canvas>' +
        '</div>' + legend +
        '<div class="panel__sub"><h4>逐项对比</h4>' + table + '</div>' +
        (analysis
          ? '<p class="rank-note">「需求热度」和「能力要求」这两组里，' +
            '数字大的那一项用绿色标出（要求高说明这个方向更吃这项能力）。' +
            '「匹配度」不标绿，同一档内的差别没有意义。' +
            '「与我差距」这一组里数字越小，说明这个方向你补起来越快。</p>'
          : '') +
      '</div>';

      return head + '<div class="compare-grid">' + left + right + '</div>';
    },

    mount: function (root) {
      var analysis = AICS.Calc.analyse(AICS.Store.get());
      var dirs = picked.map(function (id) { return AICS.Directions.byId(id); }).filter(Boolean);

      /* 画雷达图 */
      var canvas = root.querySelector('#compare-radar');
      if (canvas && dirs.length >= 2) {
        var series = [
          { name: dirs[0].name, values: AICS.DIMS.map(function (d) { return dirs[0].req[d.key] || 0; }), color: COLORS()[0] },
          { name: dirs[1].name, values: AICS.DIMS.map(function (d) { return dirs[1].req[d.key] || 0; }), color: COLORS()[1] }
        ];
        if (analysis) {
          series.push({
            name: '我的能力',
            values: AICS.DIMS.map(function (d) { return analysis.ability[d.key] || 0; }),
            color: ME_COLOR()
          });
        }
        AICS.Charts.radar(canvas, {
          axes: AICS.DIMS.map(function (d) { return d.short; }),
          series: series
        });
      }

      /* 勾选/取消勾选方向，最多两个 */
      root.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action="pick-compare"]');
        if (!btn) return;

        var id = btn.getAttribute('data-id');
        var idx = picked.indexOf(id);

        if (idx >= 0) {
          picked.splice(idx, 1);
        } else {
          if (picked.length >= 2) picked.shift();   // 满了就顶掉最早选的那个
          picked.push(id);
        }
        AICS.App.refresh();
      });
    }
  };

})(window.AICS);
