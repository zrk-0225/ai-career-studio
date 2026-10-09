/* ============================================================
 * app.js —— 路由、全局事件委托、启动流程
 * ------------------------------------------------------------
 * 整个应用只有这里一个全局 click 监听，所有按钮通过 data-action
 * 属性被分发到对应处理函数，视图内部只处理需要局部刷新的交互。
 * 路由用 URL hash，浏览器前进后退可用，刷新页面也不会丢当前页。
 *
 * 重要：每次渲染都会把 #view 元素整个换掉，而不是只换 innerHTML。
 * 因为视图的 mount() 是把监听器绑在 #view 上的，如果复用同一个
 * 元素，每访问一次页面就会多绑一层，点一下按钮等于点好几下。
 * ============================================================ */
window.AICS = window.AICS || {};

(function (AICS) {
  'use strict';

  var UI = AICS.UI;

  /* 构建标记。每次改完重新打包就把这里 +1。
     加这个是因为真踩过坑：改完代码让学生刷新，他说"还是老样子"——
     一查，他打开的是桌面上另一份解压出来的旧副本，Ctrl+Shift+R 当然没用，
     因为它压根不是缓存问题，是另一个文件夹。
     现在设置弹窗底部和控制台都会打印这行字，打开一看就知道
     自己运行的是哪一版、要不要重新解压。 */
  var BUILD = '2026-10-09.1';
  AICS.BUILD = BUILD;

  /* 侧边栏导航配置，顺序就是显示顺序。
     「开始」这一组是"上手路径"，所以使用指引排在最前面——
     它的副标题就是"第一次用？从这里开始"，放进「支持」会自相矛盾。 */
  var NAV = [
    { group: '开始', items: [
      { route: 'guide',     name: '使用指引', icon: 'help' },
      { route: 'dashboard', name: '概览', icon: 'grid' },
      { route: 'assess',    name: '自我认知', icon: 'user' }
    ]},
    { group: '探索', items: [
      { route: 'directions', name: '方向图谱', icon: 'compass' },
      { route: 'match',      name: '匹配诊断', icon: 'chart' },
      { route: 'compare',    name: '方向对比', icon: 'scale' },
      { route: 'growth',     name: '成长曲线', icon: 'trend' }
    ]},
    { group: '行动', items: [
      { route: 'roadmap', name: '四年规划', icon: 'calendar' },
      { route: 'kanban',  name: '任务看板', icon: 'kanban' }
    ]},
    { group: '支持', items: [
      { route: 'assistant', name: 'AI 助手', icon: 'bot' },
      { route: 'resources', name: '资源库',   icon: 'book' },
      { route: 'report',    name: '我的规划书', icon: 'file' },
      { route: 'about',     name: '关于作者', icon: 'star' }
    ]}
  ];

  var currentRoute = 'dashboard';

  /* ---------- 移动端抽屉菜单 ---------- */

  /* 手机上侧边栏默认收在屏幕外，靠这个开关拉出来 */
  function openNav() { document.body.classList.add('nav-open'); }
  function closeNav() { document.body.classList.remove('nav-open'); }
  function toggleNav() { document.body.classList.toggle('nav-open'); }

  /* ---------- 侧边栏 ---------- */

  function renderSidebar() {
    var state = AICS.Store.get();
    var answered = AICS.Calc.answeredCount(state.assess.answers || {});
    var totalQ = AICS.Calc.totalQuestions();
    var percent = totalQ ? Math.round((answered / totalQ) * 100) : 0;

    var html = '<div class="brand">' +
        '<div class="brand__logo">' + UI.icon('sparkles') + '</div>' +
        '<div class="brand__text"><strong>AI 领航</strong><span>职业规划工作台</span></div>' +
        '<button class="icon-btn nav-close" data-action="menu-toggle" title="收起菜单">' +
          UI.icon('x') + '</button>' +
      '</div>' +
      '<nav class="nav">' +
        NAV.map(function (g) {
          return '<div class="nav__group">' +
            '<div class="nav__label">' + g.group + '</div>' +
            g.items.map(function (item) {
              return '<a class="nav__item" href="#/' + item.route + '" data-route="' + item.route + '">' +
                UI.icon(item.icon) + '<span>' + item.name + '</span></a>';
            }).join('') +
          '</div>';
        }).join('') +
      '</nav>' +
      '<div class="side-foot">' +
        '<div class="side-progress">' +
          '<div class="side-progress__top"><span>测评完成度</span><strong>' + percent + '%</strong></div>' +
          UI.progress(percent, UI.tone('accent2')) +
        '</div>' +
        '<div class="side-actions">' +
          '<button class="icon-btn" data-action="open-settings" title="设置">' + UI.icon('settings') + '</button>' +
          '<button class="icon-btn" data-action="theme-toggle" title="切换主题">' +
            UI.icon(state.settings.theme === 'dark' ? 'sun' : 'moon') + '</button>' +
        '</div>' +
      '</div>';

    var side = document.getElementById('sidebar');
    if (side) side.innerHTML = html;
  }

  /* 高亮当前导航项 */
  function markActiveNav() {
    document.querySelectorAll('.nav__item').forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('data-route') === currentRoute);
    });
  }

  /* ---------- 路由 ---------- */

  /* 把还开着的弹窗收掉。

     弹窗挂在 #modal-root 里，不在 #view 内部，所以换页碰不到它们。
     后果是：开着弹窗按浏览器后退，新页面渲染出来了，一层遮罩还压在
     上面，用户得先手动关一次才能看见——他不知道那是上一页留下的。

     优先走弹窗自己的 __close()，因为 UI.modal 用 key 记着"谁还开着"，
     直接删节点会把那个记号留在表里，之后同一种弹窗就再也打不开了。
     首次向导没挂 __close，只能直接删。 */
  function closeModals() {
    var root = document.getElementById('modal-root');
    if (!root) return;
    [].slice.call(root.children).forEach(function (node) {
      if (typeof node.__close === 'function') node.__close();
      else if (node.parentNode) node.parentNode.removeChild(node);
    });
  }

  /* 数据被整体换掉之后，让各页面把存在内存里的状态复位。
     这些状态不写进存档（筛选条件、成对对比的进度），
     所以导入备份或清空数据时它们不会跟着变——
     本来是"按假期筛选"的看板，导入一份没有假期任务的备份后，
     每列都显示"没有符合筛选条件的任务"，筛选条上的计数却是全量的，
     用户只会以为导入失败、数据丢了。 */
  function resetViewState() {
    Object.keys(AICS.Views).forEach(function (r) {
      var v = AICS.Views[r];
      if (v && typeof v.resetState === 'function') v.resetState();
    });
  }

  function renderRoute() {
    var view = AICS.Views[currentRoute] || AICS.Views.dashboard;
    var old = document.getElementById('view');
    if (!old) return;

    closeModals();

    /* 关键：换一个全新的 #view 元素。
       视图的 mount() 会把监听器绑在这个元素上，复用同一个元素会导致
       每访问一次就多绑一层，点一下按钮触发好几次。 */
    var viewEl = document.createElement('div');
    viewEl.className = 'view';
    viewEl.id = 'view';
    old.parentNode.replaceChild(viewEl, old);

    /* 换页前先把上一页的图表登记清掉，避免重绘到已移除的画布上 */
    AICS.Charts.clear();

    /* 记下当前在哪一页，AI 助手会读它来做上下文相关的回答。
       视图可以在 mount 里往里补细节，比如匹配诊断页会写上当前选中的方向。 */
    AICS.PageContext = { route: currentRoute, directionId: '' };

    viewEl.innerHTML = '<div class="view__inner">' + view.render() + '</div>';
    window.scrollTo(0, 0);

    /* 更新顶栏标题 */
    var titleEl = document.getElementById('topbar-title');
    var descEl = document.getElementById('topbar-desc');
    if (titleEl) titleEl.textContent = view.title || '';
    if (descEl) descEl.textContent = view.desc || '';

    if (typeof view.mount === 'function') {
      try { view.mount(viewEl); } catch (e) { console.error('[app] 视图初始化失败：', e); }
    }

    markActiveNav();
    closeNav();      // 移动端点了导航就自动收起抽屉
  }

  function navigate(route) {
    if (!AICS.Views[route]) route = 'dashboard';
    currentRoute = route;
    if (window.location.hash !== '#/' + route) {
      window.location.hash = '#/' + route;   // 会触发 hashchange，由它去渲染
    } else {
      renderRoute();
    }
  }

  /* 重新渲染当前页，数据变化后由视图自己调用 */
  function refresh() { renderRoute(); }

  /* 只刷新侧边栏统计，不重绘页面内容 */
  function refreshChrome() {
    renderSidebar();
    markActiveNav();
  }

  /* ---------- 弹窗：个人信息与设置 ---------- */

  /* 防重入交给 UI.modal 的 key（见 ui.js）。
     原来这里是自己查 DOM 里有没有 #f-year，靠"年级下拉只在设置弹窗里出现"
     来判断——但弹窗关闭有 200ms 淡出，节点还在，这段时间内重开会被
     静默挡掉，表现成"点了没反应"。key 在关闭那一刻就销号，没这个问题。 */
  function settingsModal() {
    var s = AICS.Store.get().settings;
    var p = AICS.Store.get().profile;

    var html =
      '<div class="form-section">' +
        '<h4>个人信息</h4>' +
        '<p class="muted">这些信息会出现在导出的规划书里，只保存在你自己电脑上。' +
          '其中的「年级」会影响匹配度算法，不同阶段看重的因素不一样。</p>' +
        '<div class="form-grid">' +
          '<label>姓名<input type="text" id="f-name" class="input" maxlength="20" value="' + UI.esc(p.name) + '" placeholder="你的名字"></label>' +
          '<label>学校<input type="text" id="f-school" class="input" maxlength="30" value="' + UI.esc(p.school) + '" placeholder="例如：XX大学"></label>' +
          '<label>专业<input type="text" id="f-major" class="input" maxlength="30" value="' + UI.esc(p.major) + '" placeholder="人工智能"></label>' +
          /* 必须留一个空选项。年级的默认值是空的（见 store.js 的说明），
             如果没有空选项，跳过向导的用户一进设置，浏览器会自动选中第一项
             「大一」，他点一次保存就被静默改了年级、权重跟着全变。 */
          '<label>年级<select id="f-year" class="input">' +
            '<option value=""' + (p.year ? '' : ' selected') + '>未填写</option>' +
            AICS.YEARS.map(function (y) {
              return '<option value="' + y + '"' + (p.year === y ? ' selected' : '') + '>' + y + '</option>';
            }).join('') +
          '</select></label>' +
        '</div>' +
      '</div>' +
      /* 外观段：主题的唯一"看得见文字"的入口。
         侧边栏底部那个图标按钮在手机上要先开汉堡菜单才露出来，
         设置弹窗在顶栏直接可达，所以把选项放这里。 */
      '<div class="form-section">' +
        '<h4>外观</h4>' +
        '<p class="muted">默认深色模式。切换后保存即生效，下次打开保持这个选择。</p>' +
        '<div class="form-grid">' +
          '<label class="switch"><input type="radio" name="f-theme" value="dark"' +
            (s.theme === 'dark' ? ' checked' : '') + '><span>深色模式</span></label>' +
          '<label class="switch"><input type="radio" name="f-theme" value="light"' +
            (s.theme === 'light' ? ' checked' : '') + '><span>浅色模式</span></label>' +
        '</div>' +
      '</div>' +
      '<div class="form-section">' +
        '<h4>AI 助手配置</h4>' +
        '<p class="muted">不填也能用，助手会走内置的离线知识库。填写后可以接入真实大模型，回答会更个性化。</p>' +
        '<label class="switch">' +
          '<input type="checkbox" id="f-useapi"' + (s.useApi ? ' checked' : '') + '>' +
          '<span>启用在线大模型</span>' +
        '</label>' +
        '<div class="form-grid">' +
          '<label>接口地址<input type="text" id="f-apibase" class="input" value="' + UI.esc(s.apiBase) + '" placeholder="https://api.deepseek.com"></label>' +
          '<label>模型名称<input type="text" id="f-apimodel" class="input" value="' + UI.esc(s.apiModel) + '" placeholder="deepseek-chat"></label>' +
          '<label class="form-grid__full">API Key<input type="password" id="f-apikey" class="input" value="' + UI.esc(s.apiKey) + '" placeholder="sk-..."></label>' +
        '</div>' +
        '<p class="form-hint">支持任何 OpenAI 兼容接口，例如 DeepSeek、通义千问、智谱、Kimi。' +
          '密钥只存在你自己的浏览器里，不会发往第三方。' +
          '注意：部分服务商不允许网页直接调用，若报跨域错误请改用其他服务商或保持离线模式。</p>' +
      '</div>' +
      dataSection() +
      /* 构建标记：如果这里显示的不是你刚拿到的那一版，
         说明打开的是旧的副本（不是缓存问题，Ctrl+Shift+R 没用） */
      '<p class="build-stamp">当前版本 <b>' + BUILD + '</b>' +
        '<span>如果这里不是最新的版本号，说明你打开的是旧副本，重新解压一次最新的压缩包</span></p>';

    UI.modal({
      key: 'settings',
      title: '设置',
      html: html,
      actions: [
        { text: '取消' },
        {
          text: '保存',
          type: 'primary',
          onClick: function (wrap) {
            var oldYear = AICS.Store.get().profile.year;
            var newYear = wrap.querySelector('#f-year').value;
            var oldTheme = AICS.Store.get().settings.theme;

            AICS.Store.set('profile', {
              name: (wrap.querySelector('#f-name').value || '').trim(),
              school: (wrap.querySelector('#f-school').value || '').trim(),
              major: (wrap.querySelector('#f-major').value || '').trim() || '人工智能',
              year: newYear
            });
            /* 主题单选没勾中的话（理论上不会）退回打开弹窗时的值 */
            var themeSel = wrap.querySelector('input[name="f-theme"]:checked');
            var newTheme = themeSel ? themeSel.value : s.theme;

            AICS.Store.set('settings', {
              useApi: wrap.querySelector('#f-useapi').checked,
              apiBase: (wrap.querySelector('#f-apibase').value || '').trim(),
              apiModel: (wrap.querySelector('#f-apimodel').value || '').trim(),
              apiKey: (wrap.querySelector('#f-apikey').value || '').trim(),
              theme: newTheme
            });

            /* 主题变了要立刻应用并重绘——和侧边栏那个切换按钮走同一套逻辑，
               不重绘的话内联样式里的旧主题颜色会留着 */
            var themeChanged = oldTheme !== newTheme;
            if (themeChanged) applyTheme();

            /* 年级变了会影响匹配度权重，提醒一句。
               空值是有意义的状态（用户没填），直接拼进引号里会变成「」很难看 */
            if (oldYear !== newYear) {
              UI.toast('已保存。年级从「' + (oldYear || '未填写') + '」改为「' + (newYear || '未填写') +
                       '」，匹配度权重已重算');
            } else if (themeChanged) {
              UI.toast('已保存，并切换到' + (newTheme === 'dark' ? '深色' : '浅色') + '模式');
            } else {
              UI.toast('设置已保存', 'success');
            }
            refresh();
            refreshChrome();
          }
        }
      ],
      onMount: function (wrap) { wireImportFile(wrap); }
    });
  }

  /* 数据管理区：备份、恢复、清空。放在设置里而不是规划书页——
     它属于应用级操作，不属于某一份文档的内容 */
  function dataSection() {
    var state = AICS.Store.get();
    var answered = AICS.Calc.answeredCount(state.assess.answers || {});
    var stats = [
      { n: answered, label: '测评答案' },
      { n: (state.tasks || []).length, label: '任务' },
      { n: (state.history || []).length, label: '成长记录' },
      { n: (state.chat || []).length, label: '对话' }
    ];

    return '<div class="form-section">' +
      '<h4>数据管理</h4>' +
      '<p class="muted">所有数据都保存在你自己电脑的浏览器里，不会上传到任何服务器。' +
        '换电脑或重装浏览器前，记得先导出备份。</p>' +
      '<div class="report-stats">' +
        stats.map(function (s) {
          return '<span>' + s.label + ' ' + s.n + '</span>';
        }).join('') +
      '</div>' +
      '<div class="btn-row">' +
        '<button class="btn" data-action="backup-export">' + UI.icon('download') + ' 导出数据备份</button>' +
        '<button class="btn" data-action="backup-import">' + UI.icon('upload') + ' 导入数据备份</button>' +
        '<button class="btn btn--danger" data-action="data-reset">' + UI.icon('trash') + ' 清空所有数据</button>' +
      '</div>' +
      '<input type="file" id="import-file" accept=".json,application/json" hidden>' +
    '</div>';
  }

  /* 绑定备份文件的读取。文件框在弹窗里，所以要等弹窗挂载后再绑 */
  function wireImportFile(scope) {
    var input = scope.querySelector('#import-file');
    if (!input) return;
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;

      var reader = new FileReader();

      reader.onload = function () {
        if (AICS.Store.importJSON(String(reader.result))) {
          /* 说清楚替换成了什么，而不是笼统一句"导入成功"。
             用户得知道自己刚拿到的是哪一份备份。 */
          var t = AICS.Store.get();
          UI.toast('已导入：测评答案 ' + Object.keys(t.assess.answers).length +
            ' 条 · 任务 ' + (t.tasks || []).length +
            ' 条 · 成长记录 ' + (t.history || []).length + ' 条', 'success');
          /* 弹窗里的内容已经过期了，关掉重开一次 */
          var mask = input.closest('.modal-mask');
          if (mask && mask.__close) mask.__close();
          /* 主题也来自备份，必须重新应用一次。
             不清的话 <html data-theme> 还是旧的，页面和图表仍是旧配色，
             而侧边栏那个太阳/月亮图标读的是数据、已经翻过来了——
             用户下一次点切换会算出和当前一样的值，第一下像是坏了。 */
          applyTheme();
          resetViewState();
          refresh();
          refreshChrome();
        } else {
          UI.toast('导入失败：这不是本工作台导出的备份文件', 'error');
        }
      };

      /* 文件读不出来时（被占用、权限不足、中途拔出 U 盘）必须给个提示，
         否则界面毫无反应，用户会以为点了没生效。 */
      reader.onerror = function () {
        UI.toast('文件读取失败，换一个文件试试', 'error');
      };

      /* 导入是"整体替换"，不是合并——现在电脑上的测评答案、任务、
         成长记录都会被覆盖掉，所以先确认一次再读文件。 */
      UI.confirm('导入会整体替换你现在电脑上的全部数据（测评答案、任务、成长记录）。' +
        '如果只是想合并，请先导出当前数据备份。确定继续吗？',
        function () { reader.readAsText(file); }, '确定导入');

      input.value = '';   // 允许重复选同一个文件
    });
  }

  /* ---------- 主题 ---------- */

  function applyTheme() {
    var theme = AICS.Store.get().settings.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }

  /* ---------- 全局事件分发 ---------- */

  var ACTIONS = {
    /* 导航类 */
    'go-assess':     function () { navigate('assess'); },
    'go-directions': function () { navigate('directions'); },
    'go-match':      function () { navigate('match'); },
    'go-compare':    function () { navigate('compare'); },
    'go-kanban':     function () { navigate('kanban'); },
    'go-roadmap':    function () { navigate('roadmap'); },
    'go-assistant':  function () { navigate('assistant'); },
    'go-report':     function () { navigate('report'); },
    'go-guide':      function () { navigate('guide'); },

    /* 重新看一遍首次启动向导（年级已经填过的话会带出来） */
    'show-onboarding': function () {
      AICS.Onboarding.open(function (d) {
        UI.toast('设置已更新，匹配权重按「' + d.year + '」重算', 'success');
        refresh();
        refreshChrome();
      });
    },

    /* 清空成长记录 */
    'clear-history': function () {
      UI.confirm('确定要清空所有测评历史记录吗？成长曲线会一起消失，当前的测评结果不受影响。',
        function () {
          AICS.Store.set('history', []);
          UI.toast('成长记录已清空');
          refresh();
        }, '清空记录');
    },

    /* 移动端抽屉 */
    'menu-toggle':   function () { toggleNav(); },

    /* 设置与主题 */
    'open-settings': function () { settingsModal(); },
    'theme-toggle':  function () {
      var next = AICS.Store.get().settings.theme === 'dark' ? 'light' : 'dark';
      AICS.Store.set('settings', { theme: next });
      applyTheme();
      /* 整页重绘，不能只重画图表——
         像分数这种颜色是渲染时写进 HTML 内联样式的（UI.scoreColor），
         不重绘的话切到浅色主题后它们还留着深色主题的荧光色。
         renderRoute 会清掉旧图表并由各页的 mount 重新画，所以不用再 redrawAll。 */
      refresh();
      UI.toast(next === 'dark' ? '已切换到深色模式' : '已切换到浅色模式');
    },

    /* 方向相关 */
    'dir-detail': function (el) {
      AICS.Views.directions.detail(el.getAttribute('data-id'));
    },
    'set-target': function (el, ev) {
      var id = el.getAttribute('data-id');
      var dir = AICS.Directions.byId(id);
      if (!dir) return;
      AICS.Store.set('profile', { targetId: id });
      /* 提示里带上下一步。设目标方向不是终点——它真正的效果在四年规划
         和匹配诊断里（那两个页面会按这个方向重新算），但用户点完只看到
         一句"设置成功"，不知道该去哪看。给个能直接点的入口。 */
      UI.toast('已把「' + dir.name + '」设为目标方向', 'success', {
        text: '看四年规划',
        onClick: function () { navigate('roadmap'); }
      });
      /* 如果是在弹窗里点的，把弹窗关掉，否则用户看不到页面变化 */
      var mask = el.closest('.modal-mask');
      if (mask && mask.__close) mask.__close();
      refresh();
    },
    'clear-target': function () {
      var had = AICS.Directions.byId(AICS.Store.get().profile.targetId);
      AICS.Store.set('profile', { targetId: '' });
      UI.toast(had
        ? '已取消「' + had.name + '」，毕业去向会回到自动判断'
        : '已取消目标方向');
      refresh();
      refreshChrome();
    },

    /* 测评 */
    'reset-assess': function () {
      UI.confirm('确定要清空所有测评答案重新来过吗？', function () {
        AICS.Store.set('assess', { answers: {}, finished: false, finishedAt: '' });
        UI.toast('已清空测评答案');
        refresh();
        refreshChrome();
      }, '清空重答');
    },
    'save-snapshot': function () {
      var r = AICS.Calc.saveSnapshot();
      if (!r.ok) { UI.toast(r.message || '保存失败', 'error'); return; }

      /* 两种结果要分开说。原来不管哪种都弹"已保存…可以对比"，
         而实际上同一天重复点根本不会新增记录，弹完页面也纹丝不动——
         学生就是这么以为"点了没反应"的。 */
      if (r.duplicated) {
        UI.toast('和上一条记录完全一样，没有重复记（共 ' + r.count + ' 条）', 'info');
      } else {
        UI.toast('已记录第 ' + r.count + ' 条', 'success');
      }
      /* 记完必须重绘这一页，否则新点不会出现在图上 */
      refresh();
    },

    /* 任务 */
    'task-done': function (el) {
      var id = el.getAttribute('data-id');
      var all = AICS.Store.get().tasks || [];
      var task = all.filter(function (t) { return t.id === id; })[0];
      var tasks = all.map(function (t) {
        return t.id === id ? Object.assign({}, t, { status: 'done' }) : t;
      });
      AICS.Store.set('tasks', tasks);

      /* 这个任务如果对应四年规划里的某一项，把那一项也勾上 */
      var synced = task ? AICS.syncRoadmapFromTask(task.title, 'done') : false;

      UI.toast(synced ? '任务已完成，四年规划里对应项也打勾了' : '任务已完成', 'success');
      refresh();
      refreshChrome();
    },
    /* 这里原来有个 'import-roadmap'：一键把规划任务整批导进看板。
       v2 第二轮去掉了，改成每条规划任务自己带「拆成待办」——
       整批导入会把看板变成规划页的副本，两个页面就重复了。 */

    /* 切换毕业去向。传空值表示恢复自动推断 */
    'set-track': function (el) {
      var v = el.getAttribute('data-v') || '';
      AICS.Store.set('plan', { track: v });
      if (v) {
        var t = AICS.PLAN_TRACKS.filter(function (x) { return x.key === v; })[0];
        UI.toast('已切换到「' + (t ? t.name : v) + '」路线，分岔的任务已更新', 'success');
      } else {
        UI.toast('已恢复按目标方向自动判断');
      }
      refresh();
    },

    /* 助手 */
    'ask-quick': function (el) {
      AICS.askInAssistant(el.getAttribute('data-q'));
    },
    'res-clear': function () {
      AICS.resetResourceSearch();
      refresh();
    },
    'chat-clear': function () {
      UI.confirm('确定要清空所有对话记录吗？', function () {
        AICS.Store.set('chat', []);
        UI.toast('对话已清空');
        refresh();
      }, '清空');
    },

    /* 报告与数据 */
    'report-export':  function () { AICS.exportReport(); },
    'report-word':    function () { AICS.exportReportWord(); },
    'report-print':   function () { AICS.exportReportPDF(); },
    'backup-export':  function () { AICS.exportBackup(); },
    'backup-import':  function (el) {
      /* 文件选择框在设置弹窗里。按钮就在同一个弹窗内，正常都能找到。 */
      var input = document.getElementById('import-file');
      if (input) input.click();
    },
    'data-reset': function (el) {
      /* 记下触发它的弹窗，清空之后要一起关掉——里面的统计数字已经过期了 */
      var mask = el && el.closest ? el.closest('.modal-mask') : null;

      UI.confirm('这会清空测评答案、任务、对话、成长记录和所有设置，且无法恢复。建议先导出备份。确定继续吗？',
        function () {
          AICS.Store.reset();
          applyTheme();
          resetViewState();
          if (mask && mask.__close) mask.__close();
          UI.toast('所有数据已清空');
          /* navigate 内部已经做过一次 Charts.clear()，
             并让概览页重新登记了它的图表。这里不能再清一次——
             那样会把刚登记的图表注销掉，之后拖窗口大小就不会重绘了。 */
          navigate('dashboard');
          refreshChrome();
          /* 清空等于回到全新状态，向导应该重新走一遍把年级问清楚 */
          AICS.Onboarding.maybeShow();
        }, '全部清空');
    }
  };

  /* 一个监听处理所有按钮 */
  document.addEventListener('click', function (e) {
    /* 侧边栏导航 */
    var navLink = e.target.closest('.nav__item');
    if (navLink) {
      e.preventDefault();
      navigate(navLink.getAttribute('data-route'));
      return;
    }

    /* 移动端：点遮罩关抽屉 */
    if (e.target.closest('.sidebar-backdrop')) {
      closeNav();
      return;
    }

    var el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.disabled) return;

    var name = el.getAttribute('data-action');

    /* 导航类的按钮如果出现在弹窗里（比如方向详情里的"去四年规划改"），
       要先把弹窗关掉。不然新页面渲染在弹窗底下，用户只看到弹窗还在，
       会以为点了没反应——他得再手动关一次才能看到已经跳过去了。 */
    if (name.indexOf('go-') === 0) {
      var mask = el.closest('.modal-mask');
      if (mask && mask.__close) mask.__close();
    }

    var handler = ACTIONS[name];
    if (handler) handler(el, e);
  });

  /* 手机上按 Esc 收起抽屉 */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNav();
  });

  /* ---------- 启动 ---------- */

  /* 两个任务标题是不是在说同一件事。

     没有词典可用，所以走字符集合：只留汉字、去掉重复字，
     重合数占较短标题的比例过半就算撞车。

     为什么这个口径够用：中文短标题基本一字一义。
     「用 PyTorch 完整训练一个深度学习模型」和「用 PyTorch 完整训练一个模型」
     去掉英文和重复字是 {用完整训练一个深度学习模型} 和 {用完整训练一个模型}，
     短的 9 个字全被长的包住 → 100%，判为撞车。

     反过来，讲的不是一件事的就不会误判。比如「把线代和概率的直觉补起来」
     和「系统学完机器学习经典算法并手推一遍」，只共享"学、的、一"三个字，
     比例 27%，放过。 */
  function titleClash(a, b) {
    function chars(s) {
      var seen = {}, out = [];
      String(s).replace(/[^一-龥]/g, '').split('').forEach(function (c) {
        if (!seen[c]) { seen[c] = 1; out.push(c); }
      });
      return out;
    }
    var A = chars(a), B = chars(b);
    if (!A.length || !B.length) return false;
    var shared = A.filter(function (c) { return B.indexOf(c) >= 0; }).length;
    return shared / Math.min(A.length, B.length) >= 0.75;
  }

  /* 启动自检：导航菜单、指引页清单、实际注册的视图，三者必须对齐。
     加这个是因为真出过一次——「方向对比」页做好了，按钮也能进去，
     但忘了加进侧边栏，用户根本找不到它。靠人眼检查这种东西不可靠。 */
  function selfCheck() {
    var navRoutes = [];
    NAV.forEach(function (g) {
      g.items.forEach(function (i) { navRoutes.push(i.route); });
    });

    var missing = Object.keys(AICS.Views).filter(function (r) {
      return navRoutes.indexOf(r) === -1;
    });
    var extra = navRoutes.filter(function (r) {
      return !AICS.Views[r];
    });

    if (missing.length) console.warn('[自检] 这些页面没有导航入口，用户找不到：', missing.join('、'));
    if (extra.length) console.warn('[自检] 导航指向了不存在的页面：', extra.join('、'));

    /* 指引页的页面清单也要和实际视图对齐 */
    if (AICS.Views.guide && AICS.Views.guide.pageList) {
      var listed = AICS.Views.guide.pageList();

      var notListed = Object.keys(AICS.Views).filter(function (r) {
        return listed.indexOf(r) === -1;
      });
      if (notListed.length) console.warn('[自检] 这些页面没写进使用指引的清单：', notListed.join('、'));

      /* 顺序也要一致：用户会拿侧边栏和指引页的清单对照着找，
         顺序对不上会让他多找一圈 */
      var firstDiff = -1;
      for (var i = 0; i < Math.max(navRoutes.length, listed.length); i++) {
        if (navRoutes[i] !== listed[i]) { firstDiff = i; break; }
      }
      if (firstDiff >= 0) {
        console.warn('[自检] 导航顺序和指引页清单顺序不一致，从第 ' + (firstDiff + 1) +
          ' 项开始：导航是「' + (navRoutes[firstDiff] || '无') +
          '」，清单是「' + (listed[firstDiff] || '无') + '」');
      }
    }

    /* AI 助手那张"路由 → 中文页名"的表也得跟着对齐。
       它是同一份路由集合的第四份副本，之前的自检没管它，
       所以漏了 guide 一直没被发现——在「使用指引」页提问时，
       发给大模型的系统提示词里会写"【用户当前正在看】guide"。 */
    var routeNames = AICS.Assistant && AICS.Assistant.routeNames;
    if (routeNames) {
      var noName = Object.keys(AICS.Views).filter(function (r) {
        return !routeNames[r];
      });
      if (noName.length) {
        console.warn('[自检] 这些页面没写进 AI 助手的页面名称表，' +
          '用户在那儿提问时提示词里会变成英文路由名：', noName.join('、'));
      }
    }

    /* 图标也要查。雪碧图里的图形画在 24×24 的坐标系里，
       .icon 少写一个 viewBox，24 的图形就会按 1:1 画进 18px 的框，
       右边和下边被裁掉——铅笔只剩一道斜杠，用户认不出那是"编辑"。
       这种错不报错不崩溃，只是"看着有点怪"，最容易漏。 */
    var noViewBox = [].slice.call(document.querySelectorAll('svg.icon')).filter(function (s) {
      return !s.getAttribute('viewBox');
    });
    if (noViewBox.length) {
      console.warn('[自检] 有 ' + noViewBox.length + ' 个图标没写 viewBox，' +
        '图形会被裁掉一部分（用到的图标：' +
        noViewBox.map(function (s) {
          var u = s.querySelector('use');
          return u ? u.getAttribute('href') : '?';
        }).join('、') + '）');
    }

    /* 方向学习路径的分岔表要能对上号。pathBranch 靠"时间前缀"匹配 path 里
       的某一步，写错一个字（比如「大三暑假」写成「大三暑期」）匹配就会落空，
       那一步会静默地保留就业版文案——选了读研的人还是会看到"准备秋招"，
       而且不报错、不崩溃，只能靠人眼发现。所以在这里拦一次。 */
    AICS.DIRECTIONS.forEach(function (dir) {
      if (!dir.pathBranch) return;

      var whens = (dir.path || []).map(function (s) {
        return String(s).split('：')[0];
      });

      Object.keys(dir.pathBranch).forEach(function (key) {
        if (!AICS.PLAN_TRACKS.some(function (t) { return t.key === key; })) {
          console.warn('[自检] 「' + dir.name + '」的 pathBranch 里有个不存在的路线「' + key + '」');
        }
        dir.pathBranch[key].forEach(function (b) {
          if (whens.indexOf(b.when) === -1) {
            console.warn('[自检] 「' + dir.name + '」的 pathBranch.' + key +
              ' 写了「' + b.when + '」，但它的学习路径里没有这一步，这段文案不会生效');
          }
        });
      });
    });

    /* 方向专项任务的来源是 path 里「大三」那一步。哪个方向的 path 改了措辞
       导致对不上，那个方向在四年规划里就会静默少一条专项任务——
       不报错、不崩溃，用户只是觉得"我的规划好像少了点什么"。 */
    var noPathStep = AICS.DIRECTIONS.filter(function (dir) {
      return !(dir.path || []).some(function (s) {
        return String(s).split('：')[0] === AICS.DIR_PATH_WHEN;
      });
    });
    if (noPathStep.length) {
      console.warn('[自检] 这些方向的路径里没有「' + AICS.DIR_PATH_WHEN +
        '」这一步，四年规划生成不出它们的专项任务：' +
        noPathStep.map(function (d) { return d.name; }).join('、'));
    }

    /* 短板补齐任务的文案是「八个维度 × 三个年级段」的一张表，漏一格，
       那一档的学生就少看到一条任务。凑齐 24 格是件机械的活，交给自检盯。 */
    var gapMissing = [];
    AICS.DIMS.forEach(function (d) {
      var byGrade = AICS.DIM_GAP_TASKS[d.key];
      ['fresh', 'mid', 'senior'].forEach(function (g) {
        if (!byGrade || !byGrade[g]) gapMissing.push(d.name + '/' + g);
      });
    });
    if (gapMissing.length) {
      console.warn('[自检] 这些能力维度缺某个年级段的短板任务文案，' +
        '那一档的学生会少看到一条任务：' + gapMissing.join('、'));
    }

    /* 短板任务的文案不能和通用任务撞车——它们会并排出现在同一个阶段里。
       第一版就栽在这里：大二那栏同时列出「用 PyTorch 完整训练一个深度学习
       模型」和「用 PyTorch 完整训练一个模型」，读的人只会觉得系统在凑数。
       24 条文案是手写的，顺手抄一句近的特别容易，交给自检盯。 */
    var baseTitles = [];
    AICS.ROADMAP.forEach(function (s) {
      s.tasks.forEach(function (t) { baseTitles.push(t.title); });
    });
    var clash = [];
    Object.keys(AICS.DIM_GAP_TASKS).forEach(function (k) {
      Object.keys(AICS.DIM_GAP_TASKS[k]).forEach(function (g) {
        var t = AICS.DIM_GAP_TASKS[k][g].title;
        baseTitles.forEach(function (b) {
          if (titleClash(t, b)) clash.push('「' + t + '」和「' + b + '」');
        });
      });
    });
    if (clash.length) {
      console.warn('[自检] 短板任务的文案和通用任务撞车了，' +
        '它们会并排出现在同一个阶段里：' + clash.join('；'));
    }
  }

  function boot() {
    /* 打开控制台第一眼就能看到自己跑的是哪一版 */
    console.log('[AI 领航] 构建 ' + BUILD);
    applyTheme();
    renderSidebar();
    selfCheck();

    /* 从 URL hash 解析初始路由，默认进概览 */
    var hash = (window.location.hash || '').replace(/^#\/?/, '');
    currentRoute = AICS.Views[hash] ? hash : 'dashboard';

    window.addEventListener('hashchange', function () {
      var r = (window.location.hash || '').replace(/^#\/?/, '');
      currentRoute = AICS.Views[r] ? r : 'dashboard';
      renderRoute();
    });

    renderRoute();

    /* 数据变化时只刷新侧边栏统计，页面内容由视图自己决定要不要重绘 */
    AICS.Store.subscribe(function () { refreshChrome(); });

    /* 第一次打开的用户，先走一遍向导把年级问清楚——
       年级决定匹配权重，不能给个默认值蒙混过去 */
    AICS.Onboarding.maybeShow();
  }

  AICS.App = {
    navigate: navigate,
    refresh: refresh,
    refreshChrome: refreshChrome,
    settingsModal: settingsModal,
    boot: boot,
    /* 暴露出来是为了在控制台里能手动跑一遍（自检只在启动时跑一次，
       改完数据不重启就看不到新的警告） */
    selfCheck: selfCheck,
    NAV: NAV,
    openNav: openNav,
    closeNav: closeNav
  };

  /* DOM 就绪后启动 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(window.AICS);
