/* ============================================================
 * views/tools.js —— AI 职业规划助手 + 学习资源库
 * ------------------------------------------------------------
 * assistant 视图：对话界面。默认走离线知识库，设置里开启在线模式后
 *                会调用真实大模型，并把测评画像 + 当前浏览页面一起
 *                写进系统提示词，让回答能接上你正在看的东西。
 * resources 视图：分类展示学习资源，支持关键词搜索。
 * ============================================================ */
window.AICS = window.AICS || {};
AICS.Views = AICS.Views || {};

(function (AICS) {
  'use strict';

  var UI = AICS.UI;

  /* 从别的页面点快捷提问跳过来时，暂存待发送的问题 */
  var pendingQuestion = '';
  /* 资源库的搜索词，存在内存里 */
  var resQuery = '';

  /* ---------- 对话气泡 ---------- */

  function bubble(msg) {
    if (msg.role === 'user') {
      return '<div class="msg msg--user"><div class="msg__body">' +
        '<p>' + UI.esc(msg.text) + '</p>' +
      '</div></div>';
    }
    var sourceTag = msg.source === 'api'
      ? UI.tag('AI 在线', 'ok')
      : UI.tag('离线知识库', 'ghost');
    return '<div class="msg msg--ai">' +
      '<div class="msg__avatar">' + UI.icon('bot') + '</div>' +
      '<div class="msg__body">' +
        (msg.title ? '<div class="msg__title">' + UI.esc(msg.title) + ' ' + sourceTag + '</div>' : '') +
        (msg.notice ? '<div class="msg__notice">' + UI.icon('alert') + UI.esc(msg.notice) + '</div>' : '') +
        '<div class="msg__md">' + AICS.Assistant.md2html(msg.text) + '</div>' +
      '</div>' +
    '</div>';
  }

  /* 欢迎语：根据有没有做测评给不同的开场 */
  function welcome(hasAnalysis, mode) {
    var text = hasAnalysis
      ? '我已经读过你的测评结果了，可以直接问我任何职业规划上的问题。\n\n' +
        /* 这行原来写的是"我这个**匹配度最高**的方向，接下来一年该重点做什么？"——
           两个毛病：
             一是"匹配度最高"和全站设计冲突（档内不排名次，全站都在避免说"最高"）；
             二是助手自己答不上来——知识库里没有对应的触发词，
                照着这句问会得到"我暂时没有把握…不敢乱说"。
           建议别人问什么，自己必须答得上，所以换成能答的这句。 */
        '比如：**接下来一年我该重点补哪几项能力？**'
      : '你好，我是这个工作台内置的职业规划助手。\n\n' +
        '你现在还没做测评，我可以先回答通用问题；' +
        '**做完测评之后，我的回答会结合你自己的数据**，会具体很多。';
    return '<div class="msg msg--ai">' +
      '<div class="msg__avatar">' + UI.icon('bot') + '</div>' +
      '<div class="msg__body">' +
        '<div class="msg__title">AI 职业规划助手 ' +
          (mode === 'api' ? UI.tag('AI 在线', 'ok') : UI.tag('离线知识库', 'ghost')) + '</div>' +
        '<div class="msg__md">' + AICS.Assistant.md2html(text) + '</div>' +
      '</div>' +
    '</div>';
  }

  function renderMessages(state) {
    var chat = state.chat || [];
    var hasAnalysis = !!AICS.Calc.analyse(state);
    var mode = (state.settings.useApi && state.settings.apiKey) ? 'api' : 'offline';
    return welcome(hasAnalysis, mode) + chat.map(bubble).join('');
  }

  function scrollBottom() {
    var list = document.getElementById('chat-list');
    if (list) list.scrollTop = list.scrollHeight;
  }

  /* ---------- 发送消息 ---------- */

  /* 上一次发出去的问题和时间，用来挡连点。
     快捷提问那几个按钮在 #chat-list 外面，发完消息只重绘列表，
     按钮本身既不会被移除也不会被禁用，所以点两下就是两条一模一样的
     提问、两次请求（在线模式下是真的花两次钱）。
     只挡"同一句话 + 一秒内"，不是全局节流——连着问两个不同的问题照常。 */
  var lastSend = { text: '', at: 0 };

  function send(root, text) {
    text = (text || '').trim();
    if (!text) return;

    if (text === lastSend.text && Date.now() - lastSend.at < 1000) return;
    lastSend = { text: text, at: Date.now() };

    var list = root.querySelector('#chat-list');
    if (!list) return;

    /* 先把用户消息画出来 */
    AICS.Store.pushChat({ role: 'user', text: text, time: new Date().toISOString() });
    list.innerHTML = renderMessages(AICS.Store.get());
    scrollBottom();

    /* "正在思考"的占位气泡 */
    var thinking = document.createElement('div');
    thinking.className = 'msg msg--ai';
    thinking.innerHTML = '<div class="msg__avatar">' + UI.icon('bot') + '</div>' +
      '<div class="msg__body"><div class="typing"><i></i><i></i><i></i></div></div>';
    list.appendChild(thinking);
    scrollBottom();

    /* 回答先落库，再判断要不要画到界面上。
       原来是"看列表还在不在，不在就直接 return"——可用户那句话早在
       发出去的那一刻就写进记录了，回答却被丢掉，他回到助手页只看到
       "有提问、没有回答"，而且那条提问永远等不到答案。
       切页只该影响"画不画"，不该影响"存不存"。 */
    AICS.Assistant.ask(text).then(function (res) {
      AICS.Store.pushChat({
        role: 'ai',
        title: res.title,
        text: res.text,
        source: res.source,
        notice: res.notice || '',
        time: new Date().toISOString()
      });
      if (!document.body.contains(list)) return;   // 用户已经切走了，下次进来再看
      list.innerHTML = renderMessages(AICS.Store.get());
      scrollBottom();
    }).catch(function (err) {
      AICS.Store.pushChat({
        role: 'ai',
        title: '出错了',
        text: '抱歉，回答生成失败：' + (err && err.message ? err.message : '未知错误'),
        source: 'offline'
      });
      if (!document.body.contains(list)) return;
      list.innerHTML = renderMessages(AICS.Store.get());
      scrollBottom();
    });
  }

  AICS.Views.assistant = {
    title: 'AI 助手',
    desc: '结合你的测评数据回答问题',

    render: function () {
      var state = AICS.Store.get();
      var online = state.settings.useApi && state.settings.apiKey;
      var hasAnalysis = !!AICS.Calc.analyse(state);
      var chatCount = (state.chat || []).length;

      var head = UI.pageHeader('AI 职业规划助手',
        '回答会结合你的测评结果',
        '<button class="btn" data-action="open-settings">' + UI.icon('settings') + ' 助手设置</button>');

      var modeBanner = online
        ? '<div class="banner banner--ok">' + UI.icon('sparkles') +
            '<div><strong>在线模式已开启</strong><span>正在使用 ' + UI.esc(state.settings.apiModel || '大模型') +
            '，回答已接入你的个人测评数据</span></div>' +
            '<button class="link-btn" data-action="open-settings">修改配置 ' + UI.icon('arrow-right') + '</button>' +
          '</div>'
        : '<div class="banner banner--soft">' + UI.icon('info') +
            '<div><strong>当前是离线知识库模式</strong>' +
            /* 条数从知识库现算，别写死。原来写的是"内置 18 个"，
               后来给知识库补了 4 条，这个数字就成了假的——
               凡是"数量"能现算的，就不要抄一遍。 */
            '<span>内置 ' + AICS.KB.length + ' 个职业规划话题，断网也能用。配置 API Key 后可切换到真实大模型</span></div>' +
            '<button class="link-btn" data-action="open-settings">去配置 ' + UI.icon('arrow-right') + '</button>' +
          '</div>';

      if (!hasAnalysis) {
        modeBanner += '<div class="banner banner--warn">' + UI.icon('alert') +
          '<div><strong>还没完成测评</strong><span>完成测评后，助手的回答会带上你自己的匹配度和短板数据</span></div>' +
          '<button class="link-btn" data-action="go-assess">去测评 ' + UI.icon('arrow-right') + '</button>' +
        '</div>';
      }

      var countNote = chatCount
        ? '<p class="muted" style="margin-top:10px">已保存 ' + chatCount + ' 条对话（最多保留 200 条，超出会自动清掉最早的）</p>'
        : '';

      return head + modeBanner +
        '<div class="chat">' +
          '<div class="chat__list" id="chat-list">' + renderMessages(state) + '</div>' +
          '<div class="chat__input">' +
            '<textarea id="chat-input" class="input" rows="1" ' +
              'placeholder="问问关于方向选择、学习路线、实习准备的问题…（Enter 发送，Shift+Enter 换行）"></textarea>' +
            '<button class="btn btn--primary" data-action="chat-send">' + UI.icon('send') + ' 发送</button>' +
          '</div>' +
        '</div>' +
        countNote +
        '<div class="chat-quick">' +
          '<span>试试问：</span>' +
          AICS.KB_QUICK.map(function (q) {
            return '<button class="chip" data-action="chat-quick" data-q="' + UI.esc(q) + '">' + UI.esc(q) + '</button>';
          }).join('') +
          (chatCount ? '<button class="link-btn" data-action="chat-clear">' + UI.icon('trash') + ' 清空对话</button>' : '') +
        '</div>';
    },

    mount: function (root) {
      var input = root.querySelector('#chat-input');
      if (input) {
        input.addEventListener('input', function () {
          input.style.height = 'auto';
          input.style.height = Math.min(input.scrollHeight, 110) + 'px';
        });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            var text = input.value;
            input.value = '';
            input.style.height = 'auto';
            send(root, text);
          }
        });
        input.focus();
      }

      root.addEventListener('click', function (e) {
        if (e.target.closest('[data-action="chat-send"]')) {
          var el = root.querySelector('#chat-input');
          var v = el ? el.value : '';
          if (el) { el.value = ''; el.style.height = 'auto'; }
          send(root, v);
          return;
        }
        var quick = e.target.closest('[data-action="chat-quick"]');
        if (quick) { send(root, quick.getAttribute('data-q')); return; }
      });

      scrollBottom();

      if (pendingQuestion) {
        var q = pendingQuestion;
        pendingQuestion = '';
        send(root, q);
      }
    }
  };

  /* 供 app.js 调用：带问题跳到助手页 */
  AICS.askInAssistant = function (question) {
    pendingQuestion = question;
    AICS.App.navigate('assistant');
  };

  /* 供 app.js 调用：清空资源库的搜索条件 */
  AICS.resetResourceSearch = function () { resQuery = ''; };

  /* ---------- 学习资源库 ---------- */

  /* 高亮命中的关键词 */
  function highlight(text, q) {
    var safe = UI.esc(text);
    if (!q) return safe;
    var esc = UI.esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      return safe.replace(new RegExp(esc, 'gi'), function (m) { return '<mark>' + m + '</mark>'; });
    } catch (e) {
      return safe;
    }
  }

  /* 按关键词筛出资源，返回 [{group, items}] */
  function filterResources(q) {
    if (!q) return AICS.RESOURCES;
    var key = q.toLowerCase();
    var out = [];
    AICS.RESOURCES.forEach(function (g) {
      var hit = g.items.filter(function (it) {
        return (it.name + ' ' + it.desc + ' ' + g.category).toLowerCase().indexOf(key) >= 0;
      });
      if (hit.length) out.push({ category: g.category, icon: g.icon, items: hit });
    });
    return out;
  }

  AICS.Views.resources = {
    title: '资源库',
    desc: '课程、竞赛、数据集、论文、社区',

    render: function () {
      var q = resQuery.trim();
      var groups = filterResources(q);
      var totalHit = groups.reduce(function (s, g) { return s + g.items.length; }, 0);

      /* 不能说"全部免费"——知网/万方是校内订阅的，离开校园网打不开 */
      var head = UI.pageHeader('学习资源库',
        AICS.resourceCount() + ' 条精选资源，绝大多数公开免费；个别标注「校内」的需要校园网');

      var search = '<div class="search-box">' +
        UI.icon('search') +
        '<input type="text" id="res-search" class="input" placeholder="搜索资源，比如 Kaggle、深度学习、竞赛…" ' +
          'value="' + UI.esc(q) + '" maxlength="30">' +
        (q ? '<button class="icon-btn icon-btn--sm search-box__clear" data-action="res-clear" title="清空">' +
          UI.icon('x') + '</button>' : '') +
      '</div>';

      if (!groups.length) {
        return head + search +
          '<div class="search-empty">没有找到和「' + UI.esc(q) + '」相关的资源<br>' +
          '<button class="link-btn" data-action="res-clear" style="margin-top:12px">清空搜索条件</button></div>';
      }

      var body = groups.map(function (group) {
        return '<section class="res-group">' +
          '<div class="res-group__head">' +
            '<span class="res-group__icon">' + group.icon + '</span>' +
            '<h3>' + UI.esc(group.category) + '</h3>' +
            '<span class="res-group__count">' + group.items.length + ' 项</span>' +
          '</div>' +
          '<div class="res-grid">' +
            group.items.map(function (item) {
              return '<a class="res-card" href="' + UI.esc(item.url) + '" target="_blank" rel="noopener noreferrer">' +
                '<div class="res-card__top">' +
                  '<h4>' + highlight(item.name, q) + '</h4>' +
                  UI.icon('arrow-right') +
                '</div>' +
                '<p>' + highlight(item.desc, q) + '</p>' +
              '</a>';
            }).join('') +
          '</div>' +
        '</section>';
      }).join('');

      return head + search +
        (q ? '<p class="muted" style="margin-bottom:16px">找到 ' + totalHit + ' 条和「' + UI.esc(q) + '」相关的资源</p>' : '') +
        body;
    },

    mount: function (root) {
      var input = root.querySelector('#res-search');
      if (!input) return;

      /* 输入时做防抖，避免每敲一个字就整页重绘 */
      var timer = null;
      input.addEventListener('input', function () {
        clearTimeout(timer);
        var v = input.value;
        timer = setTimeout(function () {
          resQuery = v;
          AICS.App.refresh();
          /* 重绘后把光标放回搜索框末尾 */
          var next = document.getElementById('res-search');
          if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
        }, 320);
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { resQuery = ''; AICS.App.refresh(); }
      });
    }
  };

})(window.AICS);
