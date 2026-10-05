/* ============================================================
 * views/match.js —— 方向匹配诊断与差距分析
 * ------------------------------------------------------------
 * 工作台最核心的一页：
 *   左侧  七个方向的匹配度排行，可点选切换
 *   右侧  选中方向的能力雷达图对比 + 逐维度差距 + 算法拆解
 * 算法拆解区把三项加权的过程直接写出来，答辩时照着念就行。
 * ============================================================ */
window.AICS = window.AICS || {};
AICS.Views = AICS.Views || {};

(function (AICS) {
  'use strict';

  var UI = AICS.UI;

  /* 当前选中的方向 id，切换时不用改 store，只在本页内部记着 */
  var selectedId = '';

  /* 决定默认选中哪个方向：优先用户锁定的目标，其次匹配度第一名 */
  function pickDefault(state, analysis) {
    if (selectedId && AICS.DIRECTIONS.some(function (d) { return d.id === selectedId; })) return selectedId;
    if (state.profile.targetId) return state.profile.targetId;
    return analysis.top.id;
  }

  /* 左侧排行榜的一行。
     不显示"第几名"和带小数的分数——实测第1名和第2名中位只差 0.7~1.4 分，
     同一个人重答有 19%~40% 的概率换人。名次和精确分数都是假精度。 */
  function rankRow(r, isActive) {
    var color = UI.scoreColor(r.total);
    /* 结构上把「名称 + 查看详情」放一行，进度条独占下面一行。
       原来是横向 flex，"查看详情"和进度条是并排的兄弟节点，
       而"查看详情"只在选中那一行才有内容，于是那一行的进度条轨道
       被生生挤窄了一截。实测宽度：普通行 344px，选中行 298px。
       后果很难看——选中方向 81.1 分、算法工程师 79.8 分，
       但选中那根条反而更短。排序是对的，显示是错的。
       现在进度条横跨整行，每行轨道一样宽，长短才可比。 */
    return '<button class="rank-row' + (isActive ? ' is-active' : '') +
      '" data-action="pick-dir" data-id="' + r.id + '">' +
      '<span class="rank-row__top">' +
        '<span class="rank-row__name">' + UI.esc(r.name) + '</span>' +
        '<span class="rank-row__hint">' + (isActive ? '查看详情' : '') + '</span>' +
      '</span>' +
      '<span class="rank-row__bar">' +
        '<i style="width:' + r.total + '%;background:' + color + '"></i>' +
      '</span>' +
    '</button>';
  }

  /* 按档位分组的方向清单。
     档位头上只写"几个方向"，不写分数区间——原来写的是
     `Math.round(min) ~ Math.round(top)`，出了两个问题：
       1. 只有 1 个方向的档会显示成"72 ~ 72 分"，看着像坏了；
       2. 四舍五入会让相邻档看起来只差 1 分（实测出现过
          "第 1 档 90 ~ 94 分 / 第 2 档 89 ~ 89 分"），
          而旁边的规则写的是"分差 5 分以内算同一档"，
          两个数字摆在一起自相矛盾。
     要同时避免这两点，只能显示一位小数，但那又违背了
     "不给方向之间的小数分"这条设计原则。所以干脆不显示区间——
     档的含义由旁边的规则和方向清单来说明就够了。 */
  function rankList(analysis, current) {
    return analysis.bands.map(function (b) {
      var n = b.items.length;
      return '<div class="band">' +
        '<div class="band__head">' +
          '<span class="band__name">' + b.name + '</span>' +
          '<span class="band__range">' + n + ' 个方向</span>' +
        '</div>' +
        b.items.map(function (r) { return rankRow(r, r.id === current); }).join('') +
      '</div>';
    }).join('');
  }

  /* 顶部结论条：说"你属于第几档"，而不是"你最该做 X" */
  function conclusion(analysis, hasTarget) {
    var b = analysis.topBand;
    var names = b.items.map(function (r) { return r.name; });
    var onlyOne = names.length === 1;
    var allSame = analysis.bands.length === 1;

    /* 档内方向多的时候，只解释"不该看分数"等于把用户晾在这儿。
       实测（2000 份随机画像）：大一有 8% 的情况第一档会挤进 6 个方向，
       大三 14%、大四 13%——不罕见。所以这种情况必须给一个能动手的下一步，
       而不是只给一句解释。 */
    var headline, sub, next;
    if (allSame) {
      /* 七个方向全挤在一档——这是"你的回答没有区分度"，不是"你都适合" */
      headline = '你的回答没有把任何方向明显区分开';
      sub = '七个方向的匹配度都落在同一档里。这通常说明测评答案比较平均，' +
            '或者你确实对哪一类都还没有明显偏好——两种情况都正常，' +
            '先按「方向图谱」把每个方向了解一遍，比纠结排名有用。';
      next = '<button class="link-btn" data-action="go-directions">去看七个方向分别做什么 ' +
        UI.icon('arrow-right') + '</button>';
    } else if (onlyOne) {
      headline = '你的匹配方向是「' + names[0] + '」';
      sub = '它比第二档高出 ' + AICS.Calc.BAND_GAP + ' 分以上，区分度足够，可以认真考虑。';
      next = '';
    } else {
      headline = '你属于第 1 档，这一档有 ' + names.length + ' 个方向';
      sub = '这几个方向的匹配度没有实质差别——分差都在 ' + AICS.Calc.BAND_GAP +
            ' 分以内，相当于一道自评题的出入。所以选哪个不该看分数，该看别的：' +
            '你更愿意天天写代码还是跟人打交道、能不能接受读研、想去哪个城市。';
      /* 档内超过 3 个方向时，直接给一个动作 */
      next = names.length >= 4
        ? '<button class="link-btn" data-action="go-compare">挑其中两个摆在一起对比 ' +
          UI.icon('arrow-right') + '</button>'
        : '';
    }

    return '<div class="band-conclusion">' +
      '<div class="band-conclusion__icon">' + UI.icon('target') + '</div>' +
      '<div class="band-conclusion__body">' +
        '<strong>' + UI.esc(headline) + '</strong>' +
        '<p>' + UI.esc(sub) + '</p>' +
        (onlyOne || allSame ? '' :
          '<div class="band-conclusion__tags">' +
            names.map(function (n) { return '<span class="tag tag--ghost">' + UI.esc(n) + '</span>'; }).join('') +
          '</div>') +
        (next ? '<div class="band-conclusion__next">' + next + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  /* 右侧：三项分项各自的可视化 + 算法拆解。
     要 analysis 而不是只要 weights——兴趣和偏好那两张图需要"我的"向量。 */
  function detailPanel(r, analysis) {
    var dir = r.dir;
    var weights = analysis.weights;
    /* 把权重换成百分比文字，三张图的标题上都要标 */
    var wp = {
      ability: Math.round(weights.ability * 100) + '%',
      interest: Math.round(weights.interest * 100) + '%',
      pref: Math.round(weights.pref * 100) + '%'
    };

    /* 兴趣：我的六型 vs 这个方向的六型，都乘 100 方便画图 */
    var interestAxes = AICS.INTEREST_TYPES.map(function (t) { return t.name; });
    var interestMine = AICS.INTEREST_TYPES.map(function (t) {
      return Math.round((analysis.interest[t.key] || 0) * 100);
    });
    var interestNeed = AICS.INTEREST_TYPES.map(function (t) {
      return Math.round((dir.interest[t.key] || 0) * 100);
    });

    /* 偏好：三根轴各画一条刻度轨道。
       轴本身是 0~1 的双向连续谱（钻研深度 ↔ 快速交付），
       用"位置"表示比用"分数"直观，所以没做成雷达——
       雷达隐含"越往外越多"，而这里 0.5 才是中立点，
       画成雷达会让人以为"钻研深度拉满"是好事。 */
    var prefRows = AICS.PREF_AXES.map(function (ax) {
      var mine = analysis.pref[ax.key] || 0;
      var need = dir.pref[ax.key] || 0;
      var fit = Math.round((1 - Math.abs(mine - need)) * 100);
      var mPct = mine * 100, nPct = need * 100;
      /* 填充段从"中位"出发，而不是从最左边。
         从左边填会让人以为"钻研深度"是默认值、越往右越多；
         从中间填，一眼看出你往哪一边偏、偏多少。 */
      var fillLeft = Math.min(mPct, 50);
      var fillW = Math.abs(mPct - 50);
      return '<div class="pref-row">' +
        '<div class="pref-row__head">' +
          '<strong>' + UI.esc(ax.left) + ' ←→ ' + UI.esc(ax.right) + '</strong>' +
          '<span>合拍 ' + fit + '%</span>' +
        '</div>' +
        '<div class="pref-row__track">' +
          '<i class="pref-row__fill" style="left:' + fillLeft + '%;width:' + fillW + '%"></i>' +
          '<i class="pref-row__mid"></i>' +
          '<i class="pref-row__need" style="left:' + nPct + '%" ' +
            'title="这个方向的偏好位置"></i>' +
          '<i class="pref-row__mine" style="left:' + mPct + '%" ' +
            'title="你的位置"></i>' +
        '</div>' +
      '</div>';
    }).join('');

    /* 差距明细：每个维度显示"我现在多少 / 岗位要多少 / 差多少" */
    var gapRows = r.gaps.map(function (g) {
      var color = g.gap > 0 ? (g.gap > 30 ? UI.tone('danger') : UI.tone('warn')) : UI.tone('ok');
            /* 超出要求的时候写「已达标 +35」会被读成"涨了 35 分"，
         其实它是富余量。写全就没有歧义了。 */
      var label = g.gap > 0 ? ('还差 ' + g.gap + ' 分') : ('已达标，高出 ' + g.surplus + ' 分');
      return '<div class="gap-row">' +
        '<div class="gap-row__head">' +
          '<strong>' + UI.esc(g.name) + '</strong>' +
          '<span style="color:' + color + '">' + label + '</span>' +
        '</div>' +
        '<div class="gap-row__track">' +
          '<div class="gap-row__mine" style="width:' + g.mine + '%"></div>' +
          '<div class="gap-row__need" style="left:' + g.need + '%" title="岗位要求 ' + g.need + ' 分"></div>' +
        '</div>' +
        '<div class="gap-row__nums"><span>你现在 ' + g.mine + '</span><span>岗位要求 ' + g.need + '</span></div>' +
      '</div>';
    }).join('');

    /* 优先补齐建议：只取还有缺口的，最多三条 */
    var advice = r.gaps.filter(function (g) { return g.gap > 0; })
      .sort(function (a, b) { return b.gap - a.gap; })
      .slice(0, 3)
      .map(function (g) {
        return '<li><strong>' + UI.esc(g.name) + '</strong>：' + UI.esc(AICS.DIM_ADVICE[g.key] || '') + '</li>';
      }).join('');
    if (!advice) advice = '<li>你的能力已经覆盖了这个方向的全部要求，接下来重点是做深项目、积累作品。</li>';

    return '<div class="panel">' +
      '<div class="panel__head">' +
        '<div><h3>' + UI.esc(dir.name) + '</h3>' +
        '<p class="muted">' + UI.esc(dir.sub) + '</p></div>' +
        /* 取整：全站所有对外露出的分数都是整数。
           只有下面「算法拆解」那一栏保留一位小数——那是给人对账用的，
           四舍五入会让"三项加权怎么得到总分"算不通。 */
        '<div class="detail-score-inline" style="color:' + UI.scoreColor(r.total) + '">' +
          '<strong>' + Math.round(r.total) + '</strong><span>' +
            UI.scoreLabel(r.total) + '</span></div>' +
      '</div>' +

      /* 三项分项各给一张对比图，而且都标上本年级权重。
         原来只有「能力」这一项有图（雷达）——可它是权重最小的一项：
         大一的能力只占 15%，兴趣 50%、偏好 35%。
         结果就是这一页最显眼的图形画的偏偏是最不要紧的东西，
         学生会盯着"我离岗位要求差这么多"发懵，而分数却有 80 多。
         三张都摆出来、各自标上权重，一眼就知道谁轻谁重。

         这一个模块（雷达图 + 逐项差距）共用一个标题，因为它俩本来就是
         同一组数据的两种看法。原来两块各挂一个同级标题，看着像两个独立模块，
         而右边那块的副标题写的是"上面那张图的数字版"——
         手机上确实是上下排，**电脑上却是左右并排，"上面"两个字当场就撒谎了**。
         改成共用标题之后：两块无条件属于同一个模块，也不需要任何方位描述。 */
      '<div class="match-block">' +
        '<h4>能力对比 <em class="chart-weight">本年级权重 ' + wp.ability + '</em>' +
          '<span class="match-block__hint">同一组数据的两种看法：' +
            '图看差距的形状，数看每一项差多少</span></h4>' +
        '<div class="match-charts">' +
          '<div class="match-chart">' +
            '<canvas id="gap-radar" class="chart-canvas" style="height:340px"></canvas>' +
            '<div class="legend">' +
              '<span><i style="background:' + UI.tone('warn') + '"></i>岗位要求</span>' +
              '<span><i style="background:' + UI.tone('accent') + '"></i>你的自评</span>' +
            '</div>' +
          '</div>' +
          '<div class="match-chart">' +
            '<h5>逐项差距</h5>' +
            '<div class="gap-list">' + gapRows + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="match-charts">' +
        '<div class="match-chart">' +
          '<h4>兴趣画像对比 <em class="chart-weight">本年级权重 ' + wp.interest + '</em></h4>' +
          '<canvas id="interest-radar" class="chart-canvas" style="height:340px"></canvas>' +
          '<div class="legend">' +
            '<span><i style="background:' + UI.tone('warn') + '"></i>这个方向的画像</span>' +
            '<span><i style="background:' + UI.tone('accent') + '"></i>你的兴趣</span>' +
            '<span class="legend__note">看形状像不像，不看高低</span>' +
          '</div>' +
        '</div>' +
        /* match-chart--center：这一列只有三根轴，内容比旁边的雷达矮一大截。
           网格子项默认顶对齐，下面会空出一大片，整块看着像挂在上面那张图上，
           不像一个独立模块（用户就是这么误会的）。让内容在剩余高度里居中。 */
        '<div class="match-chart match-chart--center">' +
          '<h4>工作偏好对比 <em class="chart-weight">本年级权重 ' + wp.pref + '</em></h4>' +
          '<div class="pref-list">' + prefRows + '</div>' +
          '<div class="legend">' +
            '<span><i style="background:' + UI.tone('warn') + '"></i>这个方向</span>' +
            '<span><i style="background:' + UI.tone('accent') + '"></i>你的位置</span>' +
            '<span class="legend__note">灰线＝中立点，圆点往哪边偏就是偏向哪一头</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* 算法拆解：把分数是怎么来的直接摆出来 */
      '<details class="algo">' +
        '<summary>' + UI.icon('chart') + ' 这个分数是怎么算出来的？点开看算法拆解</summary>' +
        '<div class="algo__body">' +
          '<div class="algo__formula">' + UI.esc(r.formula) + '</div>' +
          /* 这一栏刻意保留一位小数：它是给人对账用的，
             取整之后"三项加权怎么得出总分"就对不上了。
             页面上其他所有分数都是整数。 */
          '<p class="rank-note">下面三项保留一位小数，是为了让你能自己对一遍加权过程；' +
            '页面上其他地方显示的都是取整后的结果。</p>' +
          '<div class="algo__parts">' +
            '<div><b>能力匹配度 ' + r.abilityScore + '</b>（本年级权重 ' + wp.ability + '）' +
              '<p>先逐维度算「岗位要求 − 你的自评」，只算没达到的部分；再按岗位对各能力的看重程度加权平均，' +
              '得到一个加权缺口，用 100 减去它。岗位越看重的能力缺了，扣分越多。</p></div>' +
            '<div><b>兴趣匹配度 ' + r.interestScore + '</b>（本年级权重 ' + wp.interest + '）' +
              '<p>把你的兴趣六型画像和这个方向的兴趣画像都看成六维向量，算余弦相似度。' +
              '它衡量的是"形状"像不像，不受你打分整体偏高偏低的影响。</p></div>' +
            '<div><b>偏好匹配度 ' + r.prefScore + '</b>（本年级权重 ' + wp.pref + '）' +
              '<p>工作方式三个轴逐个比较你和这个方向的差距，取平均贴近度。' +
              '比如你偏好独立攻坚，而这个方向需要大量协作，这一项就会拉低。</p></div>' +
          '</div>' +
        '</div>' +
      '</details>' +

      '<div class="panel__sub">' +
        '<h4>优先补齐建议</h4>' +
        '<ul class="advice-list">' + advice + '</ul>' +
      '</div>' +

      '<div class="panel__foot">' +
        /* 按钮文字里不再重复方向名。面板顶上那行大字就是方向名，
           而且 .btn 是 white-space:nowrap——名字一长（"AI 平台 / MLOps 工程师"
           这种），按钮的 min-content 会撑到 363px，把整个网格列顶宽，
           手机上一整页都能横向拖。 */
        '<button class="btn btn--primary" data-action="set-target" data-id="' + dir.id + '">' +
          UI.icon('target') + ' 设为目标方向</button>' +
        '<button class="btn" data-action="dir-detail" data-id="' + dir.id + '">' +
          '查看完整方向介绍</button>' +
      '</div>' +
    '</div>';
  }

  /* 画详情面板里的两张雷达图：能力（8 维）和兴趣（6 维）。
     首次挂载和点左侧换方向时都要画，所以抽出来共用——
     原来这段在 mount 里写过一遍，换方向那里又原样抄了一遍，
     加第二张图时就得改两处，正是最容易漏一个的那种结构。 */
  function drawDetailCharts(scope, r, analysis) {
    function radar(sel, axes, needVals, mineVals, needName) {
      var canvas = scope.querySelector(sel);
      if (!canvas) return;
      AICS.Charts.radar(canvas, {
        axes: axes,
        series: [
          { name: needName, values: needVals, color: UI.tone('warn') },
          { name: '你', values: mineVals, color: UI.tone('accent') }
        ]
      });
    }

    radar('#gap-radar',
      AICS.DIMS.map(function (d) { return d.short; }),
      AICS.DIMS.map(function (d) { return r.dir.req[d.key] || 0; }),
      AICS.DIMS.map(function (d) { return analysis.ability[d.key] || 0; }),
      '岗位要求');

    radar('#interest-radar',
      AICS.INTEREST_TYPES.map(function (t) { return t.name; }),
      AICS.INTEREST_TYPES.map(function (t) { return Math.round((r.dir.interest[t.key] || 0) * 100); }),
      AICS.INTEREST_TYPES.map(function (t) { return Math.round((analysis.interest[t.key] || 0) * 100); }),
      '这个方向');
  }

  AICS.Views.match = {
    title: '匹配诊断',
    /* 顶栏副标题。原来是"算出你最适合哪个方向，以及差在哪"——
       和这一页的做法直接打架：本页刻意不给"最适合的那一个"，
       只给档位。而且这句话就印在页面内副标题
       "看看七个方向各落在哪一档"的上面，两句话上下叠着说反话。 */
    desc: '七个方向各落在哪一档，以及差在哪',

    render: function () {
      var state = AICS.Store.get();
      var analysis = AICS.Calc.analyse(state);

      /* 没做完测评就没法算，引导去做测评 */
      if (!analysis) {
        var answered = AICS.Calc.answeredCount(state.assess.answers || {});
        var total = AICS.Calc.totalQuestions();
        return UI.pageHeader('匹配诊断', '先完成测评，这里才会出结果') +
          UI.empty({
            icon: 'chart',
            title: '还没有测评数据',
            desc: '方向匹配度是根据你的兴趣、能力和工作偏好算出来的，目前已完成 ' +
              answered + ' / ' + total + ' 题。答完之后这里会自动生成完整诊断。',
            action: 'go-assess',
            actionText: '去完成测评'
          });
      }

      var current = pickDefault(state, analysis);
      selectedId = current;
      var currentResult = analysis.ranked.filter(function (r) { return r.id === current; })[0];
      var w = analysis.weights;

      var head = UI.pageHeader('匹配诊断',
        /* 这里原来写的是"七个方向按匹配度排序"，但这一页刻意不给名次，
           "排序"两个字会让人以为下面是个排行榜。改成"分档"。 */
        '看看七个方向各落在哪一档，点任意一个看详细差距',
        '<button class="btn" data-action="go-compare">' + UI.icon('scale') + ' 并排对比两个方向</button>' +
        '<button class="btn" data-action="go-report">' + UI.icon('file') + ' 生成规划书</button>');

      /* 用户跳过了首次向导的话，年级会是空的。这时候结果只能用通用权重估算，
         必须明确告诉他，否则他不知道自己看的是"不准的版本" */
      var noYear = !analysis.year
        ? '<div class="banner banner--warn">' + UI.icon('alert') +
            '<div><strong>你还没填年级，下面的结果用的是通用权重</strong>' +
            '<span>年级会改变匹配算法的权重。填上之后，推荐会明显更贴合你的实际情况</span></div>' +
            '<button class="link-btn" data-action="show-onboarding">现在去填 ' + UI.icon('arrow-right') + '</button>' +
          '</div>'
        : '';

      /* 权重会跟着年级变，这里明确告诉用户当前用的是什么标准 */
      var weightNote = '<div class="weight-note">' +
        '<span>按你填的年级「<strong>' + UI.esc(analysis.year || '未填') + '</strong>」计算：</span>' +
        '<span class="weight-note__item"><i></i>能力 <strong>' + Math.round(w.ability * 100) + '%</strong></span>' +
        '<span class="weight-note__item"><i class="w2"></i>兴趣 <strong>' + Math.round(w.interest * 100) + '%</strong></span>' +
        '<span class="weight-note__item"><i class="w3"></i>偏好 <strong>' + Math.round(w.pref * 100) + '%</strong></span>' +
        '<span class="muted">' + UI.esc(analysis.yearReason) + '</span>' +
        '<button class="link-btn" data-action="open-settings">改年级 ' + UI.icon('arrow-right') + '</button>' +
      '</div>';

      return head + noYear + weightNote + conclusion(analysis, !!state.profile.targetId) +
        '<div class="match-layout">' +
          '<div class="panel rank-panel">' +
            '<div class="panel__head"><h3>分档结果</h3>' +
              '<span class="muted">分差 ' + AICS.Calc.BAND_GAP + ' 分以内算同一档</span></div>' +
            rankList(analysis, current) +
            /* 这里的百分比必须跟着上面 weightNote 走。
               原来写死了 45/35/20——那是"年级没填"时的兜底值，
               结果大一学生会在同一屏上看到"能力 15%"和"能力 45%"两套说法。 */
            '<p class="rank-note">匹配度由能力（' + Math.round(w.ability * 100) + '%）、兴趣（' +
              Math.round(w.interest * 100) + '%）、偏好（' + Math.round(w.pref * 100) + '%）三项加权得出，' +
              '反映的是「现在开始准备」的契合程度，不是能力上限。' +
              '档内的方向不排名次——因为实测它们的差距小于测评本身的误差。</p>' +
          '</div>' +
          '<div class="match-detail">' + detailPanel(currentResult, analysis) + '</div>' +
        '</div>';
    },

    mount: function (root) {
      var state = AICS.Store.get();
      var analysis = AICS.Calc.analyse(state);
      if (!analysis) return;

      var currentResult = analysis.ranked.filter(function (r) { return r.id === selectedId; })[0];
      if (!currentResult) return;

      /* 告诉 AI 助手：用户此刻正在看这个方向 */
      AICS.PageContext.directionId = selectedId;

      drawDetailCharts(root, currentResult, analysis);

      /* 点排行榜切换方向：只重绘右侧详情，左侧列表更新选中态 */
      root.addEventListener('click', function (e) {
        var row = e.target.closest('[data-action="pick-dir"]');
        if (!row) return;

        var id = row.getAttribute('data-id');
        if (id === selectedId) return;
        selectedId = id;
        AICS.PageContext.directionId = id;   // 同步给 AI 助手

        var result = analysis.ranked.filter(function (r) { return r.id === id; })[0];
        if (!result) return;

        /* 更新左侧高亮 */
        root.querySelectorAll('.rank-row').forEach(function (r) {
          r.classList.toggle('is-active', r.getAttribute('data-id') === id);
        });

        /* 替换右侧详情，再把两张图重画一遍 */
        var detail = root.querySelector('.match-detail');
        if (detail) {
          detail.innerHTML = detailPanel(result, analysis);
          drawDetailCharts(detail, result, analysis);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  };

})(window.AICS);
