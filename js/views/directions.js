/* ============================================================
 * views/directions.js —— AI 就业方向图谱
 * ------------------------------------------------------------
 * 七个方向的卡片墙，点开有完整详情：岗位职责、技能栈、学习路径、
 * 代表企业、适合人群、学历建议、风险提示。
 * 做完测评后卡片上还会显示匹配度。
 * ============================================================ */
window.AICS = window.AICS || {};
AICS.Views = AICS.Views || {};

(function (AICS) {
  'use strict';

  var UI = AICS.UI;

  /* 需求热度画成实心点，满格 5 */
  function demandDots(v) {
    var full = Math.round(v);
    var out = '';
    for (var i = 1; i <= 5; i++) {
      out += '<span class="dot' + (i <= full ? ' is-on' : '') + '"></span>';
    }
    /* 标注"估算"：这个分数是编的，写成 4.5 已经很像实测值了，
       悬停提示里必须说清楚，否则它和真正有出处的兴趣画像是同一种呈现方式 */
    return '<span class="dots" title="需求热度 ' + v + ' / 5（估算值，非官方统计）">' + out + '</span>';
  }

  function thresholdTone(t) {
    if (t === '高') return 'danger';
    if (t === '中高') return 'warn';
    return 'ok';
  }

  /* 学历建议标签 */
  function degreeTag(dir) {
    var d = AICS.Directions.degreeOf(dir);
    return '<span class="degree-tag degree-tag--' + d.tone + '" title="' + UI.esc(d.desc) + '">' +
      UI.icon('briefcase') + UI.esc(d.text) + '</span>';
  }

  /* 单张方向卡片 */
  function card(dir, score) {
    var scoreHtml = score
      ? '<div class="dir-card__score" style="color:' + UI.scoreColor(score.total) + '">' +
          '<strong>' + Math.round(score.total) + '</strong><span>匹配度</span></div>'
      : '';

    return '<article class="dir-card" data-dir="' + dir.id + '">' +
      '<div class="dir-card__top">' +
        '<span class="dir-card__badge">' + UI.esc(dir.badge) + '</span>' +
        scoreHtml +
      '</div>' +
      '<h3>' + UI.esc(dir.name) + '</h3>' +
      '<p class="dir-card__sub">' + UI.esc(dir.sub) + '</p>' +
      '<p class="dir-card__summary">' + UI.esc(dir.summary) + '</p>' +
      '<div class="dir-card__meta">' +
        '<div><span>需求热度</span>' + demandDots(dir.demand) + '</div>' +
        '<div><span>能力门槛</span>' + UI.tag(dir.threshold, thresholdTone(dir.threshold)) + '</div>' +
      '</div>' +
      '<div class="dir-card__degree">' + degreeTag(dir) + '</div>' +
      '<div class="dir-card__salary">' + UI.icon('coin') + UI.esc(dir.salary) + '</div>' +
      '<button class="btn btn--block" data-action="dir-detail" data-id="' + dir.id + '">' +
        '查看详情 ' + UI.icon('arrow-right') + '</button>' +
    '</article>';
  }

  /* 方向详情弹窗的内容。track 是当前的毕业去向，用来选学习路径的版本 */
  function detailHtml(dir, score, track) {
    function list(items) {
      return '<ul class="detail-list">' + items.map(function (t) {
        return '<li>' + UI.esc(t) + '</li>';
      }).join('') + '</ul>';
    }

    var scoreBlock = '';
    if (score) {
      scoreBlock = '<div class="detail-score" style="border-color:' + UI.scoreColor(score.total) + '33">' +
        '<div class="detail-score__main">' +
          '<strong style="color:' + UI.scoreColor(score.total) + '">' +
            Math.round(score.total) + '</strong>' +
          '<span>匹配度 · ' + UI.scoreLabel(score.total) + '</span>' +
        '</div>' +
        /* 分项分取整：raw 值是 80.9 这种，全站别的地方都取整了，
           这里不取整会出现"卡片上 80.9、诊断页 81"的对不上 */
        '<div class="detail-score__break">' +
          '<span>能力 <b>' + Math.round(score.abilityScore) + '</b></span>' +
          '<span>兴趣 <b>' + Math.round(score.interestScore) + '</b></span>' +
          '<span>偏好 <b>' + Math.round(score.prefScore) + '</b></span>' +
        '</div>' +
      '</div>';
    }

    /* 有些方向需要额外澄清，比如"科研 / 学术"和考研的区别 */
    var notice = dir.notice
      ? '<div class="notice-box">' + UI.icon('info') +
          '<p>' + UI.esc(dir.notice) + '</p>' +
        '</div>'
      : '';

    var degree = AICS.Directions.degreeOf(dir);

    /* 推荐路径里的「大三暑假」和「大四」跟着毕业去向变，必须和四年规划页
       用同一条路线——否则选了"升学深造"的人打开算法工程师，会看到
       "投算法实习、准备秋招"，两页像是各说各话。 */
    track = track || AICS.resolveTrack(AICS.Store.get());
    var steps = AICS.pathFor(dir, track.key);
    var pathHint = dir.pathBranch
      ? '<p class="path-hint">按毕业去向「<b>' + UI.esc(track.name) + '</b>」显示，' +
          '只影响大三暑假和大四两步' +
          '<button class="link-btn" data-action="go-roadmap">去四年规划改</button></p>'
      : '';

    return scoreBlock +
      '<p class="detail-lead">' + UI.esc(dir.summary) + '</p>' +
      notice +
      '<div class="detail-box"><h4>学历建议：' + UI.esc(degree.text) + '</h4>' +
        '<p>' + UI.esc(degree.desc) + '</p>' +
        '<p style="margin-top:8px"><strong>薪资参考：</strong>' + UI.esc(dir.salary) + '</p>' +
      '</div>' +
      '<div class="detail-grid">' +
        '<div><h4>' + UI.icon('briefcase') + ' 典型岗位职责</h4>' + list(dir.jd) + '</div>' +
        '<div><h4>' + UI.icon('tool') + ' 需要掌握的技能</h4>' + list(dir.skills) + '</div>' +
        '<div><h4>' + UI.icon('route') + ' 推荐学习路径</h4>' + pathHint + list(steps) + '</div>' +
        '<div><h4>' + UI.icon('building') + ' 主要去向</h4>' + list(dir.companies) + '</div>' +
      '</div>' +
      '<div class="detail-box detail-box--fit"><h4>适合什么样的人</h4><p>' + UI.esc(dir.fit) + '</p></div>' +
      '<div class="detail-box detail-box--risk"><h4>需要留意的风险</h4><p>' + UI.esc(dir.risk) + '</p></div>' +
      '<div class="detail-actions">' +
        '<button class="btn btn--primary" data-action="set-target" data-id="' + dir.id + '">' +
          UI.icon('target') + ' 设为目标方向</button>' +
      '</div>';
  }

  AICS.Views.directions = {
    title: '方向图谱',
    desc: '人工智能专业的七个主流就业方向',

    render: function () {
      var state = AICS.Store.get();
      var analysis = AICS.Calc.analyse(state);
      var scoreMap = {};
      if (analysis) {
        analysis.ranked.forEach(function (r) { scoreMap[r.id] = r; });
      }

      var targetDir = AICS.Directions.byId(state.profile.targetId);

      var targetBanner = targetDir
        ? '<div class="banner">' + UI.icon('target') +
            '<div><strong>当前目标方向：' + UI.esc(targetDir.name) + '</strong>' +
            '<span>四年规划和差距分析都会以它为基准</span></div>' +
            '<div class="btn-row">' +
              '<button class="link-btn" data-action="go-match">看差距分析 ' + UI.icon('arrow-right') + '</button>' +
              '<button class="link-btn" data-action="clear-target">取消</button>' +
            '</div>' +
          '</div>'
        : '';

      var hint = !analysis
        ? '<div class="banner banner--soft">' + UI.icon('info') +
            '<div><strong>还没做测评，暂时看不到匹配度</strong>' +
            '<span>做完测评后，每张卡片上会显示它和你的匹配分数</span></div>' +
            '<button class="link-btn" data-action="go-assess">去测评 ' + UI.icon('arrow-right') + '</button>' +
          '</div>'
        : '';

      /* 数据来源必须写在页面上，不能只写在讲解文档里。
         这一页上除了兴趣画像来自 O*NET 实测数据，其余几项都是估的；
         有出处和没出处混在一起显示、却不说明，读者会默认它们一样可靠。 */
      var sourceNote = '<p class="muted" style="margin:-4px 0 16px">' +
        '卡片上的能力要求、薪资、需求热度，参考公开的岗位信息和行业报告估计得出，不是官方统计；' +
        '兴趣六型画像取自美国劳工部 O*NET 数据库的实测得分。' +
        '它们用来比较方向之间的相对差异，不要当成绝对数值。</p>';

      return UI.pageHeader('AI 就业方向图谱',
          '七个方向覆盖技术、产品、科研三条线，每个都标了学历门槛',
          '<button class="btn" data-action="go-compare">' + UI.icon('scale') + ' 并排对比方向</button>' +
          (analysis ? '' : '<button class="btn btn--primary" data-action="go-assess">' +
            UI.icon('target') + ' 先做测评</button>')) +
        sourceNote + hint + targetBanner +
        '<div class="dir-grid">' +
          AICS.DIRECTIONS.map(function (d) { return card(d, scoreMap[d.id]); }).join('') +
        '</div>';
    },

    /* 详情弹窗由 app.js 的事件委托调用 */
    detail: function (dirId) {
      var state = AICS.Store.get();
      var analysis = AICS.Calc.analyse(state);
      var dir = AICS.Directions.byId(dirId);
      if (!dir) return;

      var score = null;
      if (analysis) {
        score = analysis.ranked.filter(function (r) { return r.id === dirId; })[0];
      }

      UI.modal({
        key: 'dir-detail',
        title: dir.name + ' · ' + dir.sub,
        html: detailHtml(dir, score, AICS.resolveTrack(state))
      });
    }
  };

})(window.AICS);
