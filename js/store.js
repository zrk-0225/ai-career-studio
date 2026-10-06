/* ============================================================
 * store.js —— 全局状态与本地持久化
 * ------------------------------------------------------------
 * 所有用户数据（测评答案、画像、任务、聊天记录、设置）都存在
 * 一个 state 对象里，并同步写入 localStorage，刷新页面不丢。
 * 采用最简单的发布订阅：数据一变就通知所有订阅者重绘。
 * ============================================================ */
window.AICS = window.AICS || {};

(function (AICS) {
  'use strict';

  var STORAGE_KEY = 'ai-career-studio:v1';

  /* 首次打开时的初始状态 */
  function defaultState() {
    return {
      version: 1,
      /* 基本信息。年级故意留空——它会改变匹配算法的权重，
         如果给个默认值，大一新生会静默地拿到大二的权重而不自知。 */
      profile: {
        name: '',
        school: '',
        major: '人工智能',
        year: '',
        targetId: '',         // 用户手动锁定的目标方向 id
        onboarded: false,     // 是否走完了首次启动向导
        onboardedAt: ''
      },
      /* 测评：answers 形如 { i1: 4, b1: 3, p1: 5 } */
      assess: {
        answers: {},
        finished: false,
        finishedAt: ''
      },
      /* 四年路线的勾选状态：{ y1t1: true } */
      roadmap: {},
      /* 实践记录：勾了任务之后，你做到什么程度了。
         形如 { dl: { seen: 2, done: 1, teach: 0 } }，按能力维度汇总。
         这不是"能力分"，是**自评之外的旁证**——测评里那个分数还是
         你自己打的，这里记的是"你确实动手做过几次"。
         两者放在一起看，比只有自评可靠。 */
      practice: {},
      /* 毕业去向。空字符串表示自动——按目标方向的学历要求推断 */
      plan: {
        track: ''
      },
      /* 任务看板 */
      tasks: [],
      /* 历次测评快照，用于画成长曲线 */
      history: [],
      /* AI 助手对话记录（只保留最近若干条，避免撑爆本地存储） */
      chat: [],
      /* 设置 */
      settings: {
        theme: 'dark',
        useApi: false,
        apiBase: 'https://api.deepseek.com',
        apiKey: '',
        apiModel: 'deepseek-chat'
      },
      meta: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  }

  var state = defaultState();
  var listeners = [];

  /* 把外部传进来的对象合并进 state，缺失的字段用默认值补齐。
     这里是所有外部数据的入口（读本地存储、导入备份），
     所以每个字段都要验类型——不能因为备份文件里一个字段写错了，
     就让整个页面白屏，而且那份坏数据还会被存下来，下次打开继续白屏。 */
  function mergeLoaded(loaded) {
    var base = defaultState();
    if (!loaded || typeof loaded !== 'object') return base;

    Object.keys(base).forEach(function (key) {
      var v = loaded[key];
      if (v === undefined || v === null) return;

      /* 默认值是数组的字段（任务、历史、对话）：只认数组。
         传对象进来会让 .filter / .map 当场抛错，整页渲染不出来。 */
      if (Array.isArray(base[key])) {
        if (Array.isArray(v)) base[key] = v;
        return;
      }

      /* 默认值是对象的字段：只认普通对象，逐字段合并，
         这样旧版本备份里缺的字段会自动补上默认值 */
      if (typeof base[key] === 'object') {
        if (typeof v === 'object' && !Array.isArray(v)) {
          base[key] = Object.assign({}, base[key], v);
        }
        return;
      }

      /* 基础类型：类型对得上才收，对不上就用默认值 */
      if (typeof v === typeof base[key]) base[key] = v;
    });

    /* 嵌套字段单独兜一道。
       answers 必须是普通对象：如果它是数组，往上面挂的答案属性
       在 JSON.stringify 时会被丢掉——用户答完一整份测评，
       存进去看着没问题，重开就全没了，而且全程没有任何报错。 */
    if (!isPlainObject(base.assess.answers)) base.assess.answers = {};
    if (!isPlainObject(base.roadmap)) base.roadmap = {};
    if (typeof base.plan.track !== 'string') base.plan.track = '';

    /* 年级必须是 YEARS 里还存在的值。
       删掉"研究生"这个选项之后，老存档里可能还留着它——
       不清掉的话，下拉框里找不到这一项，浏览器就会默认选中第一项，
       用户点一次保存就被静默改成"大一"（这个坑之前踩过一次）。 */
    if (AICS.YEARS && AICS.YEARS.indexOf(base.profile.year) === -1) base.profile.year = '';

    /* 目标方向同理：它也是个"会随版本消失的 id"。
       不校验的话，老存档里指向已删方向的 targetId 会一路流到
       「匹配诊断」，那边按 id 查不到方向就拿到 undefined，
       再读 .dir 直接抛错——而且 renderRoute 没有 try/catch，
       结果是一整页白屏，只留下侧边栏。
       实测过：页面上一个字都没有，标题还停在上一页。 */
    if (base.profile.targetId && !directionExists(base.profile.targetId)) {
      base.profile.targetId = '';
    }

    /* 答案只认有限数字。字符串或 NaN 会让 likertTo100 算出 NaN，
       然后整条加权链路一路 NaN 下去，页面上全是"NaN 分"。 */
    var cleanAnswers = {};
    Object.keys(base.assess.answers).forEach(function (k) {
      var v = base.assess.answers[k];
      if (typeof v === 'number' && isFinite(v)) cleanAnswers[k] = v;
    });
    base.assess.answers = cleanAnswers;

    /* 数组元素本身也得看一道。
       上面只验了"是不是数组"，元素是 null 或字符串照样放行——
       导入 {"tasks":[null]} 就会在看板里读 null.id 抛错。
       三条数组各自的"像不像有效记录"的判断不一样，所以分开过滤。 */
    base.tasks = (base.tasks || []).filter(function (t) {
      return isPlainObject(t) && typeof t.id === 'string';
    });
    base.history = (base.history || []).filter(function (h) {
      /* 历史快照少了 ability / interest 就画不了成长曲线，
         留着只会在 historySeries 里炸。
         at（时间）同样不能少：曲线的横轴标签是 String(h.at).slice(0, 10)，
         没有它每个点都会标成「undefined」，还可能把排序搞乱。 */
      return isPlainObject(h) && isPlainObject(h.ability) &&
             isPlainObject(h.interest) && typeof h.at === 'string' && h.at;
    });
    base.chat = (base.chat || []).filter(function (m) {
      return isPlainObject(m) && typeof m.text === 'string';
    });

    /* profile 里需要是字符串的字段 */
    ['name', 'school', 'year', 'targetId'].forEach(function (k) {
      if (typeof base.profile[k] !== 'string') base.profile[k] = '';
    });
    if (typeof base.profile.major !== 'string' || !base.profile.major) {
      base.profile.major = '人工智能';
    }

    /* 上面那层泛型合并只按"顶层字段"验类型，嵌套在对象里面的
       基础类型它管不着（都走 Object.assign）。下面这几个漏网的都在
       认真读，所以单独补一道。

       onboarded 最要紧：判断是 if (p.onboarded)，不做布尔校验的话，
       导入一份写着 "false" 字符串的备份会被当成真值——
       首次向导从此再也不弹，用户永远填不上年级，而年级是匹配算法的权重来源。
       assess.finished 同理，它是"要不要补一条成长曲线记录"的开关。 */
    if (typeof base.profile.onboarded !== 'boolean') base.profile.onboarded = false;
    if (typeof base.profile.onboardedAt !== 'string') base.profile.onboardedAt = '';
    if (typeof base.assess.finished !== 'boolean') base.assess.finished = false;
    if (typeof base.assess.finishedAt !== 'string') base.assess.finishedAt = '';
    if (typeof base.meta.createdAt !== 'string') base.meta.createdAt = new Date().toISOString();
    if (typeof base.meta.updatedAt !== 'string') base.meta.updatedAt = new Date().toISOString();

    /* settings 的字段会被直接拼进网络请求和 CSS 主题属性，
       类型不对的后果不只是显示难看：apiBase 是数字的话
       buildEndpoint 会同步抛异常（见 assistant.js 的 ask）。 */
    if (typeof base.settings.useApi !== 'boolean') base.settings.useApi = false;
    if (typeof base.settings.apiBase !== 'string') base.settings.apiBase = 'https://api.deepseek.com';
    if (typeof base.settings.apiKey !== 'string') base.settings.apiKey = '';
    if (typeof base.settings.apiModel !== 'string') base.settings.apiModel = 'deepseek-chat';
    if (base.settings.theme !== 'light' && base.settings.theme !== 'dark') base.settings.theme = 'dark';

    /* 勾选记录只认 true，其他值一律当没勾 */
    var cleanRoadmap = {};
    if (isPlainObject(base.roadmap)) {
      Object.keys(base.roadmap).forEach(function (k) {
        if (base.roadmap[k] === true) cleanRoadmap[k] = true;
      });
    }
    base.roadmap = cleanRoadmap;

    /* 实践记录：只认三个已知档位，计数必须是正的整数。
       不清洗的话，导入一份 {"practice":{"dl":5}} 进来，
       界面上读 .done 会拿到 undefined，显示成"做过 undefined 次"。 */
    var cleanPractice = {};
    if (isPlainObject(base.practice)) {
      Object.keys(base.practice).forEach(function (dim) {
        var rec = base.practice[dim];
        if (!isPlainObject(rec)) return;
        var item = {};
        ['seen', 'done', 'teach'].forEach(function (lv) {
          var n = rec[lv];
          if (typeof n === 'number' && isFinite(n) && n > 0) item[lv] = Math.floor(n);
        });
        if (Object.keys(item).length) cleanPractice[dim] = item;
      });
    }
    base.practice = cleanPractice;

    return base;
  }

  /* 这个方向 id 是否还存在。用 AICS.Directions 而不是直接翻数组，
     是为了方向列表将来换存储结构时这里不用跟着改。 */
  function directionExists(id) {
    if (!AICS.Directions || typeof AICS.Directions.byId !== 'function') return true;
    return !!AICS.Directions.byId(id);
  }

  /* 普通对象 = 非 null、非数组的对象 */
  function isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  /* 从 localStorage 读数据，读失败（比如被禁用）就退回默认状态 */
  function load() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) state = mergeLoaded(JSON.parse(raw));
    } catch (err) {
      console.warn('[store] 本地数据读取失败，已使用默认状态：', err);
    }
  }

  /* 对话记录上限：只保留最近这么多条，防止本地存储被聊天内容撑爆 */
  var CHAT_LIMIT = 200;

  /* 备份文件里应该出现的顶层字段，用来判断导入的是不是本工作台的备份。
     这份清单必须和 defaultState() 的顶层键保持一致——
     之前漏了 version，集合已经悄悄漂移过一次，所以下面加了断言。 */
  var KNOWN_KEYS = ['version', 'profile', 'assess', 'settings', 'roadmap', 'practice',
                    'tasks', 'chat', 'history', 'plan', 'meta'];

  /* 一份真正的备份是 JSON.stringify(整个 state)，所以上面这些键一个不少。
     外来文件只可能零星命中几个，于是用"至少命中一半"当门槛。
     门槛不能只要求"命中一个"——实测过：导入 {"settings":{"theme":"light"}}
     会通过校验，然后把用户 38 道题的答案、年级、历史全部清成默认值，
     还提示"导入成功"。这是全项目最伤人的一个 bug：
     数据没了，用户还以为自己操作成功了。 */
  var MIN_KNOWN_HITS = Math.ceil(KNOWN_KEYS.length / 2);

  /* 写盘 + 通知订阅者，任何修改最后都要走这里 */
  function commit() {
    state.meta.updatedAt = new Date().toISOString();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      /* 多半是本地存储写满了（浏览器一般给 5MB）。
         这时丢掉最占地方的聊天记录和历史快照再试一次，
         总比直接静默失败、用户以为存上了要好。 */
      console.warn('[store] 写入失败，精简历史数据后重试：', err);
      try {
        state.chat = (state.chat || []).slice(-40);
        state.history = (state.history || []).slice(-10);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (err2) {
        console.error('[store] 精简后仍写入失败，本次修改没有保存：', err2);
      }
    }
    listeners.forEach(function (fn) {
      try { fn(state); } catch (e) { console.error(e); }
    });
  }

  var Store = {
    /* 读取整个状态（只读用途） */
    get: function () { return state; },

    /* 读取某个顶层字段 */
    pick: function (key) { return state[key]; },

    /* 局部更新某个顶层字段，两种用法：
       Store.set('profile', { name: '张三' })
       Store.set('profile', function (p) { p.name = '张三'; return p; }) */
    set: function (key, valueOrFn) {
      if (typeof valueOrFn === 'function') {
        state[key] = valueOrFn(state[key]) || state[key];
      } else if (valueOrFn && typeof valueOrFn === 'object' && !Array.isArray(valueOrFn)) {
        state[key] = Object.assign({}, state[key], valueOrFn);
      } else {
        state[key] = valueOrFn;
      }
      commit();
    },

    /* 整体替换某个字段，而不是合并。
       适用场景：这个字段的完整状态就在你手里，比如整份勾选记录。
       必须和 set 区分开——set 是合并语义，传空对象进去等于什么都没做，
       而"取消最后一项勾选"产生的恰恰就是空对象。 */
    replaceKey: function (key, value) {
      state[key] = value;
      commit();
    },

    /* 订阅数据变化，返回取消订阅的函数 */
    subscribe: function (fn) {
      listeners.push(fn);
      return function () {
        listeners = listeners.filter(function (f) { return f !== fn; });
      };
    },

    /* 手动触发一次通知，用于主题等不在 state 内的变化 */
    notify: commit,

    /* 恢复到初始状态 */
    reset: function () {
      state = defaultState();
      commit();
    },

    /* 导出为 JSON 字符串，用于备份下载 */
    exportJSON: function () {
      return JSON.stringify(state, null, 2);
    },

    /* 导入备份，返回是否成功。
       这里必须严格校验，因为 mergeLoaded 是"缺字段就补默认值"的语义——
       如果拿一个不相干的 JSON（比如别的软件导出的数组）进来，
       所有字段都会缺失，结果是把用户已有的数据全部清空，
       而且还会提示"导入成功"。所以先确认它确实是本工作台导出的备份。 */
    importJSON: function (text) {
      try {
        var obj = JSON.parse(text);
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
          throw new Error('不是有效的备份文件');
        }
        /* 必须认得大部分顶层字段。门槛见 MIN_KNOWN_HITS 上面的说明：
           要求太低会把无关 JSON 放进来，而放进来就等于清空用户数据。 */
        var hits = KNOWN_KEYS.filter(function (k) { return obj[k] !== undefined; });
        if (hits.length < MIN_KNOWN_HITS) {
          throw new Error('这不是本工作台导出的备份文件（只认出了 ' +
            hits.length + ' 个字段，至少需要 ' + MIN_KNOWN_HITS + ' 个）');
        }
        /* 认得出字段还不够，核心数据也得在，否则仍是一次"合法的清空" */
        if (obj.assess === undefined && obj.profile === undefined && obj.tasks === undefined) {
          throw new Error('这个备份里没有任何个人数据');
        }

        state = mergeLoaded(obj);
        commit();
        return true;
      } catch (err) {
        console.warn('[store] 导入失败：', err);
        return false;
      }
    },

    /* 追加一条对话记录，超过上限自动丢掉最早的 */
    pushChat: function (msg) {
      var list = (state.chat || []).slice();
      list.push(msg);
      if (list.length > CHAT_LIMIT) list = list.slice(list.length - CHAT_LIMIT);
      state.chat = list;
      commit();
    },

    /* 当前对话条数，界面上用来提示 */
    chatCount: function () { return (state.chat || []).length; },

    /* 生成一个本地唯一 id，任务和消息用 */
    uid: function (prefix) {
      return (prefix || 'id') + '-' + Date.now().toString(36) + '-' +
        Math.random().toString(36).slice(2, 7);
    }
  };

  /* 自检：KNOWN_KEYS 是 defaultState() 顶层键的手抄副本，
     少一个就会让"导入的是不是本工作台备份"判断失准。
     已经漏过一次（version），所以在这里对一次账。 */
  (function assertKnownKeys() {
    var missing = Object.keys(defaultState()).filter(function (k) {
      return KNOWN_KEYS.indexOf(k) === -1;
    });
    if (missing.length) {
      console.warn('[store] KNOWN_KEYS 漏了这些顶层字段：', missing.join('、'));
    }
  })();

  load();
  /* ---------- 实践记录的汇总 ----------

     放在 store.js 而不是某个视图里，因为三个页面都要读它
     （匹配诊断、自我认知、AI 助手），口径必须只有一份。
     另外 views/plan.js 是后被加载的那个，定义在那边的话
     先加载的 match.js 读起来要多绕一层。

     返回 null 表示这个维度没有任何记录——调用方据此决定"要不要显示"，
     而不是显示一个"0 次"。 */
  AICS.practiceOf = function (dim) {
    var rec = (state.practice || {})[dim];
    if (!rec) return null;

    var solid = (rec.done || 0) + (rec.teach || 0);   // 真动过手的
    var seen = rec.seen || 0;
    if (!solid && !seen) return null;

    return {
      seen: seen,
      done: rec.done || 0,
      teach: rec.teach || 0,
      solid: solid,
      total: solid + seen,
      /* 界面上的一句话，各处直接引用，免得同一件事有三种说法 */
      text: solid
        ? '动手做过 ' + solid + ' 次' + (seen ? '，另外了解过 ' + seen + ' 次' : '')
        : '了解过 ' + seen + ' 次'
    };
  };

  AICS.Store = Store;

})(window.AICS);
