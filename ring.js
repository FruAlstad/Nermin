(() => {
  const METALS = [
    { id: "guld", name: "Guld", price: 4200, color: "#e2b340" },
    { id: "silver", name: "Silver", price: 890, color: "#d5dde6" },
    { id: "rose", name: "Roséguld", price: 3900, color: "#e3a898" },
    { id: "platina", name: "Platina", price: 6800, color: "#c5ced6" },
  ];
  const GEMS = [
    { id: "diamant", name: "Diamant", price: 2400, color: "#d7ecff" },
    { id: "rubin", name: "Rubin", price: 1800, color: "#d41440" },
    { id: "safir", name: "Safir", price: 1600, color: "#2450d4" },
    { id: "smaragd", name: "Smaragd", price: 2100, color: "#0e9a58" },
    { id: "ametist", name: "Ametist", price: 420, color: "#8a3dcc" },
    { id: "ingen", name: "Ingen sten", price: 0, color: "#6a6258" },
  ];
  const MODELS = [
    { id: "klassisk", name: "Klassisk", price: 0 },
    { id: "pave", name: "Pavé", price: 900 },
    { id: "vriden", name: "Vriden", price: 450 },
    { id: "signet", name: "Signet", price: 350 },
  ];
  const PRESETS = [
    { name: "Sol", metal: "guld", gem: "diamant", model: "klassisk", text: "" },
    { name: "Ros", metal: "rose", gem: "rubin", model: "pave", text: "Ros" },
    { name: "Natt", metal: "platina", gem: "safir", model: "vriden", text: "" },
    { name: "Skog", metal: "silver", gem: "smaragd", model: "klassisk", text: "" },
    { name: "Sigill", metal: "guld", gem: "ingen", model: "signet", text: "N" },
  ];

  const studio = document.getElementById("studio");
  const stage = document.getElementById("stage");
  const pave = document.getElementById("pave");
  const engrave = document.getElementById("engrave");
  const signetLetter = document.getElementById("signetLetter");
  const summary = document.getElementById("summary");
  const priceEl = document.getElementById("price");
  const sizeInput = document.getElementById("size");
  const sizeLabel = document.getElementById("sizeLabel");
  const engraving = document.getElementById("engraving");
  const savedBox = document.getElementById("saved");
  const toast = document.getElementById("toast");
  const modal = document.getElementById("modal");
  const orderText = document.getElementById("orderText");
  const flipBtn = document.getElementById("flipBtn");
  const fingerBtn = document.getElementById("fingerBtn");

  const state = {
    metal: "guld",
    gem: "diamant",
    model: "klassisk",
    size: 54,
    text: "",
    spin: 24,
    inside: false,
    onFinger: false,
    dragging: false,
  };

  const audio = { ctx: null };

  for (let i = 0; i < 14; i++) {
    const dot = document.createElement("i");
    dot.style.setProperty("--a", `${(360 / 14) * i}deg`);
    pave.appendChild(dot);
  }

  function byId(list, id) {
    return list.find((item) => item.id === id);
  }

  function priceOf(design = state) {
    const metal = byId(METALS, design.metal).price;
    const gem = design.model === "signet" ? 0 : byId(GEMS, design.gem).price;
    const model = byId(MODELS, design.model).price;
    return metal + gem + model;
  }

  function kronor(n) {
    return `${n.toLocaleString("sv-SE")} kr`;
  }

  function describe(design = state) {
    const metal = byId(METALS, design.metal).name.toLowerCase();
    const model = byId(MODELS, design.model).name.toLowerCase();
    if (design.model === "signet") return `${model} i ${metal} · ${design.size} mm`;
    if (design.gem === "ingen") return `${model} ${metal}ring · ${design.size} mm`;
    const gem = byId(GEMS, design.gem).name.toLowerCase();
    return `${model} ${metal}ring med ${gem} · ${design.size} mm`;
  }

  function apply() {
    studio.dataset.metal = state.metal;
    studio.dataset.gem = state.gem;
    studio.dataset.model = state.model;
    studio.style.setProperty("--spin", `${state.spin}deg`);
    studio.style.setProperty("--tilt", state.inside ? "22deg" : "50deg");
    const scale = 0.84 + ((state.size - 48) / 22) * 0.34;
    studio.style.setProperty("--scale", scale.toFixed(3));
    engrave.textContent = state.text.trim();
    const letter = (state.text.trim() || "N").charAt(0).toUpperCase();
    signetLetter.textContent = letter;
    sizeLabel.textContent = `${state.size} mm`;
    priceEl.textContent = kronor(priceOf());
    summary.textContent = describe();
    stage.classList.toggle("on-finger", state.onFinger);
    const showEngrave = state.inside && state.text.trim().length > 0;
    stage.classList.toggle("show-inside", showEngrave);
    engrave.hidden = !showEngrave;
    flipBtn.textContent = state.inside ? "Visa utsidan" : "Visa insidan";
    fingerBtn.textContent = state.onFinger ? "Ta av fingret" : "Sätt på fingret";
    fingerBtn.setAttribute("aria-pressed", String(state.onFinger));
    markPressed();
  }

  function markPressed() {
    document.querySelectorAll("[data-pick]").forEach((btn) => {
      const on = state[btn.dataset.pick] === btn.dataset.value;
      btn.setAttribute("aria-pressed", String(on));
    });
    document.querySelectorAll("[data-preset]").forEach((btn, i) => {
      const p = PRESETS[i];
      const on = p.metal === state.metal && p.gem === state.gem && p.model === state.model;
      btn.setAttribute("aria-pressed", String(on));
    });
  }

  function choiceButtons(list, key, mount, swatch) {
    mount.innerHTML = "";
    for (const item of list) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice";
      btn.dataset.pick = key;
      btn.dataset.value = item.id;
      btn.setAttribute("aria-pressed", "false");
      if (swatch) {
        const dot = document.createElement("span");
        dot.className = swatch;
        dot.style.background = item.color;
        btn.appendChild(dot);
      }
      btn.append(item.name);
      btn.addEventListener("click", () => {
        state[key] = item.id;
        if (key === "model" && item.id === "signet") state.gem = "ingen";
        if (key === "gem" && item.id !== "ingen" && state.model === "signet") state.model = "klassisk";
        chime(key === "gem" ? 990 : 720);
        apply();
      });
      mount.appendChild(btn);
    }
  }

  function renderPresets() {
    const mount = document.getElementById("presets");
    PRESETS.forEach((preset, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset";
      btn.dataset.preset = String(index);
      btn.textContent = preset.name;
      btn.addEventListener("click", () => {
        state.metal = preset.metal;
        state.gem = preset.gem;
        state.model = preset.model;
        state.text = preset.text;
        engraving.value = preset.text;
        chime(840);
        apply();
      });
      mount.appendChild(btn);
    });
  }

  function loadSaved() {
    try {
      const raw = JSON.parse(localStorage.getItem("nermin-ringar") || "[]");
      return Array.isArray(raw) ? raw.slice(0, 8) : [];
    } catch {
      return [];
    }
  }

  function storeSaved(list) {
    localStorage.setItem("nermin-ringar", JSON.stringify(list));
  }

  function renderSaved() {
    const list = loadSaved();
    savedBox.innerHTML = "";
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "Inga sparade ringar än.";
      savedBox.appendChild(p);
      return;
    }
    for (const item of list) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "saved-item";
      const metal = byId(METALS, item.metal);
      const dot = document.createElement("span");
      dot.className = "swatch";
      dot.style.background = metal ? metal.color : "#e2b340";
      btn.append(dot, document.createTextNode(item.text || byId(MODELS, item.model).name));
      btn.addEventListener("click", () => {
        Object.assign(state, {
          metal: item.metal,
          gem: item.gem,
          model: item.model,
          size: item.size,
          text: item.text || "",
        });
        sizeInput.value = String(state.size);
        engraving.value = state.text;
        apply();
        ping("Sparad ring är tillbaka.");
      });
      const x = document.createElement("span");
      x.className = "x";
      x.textContent = "×";
      x.addEventListener("click", (e) => {
        e.stopPropagation();
        storeSaved(loadSaved().filter((row) => row.id !== item.id));
        renderSaved();
      });
      btn.appendChild(x);
      savedBox.appendChild(btn);
    }
  }

  function ping(text) {
    toast.textContent = text;
    toast.classList.add("show");
    clearTimeout(ping._t);
    ping._t = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function chime(freq) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audio.ctx) audio.ctx = new AC();
    audio.ctx.resume();
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    o.connect(g);
    g.connect(audio.ctx.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.start(t);
    o.stop(t + 0.3);
  }

  function randomize() {
    state.metal = METALS[Math.floor(Math.random() * METALS.length)].id;
    state.model = MODELS[Math.floor(Math.random() * MODELS.length)].id;
    state.gem = state.model === "signet" ? "ingen" : GEMS[Math.floor(Math.random() * (GEMS.length - 1))].id;
    state.size = 48 + Math.floor(Math.random() * 23);
    sizeInput.value = String(state.size);
    chime(640);
    apply();
    ping("En ny ring.");
  }

  function save() {
    const list = loadSaved();
    list.unshift({
      id: Date.now(),
      metal: state.metal,
      gem: state.gem,
      model: state.model,
      size: state.size,
      text: state.text.trim(),
    });
    storeSaved(list.slice(0, 8));
    renderSaved();
    chime(520);
    ping("Ringen är sparad.");
  }

  let lastX = 0;
  stage.addEventListener("pointerdown", (e) => {
    state.dragging = true;
    lastX = e.clientX;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!state.dragging) return;
    state.spin += (e.clientX - lastX) * 0.55;
    lastX = e.clientX;
    studio.style.setProperty("--spin", `${state.spin}deg`);
  });
  const stopDrag = () => { state.dragging = false; };
  stage.addEventListener("pointerup", stopDrag);
  stage.addEventListener("pointercancel", stopDrag);

  sizeInput.addEventListener("input", () => {
    state.size = Number(sizeInput.value);
    apply();
  });
  engraving.addEventListener("input", () => {
    state.text = engraving.value;
    apply();
  });
  document.getElementById("randomBtn").addEventListener("click", randomize);
  document.getElementById("saveBtn").addEventListener("click", save);
  document.getElementById("orderBtn").addEventListener("click", () => {
    orderText.textContent = `${describe()}. Pris ${kronor(priceOf())}.${state.text.trim() ? ` Gravyr: ${state.text.trim()}.` : ""}`;
    modal.hidden = false;
    chime(880);
  });
  document.getElementById("closeModal").addEventListener("click", () => {
    modal.hidden = true;
  });
  flipBtn.addEventListener("click", () => {
    state.inside = !state.inside;
    if (state.inside) state.onFinger = false;
    apply();
  });
  fingerBtn.addEventListener("click", () => {
    state.onFinger = !state.onFinger;
    if (state.onFinger) {
      state.inside = false;
      state.spin = 8;
    }
    apply();
  });

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!state.dragging && !state.inside && !state.onFinger) {
      state.spin += dt * 18;
      studio.style.setProperty("--spin", `${state.spin}deg`);
    }
    requestAnimationFrame(loop);
  }

  choiceButtons(METALS, "metal", document.getElementById("metals"), "swatch");
  choiceButtons(GEMS, "gem", document.getElementById("gems"), "gem-dot");
  choiceButtons(MODELS, "model", document.getElementById("models"));
  renderPresets();
  renderSaved();
  apply();
  requestAnimationFrame(loop);
})();
