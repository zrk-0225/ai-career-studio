/* ============================================================
 * views/plan.js —— 四年行动路线 + 学习任务看板
 * ------------------------------------------------------------
 * roadmap 视图：大一到大四四个阶段，任务可勾选，顶部汇总进度
 * kanban  视图：三列看板，支持新增、编辑、拖动、排序、筛选、删除
 * 两个视图共享同一批任务数据，并且双向联动：
 *   - 看板里勾完成 → 四年规划对应项自动勾上
 *   - 四年规划里勾上 → 看板对应任务自动标记完成
 * ============================================================ */
window.AICS = window.AICS || {};
AICS.Views = AICS.Views || {};

(function (AICS) {
  'use strict';

  var UI = AICS.UI;

  /* 任务可选的所属阶段与优先级。
     颜色存的是语义名，用的时候拿 UI.tone() 解析——
     写死十六进制的话，切到浅色主题会比页面底色还亮。 */
  var TERMS = ['大一', '大二', '大三', '大四', '假期', '其他'];
  var PRIORITIES = [
    { key: 'high', name: '高', tone: 'danger' },
    { key: 'mid',  name: '中', tone: 'warn' },
    { key: 'low',  name: '低', tone: 'mid' }
  ];
  var COLUMNS = [
    { key: 'todo',  name: '待办',   tone: 'neutral' },
    { key: 'doing', name: '进行中', tone: 'warn' },
    { key: 'done',  name: '已完成', tone: 'ok' }
  ];

  /* 筛选条件只存在内存里，不写进存档 */
  var filter = { term: 'all', pri: 'all' };

  function priorityOf(key) {
    return PRIORITIES.filter(function (p) { return p.key === key; })[0] || PRIORITIES[1];
  }

  function colIndex(status) {
    return Math.max(0, COLUMNS.map(function (c) { return c.key; }).indexOf(status));
  }

  /* 今天的日期串，用来判断任务是否过期 */
  function today() {
    var d = new Date();
    function p(n) { return n < 10 ? '0' + n : String(n); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* ---------- 四年路线 ---------- */

  function stageProgress(stage, roadmap) {
    var done = stage.tasks.filter(function (t) { return roadmap[t.id]; }).length;
    return {
      done: done,
      total: stage.tasks.length,
      percent: stage.tasks.length ? (done / stage.tasks.length) * 100 : 0
    };
  }

  function stageCard(stage, roadmap) {
    var pr = stageProgress(stage, roadmap);
    var rows = stage.tasks.map(function (t) {
      var checked = !!roadmap[t.id];
      return '<li class="road-task' + (checked ? ' is-done' : '') +
        '" data-action="toggle-road" data-id="' + t.id + '">' +
        '<span class="road-task__box">' + (checked ? UI.icon('check') : '') + '</span>' +
        '<span class="road-task__body">' +
          /* 只给"有硬期限或错过补不回来"的那几项打标。
             26 项全打标等于没打标，只标重点反而一眼看得出该先做哪些。 */
          '<strong>' + UI.esc(t.title) +
            (t.pri === 'high' ? '<span class="road-task__pri">重点</span>' : '') +
          '</strong>' +
          '<em>' + UI.esc(t.desc) + '</em>' +
        '</span>' +
      '</li>';
    }).join('');

    return '<section class="stage" data-stage="' + stage.year + '">' +
      '<div class="stage__head">' +
        '<div class="stage__title">' +
          '<span class="stage__dot" style="background:' + stage.color + '"></span>' +
          '<h3>' + UI.esc(stage.year) + ' · ' + UI.esc(stage.theme) + '</h3>' +
        '</div>' +
        '<span class="stage__count" data-count="' + stage.year + '">' + pr.done + ' / ' + pr.total + '</span>' +
      '</div>' +
      '<p class="stage__goal">' + UI.esc(stage.goal) + '</p>' +
      UI.progress(pr.percent, stage.color)
        .replace('class="progress__bar"', 'class="progress__bar" data-bar="' + stage.year + '"') +
      '<ul class="road-tasks">' + rows + '</ul>' +
    '</section>';
  }

  /* 汇总某个路线的整体进度 */
  function roadmapTotals(stages, roadmap) {
    var total = 0, done = 0;
    stages.forEach(function (s) {
      s.tasks.forEach(function (t) { total++; if (roadmap[t.id]) done++; });
    });
    return { total: total, done: done, percent: total ? (done / total) * 100 : 0 };
  }

  /* 毕业去向选择器：三张可点的卡片 */
  function trackPicker(current) {
    return '<div class="panel track-picker">' +
      '<div class="panel__head">' +
        '<div><h3>你要走哪条路？</h3>' +
        '<p class="muted" style="margin-top:4px">' +
          (current.auto
            ? UI.esc(current.reason) + '。也可以手动改。'
            : '已手动选择，规划里的分岔任务会跟着变。') +
        '</p></div>' +
        (current.auto ? '' : '<button class="link-btn" data-action="set-track" data-v="">恢复自动</button>') +
      '</div>' +
      '<div class="track-grid">' +
        AICS.PLAN_TRACKS.map(function (t) {
          var on = current.key === t.key;
          return '<button class="track-card' + (on ? ' is-on' : '') +
            '" data-action="set-track" data-v="' + t.key + '">' +
            '<span class="track-card__icon">' + UI.icon(t.icon) + '</span>' +
            '<strong>' + UI.esc(t.name) + '</strong>' +
            '<em>' + UI.esc(t.desc) + '</em>' +
            (on ? '<span class="track-card__mark">' + UI.icon('check') + '</span>' : '') +
          '</button>';
        }).join('') +
      '</div>' +
      '<p class="track-note">' + UI.icon('info') +
        '<span>路线只影响大三暑假和大四的几项任务。前两年的规划两条路是一样的，' +
        '已经打过勾的进度也会保留。</span></p>' +
    '</div>';
  }

  AICS.Views.roadmap = {
    title: '四年规划',
    desc: '大一到大四该做什么，一项项落实',

    render: function () {
      var state = AICS.Store.get();
      var roadmap = state.roadmap || {};
      var track = AICS.resolveTrack(state);
      var stages = AICS.roadmapFor(track.key);
      var t = roadmapTotals(stages, roadmap);

      var head = UI.pageHeader('四年行动路线',
        '把大目标拆成每年能做的事，做完就打勾',
        '<button class="btn btn--primary" data-action="import-roadmap">' +
          UI.icon('download') + ' 未完成任务导入看板</button>');

      var summary = '<div class="banner">' +
        '<div class="ring-wrap"><canvas id="road-donut" style="width:76px;height:76px"></canvas></div>' +
        '<div><strong>四年规划完成度 ' + Math.round(t.percent) + '%</strong>' +
        '<span>' + UI.esc(track.name) + '路线 · 已完成 ' + t.done + ' 项，还剩 ' + (t.total - t.done) + ' 项</span></div>' +
        '<button class="link-btn" data-action="go-kanban">去任务看板 ' + UI.icon('arrow-right') + '</button>' +
      '</div>';

      return head + trackPicker(track) + summary +
        '<div class="stages">' +
          stages.map(function (s) { return stageCard(s, roadmap); }).join('') +
        '</div>';
    },

    mount: function (root) {
      var state = AICS.Store.get();
      var roadmap = state.roadmap || {};
      var track = AICS.resolveTrack(state);
      var stages = AICS.roadmapFor(track.key);

      var t0 = roadmapTotals(stages, roadmap);
      var donut = root.querySelector('#road-donut');
      if (donut) AICS.Charts.donut(donut, t0.percent, { size: 8, color: UI.tone('accent2') });

      root.addEventListener('click', function (e) {
        var row = e.target.closest('[data-action="toggle-road"]');
        if (!row) return;

        var id = row.getAttribute('data-id');
        var map = Object.assign({}, AICS.Store.get().roadmap);
        var nowDone;
        if (map[id]) { delete map[id]; nowDone = false; }
        else { map[id] = true; nowDone = true; }
        /* 用 replaceKey 而不是 set：取消最后一项时 map 会是空对象，
           而 set 是合并语义，空对象等于什么都没改 */
        AICS.Store.replaceKey('roadmap', map);

        /* 局部更新这一行 */
        row.classList.toggle('is-done', nowDone);
        row.querySelector('.road-task__box').innerHTML = nowDone ? UI.icon('check') : '';

        /* 更新所属阶段的计数和进度条 */
        var stageEl = row.closest('.stage');
        if (stageEl) {
          var year = stageEl.getAttribute('data-stage');
          var stage = stages.filter(function (s) { return s.year === year; })[0];
          if (stage) {
            var pr = stageProgress(stage, map);
            var countEl = stageEl.querySelector('[data-count]');
            var barEl = stageEl.querySelector('[data-bar]');
            if (countEl) countEl.textContent = pr.done + ' / ' + pr.total;
            if (barEl) barEl.style.width = pr.percent + '%';
          }
        }

        /* 更新页头总进度 */
        var t = roadmapTotals(stages, map);
        var bannerStrong = root.querySelector('.banner strong');
        if (bannerStrong) bannerStrong.textContent = '四年规划完成度 ' + Math.round(t.percent) + '%';
        var bannerSpan = root.querySelector('.banner span');
        if (bannerSpan) {
          bannerSpan.textContent = track.name + '路线 · 已完成 ' + t.done + ' 项，还剩 ' + (t.total - t.done) + ' 项';
        }
        var donut2 = root.querySelector('#road-donut');
        if (donut2) AICS.Charts.donut(donut2, t.percent, { size: 8, color: UI.tone('accent2') });

        /* 联动：把看板里同名任务的状态也改掉 */
        var title = row.querySelector('.road-task__body strong').textContent;
        var synced = AICS.syncTaskFromRoadmap(title, nowDone);
        if (synced) UI.toast(nowDone ? '已完成，看板里的同名任务同步更新了' : '已取消，看板里的同名任务同步更新了');
      });
    }
  };

  /* ---------- 任务看板 ---------- */

  /* 按筛选条件挑出要显示的任务 */
  function visibleTasks(tasks) {
    return tasks.filter(function (t) {
      if (filter.term !== 'all' && t.term !== filter.term) return false;
      if (filter.pri !== 'all' && t.priority !== filter.pri) return false;
      return true;
    });
  }

  /* 单张任务卡片 */
  function taskCard(task, pos, total) {
    var p = priorityOf(task.priority);
    var idx = colIndex(task.status);
    var overdue = task.due && task.due < today() && task.status !== 'done';

    var dueHtml = task.due
      ? '<p class="task__due' + (overdue ? ' is-overdue' : '') + '">' +
          UI.icon('calendar') + UI.esc(task.due) + (overdue ? ' · 已过期' : '') + '</p>'
      : '';

    return '<div class="task" draggable="true" data-id="' + task.id + '">' +
      '<div class="task__top">' +
        '<span class="task__pri" style="background:' + UI.tone(p.tone) + '">' + p.name + '</span>' +
        (task.term ? UI.tag(task.term, 'ghost') : '') +
        /* 加上文字。原来只有图标，15px 的大小加 1px 线宽，
           用户认不出那是"编辑"——尤其图标还被裁掉一截的时候。 */
        '<button class="icon-btn icon-btn--sm icon-btn--label" data-action="task-edit" data-id="' +
          task.id + '" title="编辑任务" aria-label="编辑任务">' +
          UI.icon('edit') + '<span>编辑</span></button>' +
        '<button class="icon-btn icon-btn--sm icon-btn--label icon-btn--danger" data-action="task-del" data-id="' +
          task.id + '" title="删除任务" aria-label="删除任务">' +
          UI.icon('trash') + '<span>删除</span></button>' +
      '</div>' +
      '<p class="task__title">' + UI.esc(task.title) + '</p>' +
      dueHtml +
      /* 图标按钮只有图形没有文字，title 既是悬停提示也是无障碍名称，
         aria-label 再补一道——手机上根本没有悬停，读屏软件也主要读后者 */
      '<div class="task__move">' +
        '<button class="icon-btn icon-btn--sm" data-action="task-order" data-id="' + task.id +
          '" data-dir="-1" ' + (pos <= 0 ? 'disabled' : '') +
          ' title="在本列内上移" aria-label="在本列内上移">' + UI.icon('chevron-up') + '</button>' +
        '<button class="icon-btn icon-btn--sm" data-action="task-order" data-id="' + task.id +
          '" data-dir="1" ' + (pos >= total - 1 ? 'disabled' : '') +
          ' title="在本列内下移" aria-label="在本列内下移">' + UI.icon('chevron-down') + '</button>' +
        '<span class="task__move-gap"></span>' +
        '<button class="icon-btn icon-btn--sm" data-action="task-move" data-id="' + task.id +
          '" data-dir="-1" ' + (idx <= 0 ? 'disabled' : '') +
          ' title="移到左边一列" aria-label="移到左边一列">' + UI.icon('arrow-left') + '</button>' +
        '<button class="icon-btn icon-btn--sm" data-action="task-move" data-id="' + task.id +
          '" data-dir="1" ' + (idx >= COLUMNS.length - 1 ? 'disabled' : '') +
          ' title="移到右边一列" aria-label="移到右边一列">' + UI.icon('arrow-right') + '</button>' +
      '</div>' +
    '</div>';
  }

  /* 三列看板 */
  function boardHtml(tasks) {
    var shown = visibleTasks(tasks);
    return '<div class="board">' + COLUMNS.map(function (col) {
      var list = shown.filter(function (t) { return t.status === col.key; });
      return '<div class="board__col" data-col="' + col.key + '">' +
        '<div class="board__head">' +
          '<span class="board__dot" style="background:' + UI.tone(col.tone) + '"></span>' +
          '<h3>' + col.name + '</h3>' +
          '<span class="board__count">' + list.length + '</span>' +
        '</div>' +
        '<div class="board__list" data-drop="' + col.key + '">' +
          (list.length
            ? list.map(function (t, i) { return taskCard(t, i, list.length); }).join('')
            : '<div class="board__empty">' + (tasks.length ? '没有符合筛选条件的任务' : '拖动任务到这里') + '</div>') +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  /* 筛选条 */
  function filterBar(tasks) {
    var termChips = ['all'].concat(TERMS).map(function (t) {
      var name = t === 'all' ? '全部阶段' : t;
      var count = t === 'all' ? tasks.length
        : tasks.filter(function (x) { return x.term === t; }).length;
      return '<button class="chip' + (filter.term === t ? ' is-on' : '') +
        '" data-action="filter-term" data-v="' + t + '">' + name +
        '<i>' + count + '</i></button>';
    }).join('');

    /* 优先级这一行也要显示条数。原来只有阶段那行有数字，
       两行并排放在一起，一个有一个没有，看着像优先级这行坏了；
       而且用户想按优先级筛的时候，正需要先知道每档分别有多少。 */
    var priChips = ['all'].concat(PRIORITIES.map(function (p) { return p.key; })).map(function (k) {
      var name = k === 'all' ? '全部优先级' : (priorityOf(k).name + '优先级');
      var count = k === 'all' ? tasks.length
        : tasks.filter(function (x) { return x.priority === k; }).length;
      return '<button class="chip' + (filter.pri === k ? ' is-on' : '') +
        '" data-action="filter-pri" data-v="' + k + '">' + name +
        '<i>' + count + '</i></button>';
    }).join('');

    return '<div class="filter-bar">' +
      '<div class="filter-row">' + termChips + '</div>' +
      '<div class="filter-row">' + priChips + '</div>' +
    '</div>';
  }

  AICS.Views.kanban = {
    title: '任务看板',
    desc: '把规划拆成今天就能动手的小任务',

    render: function () {
      var tasks = AICS.Store.get().tasks || [];

      var head = UI.pageHeader('学习任务看板',
        '可以拖动卡片换列，也可以用卡片上的箭头操作',
        '<button class="btn" data-action="import-roadmap">' + UI.icon('download') + ' 导入未完成的规划任务</button>');

      /* 新增任务表单 */
      var form = '<div class="panel add-task">' +
        '<div class="add-task__row">' +
          '<input type="text" id="task-title" class="input" placeholder="要做什么？例如：看完吴恩达第三周并做完作业" maxlength="60">' +
          /* 默认选用户自己的年级。TERMS[0] 是「大一」，
             不加 selected 的话浏览器会默认选它——大三学生加"投暑期实习"
             会被挂上"大一"标签，之后按大三筛选时这条任务直接消失。 */
          '<select id="task-term" class="input input--sm">' +
            TERMS.map(function (t) {
              var sel = (AICS.Store.get().profile.year === t) ? ' selected' : '';
              return '<option value="' + t + '"' + sel + '>' + t + '</option>';
            }).join('') +
          '</select>' +
          '<select id="task-pri" class="input input--sm">' +
            PRIORITIES.map(function (p) {
              return '<option value="' + p.key + '"' + (p.key === 'mid' ? ' selected' : '') + '>' + p.name + '优先级</option>';
            }).join('') +
          '</select>' +
          UI.dateField('task-due', 'input input--sm', '', '截止日期', '可直接输入') +
          '<button class="btn btn--primary" data-action="task-add">' + UI.icon('plus') + ' 添加</button>' +
        '</div>' +
        '<p class="muted">任务写得越具体越容易开始。「学机器学习」不如「看完吴恩达第 3 周视频」。</p>' +
      '</div>';

      var empty = !tasks.length
        ? UI.empty({
            icon: 'kanban',
            title: '看板还是空的',
            desc: '可以手动添加任务，也可以一键把「四年规划」里还没完成的任务导进来。',
            action: 'import-roadmap',
            actionText: '导入未完成的规划任务'
          })
        : '';

      return head + form +
        (tasks.length ? filterBar(tasks) : '') +
        '<div id="board-wrap">' + (tasks.length ? boardHtml(tasks) : empty) + '</div>';
    },

    mount: function (root) {
      UI.syncDateFields(root);

      var titleInput = root.querySelector('#task-title');
      if (titleInput) {
        titleInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') addTask(root);
        });
      }

      root.addEventListener('click', function (e) {
        /* 添加 */
        if (e.target.closest('[data-action="task-add"]')) { addTask(root); return; }

        /* 筛选 */
        var ft = e.target.closest('[data-action="filter-term"]');
        if (ft) {
          filter.term = ft.getAttribute('data-v');
          AICS.App.refresh();
          return;
        }
        var fp = e.target.closest('[data-action="filter-pri"]');
        if (fp) {
          filter.pri = fp.getAttribute('data-v');
          AICS.App.refresh();
          return;
        }

        /* 列间移动 */
        var moveBtn = e.target.closest('[data-action="task-move"]');
        if (moveBtn) {
          var mid = moveBtn.getAttribute('data-id');
          var mdir = Number(moveBtn.getAttribute('data-dir'));
          updateTask(mid, function (t) {
            var next = Math.max(0, Math.min(COLUMNS.length - 1, colIndex(t.status) + mdir));
            return { status: COLUMNS[next].key };
          });
          redrawBoard(root);
          return;
        }

        /* 列内排序 */
        var orderBtn = e.target.closest('[data-action="task-order"]');
        if (orderBtn) {
          swapOrder(orderBtn.getAttribute('data-id'), Number(orderBtn.getAttribute('data-dir')));
          redrawBoard(root);
          return;
        }

        /* 编辑 */
        var editBtn = e.target.closest('[data-action="task-edit"]');
        if (editBtn) {
          editTask(editBtn.getAttribute('data-id'), root);
          return;
        }

        /* 删除（带撤销） */
        var delBtn = e.target.closest('[data-action="task-del"]');
        if (delBtn) {
          var did = delBtn.getAttribute('data-id');
          var all = AICS.Store.get().tasks || [];
          var removed = all.filter(function (t) { return t.id === did; })[0];
          var index = all.map(function (t) { return t.id; }).indexOf(did);
          if (!removed) return;

          AICS.Store.set('tasks', all.filter(function (t) { return t.id !== did; }));
          redrawBoard(root);
          UI.toast('已删除「' + removed.title + '」', 'info', {
            text: '撤销',
            onClick: function () {
              var list = (AICS.Store.get().tasks || []).slice();
              list.splice(index, 0, removed);      // 放回原来的位置
              AICS.Store.set('tasks', list);
              AICS.App.refresh();
              UI.toast('已恢复', 'success');
            }
          });
        }
      });

      /* 拖拽换列 */
      var draggingId = '';
      root.addEventListener('dragstart', function (e) {
        var card = e.target.closest('.task');
        if (!card) return;
        draggingId = card.getAttribute('data-id');
        card.classList.add('is-dragging');
        try { e.dataTransfer.setData('text/plain', draggingId); } catch (err) { /* 忽略 */ }
        e.dataTransfer.effectAllowed = 'move';
      });
      root.addEventListener('dragend', function (e) {
        var card = e.target.closest('.task');
        if (card) card.classList.remove('is-dragging');
        draggingId = '';
      });
      root.addEventListener('dragover', function (e) {
        var zone = e.target.closest('[data-drop]');
        if (!zone || !draggingId) return;
        e.preventDefault();          // 不阻止默认行为的话 drop 不会触发
        zone.classList.add('is-over');
      });
      root.addEventListener('dragleave', function (e) {
        var zone = e.target.closest('[data-drop]');
        if (zone) zone.classList.remove('is-over');
      });
      root.addEventListener('drop', function (e) {
        var zone = e.target.closest('[data-drop]');
        if (!zone || !draggingId) return;
        e.preventDefault();
        zone.classList.remove('is-over');

        var target = zone.getAttribute('data-drop');
        updateTask(draggingId, function () { return { status: target }; });
        redrawBoard(root);
        UI.toast('已移动到「' + COLUMNS.filter(function (c) { return c.key === target; })[0].name + '」');
      });
    }
  };

  /* ---------- 任务操作 ---------- */

  /* 改一个任务的字段。如果状态变了，回头同步四年规划里的勾选 */
  function updateTask(id, patchFn) {
    var all = AICS.Store.get().tasks || [];
    var before = all.filter(function (t) { return t.id === id; })[0];
    var tasks = all.map(function (t) {
      return t.id === id ? Object.assign({}, t, patchFn(t)) : t;
    });
    AICS.Store.set('tasks', tasks);

    var after = tasks.filter(function (t) { return t.id === id; })[0];
    if (before && after && before.status !== after.status) {
      AICS.syncRoadmapFromTask(after.title, after.status);
    }
  }

  /* 在同一列内和相邻位置的任务交换顺序。
     邻居必须按"筛选后看得见的那几个"来算，不能按全量任务算——
     卡片上的 ▲/▼ 是不是禁用，用的是可见列表里的位置（见 taskCard 的 pos/total），
     而这里原来拿全量任务找邻居。筛选一开就错位：界面上三个可见任务
     A、H、C（H 被筛掉），C 的 ▲ 是可点的，点下去却去和隐藏的 H 交换，
     画面纹丝不动——用户只会觉得这个按钮坏了。
     可见顺序就是全局数组顺序的子序列，所以交换两者在全局数组里的下标
     一定能换来可见顺序的改变。 */
  function swapOrder(id, dir) {
    var tasks = (AICS.Store.get().tasks || []).slice();
    var me = tasks.filter(function (t) { return t.id === id; })[0];
    if (!me) return;

    /* 只在同一列内、且当前筛选下可见的任务里找相邻的那一个 */
    var sameCol = visibleTasks(tasks).filter(function (t) { return t.status === me.status; });
    var pos = sameCol.map(function (t) { return t.id; }).indexOf(id);
    var other = sameCol[pos + dir];
    if (!other) return;

    var a = tasks.map(function (t) { return t.id; }).indexOf(id);
    var b = tasks.map(function (t) { return t.id; }).indexOf(other.id);
    var tmp = tasks[a];
    tasks[a] = tasks[b];
    tasks[b] = tmp;
    AICS.Store.set('tasks', tasks);
  }

  function addTask(root) {
    var input = root.querySelector('#task-title');
    if (!input) return;
    var title = (input.value || '').trim();
    if (!title) { UI.toast('先写点内容再添加', 'error'); input.focus(); return; }

    var tasks = (AICS.Store.get().tasks || []).slice();
    tasks.push({
      id: AICS.Store.uid('task'),
      title: title,
      status: 'todo',
      term: root.querySelector('#task-term').value,
      priority: root.querySelector('#task-pri').value,
      due: root.querySelector('#task-due').value || ''
    });
    AICS.Store.set('tasks', tasks);

    input.value = '';
    root.querySelector('#task-due').value = '';
    UI.syncDateFields(root);   // 清空之后要把提示字放回来
    input.focus();
    redrawBoard(root);
    UI.toast('任务已添加', 'success');
  }

  /* 编辑任务：弹一个表单 */
  function editTask(id, root) {
    var task = (AICS.Store.get().tasks || []).filter(function (t) { return t.id === id; })[0];
    if (!task) return;

    var html = '<div class="form-grid">' +
      '<label class="form-grid__full">任务内容' +
        '<input type="text" id="e-title" class="input" maxlength="60" value="' + UI.esc(task.title) + '">' +
      '</label>' +
      '<label>所属阶段<select id="e-term" class="input">' +
        TERMS.map(function (t) {
          return '<option value="' + t + '"' + (task.term === t ? ' selected' : '') + '>' + t + '</option>';
        }).join('') +
      '</select></label>' +
      '<label>优先级<select id="e-pri" class="input">' +
        PRIORITIES.map(function (p) {
          return '<option value="' + p.key + '"' + (task.priority === p.key ? ' selected' : '') + '>' + p.name + '</option>';
        }).join('') +
      '</select></label>' +
      '<label>截止日期' + UI.dateField('e-due', 'input', task.due || '', '不设置就留空', '可直接输入') + '</label>' +
      '<label>状态<select id="e-status" class="input">' +
        COLUMNS.map(function (c) {
          return '<option value="' + c.key + '"' + (task.status === c.key ? ' selected' : '') + '>' + c.name + '</option>';
        }).join('') +
      '</select></label>' +
    '</div>';

    UI.modal({
      title: '编辑任务',
      html: html,
      actions: [
        { text: '取消' },
        {
          text: '保存',
          type: 'primary',
          onClick: function (wrap) {
            var newTitle = (wrap.querySelector('#e-title').value || '').trim();
            if (!newTitle) { UI.toast('任务内容不能为空', 'error'); return false; }
            updateTask(id, function () {
              return {
                title: newTitle,
                term: wrap.querySelector('#e-term').value,
                priority: wrap.querySelector('#e-pri').value,
                due: wrap.querySelector('#e-due').value || '',
                status: wrap.querySelector('#e-status').value
              };
            });
            redrawBoard(root);
            UI.toast('已保存', 'success');
          }
        }
      ],
      onMount: function (wrap) { UI.syncDateFields(wrap); }
    });
  }

  /* 只重画看板区域，不动输入框和筛选条。
     但有两种"跨结构"的变化没法靠换 #board-wrap 完成，得整页重绘：
       · 任务从有到无：空状态和看板是两套 DOM
       · 任务从无到有：筛选条不在 #board-wrap 里，只在"有任务"时才渲染。
         实测过——空看板加进第一条任务后，筛选条要切页再回来才出现。 */
  function redrawBoard(root) {
    var wrap = root.querySelector('#board-wrap');
    if (!wrap) return;
    var tasks = AICS.Store.get().tasks || [];
    if (!tasks.length) { AICS.App.refresh(); return; }
    if (!root.querySelector('.filter-bar')) { AICS.App.refresh(); return; }
    wrap.innerHTML = boardHtml(tasks);
  }

  /* ---------- 与四年规划联动 ---------- */

  /* 把四年规划里未完成的任务导入看板。
     只导当前路线的任务——走升学路线的人不需要把"秋招冲刺"加到看板里。
     已经导入过的不重复加；已勾选完成的不导入（按钮上写的就是"未完成"）。 */
  AICS.importRoadmapToKanban = function () {
    var state = AICS.Store.get();
    var existing = state.tasks || [];
    var roadmap = state.roadmap || {};
    var track = AICS.resolveTrack(state);
    var stages = AICS.roadmapFor(track.key);
    var titles = {};
    existing.forEach(function (t) { titles[t.title] = true; });

    var added = 0;
    var next = existing.slice();
    stages.forEach(function (stage) {
      stage.tasks.forEach(function (t) {
        if (titles[t.title]) return;         // 已经在看板里了
        if (roadmap[t.id]) return;           // 四年规划里已经打勾了，不用导
        titles[t.title] = true;
        next.push({
          id: AICS.Store.uid('task'),
          title: t.title,
          status: 'todo',
          term: stage.year,
          /* 用四年规划里给这项定的优先级，别再写死 mid——
             写死的结果是导进来一堆"中"，筛选条按优先级筛等于没筛。
             数据里没写的按 mid 兜底。 */
          priority: t.pri || 'mid',
          due: ''
        });
        added++;
      });
    });

    AICS.Store.set('tasks', next);
    return { added: added, track: track.name };
  };

  /* ---------- 四年规划 ↔ 任务看板：双向联动 ----------
     两个方向各管各的，别指望一个函数同时干两件事。 */

  /* 看板里某个任务的状态变了 → 回头把四年规划里同名的那一项也改掉。
     只在当前路线的任务里找，因为不同路线可能存在同名的任务
     （比如「整理一个能讲 20 分钟的核心项目」在就业和"还没想好"里都有）。 */
  AICS.syncRoadmapFromTask = function (title, status) {
    var state = AICS.Store.get();
    var track = AICS.resolveTrack(state);
    var stages = AICS.roadmapFor(track.key);

    var match = null;
    stages.forEach(function (stage) {
      if (match) return;
      stage.tasks.forEach(function (t) {
        if (!match && t.title === title) match = t;
      });
    });
    if (!match) return false;

    var map = Object.assign({}, state.roadmap);
    var shouldCheck = status === 'done';
    if (shouldCheck === !!map[match.id]) return false;   // 状态已经一致，不用动

    if (shouldCheck) map[match.id] = true;
    else delete map[match.id];
    /* 同样要用 replaceKey——取消最后一项勾选时 map 会是空对象 */
    AICS.Store.replaceKey('roadmap', map);
    return true;
  };

  /* 四年规划里勾上/取消某项 → 把看板里同名任务的完成状态改掉。
     注意取消勾选时只碰"已完成"的任务：如果任务正在"进行中"，
     说明用户本来就没做完，不该把它退回到"待办"丢掉进度状态。 */
  AICS.syncTaskFromRoadmap = function (title, done) {
    var tasks = AICS.Store.get().tasks || [];
    var changed = false;

    var next = tasks.map(function (t) {
      if (t.title !== title) return t;

      if (done) {
        if (t.status === 'done') return t;
        changed = true;
        return Object.assign({}, t, { status: 'done' });
      }
      /* 取消勾选：只有已经从完成状态里退出来才有意义 */
      if (t.status !== 'done') return t;
      changed = true;
      return Object.assign({}, t, { status: 'todo' });
    });

    if (changed) AICS.Store.set('tasks', next);
    return changed;
  };

})(window.AICS);
