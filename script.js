const taskInput=document.getElementById('task-input');
const taskTime=document.getElementById('task-time');
const taskCategory=document.getElementById('task-category');
const addBtn=document.getElementById('add-btn');
const taskList=document.getElementById('task-list');
const darkModeBtn=document.getElementById('dark-mode-toggle');
const notifyBtn=document.getElementById('notify-toggle');
const notifyResetBtn=document.getElementById('notify-reset');
const filterButtons=document.querySelectorAll('.filter-btn');

let tasks=JSON.parse(localStorage.getItem('tasks'))||[];
let notificationsEnabled=false;
let currentFilter='all';

// Dark Mode
if(localStorage.getItem('dark-mode')==='enabled'){document.body.classList.add('dark-mode');}
darkModeBtn.addEventListener('click',()=>{document.body.classList.toggle('dark-mode');localStorage.setItem('dark-mode',document.body.classList.contains('dark-mode')?'enabled':'disabled');});

// Notifications
notifyBtn.addEventListener('click',async()=>{
    if(!notificationsEnabled){
        const permission=await Notification.requestPermission();
        if(permission==='granted'){notificationsEnabled=true; alert("تم تفعيل التنبيهات! 🔔");}
        else{alert("لم يتم تفعيل التنبيهات ❌");}
    }else{notificationsEnabled=false; alert("تم إيقاف التنبيهات 🚫");}
});
notifyResetBtn.addEventListener('click',async()=>{
    const permission=await Notification.requestPermission();
    if(permission==='granted'){notificationsEnabled=true; alert("تم تفعيل التنبيهات! 🔔");}
    else{notificationsEnabled=false; alert("لم يتم تفعيل التنبيهات ❌");}
});

// Filter
filterButtons.forEach(btn=>{
    btn.addEventListener('click',()=>{
        currentFilter=btn.dataset.filter;
        filterButtons.forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        renderTasks();
    });
});

function saveTasks(){localStorage.setItem('tasks',JSON.stringify(tasks));}

function randomMessage(type){
    const before=["جاهز تنجز المهمة؟ 💪","يلا شد حيلك 😎","فرصة عظيمة لإتمامها 🌟"];
    const missed=["لقد فاتك الوقت ⏰، حاول تعوض! 🚀","أووووه 😬، اتأخرت شوية","لازم نتحرك بسرعة ⚡"];
    const late=["انتهيت أخيرًا 👍، بس اتأخرت 😅","أخدت وقتك 😅، حاول أسرع المرة القادمة","حسنا، المهمة تمت ✅"];
    if(type==='before') return before[Math.floor(Math.random()*before.length)];
    if(type==='missed') return missed[Math.floor(Math.random()*missed.length)];
    if(type==='late') return late[Math.floor(Math.random()*late.length)];
    return "";
}

function createTaskElement(task){
    const li=document.createElement('li');
    li.dataset.id=task.id;
    li.dataset.category=task.category;
    li.draggable=true;

    const taskText=document.createElement('span');
    taskText.textContent=task.text;
    li.appendChild(taskText);

    if(task.time){
        const timeLabel=document.createElement('span');
        timeLabel.className='time-label';
        timeLabel.textContent=task.time;
        li.appendChild(timeLabel);
    }

    const deleteBtn=document.createElement('button');
    deleteBtn.textContent='حذف'; deleteBtn.className='delete-btn';
    deleteBtn.addEventListener('click',()=>{
        li.style.opacity='0';
        setTimeout(()=>{tasks=tasks.filter(t=>t.id!==task.id); saveTasks(); renderTasks();},300);
    });
    li.appendChild(deleteBtn);

    li.addEventListener('click', e=>{
        if(e.target.tagName!=='BUTTON'){task.completed=!task.completed; saveTasks(); renderTasks();}
    });

    // تصنيف المهمة + ألوان
    if(task.completed) li.classList.add('completed');
    else if(task.category==='عاجل') li.classList.add('urgent');
    else li.classList.add('pending');

    const now=new Date();
    const currentTime=now.toTimeString().slice(0,5);
    if(!task.completed && task.time===currentTime && !task.alerted && notificationsEnabled){
        new Notification(randomMessage('before'),{body:task.text});
        task.alerted=true; saveTasks();
    }

    return li;
}

function getDragAfterElement(container,y){
    const draggableElements=[...container.querySelectorAll('li:not(.dragging)')];
    return draggableElements.reduce((closest,child)=>{
        const box=child.getBoundingClientRect();
        const offset=y-box.top-box.height/2;
        if(offset<0 && offset>closest.offset) return {offset:offset,element:child};
        else return closest;
    },{offset:Number.NEGATIVE_INFINITY}).element;
}

function renderTasks(){
    taskList.innerHTML='';
    let filteredTasks = tasks;

    if(currentFilter==='completed') filteredTasks = tasks.filter(t=>t.completed);
    else if(currentFilter==='pending') filteredTasks = tasks.filter(t=>!t.completed && t.category!=='عاجل');
    else if(currentFilter==='urgent') filteredTasks = tasks.filter(t=>t.category==='عاجل' && !t.completed);

    filteredTasks.sort((a,b)=>{
        if(!a.time) return 1;
        if(!b.time) return -1;
        return a.time.localeCompare(b.time);
    });

    filteredTasks.forEach(task=>{ taskList.appendChild(createTaskElement(task)); });

    taskList.addEventListener('dragover', e=>{
        e.preventDefault();
        const afterElement=getDragAfterElement(taskList,e.clientY);
        const dragging=document.querySelector('.dragging');
        if(afterElement==null) taskList.appendChild(dragging);
        else taskList.insertBefore(dragging,afterElement);
    });

    taskList.addEventListener('drop', ()=>{
        const newTasksOrder=[];
        taskList.querySelectorAll('li').forEach(li=>{
            const task=tasks.find(t=>t.id==li.dataset.id);
            if(task) newTasksOrder.push(task);
        });
        tasks=newTasksOrder; saveTasks();
    });
}

addBtn.addEventListener('click', ()=>{
    const text=taskInput.value.trim(); const time=taskTime.value; const category=taskCategory.value;
    if(text!==''){
        const newTask={id:Date.now(),text,time:time||'',category:category,completed:false,notified:false,alerted:false};
        tasks.push(newTask); saveTasks(); renderTasks();
        taskInput.value=''; taskTime.value=''; taskCategory.value='عمل';
    }
});
taskInput.addEventListener('keypress', e=>{ if(e.key==='Enter') addBtn.click(); });

// Service Worker PWA
if('serviceWorker' in navigator){ window.addEventListener('load',()=>{ navigator.serviceWorker.register('sw.js'); }); }

renderTasks();
