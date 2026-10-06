/* ============================================================
 * views/growth.js —— 能力成长曲线
 * ------------------------------------------------------------
 * 每次完成测评都会自动存一条快照，同一天里可以有好几条。
 * 去重按**内容**做（答案一模一样才不新增），不是按日期——
 * 按日期去重的话，学生清空重答一遍再点保存，一天之内永远只有一条，
 * 曲线永远出不来。详见 calc.js 的 saveSnapshot。
 * 这里把所有快照画成折线图，看能力随时间的变化。
 * 对大一新生来说，这一页的价值是：四年之后回头看，能看到自己长了多少。
 * ============================================================ */
window.AICS = window.AICS || {};
AICS.Views = AICS.Views || {};

(function (AICS) {
  'use strict';

  var UI = AICS.UI;

  /* 把 ISO 时间转成「2026年10月4日」 */
  function fmtDate(iso) {
    var d = new Date(iso);
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  /* 变化量的显示样式 */
  function deltaClass(v) {
    if (v > 0) return 'delta-up';
    if (v < 0) return 'delta-down';
    return 'delta-flat';
  }
  function deltaText(v) {
    if (v > 0) return '+' + v;
    return String(v);
  }

  /* 使用说明。放在最上面、始终显示——
     有学生问过"我点了记录当前状态、又清空重答了一遍，为什么还是没有曲线"。
     查下来不是他操作错，是"什么情况才会新增一条"这条规则
     在任何地方都没写，只能靠猜。所以把这套规则明明白白写出来。 */
  function howto() {
    return '<div class="growth-tip">' + UI.icon('info') +
      '<div>' +
        '<b>什么情况会多一条记录</b>' +
        '<p>做完「自我认知」测评会自动记一条；<b>答案和最近一条不一样时</b>才会新增，' +
        '所以连点几次「记录当前状态」不会堆出一堆重复的点。</p>' +
        '<p>想马上看效果：回「自我认知」改几道题，再回来点一次「记录当前状态」，' +
        '这里立刻就会多一个点。真实使用中是隔一个月或一个学期重测一次，' +
        '那条曲线才是能力真的长了多少。</p>' +
      '</div>' +
    '</div>';
  }

  /* 记录不够时显示的引导。

     分三种情况，因为它们的下一步动作完全不同：
       n = 0 且没做过测评   → 去做测评
       n = 0 但做过测评     → 结果还没记进来，点「记录当前状态」
       n = 1                → 再记一条就能出曲线
     原来只分了"有没有记录"两种，于是做完测评但没记上的人会看到
     "还没有测评记录 / 去做测评"——他明明刚做完，会以为白做了。 */
  function notEnough(history, hasAnalysis) {
    var n = (history || []).length;
    var title, desc, action, btnText;

    if (n) {
      title = '再多一条记录就能画出曲线了';
      desc = '目前存了 ' + n + ' 条。现在去改几道测评题再回来点一次「记录当前状态」，' +
             '马上就能看到曲线；隔一段时间重测，看到的就是真实的变化。';
      action = 'go-assess';
      btnText = '去改测评答案';
    } else if (hasAnalysis) {
      title = '你的测评结果还没记进成长曲线';
      desc = '测评已经做完了，但还没有存成记录。点右上角的「记录当前状态」把它记成第一条；' +
             '以后答案有变化时再记一次，两条以上就会画出曲线。';
      action = 'save-snapshot';
      btnText = '记录当前状态';
    } else {
      title = '还没有测评记录';
      desc = '完成一次自我认知测评后，系统会自动把结果存成一条记录。' +
             '以后答案有变化时再测一次，就能看到自己的能力变化轨迹。';
      action = 'go-assess';
      btnText = '去做测评';
    }

    /* 一条都没有时空状态的图标和文字更矮，把按钮提上来一点更好看 */
    var btnTop = (n || hasAnalysis) ? '6' : '-30';
    return '<div class="panel">' +
      UI.empty({ icon: 'trend', title: title, desc: desc }) +
      '<div class="btn-row" style="justify-content:center;margin-top:' + btnTop + 'px">' +
        '<button class="btn btn--primary" data-action="' + action + '">' +
          UI.icon(action === 'save-snapshot' ? 'plus' : 'target') + ' ' + btnText + '</button>' +
      '</div>' +
    '</div>';
  }

  AICS.Views.growth = {
    title: '成长曲线',
    desc: '看自己的能力随时间怎么变化',

    render: function () {
      var state = AICS.Store.get();
      var history = state.history || [];
      var analysis = AICS.Calc.analyse(state);

      var head = UI.pageHeader('能力成长曲线',
        '每次测评都会自动记录，答案有变化就多一个点',
        '<div class="btn-row">' +
          (analysis ? '<button class="btn btn--primary" data-action="save-snapshot">' +
            UI.icon('plus') + ' 记录当前状态</button>' : '') +
          (history.length ? '<button class="btn btn--danger" data-action="clear-history">' +
            UI.icon('trash') + ' 清空记录</button>' : '') +
        '</div>');

      if (history.length < 2) return head + howto() + notEnough(history, analysis);

      var series = AICS.Calc.historySeries(history);
      var growth = AICS.Calc.growthSummary(history) || [];

      /* 顶部四个概览指标 */
      /* 排序统一用 Calc.byTime，别在视图里再写一遍比较器 */
      var first = history.slice().sort(AICS.Calc.byTime)[0];
      var last = history.slice().sort(AICS.Calc.byTime)[history.length - 1];
      var best = growth[0];
      var worst = growth[growth.length - 1];
      var avgFrom = AICS.DIMS.reduce(function (s, d) { return s + (first.ability[d.key] || 0); }, 0) / AICS.DIMS.length;
      var avgTo = AICS.DIMS.reduce(function (s, d) { return s + (last.ability[d.key] || 0); }, 0) / AICS.DIMS.length;

      var cards = '<div class="growth-summary">' +
        '<div class="growth-card"><span>记录次数</span><strong>' + history.length + ' 次</strong>' +
          '<em class="delta-flat">' + fmtDate(first.at) + ' 起</em></div>' +
        '<div class="growth-card"><span>能力均值</span><strong>' + avgTo.toFixed(0) + ' 分</strong>' +
          '<em class="' + deltaClass(avgTo - avgFrom) + '">较首次 ' + deltaText(Math.round(avgTo - avgFrom)) + '</em></div>' +
        (best ? '<div class="growth-card"><span>进步最大</span><strong>' + UI.esc(best.name) + '</strong>' +
          '<em class="' + deltaClass(best.delta) + '">' + deltaText(best.delta) + ' 分</em></div>' : '') +
        (worst ? '<div class="growth-card"><span>最需注意</span><strong>' + UI.esc(worst.name) + '</strong>' +
          '<em class="' + deltaClass(worst.delta) + '">' + deltaText(worst.delta) + ' 分</em></div>' : '') +
      '</div>';

      /* 折线图：八个维度各一条线，颜色循环使用 */
      var palette = UI.tonePalette();
      var lineSeries = series.dims.map(function (d, i) {
        return { name: d.name, values: d.values, color: palette[i % palette.length] };
      });

      var chartPanel = '<div class="panel">' +
        '<div class="panel__head"><h3>八项能力变化</h3>' +
          '<span class="muted">纵轴是自评得分（0~100）</span></div>' +
        '<canvas id="growth-line" class="chart-canvas" style="height:320px"></canvas>' +
        '<div class="compare-legend">' + lineSeries.map(function (s) {
          return '<span><i style="background:' + s.color + '"></i>' + UI.esc(s.name) + '</span>';
        }).join('') + '</div>' +
      '</div>';

      /* 每个维度从第一次到最近一次的变化 */
      var rows = growth.map(function (g) {
        var maxV = Math.max(g.from, g.to, 10);
        return '<div class="growth-row">' +
          '<span>' + UI.esc(g.name) + '</span>' +
          '<span class="growth-row__bar">' +
            '<i class="growth-row__from" style="width:' + (g.from / 100 * 100) + '%;background:var(--text-dim)"></i>' +
            '<i class="growth-row__to" style="width:' + (g.to / 100 * 100) + '%"></i>' +
          '</span>' +
          '<span class="growth-row__num">' + g.from + ' → ' + g.to +
            ' <b class="' + deltaClass(g.delta) + '">' + deltaText(g.delta) + '</b></span>' +
        '</div>';
      }).join('');

      var detailPanel = '<div class="panel">' +
        '<div class="panel__head"><h3>逐项变化</h3>' +
          '<span class="muted">' + fmtDate(first.at) + ' → ' + fmtDate(last.at) + '</span></div>' +
        '<div class="growth-list">' + rows + '</div>' +
        '<p class="rank-note">灰色是首次测评的水平，彩色是最近一次。' +
          '这一栏用的是<strong>原始自评分</strong>，不受年级权重影响，所以跨年级也能直接比——' +
          '重新测的时候按同一套标准打分就行。<br>' +
          '（上面「推荐方向的变化」里的分数是加权后的，跨年级<strong>不能</strong>直接比。）</p>' +
      '</div>';

      /* 方向推荐的变化轨迹 */
      var trackHtml = '';
      var distinctTops = [];
      history.slice().sort(AICS.Calc.byTime).forEach(function (h) {
        if (!distinctTops.length || distinctTops[distinctTops.length - 1].topId !== h.topId) {
          /* year 也要带上——年份不同意味着权重不同，分数不可比 */
          distinctTops.push({ topId: h.topId, topName: h.topName, at: h.at, score: h.topScore, year: h.year || '' });
        }
      });

      /* 这些记录里的年级是不是同一个。
         年级不同 → 权重不同 → 分数不可比，必须显式提醒。
         实测：答案一字不改，只是年级从大一变成大四，
         第一名分数就会从 86.9 涨到 94.8，方向也可能换一个。
         不说明的话，用户会以为是自己进步了。

         注意要查**全部历史**，不能只查上面那个去重后的轨迹——
         轨迹只在"第一名变了"时才记一条，如果两次第一名没变，
         年级变了也检测不出来，警告就不会出现。 */
      var grades = (history || []).map(function (h) { return h.year || ''; })
        .filter(function (y, i, arr) { return y && arr.indexOf(y) === i; });
      var gradeChanged = grades.length > 1;

      if (distinctTops.length) {
        trackHtml = '<div class="panel">' +
          '<div class="panel__head"><h3>推荐方向的变化</h3></div>' +
          '<div class="growth-list">' +
            distinctTops.map(function (t) {
              return '<div class="growth-row" style="grid-template-columns:72px 58px 1fr 70px">' +
                '<span>' + fmtDate(t.at).replace(/^\d+年/, '') + '</span>' +
                '<span class="growth-row__year">' + UI.esc(t.year || '未填') + '</span>' +
                '<span><strong>' + UI.esc(t.topName) + '</strong></span>' +
                '<span class="growth-row__num">' + t.score + ' 分</span>' +
              '</div>';
            }).join('') +
          '</div>' +
          (gradeChanged
            ? '<div class="banner banner--warn" style="margin-top:14px">' + UI.icon('alert') +
                '<div><strong>这几次测评的年级不一样，分数不能直接比</strong>' +
                '<span>匹配权重会跟着年级变（大一能力只占 15%，大四占 70%），' +
                '所以就算你每道题都答得一模一样，分数也会随年级升高。' +
                '方向的变动也可能只是权重变了，不一定是你变了。</span></div>' +
              '</div>'
            : '') +
          '<p class="rank-note">' +
            (distinctTops.length > 1
              ? '推荐方向变过 ' + (distinctTops.length - 1) + ' 次。方向变化很正常——' +
                (gradeChanged
                  ? '但注意上面几次的年级不同，权重也不同，所以这次的"变化"里有一部分是年级带来的，不一定是你变了。'
                  : '可能是你变了，也可能只是某次自评打得比平时宽松。')
              : '推荐方向一直没变，说明你的兴趣和能力结构比较稳定。') +
          '</p>' +
        '</div>';
      }

      return head + howto() + cards + chartPanel + '<div class="grid-2">' + detailPanel + trackHtml + '</div>';
    },

    mount: function (root) {
      var history = AICS.Store.get().history || [];
      if (history.length < 2) return;

      var series = AICS.Calc.historySeries(history);
      var palette = UI.tonePalette();
      var canvas = root.querySelector('#growth-line');
      if (canvas) {
        AICS.Charts.line(canvas, {
          labels: series.labels,
          max: 100,
          series: series.dims.map(function (d, i) {
            return { name: d.name, values: d.values, color: palette[i % palette.length] };
          })
        });
      }
    }
  };

})(window.AICS);
