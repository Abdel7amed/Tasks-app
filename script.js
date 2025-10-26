// script.js - مُحدّث (عرض الوقت عبر الكلاس، طلب الإذن عند الضغط، تسجيل SW)

// ======== أصوات افكت ========
const audioAdd = new Audio('https://www.soundjay.com/buttons/sounds/button-3.mp3');
const audioDelete = new Audio('https://www.soundjay.com/buttons/sounds/button-10.mp3');
const audioComplete = new Audio('https://www.soundjay.com/buttons/sounds/button-4.mp3');

// ======== عناصر الصفحة ========
const taskInput = document.getElementById('task-input');
const taskTime = document.getElementById('task-time');
const taskCategory = document.getElementById('task-category');
const addBtn = document.getElementById('add-btn');
const taskList = document.getElementById('task-list');
const darkModeBtn = document.getElementById('dark-mode-toggle');
const notifyBtn = document.getElementById('notify-toggle');
const filterButtons = document.querySelectorAll('.filter-btn');
const messageBox = document.getElementById('message-box');

let tasks = [];
let notificationsEnabled = (localStorage.getItem('notifications-enabled') === 'true');
let currentFilter = 'all';
let notifyChecker = null;

// ======== Utilities ========
function saveTasks(){ localStorage.setItem('tasks', JSON.stringify(tasks || [])); }
function loadTasks(){ tasks = JSON.parse(localStorage.getItem('tasks') || '[]'); }
function showMessage(msg, duration=2000){
    messageBox.textContent = msg;
    messageBox.classList.add('show');
    clearTimeout(showMessage._t);
    showMessage._t = setTimeout(()=> messageBox.classList.remove('show'), duration);
}

// ======== Dark Mode - تحميل الحالة وتبديلها ========
if(localStorage.getItem('dark-mode')==='enabled'){
    document.body.classList.add('dark-mode');
}
darkModeBtn.addEventListener('click', ()=> {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('dark-mode', document.body.classList.contains('dark-mode') ? 'enabled' : 'disabled');
});

// ======== Notifications UI (باستخدام class .show لعنصر الوقت) ========
function setNotifyUIState(enabled){
    if(enabled){
        taskTime.classList.add('show');
        notifyBtn.classList.add('active');
    } else {
        taskTime.classList.remove('show');
        notifyBtn.classList.remove('active');
    }
}
setNotifyUIState(notificationsEnabled);

// ======== زر التنبيه: نطلب الإذن هنا فقط عند تفاعل المستخدم ========
notifyBtn.addEventListener('click', async ()=> {
    if(!notificationsEnabled){
        if('Notification' in window){
            // نطلب إذن الإشعارات فقط عند ضغط المستخدم
            const permission = await Notification.requestPermission();
            if(permission === 'granted'){
                notificationsEnabled = true;
                localStorage.setItem('notifications-enabled','true');
                setNotifyUIState(true);
                showMessage("تم تفعيل التنبيهات 🔔");
                startNotifyChecker();
            } else {
                notificationsEnabled = false;
                localStorage.setItem('notifications-enabled','false');
                setNotifyUIState(false);
                showMessage("لم يتم تفعيل التنبيهات ❌");
            }
        } else {
            showMessage("المتصفح لا يدعم الإشعارات ❌");
        }
    } else {
        // إيقاف التنبيهات
        notificationsEnabled = false;
        localStorage.setItem('notifications-enabled','false');
        setNotifyUIState(false);
        showMessage("تم إيقاف التنبيهات 🚫");
        stopNotifyChecker();
    }
});

// ======== Check Task Time & messages ========
function checkTaskTime(task){
    if(!task.time) return;
    const now = new Date();
    const [hour, minute] = task.time.split(':').map(Number);
    const taskDate = new Date();
    taskDate.setHours(hour, minute, 0, 0);

    if(!task.completed && now > taskDate){
        if(notificationsEnabled && 'Notification' in window && Notification.permission === 'granted'){
            new Notification(`⏰ المهمة متأخرة: ${task.text}`);
        }
        showMessage(`⏰ تأخرت عن المهمة: ${task.text}`, 2500);
    } else if(task.completed && now < taskDate){
        const phrases = [
            `🌟 ممتاز! خلصت المهمة بدري: ${task.text}`,
            `👍 عمل رائع قبل الموعد: ${task.text}`,
            `🎉 مبروك! المهمة خلصت قبل الوقت: ${task.text}`
        ];
        showMessage(phrases[Math.floor(Math.random()*phrases.length)], 2500);
    } else if(task.completed && now > taskDate){
        showMessage(`✅ خلصت المهمة: ${task.text} بعد الوقت المحدد`, 2500);
    }
}

// ======== Update Filter Counts ========
function updateFilterCounts(){
    document.getElementById('all-count').textContent = tasks.length;
    document.getElementById('completed-count').textContent = tasks.filter(t=>t.completed).length;
    document.getElementById('pending-count').textContent = tasks.filter(t=>!t.completed).length;
}

// ======== Filter Buttons ========
filterButtons.forEach(btn=> {
    btn.addEventListener('click', ()=> {
        currentFilter = btn.dataset.filter;
        filterButtons.forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        renderTasks();
        updateFilterCounts();
    });
});

