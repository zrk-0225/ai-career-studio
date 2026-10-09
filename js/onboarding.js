/* ============================================================
 * onboarding.js —— 首次启动向导
 * ------------------------------------------------------------
 * 第一次打开工作台时弹出的三屏向导：
 *   ① 这是什么东西
 *   ② 你的数据在哪（隐私承诺）
 *   ③ 填年级（必填）和姓名学校（选填）
 *
 * 为什么年级必须填：它直接决定匹配算法的权重。如果不填就默认成
 * 某个年级，大一新生会拿到大二的权重，而且他完全不知道——这是个
 * 静默的错误默认值，比报错还糟糕。
 * ============================================================ */
window.AICS = window.AICS || {};

(function (AICS) {
  'use strict';

  var UI = AICS.UI;

  /* 年级对算法的具体影响，写在向导里让用户明白为什么要填 */
  var YEAR_EXPLAIN = {
    '大一': '能力还没成形，所以主要看兴趣和性格，这时候比能力没有意义',
    '大二': '有基础了，但兴趣仍是主要判断依据，能力开始计入',
    '大三': '到了要定去向的时候，能力差距开始成为决定性因素',
    '大四': '求职看硬实力，能力占绝对主导，兴趣偏好只做参考'
  };

  var step = 0;
  var draft = { year: '', name: '', school: '' };

  /* ---------- 三屏内容 ---------- */

  function stepWelcome() {
    return '<div class="wizard__hero">' +
        '<div class="wizard__logo">' + UI.icon('sparkles') + '</div>' +
        '<h2>欢迎来到 AI 领航</h2>' +
        '<p class="wizard__lead">这是一个为人工智能专业学生做的职业规划工作台。' +
          /* 题数现算。全站别处都走 Calc.totalQuestions()，
             这里抄了个固定值——加题之后向导上就挂着一个假数字。 */
          '做完一份 ' + AICS.Calc.totalQuestions() + ' 题的测评，它会告诉你三件事：</p>' +
      '</div>' +
      '<div class="wizard__points">' +
        '<div class="wizard__point">' +
          '<span class="wizard__point-icon">' + UI.icon('compass') + '</span>' +
          /* 措辞不能说"哪个最适合你"——匹配页刻意不给唯一答案，
             只给档位（详见讲解文档 5.13）。第一屏就承诺一个后面给不出的东西，
             用户走完 38 道题会觉得被耍了。 */
          '<div><strong>七个 AI 就业方向里，你分别适合哪些</strong>' +
          '<em>依据你的兴趣、能力和工作偏好计算得出</em></div>' +
        '</div>' +
        '<div class="wizard__point">' +
          '<span class="wizard__point-icon">' + UI.icon('chart') + '</span>' +
          '<div><strong>你现在离想去的方向还差什么</strong>' +
          '<em>逐个能力维度告诉你差距，以及该怎么补</em></div>' +
        '</div>' +
        '<div class="wizard__point">' +
          '<span class="wizard__point-icon">' + UI.icon('calendar') + '</span>' +
          '<div><strong>大一到大四，一步步该做什么</strong>' +
          /* 条数现算，别抄一份——加任务时忘了改这里，向导上就挂着一个假数字 */
          '<em>' + AICS.roadmapTotal() + ' 项通用阶段任务，还会按你的目标方向再补几项，做完打勾</em></div>' +
        '</div>' +
      '</div>' +
      '<p class="wizard__note">全程大约 12 分钟。随时可以关掉，下次打开接着做。</p>';
  }

  function stepPrivacy() {
    return '<div class="wizard__hero">' +
        '<div class="wizard__logo wizard__logo--ok">' + UI.icon('lock') + '</div>' +
        '<h2>你的数据只存在你自己的电脑上</h2>' +
        '<p class="wizard__lead">下面四条是这个工作台处理数据的方式。</p>' +
      '</div>' +
      '<ul class="privacy-list">' +
        '<li>' + UI.icon('check') + '<span><strong>不上传服务器</strong>：' +
          '测评答案、任务、对话全部存在浏览器的本地存储里，我们看不到，别人也看不到</span></li>' +
        '<li>' + UI.icon('check') + '<span><strong>不用注册</strong>：' +
          '没有账号、没有手机号、没有埋点统计</span></li>' +
        '<li>' + UI.icon('check') + '<span><strong>断网也能用</strong>：' +
          /* 原来写的是"整个程序是离线的，没网一样正常跑"，
             和下一页那句"可以填 API Key 接入在线模型"打架。
             离线的是测评、匹配、规划这些主体功能，助手配了 Key 就要联网。 */
          '测评、匹配、规划这些功能都在本地运行，断网也能用（在线 AI 助手需要联网）</span></li>' +
        /* 数据备份/清空在「设置」弹窗里，不在「我的规划书」——
           这一页只产出规划书本身。写错地方会让新用户去规划书页白找一圈。 */
        '<li>' + UI.icon('check') + '<span><strong>随时能走</strong>：' +
          '右上角「设置」里可以一键导出全部数据备份，也可以一键清空</span></li>' +
      '</ul>' +
      '<div class="wizard__warn">' + UI.icon('info') +
        '<span><strong>唯一的例外</strong>：如果你主动在设置里填了 AI 助手的 API Key，' +
        '那你向助手提的问题会发给你自己选择的模型服务商（比如 DeepSeek）。' +
        '不填就完全离线，一个字都不会出去。</span>' +
      '</div>';
  }

  function stepProfile() {
    return '<div class="wizard__hero">' +
        '<div class="wizard__logo wizard__logo--accent">' + UI.icon('user') + '</div>' +
        '<h2>最后一步：你在哪个阶段？</h2>' +
        '<p class="wizard__lead"><strong>年级会影响匹配时各项能力的权重</strong>，所以这一步必填。</p>' +
      '</div>' +
      '<div class="form-grid">' +
        '<label class="form-grid__full">年级 <span class="required">必填</span>' +
          '<select id="wz-year" class="input">' +
            '<option value="">请选择你的年级</option>' +
            AICS.YEARS.map(function (y) {
              return '<option value="' + y + '"' + (draft.year === y ? ' selected' : '') + '>' + y + '</option>';
            }).join('') +
          '</select>' +
        '</label>' +
        '<div class="form-grid__full wizard__year-tip" id="wz-tip">' +
          '选好之后这里会说明它对算法的影响。' +
        '</div>' +
        '<label>姓名 <span class="optional">选填</span>' +
          '<input type="text" id="wz-name" class="input" maxlength="20" value="' + UI.esc(draft.name) + '" placeholder="会出现在导出的规划书里">' +
        '</label>' +
        '<label>学校 <span class="optional">选填</span>' +
          '<input type="text" id="wz-school" class="input" maxlength="30" value="' + UI.esc(draft.school) + '" placeholder="例如：XX大学">' +
        '</label>' +
      '</div>';
  }

  var STEPS = [
    { key: 'welcome', render: stepWelcome, next: '下一步' },
    { key: 'privacy', render: stepPrivacy, next: '我知道了' },
    { key: 'profile', render: stepProfile, next: '开始使用', last: true }
  ];

  /* ---------- 向导主体 ---------- */

  function open(onDone) {
    var root = document.getElementById('modal-root');
    if (!root) return;

    /* 已经有向导开着就不重复弹 */
    if (document.querySelector('.wizard-mask')) return;

    /* 老用户重看向导时，把已经填过的信息带出来 */
    var p = AICS.Store.get().profile || {};
    draft = { year: p.year || '', name: p.name || '', school: p.school || '' };

    var mask = document.createElement('div');
    mask.className = 'modal-mask wizard-mask';

    function close() {
      mask.classList.remove('is-in');
      setTimeout(function () { if (mask.parentNode) mask.parentNode.removeChild(mask); }, 220);
    }

    /* 每次切屏都重绘内容 */
    function paint() {
      var s = STEPS[step];
      mask.innerHTML =
        '<div class="modal wizard" role="dialog" aria-modal="true">' +
          '<div class="wizard__bar">' +
            STEPS.map(function (_, i) {
              return '<span class="wizard__dot' + (i === step ? ' is-on' : (i < step ? ' is-done' : '')) + '"></span>';
            }).join('') +
            '<span class="wizard__step-text">第 ' + (step + 1) + ' / ' + STEPS.length + ' 步</span>' +
          '</div>' +
          '<div class="modal__body wizard__body" id="wz-body">' + s.render() + '</div>' +
          '<div class="modal__foot">' +
            (step > 0
              ? '<button class="btn" data-wz="prev">上一步</button>'
              : '<button class="btn btn--ghost" data-wz="skip">先跳过</button>') +
            '<button class="btn btn--primary" data-wz="next">' + s.next + '</button>' +
          '</div>' +
        '</div>';

      /* 最后一步：年级选择要能实时显示影响说明 */
      if (s.key === 'profile') {
        var sel = mask.querySelector('#wz-year');
        var tip = mask.querySelector('#wz-tip');
        if (sel) {
          sel.addEventListener('change', function () {
            var v = sel.value;
            tip.textContent = v
              ? ('「' + v + '」的权重：' + YEAR_EXPLAIN[v] + '。')
              : '选好之后这里会说明它对算法的影响。';
            tip.classList.toggle('is-active', !!v);
          });
          if (sel.value) sel.dispatchEvent(new Event('change'));
        }
      }
    }

    /* 保存并结束 */
    function finish() {
      var body = mask.querySelector('#wz-body');
      var yearEl = body.querySelector('#wz-year');
      var year = yearEl ? yearEl.value : draft.year;

      if (!year) {
        UI.toast('请先选择你的年级', 'error');
        if (yearEl) yearEl.focus();
        return false;
      }

      draft.year = year;
      draft.name = (body.querySelector('#wz-name').value || '').trim();
      draft.school = (body.querySelector('#wz-school').value || '').trim();

      AICS.Store.set('profile', {
        year: draft.year,
        name: draft.name,
        school: draft.school,
        onboarded: true,
        onboardedAt: new Date().toISOString()
      });

      close();
      if (typeof onDone === 'function') onDone(draft);
      return true;
    }

    mask.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-wz]');
      if (!btn) return;
      var act = btn.getAttribute('data-wz');

      if (act === 'prev') { step = Math.max(0, step - 1); paint(); return; }
      if (act === 'skip') {
        /* 跳过 = 已经知道向导存在、选择现在不填，记 onboarded 让 maybeShow
           不再每次启动都重弹这三屏。
           刻意不写 onboardedAt：年级还是空的，「填表超过一年」的过期提醒
           （plan.js 按 onboardedAt 算）无从谈起，不该触发。
           年级空值的提醒交给各分析页的横幅接手（匹配诊断页有「你还没填年级」）。 */
        AICS.Store.set('profile', { onboarded: true });
        close();
        return;
      }
      if (act === 'next') {
        var s = STEPS[step];
        if (s.last) { finish(); return; }
        step = Math.min(STEPS.length - 1, step + 1);
        paint();
      }
    });

    step = 0;
    paint();
    root.appendChild(mask);
    requestAnimationFrame(function () { mask.classList.add('is-in'); });
  }

  AICS.Onboarding = {
    open: open,
    YEAR_EXPLAIN: YEAR_EXPLAIN,

    /* 首次启动时调用：没引导过就弹，引导过就不管。
       填完之后落到「使用指引」而不是直接进测评页——
       向导讲的是"这是什么、数据在哪"，指引讲的是"接下来怎么走"，
       两件事不能互相替代。刚填完年级的人最需要的是地图，不是被直接推进表单。 */
    maybeShow: function () {
      var p = AICS.Store.get().profile || {};
      if (p.onboarded) return false;

      open(function (d) {
        UI.toast('已按「' + d.year + '」的标准设置好了，下面是接下来的步骤', 'success');
        AICS.App.navigate('guide');
      });
      return true;
    }
  };

})(window.AICS);
