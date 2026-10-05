/* ============================================================
 * calc.js —— 测评计分与方向匹配算法
 * ------------------------------------------------------------
 * 匹配度由三个分项加权得到：
 *   能力匹配度 —— 你的能力离岗位要求还差多少（加权缺口）
 *   兴趣匹配度 —— 你的兴趣画像和岗位画像有多像（余弦相似度）
 *   偏好匹配度 —— 你的工作方式和岗位节奏合不合（逐轴贴近度）
 *
 * 权重不是固定的，会跟着年级变。原因：大一学生能力还没形成，
 * 用固定权重会算出"你什么都不适合"这种没用的结论。越接近毕业，
 * 能力才越重要。这是本算法和普通问卷打分最大的区别。
 * ============================================================ */
window.AICS = window.AICS || {};

(function (AICS) {
  'use strict';

  /* 历史快照按时间排序的比较器。
     必须写成"小于返回 -1、大于返回 1、相等返回 0"三条路都有的形式。
     原来是 `x.at < y.at ? -1 : 1`，相等时也返回 1——
     这不是一个合法的比较器（自己和自己比都说"我更大"），
     排序结果会依赖具体引擎的实现。 */
  function byTime(x, y) {
    var a = String(x && x.at || '');
    var b = String(y && y.at || '');
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  /* 各年级的分项权重。三项之和为 1 */
  var YEAR_WEIGHTS = {
    '大一': { ability: 0.15, interest: 0.50, pref: 0.35 },
    '大二': { ability: 0.35, interest: 0.40, pref: 0.25 },
    '大三': { ability: 0.55, interest: 0.28, pref: 0.17 },
    '大四': { ability: 0.70, interest: 0.20, pref: 0.10 }
  };

  /* 年级缺失或填了未知值时用这一套（大致相当于大三） */
  var DEFAULT_WEIGHTS = { ability: 0.45, interest: 0.35, pref: 0.20 };

  /* 档位阈值：分差在这个值以内的方向算作同一档。

     为什么要有档位：实测七个方向的分数中位只差 8~11 分，第 1 名和第 2 名
     只差 0.7~1.4 分；同一个人重答一遍，第 1 名有 17%~25% 的概率换人。
     也就是说——**顺序是有意义的，具体名次没有**。

     （这个数字原来写的是"19%~40%"，对不上任何一次实测。
     当前配置下的权威数据在讲解文档 5.13 节的表里：
     大一 23.3% / 大二 22.7% / 大三 25.3% / 大四 17.0%。）
     把"87.1 分 vs 89.2 分"这种假精度直接展示给用户，是在骗人。

     5 分这个值的依据：自评量表是 1~5 分制，换算成 0~100 后，
     一道题改一档 = 20 分；经过多项加权平均后，最终分数对单题变化的
     典型波动在 5 分以内。所以"差 5 分以内"就是"答错一道题的量级"。 */
  var BAND_GAP = 5;

  /* 把排好序的方向切成若干档，同档内不再排名次 */
  function band(ranked) {
    var bands = [];
    ranked.forEach(function (r) {
      var last = bands[bands.length - 1];
      /* 和本档的第一名比，而不是和上一个比——
         否则分数会"一级一级往下滑"，把整条链并成一档 */
      if (last && (last.top - r.total) <= BAND_GAP) last.items.push(r);
      else bands.push({ top: r.total, items: [r] });
    });
    bands.forEach(function (b, i) {
      b.index = i;
      b.name = '第 ' + (i + 1) + ' 档';
      b.min = b.items[b.items.length - 1].total;
      /* 把档位号回写到每个方向上，视图里直接读 r.band 就行 */
      b.items.forEach(function (r) { r.band = i; });
    });
    return bands;
  }

  /* 每个分项的一句话解释，界面上和报告里都会用到 */
  var WEIGHT_REASON = {
    '大一': '你刚开始，能力还没成形，这时候主要看兴趣和性格合不合适',
    '大二': '已经有基础了，但兴趣仍然是主要判断依据，能力开始计入',
    '大三': '到了要定去向的时候，能力差距开始成为决定性因素',
    '大四': '求职看的是硬实力，能力占绝对主导，兴趣偏好只做参考'
  };

  /* 取某个年级对应的权重 */
  function weightsFor(year) {
    return YEAR_WEIGHTS[year] || DEFAULT_WEIGHTS;
  }

  /* 每个能力维度的补强建议，差距分析里直接引用 */
  var DIM_ADVICE = {
    math:   '跟着算法补数学：学到逻辑回归就补最大似然，学到反向传播就补链式法则，不要脱离场景啃教材。',
    coding: '用输出倒逼输入：每周写一个能跑起来的小程序，做到 500 行规模后再去刷 LeetCode。',
    ml:     '把经典算法手推一遍，尤其是梯度下降和正则化，理解比会调包重要得多。',
    dl:     '用 PyTorch 完整训练一个模型，走通数据准备到评估的全流程，再复现一篇经典论文。',
    data:   '练熟 SQL 和 Pandas，找一份真实数据集独立完成一次从清洗到可视化的完整分析。',
    deploy: '学会 Linux 命令行、Git 和 Docker，目标是能把自己写的服务部署到服务器上跑起来。',
    product:'做项目时多问一句"这个功能解决了谁的什么问题"，试着写一份完整的需求分析文档。',
    comm:   '坚持写技术博客，每做完一个项目就整理成一篇能给别人看懂的文章，顺便练表达。'
  };
  AICS.DIM_ADVICE = DIM_ADVICE;

  /* 把 1~5 的选项换算成 0~100 的分值（选 3 分 = 60 分） */
  function likertTo100(v) {
    return Math.max(0, Math.min(5, v || 0)) * 20;
  }

  /* 计算八个能力维度的自评得分：{ math: 60, coding: 80, ... } */
  function scoreAbility(answers) {
    var out = {};
    AICS.QUESTIONS_ABILITY.forEach(function (q) {
      out[q.dim] = likertTo100(answers[q.id]);
    });
    return out;
  }

  /* 计算兴趣画像：把六型各自的 4 道题求平均，归一化到 0~1。
     分母用 vals.length 而不是写死 4——这样以后加减题量不用改这里。 */
  function scoreInterest(answers) {
    var out = {};
    AICS.INTEREST_TYPES.forEach(function (t) { out[t.key] = 0; });

    AICS.INTEREST_TYPES.forEach(function (t) {
      var qs = AICS.QUESTIONS_INTEREST.filter(function (q) { return q.type === t.key; });
      var vals = qs.map(function (q) { return answers[q.id]; })
                   .filter(function (v) { return typeof v === 'number'; });
      if (!vals.length) { out[t.key] = 0; return; }
      var sum = vals.reduce(function (a, b) { return a + b; }, 0);
      // 每题 1~5 分：先减去题数（把下界拉到 0），再除以 题数×4 归一化到 0~1
      out[t.key] = (sum - vals.length) / (vals.length * 4);
    });
    return out;
  }

  /* 计算工作偏好三个轴：每题一正一反，反向题先翻转再平均 */
  function scorePref(answers) {
    var out = {};
    AICS.PREF_AXES.forEach(function (axis) {
      var qs = AICS.QUESTIONS_PREF.filter(function (q) { return q.axis === axis.key; });
      var vals = [];
      qs.forEach(function (q) {
        var v = answers[q.id];
        if (typeof v !== 'number') return;
        // 反向计分：1 分变 5 分，5 分变 1 分
        vals.push(q.reverse ? (6 - v) : v);
      });
      if (!vals.length) { out[axis.key] = 0.5; return; }
      var avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
      out[axis.key] = (avg - 1) / 4;   // 1~5 映射到 0~1
    });
    return out;
  }

  /* 余弦相似度：衡量两个向量的"形状"有多像，忽略整体大小 */
  function cosine(a, b) {
    var keys = Object.keys(a);
    var dot = 0, na = 0, nb = 0;
    keys.forEach(function (k) {
      var x = a[k] || 0, y = b[k] || 0;
      dot += x * y; na += x * x; nb += y * y;
    });
    if (na === 0 || nb === 0) return 0.5;   // 全填最低分时无法比较，给中性值
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  /* 能力匹配度：按岗位看重程度加权的缺口，越看重的能力缺了扣得越多 */
  function abilityScore(ability, req) {
    var totalWeight = 0, totalGap = 0;
    AICS.DIMS.forEach(function (d) {
      var need = req[d.key] || 0;
      var mine = ability[d.key] || 0;
      // 超出要求的部分不加分也不倒扣，只算没达到的部分
      var gap = Math.max(0, need - mine);
      totalWeight += need;
      totalGap += need * gap;
    });
    if (totalWeight === 0) return 100;
    return Math.max(0, 100 - totalGap / totalWeight);
  }

  /* 偏好匹配度：三个轴逐个算贴近度再平均 */
  function prefScore(pref, target) {
    var sum = 0, n = 0;
    AICS.PREF_AXES.forEach(function (axis) {
      var diff = Math.abs((pref[axis.key] || 0) - (target[axis.key] || 0));
      sum += (1 - diff);
      n++;
    });
    return n ? (sum / n) * 100 : 100;
  }

  /* 单个方向的完整打分，同时把中间量带出来给页面展示 */
  function matchOne(ability, interest, pref, dir, weights) {
    var w = weights || DEFAULT_WEIGHTS;
    var a = abilityScore(ability, dir.req);
    var i = cosine(interest, dir.interest) * 100;
    var p = prefScore(pref, dir.pref);
    var total = a * w.ability + i * w.interest + p * w.pref;

    // 逐维度算出差距，正数表示还差多少，用于差距分析
    var gaps = AICS.DIMS.map(function (d) {
      var need = dir.req[d.key] || 0;
      var mine = ability[d.key] || 0;
      return {
        key: d.key,
        name: d.name,
        need: need,
        mine: mine,
        gap: Math.max(0, need - mine),
        surplus: Math.max(0, mine - need)
      };
    });

    return {
      id: dir.id,
      name: dir.name,
      total: Math.round(total * 10) / 10,
      abilityScore: Math.round(a * 10) / 10,
      interestScore: Math.round(i * 10) / 10,
      prefScore: Math.round(p * 10) / 10,
      gaps: gaps,
      /* 展示用的一句话拆解，答辩时可以直接念 */
      formula: '能力 ' + a.toFixed(1) + ' × ' + pct(w.ability) +
               ' + 兴趣 ' + i.toFixed(1) + ' × ' + pct(w.interest) +
               ' + 偏好 ' + p.toFixed(1) + ' × ' + pct(w.pref) +
               ' = ' + total.toFixed(1)
    };
  }

  function pct(v) { return Math.round(v * 100) + '%'; }

  /* 测评是否答完：三部分全部有答案才算完成 */
  function isComplete(answers) {
    var all = AICS.QUESTIONS_INTEREST.concat(AICS.QUESTIONS_ABILITY, AICS.QUESTIONS_PREF);
    return all.every(function (q) { return typeof answers[q.id] === 'number'; });
  }

  /* 已答题目数量，用来画进度条 */
  function answeredCount(answers) {
    var all = AICS.QUESTIONS_INTEREST.concat(AICS.QUESTIONS_ABILITY, AICS.QUESTIONS_PREF);
    return all.filter(function (q) { return typeof answers[q.id] === 'number'; }).length;
  }

  /* 总题量 */
  function totalQuestions() {
    return AICS.QUESTIONS_INTEREST.length + AICS.QUESTIONS_ABILITY.length + AICS.QUESTIONS_PREF.length;
  }

  /* 总入口：传入 store 的状态，返回一整套分析结果 */
  function analyse(state) {
    var answers = (state.assess && state.assess.answers) || {};
    if (!isComplete(answers)) return null;

    var year = (state.profile && state.profile.year) || '';
    var weights = weightsFor(year);

    var ability = scoreAbility(answers);
    var interest = scoreInterest(answers);
    var pref = scorePref(answers);

    var ranked = AICS.DIRECTIONS.map(function (dir) {
      return matchOne(ability, interest, pref, dir, weights);
    }).sort(function (x, y) { return y.total - x.total; });

    // 给每个结果补上方向本身的资料，页面直接用
    ranked.forEach(function (r) {
      r.dir = AICS.Directions.byId(r.id);
    });

    var top = ranked[0];

    // 最短板：按自评分数找最低的维度
    var weakest = AICS.DIMS.slice().sort(function (x, y) {
      return (ability[x.key] || 0) - (ability[y.key] || 0);
    })[0];

    /* 优先补齐项，分两种情况：

       ① 用户设了目标方向 → 就按那个方向算。
       ② 没设目标 → 按"第一档这几个方向都要的"算。

       ②为什么不能用第一名：第一档里往往有好几个方向（实测占 10%~24% 的
       测评结果），彼此差距小于测评误差，全站的设计就是**档内不分先后**。
       挑其中一个说"系统推荐它、照着它补"，等于制造了一个不存在的区分度——
       学生一眼就看出来了："第一档不是会有好几个吗？"

       改成整档取"最低要求"：某个维度连这一档里最不挑的那个方向都还差，
       说明不管最后选哪个都得补，补它稳赚不赔。缺口为 0 的维度说明
       至少有一个方向已经达标了，那就不算"都要补"。

       原来这里固定用第一名，还有更严重的后果：把目标设成「算法工程师」的人，
       概览上推荐他去补「AI 产品经理」的产品思维和沟通表达，方向正好是反的。
       四个页面里只有概览这一处没跟着目标走（匹配诊断、规划书、四年规划都跟着）。 */
    var bands = band(ranked);           // 先算档位，下面两种情况都要用

    var targetDir = AICS.Directions.byId((state.profile || {}).targetId);
    var targetRank = targetDir
      ? ranked.filter(function (r) { return r.id === targetDir.id; })[0]
      : null;

    var priority, priorityFor;

    if (targetRank) {
      priority = targetRank.gaps.filter(function (g) { return g.gap > 0; })
        .sort(function (x, y) { return y.gap - x.gap; })
        .slice(0, 3);
      priorityFor = { isTarget: true, id: targetRank.id, name: targetRank.name };
    } else {
      var bandDirs = bands[0].items.map(function (r) { return AICS.Directions.byId(r.id); });
      priority = AICS.DIMS.map(function (d) {
        /* 这一档里对这个维度要求最低的那个方向，要求是多少 */
        var need = Math.min.apply(null, bandDirs.map(function (dir) {
          return (dir.req || {})[d.key] || 0;
        }));
        var mine = ability[d.key] || 0;
        return {
          key: d.key, name: d.name, mine: mine, need: need,
          gap: Math.max(0, need - mine),
          surplus: Math.max(0, mine - need)
        };
      }).filter(function (g) { return g.gap > 0; })
        .sort(function (x, y) { return y.gap - x.gap; })
        .slice(0, 3);

      priorityFor = { isTarget: false, bandName: bands[0].name, bandCount: bandDirs.length };
    }

    return {
      ability: ability,
      interest: interest,
      pref: pref,
      ranked: ranked,
      bands: bands,
      top: top,                       // 仍然是第一名，但界面上不再把它当"唯一答案"
      topBand: bands[0],              // 用户实际属于的档位，这才是要展示的
      weakest: weakest,
      priority: priority,
      /* 上面那三项是照着什么算的。视图要用它来写清楚参照物——
         不写的话，"还差 55 分"到底是跟谁比，用户只能猜。 */
      priorityFor: priorityFor,
      weights: weights,
      year: year,
      yearReason: WEIGHT_REASON[year] || '按通用标准计算',
      answeredAt: state.assess.finishedAt
    };
  }

  /* ---------- 测评历史快照 ---------- */

  /* 一条快照的"指纹"：年级 + 全部答案。
     年级也算进去——年级一换，匹配权重就换，结果等于变了。 */
  function snapshotKey(state) {
    var a = state.assess.answers || {};
    return (state.profile.year || '') + '|' +
      Object.keys(a).sort().map(function (k) { return k + ':' + a[k]; }).join(',');
  }

  /* 把当前测评结果存成一条历史记录，用于画成长曲线。

     去重规则：只跟"最近一条"比，内容一样就不重复记。

     原来是"同一天只留一条"，结果是——学生做完一遍、点「记录当前状态」、
     清空重答、再点，一天之内永远只有 1 条，曲线永远出不来；
     而按钮还弹"已保存…可以在成长曲线里对比"。按钮等于在骗人。
     不是他操作错了，是这条规则没写在任何地方，而且他做的事本来该有反馈。

     改成按内容去重之后：
       · 连点几次「记录当前状态」→ 不会堆出一堆一模一样的点
       · 改了答案再记 → 真的多一个点，曲线立刻能看出来
     这也更贴"成长曲线"的本意：有变化才有记录。 */
  function saveSnapshot() {
    var state = AICS.Store.get();
    var a = analyse(state);
    if (!a) return { ok: false, message: '还没完成测评，无法保存记录' };

    var key = snapshotKey(state);
    var history = (state.history || []).slice().sort(byTime);
    var last = history[history.length - 1];

    /* 和最近一条一模一样：不重复记，但也不算失败，调用方要能区分这两种情况 */
    if (last && last.key === key) {
      return { ok: true, duplicated: true, count: history.length };
    }

    history.push({
      at: new Date().toISOString(),
      key: key,
      year: state.profile.year || '',
      ability: a.ability,
      interest: a.interest,
      pref: a.pref,
      topId: a.top.id,
      topName: a.top.name,
      topScore: a.top.total
    });
    history.sort(byTime);

    /* 最多留 30 条，防止 localStorage 被撑爆 */
    var kept = history.slice(-30);
    AICS.Store.set('history', kept);
    return { ok: true, duplicated: false, count: kept.length };
  }

  /* 把历史记录整理成画折线图需要的形式 */
  function historySeries(history) {
    var list = (history || []).slice().sort(byTime);
    return {
      count: list.length,
      labels: (function () {
        var days = list.map(function (h) { return String(h.at).slice(0, 10); });
        /* 同一天有多条时，光写「10/5」会有两个点顶着同一个标签。
           这种情况补上时分——只在真的重复时才补，平时标签保持短。 */
        var sameDay = days.some(function (d, i) { return days.indexOf(d) !== i; });
        return list.map(function (h) {
          var d = new Date(h.at);
          var md = (d.getMonth() + 1) + '/' + d.getDate();
          if (!sameDay) return md;
          return md + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
        });
      })(),
      years: list.map(function (h) { return h.year || ''; }),
      /* 每个能力维度一条线 */
      dims: AICS.DIMS.map(function (d) {
        return {
          key: d.key,
          name: d.name,
          values: list.map(function (h) { return (h.ability && h.ability[d.key]) || 0; })
        };
      }),
      /* 总分变化 */
      topScores: list.map(function (h) { return { name: h.topName, score: h.topScore }; })
    };
  }

  /* 计算某个维度从第一次到最近一次的变化 */
  function growthSummary(history) {
    var list = (history || []).slice().sort(byTime);
    if (list.length < 2) return null;
    var first = list[0], last = list[list.length - 1];

    return AICS.DIMS.map(function (d) {
      var a = (first.ability && first.ability[d.key]) || 0;
      var b = (last.ability && last.ability[d.key]) || 0;
      return { key: d.key, name: d.name, from: a, to: b, delta: b - a };
    }).sort(function (x, y) { return y.delta - x.delta; });
  }

  AICS.Calc = {
    YEAR_WEIGHTS: YEAR_WEIGHTS,
    DEFAULT_WEIGHTS: DEFAULT_WEIGHTS,
    WEIGHT_REASON: WEIGHT_REASON,
    BAND_GAP: BAND_GAP,
    band: band,
    /* 历史快照的时间排序，成长曲线那边也要用同一套 */
    byTime: byTime,
    weightsFor: weightsFor,
    likertTo100: likertTo100,
    scoreAbility: scoreAbility,
    scoreInterest: scoreInterest,
    scorePref: scorePref,
    cosine: cosine,
    matchOne: matchOne,
    isComplete: isComplete,
    answeredCount: answeredCount,
    totalQuestions: totalQuestions,
    analyse: analyse,
    saveSnapshot: saveSnapshot,
    historySeries: historySeries,
    growthSummary: growthSummary
  };

})(window.AICS);