// ======== Add Task ========
addBtn.addEventListener('click', ()=> {
    const text = taskInput.value.trim();
    const time = taskTime.classList.contains('show') ? taskTime.value : '';
    const category = taskCategory.value.trim() || 'عام';

    if(text !== ''){
        const newTask = {
            id: Date.now(),
            text,
            time: time || '',
            category,
            completed:false,
            lastNotifiedMinute: null
        };
        tasks.push(newTask);
        saveTasks();
        renderTasks();
        updateFilterCounts();
        checkTaskTime(newTask);
        showMessage(`تم إضافة المهمة 🎉: ${text}`);
        audioAdd.play();
        taskInput.value=''; taskTime.value=''; taskCategory.value='';
    } else {
        showMessage('اكتب المهمة أولاً 🙃', 1500);
    }
});
taskInput.addEventListener('keypress', e=>{ if(e.key==='Enter') addBtn.click(); });

// ======== Create Task Element ========
function createTaskElement(task){
    const li = document.createElement('li');
    li.dataset.id = task.id;
    li.classList.add('task');

    const infoDiv = document.createElement('div');
    infoDiv.className = 'task-info';
    infoDiv.style.display = 'flex';
    infoDiv.style.flexDirection = 'column';
    infoDiv.style.gap = '6px';

    const textSpan = document.createElement('span');
    textSpan.textContent = task.text;
    infoDiv.appendChild(textSpan);

    const metaSpan = document.createElement('div');
    metaSpan.style.display = 'flex';
    metaSpan.style.alignItems = 'center';
    metaSpan.style.gap = '8px';
    metaSpan.style.flexWrap = 'wrap';

    if(task.category){
        const catSpan = document.createElement('span');
        catSpan.textContent = `[${task.category}]`;
        catSpan.className = 'task-category';
        metaSpan.appendChild(catSpan);
    }

    if(task.time){
        const timeLabel = document.createElement('span');
        timeLabel.textContent = task.time;
        timeLabel.className = 'time-label';
        metaSpan.appendChild(timeLabel);
    }

    infoDiv.appendChild(metaSpan);
    li.appendChild(infoDiv);

    const rightDiv = document.createElement('div');
    rightDiv.style.display = 'flex';
    rightDiv.style.alignItems = 'center';
    rightDiv.style.gap = '10px';

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'حذف';
    deleteBtn.className = 'delete-btn';
    deleteBtn.type = 'button';
    deleteBtn.addEventListener('click', (e)=> {
        e.stopPropagation();
        audioDelete.play();
        tasks = tasks.filter(t=>t.id!==task.id);
        saveTasks();
        renderTasks();
        updateFilterCounts();
        showMessage(`تم حذف المهمة ❌: ${task.text}`);
    });
    rightDiv.appendChild(deleteBtn);

    li.appendChild(rightDiv);

    li.addEventListener('click', e=>{
        if(e.target.tagName !== 'BUTTON'){
            task.completed = !task.completed;
            if(!task.completed) task.lastNotifiedMinute = null;
            saveTasks();
            renderTasks();
            updateFilterCounts();
            if(task.completed){
                audioComplete.play();
                checkTaskTime(task);
            } else {
                checkTaskTime(task);
            }
        }
    });

    if(task.completed) li.classList.add('completed');
    else li.classList.add('pending');

    return li;
}

// ======== Render Tasks ========
function renderTasks(){
    taskList.innerHTML='';
    let filteredTasks = tasks;

    if(currentFilter === 'completed') filteredTasks = tasks.filter(t=>t.completed);
    else if(currentFilter === 'pending') filteredTasks = tasks.filter(t=>!t.completed);
    else if(currentFilter !== 'all') filteredTasks = tasks.filter(t=>t.category === currentFilter);

    filteredTasks.sort((a,b)=>{
        if(!a.time) return 1;
        if(!b.time) return -1;
        return a.time.localeCompare(b.time);
    });

    filteredTasks.forEach(task => taskList.appendChild(createTaskElement(task)));
}

// ======== Notifications Checker ========
function startNotifyChecker(){
    if(notifyChecker) return;
    notifyChecker = setInterval(()=> {
        if(!notificationsEnabled) return;
        const now = new Date();
        const currentMinuteKey = now.toISOString().slice(0,16); // YYYY-MM-DDTHH:MM
        tasks.forEach(task=>{
            if(task.time && !task.completed){
                const [h,m] = task.time.split(':').map(Number);
                if(h === now.getHours() && m === now.getMinutes()){
                    if(task.lastNotifiedMinute !== currentMinuteKey){
                        if('Notification' in window && Notification.permission === 'granted') {
                            new Notification(`⏰ المهمة متأخرة: ${task.text}`);
                        }
                        task.lastNotifiedMinute = currentMinuteKey;
                        saveTasks();
                    }
                }
            }
        });
    }, 1000 * 20); // يفحص كل 20 ثانية
}

function stopNotifyChecker(){
    if(notifyChecker) {
        clearInterval(notifyChecker);
        notifyChecker = null;
    }
}

// ======== Initial Load ========
window.addEventListener('DOMContentLoaded', async ()=>{
    loadTasks();
    renderTasks();
    updateFilterCounts();

    // حالة الإشعارات نحملها لكن لا نُطالب الإذن تلقائياً
    notificationsEnabled = (localStorage.getItem('notifications-enabled') === 'true') && (Notification && Notification.permission === 'granted');
    setNotifyUIState(notificationsEnabled);

    if(notificationsEnabled) startNotifyChecker();

    // تسجيل Service Worker (ضع المسار الصحيح إذا المشروع في مجلد فرعي)
    if('serviceWorker' in navigator){
        navigator.serviceWorker.register('./sw.js')
        .then(reg=> console.log('Service Worker registered.', reg))
        .catch(err=> console.log('Service Worker registration failed:', err));
    }
});
