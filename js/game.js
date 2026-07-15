/* Dominion 1867 — game logic */
(function () {
  "use strict";
  const D = window.GAME_DATA;
  const TOTAL_Q = D.questions.length;      // 622
  const TOTAL_MS = D.milestones.length;    // 311
  const SAVE_KEY = "dominion1867-save-v1";

  const $ = (id) => document.getElementById(id);

  /* ---------------- State ---------------- */
  let state = {
    mi: 0,          // next index into the main ordered question list
    rq: [],         // requeued (missed) question indices
    correct: 0,     // correct answers so far (drives milestones)
    attempts: 0,
    streak: 0,
    bestStreak: 0,
    done: false,
  };
  let currentQ = null;        // index into D.questions
  let fromRequeue = false;
  let locked = false;         // answer submitted, waiting for Next
  let pendingMilestones = []; // milestone indices to show
  let freshMs = -1;

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (typeof s.mi !== "number" || typeof s.correct !== "number") return false;
      state = Object.assign(state, s);
      return state.correct > 0 || state.mi > 0 || state.rq.length > 0;
    } catch (e) { return false; }
  }
  function resetState() {
    state = { mi: 0, rq: [], correct: 0, attempts: 0, streak: 0, bestStreak: 0, done: false };
    save();
  }

  /* ---------------- Derived helpers ---------------- */
  const msUnlocked = () => Math.min(Math.floor(state.correct / 2), TOTAL_MS);
  function currentYear() {
    const n = msUnlocked();
    return n === 0 ? 1867 : D.milestones[n - 1].year;
  }
  function currentPmIdx() {
    const n = msUnlocked();
    return n === 0 ? 0 : D.milestones[n - 1].pm;
  }

  /* ---------------- Dominion Jukebox (iTunes-style player) ---------------- */
  const audio = $("audio");
  const musicBtn = $("musicBtn");
  const player = $("player");
  const lcdTitle = $("lcdTitle"), lcdSub = $("lcdSub"), lcdIcon = $("lcdIcon");
  const lcdElapsed = $("lcdElapsed"), lcdRemain = $("lcdRemain");
  const seek = $("seek"), playBtn = $("playBtn"), playIconPath = $("playIconPath");
  const N = D.tracks.length;
  let trackIdx = 0;
  let isPlaying = false;
  let seeking = false;

  const PLAY_D = "M8 5v14l11-7z";
  const PAUSE_D = "M6 5h4v14H6zM14 5h4v14h-4z";

  function fmt(t) {
    if (!isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  function renderPlaylist() {
    const ol = $("playerList");
    ol.innerHTML = "";
    D.tracks.forEach((t, i) => {
      const li = document.createElement("li");
      li.dataset.idx = i;
      if (i === trackIdx) li.classList.add("current");
      li.innerHTML =
        '<span class="tno">' + (i + 1) + '</span>' +
        '<span class="tname">' + escapeHtml(t.title) + "</span>" +
        '<span class="tplaying">' + (i === trackIdx ? (isPlaying ? "▶" : "❚❚") : "") + "</span>";
      li.addEventListener("click", () => playTrack(i)); // user chooses any song
      ol.appendChild(li);
    });
  }

  function updateLcd() {
    lcdTitle.textContent = (trackIdx + 1) + ". " + D.tracks[trackIdx].title;
    lcdSub.textContent = "Track " + (trackIdx + 1) + " of " + N + " · Canadian Soundtrack" +
      (isPlaying ? "" : " · paused");
    lcdIcon.classList.toggle("playing", isPlaying);
    playIconPath.setAttribute("d", isPlaying ? PAUSE_D : PLAY_D);
    playBtn.title = isPlaying ? "Pause" : "Play";
    musicBtn.setAttribute("aria-pressed", String(isPlaying));
    renderPlaylist();
  }

  function loadTrack(i) {
    trackIdx = ((i % N) + N) % N;
    audio.src = D.tracks[trackIdx].src;
  }

  function playTrack(i) {
    loadTrack(i);
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
    isPlaying = true;
    updateLcd();
  }

  function togglePlay() {
    if (!audio.src) { playTrack(trackIdx); return; }
    if (isPlaying) { audio.pause(); isPlaying = false; }
    else { const p = audio.play(); if (p && p.catch) p.catch(() => {}); isPlaying = true; }
    updateLcd();
  }

  // Fixed order: after the last track, repeat the same order from track 1.
  audio.addEventListener("ended", () => playTrack(trackIdx + 1));
  audio.addEventListener("play", () => { isPlaying = true; updateLcd(); });
  audio.addEventListener("pause", () => { if (!audio.ended) { isPlaying = false; updateLcd(); } });
  audio.addEventListener("timeupdate", () => {
    if (seeking) return;
    const d = audio.duration;
    lcdElapsed.textContent = fmt(audio.currentTime);
    lcdRemain.textContent = "-" + fmt((isFinite(d) ? d : 0) - audio.currentTime);
    if (isFinite(d) && d > 0) seek.value = Math.round((audio.currentTime / d) * 1000);
  });

  playBtn.addEventListener("click", togglePlay);
  $("prevBtn").addEventListener("click", () => {
    // iTunes behaviour: restart the track if past 3s, otherwise go to the previous one
    if (audio.currentTime > 3 && audio.src) { audio.currentTime = 0; return; }
    playTrack(trackIdx - 1);
  });
  $("nextBtn2").addEventListener("click", () => playTrack(trackIdx + 1));

  seek.addEventListener("input", () => {
    seeking = true;
    const d = audio.duration;
    if (isFinite(d)) lcdElapsed.textContent = fmt((seek.value / 1000) * d);
  });
  const commitSeek = () => {
    const d = audio.duration;
    if (isFinite(d) && d > 0) audio.currentTime = (seek.value / 1000) * d;
    seeking = false;
  };
  seek.addEventListener("change", commitSeek);
  seek.addEventListener("mouseup", commitSeek);
  seek.addEventListener("touchend", commitSeek);

  $("volume").addEventListener("input", (e) => { audio.volume = e.target.value / 100; });
  audio.volume = 0.8;

  musicBtn.addEventListener("click", () => player.classList.toggle("hidden"));
  $("playerClose").addEventListener("click", () => player.classList.add("hidden"));

  function setMusic(on) {
    if (on) { playTrack(trackIdx); player.classList.remove("hidden"); }
    else { audio.pause(); isPlaying = false; updateLcd(); }
  }

  /* ---------------- Tabs ---------------- */
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", String(b === btn));
      });
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      $(btn.dataset.panel).classList.add("active");
      if (btn.dataset.panel === "panel-journal") renderJournal();
    });
  });

  /* ---------------- Quiz ---------------- */
  const els = {
    cat: $("quizCat"), num: $("quizNum"), question: $("quizQuestion"),
    choices: $("choices"), feedback: $("quizFeedback"), nextBtn: $("nextBtn"),
    statYear: $("statYear"), statMs: $("statMs"), statQ: $("statQ"), statStreak: $("statStreak"),
    eraPmNum: $("eraPmNum"), eraPmName: $("eraPmName"), eraPmParty: $("eraPmParty"),
    eraPmTerm: $("eraPmTerm"), eraNext: $("eraNext"),
    railFill: $("railFill"), railTrain: $("railTrain"), railYearNow: $("railYearNow"),
    railCaption: $("railCaption"),
  };

  function pickNextQuestion() {
    if (state.mi < TOTAL_Q) { fromRequeue = false; return state.mi; }
    if (state.rq.length > 0) { fromRequeue = true; return state.rq[0]; }
    return null;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const KEYS = ["1", "2", "3", "4"];

  function renderQuestion() {
    const qi = pickNextQuestion();
    if (qi === null) { finale(); return; }
    currentQ = qi;
    locked = false;
    const q = D.questions[qi];
    els.cat.textContent = q.part + " · " + q.sec + (fromRequeue ? " · returned to the order paper" : "");
    els.num.textContent = "Q " + q.n + " / " + TOTAL_Q;
    els.question.textContent = q.q;
    els.feedback.innerHTML = "";
    els.nextBtn.classList.add("hidden");
    els.choices.innerHTML = "";
    const opts = shuffle([q.a, ...q.d]);
    opts.forEach((text, i) => {
      const b = document.createElement("button");
      b.className = "choice";
      b.dataset.answer = text;
      b.innerHTML = '<span class="key">' + KEYS[i] + "</span><span>" + escapeHtml(text) + "</span>";
      b.addEventListener("click", () => answer(b, text === q.a));
      els.choices.appendChild(b);
    });
    updateHud();
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function answer(btn, isCorrect) {
    if (locked) return;
    locked = true;
    state.attempts++;
    const q = D.questions[currentQ];
    const buttons = [...els.choices.querySelectorAll(".choice")];
    buttons.forEach((b) => {
      b.disabled = true;
      if (b.dataset.answer === q.a) b.classList.add("correct");
      else if (b === btn) b.classList.add("wrong");
      else b.classList.add("dim");
    });

    if (isCorrect) {
      state.streak++;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.correct++;
      // advance queues
      if (fromRequeue) state.rq.shift(); else state.mi++;
      els.feedback.innerHTML = '<span class="fb-good">Correct.</span> ' + praise();
      // milestone every 2 correct
      if (state.correct % 2 === 0 && msUnlocked() <= TOTAL_MS) {
        pendingMilestones.push(msUnlocked() - 1);
      }
    } else {
      state.streak = 0;
      // requeue for later
      if (fromRequeue) { state.rq.shift(); state.rq.push(currentQ); }
      else { state.rq.push(currentQ); state.mi++; }
      els.feedback.innerHTML = '<span class="fb-bad">Not quite.</span> The answer is <strong>' +
        escapeHtml(q.a) + "</strong>. This question will return later — the House always gets a second reading.";
    }
    save();
    updateHud();
    els.nextBtn.classList.remove("hidden");
    els.nextBtn.focus({ preventScroll: true });
  }

  function praise() {
    const s = state.streak;
    if (s >= 20) return "A streak of " + s + " — a landslide majority!";
    if (s >= 10) return s + " in a row. The Cabinet applauds.";
    if (s >= 5) return s + " straight. Hansard will remember this.";
    return "";
  }

  function proceed() {
    if (pendingMilestones.length > 0) { showMilestone(pendingMilestones.shift()); return; }
    if (state.correct >= TOTAL_Q) { finale(); return; }
    renderQuestion();
  }
  els.nextBtn.addEventListener("click", proceed);

  document.addEventListener("keydown", (e) => {
    if (!$("startVeil").classList.contains("hidden")) return;
    if (!$("msModal").classList.contains("hidden")) {
      if (e.key === "Enter") { e.preventDefault(); $("msContinue").click(); }
      return;
    }
    if (!$("finaleVeil").classList.contains("hidden")) return;
    if (!$("panel-govern").classList.contains("active")) return;
    if (!locked && KEYS.includes(e.key)) {
      const b = els.choices.querySelectorAll(".choice")[KEYS.indexOf(e.key)];
      if (b) b.click();
    } else if (locked && e.key === "Enter") {
      e.preventDefault();
      proceed();
    }
  });

  /* ---------------- HUD / era / railway ---------------- */
  function updateHud() {
    const n = msUnlocked();
    const yr = currentYear();
    const pm = D.pms[currentPmIdx()];
    els.statYear.textContent = yr;
    els.statMs.textContent = n;
    els.statQ.textContent = Math.min(state.correct, TOTAL_Q);
    els.statStreak.textContent = state.streak;
    els.eraPmNum.textContent = "Prime Minister № " + pm.num;
    els.eraPmName.textContent = pm.name;
    els.eraPmParty.textContent = pm.party;
    els.eraPmTerm.textContent = pm.term;
    const toNext = state.correct % 2 === 0 ? 2 : 1;
    els.eraNext.textContent = state.correct >= TOTAL_Q
      ? "All milestones accomplished."
      : (n < TOTAL_MS
        ? "Answer " + toNext + " more question" + (toNext > 1 ? "s" : "") + " correctly to accomplish milestone " + (n + 1) + " of 311."
        : "Clear the remaining order paper to finish.");
    // railway
    const pct = (state.correct / TOTAL_Q) * 100;
    els.railFill.style.width = pct + "%";
    els.railTrain.style.left = pct + "%";
    els.railYearNow.textContent = yr;
    els.railCaption.textContent = n === 0
      ? "The Dominion sets out from Confederation."
      : "Latest milestone — " + D.milestones[n - 1].year + ": " + D.milestones[n - 1].text;
    updateMapColors();
  }

  /* ---------------- Milestone proclamation ---------------- */
  function showMilestone(i) {
    const ms = D.milestones[i];
    freshMs = i;
    $("msCount").textContent = i + 1;
    $("msTitle").textContent = ms.year;
    $("msPm").textContent = "Under " + D.pms[ms.pm].name + " · " + D.pms[ms.pm].party;
    $("msText").textContent = ms.text;
    $("msModal").classList.remove("hidden");
    $("msContinue").focus();
  }
  $("msContinue").addEventListener("click", () => {
    $("msModal").classList.add("hidden");
    proceed();
  });

  /* ---------------- Journal ---------------- */
  function renderJournal() {
    const n = msUnlocked();
    $("journalCount").textContent = n;
    const list = $("journalList");
    list.innerHTML = "";
    D.pms.forEach((pm, pi) => {
      const items = D.milestones.map((m, i) => ({ m, i })).filter((x) => x.m.pm === pi);
      const unlockedHere = items.filter((x) => x.i < n).length;
      const box = document.createElement("div");
      box.className = "j-pm";
      box.innerHTML =
        '<div class="j-pm-head"><h3>' + pm.num + ". " + escapeHtml(pm.name) +
        ' <span class="j-party">' + escapeHtml(pm.party) + "</span></h3>" +
        '<span class="j-progress">' + unlockedHere + " / " + items.length + " milestones</span></div>";
      const ul = document.createElement("ul");
      ul.className = "j-items";
      items.forEach((x) => {
        const li = document.createElement("li");
        if (x.i < n) {
          li.innerHTML = '<span class="j-year">' + x.m.year + "</span><span>" + escapeHtml(x.m.text) + "</span>";
          if (x.i === freshMs) li.classList.add("fresh");
        } else {
          li.classList.add("locked");
          li.innerHTML = '<span class="j-year">' + x.m.year + '</span><span>Milestone ' + (x.i + 1) + " — not yet accomplished. Keep answering.</span>";
        }
        ul.appendChild(li);
      });
      box.appendChild(ul);
      list.appendChild(box);
    });
  }

  /* ---------------- Interactive map ---------------- */
  let mapReady = false;
  let selectedProv = null;
  const PROV_IDS = D.provinces.map((p) => p.id);

  fetch("assets/img/canada_map.svg")
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then((svgText) => {
      const holder = $("mapHolder");
      holder.innerHTML = svgText;
      const svg = holder.querySelector("svg");
      svg.removeAttribute("width"); svg.removeAttribute("height");
      svg.setAttribute("role", "img");
      PROV_IDS.forEach((id) => {
        const g = svg.getElementById(id);
        if (!g) return;
        g.classList.add("prov");
        g.setAttribute("tabindex", "0");
        const p = D.provinces.find((x) => x.id === id);
        const t = document.createElementNS("http://www.w3.org/2000/svg", "title");
        t.textContent = p.name;
        g.appendChild(t);
        const act = () => selectProv(id);
        g.addEventListener("click", act);
        g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } });
      });
      mapReady = true;
      updateMapColors();
    })
    .catch(() => {
      $("mapHolder").innerHTML =
        '<div class="map-loading">The map could not be loaded. If you opened this file directly, please serve it over HTTP (e.g. GitHub Pages or <code>python3 -m http.server</code>).</div>';
    });

  function updateMapColors() {
    if (!mapReady) return;
    const yr = currentYear();
    const svg = $("mapHolder").querySelector("svg");
    if (!svg) return;
    D.provinces.forEach((p) => {
      const g = svg.getElementById(p.id);
      if (!g) return;
      const joined = p.joined <= yr;
      let fill = joined ? "#c8102e" : "#d8d2c2";
      if (selectedProv === p.id) fill = "#b98a2f";
      g.setAttribute("fill", fill);
    });
  }

  function selectProv(id) {
    selectedProv = id;
    updateMapColors();
    const p = D.provinces.find((x) => x.id === id);
    const joined = p.joined <= currentYear();
    const card = $("provCard");
    card.innerHTML =
      '<div class="prov-type">' + p.type + "</div>" +
      '<h3 class="prov-name">' + escapeHtml(p.name) + "</h3>" +
      '<div class="prov-motto">' + escapeHtml(p.motto) + "</div>" +
      '<div class="prov-status ' + (joined ? "in" : "out") + '">' +
      (joined
        ? "Part of Confederation since " + p.joined + "."
        : "Not yet part of the Dominion in your timeline — " + (p.type === "Territory" ? "established" : "joins") + " in " + p.joined + ". Keep governing!") +
      "</div>" +
      '<dl class="prov-facts">' +
      "<div><dt>Capital</dt><dd>" + escapeHtml(p.capital) + "</dd></div>" +
      "<div><dt>" + (p.type === "Territory" ? "Established" : "Joined") + "</dt><dd>" + p.joined + "</dd></div>" +
      "</dl>" +
      '<p class="prov-desc">' + escapeHtml(p.desc) + "</p>" +
      "<strong style=\"font-size:.8rem;letter-spacing:.08em;text-transform:uppercase\">Unlike anywhere else</strong>" +
      '<ul class="prov-unique">' + p.unique.map((u) => "<li>" + escapeHtml(u) + "</li>").join("") + "</ul>";
    if (window.innerWidth < 900) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ---------------- Finale ---------------- */
  function finale() {
    state.done = true;
    save();
    $("finaleStats").innerHTML =
      "<div><b>622</b>questions answered</div>" +
      "<div><b>311</b>milestones accomplished</div>" +
      "<div><b>" + state.attempts + "</b>total attempts</div>" +
      "<div><b>" + state.bestStreak + "</b>best streak</div>" +
      "<div><b>" + Math.round((TOTAL_Q / Math.max(state.attempts, 1)) * 100) + "%</b>accuracy</div>";
    $("finaleVeil").classList.remove("hidden");
    startConfetti();
  }
  $("finaleRestart").addEventListener("click", () => {
    stopConfetti();
    $("finaleVeil").classList.add("hidden");
    resetState();
    freshMs = -1; pendingMilestones = [];
    renderQuestion();
  });

  /* maple-leaf confetti */
  let confettiRAF = null;
  function startConfetti() {
    const cv = $("confetti");
    const ctx = cv.getContext && cv.getContext("2d");
    if (!ctx) return;
    const fit = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    fit();
    window.addEventListener("resize", fit);
    const colors = ["#c8102e", "#ffffff", "#b98a2f"];
    const parts = Array.from({ length: 120 }, () => ({
      x: Math.random() * cv.width, y: -Math.random() * cv.height,
      s: 6 + Math.random() * 10, v: 1 + Math.random() * 2.5,
      r: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.12,
      c: colors[(Math.random() * colors.length) | 0],
    }));
    (function tick() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      parts.forEach((p) => {
        p.y += p.v; p.r += p.vr; p.x += Math.sin(p.y / 40) * 0.8;
        if (p.y > cv.height + 20) { p.y = -20; p.x = Math.random() * cv.width; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.7);
        ctx.restore();
      });
      confettiRAF = requestAnimationFrame(tick);
    })();
  }
  function stopConfetti() { if (confettiRAF) cancelAnimationFrame(confettiRAF); }

  /* ---------------- Reset ---------------- */
  $("resetBtn").addEventListener("click", () => {
    if (confirm("Restart from July 1, 1867? All progress will be lost.")) {
      resetState();
      freshMs = -1; pendingMilestones = [];
      renderQuestion();
    }
  });

  /* ---------------- About tracks ---------------- */
  $("aboutTracks").innerHTML = D.tracks.map((t) => "<li>" + escapeHtml(t.title) + "</li>").join("");

  /* ---------------- Start ---------------- */
  const hasSave = load();
  if (hasSave && !state.done) {
    const cb = $("continueBtn");
    cb.classList.remove("hidden");
    cb.textContent = "Continue — " + msUnlocked() + " milestones, year " + currentYear();
    $("startBtn").textContent = "Start over from 1867";
    cb.addEventListener("click", () => beginGame(false));
    $("startBtn").addEventListener("click", () => { resetState(); beginGame(true); });
  } else {
    if (hasSave && state.done) resetState();
    $("startBtn").addEventListener("click", () => beginGame(true));
  }

  function beginGame() {
    $("startVeil").classList.add("hidden");
    if ($("startMusic").checked) setMusic(true);
    renderQuestion();
  }

  updateHud();
  updateLcd();
})();
