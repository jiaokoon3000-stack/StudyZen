
/* StudyZen v1.1
   - Landing menu, Pomodoro, To-Do, Calendar
   - LocalStorage: sz_tasks, sz_stats, sz_calendar, sz_theme
   - Dark/Light theme toggle
*/

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// THEME
function applyTheme(t){
  document.documentElement.classList.toggle('light', t === 'light');
  localStorage.setItem('sz_theme', JSON.stringify(t));
  const btn = $('#themeToggle');
  if (btn) btn.textContent = (t === 'light') ? '🌙' : '☀️';
}
function initTheme(){
  const saved = JSON.parse(localStorage.getItem('sz_theme') || 'null');
  const t = saved || 'dark';
  applyTheme(t);
  $('#themeToggle')?.addEventListener('click', () => {
    const current = document.documentElement.classList.contains('light') ? 'light' : 'dark';
    applyTheme(current === 'light' ? 'dark' : 'light');
  });
}

// UTIL
const pad = n => String(n).padStart(2, '0');
const todayKey = () => { const d=new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); };
const store = {
  get(k, f){ try{ return JSON.parse(localStorage.getItem(k)) ?? f } catch { return f } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};

/* ---------- POMODORO ---------- */
const Pomodoro = (() => {
  let focusMin = 25, breakMin = 5;
  let mode = 'focus'; // 'focus' | 'break'
  let remaining = focusMin * 60;
  let timerId = null;
  let circle, circumference;

  function setupCircle(){
    circle = $('.progress-ring__circle');
    if (!circle) return;
    const radius = 54;
    circumference = 2 * Math.PI * radius;
    circle.style.strokeDasharray = `${circumference}`;
  }

  function updateDisplay(){
    if (!$('#time')) return;
    const m = Math.floor(remaining/60), s = remaining % 60;
    $('#time').textContent = `${pad(m)}:${pad(s)}`;
    $('#mode').textContent = mode.toUpperCase();
    const total = (mode === 'focus' ? focusMin : breakMin) * 60;
    if (circle) circle.style.strokeDashoffset = String((1 - remaining/total) * circumference);
  }

  function beep(){
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(1000, ctx.currentTime);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      o.connect(g); g.connect(ctx.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.4);
      o.stop(ctx.currentTime+0.45);
    } catch {}
  }

  function tick(){
    if (remaining > 0) { remaining--; updateDisplay(); }
    else {
      beep();
      if (mode === 'focus'){
        const stats = store.get('sz_stats', {});
        const k = todayKey(); stats[k] = stats[k] || { rounds:0, focusMinutes:0 };
        stats[k].rounds += 1; stats[k].focusMinutes += focusMin;
        store.set('sz_stats', stats);
        renderStats();
        switchTo('break');
      } else {
        switchTo('focus');
      }
    }
  }

  function start(){ if (!timerId) timerId = setInterval(tick, 1000); }
  function pause(){ clearInterval(timerId); timerId = null; }
  function reset(){ pause(); remaining = (mode === 'focus' ? focusMin : breakMin) * 60; updateDisplay(); }
  function switchTo(next){ mode = next; remaining = (mode === 'focus' ? focusMin : breakMin) * 60; updateDisplay(); }

  function setPreset(v){
    if (v === '25-5'){ focusMin=25; breakMin=5; }
    else if (v === '50-10'){ focusMin=50; breakMin=10; }
    if (mode === 'focus') remaining = focusMin * 60; else remaining = breakMin * 60;
    updateDisplay();
  }

  function initUI(){
    if (!document.body.matches('[data-page="pomodoro"]')) return;
    setupCircle(); updateDisplay(); renderStats();

    $('#startBtn').addEventListener('click', start);
    $('#pauseBtn').addEventListener('click', pause);
    $('#resetBtn').addEventListener('click', reset);

    $$('input[name="preset"]').forEach(r => {
      r.addEventListener('change', (e) => {
        const val = e.target.value;
        const custom = $('#customInputs');
        if (val === 'custom'){ custom.hidden = false; }
        else { custom.hidden = true; setPreset(val); }
      });
    });
    $('#setCustom')?.addEventListener('click', () => {
      const f = Math.max(1, Math.min(120, Number($('#focusMin').value || 25)));
      const b = Math.max(1, Math.min(60, Number($('#breakMin').value || 5)));
      focusMin = f; breakMin = b;
      reset();
    });
  }

  function renderStats(){
    if (!$('#roundsToday')) return;
    const stats = store.get('sz_stats', {});
    const k = todayKey();
    const s = stats[k] || { rounds:0, focusMinutes:0 };
    $('#roundsToday').textContent = s.rounds;
    $('#focusMinutesToday').textContent = s.focusMinutes;
  }

  return { initUI };
})();

