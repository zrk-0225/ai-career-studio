/* ============================================================
 * views/report.js —— 个人职业规划书
 * ------------------------------------------------------------
 * 把前面所有模块的数据汇总成一份完整报告，支持四种出口：
 *   - 导出 Markdown（.md）
 *   - 导出 Word（.doc，用 HTML 包装，Word / WPS 都能正常打开）
 *   - 打印 / 另存为 PDF（走浏览器打印，零依赖）
 *   - 数据备份与恢复（.json）
 * 这一页是最终交付物，也是拿去参赛时最能打的部分。
 * ============================================================ */
window.AICS = window.AICS || {};
AICS.Views = AICS.Views || {};

(function (AICS) {
  'use strict';

  var UI = AICS.UI;

  /* 任务来源的标记，规划书的 Markdown 版和 HTML 版共用。
     通用任务不加标记——全篇绝大多数都是通用的，加了反而看不清重点。 */
  var KIND_LABEL = { dir: '方向专项', gap: '补齐短板' };

  function dateStr() {
    var d = new Date();
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* 取目标方向：优先用户锁定的，否则用匹配度第一名 */
  function targetOf(state, analysis) {
    if (!analysis) return null;
    var id = state.profile.targetId;
    return analysis.ranked.filter(function (r) { return r.id === id; })[0] || analysis.top;
  }

  /* 上面那个"否则用匹配度第一名"是系统推荐，不是用户选的目标。
     这份文档是要导出去交给老师的，不能把推荐说成他自己定的方向——
     所以凡是要出现「目标方向」四个字的地方，都得先问一句这个。 */
  function targetIsPicked(state) {
    return !!((state.profile || {}).targetId);
  }

  /* 「目标方向」/「推荐方向」两个说法按情况取 */
  function targetLabel(state) {
    return targetIsPicked(state) ? '目标方向' : '推荐方向';
  }

  /* 摘要里那段总述。
     核心是把"你属于第几档"讲清楚，而不是造一个"最匹配方向"出来。
     同一段文字要同时供页面（HTML）、Word（HTML）和 Markdown 三种出口使用，
     所以强调语法按 mode 切换。 */
  function bandParagraph(state, analysis, target, band, mode) {
    var isMd = (mode === 'md');
    var b = function (t) { return isMd ? '**' + t + '**' : '<strong>' + UI.esc(t) + '</strong>'; };
    var e = function (t) { return isMd ? t : UI.esc(t); };
    var names = band.items.map(function (r) { return r.name; });
    var picked = targetIsPicked(state);

    /* 用户手动选的目标方向，可能根本不在第一档里。
       之前的写法默认了"目标 = 第一档里的某一个"，于是出现两种错话：
         · 第一档只有 1 个方向时，写成"你已把 <第一档那一个> 设为目标方向"，
           而正文第六章写的是他自己选的那个，前后打脸；
         · 第一档有多个方向时，写成"以其中的 <目标>"，但目标并不在列举的
           这几个里，"其中的"是错的。
       这份文档是要交给老师的，替学生宣称一个他没做过的选择比写得不漂亮严重得多。 */
    var targetInBand = band.items.some(function (r) { return r.id === target.id; });

    if (analysis.bands.length === 1) {
      return '综合兴趣倾向、能力现状与工作偏好三项测评，七个方向的匹配度全部落在同一档，' +
             '本次作答没有把方向明显区分开。这通常说明你的偏好还比较平均，' +
             '或者确实还没到需要定方向的阶段——先广泛了解各个方向，比纠结排名更有用。';
    }

    /* 目标方向不在第一档：先说清楚测评算出来的是什么，再说这份文档按谁展开 */
    if (picked && !targetInBand) {
      var topText = names.length === 1
        ? '匹配度最高的是 ' + b(names[0]) + '。'
        : '你属于 ' + b(band.name) + '，这一档有 ' + b(names.length + ' 个方向') + '：' +
          names.map(e).join('、') + '。它们的匹配度没有实质差别，所以本规划书不给它们排名次。';
      return '综合三项测评，' + topText +
             '不过你已经在「匹配诊断」里把 ' + b(target.name) +
             ' 设为目标方向，本规划书按你的选择展开后续分析——' +
             '系统推荐只是一个参考起点，你自己更了解你愿意长期做什么。';
    }

    if (names.length === 1) {
      return '综合三项测评，' + (picked ? '你已把 ' : '匹配度最高的是 ') + b(names[0]) +
             (picked ? ' 设为目标方向。' : '。它比第二档高出 ' + analysis.bandGap +
               ' 分以上，区分度足够，可以认真考虑。') +
             '本规划书以它为主线展开后续分析。';
    }

    return '综合三项测评，你属于 ' + b(band.name) + '，这一档有 ' + b(names.length + ' 个方向') + '：' +
           names.map(e).join('、') + '。' +
           '它们的匹配度没有实质差别——分差都在 ' + analysis.bandGap +
           ' 分以内，相当于一道自评题的出入，所以本规划书不给它们排名次。' +
           '本规划书以其中的 ' + b(target.name) + ' 作为主攻方向展开后续分析' +
           (picked ? '（你已手动确认）。' : '（这是系统推荐，你还没有手动确认，可在「匹配诊断」里更换）。');
  }

  /* ---------- Markdown 版 ---------- */

  /* 塞进 Markdown 表格单元格的文本要先过一道。
     姓名、学校、任务标题都是用户自己打的：里面出现一个 `|` 就会把那一行
     拆成多余的列，出现换行会把整张表截断。
     Word 版有 esc() 兜底，Markdown 版原来完全没有处理。 */
  function mdCell(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/[\r\n]+/g, ' ')     // 换行会把表格截断
      .replace(/\|/g, '\\|');       // 竖线会被当成列分隔符
  }

  function generateMarkdown(state, analysis) {
    var p = state.profile;
    var L = [];

    L.push('# 人工智能专业职业生涯规划书');
    L.push('');
    L.push('> 由「AI 领航 · 人工智能专业职业生涯规划学习实践工作台」生成');
    L.push('> 生成日期：' + dateStr());
    L.push('');

    L.push('## 一、基本信息');
    L.push('');
    L.push('| 项目 | 内容 |');
    L.push('| --- | --- |');
    L.push('| 姓名 | ' + mdCell(p.name || '（未填写）') + ' |');
    L.push('| 学校 | ' + mdCell(p.school || '（未填写）') + ' |');
    L.push('| 专业 | ' + mdCell(p.major || '人工智能') + ' |');
    L.push('| 年级 | ' + mdCell(p.year || '（未填写）') + ' |');
    L.push('');

    if (analysis) {
      /* 匹配结论放在最前面，而且给的是"档位"不是"第几名"。
         这份文档是要交给老师的，不能拿一个重答一次就会变的名次当结论。 */
      var mdBand = analysis.topBand;
      L.push('> **匹配结果：' + mdBand.name + '**　　' +
        bandParagraph(state, analysis, targetOf(state, analysis), mdBand, 'md'));
      L.push('');
    }

    if (!analysis) {
      L.push('## 二、说明');
      L.push('');
      L.push('本规划书尚未包含测评数据。请先完成「自我认知测评」中的 ' +
        AICS.Calc.totalQuestions() + ' 道题，');
      L.push('系统会自动生成方向匹配度、差距分析和推荐行动路线。');
      L.push('');
      return L.join('\n');
    }

    /* 匹配权重说明 */
    var w = analysis.weights;
    L.push('## 二、匹配度计算依据');
    L.push('');
    L.push('本规划书的推荐结果由三项加权得出，权重按年级自动调整：');
    L.push('');
    L.push('| 分项 | 权重 | 含义 |');
    L.push('| --- | --- | --- |');
    L.push('| 能力匹配度 | ' + Math.round(w.ability * 100) + '% | 你的自评能力与岗位要求的加权差距 |');
    L.push('| 兴趣匹配度 | ' + Math.round(w.interest * 100) + '% | 兴趣六型画像与岗位画像的余弦相似度 |');
    L.push('| 偏好匹配度 | ' + Math.round(w.pref * 100) + '% | 工作方式三轴与岗位节奏的贴合度 |');
    L.push('');
    L.push('当前年级为「' + (analysis.year || '未填写') + '」，' + analysis.yearReason + '。');
    L.push('');

    /* 能力自评 */
    L.push('## 三、能力现状自评');
    L.push('');
    L.push('| 能力维度 | 自评得分 | 说明 |');
    L.push('| --- | --- | --- |');
    AICS.DIMS.forEach(function (d) {
      L.push('| ' + d.name + ' | ' + (analysis.ability[d.key] || 0) + ' | ' + d.desc + ' |');
    });
    L.push('');
    L.push('**当前最短板：' + analysis.weakest.name + '**（自评 ' +
      (analysis.ability[analysis.weakest.key] || 0) + ' 分）');
    L.push('');

    /* 兴趣画像 */
    L.push('## 四、兴趣倾向画像');
    L.push('');
    L.push('| 兴趣类型 | 倾向程度 | 含义 |');
    L.push('| --- | --- | --- |');
    AICS.INTEREST_TYPES.forEach(function (t) {
      var v = Math.round((analysis.interest[t.key] || 0) * 100);
      L.push('| ' + t.name + ' | ' + v + '% | ' + t.desc + ' |');
    });
    L.push('');

    /* 匹配度分档。
       不再输出"第 1 名 / 第 2 名"——实测第1名和第2名中位只差 0.7~1.4 分，
       同一个人重答有 19%~40% 的概率换人。名次是假精度，档位才是稳的。
       分数也取整，不保留小数。 */
    L.push('## 五、就业方向匹配度分档');
    L.push('');
    L.push('分差在 ' + analysis.bandGap + ' 分以内的方向算作同一档，档内不分先后。');
    L.push('');
    /* 档位被放宽过就写明原因。这份文档是交出去的，
       "为什么这次分得比平时粗"必须有据可查，不能让人觉得是随手定的。 */
    if (analysis.consistency && analysis.bandGap > AICS.Calc.BAND_GAP) {
      L.push('> 注：本次作答的一致性为 ' + analysis.consistency.score + ' 分（' +
        analysis.consistency.text + '），因此档位宽度由默认的 ' +
        AICS.Calc.BAND_GAP + ' 分放宽到 ' + analysis.bandGap + ' 分。');
      L.push('');
    }
    L.push('| 档位 | 方向 | 匹配度 | 能力 | 兴趣 | 偏好 | 学历建议 | 评价 |');
    L.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
    analysis.bands.forEach(function (b) {
      b.items.forEach(function (r) {
        L.push('| ' + b.name + ' | ' + r.name + ' | ' + Math.round(r.total) + ' | ' +
          Math.round(r.abilityScore) + ' | ' + Math.round(r.interestScore) + ' | ' +
          Math.round(r.prefScore) + ' | ' +
          AICS.Directions.degreeOf(r.dir).text + ' | ' + UI.scoreLabel(r.total) + ' |');
      });
    });
    L.push('');

    /* 目标方向 */
    var target = targetOf(state, analysis);
    L.push('## 六、' + targetLabel(state) + '：' + target.name);
    L.push('');
    if (!targetIsPicked(state)) {
      L.push('> 注：这个方向是系统按匹配度推荐的第一名，你还没有在「匹配诊断」里手动确认。');
      L.push('> 如果认同，去那一页点「设为目标方向」；如果不认同，可以在排行里另选一个。');
      L.push('');
    }
    L.push('- 细分方向：' + target.dir.sub);
    L.push('- 匹配度：' + Math.round(target.total) + ' 分（' + UI.scoreLabel(target.total) + '）');
    L.push('- 学历建议：' + AICS.Directions.degreeOf(target.dir).text + '——' + AICS.Directions.degreeOf(target.dir).desc);
    L.push('- 薪资参考：' + target.dir.salary);
    L.push('- 能力门槛：' + target.dir.threshold);
    L.push('');
    L.push('### 6.1 方向说明');
    L.push('');
    L.push(target.dir.summary);
    L.push('');
    L.push('### 6.2 能力差距分析');
    L.push('');
    L.push('| 能力维度 | 我的现状 | 岗位要求 | 差距 |');
    L.push('| --- | --- | --- | --- |');
    target.gaps.forEach(function (g) {
      var gapText = g.gap > 0 ? ('还差 ' + g.gap + ' 分') : ('已达标，高出 ' + g.surplus + ' 分');
      L.push('| ' + g.name + ' | ' + g.mine + ' | ' + g.need + ' | ' + gapText + ' |');
    });
    L.push('');

    var pri = target.gaps.filter(function (g) { return g.gap > 0; })
      .sort(function (a, b) { return b.gap - a.gap; }).slice(0, 3);
    if (pri.length) {
      L.push('### 6.3 优先补齐的三项能力');
      L.push('');
      pri.forEach(function (g, i) {
        L.push((i + 1) + '. **' + g.name + '**（还差 ' + g.gap + ' 分）');
        L.push('   ' + (AICS.DIM_ADVICE[g.key] || ''));
      });
      L.push('');
    }

    /* 学习路径。第七章也要按路线取——否则规划书前面写着"升学深造"，
       第七章却让人"准备秋招"，一份文档里自相矛盾。 */
    var track = AICS.resolveTrack(state);
    L.push('## 七、推荐学习路径');
    L.push('');
    if (target.dir.pathBranch) {
      L.push('> 其中「大三暑假」和「大四」两步，按你的毕业去向「' + track.name + '」给出。');
      L.push('');
    }
    AICS.pathFor(target.dir, track.key).forEach(function (step, i) {
      L.push((i + 1) + '. ' + step);
    });
    L.push('');
    L.push('**需要掌握的技能**：' + target.dir.skills.join('、'));
    L.push('');
    L.push('**主要去向**：' + target.dir.companies.join('、'));
    L.push('');
    L.push('**需要留意的风险**：' + target.dir.risk);
    L.push('');

    /* 四年路线 */
    L.push('## 八、四年行动路线与完成情况');
    L.push('');
    var roadmap = state.roadmap || {};
    var stages = AICS.planFor(state);
    L.push('**毕业去向：' + track.name + '**' + (track.auto && track.reason ? '（' + track.reason + '）' : ''));
    L.push('');
    L.push('> 这份路线按你的毕业去向「' + track.name + '」和能力短板生成。' +
      '标了〔方向专项〕〔补齐短板〕的是为你单独加的，其余是全专业通用的阶段任务。');
    L.push('');
    stages.forEach(function (stage) {
      var doneCount = stage.tasks.filter(function (t) { return roadmap[t.id]; }).length;
      L.push('### ' + stage.year + ' · ' + stage.theme + '（' + doneCount + '/' + stage.tasks.length + '）');
      L.push('');
      L.push('> ' + stage.goal);
      L.push('');
      stage.tasks.forEach(function (t) {
        var mark = KIND_LABEL[t.kind] ? '**〔' + KIND_LABEL[t.kind] + '〕** ' : '';
        L.push('- [' + (roadmap[t.id] ? 'x' : ' ') + '] ' + mark + '**' + t.title + '** —— ' + t.desc);
      });
      L.push('');
    });

    /* 任务 */
    var tasks = state.tasks || [];
    if (tasks.length) {
      L.push('## 九、当前学习任务');
      L.push('');
      L.push('| 任务 | 阶段 | 优先级 | 截止日期 | 状态 |');
      L.push('| --- | --- | --- | --- | --- |');
      var statusName = { todo: '待办', doing: '进行中', done: '已完成' };
      var priName = { high: '高', mid: '中', low: '低' };
      tasks.forEach(function (t) {
        /* 任务标题是用户自己打的，必须过 mdCell */
        L.push('| ' + mdCell(t.title) + ' | ' + mdCell(t.term || '-') + ' | ' +
          (priName[t.priority] || '中') + ' | ' + mdCell(t.due || '-') + ' | ' +
          (statusName[t.status] || '待办') + ' |');
      });
      L.push('');
    }

    /* 成长记录 */
    var history = state.history || [];
    if (history.length >= 2) {
      var growth = AICS.Calc.growthSummary(history) || [];
      L.push('## 十、能力成长记录');
      L.push('');
      L.push('共记录 ' + history.length + ' 次测评。各维度从首次到最近一次的变化：');
      L.push('');
      L.push('| 能力维度 | 首次 | 最近 | 变化 |');
      L.push('| --- | --- | --- | --- |');
      growth.forEach(function (g) {
        L.push('| ' + g.name + ' | ' + g.from + ' | ' + g.to + ' | ' +
          (g.delta > 0 ? '+' : '') + g.delta + ' |');
      });
      L.push('');
    }

    L.push('---');
    L.push('');
    L.push('*本规划书由 AI 领航工作台自动生成。规划会随认知变化而调整，' +
      '建议每学期回到工作台更新一次测评与任务进度。*');

    return L.join('\n');
  }

  /* ---------- Word 版 ---------- */
  /* 用带 Office 命名空间的 HTML 生成 .doc。
     Word 和 WPS 都能正常打开并保留排版，用户可另存为 .docx。
     这样不需要引入任何第三方库，纯浏览器就能导出。 */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildWordHtml(state, analysis) {
    var p = state.profile;
    var H = [];

    H.push('<h1>人工智能专业职业生涯规划书</h1>');
    H.push('<p class="sub">由「AI 领航 · 人工智能专业职业生涯规划学习实践工作台」生成　|　生成日期：' + dateStr() + '</p>');

    H.push('<h2>一、基本信息</h2>');
    H.push('<table><tr><th>项目</th><th>内容</th></tr>' +
      '<tr><td>姓名</td><td>' + esc(p.name || '（未填写）') + '</td></tr>' +
      '<tr><td>学校</td><td>' + esc(p.school || '（未填写）') + '</td></tr>' +
      '<tr><td>专业</td><td>' + esc(p.major || '人工智能') + '</td></tr>' +
      '<tr><td>年级</td><td>' + esc(p.year || '（未填写）') + '</td></tr></table>');

    if (analysis) {
      /* 匹配结论提到最前面，给的是档位不是名次 */
      var wBand = analysis.topBand;
      H.push('<p class="lead"><b>匹配结果：' + esc(wBand.name) + '</b>　' +
        bandParagraph(state, analysis, targetOf(state, analysis), wBand, 'html') + '</p>');
    }

    if (!analysis) {
      H.push('<h2>二、说明</h2><p>本规划书还没有测评数据。请先完成自我认知测评的 ' +
        AICS.Calc.totalQuestions() + ' 道题。</p>');
      return wrapWord(H.join(''));
    }

    var w = analysis.weights;

    H.push('<h2>二、匹配度计算依据</h2>');
    H.push('<p>推荐结果由三项加权得出，权重按年级自动调整：</p>');
    H.push('<table><tr><th>分项</th><th>权重</th><th>含义</th></tr>' +
      '<tr><td>能力匹配度</td><td>' + Math.round(w.ability * 100) + '%</td><td>你的自评能力与岗位要求的加权差距</td></tr>' +
      '<tr><td>兴趣匹配度</td><td>' + Math.round(w.interest * 100) + '%</td><td>兴趣六型画像与岗位画像的余弦相似度</td></tr>' +
      '<tr><td>偏好匹配度</td><td>' + Math.round(w.pref * 100) + '%</td><td>工作方式三轴与岗位节奏的贴合度</td></tr></table>');
    H.push('<p>当前年级为「' + esc(analysis.year || '未填写') + '」，' + esc(analysis.yearReason) + '。</p>');

    H.push('<h2>三、能力现状自评</h2>');
    H.push('<table><tr><th>能力维度</th><th>自评得分</th><th>说明</th></tr>' +
      AICS.DIMS.map(function (d) {
        return '<tr><td>' + esc(d.name) + '</td><td>' + (analysis.ability[d.key] || 0) + '</td><td>' + esc(d.desc) + '</td></tr>';
      }).join('') + '</table>');
    H.push('<p><b>当前最短板：' + esc(analysis.weakest.name) + '</b>（自评 ' +
      (analysis.ability[analysis.weakest.key] || 0) + ' 分）</p>');

    H.push('<h2>四、兴趣倾向画像</h2>');
    H.push('<table><tr><th>兴趣类型</th><th>倾向程度</th><th>含义</th></tr>' +
      AICS.INTEREST_TYPES.map(function (t) {
        return '<tr><td>' + esc(t.name) + '</td><td>' +
          Math.round((analysis.interest[t.key] || 0) * 100) + '%</td><td>' + esc(t.desc) + '</td></tr>';
      }).join('') + '</table>');

    /* 分档而不是排行，分数取整——理由同 Markdown 版 */
    H.push('<h2>五、就业方向匹配度分档</h2>');
    H.push('<p>分差在 ' + analysis.bandGap + ' 分以内的方向算作同一档，档内不分先后。</p>');
    if (analysis.consistency && analysis.bandGap > AICS.Calc.BAND_GAP) {
      H.push('<p class="goal">注：本次作答的一致性为 ' + analysis.consistency.score + ' 分（' +
        esc(analysis.consistency.text) + '），因此档位宽度由默认的 ' +
        AICS.Calc.BAND_GAP + ' 分放宽到 ' + analysis.bandGap + ' 分。</p>');
    }
    H.push('<table><tr><th>档位</th><th>方向</th><th>匹配度</th><th>能力</th><th>兴趣</th><th>偏好</th><th>学历建议</th><th>评价</th></tr>' +
      analysis.bands.map(function (b) {
        return b.items.map(function (r, i) {
          return '<tr><td>' + (i === 0 ? esc(b.name) : '') + '</td><td>' + esc(r.name) + '</td><td><b>' +
            Math.round(r.total) + '</b></td><td>' + Math.round(r.abilityScore) + '</td><td>' +
            Math.round(r.interestScore) + '</td><td>' + Math.round(r.prefScore) + '</td><td>' +
            esc(AICS.Directions.degreeOf(r.dir).text) + '</td><td>' + esc(UI.scoreLabel(r.total)) + '</td></tr>';
        }).join('');
      }).join('') + '</table>');

    var target = targetOf(state, analysis);
    var deg = AICS.Directions.degreeOf(target.dir);

    H.push('<h2>六、' + targetLabel(state) + '：' + esc(target.name) + '</h2>');
    if (!targetIsPicked(state)) {
      H.push('<p><i>说明：这个方向是系统按匹配度推荐的第一名，尚未经你手动确认。' +
             '如果认同，去「匹配诊断」点「设为目标方向」；如果不认同，可以在排行里另选一个。</i></p>');
    }
    H.push('<table>' +
      '<tr><td>细分方向</td><td>' + esc(target.dir.sub) + '</td></tr>' +
      '<tr><td>匹配度</td><td>' + Math.round(target.total) + ' 分（' + esc(UI.scoreLabel(target.total)) + '）</td></tr>' +
      '<tr><td>学历建议</td><td>' + esc(deg.text) + '——' + esc(deg.desc) + '</td></tr>' +
      '<tr><td>薪资参考</td><td>' + esc(target.dir.salary) + '</td></tr>' +
      '<tr><td>能力门槛</td><td>' + esc(target.dir.threshold) + '</td></tr></table>');
    H.push('<p>' + esc(target.dir.summary) + '</p>');

    H.push('<h3>6.1 能力差距分析</h3>');
    H.push('<table><tr><th>能力维度</th><th>我的现状</th><th>岗位要求</th><th>差距</th></tr>' +
      target.gaps.map(function (g) {
        return '<tr><td>' + esc(g.name) + '</td><td>' + g.mine + '</td><td>' + g.need + '</td><td>' +
          (g.gap > 0 ? ('还差 ' + g.gap + ' 分') : ('已达标，高出 ' + g.surplus + ' 分')) + '</td></tr>';
      }).join('') + '</table>');

    var pri = target.gaps.filter(function (g) { return g.gap > 0; })
      .sort(function (a, b) { return b.gap - a.gap; }).slice(0, 3);
    if (pri.length) {
      H.push('<h3>6.2 优先补齐的三项能力</h3><ol>' +
        pri.map(function (g) {
          return '<li><b>' + esc(g.name) + '</b>（还差 ' + g.gap + ' 分）：' + esc(AICS.DIM_ADVICE[g.key] || '') + '</li>';
        }).join('') + '</ol>');
    }

    var track = AICS.resolveTrack(state);
    H.push('<h2>七、推荐学习路径</h2>');
    if (target.dir.pathBranch) {
      H.push('<p class="goal">其中「大三暑假」和「大四」两步，按你的毕业去向「' +
        esc(track.name) + '」给出。</p>');
    }
    H.push('<ol>' +
      AICS.pathFor(target.dir, track.key).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>');
    H.push('<p><b>需要掌握的技能：</b>' + esc(target.dir.skills.join('、')) + '</p>');
    H.push('<p><b>主要去向：</b>' + esc(target.dir.companies.join('、')) + '</p>');
    H.push('<p><b>需要留意的风险：</b>' + esc(target.dir.risk) + '</p>');

    var roadmap = state.roadmap || {};
    var stages = AICS.planFor(state);
    H.push('<h2>八、四年行动路线与完成情况</h2>');
    H.push('<p><b>毕业去向：' + esc(track.name) + '</b>' +
      (track.auto && track.reason ? '（' + esc(track.reason) + '）' : '') + '</p>');
    H.push('<p class="goal">这份路线按你的毕业去向「' + esc(track.name) +
      '」和能力短板生成，标了〔方向专项〕〔补齐短板〕的是为你单独加的。</p>');
    stages.forEach(function (stage) {
      var doneCount = stage.tasks.filter(function (t) { return roadmap[t.id]; }).length;
      H.push('<h3>' + esc(stage.year) + ' · ' + esc(stage.theme) + '（' + doneCount + '/' + stage.tasks.length + '）</h3>');
      H.push('<p class="goal">' + esc(stage.goal) + '</p>');
      H.push('<ul>' + stage.tasks.map(function (t) {
        var mark = KIND_LABEL[t.kind] ? '<b>〔' + KIND_LABEL[t.kind] + '〕</b> ' : '';
        return '<li>' + (roadmap[t.id] ? '☑' : '☐') + ' ' + mark +
          '<b>' + esc(t.title) + '</b> —— ' + esc(t.desc) + '</li>';
      }).join('') + '</ul>');
    });

    var tasks = state.tasks || [];
    if (tasks.length) {
      var statusName = { todo: '待办', doing: '进行中', done: '已完成' };
      var priName = { high: '高', mid: '中', low: '低' };
      H.push('<h2>九、当前学习任务</h2>');
      H.push('<table><tr><th>任务</th><th>阶段</th><th>优先级</th><th>截止日期</th><th>状态</th></tr>' +
        tasks.map(function (t) {
          return '<tr><td>' + esc(t.title) + '</td><td>' + esc(t.term || '-') + '</td><td>' +
            (priName[t.priority] || '中') + '</td><td>' + esc(t.due || '-') + '</td><td>' +
            (statusName[t.status] || '待办') + '</td></tr>';
        }).join('') + '</table>');
    }

    var history = state.history || [];
    if (history.length >= 2) {
      var growth = AICS.Calc.growthSummary(history) || [];
      H.push('<h2>十、能力成长记录</h2>');
      H.push('<p>共记录 ' + history.length + ' 次测评。各维度从首次到最近一次的变化：</p>');
      H.push('<table><tr><th>能力维度</th><th>首次</th><th>最近</th><th>变化</th></tr>' +
        growth.map(function (g) {
          return '<tr><td>' + esc(g.name) + '</td><td>' + g.from + '</td><td>' + g.to + '</td><td>' +
            (g.delta > 0 ? '+' : '') + g.delta + '</td></tr>';
        }).join('') + '</table>');
    }

    H.push('<hr><p class="sub">本规划书由 AI 领航工作台自动生成。规划会随认知变化而调整，建议每学期更新一次。</p>');

    return wrapWord(H.join(''));
  }

  function wrapWord(body) {
    var css =
      'body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;font-size:11pt;line-height:1.75;color:#1a1a1a;}' +
      'h1{font-size:20pt;text-align:center;margin:0 0 6pt;}' +
      'h2{font-size:14pt;color:#0b6e99;border-bottom:1px solid #cfd8e3;padding-bottom:4pt;margin:18pt 0 8pt;}' +
      'h3{font-size:12pt;margin:12pt 0 6pt;}' +
      'p{margin:0 0 6pt;}' +
      'p.sub{font-size:9pt;color:#666;text-align:center;}' +
      'p.goal{color:#555;font-size:10pt;}' +
      'table{border-collapse:collapse;width:100%;margin:6pt 0 10pt;}' +
      'th,td{border:1px solid #9aa7b8;padding:5pt 8pt;font-size:10pt;vertical-align:top;}' +
      'th{background:#eef3f9;font-weight:bold;text-align:left;}' +
      'ul,ol{margin:0 0 8pt 18pt;padding:0;}' +
      'li{margin-bottom:3pt;}' +
      'hr{border:none;border-top:1px solid #ccc;margin:16pt 0;}';

    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
      'xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8">' +
      '<title>人工智能专业职业生涯规划书</title>' +
      '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View>' +
      '<w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->' +
      '<style>@page{size:A4;margin:2cm 1.8cm;}' + css + '</style>' +
      '</head><body>' + body + '</body></html>';
  }

  /* ---------- 下载 ---------- */

  function download(filename, text, mime) {
    var blob = new Blob(['﻿' + text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
  }

  /* ---------- 页面预览 ---------- */

  function previewHtml(state, analysis) {
    var p = state.profile;

    if (!analysis) {
      return '<div class="panel">' +
        UI.empty({
          icon: 'file',
          title: '规划书还没有内容',
          desc: '完成自我认知测评后，这里会自动汇总成一份完整的职业规划书，可以直接导出提交。',
          action: 'go-assess',
          actionText: '去完成测评'
        }) + '</div>';
    }

    var target = targetOf(state, analysis);
    var deg = AICS.Directions.degreeOf(target.dir);
    var w = analysis.weights;
    var band = analysis.topBand;

    var roadmap = state.roadmap || {};
    var track = AICS.resolveTrack(state);
    var stages = AICS.planFor(state);
    var totalTasks = 0, doneTasks = 0;
    stages.forEach(function (s) {
      s.tasks.forEach(function (t) { totalTasks++; if (roadmap[t.id]) doneTasks++; });
    });
    var tasks = state.tasks || [];

    var html = '';

    html += '<div class="report-cover">' +
      '<h1>人工智能专业职业生涯规划书</h1>' +
      '<p class="report-cover__name">' + UI.esc(p.name || '（请先在设置里填写姓名）') + '</p>' +
      '<p class="report-cover__meta">' + UI.esc(p.school || '（未填写学校）') + ' · ' +
        UI.esc(p.major || '人工智能') + ' · ' + UI.esc(p.year || '（未填写年级）') + '</p>' +
      '<p class="report-cover__date">生成日期：' + dateStr() + '　|　规划路线：' + UI.esc(track.name) + '</p>' +
    '</div>';

    html += '<section class="report-section">' +
      '<h2>一、规划摘要</h2>' +
      '<div class="report-summary">' +
        /* 档位放在最前面。不给"匹配度 87.1 分"这种假精度——
           实测第1名和第2名中位只差 0.7~1.4 分，重答一次有 19%~40% 会换人。 */
        '<div><span>匹配档位</span><strong>' + UI.esc(band.name) +
          (band.items.length > 1 ? '（' + band.items.length + ' 个方向）' : '') + '</strong></div>' +
        /* 没手动确认过目标方向时，这里必须写「推荐方向」——
           写「目标方向」等于替用户宣称一个他没做过的决定，
           而这份文档是要交出去的 */
        '<div><span>' + targetLabel(state) + '</span><strong style="color:' + UI.scoreColor(target.total) + '">' +
          UI.esc(target.name) + '</strong></div>' +
        '<div><span>学历建议</span><strong>' + UI.esc(deg.text) + '</strong></div>' +
        '<div><span>当前最短板</span><strong>' + UI.esc(analysis.weakest.name) + '</strong></div>' +
        '<div><span>四年任务完成</span><strong>' + doneTasks + ' / ' + totalTasks + '</strong></div>' +
      '</div>' +
      '<p class="report-lead">' +
        bandParagraph(state, analysis, target, band, 'html') +
        '学历要求为「' + UI.esc(deg.text) + '」。' +
        '下文将说明匹配度的计算依据、你目前的能力差距，以及建议的四年行动路线。</p>' +
    '</section>';

    /* 计算依据 */
    html += '<section class="report-section">' +
      '<h2>二、匹配度计算依据</h2>' +
      '<p class="report-lead">匹配度由三项测评加权计算得出。' +
        '权重会跟着年级变——你现在填的是「<strong>' + UI.esc(analysis.year || '未填写') + '</strong>」，' +
        UI.esc(analysis.yearReason) + '。</p>' +
      '<table class="report-table"><thead><tr><th>分项</th><th>本年级权重</th><th>含义</th></tr></thead><tbody>' +
        '<tr><td data-label="分项">能力匹配度</td><td data-label="权重">' + Math.round(w.ability * 100) + '%</td><td data-label="含义">自评能力与岗位要求的加权差距</td></tr>' +
        '<tr><td data-label="分项">兴趣匹配度</td><td data-label="权重">' + Math.round(w.interest * 100) + '%</td><td data-label="含义">兴趣六型画像与岗位画像的余弦相似度</td></tr>' +
        '<tr><td data-label="分项">偏好匹配度</td><td data-label="权重">' + Math.round(w.pref * 100) + '%</td><td data-label="含义">工作方式三轴与岗位节奏的贴合度</td></tr>' +
      '</tbody></table>' +
    '</section>';

    /* 就业方向匹配度分档。
       这里原来写的是"三、方向匹配度排行"——带排名列（1~7）、分数还是
       没取整的原始小数。它是"给方向分档"那次改版漏掉的一处：
       同一份规划书，屏幕上和打印出来是排名加小数，导出 Word / Markdown
       却是分档加整数，而上面那段结论刚说完"不给它们排名次"。
       而且「打印 / 存为 PDF」用的就是这个函数，所以 PDF 版一直在
       输出一份 Word 版否认掉的排名表。现在三条导出路径口径一致。 */
    html += '<section class="report-section">' +
      '<h2>三、就业方向匹配度分档</h2>' +
      '<p class="report-lead">分差在 ' + analysis.bandGap +
        ' 分以内的方向算作同一档，档内不分先后。' +
        (analysis.consistency && analysis.bandGap > AICS.Calc.BAND_GAP
          ? '本次作答的一致性为 ' + analysis.consistency.score + ' 分（' +
            UI.esc(analysis.consistency.text) + '），档位已相应放宽。'
          : '') + '</p>' +
      '<table class="report-table"><thead><tr>' +
        '<th>档位</th><th>方向</th><th>匹配度</th><th>能力</th><th>兴趣</th><th>偏好</th><th>学历建议</th><th>评价</th>' +
      '</tr></thead><tbody>' +
      analysis.bands.map(function (b) {
        return b.items.map(function (r, i) {
          return '<tr' + (r.id === target.id ? ' class="is-target"' : '') + '>' +
            '<td data-label="档位">' + (i === 0 ? UI.esc(b.name) : '') + '</td>' +
            '<td data-label="方向">' + UI.esc(r.name) + '</td>' +
            '<td data-label="匹配度"><strong style="color:' + UI.scoreColor(r.total) + '">' +
              Math.round(r.total) + '</strong></td>' +
            '<td data-label="能力">' + Math.round(r.abilityScore) + '</td>' +
            '<td data-label="兴趣">' + Math.round(r.interestScore) + '</td>' +
            '<td data-label="偏好">' + Math.round(r.prefScore) + '</td>' +
            '<td data-label="学历建议">' + UI.esc(AICS.Directions.degreeOf(r.dir).text) + '</td>' +
            '<td data-label="评价">' + UI.esc(UI.scoreLabel(r.total)) + '</td>' +
          '</tr>';
        }).join('');
      }).join('') +
      '</tbody></table>' +
    '</section>';

    /* 差距 */
    html += '<section class="report-section">' +
      '<h2>四、与目标方向的能力差距</h2>' +
      '<table class="report-table"><thead><tr>' +
        '<th>能力维度</th><th>我的现状</th><th>岗位要求</th><th>差距</th>' +
      '</tr></thead><tbody>' +
      target.gaps.map(function (g) {
        var txt = g.gap > 0 ? ('还差 ' + g.gap + ' 分') : ('已达标，高出 ' + g.surplus + ' 分');
        var color = g.gap > 0 ? (g.gap > 30 ? UI.tone('danger') : UI.tone('warn')) : UI.tone('ok');
        return '<tr><td data-label="能力维度">' + UI.esc(g.name) + '</td>' +
          '<td data-label="我的现状">' + g.mine + '</td>' +
          '<td data-label="岗位要求">' + g.need + '</td>' +
          '<td data-label="差距" style="color:' + color + '">' + txt + '</td></tr>';
      }).join('') +
      '</tbody></table>' +
    '</section>';

    /* 四年路线 */
    html += '<section class="report-section">' +
      '<h2>五、四年行动路线（' + UI.esc(track.name) + '）</h2>' +
      '<p class="report-note" style="margin-bottom:14px">' +
        '这份路线按你的毕业去向「' + UI.esc(track.name) + '」和能力短板生成，' +
        '标了〔方向专项〕〔补齐短板〕的是为你单独加的。' +
        (track.auto && track.reason ? UI.esc(track.reason) + '。' : '') + '</p>' +
      stages.map(function (stage) {
        var done = stage.tasks.filter(function (t) { return roadmap[t.id]; }).length;
        return '<div class="report-stage">' +
          '<h3>' + UI.esc(stage.year) + ' · ' + UI.esc(stage.theme) +
            '<span>' + done + ' / ' + stage.tasks.length + '</span></h3>' +
          '<p class="report-stage__goal">' + UI.esc(stage.goal) + '</p>' +
          '<ul>' + stage.tasks.map(function (t) {
            return '<li class="' + (roadmap[t.id] ? 'is-done' : '') + '">' +
              (roadmap[t.id] ? '☑' : '☐') + ' ' +
              (KIND_LABEL[t.kind] ? '〔' + KIND_LABEL[t.kind] + '〕' : '') +
              UI.esc(t.title) + '</li>';
          }).join('') + '</ul>' +
        '</div>';
      }).join('') +
    '</section>';

    if (tasks.length) {
      var doing = tasks.filter(function (t) { return t.status === 'doing'; }).length;
      var done = tasks.filter(function (t) { return t.status === 'done'; }).length;
      html += '<section class="report-section">' +
        '<h2>六、学习任务执行情况</h2>' +
        '<p>共记录 ' + tasks.length + ' 项学习任务，其中进行中 ' + doing + ' 项，已完成 ' + done + ' 项。</p>' +
      '</section>';
    }

    return html;
  }

  AICS.Views.report = {
    title: '我的规划书',
    desc: '汇总成一份可提交的文档',

    render: function () {
      var state = AICS.Store.get();
      var analysis = AICS.Calc.analyse(state);

      /* 主按钮给 Word：这一页的出口是"交给老师"，
         Word 是老师能直接打开、能打印、能批注的格式，
         Markdown 只是给同学自己留档或二次编辑用的，不该抢主位。
         顺序也按使用频率排：Word → PDF → Markdown。

         没做测评时三个导出按钮全部禁用：正文明明写着"规划书还没有内容"，
         按钮却能点、还能导出成功，会让人把一份空文档当成成果交上去。 */
      var noData = !analysis;
      var head = UI.pageHeader('我的职业规划书',
        noData ? '做完自我认知测评，这里才会汇总出可导出的规划书'
               : '一份完整的个人规划文档，可导出 Word / Markdown 或打印成 PDF',
        '<div class="btn-row">' +
          '<button class="btn btn--primary" data-action="report-word"' + (noData ? ' disabled' : '') + '>' +
            UI.icon('download') + ' 导出 Word</button>' +
          '<button class="btn" data-action="report-print"' + (noData ? ' disabled' : '') + '>' +
            UI.icon('file') + ' 打印 / 存为 PDF</button>' +
          '<button class="btn" data-action="report-export"' + (noData ? ' disabled' : '') + '>' +
            UI.icon('download') + ' 导出 Markdown</button>' +
        '</div>');

      /* 数据备份、清空这类应用级操作放在「设置」里，不放在这里——
         这一页只负责产出规划书本身 */
      var footNote = '<p class="report-foot">' +
        '规划书的内容会跟着你的测评数据自动更新。想备份或清空数据，去右上角的「设置」。' +
      '</p>';

      return head +
        '<div class="report" id="report-body">' + previewHtml(state, analysis) + '</div>' +
        footNote;
    }
  };

  /* ---------- 导出入口 ---------- */

  /* 导出 Markdown */
  AICS.exportReport = function () {
    var state = AICS.Store.get();
    var analysis = AICS.Calc.analyse(state);
    if (!analysis) { UI.toast('先完成测评，规划书才有内容', 'error'); return; }
    var name = state.profile.name || '同学';
    var md = generateMarkdown(state, analysis);
    download(name + '-人工智能专业职业生涯规划书-' + dateStr() + '.md', md, 'text/markdown');
    UI.toast('规划书已导出到下载文件夹', 'success');
  };

  /* 导出 Word（.doc） */
  AICS.exportReportWord = function () {
    var state = AICS.Store.get();
    var analysis = AICS.Calc.analyse(state);
    if (!analysis) { UI.toast('先完成测评，规划书才有内容', 'error'); return; }
    var name = state.profile.name || '同学';
    var html = buildWordHtml(state, analysis);
    download(name + '-人工智能专业职业生涯规划书-' + dateStr() + '.doc', html, 'application/msword');
    UI.toast('Word 文档已导出，双击就能用 Word 或 WPS 打开', 'success');
  };

  /* 打印 / 存 PDF：先讲清楚该怎么操作，再唤起打印 */
  AICS.exportReportPDF = function () {
    var analysis = AICS.Calc.analyse(AICS.Store.get());
    if (!analysis) {
      UI.toast('先完成测评，规划书才有内容', 'error');
      return;
    }
    UI.modal({
      key: 'pdf-help',
      title: '导出成 PDF',
      html: '<p class="modal__text">点击下面的按钮会打开浏览器的打印窗口。' +
        '在打印窗口里把「目标打印机」或「打印机」那一栏改成 <strong>「另存为 PDF」</strong>，' +
        '再点保存，就能得到一份 PDF 文件。</p>' +
        '<p class="modal__text" style="margin-top:12px">打印预览里已经自动隐藏了导航栏和按钮，' +
        '只会输出规划书正文。</p>',
      actions: [
        { text: '取消' },
        { text: '打开打印窗口', type: 'primary', onClick: function () {
            setTimeout(function () { window.print(); }, 260);
          } }
      ]
    });
  };

  /* 导出 JSON 备份 */
  AICS.exportBackup = function () {
    var name = AICS.Store.get().profile.name || '同学';
    download('AI领航-数据备份-' + dateStr() + '.json', AICS.Store.exportJSON(), 'application/json');
    UI.toast('数据备份已导出', 'success');
  };

  AICS.generateMarkdown = generateMarkdown;

})(window.AICS);
