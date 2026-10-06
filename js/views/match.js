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
      sub = '七个方向的匹配度都落在同一档里。可能是测评答案比较平均，' +
            '也可能是你对哪一类都还没有明显偏好。先按「方向图谱」把每个方向了解一遍，' +
            '比纠结排名有用。';
      next = '<button class="link-btn" data-action="go-directions">去看七个方向分别做什么 ' +
        UI.icon('arrow-right') + '</button>';
    } else if (onlyOne) {
      headline = '你的匹配方向是「' + names[0] + '」';
      sub = '它比第二档高出 ' + analysis.bandGap + ' 分以上，区分度足够，可以认真考虑。';
      next = '';
    } else {
      headline = '你属于第 1 档，这一档有 ' + names.length + ' 个方向';
      sub = '这几个方向的匹配度没有实质差别，分差都在 ' + analysis.bandGap +
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

  /* 答卷可信度提示条。

     只在结果不够可靠时出现——可靠的时候它不出声。一整条横幅如果
     永远挂在那儿，用户第三次打开就自动忽略它了，真正该看的那次也跟着一起被忽略。

     它要解释清楚的是**为什么这一档这么宽**。不解释的话，用户只会
     觉得档位是随手划的，而这条提示恰好就是档位变宽的原因。 */
  function consistencyNote(analysis) {
    var c = analysis.consistency;
    if (!c || c.level === 'good') return '';

    var head = c.flat
      ? '这次测评的答案几乎都选了同一档'
      : '这次测评的答案前后有些不一致';

    var why = c.flat
      ? '所有题都选了同一个分值，哪一类偏好都没区分出来。'
      : '偏好部分每个轴都有正反两道题，问的是一件事的两面。你有 ' +
        c.clashes + ' 处答得对不上。';

    /* 只说后果，不解释我为什么这么设计。
       "这是有意的：与其…不如…"那种话是在跟用户交代自己的取舍，
       他不需要知道，看到了只会觉得莫名其妙。 */
    var effect = analysis.bandGap > AICS.Calc.BAND_GAP
      ? '所以下面的档位放宽到了 ' + analysis.bandGap + ' 分，分不开的方向会被并进同一档。'
      : '';

    return '<div class="banner banner--warn">' + UI.icon('alert') +
      '<div><strong>' + UI.esc(head) + '</strong>' +
      '<span>' + UI.esc(why + effect) + '</span></div>' +
      '<button class="link-btn" data-action="go-assess">重新测一次 ' + UI.icon('arrow-right') + '</button>' +
    '</div>';
  }

  /* ---------- 成对比较 ----------
     用于"第一档挤了好几个方向、分数分不出高低"的情况。

     做法是不问"你喜欢哪个方向"——答得上来的人就不用做测评了——
     而是问"这两件事你更愿意做哪件"。具体的场景比方向名容易判断得多，
     而且选出来的结果是**用户自己的选择**，不是算法推的，
     这一点在文案里必须说清楚。 */

  var DUEL_ROUNDS = 4;

  /* 对比进度只存在内存里：4 轮点完就一分钟，中途切页丢掉可以接受。
     不写进存档的另一个原因是不污染用户数据——他随便试两下，
     不该在存档里留下痕迹。 */
  var duel = null;

  /* 一场比赛的主键。组合跟顺序无关，A 比 B 和 B 比 A 是同一场 */
  function duelPairKey(a, b) {
    return a < b ? a + '|' + b : b + '|' + a;
  }

  /* 这一档当前是哪几个方向。
     对比进度存在内存里，跨页不会丢——这本来是好事（比到第 3 轮切走再
     回来能接着比），但用户中途去「自我认知」改了答案、或者导入了一份
     备份之后，第一档已经换人了，进度却还挂着。方向 id 仍然有效，
     所以不会触发下面那条自愈分支，只是静默地接着比上一轮的对阵。
     存一个签名，每次渲染对一次，对不上就当没比过。 */
  function duelSignature(analysis) {
    return analysis.topBand.items.map(function (r) { return r.id; }).sort().join('|');
  }

  /* 上一次记分的时间。一次点击会整页重绘，新一轮的两张卡片几乎出现在
     原来的位置上，手快双击就会在没看清对手的情况下被记成两轮。 */
  var duelLockUntil = 0;

  function duelStart(analysis) {
    duel = {
      sig: duelSignature(analysis),
      ids: analysis.topBand.items.map(function (r) { return r.id; }),
      round: 0,
      limit: DUEL_ROUNDS,   // 做完多少轮出结果；"再比几轮"会把它调大
      wins: {},
      played: {},
      met: {},              // 'a|b' → 这两个交过几次手
      log: [],              // 每场的胜负，按发生顺序记着，算分时重放
      picks: [],
      pair: [],
      done: false
    };
    duelNextPair();
  }

  /* 挑下一组对手：让出场次数最少的先上。

     为什么不按战绩配对（瑞士轮那套）：那个方法要每轮让成绩相近的两个
     对上，才能一轮轮分出层次。可这里总共 4 轮、6 个方向，第一轮打完
     只产生一个 1 胜的，根本就没有"成绩相近"的第二个。
     这个场次下，**保证每个方向都被评估到**比"强强对话"重要得多。

     出场次数相同时按 id 排，是为了让结果稳定；另外还要往后找一对
     没交过手的——六个方向各出场一次之后排序会回到初始状态，
     不加这一步，第 4 轮会和第 1 轮撞上（实测过），用户以为卡住了。 */
  function duelNextPair() {
    var d = duel;
    var pool = d.ids.slice().sort(function (a, b) {
      var pa = d.played[a] || 0, pb = d.played[b] || 0;
      if (pa !== pb) return pa - pb;
      return a < b ? -1 : (a > b ? 1 : 0);
    });

    for (var i = 0; i < pool.length; i++) {
      for (var j = i + 1; j < pool.length; j++) {
        if (!d.met[duelPairKey(pool[i], pool[j])]) {
          d.pair = [pool[i], pool[j]];
          return;
        }
      }
    }

    /* 所有组合都比过了（方向数少的时候会这样，比如 3 个候选做 4 轮）：
       退回最简单的取法，允许重复 */
    d.pair = [pool[0], pool[1]];
  }

  function duelAdvance() {
    var d = duel;
    var key = duelPairKey(d.pair[0], d.pair[1]);
    d.met[key] = (d.met[key] || 0) + 1;
    d.pair.forEach(function (id) { d.played[id] = (d.played[id] || 0) + 1; });
    d.round++;
    if (d.round >= d.limit) { d.done = true; return; }
    duelNextPair();
  }

  function duelPick(id) {
    var d = duel;
    var other = d.pair[0] === id ? d.pair[1] : d.pair[0];
    d.wins[id] = (d.wins[id] || 0) + 1;
    d.picks.push(id);
    /* 记下这一场的胜负。算分时要按顺序重放，因为分是逐场累积的 */
    d.log.push({ win: id, lose: other });
    duelAdvance();
  }

  /* ------------------------------------------------------------
   * 把"你赢了谁"换算成每个方向的强度 —— 用 Elo
   *
   * 只数胜场是不够的。"赢了 2 次"和"赢了 2 次"不是一回事——
   * 赢的是强手还是弱手，分量差很多。
   *
   * 一开始我用的是这个领域更"正统"的 Bradley-Terry（BT），
   * 结果**实测跑出来是反的**：4 轮里算法工程师 2 胜 0 负，
   * 而且赢的嵌入式自己还赢过别人；MLOps 只出场 1 次、赢了一个
   * 谁都没赢过的方向——BT 把 MLOps 排在算法工程师前面。
   *
   * 手算核了一遍，它在数学上没错：BT 的估计是"没看到反例就更强"，
   * 出场少又全胜的人 θ 会被推得很高。但这个结论和用户自己的印象
   * 是打架的——他明明选了算法工程师两次。
   *
   * 换成 Elo 就没这个问题：所有人从同一个分数出发，赢一场加多少
   * 取决于对手当前的分数。出场少的人不会因为"样本少"被抬高。
   * 输出上也不显示分数（1500 分对用户没有意义），只用它排序和
   * 判断"领先够不够明显"。
   * ---------------------------------------------------------- */
  var DUEL_ELO_BASE = 1500;
  var DUEL_ELO_K = 40;        // 场次少，K 给大一点才动得起来

  function duelRatings() {
    var d = duel;
    var r = {};
    d.ids.forEach(function (id) { r[id] = DUEL_ELO_BASE; });

    /* 按发生的顺序重放每一场——分是逐场累积的，顺序会影响结果 */
    d.log.forEach(function (m) {
      var ea = 1 / (1 + Math.pow(10, (r[m.lose] - r[m.win]) / 400));
      var eb = 1 - ea;
      r[m.win] += DUEL_ELO_K * (1 - ea);
      r[m.lose] += DUEL_ELO_K * (0 - eb);
    });
    return r;
  }

  /* ------------------------------------------------------------
   * 排序和"算不算分出高下"
   *
   * 判据是**胜场数有没有拉开**，不是 Elo 分差。
   *
   * 试过用分差：4 轮、K=40 的情况下，赢一场只加 20 分左右，
   * "2 胜 0 负"和"1 胜 0 负"的分差也就 20 分，跟"大家各赢一场"
   * 的分差拉不开距离——阈值定多少都不对。
   *
   * 改成先看胜场数，用户自己也数得清："你选了它两次，别人都只有一次"——
   * 这句话他一看就懂，而"Elo 1520 对 1500"他只会问那是什么。
   * Elo 退到后面，只负责**胜场相同时的排序**：同样赢一场，
   * 赢了强手的排前面。
   * ---------------------------------------------------------- */
  function duelRanking() {
    var d = duel;
    var r = duelRatings();

    var order = d.ids.slice().sort(function (a, b) {
      var wa = d.wins[a] || 0, wb = d.wins[b] || 0;
      if (wa !== wb) return wb - wa;
      return r[b] - r[a];
    });

    var topWins = d.wins[order[0]] || 0;
    var secondWins = d.wins[order[1]] || 0;

    return {
      rating: r,
      order: order,
      top: order[0],
      topWins: topWins,
      /* 算"明显领先"要同时满足两条：
         ① 赢过至少 2 次——只赢 1 次就宣布胜出是原来那版的毛病，
            那次胜出很可能只是因为别人出场更少
         ② 比第二名多——两个都赢 2 次的话，谁也压不过谁 */
      clear: topWins >= 2 && topWins > secondWins,
      /* 胜场数和第一名一样多的那些 */
      close: order.filter(function (id) { return (d.wins[id] || 0) === topWins; })
    };
  }

  /* 场景取第几条：按这个方向已经出场过几次来轮换。
     同一个方向第二次出现时换一句，不然用户会觉得系统在敷衍他。 */
  function sceneOf(dirId, seenTimes) {
    var list = AICS.PAIR_SCENES[dirId] || [];
    if (!list.length) return '';
    return list[seenTimes % list.length];
  }

  function duelCard(dir, seenTimes) {
    return '<button class="duel-card" data-action="duel-pick" data-id="' + dir.id + '">' +
      '<span class="duel-card__name">' + UI.esc(dir.name) + '</span>' +
      '<span class="duel-card__scene">' + UI.esc(sceneOf(dir.id, seenTimes)) + '</span>' +
      '<span class="duel-card__cta">更想做这个</span>' +
    '</button>';
  }

  /* 结果分三种：一次都没选 / 分不出高下 / 有明确领先。

     中间那一种是这次改的重点。原来只要有人胜场最多就宣布它是结果，
     可 4 次二选一本来就只能给一个很粗的信号——硬选出来的"第一名"，
     和匹配度分数那个"第一名"一样站不住，而这个作品从 5.13 节开始
     就一直在拒绝给这种假精度。领先幅度不够的时候，答案是"还没分出来"，
     并且要真的有用：告诉他下一步该看什么，而不是丢一句"请再想想"。 */
  function duelResult() {
    var d = duel;

    /* 一次都没选：这本身也是有用的信息，别当成"操作失败" */
    if (!d.picks.length) {
      return '<div class="panel duel">' +
        '<div class="panel__head"><h3>对比做完了</h3></div>' +
        '<p class="muted">这几轮你都选了「说不清」。这说明这些事你还没有真实的偏好，' +
          '先别急着定方向。现在硬选一个，过两个月多半还要改。</p>' +
        '<p class="muted">更值得做的是：去「方向图谱」把每个方向具体做什么看一遍，' +
          '或者找一件相关的小事动手做一次。做过之后再来比，会容易得多。</p>' +
        '<div class="duel__actions">' +
          '<button class="btn" data-action="duel-restart">重新开始对比</button>' +
        '</div>' +
      '</div>';
    }

    var rk = duelRanking();

    if (!rk.clear) {
      var names = rk.close.map(function (id) { return AICS.Directions.byId(id).name; });
      return '<div class="panel duel">' +
        '<div class="panel__head"><h3>比完了，但这几个还没分出高下</h3></div>' +
        '<p>' + d.round + ' 轮下来，' +
          names.map(function (n) { return '「' + UI.esc(n) + '」'; }).join('、') +
          '在你这里挨得很近，谁也没明显压过谁。</p>' +
        '<p class="muted">' + d.round + ' 次二选一，本来就不够把 ' + d.ids.length +
          ' 个方向排出高低。挑的时候可以看这几点：能不能接受读研、想去哪个城市、' +
          '学校有没有相关的老师。</p>' +
        '<div class="duel__actions">' +
          '<button class="btn btn--primary" data-action="duel-more">再比几轮</button>' +
          '<button class="btn" data-action="go-compare">把这两个摆在一起对比</button>' +
        '</div>' +
        '<button class="link-btn" data-action="duel-restart">重新开始对比</button>' +
      '</div>';
    }

    var top = AICS.Directions.byId(rk.top);
    return '<div class="panel duel">' +
      '<div class="panel__head"><h3>对比做完了</h3></div>' +
      '<p>' + d.round + ' 轮里，「<strong>' + UI.esc(top.name) + '</strong>」赢下 ' +
        (d.wins[rk.top] || 0) + ' 次，是这几个里最突出的。</p>' +
      '<p class="muted">这几个方向的匹配度本来就分不开，系统给不出答案，所以让你来选。' +
        '结果是你自己定的，不是它算的。</p>' +
      '<div class="duel__actions">' +
        '<button class="btn btn--primary" data-action="set-target" data-id="' + top.id + '">' +
          UI.icon('target') + ' 把「' + UI.esc(top.name) + '」设为目标方向</button>' +
        '<button class="btn" data-action="duel-more">再比几轮</button>' +
      '</div>' +
      '<button class="link-btn" data-action="duel-restart">重新开始对比</button>' +
    '</div>';
  }

  /* 成对比较面板。只在"分数真的分不开"的时候出现：
     第一档至少 3 个方向，而且用户还没定目标方向。
     已经定过方向的人不需要它——他已经在「方向图谱」里做过一次选择了。 */
  function duelPanel(analysis, state) {
    if (state.profile.targetId) return '';
    if (analysis.topBand.items.length < 3) return '';

    /* 第一档换人了（改过答案、导入过备份），旧的对比进度就作废 */
    if (duel && duel.sig !== duelSignature(analysis)) duel = null;

    if (!duel) {
      var n = analysis.topBand.items.length;
      return '<div class="panel duel">' +
        '<div class="panel__head"><h3>还在纠结选哪个？</h3></div>' +
        '<p class="muted">这一档有 <strong>' + n + ' 个方向</strong>，' +
          '分数上分不出高低，它们的差距本来就小于测评误差。</p>' +
        '<p class="muted">换个问法：<strong>下面这两件事，你更愿意做哪件？</strong>' +
          '凭第一感觉点就行。</p>' +
        '<div class="duel__actions">' +
          '<button class="btn btn--primary" data-action="duel-start">' +
            UI.icon('compass') + ' 开始对比（' + DUEL_ROUNDS + ' 轮）</button>' +
        '</div>' +
      '</div>';
    }

    if (duel.done) return duelResult();

    var a = AICS.Directions.byId(duel.pair[0]);
    var b = AICS.Directions.byId(duel.pair[1]);
    if (!a || !b) { duel = null; return ''; }

    return '<div class="panel duel">' +
      '<div class="panel__head">' +
        '<div><h3>你更愿意做哪件？</h3>' +
        '<p class="muted">别想太多，凭第一感觉选。</p></div>' +
        /* 用 limit 而不是常量：点过「再比几轮」之后总轮数会变大 */
        '<span class="duel__progress">第 ' + (duel.round + 1) + ' / ' + duel.limit + ' 轮</span>' +
      '</div>' +
      '<div class="duel__grid">' +
        duelCard(a, duel.played[a.id] || 0) +
        duelCard(b, duel.played[b.id] || 0) +
      '</div>' +
      '<div class="duel__foot">' +
        '<button class="link-btn" data-action="duel-skip">这两件我都不想 / 说不清</button>' +
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

    /* 差距明细：每个维度显示"我现在多少 / 岗位要多少 / 差多少"。
       加一行实践记录：这一列里"你现在 X 分"是自评，而实践次数是
       客观做过几次——两个数摆在一起，用户自己就能判断自评是高是低。 */
    var gapRows = r.gaps.map(function (g) {
      var color = g.gap > 0 ? (g.gap > 30 ? UI.tone('danger') : UI.tone('warn')) : UI.tone('ok');
            /* 超出要求的时候写「已达标 +35」会被读成"涨了 35 分"，
         其实它是富余量。写全就没有歧义了。 */
      var label = g.gap > 0 ? ('还差 ' + g.gap + ' 分') : ('已达标，高出 ' + g.surplus + ' 分');
      var pr = AICS.practiceOf(g.key);
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
        (pr ? '<p class="gap-row__practice">实践记录：' + UI.esc(pr.text) + '</p>' : '') +
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
            '<div><b>作答一致性 ' + (analysis.consistency ? analysis.consistency.score : '—') +
              '</b>（本次档位宽度 ' + analysis.bandGap + ' 分）' +
              '<p>偏好部分三个轴各有一正一反两道题，问的其实是同一件事的两面。' +
              '两个答案落到轴的两侧，就说明这次作答前后不一致。' +
              '一致性高时档位用默认的 ' + AICS.Calc.BAND_GAP + ' 分，低时放宽。' +
              '作答本身不稳的时候，把方向分得更细只是在制造假精度。</p></div>' +
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
    /* 数据被整体换掉（导入备份 / 清空）时由 app.js 调用 */
    resetState: function () { duel = null; },

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

      return head + noYear + weightNote + consistencyNote(analysis) +
        conclusion(analysis, !!state.profile.targetId) +
        duelPanel(analysis, state) +
        '<div class="match-layout">' +
          '<div class="panel rank-panel">' +
            '<div class="panel__head"><h3>分档结果</h3>' +
              '<span class="muted">分差 ' + analysis.bandGap + ' 分以内算同一档</span></div>' +
            rankList(analysis, current) +
            /* 这里的百分比必须跟着上面 weightNote 走。
               原来写死了 45/35/20——那是"年级没填"时的兜底值，
               结果大一学生会在同一屏上看到"能力 15%"和"能力 45%"两套说法。 */
            '<p class="rank-note">匹配度由能力（' + Math.round(w.ability * 100) + '%）、兴趣（' +
              Math.round(w.interest * 100) + '%）、偏好（' + Math.round(w.pref * 100) + '%）三项加权得出，' +
              '反映的是「现在开始准备」的契合程度，不是能力上限。' +
              '档内的方向不排名次，因为实测它们的差距小于测评本身的误差。</p>' +
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

      /* 成对比较的交互，单独一个监听器。
         不去挤上面那个——它遇到非 pick-dir 的点击会直接 return，
         两件事混在一起改起来容易互相踩。

         每一轮都整页重绘（refresh），而不是局部换 DOM：
         轮次状态在 duel 里，重绘后 render 读它就是新的一轮。
         这个面板的内容每轮都全变（对手、进度、场景句都换），
         局部替换省不下什么，还容易漏掉某一块没更新。 */
      root.addEventListener('click', function (e) {
        if (e.target.closest('[data-action="duel-start"]')) {
          duelStart(analysis);
          AICS.App.refresh();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        var pick = e.target.closest('[data-action="duel-pick"]');
        if (pick) {
          /* 整页重绘之后卡片还在原来的位置，双击会被记成两轮——
             第二轮用户根本没看清新对手是谁。重绘后短暂不响应。 */
          if (Date.now() < duelLockUntil) return;
          duelLockUntil = Date.now() + 400;
          duelPick(pick.getAttribute('data-id'));
          AICS.App.refresh();
          return;
        }
        if (e.target.closest('[data-action="duel-skip"]')) {
          /* 同理：连点两下等于连跳两轮，而且跳过的内容用户没看见 */
          if (Date.now() < duelLockUntil) return;
          duelLockUntil = Date.now() + 400;
          duelAdvance();
          AICS.App.refresh();
          return;
        }
        /* 在已有结果上继续比，不清空。
           4 轮只是默认值——每多一轮，BT 的推断就更稳一点，
           想更确定的人可以一直加下去。 */
        if (e.target.closest('[data-action="duel-more"]')) {
          if (Date.now() < duelLockUntil) return;
          duelLockUntil = Date.now() + 400;
          duel.done = false;
          duel.limit += DUEL_ROUNDS;
          duelNextPair();
          AICS.App.refresh();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        if (e.target.closest('[data-action="duel-restart"]')) {
          duel = null;
          AICS.App.refresh();
        }
      });
    }
  };

})(window.AICS);