/* ---------- TODOS ---------- */
const Todos = (() => {
  const KEY = 'sz_tasks';
  let tasks = [];

  function load(){ tasks = store.get(KEY, []); }
  function save(){ store.set(KEY, tasks); }

  function add(text){ tasks.push({ id: Date.now(), text, done: false }); save(); render(); }
  function toggle(id){ const t = tasks.find(x=>x.id===id); if(t){ t.done=!t.done; save(); render(); } }
  function remove(id){ tasks = tasks.filter(x=>x.id!==id); save(); render(); }

  function render(){
    const ul = $('#todoList'); if (!ul) return; ul.innerHTML = '';
    tasks.forEach(t => {
      const li = document.createElement('li'); li.className = 'todo-item';
      const label = document.createElement('label');
      const cb = document.createElement('input'); cb.type='checkbox'; cb.checked=t.done;
      cb.addEventListener('change', ()=> toggle(t.id));
      const span = document.createElement('span'); span.className='text'+(t.done?' done':'');
      span.textContent = t.text;
      label.append(cb, span);
      const del = document.createElement('button'); del.className='btn btn-mini remove'; del.textContent='ลบ';
      del.addEventListener('click', ()=> remove(t.id));
      li.append(label, del); ul.append(li);
    });
  }

  function initUI(){
    if (!document.body.matches('[data-page="pomodoro"]')) return;
    load(); render();
    $('#todoForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('#todoInput').value.trim();
      if (!v) return;
      add(v);
      $('#todoInput').value=''; $('#todoInput').focus();
    });
  }

  return { initUI };
})();

/* ---------- CALENDAR ---------- */
const Calendar = (() => {
  const KEY = 'sz_calendar';
  let notes = {}; let current = new Date();

  function load(){ notes = store.get(KEY, {}); }
  function save(){ store.set(KEY, notes); }

  function render(){
    if (!document.body.matches('[data-page="calendar"]')) return;
    const grid = $('.cal-grid'); const label = $('#monthLabel');
    grid.innerHTML = '';
    const y = current.getFullYear(); const m = current.getMonth();
    const first = new Date(y, m, 1); const start = first.getDay();
    const days = new Date(y, m+1, 0).getDate();
    label.textContent = current.toLocaleDateString('th-TH', { year:'numeric', month:'long' });

    ['อา','จ','อ','พ','พฤ','ศ','ส'].forEach(d => {
      const h = document.createElement('div'); h.textContent = d; h.style.color='var(--muted)'; h.style.textAlign='center'; grid.append(h);
    });

    for (let i=0; i<start; i++) grid.append(document.createElement('div'));

    for (let day=1; day<=days; day++){
      const date = new Date(y, m, day); const key = date.toISOString().slice(0,10);
      const div = document.createElement('div'); div.className = 'day' + (notes[key] ? ' has-note' : '');
      const head = document.createElement('header');
      const num = document.createElement('strong'); num.textContent = day;
      const dot = document.createElement('span'); dot.className = 'dot';
      head.append(num, dot); div.append(head);

      const text = document.createElement('div'); text.textContent = (notes[key] || '').slice(0, 40); text.style.color = 'var(--muted)';
      div.append(text);
      div.tabIndex=0; div.setAttribute('role','gridcell'); div.setAttribute('aria-label',`วันที่ ${day}`);
      div.addEventListener('click', ()=>openNote(key, date));
      div.addEventListener('keydown', (e)=>{ if(e.key==='Enter'||e.key===' ') openNote(key, date); });
      grid.append(div);
    }
  }

  function openNote(key, dateObj){
    $('#notePanel').hidden = false;
    $('#noteTitle').textContent = dateObj.toLocaleDateString('th-TH', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    $('#noteText').value = notes[key] || '';
    $('#saveNote').onclick = () => {
      const v = $('#noteText').value.trim();
      if (v) notes[key] = v; else delete notes[key];
      save(); render(); $('#notePanel').hidden = true;
    };
    $('#closeNote').onclick = () => { $('#notePanel').hidden = true; };
  }

  function initUI(){
    if (!document.body.matches('[data-page="calendar"]')) return;
    load(); render();
    $('#prevMonth').addEventListener('click', ()=>{ current.setMonth(current.getMonth()-1); render(); });
    $('#nextMonth').addEventListener('click', ()=>{ current.setMonth(current.getMonth()+1); render(); });
  }

  return { initUI };
})();

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const page = document.body.getAttribute('data-page');
  if (page === 'pomodoro'){ Pomodoro.initUI(); Todos.initUI(); }
  if (page === 'calendar'){ Calendar.initUI(); }
});
