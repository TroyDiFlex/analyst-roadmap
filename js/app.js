// =============================================
//  ГЛАВНАЯ ЛОГИКА ПРИЛОЖЕНИЯ
// =============================================

let progress  = null;   // текущий прогресс
let activePhaseId = null; // открытый этап

// ──────────────────────────────────────────────
//  ВХОД / ЛОГИН
// ──────────────────────────────────────────────

// При нажатии Enter в поле ключа
document.getElementById('key-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleLogin();
});

setupActivityCalendar();

async function handleLogin() {
  const input = document.getElementById('key-input').value.trim();
  if (!input) return;

  const errorEl   = document.getElementById('login-error');
  const loadingEl = document.getElementById('login-loading');

  errorEl.classList.add('hidden');
  loadingEl.classList.remove('hidden');

  // Сохраняем ключ в браузере
  localStorage.setItem('secret_key', input);

  try {
    // Пробуем загрузить прогресс
    const loaded = await loadProgress();
    progress = loaded || createEmptyProgress();

    // Если Google Sheets не настроен — это нормально, работаем с localStorage
    showApp();
  } catch (err) {
    localStorage.removeItem('secret_key');
    loadingEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
  }
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('login-loading').classList.add('hidden');

  renderSidebar();
  updateHeaderStats();

  // Открываем первый незавершённый этап
  const firstIncomplete = PHASES.find(p => !isPhaseComplete(p.id));
  openPhase(firstIncomplete ? firstIncomplete.id : PHASES[0].id);
}

function logout() {
  if (!confirm('Выйти? Ключ будет удалён из этого браузера.')) return;
  localStorage.removeItem('secret_key');
  location.reload();
}

// При загрузке: проверяем, есть ли уже ключ
window.addEventListener('load', async () => {
  const savedKey = localStorage.getItem('secret_key');
  if (savedKey) {
    document.getElementById('key-input').value = savedKey;
    const loadingEl = document.getElementById('login-loading');
    loadingEl.classList.remove('hidden');
    try {
      const loaded = await loadProgress();
      progress = loaded || createEmptyProgress();
      showApp();
    } catch {
      localStorage.removeItem('secret_key');
      loadingEl.classList.add('hidden');
    }
  }
});

// ──────────────────────────────────────────────
//  БОКОВАЯ ПАНЕЛЬ
// ──────────────────────────────────────────────
function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';

  PHASES.forEach(phase => {
    const ph = getPhaseProgress(phase.id);
    const readyTopics = phase.topics.filter(topic => topic.status === 'ready').length;
    const doneTopics = countReadyTopicsDone(phase, ph);
    const complete = isPhaseComplete(phase.id);
    const status = getPhaseStatus(phase);

    const btn = document.createElement('button');
    btn.className = 'sidebar-nav-item' + (activePhaseId === phase.id ? ' active' : '');
    btn.id = `nav-item-${phase.id}`;
    btn.onclick = () => openPhase(phase.id);

    btn.innerHTML = `
      <div class="sidebar-nav-icon" style="background:${phase.accent}18; color:${phase.accent}">
        <i class="ti ${phase.icon}"></i>
      </div>
      <div class="sidebar-nav-info">
        <div class="sidebar-nav-title">${phase.title}</div>
        <div class="sidebar-nav-progress">
          ${readyTopics ? `${doneTopics}/${readyTopics} готовых уроков${taskProgressLabel(phase, ph)}` : 'Материалы в разработке'}
        </div>
      </div>
      ${complete
        ? '<span class="sidebar-nav-badge"><i class="ti ti-check"></i></span>'
        : `<span class="sidebar-status-dot ${status.className}" title="${status.text}"></span>`}
    `;

    nav.appendChild(btn);
  });

  updateOverallBar();
}

function updateOverallBar() {
  const totalReady = PHASES.reduce((sum, phase) => sum + phase.topics.filter(topic => topic.status === 'ready').length, 0);
  const totalDone = PHASES.reduce((sum, phase) => sum + countReadyTopicsDone(phase, getPhaseProgress(phase.id)), 0);
  const pct = totalReady ? Math.round((totalDone / totalReady) * 100) : 0;

  document.getElementById('sidebar-overall-bar').style.width = pct + '%';
  document.getElementById('sidebar-overall-text').textContent = `${totalDone} / ${totalReady} готовых уроков`;
}

// ──────────────────────────────────────────────
//  ШАПКА
// ──────────────────────────────────────────────
function updateHeaderStats() {
  const totalReady = PHASES.reduce((sum, phase) => sum + phase.topics.filter(topic => topic.status === 'ready').length, 0);
  const totalDone = PHASES.reduce((sum, phase) => sum + countReadyTopicsDone(phase, getPhaseProgress(phase.id)), 0);
  const pct = totalReady ? Math.round((totalDone / totalReady) * 100) : 0;

  document.getElementById('header-progress-text').textContent = `${totalDone} из ${totalReady} готовых уроков`;
  document.getElementById('header-progress-bar').style.width  = pct + '%';

  if (progress && progress.started) {
    const activity = getActivityStats();
    const daysEl = document.getElementById('header-days');
    daysEl.textContent = `${activity.streak} ${pluralizeDays(activity.streak)} подряд`;
    daysEl.title = activity.totalDays
      ? 'Открыть календарь активности'
      : 'Активность появится после отмеченных тем или задач';
  }
}

