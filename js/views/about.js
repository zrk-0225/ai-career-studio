/* ============================================================
 * views/about.js —— 关于作者
 * ------------------------------------------------------------
 * 这一页回答一个问题：这个作品是谁做的。
 *
 * 特意写清楚了分工。这个作品使用了 AI 工具，
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
            '<p>人工智能专业在读。这个工作台面向尚未确定就业方向的 AI 专业学生，' +
              '集中呈现七个方向的岗位内容、能力要求与学习路径，供选方向时参考。</p>' +
          '</div>' +
        '</div>';

      /* 分工说明：这一页最要紧的一段 */
      var split = '<div class="panel">' +
          '<div class="panel__head"><h3>' + UI.icon('star') + ' 分工说明</h3></div>' +
          '<p class="about-lead">这个作品使用了 AI 工具，具体分工如下：' +
            '<strong>代码由 AI 编写，算法方案由 AI 提出，我做的是取舍与科学性判断。</strong></p>' +
        '</div>';

      var links = '<div class="panel">' +
          '<div class="panel__head"><h3>' + UI.icon('compass') + ' 相关链接</h3></div>' +
          linkRow('target', '在线访问', SITE,
            '电脑和手机都能直接打开，不用装任何东西。') +
          linkRow('file', '源码仓库', REPO,
            '仓库里有完整的提交记录，可以看到每一次改动的时间和内容。') +
        '</div>';

      var tech = '<div class="panel">' +
          '<div class="panel__head"><h3>' + UI.icon('tool') + ' 技术说明</h3></div>' +
          '<ul class="mini-list">' +
            '<li>不用框架，不依赖任何第三方库，也没有安装和构建步骤——' +
              '拷贝到任意一台电脑上双击 index.html 即可运行，断网可用</li>' +
            '<li>图表不使用图表库，全部由原生 Canvas 2D 绘制（雷达图、折线图、环形进度、条形图）</li>' +
            '<li>数据仅保存在浏览器本地，不上传服务器</li>' +
          '</ul>' +
          '<p class="muted about-foot">当前版本 <code>' + UI.esc(AICS.BUILD) + '</code></p>' +
        '</div>';

      return head + '<div class="stack">' + who + split + links + tech + '</div>';
    }
  };

})(window.AICS);
