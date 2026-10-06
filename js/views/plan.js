/* ============================================================
 * views/plan.js —— 四年行动路线 + 学习任务看板
 * ------------------------------------------------------------
 * roadmap 视图：大一到大四四个阶段，任务可勾选，顶部汇总进度
 * kanban  视图：三列看板，支持新增、编辑、拖动、排序、筛选、删除
 * 两个视图共享同一批任务数据，并且双向联动：
 *   - 看板里勾完成 → 四年规划对应项自动勾上
 *   - 四年规划里勾上 → 看板对应任务自动标记完成
 * ============================================================ */
window.AICS = window.AICS || {};
AICS.Views = AICS.Views || {};

(function (AICS) {
  'use strict';

  var UI = AICS.UI;

  /* 任务可选的所属阶段与优先级。
     颜色存的是语义名，用的时候拿 UI.tone() 解析——
     写死十六进制的话，切到浅色主题会比页面底色还亮。 */
  var TERMS = ['大一', '大二', '大三', '大四', '假期', '其他'];
  var PRIORITIES = [
    { key: 'high', name: '高', tone: 'danger' },
    { key: 'mid',  name: '中', tone: 'warn' },
    { key: 'low',  name: '低', tone: 'mid' }
  ];
  var COLUMNS = [
    { key: 'todo',  name: '待办',   tone: 'neutral' },
    { key: 'doing', name: '进行中', tone: 'warn' },
    { key: 'done',  name: '已完成', tone: 'ok' }
  ];

  /* 筛选条件只存在内存里，不写进存档 */
  var filter = { term: 'all', pri: 'all' };

  /* 四年规划的显示方式：列表 / 时间轴。
     也只存内存——这是"怎么看"，不是数据，没必要占存档。 */
  var roadView = 'list';

  function priorityOf(key) {
    return PRIORITIES.filter(function (p) { return p.key === key; })[0] || PRIORITIES[1];
  }

  function colIndex(status) {
    return Math.max(0, COLUMNS.map(function (c) { return c.key; }).indexOf(status));
  }

  /* 今天的日期串，用来判断任务是否过期 */
  function today() {
    var d = new Date();
    function p(n) { return n < 10 ? '0' + n : String(n); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* ---------- 四年路线 ---------- */

  /* 为这个人额外生成的任务，打个来源标。
     通用任务不打标——规划里绝大多数都是通用的，全打标等于没打标，
     只有多出来的这几条才需要说明"它是照你的情况生成的"。 */
  var KIND_MARK = {
    dir: { name: '方向专项', cls: 'dir' },
    gap: { name: '补齐短板', cls: 'gap' }
  };

  function stageProgress(stage, roadmap) {
    var done = stage.tasks.filter(function (t) { return roadmap[t.id]; }).length;
    return {
      done: done,
      total: stage.tasks.length,
      percent: stage.tasks.length ? (done / stage.tasks.length) * 100 : 0
    };
  }

  /* ---------- 勾完任务之后：问一句"做到什么程度了" ----------
     这是把"诊断 → 处方 → 执行"接成闭环的那一步。原来勾完就没了，
     测评里的自评分和四年规划的执行之间没有任何联系。

     注意这里做的**不是又一次自评**——自评已经有一个 1~5 分的量表，
     再加一个只会让整个体系更糊。这里要的是一个能核对的事实：
     这件事你到底做到哪一步了。所以只有三档，而且措辞都是动词。 */

  var PRACTICE_LEVELS = [
    { key: 'seen',  name: '了解过' },
    { key: 'done',  name: '动手做过' },
    { key: 'teach', name: '能讲清楚' }
  ];

  function practiceAsk(task) {
    return '<div class="practice-ask">' +
      '<span class="practice-ask__label">这项做到什么程度了？</span>' +
      PRACTICE_LEVELS.map(function (lv) {
        return '<button class="practice-ask__btn" data-action="practice"' +
          ' data-id="' + task.id + '"' +
          ' data-dim="' + task.dims[0] + '"' +
          ' data-level="' + lv.key + '">' + lv.name + '</button>';
      }).join('') +
      '<button class="link-btn" data-action="practice-skip" data-id="' + task.id + '">先不记</button>' +
    '</div>';
  }

  /* 回答之后把这一行换成一句回执，而不是直接删掉。

     两个原因。一是删掉之后没有任何"记上了"的痕迹，用户只看到刚才那行
     凭空消失；二是它整行都在 [data-action="toggle-road"] 里面，
     删掉之后同一位置再点一下就会命中整行，把刚勾上的任务又取消掉、
     连看板里的同名任务一起退回待办——"双击回答"等于"记了又取消"。 */
  function practiceDoneHtml(levelKey) {
    var lv = PRACTICE_LEVELS.filter(function (x) { return x.key === levelKey; })[0];
    return '<div class="practice-ask practice-ask--done">' +
      UI.icon('check') + '<span>已记下：' + UI.esc(lv ? lv.name : '') + '</span></div>';
  }

  /* 勾上之后、用户还没回答的那几条。留着它，重绘时接着问—— */
  var pendingAsks = {};

  /* 记一条实践记录，按能力维度累加。

     只记到**第一个**关联维度上。有的任务确实同时练两样
     （「系统学完机器学习经典算法并手推一遍」既练 ml 也练 math），
     两边都记会让两个维度都虚高；而且用户看到"数学实践 3 次"
     会先怀疑系统记错了。TASK_DIMS 里第一个就是主维度。 */
  function recordPractice(dim, level) {
    var all = Object.assign({}, AICS.Store.get().practice || {});
    var rec = Object.assign({ seen: 0, done: 0, teach: 0 }, all[dim] || {});
    rec[level] = (rec[level] || 0) + 1;
    all[dim] = rec;
    AICS.Store.replaceKey('practice', all);
  }

  function stageCard(stage, roadmap) {
    var pr = stageProgress(stage, roadmap);
    var rows = stage.tasks.map(function (t) {
      var checked = !!roadmap[t.id];
      var mark = KIND_MARK[t.kind];
      /* 勾上了、问过、还没回答的那几条，重新渲染时要接着问。
         原来这行只在点击那一刻插一次 DOM，切走再回来就没了——
         用户再想记录也没有入口，只能先取消勾选再重新勾上。 */
      var ask = (checked && pendingAsks[t.id] && t.dims && t.dims.length)
        ? practiceAsk(t) : '';
      return '<li class="road-task' + (checked ? ' is-done' : '') +
        (mark ? ' road-task--' + mark.cls : '') +
        '" data-action="toggle-road" data-id="' + t.id + '">' +
        '<span class="road-task__box">' + (checked ? UI.icon('check') : '') + '</span>' +
        '<span class="road-task__body">' +
          /* 只给"有硬期限或错过补不回来"的那几项打标。
             全打标等于没打标，只标重点反而一眼看得出该先做哪些。 */
          /* 标题必须单独包一层。外面那些角标（「重点」「方向专项」）也是
             节点，勾选时要靠 textContent 把标题读出来去和看板做匹配——
             直接从 <strong> 整段读会把角标文字一起带上，变成
             "高数…拿到良好以上重点"，那永远匹配不上。 */
          '<strong><span class="road-task__title">' + UI.esc(t.title) + '</span>' +
            (mark ? '<span class="road-task__kind road-task__kind--' + mark.cls + '">' +
              mark.name + '</span>' : '') +
            (t.pri === 'high' ? '<span class="road-task__pri">重点</span>' : '') +
          '</strong>' +
          '<em>' + UI.esc(t.desc) + '</em>' +
          ask +
        '</span>' +
        /* 每条任务都挂一个「拆成待办」。
           这是两个页面之间唯一的通道——规划装目标，看板装行动，
           中间那一步（把目标拆成能动手的动作）必须由人来走。 */
        '<button class="road-task__split" data-action="split-task" data-id="' + t.id +
          '" title="拆成看板里的具体待办">' + UI.icon('plus') + '<span>拆成待办</span></button>' +
      '</li>';
    }).join('');

    return '<section class="stage" data-stage="' + stage.year + '">' +
      '<div class="stage__head">' +
        '<div class="stage__title">' +
          '<span class="stage__dot" style="background:' + stage.color + '"></span>' +
          '<h3>' + UI.esc(stage.year) + ' · ' + UI.esc(stage.theme) + '</h3>' +
        '</div>' +
        '<span class="stage__count" data-count="' + stage.year + '">' + pr.done + ' / ' + pr.total + '</span>' +
      '</div>' +
      '<p class="stage__goal">' + UI.esc(stage.goal) + '</p>' +
      UI.progress(pr.percent, stage.color)
        .replace('class="progress__bar"', 'class="progress__bar" data-bar="' + stage.year + '"') +
      '<ul class="road-tasks">' + rows + '</ul>' +
    '</section>';
  }

  /* 汇总某个路线的整体进度 */
  function roadmapTotals(stages, roadmap) {
    var total = 0, done = 0;
    stages.forEach(function (s) {
      s.tasks.forEach(function (t) { total++; if (roadmap[t.id]) done++; });
    });
    return { total: total, done: done, percent: total ? (done / total) * 100 : 0 };
  }

  /* 毕业去向选择器：三张可点的卡片 */
  function trackPicker(current) {
    return '<div class="panel track-picker">' +
      '<div class="panel__head">' +
        '<div><h3>你要走哪条路？</h3>' +
        '<p class="muted" style="margin-top:4px">' +
          (current.auto
            ? UI.esc(current.reason) + '。也可以手动改。'
            : '已手动选择，规划里的分岔任务会跟着变。') +
        '</p></div>' +
        (current.auto ? '' : '<button class="link-btn" data-action="set-track" data-v="">恢复自动</button>') +
      '</div>' +
      '<div class="track-grid">' +
        AICS.PLAN_TRACKS.map(function (t) {
          var on = current.key === t.key;
          return '<button class="track-card' + (on ? ' is-on' : '') +
            '" data-action="set-track" data-v="' + t.key + '">' +
            '<span class="track-card__icon">' + UI.icon(t.icon) + '</span>' +
            '<strong>' + UI.esc(t.name) + '</strong>' +
            '<em>' + UI.esc(t.desc) + '</em>' +
            (on ? '<span class="track-card__mark">' + UI.icon('check') + '</span>' : '') +
          '</button>';
        }).join('') +
      '</div>' +
      '<p class="track-note">' + UI.icon('info') +
        '<span>路线只影响大三暑假和大四的几项任务，前两年两条路一样。' +
        '它和目标方向是两回事，方向决定的是标了「方向专项」的那几条。</span></p>' +
    '</div>';
  }

  /* ---------- 时间轴视图 ----------
     列表视图回答"要做什么"，时间轴回答"还剩多少时间"。
     两个问题不一样，所以做成了两种看法而不是二选一。 */

  /* 每个学年的完成度，喂给 Charts.timeline */
  function timelineData(stages, roadmap) {
    return stages.map(function (s) {
      var pr = stageProgress(s, roadmap);
      return { year: s.year, color: s.color, done: pr.done, total: pr.total, percent: pr.percent };
    });
  }

  /* "你现在在这里"。整块是时间轴视图的重点——
     图只说明走到哪儿了，这句话说明还剩多少时间。 */
  function whereBlock(state, pos, now) {
    if (!pos) {
      return '<div class="banner banner--warn">' + UI.icon('alert') +
        '<div><strong>还没填年级，标不出你现在的位置</strong>' +
        '<span>时间轴得知道你在第几学年，才能算出离关键节点还有多久</span></div>' +
        '<button class="link-btn" data-action="show-onboarding">现在去填 ' + UI.icon('arrow-right') + '</button>' +
      '</div>';
    }

    /* 下一个还没到的节点 */
    var next = null;
    AICS.MILESTONES.forEach(function (ms) {
      if (!next && AICS.monthsUntil(ms.abs, pos) >= 0) next = ms;
    });

    var line = '按 9 月开学推算，你现在是 <strong>' + UI.esc(pos.label) + '</strong>';
    if (next) {
      var left = AICS.monthsUntil(next.abs, pos);
      line += '；距离「<strong>' + UI.esc(next.name) + '</strong>」还有 <strong>' +
        left + ' 个月</strong>（' + AICS.monthLabel(now, left) + '）';
    } else {
      line += '。四年里的几个关键节点都已经过去了';
    }

    /* 年级会过期。只在离填表超过一年时提一句——
       填了半年就提醒属于唠叨，提醒多了用户就再也不看了。 */
    var stale = '';
    var filled = state.profile.onboardedAt ? new Date(state.profile.onboardedAt) : null;
    if (filled && !isNaN(filled.getTime())) {
      var months = (now.getFullYear() - filled.getFullYear()) * 12 +
                   (now.getMonth() - filled.getMonth());
      if (months >= 12) {
        stale = '<p class="where__stale">你填年级是 ' + months + ' 个月前的事了。' +
          '如果已经升了一级，记得改一下，否则这里的位置和倒计时都会偏。</p>';
      }
    }

    return '<div class="where">' +
      '<div class="where__head">' + UI.icon('target') + '<strong>你现在在这里</strong></div>' +
      '<p>' + line + '</p>' +
      stale +
      '<button class="link-btn" data-action="open-settings">年级填错了？改一下 ' +
        UI.icon('arrow-right') + '</button>' +
    '</div>';
  }

  /* 关键节点的倒计时清单。轴上只画小三角不写字，
     名字和倒计时都放这儿——DOM 里能换行，读屏也能念出来。 */
  function milestoneList(pos, now) {
    if (!pos) return '';
    var rows = AICS.MILESTONES.map(function (ms) {
      var left = AICS.monthsUntil(ms.abs, pos);
      var when;
      if (left < 0) when = '已经过去 ' + (-left) + ' 个月';
      else if (left === 0) when = '就是现在';
      else when = '还有 ' + left + ' 个月 · ' + AICS.monthLabel(now, left);

      return '<li class="ms' + (left < 0 ? ' is-past' : '') + '">' +
        '<div class="ms__head">' +
          '<strong>' + UI.esc(ms.name) + '</strong>' +
          '<span>' + UI.esc(when) + '</span>' +
        '</div>' +
        '<p>' + UI.esc(ms.hint) + '</p>' +
      '</li>';
    }).join('');

    return '<div class="milestones">' +
      '<h4>接下来要面对的节点</h4>' +
      '<ul class="ms-list">' + rows + '</ul>' +
    '</div>';
  }

  function timelineView(stages, roadmap, state) {
    var pos = AICS.termPosition(state.profile.year);
    var now = new Date();

    return '<div class="panel roadmap-timeline">' +
      '<div class="panel__head">' +
        '<div><h3>四年时间轴</h3>' +
        '<p class="muted">每个色带是一个学年，水位就是这一阶段做完的比例</p></div>' +
      '</div>' +
      /* canvas 的尺寸交给 CSS，mount 时才画——render 阶段元素还没进文档，
         拿不到宽度 */
      '<canvas id="road-timeline" class="timeline-canvas"></canvas>' +
      whereBlock(state, pos, now) +
      milestoneList(pos, now) +
    '</div>';
  }

  /* 说明卡：这份规划是照什么生成的。
     不写的话，用户看到多出来几条任务只会以为是系统随手加的，
     看不出它们跟自己的目标方向、能力短板有什么关系——
     那这两层个性化就白做了。 */
  function planNote(ctx, stages) {
    var n = { dir: 0, gap: 0 };
    stages.forEach(function (s) {
      s.tasks.forEach(function (t) {
        if (n[t.kind] !== undefined) n[t.kind]++;
      });
    });
    var total = n.dir + n.gap;

    /* 一项个性化任务都没有：不存在"没什么可说"的情况，
       这时候该做的是告诉他怎么才能有。

       两种情况要分开说，给的入口也不一样：
         · 还没做测评   → 先去测评
         · 做了但没缺口 → 再说一次"去做测评"就是错的，他刚做完；
                          该引导的是去设一个目标方向 */
    if (!total) {
      var why = ctx.ready
        ? '按你的测评结果，暂时没有明显要补的短板。定一个目标方向，这里会多出那个方向要做的事。'
        : '现在这份规划，哪个 AI 专业的学生看的都是它。做完测评会补上你缺的那几项；' +
          '定了目标方向，还会多出那个方向要做的事。';

      return '<div class="panel plan-note">' +
        '<div class="plan-note__head">' + UI.icon('target') +
          '<strong>这份规划还能更贴你一些</strong></div>' +
        '<p>' + UI.esc(why) + '</p>' +
        '<div class="plan-note__foot">' +
          (ctx.ready
            ? '<button class="link-btn" data-action="go-match">去定目标方向 ' + UI.icon('arrow-right') + '</button>'
            : '<button class="link-btn" data-action="go-assess">去做测评 ' + UI.icon('arrow-right') + '</button>' +
              '<button class="link-btn" data-action="go-match">去定目标方向 ' + UI.icon('arrow-right') + '</button>') +
        '</div>' +
      '</div>';
    }

    var parts = [];
    if (n.dir) parts.push('方向专项 ' + n.dir + ' 项');
    if (n.gap) parts.push('补齐短板 ' + n.gap + ' 项');

    return '<div class="panel plan-note">' +
      '<div class="plan-note__head">' + UI.icon('target') +
        '<strong>这份规划是怎么生成的</strong></div>' +
      '<p>' + UI.esc(ctx.source) + '。带标签的 ' + total + ' 项（' + parts.join(' · ') +
        '）是给你加的，其余哪个学生看都一样。</p>' +
      '<div class="plan-note__foot">' +
        '<button class="link-btn" data-action="go-match">' +
          (ctx.target ? '换个目标方向' : '去定目标方向') + ' ' + UI.icon('arrow-right') + '</button>' +
        '<span class="plan-note__tip">换了方向，专项任务会跟着换，已经打过的勾会保留</span>' +
      '</div>' +
    '</div>';
  }

  AICS.Views.roadmap = {
    /* 数据被整体换掉（导入备份 / 清空）时由 app.js 调用 */
    resetState: function () { pendingAsks = {}; },

    title: '四年规划',
    desc: '大一到大四该做什么，一项项落实',

    render: function () {
      var state = AICS.Store.get();
      var roadmap = state.roadmap || {};
      var track = AICS.resolveTrack(state);
      var ctx = AICS.planContext(state);
      var stages = AICS.planFor(state);
      var t = roadmapTotals(stages, roadmap);

      var head = UI.pageHeader('四年行动路线',
        '把大目标拆成每年能做的事，做完就打勾',
        /* 这里原来有个「未完成任务导入看板」的主按钮。
           v2 第二轮去掉了——它一键把 26 项原样复制进看板，
           结果看板变成了规划页的副本。改成每条任务自己带「拆成待办」。 */
        '<div class="view-switch">' +
          '<button class="chip' + (roadView === 'list' ? ' is-on' : '') +
            '" data-action="road-view" data-v="list">列表</button>' +
          '<button class="chip' + (roadView === 'timeline' ? ' is-on' : '') +
            '" data-action="road-view" data-v="timeline">时间轴</button>' +
        '</div>');

      var summary = '<div class="banner">' +
        '<div class="ring-wrap"><canvas id="road-donut" style="width:76px;height:76px"></canvas></div>' +
        '<div><strong>四年规划完成度 ' + Math.round(t.percent) + '%</strong>' +
        '<span>' + UI.esc(track.name) + '路线 · 已完成 ' + t.done + ' 项，还剩 ' + (t.total - t.done) + ' 项</span></div>' +
        '<button class="link-btn" data-action="go-kanban">去任务看板 ' + UI.icon('arrow-right') + '</button>' +
      '</div>';

      var body = roadView === 'timeline'
        ? timelineView(stages, roadmap, state)
        : '<div class="stages">' +
            stages.map(function (s) { return stageCard(s, roadmap); }).join('') +
          '</div>';

      return head + trackPicker(track) + planNote(ctx, stages) + summary + body;
    },

    mount: function (root) {
      var state = AICS.Store.get();
      var roadmap = state.roadmap || {};
      var track = AICS.resolveTrack(state);
      var stages = AICS.planFor(state);

      var t0 = roadmapTotals(stages, roadmap);
      var donut = root.querySelector('#road-donut');
      if (donut) AICS.Charts.donut(donut, t0.percent, { size: 8, color: UI.tone('accent2') });

      /* 时间轴视图：在这里画图。放到 mount 而不是 render，
         是因为 render 阶段 canvas 还没进文档，量不到宽度。 */
      var tl = root.querySelector('#road-timeline');
      if (tl) {
        var pos = AICS.termPosition(state.profile.year);
        AICS.Charts.timeline(tl, {
          stages: timelineData(stages, roadmap),
          position: pos ? pos.progress : null,
          milestones: AICS.MILESTONES
        });
      }

      root.addEventListener('click', function (e) {
        /* 列表 / 时间轴切换 */
        var sw = e.target.closest('[data-action="road-view"]');
        if (sw) {
          roadView = sw.getAttribute('data-v');
          AICS.App.refresh();
          return;
        }

        /* "这项做到什么程度了"的回答。
           必须放在 toggle-road 之前——这些按钮就在 .road-task 里面，
           不拦住的话点一下会同时触发整行的勾选/取消，
           结果是"记了一条记录，同时把任务取消了"。 */
        var pv = e.target.closest('[data-action="practice"]');
        if (pv) {
          var pvId = pv.getAttribute('data-id');
          recordPractice(pv.getAttribute('data-dim'), pv.getAttribute('data-level'));
          delete pendingAsks[pvId];
          var ask = pv.closest('.practice-ask');
          if (ask) ask.outerHTML = practiceDoneHtml(pv.getAttribute('data-level'));
          UI.toast('已记下', 'success');
          return;
        }
        var ps = e.target.closest('[data-action="practice-skip"]');
        if (ps) {
          delete pendingAsks[ps.getAttribute('data-id')];
          var ask2 = ps.closest('.practice-ask');
          if (ask2) ask2.parentNode.removeChild(ask2);
          return;
        }

        /* 「拆成待办」。同样得放在 toggle 之前——按钮在 .road-task 里面，
           不拦住的话点一下会连带把这条规划任务勾上 */
        var sp = e.target.closest('[data-action="split-task"]');
        if (sp) {
          var hit = findPlanTask(stages, sp.getAttribute('data-id'));
          if (hit) openSplit(sp.closest('.road-task'), hit.task);
          return;
        }

        /* 拆解表单里的两个按钮，同理要拦在 toggle 前面 */
        if (e.target.closest('[data-action="split-ok"]')) {
          var okRow = e.target.closest('.road-task');
          var okHit = findPlanTask(stages, okRow.getAttribute('data-id'));
          commitSplit(okRow, okHit ? okHit.year : '', okHit ? okHit.task.pri : 'mid');
          return;
        }
        if (e.target.closest('[data-action="split-cancel"]')) {
          closeSplit(e.target.closest('.road-task'));
          return;
        }

        var row = e.target.closest('[data-action="toggle-road"]');
        if (!row) return;

        /* 「做到什么程度了」和「拆成待办」这两块整个嵌在可勾选的行里，
           凡是落在它们里面的点击都不该被当成勾选。
           上面几个分支只认按钮本身，而它们之后会变成一句回执（按钮没了），
           没有这道兜底，双击的第二次就会把任务取消掉。 */
        if (e.target.closest('.practice-ask') ||
            e.target.closest('.split-form') ||
            e.target.closest('.split-done')) return;

        var id = row.getAttribute('data-id');
        var map = Object.assign({}, AICS.Store.get().roadmap);
        var nowDone;
        if (map[id]) { delete map[id]; nowDone = false; }
        else { map[id] = true; nowDone = true; }
        /* 用 replaceKey 而不是 set：取消最后一项时 map 会是空对象，
           而 set 是合并语义，空对象等于什么都没改 */
        AICS.Store.replaceKey('roadmap', map);

        /* 局部更新这一行 */
        row.classList.toggle('is-done', nowDone);
        row.querySelector('.road-task__box').innerHTML = nowDone ? UI.icon('check') : '';

        /* 勾上之后，如果这项关联了能力维度，就地补一行"做到什么程度了"。
           不整页重绘——用户刚点的那一行会跳到视野外，体验很差。
           取消勾选时把这一行撤掉，免得同一项挂着两个提问。 */
        var body = row.querySelector('.road-task__body');
        if (body) {
          var oldAsk = body.querySelector('.practice-ask');
          if (oldAsk) oldAsk.parentNode.removeChild(oldAsk);
          delete pendingAsks[id];

          if (nowDone) {
            var taskObj = null;
            stages.forEach(function (s) {
              s.tasks.forEach(function (x) { if (x.id === id) taskObj = x; });
            });
            if (taskObj && taskObj.dims && taskObj.dims.length) {
              pendingAsks[id] = true;
              body.insertAdjacentHTML('beforeend', practiceAsk(taskObj));
            }
          }
        }

        /* 更新所属阶段的计数和进度条 */
        var stageEl = row.closest('.stage');
        if (stageEl) {
          var year = stageEl.getAttribute('data-stage');
          var stage = stages.filter(function (s) { return s.year === year; })[0];
          if (stage) {
            var pr = stageProgress(stage, map);
            var countEl = stageEl.querySelector('[data-count]');
            var barEl = stageEl.querySelector('[data-bar]');
            if (countEl) countEl.textContent = pr.done + ' / ' + pr.total;
            if (barEl) barEl.style.width = pr.percent + '%';
          }
        }

        /* 更新页头总进度 */
        var t = roadmapTotals(stages, map);
        var bannerStrong = root.querySelector('.banner strong');
        if (bannerStrong) bannerStrong.textContent = '四年规划完成度 ' + Math.round(t.percent) + '%';
        var bannerSpan = root.querySelector('.banner span');
        if (bannerSpan) {
          bannerSpan.textContent = track.name + '路线 · 已完成 ' + t.done + ' 项，还剩 ' + (t.total - t.done) + ' 项';
        }
        var donut2 = root.querySelector('#road-donut');
        if (donut2) AICS.Charts.donut(donut2, t.percent, { size: 8, color: UI.tone('accent2') });

        /* 联动：把看板里同名任务的状态也改掉。
           取的是 .road-task__title，不是整个 <strong>——后者还包着
           「重点」「方向专项」这些角标，连起来读会多出几个字，
           和看板里的标题对不上，联动会静默失效（实测过）。 */
        var titleEl = row.querySelector('.road-task__title');
        var title = titleEl ? titleEl.textContent : '';
        var synced = AICS.syncTaskFromRoadmap(title, nowDone);
        if (synced) UI.toast(nowDone ? '已完成，看板里的同名任务同步更新了' : '已取消，看板里的同名任务同步更新了');
      });

      /* 拆解表单里的键盘操作。回车直接加入是这套交互快起来的关键——
         连着拆七八条的时候，手不用在键盘和鼠标之间来回换。 */
      root.addEventListener('keydown', function (e) {
        var inp = e.target.closest && e.target.closest('.split-form__title');
        if (!inp) return;
        var row = inp.closest('.road-task');
        if (!row) return;

        if (e.key === 'Enter') {
          e.preventDefault();
          var hit = findPlanTask(stages, row.getAttribute('data-id'));
          commitSplit(row, hit ? hit.year : '', hit ? hit.task.pri : 'mid');
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeSplit(row);
        }
      });
    }
  };

  /* ---------- 任务看板 ---------- */

  /* 看板上这几个按钮一按就重排整块列表：删掉一条，下面的卡片整体上移，
     鼠标没动就落在了下一张卡片的同一个按钮上。双击等于删两条，
     而第二下用户根本没看清删的是谁——撤销也只放回最后删的那一条。
     列内排序和列间移动同理（双击连移两格）。
     重排之后这一小段时间里不响应同类操作。 */
  var boardLockUntil = 0;

  /* 按筛选条件挑出要显示的任务 */
  function visibleTasks(tasks) {
    return tasks.filter(function (t) {
      if (filter.term !== 'all' && t.term !== filter.term) return false;
      if (filter.pri !== 'all' && t.priority !== filter.pri) return false;
      return true;
    });
  }

  /* 单张任务卡片 */
  function taskCard(task, pos, total) {
    var p = priorityOf(task.priority);
    var idx = colIndex(task.status);
    var overdue = task.due && task.due < today() && task.status !== 'done';

    var dueHtml = task.due
      ? '<p class="task__due' + (overdue ? ' is-overdue' : '') + '">' +
          UI.icon('calendar') + UI.esc(task.due) + (overdue ? ' · 已过期' : '') + '</p>'
      : '';

    return '<div class="task" draggable="true" data-id="' + task.id + '">' +
      '<div class="task__top">' +
        '<span class="task__pri" style="background:' + UI.tone(p.tone) + '">' + p.name + '</span>' +
        (task.term ? UI.tag(task.term, 'ghost') : '') +
        /* 加上文字。原来只有图标，15px 的大小加 1px 线宽，
           用户认不出那是"编辑"——尤其图标还被裁掉一截的时候。 */
        '<button class="icon-btn icon-btn--sm icon-btn--label" data-action="task-edit" data-id="' +
          task.id + '" title="编辑任务" aria-label="编辑任务">' +
          UI.icon('edit') + '<span>编辑</span></button>' +
        '<button class="icon-btn icon-btn--sm icon-btn--label icon-btn--danger" data-action="task-del" data-id="' +
          task.id + '" title="删除任务" aria-label="删除任务">' +
          UI.icon('trash') + '<span>删除</span></button>' +
      '</div>' +
      '<p class="task__title">' + UI.esc(task.title) + '</p>' +
      dueHtml +
      /* 图标按钮只有图形没有文字，title 既是悬停提示也是无障碍名称，
         aria-label 再补一道——手机上根本没有悬停，读屏软件也主要读后者 */
      '<div class="task__move">' +
        '<button class="icon-btn icon-btn--sm" data-action="task-order" data-id="' + task.id +
          '" data-dir="-1" ' + (pos <= 0 ? 'disabled' : '') +
          ' title="在本列内上移" aria-label="在本列内上移">' + UI.icon('chevron-up') + '</button>' +
        '<button class="icon-btn icon-btn--sm" data-action="task-order" data-id="' + task.id +
          '" data-dir="1" ' + (pos >= total - 1 ? 'disabled' : '') +
          ' title="在本列内下移" aria-label="在本列内下移">' + UI.icon('chevron-down') + '</button>' +
        '<span class="task__move-gap"></span>' +
        '<button class="icon-btn icon-btn--sm" data-action="task-move" data-id="' + task.id +
          '" data-dir="-1" ' + (idx <= 0 ? 'disabled' : '') +
          ' title="移到左边一列" aria-label="移到左边一列">' + UI.icon('arrow-left') + '</button>' +
        '<button class="icon-btn icon-btn--sm" data-action="task-move" data-id="' + task.id +
          '" data-dir="1" ' + (idx >= COLUMNS.length - 1 ? 'disabled' : '') +
          ' title="移到右边一列" aria-label="移到右边一列">' + UI.icon('arrow-right') + '</button>' +
      '</div>' +
    '</div>';
  }

  /* 三列看板 */
  function boardHtml(tasks) {
    var shown = visibleTasks(tasks);
    return '<div class="board">' + COLUMNS.map(function (col) {
      var list = shown.filter(function (t) { return t.status === col.key; });
      return '<div class="board__col" data-col="' + col.key + '">' +
        '<div class="board__head">' +
          '<span class="board__dot" style="background:' + UI.tone(col.tone) + '"></span>' +
          '<h3>' + col.name + '</h3>' +
          '<span class="board__count">' + list.length + '</span>' +
        '</div>' +
        '<div class="board__list" data-drop="' + col.key + '">' +
          (list.length
            ? list.map(function (t, i) { return taskCard(t, i, list.length); }).join('')
            : '<div class="board__empty">' + (tasks.length ? '没有符合筛选条件的任务' : '拖动任务到这里') + '</div>') +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  /* 筛选条 */
  function filterBar(tasks) {
    var termChips = ['all'].concat(TERMS).map(function (t) {
      var name = t === 'all' ? '全部阶段' : t;
      var count = t === 'all' ? tasks.length
        : tasks.filter(function (x) { return x.term === t; }).length;
      return '<button class="chip' + (filter.term === t ? ' is-on' : '') +
        '" data-action="filter-term" data-v="' + t + '">' + name +
        '<i>' + count + '</i></button>';
    }).join('');

    /* 优先级这一行也要显示条数。原来只有阶段那行有数字，
       两行并排放在一起，一个有一个没有，看着像优先级这行坏了；
       而且用户想按优先级筛的时候，正需要先知道每档分别有多少。 */
    var priChips = ['all'].concat(PRIORITIES.map(function (p) { return p.key; })).map(function (k) {
      var name = k === 'all' ? '全部优先级' : (priorityOf(k).name + '优先级');
      var count = k === 'all' ? tasks.length
        : tasks.filter(function (x) { return x.priority === k; }).length;
      return '<button class="chip' + (filter.pri === k ? ' is-on' : '') +
        '" data-action="filter-pri" data-v="' + k + '">' + name +
        '<i>' + count + '</i></button>';
    }).join('');

    return '<div class="filter-bar">' +
      '<div class="filter-row">' + termChips + '</div>' +
      '<div class="filter-row">' + priChips + '</div>' +
    '</div>';
  }

  AICS.Views.kanban = {
    /* 筛选条件不写进存档，所以导入备份 / 清空数据时不会跟着变。
       重置之后才看得到刚进来的那批任务。 */
    resetState: function () { filter = { term: 'all', pri: 'all' }; },

    title: '任务看板',
    desc: '把规划拆成今天就能动手的小任务',

    render: function () {
      var tasks = AICS.Store.get().tasks || [];

      var head = UI.pageHeader('学习任务看板',
        /* 副标题点明它和四年规划的关系。原来写的是"可以拖动卡片换列"——
           那句话在讲操作方式，没回答"我为什么要用这一页"。 */
        '最近真要动手的事，比四年规划细一层',
        '<button class="btn" data-action="go-roadmap">' + UI.icon('calendar') + ' 从四年规划拆任务</button>');

      /* 新增任务表单 */
      var form = '<div class="panel add-task">' +
        '<div class="add-task__row">' +
          '<input type="text" id="task-title" class="input" placeholder="要做什么？例如：看完吴恩达第三周并做完作业" maxlength="60">' +
          /* 默认选用户自己的年级。TERMS[0] 是「大一」，
             不加 selected 的话浏览器会默认选它——大三学生加"投暑期实习"
             会被挂上"大一"标签，之后按大三筛选时这条任务直接消失。 */
          '<select id="task-term" class="input input--sm">' +
            TERMS.map(function (t) {
              var sel = (AICS.Store.get().profile.year === t) ? ' selected' : '';
              return '<option value="' + t + '"' + sel + '>' + t + '</option>';
            }).join('') +
          '</select>' +
          '<select id="task-pri" class="input input--sm">' +
            PRIORITIES.map(function (p) {
              return '<option value="' + p.key + '"' + (p.key === 'mid' ? ' selected' : '') + '>' + p.name + '优先级</option>';
            }).join('') +
          '</select>' +
          UI.dateField('task-due', 'input input--sm', '', '截止日期', '可直接输入') +
          '<button class="btn btn--primary" data-action="task-add">' + UI.icon('plus') + ' 添加</button>' +
        '</div>' +
        '<p class="muted">任务写得越具体越容易开始。「学机器学习」不如「看完吴恩达第 3 周视频」。</p>' +
      '</div>';

      var empty = !tasks.length
        ? UI.empty({
            icon: 'kanban',
            title: '看板还是空的',
            desc: '这里装的是最近真要动手的事。规划里写「系统学完机器学习经典算法」，' +
              '放到这儿应该是「看完吴恩达第 3 周视频」。可以在上面直接加，' +
              '也可以去四年规划把某条拆过来。',
            action: 'go-roadmap',
            actionText: '去四年规划拆任务'
          })
        : '';

      return head + form +
        (tasks.length ? filterBar(tasks) : '') +
        '<div id="board-wrap">' + (tasks.length ? boardHtml(tasks) : empty) + '</div>';
    },

    mount: function (root) {
      UI.syncDateFields(root);

      var titleInput = root.querySelector('#task-title');
      if (titleInput) {
        titleInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') addTask(root);
        });
      }

      root.addEventListener('click', function (e) {
        /* 添加 */
        if (e.target.closest('[data-action="task-add"]')) { addTask(root); return; }

        /* 筛选 */
        var ft = e.target.closest('[data-action="filter-term"]');
        if (ft) {
          filter.term = ft.getAttribute('data-v');
          AICS.App.refresh();
          return;
        }
        var fp = e.target.closest('[data-action="filter-pri"]');
        if (fp) {
          filter.pri = fp.getAttribute('data-v');
          AICS.App.refresh();
          return;
        }

        /* 下面这几个动作都会立刻重排列表，重排后短暂不响应，
           免得双击的第二下打到另一张卡片上。判断放在最前面，
           一个入口挡住三个动作。 */
        var reordering = e.target.closest('[data-action="task-move"], [data-action="task-order"], [data-action="task-del"]');
        if (reordering) {
          if (Date.now() < boardLockUntil) return;
        }

        /* 列间移动 */
        var moveBtn = e.target.closest('[data-action="task-move"]');
        if (moveBtn) {
          boardLockUntil = Date.now() + 400;
          var mid = moveBtn.getAttribute('data-id');
          var mdir = Number(moveBtn.getAttribute('data-dir'));
          updateTask(mid, function (t) {
            var next = Math.max(0, Math.min(COLUMNS.length - 1, colIndex(t.status) + mdir));
            return { status: COLUMNS[next].key };
          });
          redrawBoard(root);
          return;
        }

        /* 列内排序 */
        var orderBtn = e.target.closest('[data-action="task-order"]');
        if (orderBtn) {
          boardLockUntil = Date.now() + 400;
          swapOrder(orderBtn.getAttribute('data-id'), Number(orderBtn.getAttribute('data-dir')));
          redrawBoard(root);
          return;
        }

        /* 编辑 */
        var editBtn = e.target.closest('[data-action="task-edit"]');
        if (editBtn) {
          editTask(editBtn.getAttribute('data-id'), root);
          return;
        }

        /* 删除（带撤销） */
        var delBtn = e.target.closest('[data-action="task-del"]');
        if (delBtn) {
          boardLockUntil = Date.now() + 600;   // 删除给的余量长一点
          var did = delBtn.getAttribute('data-id');
          var all = AICS.Store.get().tasks || [];
          var removed = all.filter(function (t) { return t.id === did; })[0];
          var index = all.map(function (t) { return t.id; }).indexOf(did);
          if (!removed) return;

          AICS.Store.set('tasks', all.filter(function (t) { return t.id !== did; }));
          redrawBoard(root);
          UI.toast('已删除「' + removed.title + '」', 'info', {
            text: '撤销',
            onClick: function () {
              var list = (AICS.Store.get().tasks || []).slice();
              list.splice(index, 0, removed);      // 放回原来的位置
              AICS.Store.set('tasks', list);
              AICS.App.refresh();
              UI.toast('已恢复', 'success');
            }
          });
        }
      });

      /* 拖拽换列 */
      var draggingId = '';
      root.addEventListener('dragstart', function (e) {
        var card = e.target.closest('.task');
        if (!card) return;
        draggingId = card.getAttribute('data-id');
        card.classList.add('is-dragging');
        try { e.dataTransfer.setData('text/plain', draggingId); } catch (err) { /* 忽略 */ }
        e.dataTransfer.effectAllowed = 'move';
      });
      root.addEventListener('dragend', function (e) {
        var card = e.target.closest('.task');
        if (card) card.classList.remove('is-dragging');
        draggingId = '';
      });
      root.addEventListener('dragover', function (e) {
        var zone = e.target.closest('[data-drop]');
        if (!zone || !draggingId) return;
        e.preventDefault();          // 不阻止默认行为的话 drop 不会触发
        zone.classList.add('is-over');
      });
      root.addEventListener('dragleave', function (e) {
        var zone = e.target.closest('[data-drop]');
        if (zone) zone.classList.remove('is-over');
      });
      root.addEventListener('drop', function (e) {
        var zone = e.target.closest('[data-drop]');
        if (!zone || !draggingId) return;
        e.preventDefault();
        zone.classList.remove('is-over');

        boardLockUntil = Date.now() + 400;   // 落下来之后卡片也换了位置
        var target = zone.getAttribute('data-drop');
        updateTask(draggingId, function () { return { status: target }; });
        redrawBoard(root);
        UI.toast('已移动到「' + COLUMNS.filter(function (c) { return c.key === target; })[0].name + '」');
      });
    }
  };

  /* ---------- 把规划任务拆成看板待办 ----------

     这里原来是「未完成任务导入看板」——一键把 26 项原样复制进看板。
     结果是两个页面上是同一批标题、同样的数量，用户直接问
     "这两个功能是不是重复了"。

     问题出在颗粒度：规划装的是**目标**（一学期一条），看板装的是
     **行动**（一周几条）。原样复制等于把目标当成了行动。

     改成逐条拆解，中间那一步不省——「系统学完机器学习经典算法」
     和「看完吴恩达第 3 周视频」之间差的就是人的判断，
     而这个判断只有用户自己能做。 */

  /* 拆解表单做成"就在这一行里展开"，不是弹窗。

     原来用的是弹窗，实测太慢：一个大一栏有 9 条，每拆一条就弹一次，
     整个列表被盖住一次，关掉之后还得重新找回刚才看到哪了。
     慢的不是打字，是每一条都要开一次弹窗、视线被弹走一次。

     原地展开之后：不遮挡，剩下几条一直在眼前；标题框里按回车直接加入，
     手不用离开键盘；加完那行就地变成一句回执。

     预填原话是因为多半要在它基础上改，进去就全选，
     敲第一个字即是替换，不用先手动删一遍。 */
  function splitForm(task) {
    return '<div class="split-form">' +
      '<input type="text" class="input split-form__title" maxlength="60" value="' +
        UI.esc(task.title) + '" placeholder="改成能直接动手的一件事">' +
      UI.dateField('split-due-' + task.id, 'input split-form__due', '', '截止日期（可以先不填）', '可直接输入') +
      '<button class="btn btn--primary btn--sm" data-action="split-ok">加入看板</button>' +
      '<button class="link-btn" data-action="split-cancel">取消</button>' +
    '</div>';
  }

  function openSplit(row, task) {
    var body = row.querySelector('.road-task__body');
    /* 判断"已经开着"只能认 .split-form 本身。回执用的是另一个类名——
       共用一个类名的话，加完第一条之后这条任务就再也打不开表单了
       （被当成"已经开着"直接 return），而它明明还能接着拆第二件。 */
    if (!body || body.querySelector('.split-form')) return;
    body.insertAdjacentHTML('beforeend', splitForm(task));
    /* 表单开着的时候把外面那个按钮收起来，免得同一行出现两个入口 */
    var btn = row.querySelector('.road-task__split');
    if (btn) btn.classList.add('is-hidden');
    UI.syncDateFields(body);
    var inp = body.querySelector('.split-form__title');
    if (inp) { inp.focus(); inp.select(); }
  }

  function closeSplit(row) {
    var form = row.querySelector('.split-form');
    if (form && form.parentNode) form.parentNode.removeChild(form);
    var btn = row.querySelector('.road-task__split');
    if (btn) btn.classList.remove('is-hidden');
  }

  /* 提交。标题空着或者和看板里重名，都不关表单——
     让用户就地改一下再提交，比关掉重来省一步。 */
  function commitSplit(row, stageYear, priority) {
    var form = row && row.querySelector('.split-form');
    if (!form) return;
    var inp = form.querySelector('.split-form__title');
    var title = (inp.value || '').trim();
    if (!title) {
      UI.toast('写点内容再加', 'error');
      inp.focus();
      return;
    }
    if (boardHas(title)) {
      UI.toast('看板里已经有「' + title + '」了，改一下再加', 'error');
      inp.focus(); inp.select();
      return;
    }
    var due = form.querySelector('input[type="date"]').value || '';
    addToBoard(title, stageYear, priority, due);

    /* 上一次的回执先撤掉，免得同一条任务下面积好几行 */
    var oldDone = row.querySelector('.split-done');
    if (oldDone && oldDone.parentNode) oldDone.parentNode.removeChild(oldDone);

    form.outerHTML = '<div class="split-done">' + UI.icon('check') +
      '<span>已加入看板：「' + UI.esc(title) + '」</span></div>';
    /* 按钮要放出来：一条学期级的目标通常要拆成两三件，
       拆完一件还得能接着拆下一件 */
    var btn = row.querySelector('.road-task__split');
    if (btn) btn.classList.remove('is-hidden');
    UI.toast('已加入看板', 'success', {
      text: '去看板',
      onClick: function () { AICS.App.navigate('kanban'); }
    });
  }

  /* 按 id 找出这条规划任务，以及它属于哪个学年 */
  function findPlanTask(stages, id) {
    var hit = null;
    stages.forEach(function (s) {
      s.tasks.forEach(function (t) { if (t.id === id) hit = { task: t, year: s.year }; });
    });
    return hit;
  }

  /* 看板里有没有同名的未完成任务。

     加这条检查是因为实测踩到过：同一条规划任务点两次「拆成待办」、
     标题都没改，看板上就出现两张一模一样的卡片——看着像坏了。
     "点快了"和"忘了自己加过"都会造成这个结果。

     **已完成**的同名任务不算重复：那可能是"这件事又要做一遍"，是合理的。 */
  function boardHas(title) {
    return (AICS.Store.get().tasks || []).some(function (t) {
      return t.title === title && t.status !== 'done';
    });
  }

  /* 往看板里加一条任务。字段和看板自己的「添加」保持一致，
     阶段和优先级从规划任务继承过来。重复的话返回 false，由调用方提示。 */
  function addToBoard(title, term, priority, due) {
    if (boardHas(title)) return false;
    var tasks = (AICS.Store.get().tasks || []).slice();
    tasks.push({
      id: AICS.Store.uid('task'),
      title: title,
      status: 'todo',
      term: term,
      priority: priority || 'mid',
      due: due || ''
    });
    AICS.Store.set('tasks', tasks);
    return true;
  }

  /* ---------- 任务操作 ---------- */

  /* 改一个任务的字段。如果状态变了，回头同步四年规划里的勾选 */
  function updateTask(id, patchFn) {
    var all = AICS.Store.get().tasks || [];
    var before = all.filter(function (t) { return t.id === id; })[0];
    var tasks = all.map(function (t) {
      return t.id === id ? Object.assign({}, t, patchFn(t)) : t;
    });
    AICS.Store.set('tasks', tasks);

    var after = tasks.filter(function (t) { return t.id === id; })[0];
    if (before && after && before.status !== after.status) {
      AICS.syncRoadmapFromTask(after.title, after.status);
    }
  }

  /* 在同一列内和相邻位置的任务交换顺序。
     邻居必须按"筛选后看得见的那几个"来算，不能按全量任务算——
     卡片上的 ▲/▼ 是不是禁用，用的是可见列表里的位置（见 taskCard 的 pos/total），
     而这里原来拿全量任务找邻居。筛选一开就错位：界面上三个可见任务
     A、H、C（H 被筛掉），C 的 ▲ 是可点的，点下去却去和隐藏的 H 交换，
     画面纹丝不动——用户只会觉得这个按钮坏了。
     可见顺序就是全局数组顺序的子序列，所以交换两者在全局数组里的下标
     一定能换来可见顺序的改变。 */
  function swapOrder(id, dir) {
    var tasks = (AICS.Store.get().tasks || []).slice();
    var me = tasks.filter(function (t) { return t.id === id; })[0];
    if (!me) return;

    /* 只在同一列内、且当前筛选下可见的任务里找相邻的那一个 */
    var sameCol = visibleTasks(tasks).filter(function (t) { return t.status === me.status; });
    var pos = sameCol.map(function (t) { return t.id; }).indexOf(id);
    var other = sameCol[pos + dir];
    if (!other) return;

    var a = tasks.map(function (t) { return t.id; }).indexOf(id);
    var b = tasks.map(function (t) { return t.id; }).indexOf(other.id);
    var tmp = tasks[a];
    tasks[a] = tasks[b];
    tasks[b] = tmp;
    AICS.Store.set('tasks', tasks);
  }

  function addTask(root) {
    var input = root.querySelector('#task-title');
    if (!input) return;
    var title = (input.value || '').trim();
    if (!title) { UI.toast('先写点内容再添加', 'error'); input.focus(); return; }
    /* 和「拆成待办」用同一条规则，免得两处行为不一致 */
    if (boardHas(title)) { UI.toast('看板里已经有「' + title + '」了', 'error'); input.focus(); return; }

    var tasks = (AICS.Store.get().tasks || []).slice();
    tasks.push({
      id: AICS.Store.uid('task'),
      title: title,
      status: 'todo',
      term: root.querySelector('#task-term').value,
      priority: root.querySelector('#task-pri').value,
      due: root.querySelector('#task-due').value || ''
    });
    AICS.Store.set('tasks', tasks);

    input.value = '';
    root.querySelector('#task-due').value = '';
    UI.syncDateFields(root);   // 清空之后要把提示字放回来
    input.focus();
    redrawBoard(root);
    UI.toast('任务已添加', 'success');
  }

  /* 编辑任务：弹一个表单 */
  function editTask(id, root) {
    var task = (AICS.Store.get().tasks || []).filter(function (t) { return t.id === id; })[0];
    if (!task) return;

    var html = '<div class="form-grid">' +
      '<label class="form-grid__full">任务内容' +
        '<input type="text" id="e-title" class="input" maxlength="60" value="' + UI.esc(task.title) + '">' +
      '</label>' +
      '<label>所属阶段<select id="e-term" class="input">' +
        TERMS.map(function (t) {
          return '<option value="' + t + '"' + (task.term === t ? ' selected' : '') + '>' + t + '</option>';
        }).join('') +
      '</select></label>' +
      '<label>优先级<select id="e-pri" class="input">' +
        PRIORITIES.map(function (p) {
          return '<option value="' + p.key + '"' + (task.priority === p.key ? ' selected' : '') + '>' + p.name + '</option>';
        }).join('') +
      '</select></label>' +
      '<label>截止日期' + UI.dateField('e-due', 'input', task.due || '', '不设置就留空', '可直接输入') + '</label>' +
      '<label>状态<select id="e-status" class="input">' +
        COLUMNS.map(function (c) {
          return '<option value="' + c.key + '"' + (task.status === c.key ? ' selected' : '') + '>' + c.name + '</option>';
        }).join('') +
      '</select></label>' +
    '</div>';

    UI.modal({
      key: 'edit-task',
      title: '编辑任务',
      html: html,
      actions: [
        { text: '取消' },
        {
          text: '保存',
          type: 'primary',
          onClick: function (wrap) {
            var newTitle = (wrap.querySelector('#e-title').value || '').trim();
            if (!newTitle) { UI.toast('任务内容不能为空', 'error'); return false; }
            updateTask(id, function () {
              return {
                title: newTitle,
                term: wrap.querySelector('#e-term').value,
                priority: wrap.querySelector('#e-pri').value,
                due: wrap.querySelector('#e-due').value || '',
                status: wrap.querySelector('#e-status').value
              };
            });
            redrawBoard(root);
            UI.toast('已保存', 'success');
          }
        }
      ],
      onMount: function (wrap) { UI.syncDateFields(wrap); }
    });
  }

  /* 只重画看板区域，不动输入框和筛选条。
     但有两种"跨结构"的变化没法靠换 #board-wrap 完成，得整页重绘：
       · 任务从有到无：空状态和看板是两套 DOM
       · 任务从无到有：筛选条不在 #board-wrap 里，只在"有任务"时才渲染。
         实测过——空看板加进第一条任务后，筛选条要切页再回来才出现。 */
  function redrawBoard(root) {
    var wrap = root.querySelector('#board-wrap');
    if (!wrap) return;
    var tasks = AICS.Store.get().tasks || [];
    if (!tasks.length) { AICS.App.refresh(); return; }
    if (!root.querySelector('.filter-bar')) { AICS.App.refresh(); return; }
    wrap.innerHTML = boardHtml(tasks);
  }

  /* ---------- 与四年规划联动 ---------- */

  /* ---------- 四年规划 ↔ 任务看板：双向联动 ----------
     两个方向各管各的，别指望一个函数同时干两件事。 */

  /* 看板里某个任务的状态变了 → 回头把四年规划里同名的那一项也改掉。
     只在当前路线的任务里找，因为不同路线可能存在同名的任务
     （比如「整理一个能讲 20 分钟的核心项目」在就业和"还没想好"里都有）。 */
  AICS.syncRoadmapFromTask = function (title, status) {
    var state = AICS.Store.get();
    var stages = AICS.planFor(state);

    var match = null;
    stages.forEach(function (stage) {
      if (match) return;
      stage.tasks.forEach(function (t) {
        if (!match && t.title === title) match = t;
      });
    });
    if (!match) return false;

    var map = Object.assign({}, state.roadmap);
    var shouldCheck = status === 'done';
    if (shouldCheck === !!map[match.id]) return false;   // 状态已经一致，不用动

    if (shouldCheck) map[match.id] = true;
    else delete map[match.id];
    /* 同样要用 replaceKey——取消最后一项勾选时 map 会是空对象 */
    AICS.Store.replaceKey('roadmap', map);
    return true;
  };

  /* 四年规划里勾上/取消某项 → 把看板里同名任务的完成状态改掉。
     注意取消勾选时只碰"已完成"的任务：如果任务正在"进行中"，
     说明用户本来就没做完，不该把它退回到"待办"丢掉进度状态。 */
  AICS.syncTaskFromRoadmap = function (title, done) {
    var tasks = AICS.Store.get().tasks || [];
    var changed = false;

    var next = tasks.map(function (t) {
      if (t.title !== title) return t;

      if (done) {
        if (t.status === 'done') return t;
        changed = true;
        return Object.assign({}, t, { status: 'done' });
      }
      /* 取消勾选：只有已经从完成状态里退出来才有意义 */
      if (t.status !== 'done') return t;
      changed = true;
      return Object.assign({}, t, { status: 'todo' });
    });

    if (changed) AICS.Store.set('tasks', next);
    return changed;
  };

})(window.AICS);