// ──────────────────────────────────────────────
//  ОТКРЫТЬ ЭТАП
// ──────────────────────────────────────────────
function openPhase(phaseId) {
  activePhaseId = phaseId;

  // Подсветка в сайдбаре
  document.querySelectorAll('.sidebar-nav-item').forEach(el => el.classList.remove('active'));
  const navItem = document.getElementById(`nav-item-${phaseId}`);
  if (navItem) navItem.classList.add('active');

  const phase = PHASES.find(p => p.id === phaseId);
  if (!phase) return;

  const ph = getPhaseProgress(phaseId);
  const readyTopics = phase.topics.filter(topic => topic.status === 'ready').length;
  const doneTopics = countReadyTopicsDone(phase, ph);
  const complete = isPhaseComplete(phaseId);
  const status = getPhaseStatus(phase);

  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="phase-content">

      <!-- ЗАГОЛОВОК -->
      <div class="phase-header">
        <div class="phase-icon-big" style="background:${phase.accent}18; color:${phase.accent}">
          <i class="ti ${phase.icon}"></i>
        </div>
        <div class="phase-header-info">
          <div class="phase-num" style="color:${phase.accent}">Этап ${String(phase.id).padStart(2,'0')}</div>
          <div class="phase-title">${phase.title}</div>
          <div class="phase-meta">
            <span class="phase-duration">
              <i class="ti ti-clock" style="font-size:13px"></i>
              ${phase.duration}
            </span>
            ${phase.track ? `<span class="phase-badge-track">${phase.track}</span>` : ''}
            <span class="phase-status ${status.className}"><i class="ti ${status.icon}"></i>${status.text}</span>
            ${complete ? '<span class="phase-badge-done"><i class="ti ti-check"></i> Завершён</span>' : ''}
          </div>
          ${phase.outcome ? `<div class="phase-outcome"><span>Результат этапа</span>${phase.outcome}</div>` : ''}
        </div>
      </div>

      <!-- ПРОГРЕСС ЭТАПА -->
      <div class="phase-progress-block">
        <div class="phase-progress-item">
          <div class="phase-progress-label">Готовые уроки</div>
          <div class="phase-progress-bar-wrap">
            <div class="phase-progress-bar" style="width:${readyTopics ? Math.round(doneTopics/readyTopics*100) : 0}%; background:${phase.accent}"></div>
          </div>
          <div class="phase-progress-count">${readyTopics ? `${doneTopics} / ${readyTopics}` : 'Пока нет готовых уроков'}</div>
        </div>
        <div class="phase-progress-item">
          <div class="phase-progress-label">Готовность программы</div>
          <div class="phase-progress-bar-wrap">
            <div class="phase-progress-bar" style="width:${Math.round(readyTopics/phase.topics.length*100)}%; background:var(--accent)"></div>
          </div>
          <div class="phase-progress-count">${readyTopics} из ${phase.topics.length} тем оформлены как уроки</div>
        </div>
      </div>

      <!-- ЗАМЕТКА ЭТАПА -->
      ${phase.note ? `<div class="phase-note" style="border-color:${phase.accent}">${phase.note}</div>` : ''}

      <!-- ТЕМЫ -->
      <div class="section-title"><i class="ti ti-list-check"></i> Учебные материалы</div>
      <div class="topics-list">
        ${phase.topics.map((t, i) => renderTopic(phaseId, i, t, ph)).join('')}
      </div>

      <!-- ПОДСКАЗКИ -->
      ${phase.hints.length > 0 ? `
        <div class="section-title" style="margin-top:1rem"><i class="ti ti-alert-triangle" style="color:var(--warning)"></i> Подсказки</div>
        <div class="hints-list">
          ${phase.hints.map((h, i) => renderHint(h, i, phaseId)).join('')}
        </div>
      ` : ''}

      <!-- ПРАКТИЧЕСКИЕ ЗАДАНИЯ -->
      <div class="section-title" style="margin-top:1rem"><i class="ti ti-pencil-check" style="color:var(--accent)"></i> Практические задания${phase.tasks.some(task => task.status === 'ready') ? taskProgressLabel(phase, ph) : ' · в разработке'}</div>
      <div class="tasks-list">
        ${phase.tasks.map((t, i) => renderTask(phaseId, i, t, ph)).join('')}
      </div>

      <!-- РЕСУРСЫ -->
      <div class="resources-block">
        <div class="section-title"><i class="ti ti-books"></i> Ресурсы</div>
        <div class="resources-list">
          ${phase.resources.map(renderResource).join('')}
        </div>
      </div>

      <!-- МОИ ЗАМЕТКИ -->
      <div class="phase-notes-block">
        <div class="section-title"><i class="ti ti-notes"></i> Мои заметки к этапу</div>
        <div class="note-container" id="phase-note-container-${phaseId}">
          <div class="note-view-mode" onclick="enableNoteEditMode('phase', ${phaseId})">
            ${renderMarkdownNote(ph.notes.phase || '', 'phase', phaseId)}
          </div>
          <textarea
            class="phase-textarea hidden"
            id="phase-note-${phaseId}"
            placeholder="Пиши сюда всё что угодно — выводы, ссылки, мысли..."
            onblur="disableNoteEditMode('phase', ${phaseId}, this.value)"
            oninput="onPhaseNote(${phaseId}, this.value)"
          >${ph.notes.phase || ''}</textarea>
        </div>
      </div>

      <!-- СБРОСИТЬ -->
      <button class="reset-btn" onclick="resetPhase(${phaseId})">
        <i class="ti ti-refresh"></i> Сбросить прогресс этого этапа
      </button>

    </div>
  `;
  adjustAllTextareas();
}

// ──────────────────────────────────────────────
//  РЕНДЕР ТЕМЫ
// ──────────────────────────────────────────────
function renderTopic(phaseId, idx, topic, ph) {
  const date  = ph.topics[idx];
  const done  = !!date;
  const isReady = topic.status === 'ready';

  return `
    <div class="topic-item ${done ? 'done' : ''} ${isReady ? 'ready' : 'development'}" id="topic-${phaseId}-${idx}">
      <button class="topic-checkbox" type="button" onclick="toggleTopic(${phaseId}, ${idx})" ${isReady ? '' : 'disabled'} aria-label="${isReady ? (done ? 'Вернуть урок в работу' : 'Отметить урок изученным') : 'Материал ещё в разработке'}">
        ${done ? '<i class="ti ti-check"></i>' : ''}
      </button>
      <div class="topic-body">
        <div class="topic-title-row">
          <div class="topic-name">${topic.name}</div>
          ${isReady
            ? `<span class="topic-status ready"><i class="ti ti-book-2"></i>День ${topic.course.day} · ${topic.course.duration}</span>`
            : '<span class="topic-status development"><i class="ti ti-tool"></i>В разработке</span>'}
        </div>
        <div class="topic-desc">${topic.desc}</div>
        <details class="topic-details">
          <summary>
            <span>${isReady ? 'Начать урок' : 'Посмотреть план темы'}</span>
            <i class="ti ti-chevron-down"></i>
          </summary>
          ${isReady ? renderCourseLesson(topic) : renderDevelopmentTopic(topic)}
        </details>
        ${done ? `<div class="topic-date"><i class="ti ti-calendar" style="font-size:11px"></i> ${formatDate(date)}</div>` : ''}
      </div>
    </div>
  `;
}

function renderCourseLesson(topic) {
  const course = topic.course;
  return `
    <div class="course-lesson">
      <div class="course-goal">
        <i class="ti ti-target-arrow"></i>
        <div><span>Цель урока</span>${course.goal}</div>
      </div>
      ${course.sections.map(renderCourseSection).join('')}
      ${renderCourseExercise(course.exercise)}
      <div class="course-footer-grid">
        <div class="topic-detail-section">
          <div class="topic-detail-label">Дополнительный материал</div>
          <div class="topic-resource-list">${topic.resources.map(renderResource).join('')}</div>
        </div>
        <div class="topic-detail-section topic-done-criteria">
          <div class="topic-detail-label">Можно ставить галочку, если</div>
          <div class="topic-detail-text">${topic.done}</div>
        </div>
      </div>
    </div>
  `;
}

function renderCourseSection(section) {
  return `
    <section class="course-section">
      <h4>${section.title}</h4>
      ${section.paragraphs ? section.paragraphs.map(paragraph => `<p>${paragraph}</p>`).join('') : ''}
      ${section.bullets ? `<ul>${section.bullets.map(item => `<li>${item}</li>`).join('')}</ul>` : ''}
      ${section.code ? renderCodeBlock(section.code, section.codeLabel) : ''}
      ${section.table ? renderCourseTable(section.table) : ''}
      ${section.note ? `<div class="course-note"><i class="ti ti-bulb"></i><span>${section.note}</span></div>` : ''}
    </section>
  `;
}

function renderCourseTable(table) {
  return `
    <div class="course-table-wrap">
      <table class="course-table">
        <thead><tr>${table.headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
        <tbody>${table.rows.map(row => `<tr>${row.map(cell => `<td class="${cell === null || cell === 'NULL' ? 'is-null' : ''}">${escapeHtml(cell === null ? 'NULL' : cell)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
      ${table.rows.length ? '' : '<p class="course-empty-result">0 строк — пустой результат.</p>'}
    </div>
  `;
}

function renderCodeBlock(code, label = 'SQL') {
  return `
    <div class="course-code">
      <div class="course-code-label">${label}</div>
      <pre><code>${escapeHtml(code)}</code></pre>
    </div>
  `;
}

function renderCourseExercise(exercise) {
  return `
    <section class="course-exercise">
      <div class="course-exercise-title"><i class="ti ti-pencil"></i>${exercise.title}</div>
      <ol>${exercise.steps.map(step => `<li>${step}</li>`).join('')}</ol>
      ${exercise.solution ? `
        <details class="course-answer">
          <summary>Показать решение</summary>
          ${renderCodeBlock(exercise.solution, 'Решение')}
        </details>
      ` : ''}
      <details class="course-answer">
        <summary>Проверить ответ</summary>
        <ul>${exercise.answer.map(item => `<li>${item}</li>`).join('')}</ul>
      </details>
    </section>
  `;
}

function renderDevelopmentTopic(topic) {
  return `
    <div class="development-panel">
      <div class="development-message">
        <i class="ti ti-tool"></i>
        <div><strong>Это пока план, а не готовый урок.</strong><span>Определения, учебные данные, пошаговая практика и ответы ещё не добавлены. Галочка отключена.</span></div>
      </div>
      <div class="topic-details-body">
        <div class="topic-detail-section">
          <div class="topic-detail-label">Что войдёт в урок</div>
          <ul>${topic.learn.map(item => `<li>${item}</li>`).join('')}</ul>
        </div>
        <div class="topic-detail-section">
          <div class="topic-detail-label">Планируемый материал</div>
          <div class="topic-resource-list">${topic.resources.map(renderResource).join('')}</div>
        </div>
        <div class="topic-detail-section">
          <div class="topic-detail-label">Черновик практики</div>
          <div class="topic-detail-text">${topic.practice}</div>
        </div>
        <div class="topic-detail-section topic-done-criteria">
          <div class="topic-detail-label">Будущий критерий</div>
          <div class="topic-detail-text">${topic.done}</div>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

// ──────────────────────────────────────────────
//  РЕНДЕР ПОДСКАЗКИ
// ──────────────────────────────────────────────
function renderHint(hint, idx, phaseId) {
  return `
    <details class="hint-details">
      <summary class="hint-summary">
        <i class="ti ti-alert-triangle hint-summary-icon"></i>
        <span class="hint-summary-title">${hint.title}</span>
        <i class="ti ti-chevron-down hint-chevron"></i>
      </summary>
      <div class="hint-body">${hint.text}</div>
    </details>
  `;
}

// ──────────────────────────────────────────────
//  РЕНДЕР ЗАДАНИЯ
// ──────────────────────────────────────────────
function renderTask(phaseId, idx, task, ph) {
  const date = ph.tasks[idx];
  const isReady = task.status === 'ready';
  const done = isReady && !!date;
  const note = ph.notes[`task_${idx}`] || '';

  return `
    <div class="task-card ${done ? 'done' : ''} ${isReady ? '' : 'development'}" id="task-card-${phaseId}-${idx}">
      <div class="task-top">
        <button class="task-checkbox" onclick="toggleTask(${phaseId}, ${idx})" ${isReady ? '' : 'disabled'} aria-label="${isReady ? 'Отметить задание выполненным' : 'Задание ещё в разработке'}">
          ${done ? '<i class="ti ti-check"></i>' : ''}
        </button>
        <div class="task-body">
          <div class="task-type-row">
            ${task.type ? `<span class="task-type">${task.type}</span>` : ''}
            ${isReady ? '' : '<span class="topic-status development"><i class="ti ti-tool"></i>В разработке</span>'}
          </div>
          <div class="task-text">${task.text}</div>
          ${task.deliverable ? `<div class="task-detail"><span>Результат</span>${task.deliverable}</div>` : ''}
          ${task.criteria ? `<div class="task-detail task-criteria"><span>Готово, если</span>${task.criteria}</div>` : ''}
          ${done ? `<div class="task-date"><i class="ti ti-calendar" style="font-size:11px"></i> Выполнено ${formatDate(date)}</div>` : ''}
        </div>
      </div>
      ${isReady && task.groups ? renderAssessment(task, phaseId) : ''}
      <div class="note-container" id="task-note-container-${phaseId}-${idx}">
        <div class="note-view-mode" onclick="enableNoteEditMode('task', ${phaseId}, ${idx})">
          ${renderMarkdownNote(note, 'task', phaseId, idx)}
        </div>
        <textarea
          class="task-note-input hidden"
          id="task-note-${phaseId}-${idx}"
          placeholder="Заметка к заданию (результат, ссылка, вывод)..."
          onblur="disableNoteEditMode('task', ${phaseId}, this.value, ${idx})"
          oninput="onTaskNote(${phaseId}, ${idx}, this.value)"
        >${note}</textarea>
      </div>
    </div>
  `;
}

function renderAssessment(task, phaseId) {
  const phase = PHASES.find(item => item.id === phaseId);
  let number = 0;
  return `
    <details class="assessment-details">
      <summary>Открыть условия и задания${task.optional ? ' · необязательно' : ''}</summary>
      ${task.sections.map(renderCourseSection).join('')}
      <details class="course-answer">
        <summary>Подготовить исходные данные SQLite</summary>
        <p class="course-empty-result">Выполни один раз в отдельной учебной базе. Повторный запуск сбрасывает ${task.dataset === 'orders' ? 'orders, customers, order_customers и payments' : 'listings'} к исходным данным. Сохрани свои запросы перед заменой текста в редакторе. Самостоятельно писать CREATE и INSERT не требуется.</p>
        ${renderCodeBlock(sqlAssessmentSetup(task, phase.topics), 'Подготовка — скопируй целиком')}
      </details>
      ${task.groups.map(group => `
        <section class="assessment-group">
          <h4>${escapeHtml(group.title)}</h4>
          ${group.questions.map(question => `
            <section class="course-exercise">
              <h5 class="course-exercise-title">${++number}. ${escapeHtml(question.title)}</h5>
              <p>${escapeHtml(question.prompt)}</p>
              <details class="course-answer">
                <summary>Проверить ответ</summary>
                ${renderCourseTable(question.table)}
                ${question.explanation ? `<p class="course-empty-result">${escapeHtml(question.explanation)}</p>` : ''}
              </details>
              <details class="course-answer">
                <summary>Показать решение SQL</summary>
                ${renderCodeBlock(question.solution, 'Один из вариантов решения')}
              </details>
            </section>
          `).join('')}
        </section>
      `).join('')}
      ${task.review ? `<details class="course-answer">
        <summary>Проверить письменный разбор</summary>
        <ul>${task.review.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </details>` : ''}
    </details>
  `;
}

function renderResource(resource) {
  if (typeof resource === 'string') {
    return `<span class="res-pill"><i class="ti ti-link"></i>${resource}</span>`;
  }
  return `<a class="res-pill" href="${resource.url}" target="_blank" rel="noopener noreferrer"><i class="ti ti-external-link"></i>${resource.title}</a>`;
}

// ──────────────────────────────────────────────
//  ПЕРЕКЛЮЧЕНИЕ ГАЛОЧЕК
// ──────────────────────────────────────────────
function toggleTopic(phaseId, idx) {
  const phase = PHASES.find(item => item.id === phaseId);
  if (!phase || phase.topics[idx]?.status !== 'ready') return;
  const ph   = getPhaseProgress(phaseId);
  const done = !!ph.topics[idx];

  ph.topics[idx] = done ? null : new Date().toISOString().slice(0, 10);
  progress.phases[phaseId] = ph;
  markActivity();
  saveProgress(progress);

  // Перерисовываем этап и статистику
  openPhase(phaseId);
  renderSidebar();
  updateHeaderStats();
}

function toggleTask(phaseId, idx) {
  const phase = PHASES.find(item => item.id === phaseId);
  if (!phase || phase.tasks[idx]?.status !== 'ready') return;
  const ph   = getPhaseProgress(phaseId);
  const done = !!ph.tasks[idx];

  ph.tasks[idx] = done ? null : new Date().toISOString().slice(0, 10);
  progress.phases[phaseId] = ph;
  markActivity();
  saveProgress(progress);

  openPhase(phaseId);
  renderSidebar();
  updateHeaderStats();
}

// ──────────────────────────────────────────────
//  ЗАМЕТКИ
// ──────────────────────────────────────────────
function onPhaseNote(phaseId, value) {
  const ph = getPhaseProgress(phaseId);
  ph.notes.phase = value;
  progress.phases[phaseId] = ph;
  markActivity();
  saveProgress(progress);
}

function onTaskNote(phaseId, taskIdx, value) {
  const ph = getPhaseProgress(phaseId);
  ph.notes[`task_${taskIdx}`] = value;
  progress.phases[phaseId] = ph;
  markActivity();
  saveProgress(progress);
}

// ──────────────────────────────────────────────
//  СБРОС ЭТАПА
// ──────────────────────────────────────────────
function resetPhase(phaseId) {
  const phase = PHASES.find(p => p.id === phaseId);
  if (!confirm(`Сбросить весь прогресс этапа «${phase.title}»? Это нельзя отменить.`)) return;

  const topics = {};
  phase.topics.forEach((_, i) => { topics[i] = null; });
  const tasks = {};
  phase.tasks.forEach((_, i) => { tasks[i] = null; });
  const notes = { phase: '' };
  phase.tasks.forEach((_, i) => { notes[`task_${i}`] = ''; });

  progress.phases[phaseId] = { topics, tasks, notes };
  saveProgress(progress);

  openPhase(phaseId);
  renderSidebar();
  updateHeaderStats();
}

// ──────────────────────────────────────────────
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ──────────────────────────────────────────────
function getPhaseProgress(phaseId) {
  if (!progress.phases[phaseId]) {
    const phase = PHASES.find(p => p.id === phaseId);
    const topics = {}, tasks = {}, notes = { phase: '' };
    phase.topics.forEach((_, i) => { topics[i] = null; });
    phase.tasks.forEach((_, i) => { tasks[i] = null; notes[`task_${i}`] = ''; });
    progress.phases[phaseId] = { topics, tasks, notes };
  }
  return progress.phases[phaseId];
}

function countReadyTopicsDone(phase, phaseProgress) {
  if (!phaseProgress?.topics) return 0;
  return phase.topics.reduce((count, topic, idx) => {
    return count + (topic.status === 'ready' && phaseProgress.topics[idx] ? 1 : 0);
  }, 0);
}

function getPhaseStatus(phase) {
  if (phase.status === 'partial') {
    return { className: 'partial', icon: 'ti-progress', text: phase.statusText || 'Частично готово' };
  }
  if (phase.status === 'ready') {
    return { className: 'ready', icon: 'ti-circle-check', text: phase.statusText || 'Готово' };
  }
  return { className: 'development', icon: 'ti-tool', text: phase.statusText || 'В разработке' };
}

function isPhaseComplete(phaseId) {
  const phase = PHASES.find(p => p.id === phaseId);
  if (!phase || phase.status !== 'ready') return false;
  const ph = getPhaseProgress(phaseId);
  return phase.topics.length > 0
    && countReadyTopicsDone(phase, ph) === phase.topics.length
    && phase.tasks.every((task, idx) => task.optional || (task.status === 'ready' && ph.tasks[idx]));
}

function taskProgressLabel(phase, ph) {
  const required = phase.tasks.filter(task => task.status === 'ready' && !task.optional);
  if (!required.length) return '';
  const done = phase.tasks.reduce((sum, task, idx) =>
    sum + (task.status === 'ready' && !task.optional && ph.tasks[idx] ? 1 : 0), 0);
  return ` · ${done}/${required.length} обязательных заданий`;
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function setupActivityCalendar() {
  const daysEl = document.getElementById('header-days');
  if (!daysEl) return;

  daysEl.setAttribute('role', 'button');
  daysEl.setAttribute('tabindex', '0');
  daysEl.addEventListener('click', event => {
    event.stopPropagation();
    toggleActivityCalendar();
  });
  daysEl.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleActivityCalendar();
  });

  document.addEventListener('click', event => {
    const popover = document.getElementById('activity-popover');
    if (!popover || popover.classList.contains('hidden')) return;
    if (popover.contains(event.target) || daysEl.contains(event.target)) return;
    closeActivityCalendar();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeActivityCalendar();
  });

  window.addEventListener('resize', positionActivityCalendar);
}

function toggleActivityCalendar() {
  const popover = ensureActivityPopover();
  if (popover.classList.contains('hidden')) {
    openActivityCalendar();
  } else {
    closeActivityCalendar();
  }
}

function openActivityCalendar() {
  const popover = ensureActivityPopover();
  popover.innerHTML = renderActivityCalendar();
  popover.classList.remove('hidden');
  document.getElementById('header-days')?.classList.add('active');
  positionActivityCalendar();
}

function closeActivityCalendar() {
  const popover = document.getElementById('activity-popover');
  if (popover) popover.classList.add('hidden');
  document.getElementById('header-days')?.classList.remove('active');
}

function ensureActivityPopover() {
  let popover = document.getElementById('activity-popover');
  if (popover) return popover;

  popover = document.createElement('div');
  popover.id = 'activity-popover';
  popover.className = 'activity-popover hidden';
  document.body.appendChild(popover);
  return popover;
}

function positionActivityCalendar() {
  const popover = document.getElementById('activity-popover');
  const anchor = document.getElementById('header-days');
  if (!popover || !anchor || popover.classList.contains('hidden')) return;

  const rect = anchor.getBoundingClientRect();
  popover.style.top = `${rect.bottom + 8}px`;
  popover.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
}

function renderActivityCalendar() {
  const activity = getActivityStats();
  const emptyText = activity.totalDays
    ? ''
    : '<div class="activity-empty">Пока нет отмеченных тем или задач.</div>';

  return `
    <div class="activity-popover-head">
      <div>
        <div class="activity-title">Активность</div>
        <div class="activity-subtitle">По отмеченным темам и задачам</div>
      </div>
      <button class="activity-close" type="button" title="Закрыть" onclick="closeActivityCalendar()">
        <i class="ti ti-x"></i>
      </button>
    </div>
    <div class="activity-summary">
      <div>
        <strong>${activity.streak}</strong>
        <span>${pluralizeDays(activity.streak)} подряд</span>
      </div>
      <div>
        <strong>${activity.totalDays}</strong>
        <span>${pluralizeActiveDays(activity.totalDays)}</span>
      </div>
      <div>
        <strong>${activity.totalActions}</strong>
        <span>${pluralizeActions(activity.totalActions)}</span>
      </div>
    </div>
    ${emptyText}
    <div class="activity-months">
      ${getActivityMonths(activity.map).map(month => renderActivityMonth(month.year, month.month, activity.map)).join('')}
    </div>
    <div class="activity-legend">
      <span><i class="activity-dot"></i> нет</span>
      <span><i class="activity-dot active"></i> была активность</span>
    </div>
  `;
}

function renderActivityMonth(year, month, activityMap) {
  const firstDay = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startOffset = (firstDay.getUTCDay() + 6) % 7;
  const todayIso = getTodayIsoDate();
  const monthTitle = firstDay.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const cells = [];

  for (let i = 0; i < startOffset; i++) {
    cells.push('<div class="activity-day empty"></div>');
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = toIsoDate(year, month, day);
    const count = activityMap[iso] || 0;
    const classes = [
      'activity-day',
      count ? 'active' : '',
      count >= 3 ? 'high' : count >= 2 ? 'medium' : '',
      iso === todayIso ? 'today' : ''
    ].filter(Boolean).join(' ');
    const title = count
      ? `${formatDate(iso)}: ${count} ${pluralizeActions(count)}`
      : `${formatDate(iso)}: нет активности`;

    cells.push(`<div class="${classes}" title="${title}" aria-label="${title}">${day}</div>`);
  }

  return `
    <section class="activity-month">
      <div class="activity-month-title">${monthTitle}</div>
      <div class="activity-calendar-grid weekdays">
        ${weekdays.map(day => `<div>${day}</div>`).join('')}
      </div>
      <div class="activity-calendar-grid">
        ${cells.join('')}
      </div>
    </section>
  `;
}

function getActivityStats() {
  const map = collectActivityMap();
  const dates = Object.keys(map).sort();
  const totalActions = dates.reduce((sum, date) => sum + map[date], 0);

  return {
    map,
    totalDays: dates.length,
    totalActions,
    streak: countActivityStreak(map)
  };
}

function markActivity() {
  if (!progress) return;
  if (!progress.activity || typeof progress.activity !== 'object' || Array.isArray(progress.activity)) {
    progress.activity = {};
  }

  const today = getTodayIsoDate();
  progress.activity[today] = Math.max(progress.activity[today] || 0, 1);
}

function collectActivityMap() {
  const map = {};
  if (!progress?.phases) return map;

  PHASES.forEach(phase => {
    const ph = progress.phases[phase.id];
    collectActivityDates(ph?.topics, map);
    collectActivityDates(ph?.tasks, map);
  });

  collectStoredActivityDates(map);

  return map;
}

function collectActivityDates(items, map) {
  if (!items) return;
  Object.values(items).forEach(date => {
    if (!isIsoDate(date)) return;
    map[date] = (map[date] || 0) + 1;
  });
}

function collectStoredActivityDates(map) {
  const activity = progress?.activity;
  if (!activity || typeof activity !== 'object' || Array.isArray(activity)) return;

  Object.entries(activity).forEach(([date, count]) => {
    if (!isIsoDate(date)) return;
    const safeCount = Math.max(1, Number(count) || 1);
    map[date] = Math.max(map[date] || 0, safeCount);
  });
}

function countActivityStreak(activityMap) {
  let cursor = getTodayIsoDate();
  if (!activityMap[cursor]) {
    const yesterday = addDays(cursor, -1);
    if (!activityMap[yesterday]) return 0;
    cursor = yesterday;
  }

  let streak = 0;
  while (activityMap[cursor]) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function getActivityMonths(activityMap) {
  const months = new Set([getTodayIsoDate().slice(0, 7)]);
  Object.keys(activityMap).forEach(date => months.add(date.slice(0, 7)));

  return [...months].sort().map(value => {
    const [year, month] = value.split('-').map(Number);
    return { year, month: month - 1 };
  });
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toIsoDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDays(isoDate, amount) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function pluralizeDays(count) {
  return pluralizeRu(count, 'день', 'дня', 'дней');
}

function pluralizeActiveDays(count) {
  return pluralizeRu(count, 'активный день', 'активных дня', 'активных дней');
}

function pluralizeActions(count) {
  return pluralizeRu(count, 'действие', 'действия', 'действий');
}

function pluralizeRu(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

// ──────────────────────────────────────────────
//  АВТОРАСТЯГИВАНИЕ ТЕКСТОВЫХ ПОЛЕЙ
// ──────────────────────────────────────────────
function adjustTextareaHeight(el) {
  if (!el) return;
  el.style.height = 'auto';
  const style = window.getComputedStyle(el);
  const borderTop = parseFloat(style.borderTopWidth) || 0;
  const borderBottom = parseFloat(style.borderBottomWidth) || 0;
  el.style.height = (el.scrollHeight + borderTop + borderBottom) + 'px';
}

function adjustAllTextareas() {
  const textareas = document.querySelectorAll('.phase-textarea, .task-note-input');
  textareas.forEach(adjustTextareaHeight);
}

// Автоматически подстраиваем высоту при вводе
document.addEventListener('input', e => {
  if (e.target.classList && (e.target.classList.contains('phase-textarea') || e.target.classList.contains('task-note-input'))) {
    adjustTextareaHeight(e.target);
  }
});

// Корректируем высоту всех полей при изменении размеров окна
window.addEventListener('resize', () => {
  adjustAllTextareas();
});

// ──────────────────────────────────────────────
//  MARKDOWN CHECKBOXES (NOTES)
// ──────────────────────────────────────────────
function renderMarkdownNote(text, type, phaseId, taskIdx = null) {
  if (!text || !text.trim()) {
    return `<div style="color: var(--text-muted); font-style: italic;">Нажмите, чтобы добавить заметку...</div>`;
  }
  
  const lines = text.split('\n');
  let html = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line starts with "- [ ]" or "- [x]" or "[ ]" or "[x]"
    const uncheckedMatch = line.match(/^(?:-\s*)?\[\s\]\s(.*)/);
    const checkedMatch = line.match(/^(?:-\s*)?\[[xX]\]\s(.*)/);
    
    if (uncheckedMatch) {
      html += `<label class="md-checkbox-label" onclick="event.stopPropagation(); toggleNoteCheckbox(event, '${type}', ${phaseId}, ${taskIdx}, ${i})">
        <div class="task-checkbox"></div>
        <span>${uncheckedMatch[1]}</span>
      </label>`;
    } else if (checkedMatch) {
      html += `<label class="md-checkbox-label" onclick="event.stopPropagation(); toggleNoteCheckbox(event, '${type}', ${phaseId}, ${taskIdx}, ${i})">
        <div class="task-checkbox md-checkbox-done"><i class="ti ti-check"></i></div>
        <span class="md-completed">${checkedMatch[1]}</span>
      </label>`;
    } else {
      html += `<p>${line || '<br>'}</p>`;
    }
  }
  return html;
}

function toggleNoteCheckbox(event, type, phaseId, taskIdx, lineIndex) {
  event.stopPropagation();
  const ph = getPhaseProgress(phaseId);
  
  let rawText = '';
  if (type === 'phase') {
    rawText = ph.notes.phase || '';
  } else {
    rawText = ph.notes[`task_${taskIdx}`] || '';
  }
  
  const lines = rawText.split('\n');
  if (lineIndex >= 0 && lineIndex < lines.length) {
    const line = lines[lineIndex];
    if (line.match(/^(?:-\s*)?\[\s\]/)) {
      lines[lineIndex] = line.replace(/^((?:-\s*)?)\[\s\]/, '$1[x]');
    } else if (line.match(/^(?:-\s*)?\[[xX]\]/)) {
      lines[lineIndex] = line.replace(/^((?:-\s*)?)\[[xX]\]/, '$1[ ]');
    }
    
    const newText = lines.join('\n');
    
    if (type === 'phase') {
      onPhaseNote(phaseId, newText);
    } else {
      onTaskNote(phaseId, taskIdx, newText);
    }
    
    const containerId = type === 'phase' ? `phase-note-container-${phaseId}` : `task-note-container-${phaseId}-${taskIdx}`;
    const container = document.getElementById(containerId);
    if (container) {
      const viewMode = container.querySelector('.note-view-mode');
      const textarea = container.querySelector('textarea');
      if (viewMode) viewMode.innerHTML = renderMarkdownNote(newText, type, phaseId, taskIdx);
      if (textarea) textarea.value = newText;
    }
  }
}

function enableNoteEditMode(type, phaseId, taskIdx = null) {
  const containerId = type === 'phase' ? `phase-note-container-${phaseId}` : `task-note-container-${phaseId}-${taskIdx}`;
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const viewMode = container.querySelector('.note-view-mode');
  const textarea = container.querySelector('textarea');
  
  if (viewMode && textarea) {
    viewMode.classList.add('hidden');
    textarea.classList.remove('hidden');
    textarea.focus();
    adjustTextareaHeight(textarea);
  }
}

function disableNoteEditMode(type, phaseId, value, taskIdx = null) {
  const containerId = type === 'phase' ? `phase-note-container-${phaseId}` : `task-note-container-${phaseId}-${taskIdx}`;
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const viewMode = container.querySelector('.note-view-mode');
  const textarea = container.querySelector('textarea');
  
  if (viewMode && textarea) {
    textarea.classList.add('hidden');
    viewMode.classList.remove('hidden');
    viewMode.innerHTML = renderMarkdownNote(value, type, phaseId, taskIdx);
  }
}
