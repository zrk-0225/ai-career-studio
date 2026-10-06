/* ============================================================
 * assistant.js —— AI 职业规划助手
 * ------------------------------------------------------------
 * 两种模式，用户可在设置里切换：
 *   1. 离线模式（默认）：关键词匹配本地知识库，断网也能用，演示零风险
 *   2. 在线模式：调用 OpenAI 兼容接口，把用户的测评画像写进系统提示词，
 *      回答更个性化。调用失败会自动降级回离线模式，不会白屏。
 * 另外提供 md2html，把回答里的 Markdown 渲染成 HTML。
 * ============================================================ */
window.AICS = window.AICS || {};

(function (AICS) {
  'use strict';

  /* ---------- 文本工具 ---------- */

  /* 先转义 HTML，防止用户输入或接口返回的内容破坏页面结构 */
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* 极简 Markdown 渲染：支持标题、粗体、行内代码、有序/无序列表、表格、段落 */
  function md2html(text) {
    var lines = escapeHtml(text).split('\n');
    var html = [];
    var inList = false;
    var i = 0;

    function closeList() {
      if (inList) { html.push('</ul>'); inList = false; }
    }

    /* 行内格式：**粗体** 和 `代码` */
    function inline(s) {
      return s
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    while (i < lines.length) {
      var line = lines[i];

      /* 表格：当前行和下一行都以 | 开头且下一行是分隔行 */
      if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        closeList();
        var head = line.split('|').slice(1, -1).map(function (c) { return c.trim(); });
        var rows = [];
        i += 2;
        while (i < lines.length && /^\s*\|/.test(lines[i])) {
          rows.push(lines[i].split('|').slice(1, -1).map(function (c) { return c.trim(); }));
          i++;
        }
        html.push('<table class="md-table"><thead><tr>');
        head.forEach(function (c) { html.push('<th>' + inline(c) + '</th>'); });
        html.push('</tr></thead><tbody>');
        rows.forEach(function (r) {
          html.push('<tr>');
          r.forEach(function (c) { html.push('<td>' + inline(c) + '</td>'); });
          html.push('</tr>');
        });
        html.push('</tbody></table>');
        continue;
      }

      /* 标题 */
      var h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        closeList();
        var level = Math.min(4, h[1].length + 2);
        html.push('<h' + level + '>' + inline(h[2]) + '</h' + level + '>');
        i++;
        continue;
      }

      /* 列表项 */
      if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
        if (!inList) { html.push('<ul>'); inList = true; }
        html.push('<li>' + inline(line.replace(/^\s*(?:[-*]|\d+\.)\s+/, '')) + '</li>');
        i++;
        continue;
      }

      /* 空行 */
      if (!line.trim()) { closeList(); i++; continue; }

      /* 普通段落 */
      closeList();
      html.push('<p>' + inline(line) + '</p>');
      i++;
    }
    closeList();
    return html.join('');
  }

  /* 把知识库里的占位符替换成用户自己的数据 */
  function fillTemplate(text, analysis, profile) {
    profile = profile || {};
    var map = {
      name: profile.name || '同学',
      year: profile.year || '当前',
      /* 题数也现算。知识库里写死的那个数字已经跟别处不一致过一次了 */
      questions: AICS.Calc.totalQuestions(),
      /* 一句完整的"你匹配到哪一档"。
         这里原来是 {{top}}（方向名）和 {{topScore}}（分数）两个占位符，
         知识库模板写成"…的结果是 **{{top}}** 匹配度最高（{{topScore}} 分）"。
         后来 topScore 改成填档位名，模板没跟着改，于是回答里出现
         "（第 1 档（4 个方向并列） 分）"这种嵌套括号加断句错乱。
         改成填一整句，模板那边就不用再包括号、也不用补"分"字。 */
      matchLine: '做完测评，去「匹配诊断」看结果。那是按你的答案算出来的，比凭感觉猜靠谱。',
      weak: '暂未测评',
      gapList: '完成测评后这里会列出你的优先补齐项'
    };
    if (analysis) {
      var band = analysis.topBand;
      var names = band.items.map(function (r) { return r.name; });
      map.matchLine = names.length > 1
        ? '你在「匹配诊断」里的结果是 **' + band.name + '**（这一档有 ' + names.length +
          ' 个方向：' + names.join('、') + '），这是一个客观起点。'
        : '你在「匹配诊断」里的结果是 **' + band.name + '**，也就是 ' + names[0] +
          '，这是一个客观起点。';
      map.weak = analysis.weakest.name;
      map.gapList = analysis.priority.length
        ? analysis.priority.map(function (g) { return g.name + '（差 ' + g.gap + ' 分）'; }).join('、')
        /* 全站统一叫「目标方向」。这里原来写的是「目标岗位」——
           本工具里并没有"岗位"这个设定，两套说法容易让人以为是两回事 */
        : '你的能力已经达到目标方向的要求，接下来重点是保持和做深项目';
    }
    return String(text).replace(/\{\{(\w+)\}\}/g, function (whole, key) {
      return map[key] !== undefined ? map[key] : whole;
    });
  }

  /* ---------- 离线匹配 ---------- */

  /* 给一条知识库打关键词命中分，命中的词越长说明越具体，权重越高 */
  function scoreEntry(question, entry) {
    var text = question.toLowerCase();
    var score = 0;
    entry.keywords.forEach(function (kw) {
      if (text.indexOf(kw.toLowerCase()) >= 0) {
        score += kw.length >= 3 ? 3 : (kw.length === 2 ? 2 : 1);
      }
    });
    /* 标题里也命中的话额外加分 */
    if (text.indexOf(entry.title.toLowerCase()) >= 0) score += 3;
    return score;
  }

  /* 在知识库里找最匹配的一条，返回 null 表示没匹配上 */
  function findEntry(question) {
    var best = null, bestScore = 0;
    AICS.KB.forEach(function (entry) {
      var s = scoreEntry(question, entry);
      if (s > bestScore) { bestScore = s; best = entry; }
    });
    return bestScore > 0 ? { entry: best, score: bestScore } : null;
  }

  /* 没匹配上时的兜底回答，顺便把能聊的话题列出来 */
  function fallbackAnswer() {
    var topics = AICS.KB.slice(0, 12).map(function (e) { return '- ' + e.title; }).join('\n');
    return '这个问题我暂时没有可靠的信息来源，给不出准确回答。\n\n' +
      '下面这些话题我准备得比较充分：\n\n' + topics +
      '\n\n或者换个说法再问一次，我会尽力帮你分析。';
  }

  /* 把某个方向的资料整理成一段回答，用于"这个方向怎么样"这类提问 */
  function directionBrief(dir, analysis) {
    var degree = AICS.Directions.degreeOf(dir);
    /* 路径要按用户当前的毕业去向取，不然选了读研的人问算法工程师，
       助手会连着"准备秋招"一起答出来，和四年规划页对不上 */
    var track = AICS.resolveTrack(AICS.Store.get());
    var lines = ['**' + dir.name + '**（' + dir.sub + '）', '', dir.summary, '',
      '- **学历建议**：' + degree.text + '——' + degree.desc,
      '- **薪资参考**：' + dir.salary,
      '- **能力门槛**：' + dir.threshold,
      '- **需要掌握**：' + dir.skills.join('、'),
      '- **主要去向**：' + dir.companies.join('、'),
      '',
      '**推荐准备路径**' + (dir.pathBranch ? '（按你的毕业去向「' + track.name + '」，大三暑假和大四两步会跟着变）' : '') + '：'];
    AICS.pathFor(dir, track.key).forEach(function (p, i) { lines.push((i + 1) + '. ' + p); });
    lines.push('', '**要注意的地方**：' + dir.risk);

    /* 如果这个方向正好落在第一档，补一句针对性的话。
       不能再说"这是你匹配度最高的方向（X 分）"——档内几个方向的差距
       小于测评误差，挑其中一个说"最高"是在制造不存在的区分度。 */
    if (analysis && analysis.topBand.items.some(function (r) { return r.id === dir.id; })) {
      var band = analysis.topBand;
      lines.push('', band.items.length > 1
        ? '顺便说一句：这个方向和你第一档里的另外 ' + (band.items.length - 1) +
          ' 个方向（' + band.items.filter(function (r) { return r.id !== dir.id; })
            .map(function (r) { return r.name; }).join('、') +
          '）在你这里没有明显差别，选哪个该看别的因素。'
        : '顺便说一句：这是你第一档的方向，比第二档高出一截。');
      /* 这里必须用「当前问的这个方向」自己的缺口，不能用 analysis.priority。
         后者是照着用户的目标方向（或第一名）算的——同档里换一个方向问，
         补的却是另一个方向的短板，答非所问。 */
      var mine = analysis.ranked.filter(function (r) { return r.id === dir.id; })[0];
      var dirGaps = mine ? mine.gaps.filter(function (g) { return g.gap > 0; })
        .sort(function (x, y) { return y.gap - x.gap; }).slice(0, 3) : [];
      if (dirGaps.length) {
        lines.push('要往这个方向走，先把这几项补上：' +
          dirGaps.map(function (g) { return g.name + '（差 ' + g.gap + ' 分）'; }).join('、') + '。');
      }
    }
    return lines.join('\n');
  }

  /* 用户用了"这个""它"之类的指代词，而当前页面正好在看某个方向时，
     直接拿该方向的资料来回答，比关键词匹配准得多 */
  function contextAnswer(question, analysis, profile) {
    var ctx = AICS.PageContext || {};
    if (!ctx.directionId) return null;
    if (!/这个|它|该方向|此方向|这个方向|这个岗位/.test(question)) return null;

    var dir = AICS.Directions.byId(ctx.directionId);
    if (!dir) return null;

    return {
      title: '关于「' + dir.name + '」',
      text: directionBrief(dir, analysis),
      source: 'offline'
    };
  }

  /* ---------- 认识你数据的回答 ----------

     有一类问题不用查知识库，拿你自己的工作台数据就能算出来：
     "我离目标还差多少""先补什么""还剩多少时间""我进度到哪了"。

     这类问题走关键词匹配反而答不准——知识库讲的是通用知识
     （某个方向是干什么的、怎么准备实习），而这些问题的答案
     只跟你一个人有关。放在 KB 匹配之前试一遍。 */

  function needAssess() {
    return '这个问题得看了你的测评结果才能答，现在还缺这份数据。\n\n' +
      '去做一遍「自我认知」（' + AICS.Calc.totalQuestions() + ' 题，大概 12 分钟）。' +
      '做完再问我一遍，我就能拿着你的兴趣、能力和偏好算给你看了。';
  }

  /* 参照物的一句话：目标方向优先，没有就用第一档的最低保底 */
  function basisOf(analysis) {
    var pf = analysis.priorityFor || {};
    if (pf.isTarget) return '你的目标方向「' + pf.name + '」';
    if (pf.bandName) {
      return '第一档里要求最低的那个方向';
    }
    return '你现在的情况';
  }

  /* ① "我这个分数能上 X 吗" → 差多少 */
  function gapAnswer(analysis) {
    if (!analysis) return needAssess();

    var pri = analysis.priority || [];
    var head = '按' + basisOf(analysis) + '来看：';
    if (!pri.length) {
      return head + '\n\n**你要求的几项能力都已经达标了。**\n\n' +
        '接下来把项目做深、做出能讲的东西。申请的时候，一个讲得透的项目' +
        '比多考几分管用。';
    }

    return head + '\n\n' + pri.map(function (g) {
      return '- **' + g.name + '**：你自评 ' + g.mine + ' 分，要求 ' + g.need +
        ' 分，还差 **' + g.gap + ' 分**';
    }).join('\n') +
    '\n\n这些分数都是你自评的，与岗位要求对比得出。可以用来看大体方向，不适合当作结论。\n\n' +
    '每一项具体怎么补，在「匹配诊断」的差距明细里。';
  }

  /* ② "我该先补什么" → 直接给动作 */
  function priorityAnswer(analysis) {
    if (!analysis) return needAssess();

    var pri = (analysis.priority || []).slice(0, 2);
    if (!pri.length) {
      return basisOf(analysis) + '要的能力你都够了。\n\n' +
        '接下来把做过的项目整理成能讲的东西：一份 README、一段三分钟的讲解、' +
        '一张架构图。面试和复试问的都是这个。';
    }

    return '按' + basisOf(analysis) + '，优先补齐的是这 ' + pri.length + ' 项：\n\n' +
      pri.map(function (g, i) {
        return (i + 1) + '. **' + g.name + '**（还差 ' + g.gap + ' 分）：' +
          (AICS.DIM_ADVICE[g.key] || '');
      }).join('\n\n') +
      '\n\n「四年规划」里标着「补齐短板」的那几项，就是照这个加的，勾着往下做就行。' +
      '做完在那一行点一下"做到什么程度了"，下次做测评我会提醒你重新估一下。';
  }

  /* ③ "我还有多少时间" → 用年级和月份推算 */
  function timeAnswer(profile) {
    var pos = AICS.termPosition(profile.year);
    if (!pos) {
      return '我还不知道你读大几，算不出来。\n\n' +
        '去右上角「设置」里把年级填上。它不光影响时间推算，' +
        '还会改变匹配算法的权重，大一和大四看的重点不一样。';
    }

    var now = new Date();
    var left = AICS.MILESTONES.filter(function (ms) {
      return AICS.monthsUntil(ms.abs, pos) >= 0;
    });

    var lines = ['按 9 月开学推算，你现在是 **' + pos.label + '**。', ''];

    if (!left.length) {
      lines.push('四年里的几个关键节点都已经过去了。');
    } else {
      var next = left[0];
      var n = AICS.monthsUntil(next.abs, pos);
      lines.push('最近的一个节点是 **' + next.name + '**，还有 **' + n + ' 个月**（' +
        AICS.monthLabel(now, n) + '）。' + next.hint + '。');
      if (left.length > 1) {
        lines.push('');
        lines.push('再往后：' + left.slice(1).map(function (ms) {
          return ms.name + '（' + AICS.monthsUntil(ms.abs, pos) + ' 个月）';
        }).join('、') + '。');
      }
    }

    lines.push('');
    lines.push('这个推算是按"国内大学 9 月开学"算的。春季入学或者休过学的同学，' +
      '位置会偏，去设置里核对一下年级。');
    lines.push('');
    lines.push('完整的时间轴在「四年规划」页右上角切到「时间轴」视图。');
    return lines.join('\n');
  }

  /* ④ "我进度到哪了" → 规划完成度 + 实践记录 */
  function progressAnswer() {
    var state = AICS.Store.get();
    var roadmap = state.roadmap || {};
    var stages = AICS.planFor(state);

    var total = 0, done = 0;
    stages.forEach(function (s) {
      s.tasks.forEach(function (t) { total++; if (roadmap[t.id]) done++; });
    });

    var lines = ['四年规划：**' + done + ' / ' + total + '** 项已完成（' +
      Math.round(total ? (done / total) * 100 : 0) + '%）。', ''];

    stages.forEach(function (s) {
      var d = s.tasks.filter(function (t) { return roadmap[t.id]; }).length;
      lines.push('- ' + s.year + '：' + d + ' / ' + s.tasks.length);
    });

    /* 实践记录：这条是"勾了"和"真做过"的区别，值得单独说。

       practiceOf 可能返回 null（那个维度的记录是空的），所以先过滤再拼。
       存档里理论上不会有空记录——store 的清洗会丢掉计数为 0 的——
       但那是靠数据不变式兜着，这里不该跟着依赖它。 */
    var prac = state.practice || {};
    var pracLines = Object.keys(prac).map(function (k) {
      var p = AICS.practiceOf(k);
      if (!p) return '';
      var d = AICS.DIMS.filter(function (x) { return x.key === k; })[0];
      return (d ? d.name : k) + '（' + p.text + '）';
    }).filter(Boolean);

    if (pracLines.length) {
      lines.push('');
      lines.push('另外你记过这些实践：' + pracLines.join('、') + '。');
      lines.push('');
      lines.push('这些比勾选本身有分量。下次做测评时，我会拿它提醒你重新估一下' +
        '对应的那几项能力。');
    } else {
      lines.push('');
      lines.push('还没有实践记录。勾完任务之后，那一行会问你"做到什么程度了"，' +
        '点一下我就记住了。');
    }

    return lines.join('\n');
  }

  /* 按提问的措辞挑一类来答。都不像就返回 null，交给知识库去处理 */
  function dataAnswer(question, analysis, profile) {
    var q = String(question || '');

    if (/能上|够不够|差多少|有希望|够得着|能不能进|够格|还差什么/.test(q)) {
      return { title: '离目标还差多少', text: gapAnswer(analysis), source: 'offline' };
    }
    if (/先补|先学|最该|从哪开始|怎么补|优先补|先做哪个|补什么/.test(q)) {
      return { title: '先补什么', text: priorityAnswer(analysis), source: 'offline' };
    }
    /* 这里刻意不收「什么时候」——太泛了。
       "什么时候投实习"「什么时候该准备考研」这类问的是**该做什么**，
       知识库里答得更准；收进来的话全被换算成一句"还剩 N 个月"。 */
    if (/还有多久|多少时间|来得及|时间够|剩多少时间|还剩多久|读大几|我大几/.test(q)) {
      return { title: '你还有多少时间', text: timeAnswer(profile), source: 'offline' };
    }
    if (/进度|完成了多少|做了多少|到哪了|做了几项/.test(q)) {
      return { title: '你的进度', text: progressAnswer(), source: 'offline' };
    }
    return null;
  }

  /* 离线模式的完整回答流程 */
  function answerOffline(question, analysis, profile) {
    /* 先看能不能用当前页面的上下文回答 */
    var ctxAns = contextAnswer(question, analysis, profile);
    if (ctxAns) return ctxAns;

    /* 再看是不是"拿你自己的数据就能算"的那几类问题。
       放在知识库匹配之前：这些问题的答案在你自己的数据里，
       让关键词匹配去猜只会答成一段通用建议。 */
    var dataAns = dataAnswer(question, analysis, profile);
    if (dataAns) return dataAns;

    var hit = findEntry(question);
    var title = hit ? hit.entry.title : '换个说法再试试';
    var body = hit ? hit.entry.answer : fallbackAnswer();
    var text = fillTemplate(body, analysis, profile);

    /* 测评没做完的话，先提醒一句，因为很多回答依赖画像数据 */
    if (!analysis && hit && /\{\{(top|weak|gapList)\}\}/.test(hit.entry.answer)) {
      text = '> 提示：你还没完成自我认知测评，下面的回答缺少你的个人数据。做完测评后我再回答一次会更贴合你。\n\n' + text;
    }
    return { title: title, text: text, source: 'offline' };
  }

  /* ---------- 在线模式 ---------- */

  /* 拼接 OpenAI 兼容的 chat/completions 地址，兼容用户填 /v1 或不填 */
  function buildEndpoint(base) {
    var b = (base || '').trim().replace(/\/+$/, '');
    if (!b) return '';
    if (/\/v1$/i.test(b)) return b + '/chat/completions';
    if (/\/chat\/completions$/i.test(b)) return b;
    return b + '/v1/chat/completions';
  }

  /* 当前页面名称，用来告诉模型用户此刻在看什么。
     这份表必须覆盖 AICS.Views 里的每一个路由，否则用户在那一页提问时，
     系统提示词里会直接塞进英文路由名（fallback 是 `|| ctx.route`）。
     之前就漏了 guide——在「使用指引」页提问会写成"【用户当前正在看】guide"。
     app.js 的启动自检现在会把这张表也一起核对。 */
  var ROUTE_NAMES = {
    guide: '使用指引',
    dashboard: '概览',
    assess: '自我认知测评',
    directions: '方向图谱',
    match: '匹配诊断',
    compare: '方向对比',
    growth: '成长曲线',
    roadmap: '四年规划',
    kanban: '任务看板',
    assistant: 'AI 助手',
    resources: '资源库',
    report: '我的规划书',
    about: '关于作者'
  };

  /* 把用户的测评结果整理成系统提示词，让模型的回答真正"私人定制" */
  function buildSystemPrompt(analysis, profile) {
    var lines = [
      '你是"AI 领航"职业规划工作台内置的生涯规划助手，服务对象是人工智能专业的在校本科生。',
      '回答要求：务实、具体、可执行；用 markdown 组织；不要空话套话；不确定的地方要说不确定；单次回答控制在 500 字以内。'
    ];

    if (profile && (profile.name || profile.school || profile.year)) {
      lines.push('\n【学生基本信息】');
      if (profile.name) lines.push('- 称呼：' + profile.name);
      if (profile.school) lines.push('- 学校：' + profile.school);
      if (profile.year) lines.push('- 年级：' + profile.year);
      if (profile.major) lines.push('- 专业：' + profile.major);
    }

    /* 当前浏览的页面：用户问"这个方向怎么样"时，模型才知道指的是哪个 */
    var ctx = AICS.PageContext || {};
    if (ctx.route) {
      var ctxLine = '\n【用户当前正在看】' + (ROUTE_NAMES[ctx.route] || ctx.route);
      if (ctx.directionId) {
        var dir = AICS.Directions.byId(ctx.directionId);
        if (dir) ctxLine += '，正在查看的方向是「' + dir.name + '」（' + dir.sub + '）';
      }
      ctxLine += '。如果用户的提问里有"这个""它"这类指代，优先理解为指上面这个方向或页面。';
      lines.push(ctxLine);
    }

    if (analysis) {
      var abilityText = AICS.DIMS.map(function (d) {
        return d.name + ' ' + (analysis.ability[d.key] || 0);
      }).join('、');
      lines.push('\n【能力自评（满分 100）】' + abilityText);
      lines.push('【最短板】' + analysis.weakest.name);
      lines.push('\n【方向匹配度排序】');
      analysis.ranked.slice(0, 4).forEach(function (r, idx) {
        lines.push((idx + 1) + '. ' + r.name + ' ' + r.total + ' 分（能力 ' +
          r.abilityScore + ' / 兴趣 ' + r.interestScore + ' / 偏好 ' + r.prefScore + '）');
      });
      if (analysis.priority.length) {
        lines.push('\n【优先补齐】' + analysis.priority.map(function (g) {
          return g.name + '（差 ' + g.gap + ' 分）';
        }).join('、'));
      }
      lines.push('\n回答时请结合以上数据，给出针对这个学生的具体建议，不要给通用套话。');
    } else {
      lines.push('\n注意：这位学生还没有完成测评，回答时不要编造他的数据，可以建议他先去做测评。');
    }

    return lines.join('\n');
  }

  /* 调用真实大模型，带 30 秒超时；任何异常都抛出去由上层降级处理 */
  function callRealAPI(question, analysis, profile, settings) {
    var endpoint = buildEndpoint(settings.apiBase);
    if (!endpoint) return Promise.reject(new Error('接口地址为空'));

    var controller = new AbortController();
    /* 30 秒超时定时器。无论成功还是失败都要清掉——
       原来只在成功分支里 clearTimeout，网络失败时定时器会挂到 30 秒，
       然后对一个早就结束的请求调 abort()。 */
    var timer = setTimeout(function () { controller.abort(); }, 30000);
    function stopTimer() { clearTimeout(timer); }

    /* 带上最近几轮对话，让模型有上下文。
       但调用方是先 pushChat 再调这里的，所以 history 最后一条就是
       当前这一问；下面再 concat 一次，请求体里会出现连着两条一模一样的
       user 消息（实测过）。先把结尾那条同文的摘掉。 */
    var history = (AICS.Store.pick('chat') || []).slice(-6).map(function (m) {
      return { role: m.role === 'user' ? 'user' : 'assistant', content: m.text };
    });
    var tail = history[history.length - 1];
    if (tail && tail.role === 'user' && tail.content === question) history.pop();

    var messages = [{ role: 'system', content: buildSystemPrompt(analysis, profile) }]
      .concat(history)
      .concat([{ role: 'user', content: question }]);

    return fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + settings.apiKey
      },
      body: JSON.stringify({
        model: settings.apiModel || 'deepseek-chat',
        messages: messages,
        temperature: 0.7,
        stream: false
      }),
      signal: controller.signal
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error('接口返回 ' + res.status + '：' + t.slice(0, 200));
        });
      }
      return res.json();
    }).then(function (data) {
      var content = data && data.choices && data.choices[0] &&
        data.choices[0].message && data.choices[0].message.content;
      if (!content) throw new Error('接口返回内容为空');
      return { title: 'AI 在线回答', text: content, source: 'api' };
    }).then(function (v) {
      stopTimer();
      return v;
    }, function (err) {
      stopTimer();
      throw err;
    });
  }

  /* ---------- 对外统一入口 ---------- */

  /* 提问并拿到回答。永远 resolve，不会 reject，保证界面不会卡住 */
  function ask(question) {
    var state = AICS.Store.get();
    var analysis = AICS.Calc.analyse(state);
    var profile = state.profile;
    var settings = state.settings || {};

    if (settings.useApi && settings.apiKey && settings.apiBase) {
      /* 这里必须包一层 Promise.resolve().then()，不能直接 return
         callRealAPI(...)。因为 callRealAPI 在返回 Promise 之前就会做
         buildEndpoint(settings.apiBase) —— 如果 apiBase 不是字符串
         （导入的脏备份里可能有），它当场抛异常。那个异常发生在
         ask() 内部、Promise 还没交出去的时候，调用方的 .then/.catch
         一个都接不住，界面就永远停在"正在思考"那三个点上。
         包成 Promise 之后，同步异常也会变成一次 rejection，
         下面的 .catch 就能兜住并降级到离线回答。 */
      return Promise.resolve()
        .then(function () { return callRealAPI(question, analysis, profile, settings); })
        .catch(function (err) {
          console.warn('[assistant] 在线接口调用失败，已降级到离线模式：', err);
          var offline = answerOffline(question, analysis, profile);
          offline.notice = '在线接口调用失败（' + (err.message || err) + '），已自动切换到离线知识库回答。';
          return offline;
        });
    }
    return Promise.resolve(answerOffline(question, analysis, profile));
  }

  AICS.Assistant = {
    ask: ask,
    answerOffline: answerOffline,
    buildSystemPrompt: buildSystemPrompt,
    buildEndpoint: buildEndpoint,
    fillTemplate: fillTemplate,
    md2html: md2html,
    escapeHtml: escapeHtml,
    /* 暴露给 app.js 的启动自检，用来核对它和实际路由是否对齐 */
    routeNames: ROUTE_NAMES
  };

})(window.AICS);
