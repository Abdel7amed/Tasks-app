/* app.js - Enhanced ToDo PWA
   Features:
   - LocalStorage persistence
   - Drag & drop reorder (HTML5)
   - Tags, priority, due date
   - Search, filter, sort, filter-by-tag
   - Undo delete via toast
   - Notification scheduling (in-session, uses Notification API)
   - PWA install prompt handling
   - Service worker registration
   - Keyboard shortcuts: N (focus new task), "/" to search
*/

(() => {
  const LS_KEY = "tasks_v2_abdelhamed";
  const taskForm = document.getElementById("taskForm");
  const taskInput = document.getElementById("taskInput");
  const tagsInput = document.getElementById("tagsInput");
  const dueInput = document.getElementById("dueInput");
  const prioritySelect = document.getElementById("prioritySelect");
  const addBtn = document.getElementById("addBtn");
  const listEl = document.getElementById("taskList");
  const filterSelect = document.getElementById("filterSelect");
  const sortSelect = document.getElementById("sortSelect");
  const tagFilter = document.getElementById("tagFilter");
  const searchInput = document.getElementById("searchInput");
  const countAll = document.getElementById("countAll");
  const countCompleted = document.getElementById("countCompleted");
  const clearCompletedBtn = document.getElementById("clearCompleted");
  const clearAllBtn = document.getElementById("clearAll");
  const themeToggle = document.getElementById("themeToggle");
  const installBtn = document.getElementById("installBtn");
  const toastEl = document.getElementById("toast");

  let tasks = [];
  let pendingInstallEvent = null;
  let lastDeleted = null; // for undo
  let notifiers = {}; // timeouts for in-session notifications

  // Utils
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  const save = () => localStorage.setItem(LS_KEY, JSON.stringify(tasks));
  const load = () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      tasks = raw ? JSON.parse(raw) : [];
    } catch (e) {
      tasks = [];
      console.error("Failed to parse tasks", e);
    }
  };

  // Notification permission request
  async function ensureNotificationPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const p = await Notification.requestPermission();
    return p === "granted";
  }

  // Schedule notifications for tasks with dueDate (only while page open)
  function scheduleAllNotifications() {
    // clear existing
    Object.values(notifiers).forEach(t => clearTimeout(t));
    notifiers = {};
    const now = Date.now();
    tasks.forEach(t => {
      if (!t.due || t.notified || t.done) return;
      const dueMs = new Date(t.due).getTime();
      const diff = dueMs - now;
      if (diff <= 0) {
        // due in the past -> show immediately if not shown
        showTaskNotification(t);
        t.notified = true;
        save();
      } else if (diff <= 1000 * 60 * 60 * 24 * 7) { // schedule only within a week to avoid huge timers
        notifiers[t.id] = setTimeout(() => {
          showTaskNotification(t);
          t.notified = true;
          save();
          render(); // update UI
        }, diff);
      }
    });
  }

  function showTaskNotification(task) {
    ensureNotificationPermission().then(has => {
      if (has) {
        try {
          new Notification("موعد المهمة", {
            body: task.text + (task.due ? " — " + new Date(task.due).toLocaleString() : ""),
            tag: task.id,
            renotify: true,
            icon: undefined
          });
        } catch (e) { console.warn("Notification failed", e); }
      }
    });
    // also flash UI: highlight task
    const el = listEl.querySelector(`[data-id="${task.id}"]`);
    if (el) {
      el.classList.add("highlight");
      setTimeout(() => el.classList.remove("highlight"), 4000);
    }
  }

  // Render
  function render() {
    const filter = filterSelect.value;
    const sort = sortSelect.value;
    const q = (searchInput.value || "").trim().toLowerCase();
    const tagF = tagFilter.value;
    listEl.innerHTML = "";

    // derive filtered list
    let filtered = tasks.filter(t => {
      if (filter === "active" && t.done) return false;
      if (filter === "completed" && !t.done) return false;
      if (tagF !== "all" && (!t.tags || !t.tags.includes(tagF))) return false;
      if (q && !t.text.toLowerCase().includes(q) && !(t.tags && t.tags.join(" ").toLowerCase().includes(q))) return false;
      return true;
    });

    // sort
    filtered.sort((a,b) => {
      if (sort === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
      if (sort === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
      if (sort === "duedate") {
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return new Date(a.due) - new Date(b.due);
      }
      if (sort === "priority") {
        const rank = { high: 0, normal: 1, low: 2 };
        return rank[a.priority] - rank[b.priority];
      }
      return 0;
    });

    if (filtered.length === 0) {
      const empty = document.createElement("li");
      empty.className = "task-item";
      empty.innerHTML = `<div class="left"><div><strong class="title muted">لا توجد مهام لعرضها</strong></div></div>`;
      listEl.appendChild(empty);
    } else {
      filtered.forEach(t => listEl.appendChild(createTaskElement(t)));
    }

    // stats
    countAll.textContent = tasks.length;
    countCompleted.textContent = tasks.filter(t => t.done).length;
    save();
    populateTagFilter();
    scheduleAllNotifications();
  }

  function createTaskElement(t) {
    const li = document.createElement("li");
    li.className = "task-item" + (t.done ? " completed" : "");
    li.dataset.id = t.id;
    li.setAttribute("draggable", "true");
    li.setAttribute("aria-grabbed", "false");

    // left area
    const left = document.createElement("div"); left.className = "left";

    const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = !!t.done;
    checkbox.addEventListener("change", () => toggleDone(t.id));

    const titleWrap = document.createElement("div");
    const title = document.createElement("div"); title.className = "title"; title.textContent = t.text;

    const meta = document.createElement("div"); meta.className = "meta";
    const parts = [];
    parts.push(new Date(t.createdAt).toLocaleString());
    if (t.due) parts.push("استحقاق: " + new Date(t.due).toLocaleString());
    if (t.tags && t.tags.length) parts.push("تسميات: " + t.tags.join(", "));
    meta.textContent = parts.join(" • ");

    // tags chips
    const chips = document.createElement("div"); chips.className = "chips";
    if (t.tags && t.tags.length) {
      t.tags.forEach(tag => {
        const c = document.createElement("span"); c.className = "chip"; c.textContent = tag;
        c.tabIndex = 0;
        c.title = `فلتر حسب ${tag}`;
        c.addEventListener("click", () => {
          tagFilter.value = tag;
          render();
        });
        chips.appendChild(c);
      });
    }

    titleWrap.appendChild(title); titleWrap.appendChild(meta); titleWrap.appendChild(chips);

    left.appendChild(checkbox); left.appendChild(titleWrap);

    // priority indicator
    const pDot = document.createElement("div"); pDot.className = "priority-dot " + (t.priority ? "priority-" + t.priority : "priority-normal");
    left.appendChild(pDot);

    // actions
    const actions = document.createElement("div"); actions.className = "task-actions";

    const editBtn = document.createElement("button"); editBtn.className = "icon-btn"; editBtn.title = "تعديل"; editBtn.innerHTML = "✏️";
    editBtn.addEventListener("click", () => openEditDialog(t.id));

    const deleteBtn = document.createElement("button"); deleteBtn.className = "icon-btn"; deleteBtn.title = "حذف"; deleteBtn.innerHTML = "🗑️";
    deleteBtn.addEventListener("click", () => deleteTask(t.id));

    const remindBtn = document.createElement("button"); remindBtn.className = "icon-btn"; remindBtn.title = "تذكير"; remindBtn.innerHTML = "⏰";
    remindBtn.addEventListener("click", async () => {
      if (!t.due) {
        const when = prompt("حدد تاريخ ووقت التذكير (مثال: 2025-10-27T15:30)","");
        if (when) {
          t.due = when;
          save();
          render();
        }
      } else {
        if (confirm("هل تريد إزالة التاريخ؟")) {
          t.due = null; t.notified = false; save(); render();
        }
      }
    });

    actions.appendChild(remindBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(left); li.appendChild(actions);

    // drag handlers
    li.addEventListener("dragstart", (e) => {
      li.classList.add("dragging");
      e.dataTransfer.setData("text/plain", t.id);
      e.dataTransfer.effectAllowed = "move";
    });
    li.addEventListener("dragend", () => {
      li.classList.remove("dragging");
    });

    // allow drop on items to reorder
    li.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = listEl.querySelector(".dragging");
      if (!dragging || dragging === li) return;
      // show visual insertion
      const rect = li.getBoundingClientRect();
      const after = (e.clientY - rect.top) > rect.height / 2;
      if (after) {
        li.parentNode.insertBefore(dragging, li.nextSibling);
      } else {
        li.parentNode.insertBefore(dragging, li);
      }
    });

    li.addEventListener("drop", (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData("text/plain");
      const targetId = li.dataset.id;
      reorderTasks(draggedId, targetId);
      render();
    });

    return li;
  }

  // CRUD & helpers
  function addTaskObj(task) {
    tasks.unshift(task);
    save();
    render();
  }

  function addTask(text, tags, due, priority) {
    if (!text || !text.trim()) return;
    const newTask = {
      id: uid(),
      text: text.trim(),
      tags: tags ? tags.map(s => s.trim()).filter(Boolean) : [],
      due: due || null,
      priority: priority || "normal",
      done: false,
      createdAt: new Date().toISOString(),
      notified: false
    };
    addTaskObj(newTask);
  }

  function deleteTask(id) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    // save for undo
    lastDeleted = { item: tasks[idx], index: idx };
    tasks.splice(idx, 1);
    save();
    render();
    showToast(`تم حذف مهمة`, "تراجع", undoDelete, 7000);
  }

  function undoDelete() {
    if (!lastDeleted) return;
    tasks.splice(lastDeleted.index, 0, lastDeleted.item);
    lastDeleted = null;
    save();
    render();
    hideToast();
  }

  function toggleDone(id) {
    const t = tasks.find(x => x.id === id);
    if (t) {
      t.done = !t.done;
      save();
      render();
    }
  }

  function openEditDialog(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    const newText = prompt("عدّل المهمة:", t.text);
    if (newText === null) return;
    if (!newText.trim()) { alert("المهمة لا يمكن أن تكون فارغة."); return; }
    const newTags = prompt("التسميات (افصل بفاصلة):", t.tags ? t.tags.join(", ") : "") || "";
    const newDue = prompt("تاريخ الاستحقاق (YYYY-MM-DDTHH:mm) أو اتركه فارغاً:", t.due || "") || "";
    const newPriority = prompt("الأولوية (high, normal, low):", t.priority || "normal") || t.priority;
    t.text = newText.trim();
    t.tags = newTags.split(",").map(s => s.trim()).filter(Boolean);
    t.due = newDue ? newDue : null;
    t.priority = ["high","normal","low"].includes(newPriority) ? newPriority : "normal";
    t.notified = false;
    save();
    render();
  }

  function clearCompleted() {
    tasks = tasks.filter(t => !t.done);
    save();
    render();
  }

  function clearAll() {
    if (!confirm("هل تريد مسح جميع المهام؟ هذا الإجراء لا يمكن التراجع عنه.")) return;
    tasks = [];
    save();
    render();
  }

  function reorderTasks(draggedId, targetId) {
    const from = tasks.findIndex(t => t.id === draggedId);
    const to = tasks.findIndex(t => t.id === targetId);
    if (from === -1 || to === -1) return;
    const [moved] = tasks.splice(from,1);
    tasks.splice(to,0,moved);
    save();
  }

  // tag filter population
  function populateTagFilter() {
    const allTags = new Set();
    tasks.forEach(t => (t.tags || []).forEach(tag => allTags.add(tag)));
    const prev = tagFilter.value || "all";
    tagFilter.innerHTML = `<option value="all">كل التسميات</option>`;
    Array.from(allTags).sort().forEach(tag => {
      const opt = document.createElement("option"); opt.value = tag; opt.textContent = tag; tagFilter.appendChild(opt);
    });
    if (Array.from(tagFilter.options).some(o => o.value === prev)) tagFilter.value = prev;
  }

  // Toast handling
  let toastTimeout = null;
  function showToast(message, actionText, actionFn, duration = 5000) {
    toastEl.hidden = false;
    toastEl.innerHTML = "";
    const msg = document.createElement("div"); msg.textContent = message;
    toastEl.appendChild(msg);
    if (actionText && actionFn) {
      const btn = document.createElement("button");
      btn.textContent = actionText;
      btn.className = "btn";
      btn.addEventListener("click", actionFn);
      toastEl.appendChild(btn);
    }
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { hideToast(); }, duration);
  }
  function hideToast() {
    toastEl.hidden = true;
    toastEl.innerHTML = "";
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = null;
  }

  // Events
  taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = taskInput.value;
    const tags = (tagsInput.value || "").split(",").map(s => s.trim()).filter(Boolean);
    const due = dueInput.value || null;
    const pr = prioritySelect.value || "normal";
    addTask(t, tags, due, pr);
    taskInput.value = ""; tagsInput.value = ""; dueInput.value = ""; prioritySelect.value = "normal";
    taskInput.focus();
  });

  filterSelect.addEventListener("change", render);
  sortSelect.addEventListener("change", render);
  tagFilter.addEventListener("change", render);

  let searchDeb = null;
  searchInput.addEventListener("input", () => {
    if (searchDeb) clearTimeout(searchDeb);
    searchDeb = setTimeout(render, 160);
  });

  clearCompletedBtn.addEventListener("click", clearCompleted);
  clearAllBtn.addEventListener("click", clearAll);

  // Keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    if (e.key === "N" || e.key === "n") { e.preventDefault(); taskInput.focus(); }
    if (e.key === "/") { e.preventDefault(); searchInput.focus(); }
    if ((e.ctrlKey || e.metaKey) && e.key === "f") { e.preventDefault(); searchInput.focus(); }
  });

  // Theme toggle
  function applyTheme(theme) {
    if (theme === "dark") {
      document.body.classList.add("theme-dark");
      document.body.classList.remove("theme-light");
      themeToggle.textContent = "☀️";
    } else {
      document.body.classList.add("theme-light");
      document.body.classList.remove("theme-dark");
      themeToggle.textContent = "🌙";
    }
    localStorage.setItem("tasks_theme", theme);
  }
  themeToggle.addEventListener("click", () => {
    const current = document.body.classList.contains("theme-dark") ? "dark" : "light";
    applyTheme(current === "dark" ? "light" : "dark");
  });

  // PWA install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pendingInstallEvent = e;
    installBtn.style.display = "inline-block";
    installBtn.removeAttribute("aria-hidden");
  });
  installBtn.addEventListener("click", async () => {
    if (!pendingInstallEvent) return;
    pendingInstallEvent.prompt();
    const choice = await pendingInstallEvent.userChoice;
    pendingInstallEvent = null;
    installBtn.style.display = "none";
    installBtn.setAttribute("aria-hidden", "true");
  });

  // Service Worker registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registered', reg.scope))
        .catch(err => console.warn('SW failed', err));
    });
  }

  // Init
  (async function init(){
    load();
    // restore theme
    const theme = localStorage.getItem("tasks_theme") || "light";
    applyTheme(theme);
    render();

    // hide install by default
    installBtn.style.display = "none";
    installBtn.setAttribute("aria-hidden", "true");

    // request notification permission proactively (optional)
    if ("Notification" in window && Notification.permission === "default") {
      // don't annoy: only request if user interacts (we won't request automatically here)
      // you can call ensureNotificationPermission() on a button or first time setting a reminder
    }

    // schedule notifications (in-session)
    scheduleAllNotifications();
  })();

})();
