/* ============================================================
 * ui.js —— 公共界面组件与工具函数
 * ------------------------------------------------------------
 * 各个页面共用的东西都放这里：图标、Toast 提示、弹窗、空状态、
 * HTML 转义、事件委托。视图层只负责拼 HTML，交互统一走这里。
 * ============================================================ */
window.AICS = window.AICS || {};

(function (AICS) {
  'use strict';

  /* 转义 HTML，所有插进 innerHTML 的用户数据都要先过这一层 */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* 引用 index.html 里的 SVG 图标雪碧图 */
  /* 图标。viewBox 绝对不能省！
     雪碧图里的图形都画在 24×24 的坐标系里，而 .icon 的框只有 18px
     （小按钮里更小，15px）。没有 viewBox 就不会缩放，24 的图形按 1:1
     画进 18px 的框里，右边和下边直接被裁掉——
     铅笔图标的笔尖在 x=20，被裁掉后就只剩一道斜杠，
     用户根本认不出那是"编辑"。这种错误不报错、不崩，
     只是"看着有点怪"，所以特别容易漏。 */
  function icon(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' +
      '<use href="#i-' + name + '"></use></svg>';
  }

  /* 右上角浮出的提示条。
     第三个参数可选，用来放一个操作按钮，比如删除后的「撤销」。 */
  function toast(message, type, action) {
    var root = document.getElementById('toast-root');
    if (!root) return;

    var node = document.createElement('div');
    node.className = 'toast toast--' + (type || 'info') + (action ? ' toast--action' : '');
    node.innerHTML =
      icon(type === 'error' ? 'alert' : (type === 'success' ? 'check' : 'info')) +
      '<span>' + esc(message) + '</span>' +
      (action ? '<button class="toast__act">' + esc(action.text) + '</button>' : '');

    function dismiss() {
      node.classList.remove('is-in');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 260);
    }

    if (action && typeof action.onClick === 'function') {
      node.querySelector('.toast__act').addEventListener('click', function () {
        action.onClick();
        dismiss();
      });
    }

    root.appendChild(node);
    /* 下一帧加上进场动画的类 */
    requestAnimationFrame(function () { node.classList.add('is-in'); });

    /* 带操作按钮的提示要多留一会儿，让人来得及点 */
    setTimeout(dismiss, action ? 6000 : (type === 'error' ? 4200 : 2600));
  }

  /* 通用弹窗。actions = [{ text, type, onClick }] */
  function modal(options) {
    var root = document.getElementById('modal-root');
    var wrap = document.createElement('div');
    wrap.className = 'modal-mask';

    var actionsHtml = (options.actions || []).map(function (a, i) {
      return '<button class="btn ' + (a.type === 'primary' ? 'btn--primary' :
        (a.type === 'danger' ? 'btn--danger' : '')) + '" data-midx="' + i + '">' +
        esc(a.text) + '</button>';
    }).join('');

    wrap.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal__head">' +
          '<h3>' + esc(options.title || '') + '</h3>' +
          '<button class="icon-btn" data-close="1" title="关闭">' + icon('x') + '</button>' +
        '</div>' +
        '<div class="modal__body">' + (options.html || '') + '</div>' +
        (actionsHtml ? '<div class="modal__foot">' + actionsHtml + '</div>' : '') +
      '</div>';

    function close() {
      wrap.classList.remove('is-in');
      setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 200);
    }

    wrap.addEventListener('click', function (e) {
      if (e.target === wrap || e.target.closest('[data-close]')) { close(); return; }
      var btn = e.target.closest('[data-midx]');
      if (btn) {
        var action = options.actions[Number(btn.getAttribute('data-midx'))];
        /* onClick 返回 false 表示不关闭弹窗 */
        var keep = action && action.onClick && action.onClick(wrap) === false;
        if (!keep) close();
      }
    });

    /* 把关闭函数挂到元素上，这样弹窗内部的按钮（比如「设为目标方向」）
       也能通过 closest('.modal-mask').__close() 把弹窗关掉 */
    wrap.__close = close;

    root.appendChild(wrap);
    requestAnimationFrame(function () { wrap.classList.add('is-in'); });
    if (options.onMount) options.onMount(wrap);
    return { close: close, el: wrap };
  }

  /* 确认对话框，比原生 confirm 好看且风格统一 */
  function confirm(message, onYes, yesText) {
    modal({
      title: '确认操作',
      html: '<p class="modal__text">' + esc(message) + '</p>',
      actions: [
        { text: '取消' },
        { text: yesText || '确定', type: 'danger', onClick: onYes }
      ]
    });
  }

  /* 空状态占位：没做测评、没有任务时都用它 */
  function empty(options) {
    return '<div class="empty">' +
      '<div class="empty__icon">' + icon(options.icon || 'info') + '</div>' +
      '<h3>' + esc(options.title || '这里还是空的') + '</h3>' +
      '<p>' + esc(options.desc || '') + '</p>' +
      (options.action ? '<button class="btn btn--primary" data-action="' + options.action +
        '">' + esc(options.actionText || '去处理') + '</button>' : '') +
      '</div>';
  }

  /* 页面统一的大标题区 */
  function pageHeader(title, desc, extraHtml) {
    return '<div class="page-head">' +
      '<div><h1>' + esc(title) + '</h1><p>' + esc(desc) + '</p></div>' +
      (extraHtml ? '<div class="page-head__extra">' + extraHtml + '</div>' : '') +
      '</div>';
  }

  /* 进度条 */
  function progress(percent, color) {
    var p = Math.max(0, Math.min(100, percent || 0));
    return '<div class="progress"><div class="progress__bar" style="width:' + p + '%' +
      (color ? ';background:' + color : '') + '"></div></div>';
  }

  /* 标签胶囊 */
  function tag(text, tone) {
    return '<span class="tag tag--' + (tone || 'default') + '">' + esc(text) + '</span>';
  }

  /* 语义色表：深色主题用荧光色，亮色主题用压暗版。
     荧光色（#00e5a0 之类）在白底上只有 1.5:1，等于看不见，
     所以凡是写进 HTML 或画进 canvas 的颜色都得走 tone()，
     不能在页面代码里写死十六进制。 */
  var TONES = {
    dark:  { accent: '#00e5ff', accent2: '#7c5cff', ok: '#00e5a0', warn: '#ffb020',
             danger: '#ff5c7c', mid: '#4dd0e1', neutral: '#8b97b0' },
    light: { accent: '#0a6a85', accent2: '#6d4aff', ok: '#047857', warn: '#b45309',
             danger: '#be123c', mid: '#0a6a85', neutral: '#5f6b82' }
  };

  function isLight() {
    return document.documentElement.getAttribute('data-theme') === 'light';
  }

  /* 取一个语义色，按当前主题解析 */
  function tone(name) {
    var set = TONES[isLight() ? 'light' : 'dark'];
    return set[name] || set.accent;
  }

  /* 折线图用的循环色板（每条线一色）。同样分主题——
     荧光色系画在白底画布上会糊成一片，分不清哪条是哪条。 */
  var PALETTES = {
    dark:  ['#00e5ff', '#7c5cff', '#00e5a0', '#ffb020', '#ff5c7c', '#4dd0e1', '#b388ff', '#ffd54f'],
    light: ['#0a6a85', '#6d4aff', '#047857', '#b45309', '#be123c', '#0891b2', '#7c3aed', '#a16207']
  };

  function tonePalette() {
    return PALETTES[isLight() ? 'light' : 'dark'];
  }

  /* 按匹配度给一个颜色：高分偏绿、中间偏黄、低分偏红。
     这些颜色不只用在文字上，图表（canvas）也读它，
     所以主题一变必须重绘，app.js 里切主题时会重新渲染当前页。 */
  function scoreColor(score) {
    if (score >= 75) return tone('ok');
    if (score >= 55) return tone('mid');
    if (score >= 40) return tone('warn');
    return tone('danger');
  }

  /* 按匹配度给一句人话评价 */
  function scoreLabel(score) {
    if (score >= 80) return '高度契合';
    if (score >= 65) return '比较契合';
    if (score >= 50) return '可以尝试';
    if (score >= 35) return '需要补不少';
    return '不太建议';
  }

  /* ---------- 日期选择框 ----------
     为什么不直接用 <input type="date">：
     空值的时候浏览器会往框里画一排占位字符。中文环境下这排字是
     「yyyy/mm/日」——英文格式混着一个中文字，看着像坏了；
     而且它用的是系统字体和颜色，和界面里其它提示文案不是一个风格。
     我们又改不了那串字符本身（规范里它不可定制），
     所以外面包一层：还没开始编辑时把原生占位涂成透明，
     在上面盖一行我们自己的提示字。

     有值时显示的是真实日期（2026/10/05），那个留着——它本来就是内容。

     focusHint 是光标点进去之后换的那句话。加它是因为学生看完截图问
     "所以现在日期没法直接输入，只能点旁边选是吗"——他能看见"截止日期"
     几个字，但光标点进去框里毫无变化，根本看不出这里还能打字。
     现在点进去会变成"可直接输入"，一眼就知道两种方式都行。

     aria-label 也不能省：这个框在无障碍树里是 role="Date"，
     不给名字的话读屏软件只会念一个没有标签的日期控件。 */
  function dateField(id, cls, value, placeholder, focusHint) {
    var ph = placeholder || '选择日期';
    return '<span class="date-field">' +
      '<input type="date" id="' + esc(id) + '" class="' + esc(cls || 'input') + '"' +
        ' aria-label="' + esc(ph) + '"' +
        (value ? ' value="' + esc(value) + '"' : '') + '>' +
      '<span class="date-field__ph"' +
        (focusHint ? ' data-focus="' + esc(focusHint) + '"' : '') + '>' +
        esc(ph) + '</span>' +
    '</span>';
  }

  /* 给日期框挂状态。每次插入新 DOM（渲染页面、开弹窗、加完任务清空输入框）
     都要调一次，否则刚清空的那个框会一直显示上一次的日期文本。

     两个状态：
       has-value   有值了 → 显示真实日期，提示字让位
       is-typing   用户开始敲键盘了 → 把原生那排分段显示出来

     为什么需要 is-typing：光标刚点进去、还没输入的时候，Chrome 会画出
     一排「yyyy/mm/日」这样的分段占位。这排字是浏览器按自己的区域数据画的，
     不同机器还不一样（同一份代码，我这边渲染成「年/月/日」，
     学生机器上是「yyyy/mm/日」）——中英混排，看着像坏了。
     既然控制不了它长什么样，就别让它在"还没开始编辑"的时候出现。
     等他真的敲了第一个数字，再把分段显出来，那时候他需要看见自己输的是什么。 */
  function syncDateFields(scope) {
    var list = (scope || document).querySelectorAll('input[type="date"]');
    [].slice.call(list).forEach(function (inp) {
      if (!inp.__dateSynced) {
        inp.__dateSynced = true;

        var sync = function () { inp.classList.toggle('has-value', !!inp.value); };
        inp.addEventListener('input', sync);
        inp.addEventListener('change', sync);

        /* 数字、退格、方向键都算"开始编辑"。方向键要算进去——
           用上下键翻分段是原生日期框的常规操作，那时候也得看得见 */
        inp.addEventListener('keydown', function (e) {
          if (/^[0-9]$/.test(e.key) ||
              e.key === 'Backspace' || e.key === 'Delete' ||
              e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
              e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            inp.classList.add('is-typing');
          }
        });

        /* 离开时清掉：没填成日期的话，提示字要回来 */
        inp.addEventListener('blur', function () {
          inp.classList.remove('is-typing');
          sync();
        });

        inp.__dateSync = sync;
      }
      inp.classList.toggle('has-value', !!inp.value);
    });
  }

  AICS.UI = {
    esc: esc,
    icon: icon,
    dateField: dateField,
    syncDateFields: syncDateFields,
    toast: toast,
    modal: modal,
    confirm: confirm,
    empty: empty,
    pageHeader: pageHeader,
    progress: progress,
    tag: tag,
    tone: tone,
    tonePalette: tonePalette,
    scoreColor: scoreColor,
    scoreLabel: scoreLabel
  };

})(window.AICS);
