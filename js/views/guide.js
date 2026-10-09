/* ============================================================
 * views/guide.js —— 使用指引
 * ------------------------------------------------------------
 * 第一次打开工作台，左边一长串导航项确实容易让人发懵。
 * 这一页回答三个问题：
 *   1. 我该按什么顺序做什么（三步上手，带完成状态）
 *   2. 以我现在的年级，最该看哪几页（个性化推荐）
 *   3. 每个页面到底是干什么的（逐个说明）
 * ============================================================ */
window.AICS = window.AICS || {};
AICS.Views = AICS.Views || {};

(function (AICS) {
  'use strict';

  var UI = AICS.UI;

  /* 每个页面的一句话说明。
     顺序和侧边栏导航严格一致——用户会拿这两处对照着找，
     顺序不一样会让他多找一圈。 */
  var PAGES = [
    { route: 'guide',     icon: 'help',    name: '使用指引',  desc: '就是你现在看的这一页。三步上手、按年级推荐、常见问题' },
    { route: 'dashboard', icon: 'grid',    name: '概览',      desc: '打开就能看到你的整体情况：匹配档位、进度、待办' },
    { route: 'assess',    icon: 'user',    name: '自我认知',  desc: AICS.Calc.totalQuestions() + ' 道测评题，其他页面的分析都基于这份结果。没做测评，后面就没有数据' },
    { route: 'directions',icon: 'compass', name: '方向图谱',  desc: '七个 AI 就业方向的详细介绍：要什么能力、薪资、学历门槛、风险，学习路径会按你的毕业去向分岔' },
    { route: 'match',     icon: 'chart',   name: '匹配诊断',  desc: '核心页面。算出你和每个方向的匹配度，并告诉你差在哪、怎么补' },
    { route: 'compare',   icon: 'scale',   name: '方向对比',  desc: '在两个方向之间犹豫时用，把它们的岗位要求叠在一起看' },
    { route: 'growth',    icon: 'trend',   name: '成长曲线',  desc: '每隔一段时间重测一次，这里会画出你的能力变化轨迹' },
    { route: 'roadmap',   icon: 'calendar',name: '四年规划',  desc: '大一到大四 ' + AICS.roadmapTotal() + ' 项通用阶段任务，还会按你的目标方向和能力短板再加几项' },
    { route: 'kanban',    icon: 'kanban',  name: '任务看板',  desc: '把规划拆成能落地的具体任务，支持截止日期、优先级、筛选' },
    { route: 'assistant', icon: 'bot',     name: 'AI 助手',   desc: '问职业规划相关的问题。默认离线知识库，可配置接入真实大模型' },
    { route: 'resources', icon: 'book',    name: '资源库',    desc: '课程、竞赛、数据集、论文、社区共 ' + AICS.resourceCount() + ' 条精选资源，可搜索' },
    { route: 'report',    icon: 'file',    name: '我的规划书', desc: '把所有分析汇总成一份文档，可导出 Word / Markdown / PDF' },
    { route: 'about',     icon: 'star',    name: '关于作者',  desc: '这个作品是谁做的，以及人和 AI 工具各自负责了什么' }
  ];

  /* 按年级推荐重点看哪几页 */
  var YEAR_FOCUS = {
    '大一': {
      title: '先了解方向与课程安排',
      reason: '你还没上专业课，能力这块基本是空的，所以算法主要看你的兴趣和性格。' +
              '现在不用急着定方向，先把地图看全。',
      focus: ['assess', 'directions', 'roadmap'],
      tip: '「四年规划」里大一那部分现在就能开始，尤其是数学和编程这两件事。'
    },
    '大二': {
      title: '多动手，试出自己喜欢什么',
      reason: '你已经有基础了，兴趣仍然是主要依据，但能力开始计入权重。' +
              '这一年的试错成本最低，实践比观望更能帮助判断。',
      focus: ['assess', 'match', 'roadmap', 'kanban'],
      tip: '看看「匹配诊断」里你的短板是哪几项，这一年重点补它们。'
    },
    '大三': {
      title: '收窄到一个方向，把差距补上',
      reason: '到了要定去向的时候，能力差距开始成为主要因素。' +
              '建议收窄到一两个方向深入准备，不要再平均用力。',
      focus: ['match', 'compare', 'kanban'],
      tip: '用「方向对比」在两个候选之间做决定，然后盯着「匹配诊断」的差距分析补。'
    },
    '大四': {
      title: '把做过的东西整理成能讲的材料',
      reason: '求职阶段用人单位主要考察实际能力，能力这一项的权重最高。' +
              '这一年重点是投简历、准备面试，把做过的项目讲清楚。',
      focus: ['match', 'report', 'kanban'],
      tip: '把「我的规划书」导出来，里面的能力差距分析可以直接用来准备面试。'
    }
  };

  /* ---------- 三步上手 ---------- */

  function stepsHtml(state, analysis) {
    var answered = AICS.Calc.answeredCount(state.assess.answers || {});
    var total = AICS.Calc.totalQuestions();
    var hasProfile = !!state.profile.year;
    var hasResult = !!analysis;

    var steps = [
      {
        n: 1,
        done: hasProfile,
        title: '填写你的年级',
        desc: '年级决定匹配算法的权重，所以必须先填',
        action: 'show-onboarding',
        actionText: hasProfile ? '修改信息' : '现在去填'
      },
      {
        n: 2,
        done: hasResult,
        title: '做完 ' + AICS.Calc.totalQuestions() + ' 道测评题',
        desc: hasResult ? '已完成' : ('大约 12 分钟，已完成 ' + answered + ' / ' + total + ' 题'),
        action: 'go-assess',
        actionText: hasResult ? '重新看看' : '开始测评'
      },
      {
        n: 3,
        done: hasResult && !!state.profile.targetId,
        title: '看结果，定一个目标方向',
        desc: hasResult
          ? '在「匹配诊断」里挑一个方向设为目标，后面的规划都以它为准'
          : '先做完测评，这一步才有内容可看。',
        action: 'go-match',
        actionText: hasResult ? '去看诊断' : '还没到时候',
        /* 没做测评之前这一步是**锁住**的，不是给一个能点的按钮。
           原来写的是"先做测评"、点了跳测评页——于是这一屏上出现两个
           按钮干同一件事（第 2 步的"开始测评"和第 3 步的"先做测评"），
           看着像两个入口，其实只有一个目的地。
           锁住更符合"三步走"这个形状：做了什么，下一步才开。 */
        locked: !hasResult
      }
    ];

    /* 找出"当前该做的那一步"——第一个没完成的。
       只有它的按钮用主色，否则页面上好几个蓝色按钮，重点就散了。 */
    var currentIdx = -1;
    steps.forEach(function (s, i) {
      if (currentIdx < 0 && !s.done) currentIdx = i;
    });

    return '<div class="guide-steps">' + steps.map(function (s, i) {
      var isCurrent = i === currentIdx;
      return '<div class="guide-step' + (s.done ? ' is-done' : '') +
        (isCurrent ? ' is-current' : '') +
        (s.locked ? ' is-locked' : '') + '">' +
        '<div class="guide-step__num">' + (s.done ? UI.icon('check') : s.n) + '</div>' +
        '<div class="guide-step__body">' +
          '<strong>' + UI.esc(s.title) +
            (isCurrent ? '<span class="guide-step__badge">当前</span>' : '') +
          '</strong>' +
          '<em>' + UI.esc(s.desc) + '</em>' +
        '</div>' +
        /* 锁住的那一步给一个 disabled 按钮，不给 data-action——
           给了的话点下去还是会有动作，那就不叫锁住 */
        (s.locked
          ? '<button class="btn" disabled>' + UI.esc(s.actionText) + '</button>'
          : '<button class="btn' + (isCurrent ? ' btn--primary' : '') +
            '" data-action="' + s.action + '">' + UI.esc(s.actionText) + '</button>') +
      '</div>';
    }).join('') + '</div>';
  }

  /* ---------- 按年级推荐 ---------- */

  function yearFocusHtml(year) {
    var f = YEAR_FOCUS[year];
    if (!f) return '';

    return '<div class="panel guide-focus">' +
      '<div class="panel__head"><h3>以「' + UI.esc(year) + '」来说，你最该看这几页</h3></div>' +
      '<p class="guide-focus__title">' + UI.esc(f.title) + '</p>' +
      '<p class="guide-focus__reason">' + UI.esc(f.reason) + '</p>' +
      '<div class="guide-focus__pages">' +
        f.focus.map(function (route) {
          var pg = PAGES.filter(function (p) { return p.route === route; })[0];
          if (!pg) return '';
          return '<button class="guide-page-card" data-action="go-' + route + '">' +
            UI.icon(pg.icon) +
            '<strong>' + UI.esc(pg.name) + '</strong>' +
            UI.icon('arrow-right') +
          '</button>';
        }).join('') +
      '</div>' +
      '<div class="guide-tip">' + UI.icon('flag') + '<span>' + UI.esc(f.tip) + '</span></div>' +
    '</div>';
  }

  /* ---------- 页面清单 ---------- */

  function pagesHtml() {
    return '<div class="guide-pages">' + PAGES.map(function (p) {
      return '<div class="guide-page-row">' +
        '<span class="guide-page-row__icon">' + UI.icon(p.icon) + '</span>' +
        '<div><strong>' + UI.esc(p.name) + '</strong>' +
        '<em>' + UI.esc(p.desc) + '</em></div>' +
      '</div>';
    }).join('') + '</div>';
  }

  /* ---------- 常见问题 ---------- */

  var FAQ = [
    {
      q: '做一次测评要多久？可以中途退出吗？',
      a: '大约 12 分钟。随时可以关掉，答案会自动保存，下次打开接着答就行。'
    },
    {
      q: '我的数据会被上传吗？',
      a: '不会。测评答案、任务、对话全部存在你自己浏览器的本地存储里，不上传任何服务器。' +
         '唯一的例外是：如果你主动配置了 AI 助手的 API Key，你向助手提的问题会发给你自己选择的服务商。'
    },
    {
      q: '为什么必须先填年级？',
      a: '因为年级会改变匹配算法的权重。大一学生能力还没成形，如果按固定权重算，' +
         '七个方向的分数会集中在一个很窄的区间里，区分不出先后。所以大一主要看兴趣和性格，越接近毕业能力权重越高。'
    },
    {
      q: '做完测评后改了答案，结果会更新吗？',
      a: '会。改完任意一题，页面顶部的结果区会立即重算，不用重新走一遍流程。'
    },
    {
      q: '换了电脑，数据还在吗？',
      a: '不在。数据存在浏览器本地，换设备不会跟着走。' +
         '换之前到「设置」里点「导出数据备份」，在新设备上点「导入数据备份」就能恢复。'
    },
    {
      q: '匹配度算出来我不认同怎么办？',
      a: '算出来的结果只是参考，可以结合你自己的判断看。' +
         '如果算出来的和你自己的判断差很多，可以想想是算法错了，还是你高估或低估了自己？' +
         '点开「匹配诊断」里的「算法拆解」，能看到完整的计算过程。'
    },
    {
      q: '手机能用吗？',
      a: '能用，界面会自动适配窄屏。不过看板卡片在手机上拖不动（浏览器不支持触屏拖拽），' +
         '用卡片上的左右箭头按钮代替，功能是一样的。'
    }
  ];

  function faqHtml() {
    return '<div class="faq-list">' + FAQ.map(function (item) {
      return '<details class="faq">' +
        '<summary>' + UI.icon('help') + UI.esc(item.q) + '</summary>' +
        '<p>' + UI.esc(item.a) + '</p>' +
      '</details>';
    }).join('') + '</div>';
  }

  AICS.Views.guide = {
    title: '使用指引',
    desc: '第一次用？从这里开始',

    /* 供启动自检使用：这一页列了哪些页面 */
    pageList: function () {
      return PAGES.map(function (p) { return p.route; });
    },

    render: function () {
      var state = AICS.Store.get();
      var analysis = AICS.Calc.analyse(state);
      var year = state.profile.year;

      var head = UI.pageHeader('使用指引',
        '不知道从哪开始的话，按顺序做完下面三件事就够了',
        '<button class="btn" data-action="show-onboarding">' + UI.icon('refresh') + ' 重新设置年级</button>');

      /* 没填年级时，最顶上给一条醒目的提醒 */
      var warn = !year
        ? '<div class="banner banner--warn">' + UI.icon('alert') +
            '<div><strong>你还没填年级</strong>' +
            '<span>年级会改变匹配算法的权重，不填的话只能用通用标准估算</span></div>' +
            '<button class="link-btn" data-action="show-onboarding">现在去填 ' + UI.icon('arrow-right') + '</button>' +
          '</div>'
        : '';

      return head + warn +
        '<section class="guide-section">' +
          '<h2>' + UI.icon('flag') + ' 三步上手</h2>' +
          stepsHtml(state, analysis) +
        '</section>' +
        (year ? '<section class="guide-section">' + yearFocusHtml(year) + '</section>' : '') +
        '<section class="guide-section">' +
          /* 条数现算——写死的话每加一页就得回来改一次 */
          '<h2>' + UI.icon('grid') + ' 这 ' + PAGES.length + ' 个页面分别是干什么的</h2>' +
          pagesHtml() +
        '</section>' +
        '<section class="guide-section">' +
          '<h2>' + UI.icon('help') + ' 常见问题</h2>' +
          faqHtml() +
        '</section>' +
        '<div class="panel guide-privacy">' +
          '<div class="panel__head"><h3>' + UI.icon('lock') + ' 关于你的数据</h3></div>' +
          '<p>所有内容都存在你自己电脑的浏览器里，不上传任何服务器。没有账号、不用注册、没有埋点统计，' +
            '断网也能正常使用。想带走就导出备份，想清空就一键清空。</p>' +
        '</div>';
    }
  };

})(window.AICS);
