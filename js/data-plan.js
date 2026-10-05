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
      goal: '把数学和编程两块地基砸实，同时搞清楚 AI 到底有哪些方向。',
      color: '#4dd0e1',
      tasks: [
        { id: 'y1t1', pri: 'high', title: '高数 / 线代 / 概率统计拿到良好以上', desc: 'GPA 是保研的硬门槛，大一的课最不能放' },
        { id: 'y1t2', pri: 'high', title: 'Python 从零学到能独立写小项目', desc: '变量、循环、函数、文件、常用库，别停在语法阶段' },
        { id: 'y1t3', pri: 'mid',  title: '装一次 Linux（双系统或虚拟机），习惯命令行', desc: '后面所有 AI 工具链都跑在 Linux 上' },
        { id: 'y1t4', pri: 'mid',  title: '完整了解 AI 的七个就业方向', desc: '知道每个方向做什么、要什么能力，才好定目标' },
        { id: 'y1t5', pri: 'low',  title: '至少参加一次校级竞赛或加入一个技术社团', desc: '大一就开始积累"我做过什么"' },
        { id: 'y1t6', pri: 'mid',  title: '把英语四级拿下，开始读英文技术文档', desc: 'AI 领域的一手资料几乎全是英文' }
      ]
    },
    {
      year: '大二',
      theme: '入门技术',
      goal: '把机器学习吃透，做出第一个能拿得出手的项目。',
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
      goal: '锁定一个方向做深，拿到实习或科研产出，这是四年里最关键的一年。',
      color: '#ffb020',
      tasks: [
        { id: 'y3t1', pri: 'high', title: '确定主攻方向，并制定该方向的能力补齐计划', desc: '用工作台的匹配诊断做依据，别再摇摆' },
        { id: 'y3t2', pri: 'mid',  title: '完整复现一篇方向内经典论文', desc: '复现能力是区分"会用"和"懂"的分水岭' },
        { id: 'y3t3', pri: 'mid',  title: '做一个有真实用户或真实数据的项目', desc: '真实场景的项目远比玩具项目有说服力' },
        { id: 'y3t4', pri: 'mid',  title: '写出一份能过初筛的简历', desc: '一页纸，用成果和数据说话，不要罗列课程' },

        /* ↓ 分岔点一：大三暑假怎么用，两条路完全不同 ↓
           三版都是 high——大三暑假只有一次，而且直接决定大四的起点 */
        { id: 'y3t5', track: 'job', pri: 'high', title: '拿到一段暑期实习',
          desc: '这是秋招最硬的敲门砖，没有之一' },
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
      goal: '把前三年的积累兑现成 offer、录取通知书或毕业设计。',
      color: '#00e5a0',
      tasks: [
        /* ↓ 分岔点二：大四的主线任务，两条路完全不同 ↓
           这三版都是 high——秋招九月就开跑、推免九月底填报、考研十月报名截止，
           都是有硬日期的，错过这一年就没了 */
        { id: 'y4t1', track: 'job', pri: 'high', title: '秋招：投递、笔试、面试全流程冲刺',
          desc: '提前批在 7~8 月就开始了，别等九月' },
        { id: 'y4t1g', track: 'grad', pri: 'high', title: '9 月推免系统填报 / 12 月考研初试',
          desc: '保研的推免系统在 9 月底开放；考研初试一般在 12 月下旬，这是决定性的两场' },
        { id: 'y4t1u', track: 'undecided', pri: 'high', title: '这时候必须定了——考研 10 月报名截止，秋招 9 月就开跑',
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

  /* 资源总条数。文案里凡是要写"共 N 条资源"的地方都现算。
     写死过一次——助手上写"内置 18 个话题"，给知识库补了 4 条之后
     那个数字就成了假的。凡是能现算的条数，就不要抄一遍。 */
  AICS.resourceCount = function () {
    return AICS.RESOURCES.reduce(function (n, c) { return n + c.items.length; }, 0);
  };

  /* 四年任务总数。三条路线都是同一个数（分岔点上每条路各取一版），
     所以不用传路线；但仍然是算出来的，加任务时不用回来改文案。 */
  AICS.roadmapTotal = function () {
    return AICS.roadmapFor('undecided').reduce(function (n, s) { return n + s.tasks.length; }, 0);
  };

  /* 按路线挑出该显示的任务。不传 track 就拿全部（用于统计总量） */
  AICS.roadmapFor = function (track) {
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
