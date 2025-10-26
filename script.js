const taskInput = document.getElementById('task-input');
const taskTime = document.getElementById('task-time');
const addBtn = document.getElementById('add-btn');
const taskList = document.getElementById('task-list');
const darkModeBtn = document.getElementById('dark-mode-toggle');

let tasks = JSON.parse(localStorage.getItem('tasks')) || [];

// Dark Mode حفظ الحالة
if(localStorage.getItem('dark-mode') === 'enabled'){
    document.body.classList.add('dark-mode');
}

darkModeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('dark-mode', document.body.classList.contains('dark-mode') ? 'enabled' : 'disabled');
});

function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// فرز المهام حسب الوقت
function sortTasks() {
    tasks.sort((a, b) => {
        if(!a.time) return 1;
        if(!b.time) return -1;
        return a.time.localeCompare(b.time);
    });
}

// إنشاء عنصر المهمة
function createTaskElement(task) {
    const li = document.createElement('li');
    li.dataset.id = task.id;
    li.draggable = true;

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
    deleteBtn.addEventListener('click', () => {
        tasks = tasks.filter(t => t.id !== task.id);
        saveTasks();
        renderTasks();
    });
    li.appendChild(deleteBtn);

    li.addEventListener('click', (e) => {
        if(e.target.tagName !== 'BUTTON'){
            task.completed = !task.completed;
            saveTasks();
            renderTasks();
        }
    });

    // ألوان حسب الحالة
    const now = new Date();
    const currentTime = now.toTimeString().slice(0,5);
    if(task.completed){
        li.className = 'completed';
    } else if(task.time && task.time === currentTime){
        li.className = 'upcoming';
    } else {
        li.className = 'normal';
    }

    // Drag & Drop
    li.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', task.id);
        li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
    });

    return li;
}

// إيجاد موقع السحب
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if(offset < 0 && offset > closest.offset){
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// عرض المهام
function renderTasks() {
    sortTasks();
    taskList.innerHTML = '';
    tasks.forEach(task => {
        const li = createTaskElement(task);
        taskList.appendChild(li);
    });

    taskList.addEventListener('dragover', e => {
        e.preventDefault();
        const afterElement = getDragAfterElement(taskList, e.clientY);
        const dragging = document.querySelector('.dragging');
        if(afterElement == null){
            taskList.appendChild(dragging);
        } else {
            taskList.insertBefore(dragging, afterElement);
        }
    });

    taskList.addEventListener('drop', () => {
        const newTasksOrder = [];
        taskList.querySelectorAll('li').forEach(li => {
            const task = tasks.find(t => t.id == li.dataset.id);
            if(task) newTasksOrder.push(task);
        });
        tasks = newTasksOrder;
        saveTasks();
    });
}

// إضافة مهمة جديدة
addBtn.addEventListener('click', () => {
    const text = taskInput.value.trim();
    const time = taskTime.value;
    if(text !== ''){
        const newTask = { id: Date.now(), text, time: time || '', completed: false, notified: false };
        tasks.push(newTask);
        saveTasks();
        renderTasks();
        taskInput.value = '';
        taskTime.value = '';
    }
});

taskInput.addEventListener('keypress', e => {
    if(e.key === 'Enter'){
        addBtn.click();
    }
});

// إشعارات طالما الموقع مفتوح
if("Notification" in window){
    Notification.requestPermission();
}

setInterval(() => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0,5);
    tasks.forEach(task => {
        if(task.time === currentTime && !task.notified){
            if(Notification.permission === 'granted'){
                new Notification('تذكير بالمهمة!', { body: task.text });
            }
            task.notified = true;
            saveTasks();
        }
    });
}, 60000);

renderTasks();
