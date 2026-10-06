/* ============================================================
 * data-plan.js —— 四年行动路线 + 学习资源库
 * ------------------------------------------------------------
 * ROADMAP    大一到大四的阶段任务
 * RESOURCES  分类学习资源
 *
 * 关于「分岔」：
 * 有些任务不是所有人都一样——瞄准算法工程师（通常需硕士）的人，
 * 大四该做的是考研/保研，不是秋招。所以这类任务备了三版，用 track
 * 字段区分：
 *   不写 track   → 通用，两条路都要做
 *   track:'job'  → 只有本科就业路线
 *   track:'grad' → 只有升学路线
 *   track:'undecided' → 还没想好的人看到的版本
 * 真正分岔的只有 5 项，集中在大三暑假和大四。前面两年的任务完全通用。
 * ============================================================ */
window.AICS = window.AICS || {};

(function (AICS) {
  'use strict';

  /* 三条路线 */
  AICS.PLAN_TRACKS = [
    { key: 'job',       name: '本科就业', desc: '毕业直接工作',      icon: 'briefcase' },
    { key: 'grad',      name: '升学深造', desc: '保研 / 考研 / 读博', icon: 'book' },
    { key: 'undecided', name: '还没想好', desc: '两条路都留着',      icon: 'help' }
  ];

  /* 每项任务都带一个优先级 pri，导入任务看板时会一起带过去
     （不写的话会被当成 mid，结果就是"全是中等"，筛选条形同虚设）。

     判断标准只有一条：
       high  有硬期限，或者错过就补不回来
       mid   重要的能力建设，但没有硬期限
       low   加分项，不做也不挡路

     所以「竞赛」年年是 low（加分项，不做也照样毕业），
     而「高数拿良好」是 high（GPA 是保研的硬门槛，大一的课补不回来）。 */
  AICS.ROADMAP = [
    {
      year: '大一',
      theme: '打地基',
      goal: '把数学和编程两块基础打好，同时了解 AI 有哪些方向。',
      color: '#4dd0e1',
      tasks: [
        { id: 'y1t1', pri: 'high', title: '高数 / 线代 / 概率统计拿到良好以上', desc: 'GPA 是保研的硬门槛，大一的课最不能放' },
        /* 这一条原来写死的是「Python 从零学到能独立写小项目」。
           查下来不对：国内不少学校（四川大学、电子科技大学等）
           大一先教 C++，有的先教 C。对着一个刚学完 C++ 指针的
           川大学生说"你该在学 Python"，这条任务从第一天就是错的。

           改成不指定语言，再单独补一条"把 Python 接上"——
           因为不管学校教什么，AI 的工具链（PyTorch、数据处理、
           模型部署）最后都落在 Python 上，这门躲不开。 */
        { id: 'y1t2', pri: 'high', title: '把学校教的第一门编程语言学扎实',
          desc: '有的学校先教 Python，有的先教 C++。学哪门不影响，标准是一样的：脱离教材也能从空白文件写出能跑的程序' },
        { id: 'y1t7', pri: 'mid', title: '把 Python 接上（学校不教就自己补）',
          desc: 'AI 的工具链几乎全在 Python 上，这门语言躲不开。大一教的不是它的话，趁这个暑假补最划算。有编程底子的人两三周就能上手，不用从头学' },
        { id: 'y1t3', pri: 'mid',  title: '装一次 Linux（双系统或虚拟机），习惯命令行', desc: 'AI 的训练与部署工具在 Linux 上支持最完整' },
        { id: 'y1t4', pri: 'mid',  title: '完整了解 AI 的七个就业方向', desc: '知道每个方向做什么、要什么能力，才好定目标' },
        { id: 'y1t5', pri: 'low',  title: '至少参加一次校级竞赛或加入一个技术社团', desc: '大一就开始积累"我做过什么"' },
        { id: 'y1t6', pri: 'mid',  title: '把英语四级拿下，开始读英文技术文档', desc: 'AI 领域的一手资料几乎全是英文' }
      ]
    },
    {
      year: '大二',
      theme: '入门技术',
      goal: '掌握机器学习经典算法，做出第一个完整项目。',
      color: '#7c5cff',
      tasks: [
        { id: 'y2t1', pri: 'high', title: '系统学完机器学习经典算法并手推一遍', desc: '线性回归、逻辑回归、决策树、SVM、聚类，理解比会调包重要' },
        /* 刷题放在大二，但它的期限其实是大三暑期的实习笔试，所以是 high */
        { id: 'y2t2', pri: 'high', title: '学完数据结构与算法，刷够 200 道题', desc: '这是所有技术岗笔试的入场券' },
        { id: 'y2t3', pri: 'mid',  title: '用 PyTorch 完整训练一个深度学习模型', desc: '从数据准备到训练到评估，走通全流程' },
        { id: 'y2t4', pri: 'high', title: '完成第一个完整项目并开源到 GitHub', desc: '有 README、有文档、能跑起来，这是你的第一个作品' },
        { id: 'y2t5', pri: 'low',  title: '参加一次数据挖掘或算法竞赛', desc: '天池、Kaggle、蓝桥杯都行，名次不重要，过程重要' },
        { id: 'y2t6', pri: 'mid',  title: '主动联系老师，争取进实验室', desc: '哪怕先做最基础的活，环境和视野完全不同' },
        { id: 'y2t7', pri: 'mid',  title: '通过英语六级', desc: '读研和进大厂都会看，早过早安心' }
      ]
    },
    {
      year: '大三',
      theme: '方向深耕',
      goal: '收窄到一个方向做深，拿到实习或科研产出。这一年往往决定大四的起点。',
      color: '#ffb020',
      tasks: [
        { id: 'y3t1', pri: 'high', title: '确定主攻方向，并制定该方向的能力补齐计划', desc: '用工作台的匹配诊断做依据，别再摇摆' },
        { id: 'y3t2', pri: 'mid',  title: '完整复现一篇方向内经典论文', desc: '复现能力是区分"会用"和"懂"的分水岭' },
        { id: 'y3t3', pri: 'mid',  title: '做一个有真实用户或真实数据的项目', desc: '真实场景的项目远比玩具项目有说服力' },
        { id: 'y3t4', pri: 'mid',  title: '写出一份能过初筛的简历', desc: '一页纸，用成果和数据说话，不要罗列课程' },

        /* ↓ 分岔点一：大三暑假怎么用，两条路完全不同 ↓
           三版都是 high——大三暑假只有一次，而且直接决定大四的起点 */
        { id: 'y3t5', track: 'job', pri: 'high', title: '拿到一段暑期实习',
          desc: '实习经历在秋招简历筛选中的分量，通常高于竞赛和课程成绩' },
        { id: 'y3t5g', track: 'grad', pri: 'high', title: '保研就冲夏令营，考研就进入强化复习',
          desc: '保研的夏令营集中在 5~7 月；考研的暑假是拉开差距的关键期，别浪费' },
        { id: 'y3t5u', track: 'undecided', pri: 'high', title: '实习和备考各试一段，用这个暑假做最后判断',
          desc: '两条路都亲身试过，比继续纠结有用得多' },

        { id: 'y3t6', pri: 'low',  title: '在竞赛中冲击更高奖项', desc: '省奖以上才真正加分' },
        { id: 'y3t7', pri: 'high', title: '确定毕业去向：就业 / 保研 / 考研 / 出国', desc: '四条路的准备方式完全不同，必须在大三下之前定下来' }
      ]
    },
    {
      year: '大四',
      theme: '冲刺落地',
      goal: '把前三年的积累落实成 offer、录取通知或毕业设计。',
      color: '#00e5a0',
      tasks: [
        /* ↓ 分岔点二：大四的主线任务，两条路完全不同 ↓
           这三版都是 high——秋招九月就开跑、推免九月底填报、考研十月报名截止，
           都是有硬日期的，错过这一年就没了 */
        { id: 'y4t1', track: 'job', pri: 'high', title: '秋招：投递、笔试、面试全流程冲刺',
          desc: '提前批在 7~8 月就开始了，别等九月' },
        { id: 'y4t1g', track: 'grad', pri: 'high', title: '9 月推免系统填报 / 12 月考研初试',
          desc: '保研的推免系统在 9 月底开放；考研初试一般在 12 月下旬，这是决定性的两场' },
        { id: 'y4t1u', track: 'undecided', pri: 'high', title: '这时候必须定了：考研 10 月报名截止，秋招 9 月就开跑',
          desc: '拖到这个时候，两条路都会来不及。找老师或学长聊一次，尽快拍板' },

        { id: 'y4t2', track: 'job', pri: 'high', title: '整理一个能讲 20 分钟的核心项目',
          desc: '面试官只会深挖一个项目，讲透比讲多重要' },
        { id: 'y4t2g', track: 'grad', pri: 'high', title: '整理科研经历，复试时要能讲清楚',
          desc: '复试面试会深挖你的项目和科研细节，提前把材料理顺' },
        { id: 'y4t2u', track: 'undecided', pri: 'mid', title: '整理一个能讲 20 分钟的核心项目',
          desc: '不管最后走哪条路，这份材料都用得上，先备好' },

        { id: 'y4t3', track: 'job', pri: 'mid', title: '系统准备八股与手撕代码',
          desc: '机器学习基础、深度学习、Python、算法题' },
        { id: 'y4t3g', track: 'grad', pri: 'high', title: '准备复试：专业课笔试 + 英语口语 + 综合面试',
          desc: '复试占比不低，每年都有人在这一步被刷掉，别掉以轻心' },
        { id: 'y4t3u', track: 'undecided', pri: 'mid', title: '把基础课再系统过一遍',
          desc: '机器学习、数学、编程这些基础，考研要考，找工作也要问，两条路都躲不开' },

        { id: 'y4t4', pri: 'mid', title: '认真完成毕业设计', desc: '毕设是做深一个问题的最后机会，两条路都认这份成果' },

        { id: 'y4t5', track: 'job', pri: 'low', title: '提前了解入职方向的技术栈',
          desc: '拿到 offer 之后到入职之前，是难得的自由学习期' },
        { id: 'y4t5g', track: 'grad', pri: 'mid', title: '提前联系导师、进课题组，熟悉研究方向',
          desc: '越早进组越早出成果，也能提前判断这个方向到底适不适合自己' },
        { id: 'y4t5u', track: 'undecided', pri: 'mid', title: '求职和读研同时准备：简历继续投，复试也别停',
          desc: '结果没出来之前别提前关门。哪条路先有回音就先抓住，另一条留作后手' },

        { id: 'y4t6', pri: 'low', title: '把这份职业规划更新成真实结果', desc: '回到工作台，记录你最终去了哪里、走了哪条路' }
      ]
    }
  ];

  /* ------------------------------------------------------------
   * 通用任务各自练的是哪几个能力维度
   *
   * 单独放一张表，而不是往上面那份 ROADMAP 里逐条加字段——
   * ROADMAP 是给人读的规划正文，塞进机器用的 key 会变难读；
   * 而且没列到的任务自动视为"不针对任何维度"，加任务时不会报错。
   *
   * 这张表唯一的用途：目标方向特别看重某个维度时，把练它的任务
   * 优先级往上提一档（见 tunePriority）。
   * ---------------------------------------------------------- */
  var TASK_DIMS = {
    y1t1: ['math'],
    y1t2: ['coding'],
    y1t3: ['deploy'],
    y1t7: ['coding'],
    y1t6: ['comm'],
    y2t1: ['ml', 'math'],
    y2t2: ['coding'],
    y2t3: ['dl'],
    y2t4: ['coding'],
    y2t5: ['ml', 'data'],
    y2t7: ['comm'],
    y3t1: ['ml'],
    y3t2: ['dl'],
    y3t3: ['coding'],
    y3t5: ['deploy'],
    y4t3: ['ml', 'coding'],
    y4t5: ['deploy']
  };

  /* ------------------------------------------------------------
   * 短板补齐任务的文案：能力维度 × 年级段
   *
   * 分三档而不是四档，用的是 data-core 里现成的 yearGroup()，理由：
   * 大三大四的措辞差别不大（都是"结合目标做深"），而大一和后面两年
   * 差别很大（从零起步 vs 查漏补缺）。三档够用，也少维护一份文案。
   *
   * 没在这里写"为什么你该补这个"——那是 calc.js 的 gaps 算出来的，
   * 视图层会把"你还差多少分"拼在旁边，文案只管说"具体做什么"。
   *
   * 【写文案的死规矩】不许和 ROADMAP 里的通用任务说同一件事。
   * 这两条会并排出现在同一个阶段里，撞车的后果很直观：大二那栏里
   * 同时列出「用 PyTorch 完整训练一个深度学习模型」和「用 PyTorch
   * 完整训练一个模型」，读的人只会觉得这系统在凑数。
   *
   * 所以每条的角度都是"通用要求之上，你这个方向得多走一步"：
   *   · 通用说"拿到良好"，这里说"当主线"（要求更高）
   *   · 通用说"能独立写小程序"，这里说"脱离教程也能写"（标准更严）
   *   · 通用说"完整训练一个模型"，这里说"讲清楚每一层在做什么"（更深）
   * selfCheck 里有一条查重，写完自动过一遍。
   * ---------------------------------------------------------- */
  AICS.DIM_GAP_TASKS = {
    math: {
      fresh:  { title: '把数学当成这学期的主线', desc: '你这个方向对数学的要求比一般方向高。这门课当堂消化掉，比事后回头补省力得多' },
      mid:    { title: '把线代和概率的直觉补起来', desc: '矩阵运算对应什么变换、贝叶斯怎么用在分类上，光会算题不够' },
      senior: { title: '按需补数学，缺哪补哪', desc: '学到哪个算法就补它背后的数学：逻辑回归补最大似然，反向传播补链式法则' }
    },
    coding: {
      fresh:  { title: '把编程语言练到脱离教程也能写', desc: '照着例子敲能跑不算会。试着不看答案，从空白文件开始搭一个小东西出来' },
      mid:    { title: '把写过的代码攒成一个仓库', desc: '一年下来零散的脚本整理到一处，好找，也能看出自己到底写了多少' },
      senior: { title: '把项目代码整理成别人能读的样子', desc: '模块拆分、写 README、能讲清楚每个文件在干什么，面试官会问' }
    },
    ml: {
      fresh:  { title: '先搞清楚机器学习在解决什么问题', desc: '这个阶段不用推公式，但要能说清楚它和写死规则的传统程序差在哪' },
      mid:    { title: '找一份真实数据把学过的算法跑一遍', desc: '课本例子都是清洗好的，真实数据的缺失、异常、量纲不一致才是常态' },
      senior: { title: '结合目标方向补机器学习的用法', desc: '算法岗深挖调参与特征工程，应用岗重点学选型和效果评测' }
    },
    dl: {
      fresh:  { title: '跑通第一个神经网络例子', desc: '搭个最简模型跑一遍 MNIST，先建立"它大概怎么工作"的手感' },
      mid:    { title: '从"会调包"推进到"懂原理"', desc: '光能训练出模型不够，得讲得清每一层在做什么、为什么这么设计' },
      senior: { title: '复现一篇论文，或把预训练模型微调到自己的任务上', desc: '真复现过论文的人不多，简历上这一项很值钱' }
    },
    data: {
      fresh:  { title: '学会用 Pandas 读数据看数据', desc: '能回答"这份数据长什么样"：多少行、有没有缺失、分布如何' },
      mid:    { title: '把 SQL 练熟', desc: '多表连接、分组聚合、窗口函数，这是所有数据类岗位的入场券' },
      senior: { title: '独立完成一次从取数到结论的完整分析', desc: '写成能给别人看的报告，重点是结论和依据，不是图有多花' }
    },
    deploy: {
      fresh:  { title: '把命令行变成日常习惯', desc: '装上不算，日常的文件操作都在终端里完成才算' },
      mid:    { title: '学会 Git 和 Docker', desc: '代码能版本管理，环境能打包带走，这两样不会的话项目没法给别人' },
      senior: { title: '把自己的项目真正部署起来', desc: '做出一个能点开的线上地址，就是部署能力的证明' }
    },
    product: {
      fresh:  { title: '用 AI 产品时多问一句"它解决了谁的什么问题"', desc: '随手记录使用感受，产品 sense 是这么一点点攒的' },
      mid:    { title: '从"用 AI 产品"跨到"做 AI 产品"', desc: '挑一个你天天在用的 AI 功能，想清楚它为什么这么设计，再自己做一个类似的' },
      senior: { title: '把做过的项目写成案例', desc: '问题是什么、方案为什么这么选、结果如何，面试和复试都问这个' }
    },
    comm: {
      fresh:  { title: '开始写学习笔记', desc: '能把学过的东西给别人讲明白，才算真的学会了' },
      mid:    { title: '每做完一个项目写一篇技术文章', desc: '发到博客或技术社区，写的过程会逼你把没想清楚的地方补上' },
      senior: { title: '把核心项目练成 5 分钟和 20 分钟两个版本', desc: '面试、组会、答辩的时长都不一样，提前各准备一版' }
    }
  };

  /* 方向学习路径里，哪几个时间前缀要变成规划任务。
     刻意只取「大三」这一步：
       · 前两步（大一 / 大二）讲的就是数学和编程基础，和上面的通用地基
         几乎是一回事，重复列出来只会让人以为要做两遍
       · 大三暑假和大四已经在 ROADMAP 里按毕业去向分过岔了
     大三这一步是七个方向差别最大、且通用地基完全没覆盖的地方。 */
  AICS.DIR_PATH_WHEN = '大三';

  /* 方向技能栈任务的落点年级。放在大三，因为技能栈是"要投实习了，
     简历上得有这些"，太早列出来学生也不知道拿来干什么。 */
  AICS.SKILL_STAGE = '大三';

  /* 资源总条数。文案里凡是要写"共 N 条资源"的地方都现算。
     写死过一次——助手上写"内置 18 个话题"，给知识库补了 4 条之后
     那个数字就成了假的。凡是能现算的条数，就不要抄一遍。 */
  AICS.resourceCount = function () {
    return AICS.RESOURCES.reduce(function (n, c) { return n + c.items.length; }, 0);
  };

  /* 通用地基：按路线挑出该显示的任务，不带任何个性化。
     不传 track 就拿全部（用于统计总量）。 */
  function baseStages(track) {
    if (!track) return AICS.ROADMAP;
    return AICS.ROADMAP.map(function (stage) {
      return {
        year: stage.year,
        theme: stage.theme,
        goal: stage.goal,
        color: stage.color,
        tasks: stage.tasks.filter(function (t) {
          return !t.track || t.track === track;
        })
      };
    });
  }

  /* 通用地基的任务总数（不含为个人生成的方向专项和短板补齐）。
     三条路线都是同一个数（分岔点上每条路各取一版），所以不用传路线；
     但仍然是算出来的，加任务时不用回来改文案。 */
  AICS.roadmapTotal = function () {
    return baseStages('undecided').reduce(function (n, s) { return n + s.tasks.length; }, 0);
  };

  /* 生成四年规划。

     ctx 传 planContext() 的结果，会在地基之上叠两层个性化任务；
     不传就返回纯通用地基——老调用点和"统计总量"这类用法不受影响。

     每条任务都会补上 kind 字段，视图靠它区分「这是所有人都要做的」
     还是「这是为你生成的」：
       base  通用地基      dir  方向专项      gap  短板补齐 */
  AICS.roadmapFor = function (track, ctx) {
    var stages = baseStages(track);
    if (!ctx) return stages;

    var extra = personalTasks(track, ctx);

    return stages.map(function (stage) {
      var base = stage.tasks.map(function (t) {
        return {
          id: t.id,
          title: t.title,
          desc: t.desc,
          kind: 'base',
          /* 这项任务主要练哪几个能力维度。勾完之后"做到什么程度了"
             要落到具体维度上，所以每个任务都得带着这张表走。 */
          dims: TASK_DIMS[t.id] || [],
          pri: tunePriority(t.pri, TASK_DIMS[t.id], ctx)
        };
      });
      return {
        year: stage.year,
        theme: stage.theme,
        goal: stage.goal,
        color: stage.color,
        tasks: base.concat(extra[stage.year] || [])
      };
    });
  };

  /* 判断当前该走哪条路线。
     用户没手动选的话，按他设的目标方向推断——瞄准算法工程师（通常需硕士）
     就默认走升学，瞄准大模型应用开发（本科可入）就默认走就业。
     没设目标方向时给「还没想好」，因为这时候确实还没想好。 */
  AICS.resolveTrack = function (state) {
    var manual = (state.plan && state.plan.track) || '';
    if (manual) {
      var t = AICS.PLAN_TRACKS.filter(function (x) { return x.key === manual; })[0];
      return { key: manual, auto: false, name: t ? t.name : manual, reason: '' };
    }

    var target = AICS.Directions.byId((state.profile || {}).targetId);
    if (!target) {
      return {
        key: 'undecided', auto: true, name: '还没想好',
        reason: '你还没设目标方向，先按「还没想好」显示'
      };
    }

    var needsGrad = target.degree === 'master' || target.degree === 'phd';
    return {
      key: needsGrad ? 'grad' : 'job',
      auto: true,
      name: needsGrad ? '升学深造' : '本科就业',
      reason: '按你设的目标方向「' + target.name + '」（' +
              AICS.Directions.degreeOf(target).text + '）自动选的'
    };
  };

  /* ------------------------------------------------------------
   * 「你现在在哪」——把年级 + 当前月份换算成学年里的位置
   *
   * 系统当然知道今天几号（任务看板判断过期、规划书上的生成日期都在用）。
   * 缺的不是日期，是**你填的"大三"对应哪一段时间**——你填的是年级，
   * 不是入学年份。
   *
   * 这个缺口靠一条通用规律补上：**国内大学基本 9 月开学**。
   * 有了它，月份本身就能定位：
   *   9 月 ~ 次年 1 月   → 该学年的上学期
   *   2 月 ~ 6 月        → 该学年的下学期
   *   7 月 ~ 8 月        → 暑假（学年交界）
   *
   * 全程不需要知道具体年份。所有关键节点都是"学年内的相对位置"
   * （大三暑假永远是"大三那一年的 7 月"），只有在界面上要显示
   * "2027 年 7 月"这种绝对日期时，才把月数差加到当前日期上。
   *
   * 这是个**明写出来的假设**：春季入学、或者休学过的同学会对不上。
   * 所以界面上会把推算结果原样说出来（"按 9 月开学推算，你现在是
   * 大三上"），并允许直接改年级——算不准却不说，比算不准严重得多。
   * ---------------------------------------------------------- */

  /* 年级 → 学年序号 */
  var YEAR_INDEX = { '大一': 1, '大二': 2, '大三': 3, '大四': 4 };

  /* 把"现在是几月"映射成"学年内的第几个月"：9 月 = 0，次年 8 月 = 11 */
  function schoolMonthOf(date) {
    var m = date.getMonth() + 1;
    return m >= 9 ? (m - 9) : (m + 3);
  }

  /* 关键节点。abs 是"从入学算起的第几个月"，
     算法：(学年序号 - 1) × 12 + 学年内的月份。
     例：大三暑假 = 大三那一年（第 3 学年）的 7 月 = 2×12 + 10 = 34 */
  AICS.MILESTONES = [
    { abs: 10, name: '大一暑假', hint: '第一次能整块支配的长假' },
    { abs: 22, name: '大二暑假', hint: '做出第一个完整项目的好时机' },
    { abs: 34, name: '大三暑假', hint: '实习 / 夏令营 / 考研强化，三条路都在这一个暑假分岔' },
    { abs: 36, name: '秋招开跑', hint: '大四 9 月。但提前批 7~8 月就开始了，别等到九月' },
    { abs: 39, name: '考研初试', hint: '大四 12 月下旬' }
  ];

  /* 算出"你现在在学年的哪个位置"。
     年级没填就返回 null——这种情况界面引导去填，而不是猜一个。 */
  AICS.termPosition = function (year, now) {
    var idx = YEAR_INDEX[year];
    if (!idx) return null;

    var d = now || new Date();
    var sm = schoolMonthOf(d);
    var abs = (idx - 1) * 12 + sm;

    var term, label;
    if (sm <= 4) { term = 1; label = year + '上学期'; }         // 9 月 ~ 次年 1 月
    else if (sm <= 9) { term = 2; label = year + '下学期'; }    // 2 月 ~ 6 月
    else { term = 0; label = year + '的暑假'; }                 // 7 月 ~ 8 月

    return {
      year: year,
      yearIndex: idx,
      absMonth: abs,
      term: term,
      label: label,
      isBreak: term === 0,
      /* 四年共 48 个月，这个比例直接拿去画时间轴上的位置 */
      progress: abs / 48
    };
  };

  /* 距离某个节点还有几个月，已经过去的返回负数 */
  AICS.monthsUntil = function (absTarget, pos) {
    if (!pos) return null;
    return absTarget - pos.absMonth;
  };

  /* 把"N 个月之后"换算成具体的年月。界面上写"2027 年 7 月"要用到 */
  AICS.monthLabel = function (now, offsetMonths) {
    var base = now || new Date();
    var d = new Date(base.getFullYear(), base.getMonth() + offsetMonths, 1);
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月';
  };

  /* ------------------------------------------------------------
   * 个性化上下文：这份规划是"照什么生成的"
   *
   * ready   测评做完了没有（没做完就只有方向专项，没有短板补齐）
   * target  目标方向，没设就是 null
   * focus   要重点练的维度 key，通用任务的优先级照它调
   * gaps    自评最弱的两个维度 + 差距，「短板补齐任务」照它生成
   * grade   年级段（fresh / mid / senior），决定用哪一档短板文案
   * source  一句话说明这份规划的参照物，界面上要显示出来
   *
   * 没设目标方向时不能拿第一名凑数。第一档里往往挤着好几个方向
   * （实测占 10%~24% 的测评结果），全站的设计就是档内不分先后，
   * 挑一个说"就按它生成"等于制造了一个不存在的区分度。
   * 这里跟 calc.js 的 priority 用同一套口径：按"第一档里最不挑的
   * 那个方向"算，谁都得补的才算短板。
   * ---------------------------------------------------------- */
  AICS.planContext = function (state) {
    state = state || {};
    var profile = state.profile || {};
    var target = AICS.Directions.byId(profile.targetId);
    var a = (AICS.Calc && AICS.Calc.analyse) ? AICS.Calc.analyse(state) : null;

    var ctx = {
      ready: !!a,
      target: target,
      year: profile.year || '',
      grade: AICS.yearGroup(profile.year),
      focus: [],
      gaps: [],
      source: ''
    };

    if (!a) {
      ctx.source = target
        ? '照你的目标方向「' + target.name + '」加了几条；做完测评，还会按你缺的那几项再补'
        : '还没做测评，也没定目标方向，所以这里暂时没有给你加的任务';
      return ctx;
    }

    /* calc.js 已经算好了"最该补的三项"，这里只需要前两项排进规划——
       一次列五条短板等于没重点，两条才做得完 */
    ctx.gaps = (a.priority || []).slice(0, 2).map(function (g) {
      return { key: g.key, name: g.name, mine: g.mine, need: g.need, gap: g.gap };
    });

    if (target) {
      /* 目标方向要求最高的两个维度。
         只取两个而不是三个：命中越宽，"重点"标就打得越多，
         标得越多越没人看——实测取三个时 algo 方向下 30 项里 17 项是重点。 */
      ctx.focus = AICS.DIMS.slice().sort(function (x, y) {
        return (target.req[y.key] || 0) - (target.req[x.key] || 0);
      }).slice(0, 2).map(function (d) { return d.key; });

      ctx.source = '照你的目标方向「' + target.name + '」，和你自评最弱的两项加的';
    } else {
      /* 第一档里"最不挑的那个方向"都要的能力，才是谁都躲不开的 */
      var bandDirs = a.topBand.items.map(function (r) { return AICS.Directions.byId(r.id); });
      ctx.focus = AICS.DIMS.map(function (d) {
        return {
          key: d.key,
          need: Math.min.apply(null, bandDirs.map(function (dir) {
            return (dir.req || {})[d.key] || 0;
          }))
        };
      }).sort(function (x, y) { return y.need - x.need; })
        .slice(0, 2).map(function (x) { return x.key; });

      ctx.source = '你还没定目标方向，所以按测评第一档那 ' + bandDirs.length +
        ' 个方向都要的能力来补';
    }

    return ctx;
  };

  /* 视图层统一用这个入口：传 state，拿到这个人的完整四年规划 */
  AICS.planFor = function (state) {
    state = state || AICS.Store.get();
    var track = AICS.resolveTrack(state);
    return AICS.roadmapFor(track.key, AICS.planContext(state));
  };

  /* 为目标方向特别看重的维度加权：命中就把任务往上提一档。

     只升不降。降级听起来更"个性化"，实际是在递错误信号——
     目标设成 AI 产品经理的人看到数学任务被降成低优先级，会理解成
     "那我可以不学"，但数学是 AI 专业的地基，哪个方向都不该跳过。 */
  function tunePriority(pri, dims, ctx) {
    if (!dims || !dims.length || !ctx.focus.length) return pri;
    var hit = false;
    dims.forEach(function (d) { if (ctx.focus.indexOf(d) >= 0) hit = true; });
    if (!hit) return pri;
    if (pri === 'low') return 'mid';
    if (pri === 'mid') return 'high';
    return pri;
  }

  /* 短板任务里那句"跟谁比、还差多少"。
     参照物不一样说法就得不一样——只写"还差 30 分"用户没法判断这分数哪来的。 */
  function gapBasis(ctx, g) {
    if (ctx.target) {
      return '「' + ctx.target.name + '」要求 ' + Math.round(g.need) +
        ' 分，还差 ' + Math.round(g.gap) + ' 分';
    }
    return '第一档里要求最低的方向也要 ' + Math.round(g.need) +
      ' 分，还差 ' + Math.round(g.gap) + ' 分';
  }

  /* 为这个人额外生成的任务，按年级分好组：{ '大三': [task, ...] } */
  function personalTasks(track, ctx) {
    var out = {};
    function push(year, task) {
      if (!out[year]) out[year] = [];
      out[year].push(task);
    }

    /* ① 方向专项：目标方向在大三那一步要做的深耕动作 + 技能栈。
          id 里带上方向 id，这样换方向之后旧任务的勾选不会串到新任务上。

          优先级一律是 mid，不因为"这是为你生成的"就标重点。
          ROADMAP 里 high 的定义只有一条：有硬期限，或者错过就补不回来。
          这两条都属于"重要的能力建设，但没有硬期限"，按同一个标准就该是 mid——
          全标成重点的结果是"重点"两个字彻底不值钱（实测过：
          algo 方向下有 17/30 条标了重点，读的人直接当没看见）。 */
    if (ctx.target) {
      AICS.pathFor(ctx.target, track || 'job').forEach(function (line) {
        var parts = String(line).split('：');
        if (parts[0] !== AICS.DIR_PATH_WHEN) return;
        push(AICS.SKILL_STAGE, {
          id: 'dir-' + ctx.target.id + '-path',
          pri: 'mid',
          kind: 'dir',
          dims: ctx.focus.slice(),
          title: parts.slice(1).join('：'),
          desc: ctx.target.name + '方向特有的一步，通用规划里没有'
        });
      });

      var skills = ctx.target.skills || [];
      if (skills.length) {
        push(AICS.SKILL_STAGE, {
          id: 'dir-' + ctx.target.id + '-skills',
          pri: 'mid',
          kind: 'dir',
          dims: ctx.focus.slice(),
          title: '把' + ctx.target.name + '要的技能栈补上',
          desc: '简历上要出现这些：' + skills.join('、')
        });
      }
    }

    /* ② 短板补齐：自评最弱的两个维度，落在当前年级。
          没填年级时落在大二——既不假设你是零基础，也不假设你快毕业了。
          优先级同上：能力建设没有硬期限，是 mid 不是 high。 */
    var stageYear = ctx.year || '大二';
    ctx.gaps.forEach(function (g) {
      var byGrade = AICS.DIM_GAP_TASKS[g.key];
      var tpl = byGrade && byGrade[ctx.grade];
      if (!tpl) return;
      push(stageYear, {
        id: 'gap-' + g.key,
        pri: 'mid',
        kind: 'gap',
        dims: [g.key],
        title: tpl.title,
        desc: tpl.desc + '　·　你自评 ' + Math.round(g.mine) + ' 分，' + gapBasis(ctx, g)
      });
    });

    return out;
  }

  /* 学习资源库：按分类组织，url 全部指向公开免费资源 */
  AICS.RESOURCES = [
    {
      category: '课程',
      icon: '📚',
      items: [
        { name: '吴恩达 机器学习（Coursera）', desc: 'ML 入门最经典的课，配套作业质量极高', url: 'https://www.coursera.org/learn/machine-learning' },
        { name: '吴恩达 深度学习专项', desc: '五门课覆盖 CNN / RNN / 调参 / 结构化项目', url: 'https://www.coursera.org/specializations/deep-learning' },
        { name: '李宏毅 机器学习（台大）', desc: '中文讲解，紧跟前沿，适合零基础到进阶', url: 'https://speech.ee.ntu.edu.tw/~hylee/ml/2023-spring.php' },
        { name: '李沐 动手学深度学习', desc: '理论 + 代码并重，配套中文书和视频免费', url: 'https://zh.d2l.ai/' },
        { name: '斯坦福 CS231n 视觉', desc: '计算机视觉方向必读，作业含金量高', url: 'https://cs231n.stanford.edu/' },
        { name: '斯坦福 CS224n NLP', desc: 'NLP 与大模型方向的经典课程', url: 'https://web.stanford.edu/class/cs224n/' },
        { name: 'MIT 线性代数（Gilbert Strang）', desc: '把线代讲出直觉，AI 数学基础首选', url: 'https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/' },
        { name: 'CS50 / 廖雪峰 Python 教程', desc: '零基础补编程，中文文档友好', url: 'https://www.liaoxuefeng.com/wiki/1016959663602400' }
      ]
    },
    {
      category: '竞赛',
      icon: '🏆',
      items: [
        { name: 'Kaggle', desc: '国际数据科学竞赛平台，有大量练手赛题和公开 Notebook', url: 'https://www.kaggle.com/competitions' },
        { name: '阿里天池', desc: '国内最活跃的数据竞赛平台，中文友好', url: 'https://tianchi.aliyun.com/competition' },
        { name: '中国大学生计算机设计大赛', desc: '含人工智能赛道，适合大二大三组队参加', url: 'https://jsjds.blcu.edu.cn/' },
        { name: '全国大学生数学建模竞赛', desc: '每年九月，锻炼用数学解决实际问题的能力', url: 'https://www.mcm.edu.cn/' },
        { name: '蓝桥杯', desc: '编程基础类竞赛，大一大二打基础的好选择', url: 'https://dasai.lanqiao.cn/' },
        { name: '挑战杯 / 互联网+', desc: '创新创业类，适合把 AI 项目包装成作品参赛', url: 'https://www.tiaozhanbei.net/' },
        { name: '中国高校计算机大赛（微信小程序 / 大数据）', desc: '企业命题，贴近真实工程场景', url: 'http://www.c4best.cn/' }
      ]
    },
    {
      category: '数据集与平台',
      icon: '🗂️',
      items: [
        { name: 'Hugging Face', desc: '模型与数据集的第一站，也是大模型时代的 GitHub', url: 'https://huggingface.co/' },
        { name: 'Papers with Code', desc: '论文配代码，找 SOTA 和复现的最佳入口', url: 'https://paperswithcode.com/' },
        { name: 'ModelScope 魔搭', desc: '阿里开源模型社区，国内访问快', url: 'https://modelscope.cn/' },
        { name: 'Google Dataset Search', desc: '跨站搜数据集，找真实数据很好用', url: 'https://datasetsearch.research.google.com/' },
        { name: '国家统计局 / 政府开放数据', desc: '做真实场景分析项目的数据来源', url: 'https://data.stats.gov.cn/' }
      ]
    },
    {
      category: '论文与前沿',
      icon: '📄',
      items: [
        { name: 'arXiv', desc: '预印本论文库，AI 前沿都在这里首发', url: 'https://arxiv.org/list/cs.AI/recent' },
        { name: 'CVPR / NeurIPS / ICML / ACL', desc: '四大顶会官网，看录取论文了解方向热点', url: 'https://openaccess.thecvf.com/' },
        { name: 'Connected Papers', desc: '输入一篇论文，自动画出相关论文关系图', url: 'https://www.connectedpapers.com/' },
        { name: '知网 / 万方', desc: '中文文献，写毕设和综述时用（校内免费）', url: 'https://www.cnki.net/' },
        { name: 'AMiner', desc: '学者与机构画像，找导师和研究方向很好用', url: 'https://www.aminer.cn/' }
      ]
    },
    {
      category: '社区与工具',
      icon: '🛠️',
      items: [
        { name: 'GitHub', desc: '代码托管与开源社区，你的项目要放这里', url: 'https://github.com/' },
        { name: 'Google Colab / Kaggle Notebook', desc: '免费 GPU 算力，没有显卡也能训模型', url: 'https://colab.research.google.com/' },
        { name: 'PyTorch 官方教程', desc: '最权威的框架文档，中文版可切换', url: 'https://pytorch.org/tutorials/' },
        { name: 'LeetCode / 牛客网', desc: '刷题与笔试准备，牛客还有大量面经', url: 'https://leetcode.cn/' },
        { name: 'Stack Overflow', desc: '遇到报错先来这里搜，大部分问题已有答案', url: 'https://stackoverflow.com/' },
        { name: '和鲸社区', desc: '国内数据科学社区，有大量中文实战项目', url: 'https://www.heywhale.com/' }
      ]
    }
  ];

})(window.AICS);
