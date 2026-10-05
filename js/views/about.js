/* ============================================================
 * views/about.js —— 关于作者
 * ------------------------------------------------------------
 * 这一页回答一个问题：这个作品是谁做的。
 *
 * 特意写清楚了分工。课程本来就要求用 AI 工具完成，
 * 与其含糊带过，不如把"哪些判断是人的、哪些实现是 AI 的"摆在明面上——
 * 说清楚了反而立得住，含糊才经不起问。
 * 页面上不放电话和邮箱，只留代号和仓库地址。
 * ============================================================ */

window.AICS = window.AICS || {};
AICS.Views = AICS.Views || {};

(function (AICS) {
  'use strict';

  var UI = AICS.UI;

  var SITE = 'https://zrk-0225.github.io/ai-career-studio/';
  var REPO = 'https://github.com/zrk-0225/ai-career-studio';

  /* 一条"我做的"或"AI 做的"，左边一个短标签 */
  function duty(tag, tone, text) {
    return '<li class="duty">' +
      '<span class="duty__tag duty__tag--' + tone + '">' + UI.esc(tag) + '</span>' +
      '<span class="duty__text">' + text + '</span>' +
    '</li>';
  }

  function linkRow(iconName, label, url, note) {
    return '<a class="about-link" href="' + url + '" target="_blank" rel="noopener">' +
      UI.icon(iconName) +
      '<span class="about-link__label">' + UI.esc(label) + '</span>' +
      '<span class="about-link__url">' + UI.esc(url) + '</span>' +
      UI.icon('arrow-right') +
    '</a>' +
    (note ? '<p class="about-link__note">' + note + '</p>' : '');
  }

  AICS.Views.about = {
    title: '关于作者',
    desc: '这个作品是谁做的',

    render: function () {
      var head = UI.pageHeader('关于作者', '这个作品是谁做的、分工是怎样的');

      var who = '<div class="panel about-who">' +
          '<div class="about-avatar">zrk</div>' +
          '<div class="about-who__text">' +
            '<h2>zrk</h2>' +
            '<p>人工智能专业在读。这个工作台是课程作业，' +
              '做给和我一样在方向选择上发懵的同学——' +
              '不知道有哪些方向、不知道选哪个、不知道差在哪、不知道怎么补。</p>' +
          '</div>' +
        '</div>';

      /* 分工说明：这一页最要紧的一段 */
      var split = '<div class="panel">' +
          '<div class="panel__head"><h3>' + UI.icon('star') + ' 这个作品是怎么做出来的</h3></div>' +
          '<p class="about-lead">课程要求用 AI 工具完成，所以这里把分工写清楚。' +
            '一句话概括：<strong>判断是我做的，实现是在 AI 工具协助下完成的</strong>——' +
            '代码不是我逐行写的。</p>' +
          '<ul class="duty-list">' +
            duty('我做的', 'me', '定选题和范围——做给谁用、解决什么问题、哪些功能不做') +
            duty('我做的', 'me', '做选择——在几个方案里挑一个，或者否掉不合适的') +
            duty('我做的', 'me', '追问和把关——结果看着不对就往下追。' +
              '比如「没定目标方向时，参照物该拿什么算」「跨年级重测的分数还能不能比」，' +
              '这些追问改掉了几处算法') +
            duty('我做的', 'me', '真机测试——在自己手机上完整走一遍，把卡住的地方记下来反馈') +
            duty('AI 做的', 'ai', '编写全部代码') +
            duty('AI 做的', 'ai', '起草文档') +
            duty('AI 做的', 'ai', '提出算法方案和界面方案，供我选择') +
          '</ul>' +
          '<p class="muted about-foot">所以准确的说法是：' +
            '这个作品<strong>要做什么、做成什么样，是我判断的</strong>；' +
            '把它写出来，是在 AI 工具的协助下完成的。</p>' +
        '</div>';

      var links = '<div class="panel">' +
          '<div class="panel__head"><h3>' + UI.icon('compass') + ' 想了解这个作品</h3></div>' +
          linkRow('target', '在线访问', SITE,
            '电脑和手机都能直接打开，不用装任何东西。') +
          linkRow('file', '源码仓库', REPO,
            '仓库里有完整的提交记录——每一次改动、改了什么、什么时候改的都在里面，' +
            '比任何说明文字都更能说明它是怎么做出来的。') +
        '</div>';

      var tech = '<div class="panel">' +
          '<div class="panel__head"><h3>' + UI.icon('tool') + ' 技术说明</h3></div>' +
          '<ul class="mini-list">' +
            '<li>纯前端、零依赖——没有用任何第三方库，不需要 npm install，不需要构建步骤</li>' +
            '<li>图表全部手绘——雷达图、折线图、环形进度、条形图都用原生 Canvas 2D 画的</li>' +
            '<li>不用框架——所有脚本用经典 &lt;script&gt; 标签加载，' +
              '所以双击 index.html 就能跑，断网也能用</li>' +
            '<li>数据存在浏览器本地，不上传任何服务器</li>' +
          '</ul>' +
          '<p class="muted about-foot">' +
            '当前版本 <code>' + UI.esc(AICS.BUILD) + '</code>，' +
            '和设置弹窗底部、控制台打印的是同一个号。</p>' +
        '</div>';

      return head + '<div class="stack">' + who + split + links + tech + '</div>';
    }
  };

})(window.AICS);
