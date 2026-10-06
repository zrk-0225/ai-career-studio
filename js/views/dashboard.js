/* ============================================================
 * views/dashboard.js —— 概览首页
 * ------------------------------------------------------------
 * 打开工作台第一眼看到的东西：个人画像摘要、四个关键指标、
 * 匹配度前三名、近期待办。没做测评时显示引导流程。
 * ============================================================ */
window.AICS = window.AICS || {};
AICS.Views = AICS.Views || {};

(function (AICS) {
  'use strict';

  var UI = AICS.UI;

  /* 统计四年路线的完成情况。只算当前路线 + 当前个性化的任务，
     否则走升学路线的人会看到一堆"秋招冲刺"被算进总数里；
     用 planFor 而不是 roadmapFor，是为了跟四年规划页数出同一个总数——
     两边不一致的话，概览说 30 项、规划页列 32 项，用户会以为哪边坏了 */
  function roadmapStats(state) {
    var track = AICS.resolveTrack(state);
    var stages = AICS.planFor(state);
    /* roadmap 恒为对象（defaultState 给的是 {}，写入也只走 replaceKey），
       这里的 || {} 只是和全站其它几处读法保持一致 */
    var roadmap = state.roadmap || {};
    var total = 0, done = 0;
    stages.forEach(function (stage) {
      stage.tasks.forEach(function (t) {
        total++;
        if (roadmap[t.id]) done++;
      });
    });
    return {
      total: total, done: done,
      percent: total ? (done / total) * 100 : 0,
      track: track.name
    };
  }

  /* 统计任务看板 */
  function taskStats(state) {
    var tasks = state.tasks || [];
    return {
      todo: tasks.filter(function (t) { return t.status === 'todo'; }).length,
      doing: tasks.filter(function (t) { return t.status === 'doing'; }).length,
      done: tasks.filter(function (t) { return t.status === 'done'; }).length,
      total: tasks.length
    };
  }

  /* 没做测评时的空状态。
     这里刻意不写"第一步做什么第二步做什么"——那是「使用指引」的内容。
     概览只负责说明"现在是什么状态"和"该做什么"，两页不要互相抄。
     另外首次打开已经有启动向导了，这里更不该再当一遍向导。 */
  function emptyState(state) {
    var answered = AICS.Calc.answeredCount(state.assess.answers || {});
    var total = AICS.Calc.totalQuestions();
    var partial = answered > 0;

    return '<div class="hero">' +
        '<div class="hero__glow"></div>' +
        '<div class="hero__body">' +
          /* 答了一部分题时不能说"还没有数据"——下面的标题已经写着
             "测评做了 X / 38 题"，两句话会打架 */
          '<span class="hero__badge">' + UI.icon('sparkles') + ' ' +
            (partial ? '测评还没做完' : '还没有数据') + '</span>' +
          '<h1>' + (partial
            ? '测评做了 ' + answered + ' / ' + total + ' 题，继续吧'
            : '这个仪表盘现在是空的') + '</h1>' +
          '<p>' + (partial
            ? '答完之后，这里会显示你和七个方向各有多契合、能力短板和四年进度。'
            : '这里的每一项分析都建立在测评数据之上。花 12 分钟做完 ' +
              AICS.Calc.totalQuestions() + ' 道题，' +
              '它就会变成你的个人仪表盘：匹配档位、离目标还差什么、四年该往哪使劲。') + '</p>' +
          '<div class="hero__actions">' +
            '<button class="btn btn--primary btn--lg" data-action="go-assess">' +
              UI.icon('target') + ' ' + (partial ? '继续做测评' : '开始自我认知测评') + '</button>' +
            '<button class="btn btn--lg" data-action="go-directions">' +
              (partial ? '先看看有哪些方向' : '先看看七个方向') + '</button>' +
          '</div>' +
          '<p class="hero__hint">' +
            '不清楚这个工作台怎么用？' +
            '<button class="link-btn" data-action="go-guide">看使用指引 ' + UI.icon('arrow-right') + '</button>' +
          '</p>' +
        '</div>' +
      '</div>';
  }

  /* 做完测评后显示的主仪表盘 */
  function dashboardBody(state, analysis) {
    var rs = roadmapStats(state);
    var ts = taskStats(state);
    /* 只展示第一档的方向，不给它们排名次——档内差距小于测评误差 */
    var topBand = analysis.topBand;
    var bandItems = topBand.items;

    /* 四个关键指标卡 */
    var kpis =
      '<div class="kpi-grid">' +
        kpi('匹配档位', topBand.name,
            bandItems.length > 1
              ? bandItems.length + ' 个方向并列，差距在误差内'
              : UI.scoreLabel(bandItems[0].total),
            UI.tone('accent'), 'compass') +
        kpi('四年任务完成', rs.percent.toFixed(0) + '%', rs.done + ' / ' + rs.total + ' 项（' + rs.track + '）', UI.tone('accent2'), 'calendar') +
        kpi('进行中任务', String(ts.doing), ts.todo + ' 项待开始', UI.tone('warn'), 'kanban') +
        kpi('当前最短板', analysis.weakest.name, '自评 ' + (analysis.ability[analysis.weakest.key] || 0) + ' 分', UI.tone('danger'), 'alert') +
      '</div>';

    /* 第一档的方向。没有名次、没有小数分——只说"这几个方向对你来说没差别" */
    var barsHtml = '<div class="panel">' +
        '<div class="panel__head"><h3>第 1 档的方向</h3>' +
        '<button class="link-btn" data-action="go-match">查看完整诊断 ' + UI.icon('arrow-right') + '</button></div>' +
        (bandItems.length > 1
          ? '<p class="muted" style="margin-bottom:12px">这几个方向的匹配度没有实质差别（分差在 ' +
            analysis.bandGap + ' 分以内），所以不分先后。选哪个得看别的：' +
            '愿不愿意读研、喜欢写代码还是跟人打交道。</p>'
          : '') +
        '<div class="top3">' +
          bandItems.slice(0, 4).map(function (r) {
            return '<div class="top3__item">' +
              '<div class="top3__main">' +
                '<div class="top3__title"><strong>' + UI.esc(r.name) + '</strong>' +
                  '<span class="muted">' + UI.esc(r.dir.sub) + '</span></div>' +
                UI.progress(r.total, UI.scoreColor(r.total)) +
                /* 三项分项分必须取整。原来直接拼原始值，页面上会出现
                   "能力 59.9 · 兴趣 91.9 · 偏好 91.7"——而上面那段话
                   刚说完"这几个方向没有实质差别，不分先后"，下面立刻
                   摆出两位小数让人去比，等于把结论又推翻了。
                   而且这行注释上方的说明就写着"没有小数分"。 */
                '<div class="top3__meta">能力 ' + Math.round(r.abilityScore) +
                  ' · 兴趣 ' + Math.round(r.interestScore) +
                  ' · 偏好 ' + Math.round(r.prefScore) + '</div>' +
              '</div>' +
            '</div>';
          }).join('') +
          (bandItems.length > 4
            ? '<p class="muted" style="margin-top:10px">这一档还有 ' + (bandItems.length - 4) + ' 个方向，去「匹配诊断」看全部。</p>'
            : '') +
        '</div>' +
      '</div>';

    /* 优先补齐项。
       标清楚这三项是照着什么算的——不标的话，"还差 68 分"跟谁比只能靠猜。
       没设目标方向时，参照的是"第一档这几个方向都要的"，
       不能说成"系统推荐某个方向"：第一档本来就有好几个、且不分先后，
       挑一个说"推荐它"是在制造不存在的区分度。 */
    var pf = analysis.priorityFor || {};
    var priorityHead = pf.isTarget
      ? '<span class="muted">按你的目标方向「' + UI.esc(pf.name) + '」算的</span>'
      : '<span class="muted">按' + UI.esc(pf.bandName || '第一档') + '这 ' + (pf.bandCount || 0) +
        ' 个方向<b>都要</b>的算的' +
        '<button class="link-btn" data-action="go-match">定个目标方向 ' + UI.icon('arrow-right') + '</button></span>';

    var priorityHtml = analysis.priority.length
      ? '<div class="panel">' +
          /* 条数现算。原来写死的是「最该先补的三件事」，
             但 priority 最多三条、可能一条都没有——只剩一条时
             标题还写着"三件事"，跟下面列出来的对不上。
             这是算法改过之后留下的：早先确实固定给三条。 */
          '<div class="panel__head"><h3>最该先补的 ' + analysis.priority.length +
            ' 件事</h3>' + priorityHead + '</div>' +
          '<div class="priority-list">' +
            analysis.priority.map(function (g) {
              return '<div class="priority">' +
                '<div class="priority__head"><strong>' + UI.esc(g.name) + '</strong>' +
                  '<span class="priority__gap">还差 ' + g.gap + ' 分</span></div>' +
                '<div class="priority__bar">' +
                  '<div class="priority__now" style="width:' + g.mine + '%"></div>' +
                  '<div class="priority__need" style="left:' + g.need + '%"></div>' +
                '</div>' +
                '<p>' + UI.esc(AICS.DIM_ADVICE[g.key] || '') + '</p>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>'
      /* 没有缺口时标题不能还叫"能力差距"——面板里明明白白写着"已经覆盖了"，
         标题说"差距"是自相矛盾的。 */
      : '<div class="panel"><div class="panel__head"><h3>暂无明显短板</h3>' + priorityHead + '</div>' +
        '<p class="muted">' + (pf.isTarget
          ? '你的能力已经覆盖了「' + UI.esc(pf.name) + '」的全部要求，接下来重点是做深项目、积累作品。'
          : '你的能力已经覆盖了第一档 ' + (pf.bandCount || 0) +
            ' 个方向的<b>最低</b>要求。这几个方向里要求更高的那些，等定了目标方向再针对性补。') +
        '</p></div>';

    /* 近期待办：从任务看板里挑还没完成的。
       必须排序——原来直接 slice(0,5) 取的是录入顺序，最早建的 5 条会永远
       占住首页，真正快到期的反而被挤到第 6 条之后看不见。
       顺序：到期早的在前（已过期的自然排最前），没填日期的排最后，再按优先级。 */
    var PRI_RANK = { high: 0, mid: 1, low: 2 };
    function priRank(p) { return PRI_RANK[p] === undefined ? 1 : PRI_RANK[p]; }
    var today = (function () {
      var d = new Date();
      function p(n) { return n < 10 ? '0' + n : String(n); }
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    })();

    var pending = (state.tasks || [])
      .filter(function (t) { return t.status !== 'done'; })
      .sort(function (a, b) {
        var da = a.due || '9999-99-99';   // 没填截止日期的沉到最后
        var db = b.due || '9999-99-99';
        if (da !== db) return da < db ? -1 : 1;
        return priRank(a.priority) - priRank(b.priority);
      })
      .slice(0, 5);

    var todoHtml = '<div class="panel">' +
        '<div class="panel__head"><h3>待办任务</h3>' +
        '<button class="link-btn" data-action="go-kanban">去任务看板 ' + UI.icon('arrow-right') + '</button></div>' +
        (pending.length
          ? '<ul class="mini-list">' + pending.map(function (t) {
              /* 首页也要能看到"什么时候到期""是不是已经晚了"，
                 否则用户只能按列表顺序做，做的不一定是最要紧的那件 */
              var late = t.due && t.due < today;
              return '<li><button class="mini-check" data-action="task-done" data-id="' + t.id + '" title="标记完成">' +
                UI.icon('check') + '</button>' +
                '<span>' + UI.esc(t.title) + '</span>' +
                (t.due ? '<em class="mini-list__due' + (late ? ' is-overdue' : '') + '">' +
                  UI.esc(t.due.slice(5)) + (late ? ' 已过期' : '') + '</em>' : '') +
                (t.term ? UI.tag(t.term, 'ghost') : '') + '</li>';
            }).join('') + '</ul>'
          : '<p class="muted">还没有待办任务。去「四年规划」把阶段任务一键导入看板吧。</p>') +
      '</div>';

    /* 快捷提问 */
    var quickHtml = '<div class="panel">' +
        '<div class="panel__head"><h3>问问 AI 助手</h3>' +
        '<button class="link-btn" data-action="go-assistant">进入助手 ' + UI.icon('arrow-right') + '</button></div>' +
        '<div class="chips">' +
          AICS.KB_QUICK.slice(0, 6).map(function (q) {
            return '<button class="chip" data-action="ask-quick" data-q="' + UI.esc(q) + '">' + UI.esc(q) + '</button>';
          }).join('') +
        '</div>' +
      '</div>';

    return '<div class="stack">' + kpis +
      '<div class="grid-2">' + barsHtml + priorityHtml + '</div>' +
      '<div class="grid-2">' + todoHtml + quickHtml + '</div>' +
    '</div>';
  }

  /* 单个指标卡 */
  function kpi(label, value, sub, color, iconName) {
    return '<div class="kpi">' +
      '<div class="kpi__icon" style="color:' + color + '">' + UI.icon(iconName) + '</div>' +
      '<div class="kpi__label">' + UI.esc(label) + '</div>' +
      '<div class="kpi__value" style="color:' + color + '">' + UI.esc(value) + '</div>' +
      '<div class="kpi__sub">' + UI.esc(sub) + '</div>' +
    '</div>';
  }

  AICS.Views.dashboard = {
    title: '概览',
    desc: '你的职业规划全景',
    render: function () {
      var state = AICS.Store.get();
      var analysis = AICS.Calc.analyse(state);
      return analysis ? dashboardBody(state, analysis) : emptyState(state);
    }
  };

})(window.AICS);
