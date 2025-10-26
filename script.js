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
const notifyTimeInput = document.getElementById('notify-time');
const filterButtons = document.querySelectorAll('.filter-btn');
const messageBox = document.getElementById('message-box');

let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let notificationsEnabled = false;
let currentFilter = 'all';

// ======== Dark Mode ========
if(localStorage.getItem('dark-mode')==='enabled'){
    document.body.classList.add('dark-mode');
}
darkModeBtn.addEventListener('click', ()=>{
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('dark-mode', document.body.classList.contains('dark-mode') ? 'enabled' : 'disabled');
});

// ======== Notifications ========
notifyBtn.addEventListener('click', async ()=>{
    if(!notificationsEnabled){
        const permission = await Notification.requestPermission();
        if(permission==='granted'){
            notificationsEnabled=true;
            showMessage("تم تفعيل التنبيهات! 🔔");
            notifyTimeInput.style.display = 'block';
        } else {
            showMessage("لم يتم تفعيل التنبيهات ❌");
            notifyTimeInput.style.display = 'none';
        }
    } else {
        notificationsEnabled=false;
        showMessage("تم إيقاف التنبيهات 🚫");
        notifyTimeInput.style.display = 'none';
    }
});

notifyTimeInput.addEventListener('change', e=>{
    const notifyTime = e.target.value;
    localStorage.setItem('notify-time', notifyTime);
    showMessage(`تم ضبط التذكير الساعة ⏰ ${notifyTime}`);
});

// ======== Filter ========
filterButtons.forEach(btn=>{
    btn.addEventListener('click', ()=>{
        currentFilter = btn.dataset.filter;
        filterButtons.forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        renderTasks();
        updateFilterCounts();
    });
});

// ======== Helper Functions ========
function saveTasks(){ localStorage.setItem('tasks', JSON.stringify(tasks)); }

function showMessage(msg, duration=2000){
    messageBox.textContent = msg;
    messageBox.classList.add('show');
    setTimeout(()=>{ messageBox.classList.remove('show'); }, duration);
}

function checkTaskTime(task){
    if(!task.time) return;
    const now = new Date();
    const [hour, minute] = task.time.split(':').map(Number);
    const taskDate = new Date();
    taskDate.setHours(hour, minute, 0, 0);

    if(!task.completed && now > taskDate){
        showMessage(`⏰ يا نهار أبيض! انت متأخر عن المهمة: ${task.text}`, 2500);
    } else if(task.completed && now < taskDate){
        const phrases = [
            `🌟 ممتاز! خلصت المهمة بدري: ${task.text}`,
            `👍 عمل رائع قبل الموعد: ${task.text}`,
            `🎉 مبروك! المهمة خلصت قبل الوقت: ${task.text}`
        ];
        const msg = phrases[Math.floor(Math.random()*phrases.length)];
        showMessage(msg, 2500);
    }
}

// ======== تحديث عدادات الفلاتر ========
function updateFilterCounts(){
    document.getElementById('all-count').textContent = tasks.length;
    document.getElementById('completed-count').textContent = tasks.filter(t=>t.completed).length;
    document.getElementById('pending-count').textContent = tasks.filter(t=>!t.completed).length;
}

// ======== إضافة مهمة ========
addBtn.addEventListener('click', ()=>{
    const text = taskInput.value.trim();
    const time = taskTime.value;
    const category = taskCategory.value.trim() || 'عام';

    if(text !== ''){
        const newTask = {
            id: Date.now(),
            text,
            time: time || '',
            category,
            completed: false
        };
        tasks.push(newTask);
        saveTasks();
        renderTasks();
        updateFilterCounts();
        checkTaskTime(newTask);
        showMessage(`تم إضافة المهمة 🎉: ${text}`);
        audioAdd.play();
        taskInput.value=''; taskTime.value=''; taskCategory.value='';
    }
});

taskInput.addEventListener('keypress', e=>{ if(e.key==='Enter') addBtn.click(); });

// ======== إنشاء عنصر المهمة ========
function createTaskElement(task){
    const li = document.createElement('li');
    li.dataset.id = task.id;
    li.dataset.category = task.category;
    li.draggable = true;
    li.classList.add('added');

    const taskText = document.createElement('span');
    taskText.textContent = task.text;
    li.appendChild(taskText);

    if(task.time){
        const timeLabel = document.createElement('span');
        timeLabel.className = 'time-label';
        timeLabel.textContent = task.time;
        li.appendChild(timeLabel);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'حذف';
    deleteBtn.className = 'delete-btn';
    deleteBtn.addEventListener('click', ()=>{
        li.classList.add('deleting');
        audioDelete.play();
        showMessage(`تم حذف المهمة ❌: ${task.text}`);
        setTimeout(()=>{
            tasks = tasks.filter(t=>t.id !== task.id);
            saveTasks();
            renderTasks();
            updateFilterCounts();
        }, 300);
    });
    li.appendChild(deleteBtn);

    li.addEventListener('click', e=>{
        if(e.target.tagName !== 'BUTTON'){
            task.completed = !task.completed;
            saveTasks();
            renderTasks();
            updateFilterCounts();
            if(task.completed){
                li.classList.add('flash');
                audioComplete.play();
                checkTaskTime(task);
                setTimeout(()=>{ li.classList.remove('flash'); },500);
            }
        }
    });

    if(task.completed) li.classList.add('completed');
    else li.classList.add('pending');

    return li;
}

// ======== عرض المهام مع دعم الفلترة ========
function renderTasks(){
    taskList.innerHTML='';
    let filteredTasks = tasks;

    if(currentFilter==='completed') filteredTasks = tasks.filter(t=>t.completed);
    else if(currentFilter==='pending') filteredTasks = tasks.filter(t=>!t.completed);
    // currentFilter ممكن يكون تصنيف، نتركه افتراضي للكل
    else if(currentFilter!=='all') filteredTasks = tasks.filter(t => t.category === currentFilter);

    filteredTasks.sort((a,b)=>{
        if(!a.time) return 1;
        if(!b.time) return -1;
        return a.time.localeCompare(b.time);
    });

    filteredTasks.forEach(task => {
        taskList.appendChild(createTaskElement(task));
    });
}

// ======== Drag & Drop ========
taskList.addEventListener('dragstart', e=>{ e.target.classList.add('dragging'); });
taskList.addEventListener('dragend', e=>{ e.target.classList.remove('dragging'); });

taskList.addEventListener('dragover', e=>{
    e.preventDefault();
    const afterElement = getDragAfterElement(taskList, e.clientY);
    const dragging = document.querySelector('.dragging');
    if(dragging){
        if(afterElement == null) taskList.appendChild(dragging);
        else taskList.insertBefore(dragging, afterElement);
    }
});

taskList.addEventListener('drop', ()=>{
    const newTasksOrder=[];
    taskList.querySelectorAll('li').forEach(li=>{
        const task = tasks.find(t=>t.id==li.dataset.id);
        if(task) newTasksOrder.push(task);
    });
    tasks = newTasksOrder;
    saveTasks();
    updateFilterCounts();
});

function getDragAfterElement(container, y){
    const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];
    return draggableElements.reduce((closest, child)=>{
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height/2;
        if(offset < 0 && offset > closest.offset) return {offset: offset, element: child};
        else return closest;
    }, {offset: Number.NEGATIVE_INFINITY}).element;
}

// ======== Service Worker PWA ========
if('serviceWorker' in navigator){
    window.addEventListener('load', ()=>{
        navigator.serviceWorker.register('sw.js');
    });
}

// ======== Initial Render ========
renderTasks();
updateFilterCounts();
