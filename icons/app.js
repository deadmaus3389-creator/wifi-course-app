const STORAGE_KEY = "wifi_course_progress_v1";

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { done: {}, checklist: {}, quiz: {} };
  } catch {
    return { done: {}, checklist: {}, quiz: {} };
  }
}

function saveProgress(p) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

function qs(sel) { return document.querySelector(sel); }

function getLessonIdFromUrl() {
  const u = new URL(location.href);
  const id = Number(u.searchParams.get("id"));
  return Number.isFinite(id) ? id : null;
}

function escapeHtml(s) {
  return (s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function renderIndex() {
  const list = qs("#lessonsList");
  if (!list) return;

  const progress = loadProgress();
  list.innerHTML = "";

  for (const lesson of LESSONS) {
    const done = !!progress.done[lesson.id];
    const a = document.createElement("a");
    a.className = "lessonItem";
    a.href = `lesson.html?id=${lesson.id}`;
    a.innerHTML = `
      <div>
        <div style="font-weight:800;">${escapeHtml(lesson.title)}</div>
        <div class="muted" style="margin-top:2px;">${escapeHtml(lesson.subtitle)}</div>
      </div>
      <div class="badge ${done ? "badge--done" : "badge--todo"}">${done ? "Пройден" : "Не пройден"}</div>
    `;
    list.appendChild(a);
  }

  const total = LESSONS.length;
  const doneCount = Object.values(progress.done).filter(Boolean).length;
  const percent = Math.round((doneCount / total) * 100);

  const progressText = qs("#progressText");
  const progressBar = qs("#progressBar");
  if (progressText) progressText.textContent = `${doneCount} из ${total} уроков (${percent}%)`;
  if (progressBar) progressBar.style.width = `${percent}%`;

  const resetBtn = qs("#resetBtn");
  if (resetBtn) resetBtn.onclick = () => {
    if (!confirm("Сбросить весь прогресс?")) return;
    localStorage.removeItem(STORAGE_KEY);
    renderIndex();
  };

  const exportBtn = qs("#exportBtn");
  if (exportBtn) exportBtn.onclick = () => {
    const data = localStorage.getItem(STORAGE_KEY) || JSON.stringify({ done:{}, checklist:{}, quiz:{} });
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wifi-course-progress.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = qs("#importFile");
  if (importFile) importFile.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      JSON.parse(text);
      localStorage.setItem(STORAGE_KEY, text);
      alert("Импортировано.");
      renderIndex();
    } catch {
      alert("Файл некорректный JSON.");
    }
    importFile.value = "";
  };
}

function renderLesson() {
  const id = getLessonIdFromUrl();
  if (!id) return;

  const lessonIndex = LESSONS.findIndex(x => x.id === id);
  if (lessonIndex === -1) return;

  const lesson = LESSONS[lessonIndex];
  const progress = loadProgress();

  const title = qs("#title");
  const subtitle = qs("#subtitle");
  const content = qs("#content");

  if (title) title.textContent = lesson.title;
  if (subtitle) subtitle.textContent = lesson.subtitle;
  if (content) content.innerHTML = lesson.contentHtml;

  // prev/next
  const prevBtn = qs("#prevBtn");
  const nextBtn = qs("#nextBtn");
  const prevLesson = LESSONS[lessonIndex - 1] || null;
  const nextLesson = LESSONS[lessonIndex + 1] || null;

  if (prevBtn) {
    if (prevLesson) {
      prevBtn.href = `lesson.html?id=${prevLesson.id}`;
      prevBtn.style.pointerEvents = "auto";
      prevBtn.style.opacity = "1";
    } else {
      prevBtn.href = "#";
      prevBtn.style.pointerEvents = "none";
      prevBtn.style.opacity = "0.5";
    }
  }

  if (nextBtn) {
    if (nextLesson) {
      nextBtn.href = `lesson.html?id=${nextLesson.id}`;
      nextBtn.style.pointerEvents = "auto";
      nextBtn.style.opacity = "1";
    } else {
      nextBtn.href = "index.html";
      nextBtn.textContent = "К урокам";
    }
  }

  // checklist
  const checklistWrap = qs("#checklist");
  if (checklistWrap) {
    checklistWrap.innerHTML = "";
    const saved = progress.checklist[id] || {};
    lesson.checklist.forEach((text, idx) => {
      const key = String(idx);
      const checked = !!saved[key];
      const div = document.createElement("label");
      div.className = "checkItem";
      div.innerHTML = `
        <input type="checkbox" data-ck="${key}" ${checked ? "checked" : ""} />
        <div>${escapeHtml(text)}</div>
      `;
      checklistWrap.appendChild(div);
    });

    checklistWrap.onchange = (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      const k = t.dataset.ck;
      if (!k) return;
      progress.checklist[id] = progress.checklist[id] || {};
      progress.checklist[id][k] = t.checked;
      saveProgress(progress);
    };
  }

  // quiz
  const quizWrap = qs("#quiz");
  if (quizWrap) {
    quizWrap.innerHTML = "";
    lesson.quiz.forEach((qq, qi) => {
      const field = document.createElement("fieldset");
      field.className = "q";
      field.innerHTML = `<legend>${escapeHtml(qq.q)}</legend>`;
      qq.options.forEach((opt, oi) => {
        const name = `q${qi}`;
        const saved = progress.quiz[id]?.[String(qi)];
        const checked = saved === oi;
        const label = document.createElement("label");
        label.innerHTML = `
          <input type="radio" name="${name}" value="${oi}" ${checked ? "checked" : ""} />
          ${escapeHtml(opt)}
        `;
        field.appendChild(label);
      });
      const hint = document.createElement("small");
      hint.textContent = "Выбери один вариант.";
      field.appendChild(hint);
      quizWrap.appendChild(field);
    });

    quizWrap.onchange = (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.type !== "radio") return;
      const qi = Number(t.name.replace("q",""));
      const oi = Number(t.value);
      progress.quiz[id] = progress.quiz[id] || {};
      progress.quiz[id][String(qi)] = oi;
      saveProgress(progress);
    };
  }

  const quizResult = qs("#quizResult");
  const checkQuizBtn = qs("#checkQuizBtn");
  if (checkQuizBtn) {
    checkQuizBtn.onclick = () => {
      let correct = 0;
      const total = lesson.quiz.length;
      for (let qi = 0; qi < total; qi++) {
        const picked = progress.quiz[id]?.[String(qi)];
        if (picked === lesson.quiz[qi].answerIndex) correct++;
      }
      if (quizResult) {
        quizResult.textContent = `Результат: ${correct} / ${total}.`;
        quizResult.style.color = (correct === total) ? "var(--ok)" : "var(--muted)";
      }
    };
  }

  // done toggle
  const doneToggle = qs("#doneToggle");
  if (doneToggle) {
    doneToggle.checked = !!progress.done[id];
    doneToggle.onchange = () => {
      progress.done[id] = doneToggle.checked;
      saveProgress(progress);
    };
  }
}

// PWA: register service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  });
}

renderIndex();
renderLesson();
