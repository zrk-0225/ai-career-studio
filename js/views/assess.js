/* ============================================================
 * views/assess.js —— 自我认知测评
 * ------------------------------------------------------------
 * 38 道题一次性平铺，顶部有吸顶进度条。
 * 两个关键设计：
 *   1. 答题时只更新对应题目和进度条，不整页重绘，否则滚动位置会跳
 *   2. 能力自评题按年级换措辞——大一不会问"你深度学习能力如何"
 * ============================================================ */
window.AICS = window.AICS || {};
AICS.Views = AICS.Views || {};

(function (AICS) {
  'use strict';

  var UI = AICS.UI;

  /* 题目序号从 1 连续编到底，跨部分不重置 */
  var counter = 0;

  /* 渲染单道题：兴趣题和偏好题用通用量表，能力题用分档标准。
     能力题的评分标准直接写在选项按钮"里面"，而不是另起一行——
     这样标准和选项天然绑在一起，任何宽度下都不会对错行。 */
  function question(q, index) {
    var answers = AICS.Store.get().assess.answers || {};
    var current = answers[q.id];
    var year = AICS.Store.get().profile.year;

    /* 能力题：按年级取出对应的问法和五档标准 */
    var isAbility = !!q.dim;
    var view = isAbility ? AICS.abilityForYear(q, year) : null;
    var title = isAbility ? q.name : q.text;
    var hint = isAbility ? view.hint : '';

    var opts = AICS.LIKERT.map(function (o) {
      var label = isAbility ? AICS.ABILITY_SCALE[o.value - 1] : o.label;
      var anchor = isAbility ? view.anchors[o.value - 1] : '';

      return '<button type="button" class="opt' + (current === o.value ? ' is-on' : '') +
        '" data-action="answer" data-qid="' + q.id + '" data-value="' + o.value + '">' +
        '<span class="opt__head">' +
          '<span class="opt__dot"></span>' +
          '<span class="opt__label">' + UI.esc(label) + '</span>' +
        '</span>' +
        /* 这一档的具体标准，跟着选项一起走 */
        (anchor ? '<span class="opt__anchor">' + UI.esc(anchor) + '</span>' : '') +
      '</button>';
    }).join('');

    return '<div class="q' + (isAbility ? ' q--ability' : '') + '" data-q="' + q.id + '">' +
      '<div class="q__text">' +
        '<span class="q__no">' + index + '</span>' +
        '<div><span class="q__title">' + UI.esc(title) + '</span>' +
        (hint ? '<span class="q__hint">' + UI.esc(hint) + '</span>' : '') + '</div>' +
      '</div>' +
      '<div class="q__opts">' + opts + '</div>' +
    '</div>';
  }

  /* 渲染一个部分（兴趣 / 能力 / 偏好） */
  function section(sec) {
    var body = sec.questions.map(function (q) {
      counter++;
      return question(q, counter);
    }).join('');
    return '<section class="assess-section">' +
      '<div class="assess-section__head">' +
        '<h2>' + UI.esc(sec.title) + '</h2>' +
        '<p>' + UI.esc(sec.desc) + '</p>' +
      '</div>' + body +
    '</section>';
  }

  /* 顶部吸顶进度 */
  function progressBar() {
    var answered = AICS.Calc.answeredCount(AICS.Store.get().assess.answers || {});
    var total = AICS.Calc.totalQuestions();
    var percent = total ? (answered / total) * 100 : 0;
    return '<div class="assess-top assess-top--float">' +
      '<div class="assess-top__info">' +
        '<span>已完成 <strong id="assess-count">' + answered + '</strong> / ' + total + ' 题</span>' +
        '<span id="assess-tip">' + (answered === total ? '全部答完，可以出结果了' : '凭第一感觉作答，没有对错') + '</span>' +
      '</div>' +
      '<div class="progress"><div class="progress__bar" id="assess-bar" style="width:' + percent + '%"></div></div>' +
    '</div>';
  }

  /* 结果区第一句话。
     不说"最匹配的方向是 X"——实测第1名和第2名中位只差 0.7~1.4 分，
     重答一次有 19%~40% 的概率换人。所以说"你属于第几档"，
     档位才是稳的那个东西。 */
  function resultLine(analysis) {
    var band = analysis.topBand;
    var names = band.items.map(function (r) { return r.name; });
    if (analysis.bands.length === 1) {
      return '这次测评没有把任何一个方向明显区分出来——七个方向都落在同一档。' +
             '不用纠结排名，先按「方向图谱」把每个方向了解一遍。<br>';
    }
    if (names.length === 1) {
      return '你属于 <strong style="color:' + UI.scoreColor(band.top) + '">' + UI.esc(band.name) +
             '</strong>，匹配方向是 <strong>' + UI.esc(names[0]) + '</strong>，' +
             /* 用常量而不是写死 5：档位阈值改过一次，写死的那个没跟着变 */
             '比第二档高出 ' + AICS.Calc.BAND_GAP + ' 分以上。<br>';
    }
    return '你属于 <strong style="color:' + UI.scoreColor(band.top) + '">' + UI.esc(band.name) +
           '</strong>，这一档有 <strong>' + names.length + ' 个方向</strong>：' +
           UI.esc(names.join('、')) + '。<br>' +
           '<span class="muted">它们的匹配度没有实质差别（分差在 ' + AICS.Calc.BAND_GAP +
           ' 分以内），所以不排名次。去「匹配诊断」看详细对比。</span><br>';
  }

  /* 答完之后的结果预览 */
  function resultPanel(analysis) {
    return '<div class="panel result-panel">' +
      '<div class="panel__head"><h3>你的测评结果</h3>' +
        '<button class="link-btn" data-action="go-match">查看完整匹配诊断 ' + UI.icon('arrow-right') + '</button>' +
      '</div>' +
      '<div class="result-grid">' +
        '<div class="result-col">' +
          '<h4>能力自评画像</h4>' +
          '<canvas id="ability-bars" class="chart-canvas"></canvas>' +
        '</div>' +
        '<div class="result-col">' +
          '<h4>兴趣倾向分布</h4>' +
          '<canvas id="interest-radar" class="chart-canvas" style="height:280px"></canvas>' +
        '</div>' +
      '</div>' +
      '<div class="result-note">' +
        resultLine(analysis) +
        '当前最短板是 <strong>' + UI.esc(analysis.weakest.name) + '</strong>。<br>' +
        '<span class="muted">本次按「' + UI.esc(analysis.year || '未填年级') + '」计算权重：' +
        '能力 ' + Math.round(analysis.weights.ability * 100) + '%、' +
        '兴趣 ' + Math.round(analysis.weights.interest * 100) + '%、' +
        '偏好 ' + Math.round(analysis.weights.pref * 100) + '%。' +
        UI.esc(analysis.yearReason) + '</span>' +
      '</div>' +
    '</div>';
  }

  /* 画结果区里的两张图 */
  function drawResultCharts(root, analysis) {
    var barsCanvas = root.querySelector('#ability-bars');
    if (barsCanvas) {
      AICS.Charts.bars(barsCanvas, AICS.DIMS.map(function (d) {
        var v = analysis.ability[d.key] || 0;
        return { label: d.name, value: v, max: 100, color: UI.scoreColor(v) };
      }), { labelWidth: 80 });
    }
    var radarCanvas = root.querySelector('#interest-radar');
    if (radarCanvas) {
      AICS.Charts.radar(radarCanvas, {
        axes: AICS.INTEREST_TYPES.map(function (t) { return t.name; }),
        series: [{
          name: '我的兴趣',
          values: AICS.INTEREST_TYPES.map(function (t) {
            return Math.round((analysis.interest[t.key] || 0) * 100);
          }),
          color: UI.tone('accent2')
        }]
      });
    }
  }

  AICS.Views.assess = {
    title: '自我认知',
    desc: '一切分析的数据源头，大约 12 分钟',

    render: function () {
      counter = 0;   // 每次重新渲染都要重置编号
      var state = AICS.Store.get();
      var analysis = AICS.Calc.analyse(state);
      var answered = AICS.Calc.answeredCount(state.assess.answers || {});
      var total = AICS.Calc.totalQuestions();
      var complete = answered === total;

      var head = UI.pageHeader('自我认知测评',
        '诚实地评估自己，结果才对你真正有用。自评题会跟着你的年级变',
        /* 一题都没答的时候不显示「清空重答」——
           第一次进来的人看到这个按钮会纳闷"我要清空什么"，
           点下去还弹"确定要清空所有测评答案重新来过吗"，更容易慌。
           没有东西可清的时候就不该给这个入口。 */
        (answered
          ? '<button class="btn" data-action="reset-assess">' + UI.icon('refresh') + ' 清空重答</button>'
          : ''));

      var submitBar = '<div class="assess-submit">' +
        (complete
          ? '<span class="muted">测评已完成，改动任意一题结果会立即更新</span>' +
            '<button class="btn btn--primary" data-action="go-match">' + UI.icon('compass') + ' 看匹配诊断</button>'
          : '<span class="muted">还有 ' + (total - answered) + ' 题没答</span>' +
            '<button class="btn btn--primary" disabled>答完才能出结果</button>') +
      '</div>';

      return head +
        /* 结果区放在这个容器里，改答案时只重绘这里，不动整页 */
        '<div id="result-slot">' + (analysis ? resultPanel(analysis) : '') + '</div>' +
        '<div class="assess-body">' +
          AICS.QUESTION_SECTIONS.map(section).join('') +
        '</div>' +
        submitBar +
        progressBar();
    },

    mount: function (root) {
      var analysis = AICS.Calc.analyse(AICS.Store.get());
      if (analysis) drawResultCharts(root, analysis);

      /* 答题：只更新这一题和顶部进度条 */
      root.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action="answer"]');
        if (!btn) return;

        var qid = btn.getAttribute('data-qid');
        var value = Number(btn.getAttribute('data-value'));

        var box = btn.closest('.q');
        box.querySelectorAll('.opt').forEach(function (o) { o.classList.remove('is-on'); });
        btn.classList.add('is-on');

        var answers = Object.assign({}, AICS.Store.get().assess.answers);
        answers[qid] = value;

        var total = AICS.Calc.totalQuestions();
        var answered = AICS.Calc.answeredCount(answers);
        var finished = answered === total;
        var wasFinished = !!(AICS.Store.get().assess || {}).finished;

        AICS.Store.set('assess', {
          answers: answers,
          finished: finished,
          finishedAt: finished ? new Date().toISOString() : ''
        });

        /* 更新顶部进度条 */
        var counterEl = document.getElementById('assess-count');
        var barEl = document.getElementById('assess-bar');
        var tipEl = document.getElementById('assess-tip');
        if (counterEl) counterEl.textContent = answered;
        if (barEl) barEl.style.width = (answered / total) * 100 + '%';
        if (tipEl) tipEl.textContent = finished ? '全部答完，可以出结果了' : '凭第一感觉作答，没有对错';

        /* 页面最下面那条也要跟着更新。
           原来只更新了顶部，底部一直停在进入页面时的"还有 38 题没答"——
           学生答了十几题，滚到底部一看数字没动，会以为自己的作答没记上。
           顶部动了、底部不动，比两个都不动更让人犯嘀咕。 */
        var submitEl = root.querySelector('.assess-submit .muted');
        if (submitEl && !finished) submitEl.textContent = '还有 ' + (total - answered) + ' 题没答';

        if (!finished) return;

        /* 刚答完最后一题：存一条历史快照，用于成长曲线。
           答案和上一条一样时不会新增，提示要如实说，不能一律说"已记录" */
        if (!wasFinished) {
          var snap = AICS.Calc.saveSnapshot();
          if (snap.ok && snap.duplicated) {
            UI.toast('测评完成。答案和上一条一样，成长曲线里没有新增记录', 'info');
          } else {
            UI.toast('测评完成，已记到成长曲线（第 ' + snap.count + ' 条）', 'success');
          }
        }

        /* 结果区如果已经存在就只更新它，不存在才整页重绘。
           这样改答案时数字会立即变，页面又不会跳回顶部。 */
        var slot = root.querySelector('#result-slot');
        var fresh = AICS.Calc.analyse(AICS.Store.get());
        if (slot && slot.querySelector('.result-panel')) {
          slot.innerHTML = resultPanel(fresh);
          drawResultCharts(slot, fresh);
        } else {
          AICS.App.refresh();
        }
      });
    }
  };

})(window.AICS);
