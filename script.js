(() => {
  const app = document.getElementById("app");
  const hint = document.getElementById("hint");
  const lesson = document.getElementById("lesson");
  const exterior = document.getElementById("exterior");
  const viewport = document.getElementById("viewport");
  const cockpit = document.getElementById("cockpit");
  const driverDoor = document.getElementById("driverDoor");
  const passengerDoor = document.getElementById("passengerDoor");
  const driverHandleHint = document.getElementById("driverHandleHint");
  const enterCar = document.getElementById("enterCar");
  const closeDoorOutside = document.getElementById("closeDoorOutside");
  const innerDoorBtn = document.getElementById("innerDoorBtn");
  const exitCarBtn = document.getElementById("exitCar");
  const driveNowBtn = document.getElementById("driveNow");
  const repairBtn = document.getElementById("repairEngine");
  const modeComfortBtn = document.getElementById("modeComfort");
  const modeSportBtn = document.getElementById("modeSport");
  const heldKey = document.getElementById("heldKey");
  const engineBay = document.getElementById("engineBay");
  const engineBayHint = document.getElementById("engineBayHint");
  const engineSlot = document.getElementById("engineSlot");
  const brokenEngine = document.getElementById("brokenEngine");
  const fittedEngine = document.getElementById("fittedEngine");
  const engineEmpty = document.getElementById("engineEmpty");
  const newEngineBtn = document.getElementById("newEngine");
  const engineDoneBtn = document.getElementById("engineDone");
  const heldEngine = document.getElementById("heldEngine");
  const doorOverlay = document.getElementById("doorOverlay");
  const engineLight = document.getElementById("engineLight");
  const keyBtn = document.getElementById("key");
  const keyCaption = document.getElementById("keyCaption");
  const slot = document.getElementById("slot");
  const keyholeWrap = document.getElementById("keyholeWrap");
  const keyholeLabel = document.getElementById("keyholeLabel");
  const keyInHole = document.getElementById("keyInHole");
  const keyOut = document.getElementById("keyOut");
  const belt = document.getElementById("belt");
  const unbelt = document.getElementById("unbelt");
  const beltStation = document.getElementById("beltStation");
  const buckle = document.getElementById("buckle");
  const steering = document.getElementById("steering");
  const speedEl = document.getElementById("speed");
  const gearEl = document.getElementById("gear");
  const gearDisplay = document.getElementById("gearDisplay");
  const shifter = document.getElementById("shifter");
  const blinkL = document.getElementById("blinkL");
  const blinkR = document.getElementById("blinkR");
  const rpmNeedle = document.getElementById("rpmNeedle");
  const fuelNeedle = document.getElementById("fuelNeedle");
  const revExhaust = document.getElementById("revExhaust");
  const canvas = document.getElementById("view");
  const ctx = canvas.getContext("2d");
  const rear = document.getElementById("rear");
  const rearCtx = rear.getContext("2d");
  const leftM = document.getElementById("leftMirror");
  const leftCtx = leftM.getContext("2d");
  const rightM = document.getElementById("rightMirror");
  const rightCtx = rightM.getContext("2d");
  const minimap = document.getElementById("minimap");
  const mapCtx = minimap.getContext("2d");

  const SEG_LEN = 200;
  const ROAD_W = 2000;
  const CAM_H = 1000;
  const CAM_DEPTH = 0.84;
  const DRAW_DIST = 160;

  const state = {
    // outside -> doorOpen -> insideOpen -> insideClosed -> pickup -> insert -> belt -> drive
    phase: "outside",
    driverOpen: false,
    passengerOpen: false,
    inside: false,
    doorAjar: false,
    holdingKey: false,
    keyInIgnition: false,
    engineOn: false,
    engineBroken: false,
    belted: false,
    speed: 0,
    pos: 0,
    playerX: 0.42,
    curve: 0,
    steer: 0,
    steerRate: 0,
    rpm: 0,
    fuel: 0.82,
    gear: "N",
    gearIndex: 0, // 0=N, 1-6 = gears, -1 = R
    distance: 0,
    shiftCooldown: 0,
    blink: 0,
    rev: 0,
    hasRevved: false,
    bump: 0,
    hitCd: 0,
    driveMode: "comfort",
    engineSwap: "idle", // idle | remove | pickNew | holdNew | fitted
    holdingEngine: false,
    // Karta — kör runt fritt
    mapX: 0,
    mapZ: -120,
    heading: 0, // radianer, 0 = norr (+Z)
    traffic: [],
    input: { left: false, right: false, up: false, down: false },
  };

  // Oval bana + mittkorsning för kartan
  const MAP_ROADS = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    MAP_ROADS.push({ x: Math.cos(a) * 140, z: Math.sin(a) * 95 });
  }
  // Tvärväg
  for (let x = -140; x <= 140; x += 8) MAP_ROADS.push({ x, z: 0, spur: true });
  for (let z = -95; z <= 95; z += 8) MAP_ROADS.push({ x: 0, z, spur: true });

  const segments = [];
  for (let i = 0; i < 900; i++) {
    const curve =
      Math.sin(i * 0.015) * 1.2 +
      Math.sin(i * 0.041) * 0.7 +
      (i > 200 && i < 280 ? -2.2 : 0) +
      (i > 450 && i < 520 ? 2.4 : 0);
    const y = Math.sin(i * 0.01) * 400 + Math.sin(i * 0.027) * 220;
    segments.push({ index: i, curve, y });
  }

  const carColors = ["#c0392b", "#2980b9", "#2c3e50", "#ecf0f1", "#27ae60", "#8e44ad", "#d35400", "#f1c40f", "#1abc9c", "#e74c3c", "#34495e", "#16a085"];
  const carKinds = ["sedan", "suv", "sport", "hatch"];
  for (let n = 0; n < 12; n++) {
    const oncoming = n % 3 === 0;
    state.traffic.push({
      z: 14 + n * 22 + Math.random() * 6,
      x: oncoming ? -0.46 : 0.46,
      speed: oncoming ? -(18 + Math.random() * 14) : 16 + Math.random() * 18,
      color: carColors[n % carColors.length],
      kind: carKinds[n % carKinds.length],
      oncoming,
    });
  }

  const audio = { ctx: null, master: null, engine: null, noise: null, sfx: null };

  function ensureAudio() {
    if (audio.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0;
    audio.master.connect(audio.ctx.destination);

    const oscA = audio.ctx.createOscillator();
    const oscB = audio.ctx.createOscillator();
    const oscC = audio.ctx.createOscillator();
    const filter = audio.ctx.createBiquadFilter();
    const engGain = audio.ctx.createGain();
    filter.type = "lowpass";
    filter.frequency.value = 220;
    oscA.type = "sawtooth";
    oscB.type = "square";
    oscC.type = "triangle";
    oscA.frequency.value = 48;
    oscB.frequency.value = 24;
    oscC.frequency.value = 96;
    engGain.gain.value = 0.5;
    oscA.connect(filter);
    oscB.connect(filter);
    oscC.connect(engGain);
    filter.connect(engGain);
    engGain.connect(audio.master);
    oscA.start();
    oscB.start();
    oscC.start();

    const bufferSize = 2 * audio.ctx.sampleRate;
    const buffer = audio.ctx.createBuffer(1, bufferSize, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audio.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const noiseFilter = audio.ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 700;
    const noiseGain = audio.ctx.createGain();
    noiseGain.gain.value = 0;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audio.master);
    noise.start();

    audio.engine = { oscA, oscB, oscC, filter, engGain };
    audio.noise = { filter: noiseFilter, gain: noiseGain };
    audio.sfx = audio.ctx.createGain();
    audio.sfx.gain.value = 0.2;
    audio.sfx.connect(audio.ctx.destination);
  }

  function playDoorSound(open) {
    ensureAudio();
    if (!audio.ctx) return;
    audio.ctx.resume();
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    const f = audio.ctx.createBiquadFilter();
    o.type = "triangle";
    f.type = "lowpass";
    o.connect(f);
    f.connect(g);
    g.connect(audio.sfx || audio.ctx.destination);
    if (open) {
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.28);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      f.frequency.value = 900;
    } else {
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      f.frequency.value = 400;
    }
    o.start(t);
    o.stop(t + 0.4);
  }

  function playBump() {
    ensureAudio();
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(36, t + 0.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g);
    g.connect(audio.sfx || audio.ctx.destination);
    o.start(t);
    o.stop(t + 0.25);
  }

  function setEngineSound() {
    if (!audio.ctx || !audio.engine) return;
    const gas = state.input.up && state.engineOn && state.phase === "drive";
    const rev = state.rev || 0;
    const rpm = state.rpm || (700 + Math.abs(state.speed) * 55 + (gas ? 350 : 0) + (state.engineOn ? 80 : 0));
    const t = audio.ctx.currentTime;
    audio.engine.oscA.frequency.setTargetAtTime(rpm / 14, t, 0.05);
    audio.engine.oscB.frequency.setTargetAtTime(rpm / 28, t, 0.05);
    audio.engine.oscC.frequency.setTargetAtTime(rpm / 9, t, 0.06);
    audio.engine.filter.frequency.setTargetAtTime(180 + Math.abs(state.speed) * 4 + rev * 980, t, 0.05);
    const loud = state.driveMode === "sport" ? 1.45 : 0.5;
    const vol = state.engineOn ? (0.05 + Math.abs(state.speed) * 0.0011 + rev * (state.driveMode === "sport" ? 0.22 : 0.08)) * loud : 0;
    audio.master.gain.setTargetAtTime(vol, t, state.driveMode === "sport" ? 0.04 : 0.14);
    if (audio.noise) {
      audio.noise.gain.gain.setTargetAtTime(Math.abs(state.speed) * 0.00035, t, 0.1);
      audio.noise.filter.frequency.setTargetAtTime(500 + Math.abs(state.speed) * 8, t, 0.1);
    }
  }

  function toast(text, ms = 2800) {
    lesson.textContent = text;
    lesson.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => lesson.classList.remove("show"), ms);
  }

  function updateExteriorUI() {
    driverDoor.classList.toggle("open", state.driverOpen);
    passengerDoor.classList.toggle("open", state.passengerOpen);
    driverHandleHint.hidden = state.driverOpen || state.inside;
    enterCar.hidden = !(state.driverOpen && !state.inside);
    closeDoorOutside.hidden = !(state.driverOpen && !state.inside);
  }

  function openDriverDoor() {
    if (state.inside) return;
    if (state.driverOpen) return;
    ensureAudio();
    state.driverOpen = true;
    state.phase = "doorOpen";
    playDoorSound(true);
    updateExteriorUI();
    hint.textContent = "Förardörren är öppen. Sätt dig i bilen.";
    toast("Dörren är öppen!");
  }

  function openPassengerDoor() {
    if (state.inside) return;
    state.passengerOpen = !state.passengerOpen;
    playDoorSound(state.passengerOpen);
    updateExteriorUI();
    toast(state.passengerOpen ? "Passagerardörren är öppen." : "Passagerardörren är stängd.");
  }

  function closeDriverOutside() {
    if (!state.driverOpen || state.inside) return;
    state.driverOpen = false;
    state.phase = "outside";
    playDoorSound(false);
    updateExteriorUI();
    hint.textContent = "Öppna förardörren igen för att sätta dig";
    toast("Dörren är stängd.");
  }

  function updateExitButton() {
    const canExit =
      state.inside &&
      state.doorAjar &&
      Math.abs(state.speed) < 0.5 &&
      !state.engineOn;
    exitCarBtn.hidden = !canExit;
  }

  function sitInCar() {
    if (!state.driverOpen || state.inside) return;
    state.inside = true;
    state.doorAjar = true;
    state.phase = "insideOpen";
    app.classList.remove("outside");
    exterior.hidden = true;
    viewport.hidden = false;
    cockpit.hidden = false;
    doorOverlay.hidden = false;
    innerDoorBtn.textContent = "Stäng dörren";
    innerDoorBtn.classList.add("warn");
    driveNowBtn.hidden = true;
    showCabinControls();
    if (!state.keyInIgnition && !state.holdingKey) {
      keyBtn.classList.add("guide");
      keyBtn.disabled = false;
      keyCaption.textContent = "Ta upp";
    }
    updateExitButton();
    hint.textContent = "Stäng dörren. Sedan tar du upp nyckeln.";
    toast("Stäng dörren, ta upp nyckeln och sätt den i hålet.");
    resize();
  }

  function exitCar() {
    if (!state.inside || !state.doorAjar) return;
    if (Math.abs(state.speed) > 0.5) {
      toast("Stanna bilen först!");
      return;
    }
    if (state.engineOn) {
      toast("Stäng av motorn och ta ut nyckeln först!");
      return;
    }
    if (state.belted) {
      toast("Ta av bilbältet innan du går ur!");
      return;
    }
    if (state.keyInIgnition) {
      toast("Ta ut nyckeln först!");
      return;
    }

    // Gå ut till parkeringen
    state.inside = false;
    state.doorAjar = false;
    state.driverOpen = true;
    state.holdingKey = false;
    state.phase = "doorOpen";
    state.speed = 0;

    app.classList.add("outside");
    exterior.hidden = false;
    viewport.hidden = true;
    cockpit.hidden = true;
    doorOverlay.hidden = true;
    exitCarBtn.hidden = true;
    driveNowBtn.hidden = true;
    updateExteriorUI();
    playDoorSound(true);
    hint.textContent = "Du har gått ur bilen. Sätt dig igen eller stäng dörren.";
    toast("Du gick ur sportbilen.");
  }

  function toggleInnerDoor() {
    if (!state.inside) return;
    if (state.phase === "drive" && state.speed > 1) {
      toast("Stanna bilen innan du öppnar dörren!");
      return;
    }

    if (state.doorAjar) {
      // close door
      state.doorAjar = false;
      playDoorSound(false);
      doorOverlay.hidden = true;
      innerDoorBtn.textContent = "Öppna dörr";
      innerDoorBtn.classList.remove("warn");
      updateExitButton();

      if (state.phase === "insideOpen") {
        state.phase = "ready";
        showCabinControls();
        driveNowBtn.hidden = false;
        hint.textContent = "Dörren är stängd. Ta upp nyckeln och sätt den i nyckelhålet.";
        toast("Dörren är stängd. Sätt i nyckeln!");
      } else {
        hint.textContent = "Dörren är stängd.";
        toast("Dörren är stängd.");
        showCabinControls();
        driveNowBtn.hidden = true;
      }
      return;
    }

    // open door from inside
    if (state.engineOn && state.speed > 0.5) {
      toast("Bromsa och stanna först!");
      return;
    }
    state.doorAjar = true;
    playDoorSound(true);
    doorOverlay.hidden = false;
    innerDoorBtn.textContent = "Stäng dörren";
    innerDoorBtn.classList.add("warn");
    updateExitButton();
    toast("Dörren är öppen.");
    if (state.engineOn) {
      hint.textContent = "Ta ut nyckeln och ta av bältet för att gå ur.";
    } else if (state.belted) {
      hint.textContent = "Ta av bilbältet, sedan kan du gå ur.";
    } else {
      hint.textContent = "Dörren är öppen — tryck Gå ur bilen.";
    }
  }

  function project(x, y, z, camX, camY, camZ, w, h) {
    const dx = x - camX;
    const dy = y - camY;
    const dz = z - camZ;
    if (dz <= 8) return null;
    const depth = CAM_DEPTH / (1 + Math.abs(state.speed) * 0.003);
    const scale = depth / dz;
    return {
      x: w / 2 + scale * dx * (w / 2),
      y: h * 0.43 - scale * dy * (h / 2),
      w: scale * ROAD_W * (w / 2),
      scale,
    };
  }

  function resize() {
    if (viewport.hidden) return;
    const parent = canvas.parentElement;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = parent.getBoundingClientRect();
    canvas.width = Math.floor(r.width * dpr);
    canvas.height = Math.floor(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawSky(w, h, curveLean) {
    const horizon = h * 0.43;
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, "#4e86b0");
    g.addColorStop(0.55, "#9ec3d6");
    g.addColorStop(1, "#d7e4ea");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const sunX = w * 0.8 - curveLean * 36;
    const sunY = h * 0.16;
    const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 90);
    glow.addColorStop(0, "rgba(255,244,210,0.95)");
    glow.addColorStop(1, "rgba(255,244,210,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff6d2";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    const clouds = [
      [0.12, 0.14, 70],
      [0.28, 0.22, 48],
      [0.46, 0.11, 62],
      [0.62, 0.2, 40],
    ];
    for (const [cx, cy, rw] of clouds) {
      const x = cx * w - curveLean * 24;
      const y = cy * h;
      ctx.beginPath();
      ctx.ellipse(x, y, rw, rw * 0.38, 0, 0, Math.PI * 2);
      ctx.ellipse(x + rw * 0.55, y + 4, rw * 0.7, rw * 0.32, 0, 0, Math.PI * 2);
      ctx.ellipse(x - rw * 0.5, y + 6, rw * 0.55, rw * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#b7c9d2";
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let i = 0; i <= 16; i++) {
      const x = (i / 16) * w - curveLean * 18;
      const peak = horizon - (28 + ((i * 53) % 78)) * (h / 520);
      ctx.lineTo(x, peak);
    }
    ctx.lineTo(w + 40, horizon);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#9eb4c0";
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * w - curveLean * 10;
      const peak = horizon - (16 + ((i * 37) % 40)) * (h / 640);
      ctx.lineTo(x, Math.min(horizon - 4, peak + 18));
    }
    ctx.lineTo(w + 20, horizon);
    ctx.closePath();
    ctx.fill();
  }

  function drawCarSprite(x, y, scale, color, oncoming = false, kind = "sedan") {
    const s = Math.max(0.2, scale);
    const w = (kind === "suv" ? 102 : kind === "sport" ? 96 : kind === "hatch" ? 86 : 92) * s;
    const h = (kind === "suv" ? 62 : kind === "sport" ? 42 : kind === "hatch" ? 50 : 52) * s;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,.42)";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.52, w * 0.52, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    if (oncoming) drawCarFront(w, h, color, kind, s);
    else drawCarRear(w, h, color, kind, s);
    ctx.restore();
  }

  function drawWheelPair(w, h, s) {
    for (const side of [-1, 1]) {
      const wx = side * w * 0.34;
      const wy = h * 0.28;
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath();
      ctx.ellipse(wx, wy, w * 0.1, h * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8a9199";
      ctx.beginPath();
      ctx.ellipse(wx, wy, w * 0.045, h * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1d22";
      ctx.beginPath();
      ctx.ellipse(wx, wy, w * 0.018, h * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCarRear(w, h, color, kind, s) {
    const top = kind === "suv" ? -h * 0.98 : kind === "sport" ? -h * 0.7 : -h * 0.86;
    drawWheelPair(w, h, s);

    // Stötfångare under
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.28, w * 0.42, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createLinearGradient(-w * 0.5, top, w * 0.5, h * 0.3);
    body.addColorStop(0, shadeColor(color, 55));
    body.addColorStop(0.35, shadeColor(color, 18));
    body.addColorStop(0.55, color);
    body.addColorStop(1, shadeColor(color, -50));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-w * 0.46, h * 0.22);
    ctx.quadraticCurveTo(-w * 0.52, h * 0.02, -w * 0.48, -h * 0.12);
    ctx.lineTo(-w * 0.4, top * 0.55);
    ctx.quadraticCurveTo(-w * 0.28, top, -w * 0.12, top);
    ctx.lineTo(w * 0.12, top);
    ctx.quadraticCurveTo(w * 0.28, top, w * 0.4, top * 0.55);
    ctx.lineTo(w * 0.48, -h * 0.12);
    ctx.quadraticCurveTo(w * 0.52, h * 0.02, w * 0.46, h * 0.22);
    ctx.closePath();
    ctx.fill();

    // Dörrlinjer
    ctx.strokeStyle = "rgba(0,0,0,.22)";
    ctx.lineWidth = Math.max(1, s * 1.2);
    ctx.beginPath();
    ctx.moveTo(-w * 0.12, top + h * 0.15);
    ctx.lineTo(-w * 0.14, h * 0.18);
    ctx.moveTo(w * 0.12, top + h * 0.15);
    ctx.lineTo(w * 0.14, h * 0.18);
    ctx.stroke();

    // Sidoglans
    const shine = ctx.createLinearGradient(0, top, 0, h * 0.1);
    shine.addColorStop(0, "rgba(255,255,255,.32)");
    shine.addColorStop(0.45, "rgba(255,255,255,.06)");
    shine.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, top + h * 0.04);
    ctx.lineTo(w * 0.3, top + h * 0.04);
    ctx.lineTo(w * 0.38, -h * 0.05);
    ctx.lineTo(-w * 0.38, -h * 0.05);
    ctx.closePath();
    ctx.fill();

    // Bakruta + ramtätning
    ctx.fillStyle = "#0a1014";
    ctx.beginPath();
    ctx.moveTo(-w * 0.26, top + h * 0.08);
    ctx.quadraticCurveTo(0, top, w * 0.26, top + h * 0.08);
    ctx.lineTo(w * 0.32, -h * 0.04);
    ctx.quadraticCurveTo(0, -h * 0.1, -w * 0.32, -h * 0.04);
    ctx.closePath();
    ctx.fill();
    const glass = ctx.createLinearGradient(0, top, 0, -h * 0.05);
    glass.addColorStop(0, "#d0ecf8");
    glass.addColorStop(0.35, "#4a7a9a");
    glass.addColorStop(1, "#152838");
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.moveTo(-w * 0.24, top + h * 0.1);
    ctx.quadraticCurveTo(0, top + h * 0.02, w * 0.24, top + h * 0.1);
    ctx.lineTo(w * 0.3, -h * 0.06);
    ctx.quadraticCurveTo(0, -h * 0.12, -w * 0.3, -h * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.42)";
    ctx.beginPath();
    ctx.ellipse(-w * 0.08, top + h * 0.12, w * 0.08, h * 0.04, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Speglar
    ctx.fillStyle = shadeColor(color, -20);
    ctx.fillRect(-w * 0.52, -h * 0.18, w * 0.07, h * 0.08);
    ctx.fillRect(w * 0.45, -h * 0.18, w * 0.07, h * 0.08);
    ctx.fillStyle = "#8ec8e0";
    ctx.fillRect(-w * 0.51, -h * 0.16, w * 0.04, h * 0.05);
    ctx.fillRect(w * 0.47, -h * 0.16, w * 0.04, h * 0.05);

    // Bakljus — LED-band
    for (const side of [-1, 1]) {
      const lx = side * w * 0.36;
      ctx.fillStyle = "#ff1010";
      ctx.shadowColor = "rgba(255,30,30,.9)";
      ctx.shadowBlur = 10 * s;
      ctx.beginPath();
      ctx.ellipse(lx, -h * 0.02, w * 0.1, h * 0.05, side * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffc8c8";
      ctx.beginPath();
      ctx.ellipse(lx - side * w * 0.025, -h * 0.03, w * 0.045, h * 0.022, 0, 0, Math.PI * 2);
      ctx.fill();
      // Blinkers amber
      ctx.fillStyle = "#ffb020";
      ctx.beginPath();
      ctx.ellipse(lx - side * w * 0.09, h * 0.02, w * 0.035, h * 0.025, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Avgas
    ctx.fillStyle = "#1a1a1a";
    ctx.strokeStyle = "#5a5a5a";
    ctx.lineWidth = 1;
    for (const sx of [-0.2, 0.2]) {
      ctx.beginPath();
      ctx.ellipse(w * sx, h * 0.22, w * 0.04, h * 0.032, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    if (s > 0.55) {
      ctx.fillStyle = "#f2efe6";
      ctx.fillRect(-w * 0.16, h * 0.01, w * 0.32, h * 0.09);
      ctx.strokeStyle = "#1a3a6e";
      ctx.lineWidth = Math.max(1, s);
      ctx.strokeRect(-w * 0.16, h * 0.01, w * 0.32, h * 0.09);
      ctx.fillStyle = "#1a3a6e";
      ctx.font = `bold ${Math.max(6, 8.5 * s)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("ABC 12A", 0, h * 0.08);
    }

    if (kind === "sport") {
      ctx.fillStyle = shadeColor(color, -40);
      ctx.fillRect(-w * 0.3, top - h * 0.08, w * 0.6, h * 0.055);
      ctx.fillRect(-w * 0.28, top - h * 0.03, w * 0.045, h * 0.09);
      ctx.fillRect(w * 0.235, top - h * 0.03, w * 0.045, h * 0.09);
    }
    if (kind === "suv" && s > 0.4) {
      ctx.strokeStyle = shadeColor(color, -30);
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(-w * 0.22, top + h * 0.02);
      ctx.lineTo(-w * 0.18, top - h * 0.06);
      ctx.lineTo(w * 0.18, top - h * 0.06);
      ctx.lineTo(w * 0.22, top + h * 0.02);
      ctx.stroke();
    }
  }

  function drawCarFront(w, h, color, kind, s) {
    const top = kind === "suv" ? -h * 0.98 : kind === "sport" ? -h * 0.68 : -h * 0.84;
    drawWheelPair(w, h, s);

    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.26, w * 0.4, h * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createLinearGradient(-w * 0.5, top, w * 0.5, h * 0.3);
    body.addColorStop(0, shadeColor(color, 60));
    body.addColorStop(0.4, shadeColor(color, 15));
    body.addColorStop(0.6, color);
    body.addColorStop(1, shadeColor(color, -45));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-w * 0.46, h * 0.2);
    ctx.quadraticCurveTo(-w * 0.52, 0, -w * 0.46, -h * 0.08);
    ctx.lineTo(-w * 0.34, top * 0.5);
    ctx.quadraticCurveTo(-w * 0.2, top, 0, top);
    ctx.quadraticCurveTo(w * 0.2, top, w * 0.34, top * 0.5);
    ctx.lineTo(w * 0.46, -h * 0.08);
    ctx.quadraticCurveTo(w * 0.52, 0, w * 0.46, h * 0.2);
    ctx.closePath();
    ctx.fill();

    // Huva-linjer
    ctx.strokeStyle = "rgba(0,0,0,.2)";
    ctx.lineWidth = Math.max(1, s);
    ctx.beginPath();
    ctx.moveTo(-w * 0.12, top + h * 0.2);
    ctx.lineTo(-w * 0.08, h * 0.05);
    ctx.moveTo(w * 0.12, top + h * 0.2);
    ctx.lineTo(w * 0.08, h * 0.05);
    ctx.stroke();

    // Vindruta
    ctx.fillStyle = "#0a1218";
    ctx.beginPath();
    ctx.moveTo(-w * 0.24, top + h * 0.1);
    ctx.quadraticCurveTo(0, top + h * 0.02, w * 0.24, top + h * 0.1);
    ctx.lineTo(w * 0.3, 0);
    ctx.quadraticCurveTo(0, -h * 0.06, -w * 0.3, 0);
    ctx.closePath();
    ctx.fill();
    const glass = ctx.createLinearGradient(0, top, 0, -h * 0.02);
    glass.addColorStop(0, "#e8f6ff");
    glass.addColorStop(0.4, "#6aa8c8");
    glass.addColorStop(1, "#1a3850");
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.moveTo(-w * 0.22, top + h * 0.12);
    ctx.quadraticCurveTo(0, top + h * 0.04, w * 0.22, top + h * 0.12);
    ctx.lineTo(w * 0.28, -h * 0.02);
    ctx.quadraticCurveTo(0, -h * 0.08, -w * 0.28, -h * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.45)";
    ctx.beginPath();
    ctx.ellipse(w * 0.06, top + h * 0.1, w * 0.1, h * 0.035, 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Torkarblad
    if (s > 0.5) {
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = Math.max(1, 1.5 * s);
      ctx.beginPath();
      ctx.moveTo(-w * 0.08, -h * 0.01);
      ctx.quadraticCurveTo(-w * 0.02, top + h * 0.18, w * 0.1, top + h * 0.14);
      ctx.moveTo(w * 0.02, 0);
      ctx.quadraticCurveTo(w * 0.08, top + h * 0.16, w * 0.18, top + h * 0.12);
      ctx.stroke();
    }

    // Grill
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(-w * 0.22, 0, w * 0.44, h * 0.12);
    ctx.fillStyle = "#3a3a3a";
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(-w * 0.18 + i * w * 0.05, h * 0.015, w * 0.018, h * 0.09);
    }
    ctx.strokeStyle = shadeColor(color, 30);
    ctx.lineWidth = 1.5 * s;
    ctx.strokeRect(-w * 0.22, 0, w * 0.44, h * 0.12);

    // Strålkastare + LED DRL
    for (const side of [-1, 1]) {
      const lx = side * w * 0.34;
      ctx.fillStyle = "#fff8e0";
      ctx.shadowColor = "rgba(255,240,180,.95)";
      ctx.shadowBlur = 14 * s;
      ctx.beginPath();
      ctx.ellipse(lx, -h * 0.01, w * 0.11, h * 0.065, side * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(lx - side * w * 0.02, -h * 0.02, w * 0.045, h * 0.028, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(200,230,255,.7)";
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(lx - side * w * 0.08, h * 0.04);
      ctx.quadraticCurveTo(lx, h * 0.06, lx + side * w * 0.02, h * 0.03);
      ctx.stroke();
    }

    // Speglar
    ctx.fillStyle = shadeColor(color, -15);
    ctx.fillRect(-w * 0.5, -h * 0.2, w * 0.07, h * 0.09);
    ctx.fillRect(w * 0.43, -h * 0.2, w * 0.07, h * 0.09);
    ctx.fillStyle = "#a8d8f0";
    ctx.fillRect(-w * 0.49, -h * 0.18, w * 0.04, h * 0.05);
    ctx.fillRect(w * 0.45, -h * 0.18, w * 0.04, h * 0.05);
  }

  function fogPaint(hex, fog) {
    const c = hex.replace("#", "");
    const num = parseInt(c.length === 3 ? c.split("").map((ch) => ch + ch).join("") : c, 16);
    const r = num >> 16;
    const g = (num >> 8) & 255;
    const b = num & 255;
    const k = Math.min(0.78, fog * fog * 1.2);
    return `rgb(${(r + (198 - r) * k) | 0},${(g + (214 - g) * k) | 0},${(b + (220 - b) * k) | 0})`;
  }

  function shadeColor(hex, amt) {
    const c = hex.replace("#", "");
    const num = parseInt(c.length === 3 ? c.split("").map((x) => x + x).join("") : c, 16);
    let r = (num >> 16) + amt;
    let g = ((num >> 8) & 0xff) + amt;
    let b = (num & 0xff) + amt;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return `rgb(${r},${g},${b})`;
  }

  function polygon(x1, y1, x2, y2, x3, y3, x4, y4, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  function segmentBand(p1, p2, widthFactor, offsetFactor, color) {
    const x1 = p1.x + p1.w * offsetFactor;
    const x2 = p2.x + p2.w * offsetFactor;
    const w1 = p1.w * widthFactor;
    const w2 = p2.w * widthFactor;
    polygon(x1 - w1, p1.y, x1 + w1, p1.y, x2 + w2, p2.y, x2 - w2, p2.y, color);
  }

  function drawRoad(w, h) {
    const base = Math.floor(state.pos / SEG_LEN) % segments.length;
    const baseY = segments[base].y || 0;
    const camY = CAM_H + baseY;
    const playerWorldX = state.playerX * ROAD_W + state.steer * 1.7;
    let x = 0;
    let dx = 0;
    const lean = state.curve * 0.8 + state.steer * 0.0011;
    const roll = Math.max(-0.07, Math.min(0.07, state.steer * 0.00013));
    const shake = state.bump > 0 ? (Math.random() - 0.5) * 18 * state.bump : 0;
    const pitchMul = state.driveMode === "sport" ? 1.5 : 0.35;
    const pitch = ((state.input.up ? -14 : 0) + (state.input.down ? 10 : 0)) * pitchMul;

    ctx.save();
    ctx.translate(w / 2 + shake, h * 0.58 + shake * 0.4);
    ctx.rotate(roll);
    ctx.translate(-w / 2, -h * 0.58 + pitch);

    drawSky(w, h, lean);

    const pts = [];
    const byN = [];
    for (let n = 1; n < DRAW_DIST; n++) {
      const seg = segments[(base + n) % segments.length];
      const segPrev = segments[(base + n - 1 + segments.length) % segments.length];
      const x1 = x;
      x += dx;
      dx += seg.curve;
      const z1 = (n - 1) * SEG_LEN - (state.pos % SEG_LEN);
      const z2 = n * SEG_LEN - (state.pos % SEG_LEN);
      const p1 = project(-x1, segPrev.y, z1, playerWorldX, camY, 0, w, h);
      const p2 = project(-x, seg.y, z2, playerWorldX, camY, 0, w, h);
      if (!p1 || !p2) continue;
      const fog = n / DRAW_DIST;
      pts.push({ p1, p2, n, alt: ((base + n) % 2) === 0, fog });
      byN[n] = p2;
    }

    // Nära först, så backar mot horisonten. Backkrön döljer vägen bakom.
    let clipY = h + 4;
    for (let i = 0; i < pts.length; i++) {
      const { p1, p2, alt, n, fog } = pts[i];
      if (p1.y >= clipY) continue;
      if (p2.y >= p1.y) continue;

      const grass = fogPaint(alt ? "#4e7344" : "#45683c", fog);
      const shoulder = fogPaint(alt ? "#7a7264" : "#6a6356", fog);
      const road = fogPaint(alt ? "#3c444c" : "#353c44", fog);
      const paint = fogPaint("#f3f0e6", fog);

      polygon(0, p1.y, w, p1.y, w, p2.y, 0, p2.y, grass);
      segmentBand(p1, p2, 1.16, 0, shoulder);
      segmentBand(p1, p2, 1, 0, road);
      segmentBand(p1, p2, 0.014, -0.97, paint);
      segmentBand(p1, p2, 0.014, 0.97, paint);
      if (alt) segmentBand(p1, p2, 0.012, 0, paint);

      const s = Math.max(0.35, p2.w / 240);
      if (n % 5 === 0 && fog < 0.85) {
        for (const side of [-1, 1]) {
          const px = p2.x + side * p2.w * 1.16;
          const poleH = 34 * s;
          ctx.fillStyle = "#dfe5ec";
          ctx.fillRect(px - Math.max(1, s * 0.7), p2.y - poleH, Math.max(2, s * 1.3), poleH);
          ctx.fillStyle = "#f1c40f";
          ctx.fillRect(px - 3.2 * s, p2.y - poleH - 2 * s, 6.4 * s, 3 * s);
        }
      }
      if (n % 7 === 0 && fog < 0.8) {
        for (const side of [-1, 1]) {
          const px = p2.x + side * p2.w * (1.55 + (n % 3) * 0.08);
          ctx.fillStyle = "#5c4632";
          ctx.fillRect(px - 1.1 * s, p2.y - 10 * s, 2.2 * s, 10 * s);
          ctx.fillStyle = n % 14 === 0 ? "#2f6a3c" : "#245832";
          ctx.beginPath();
          ctx.ellipse(px, p2.y - 16 * s, 11 * s, 8 * s, 0, 0, Math.PI * 2);
          ctx.ellipse(px - 6 * s, p2.y - 12 * s, 8 * s, 7 * s, 0, 0, Math.PI * 2);
          ctx.ellipse(px + 6 * s, p2.y - 13 * s, 8 * s, 6.5 * s, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (n % 13 === 0 && fog < 0.7) {
        const side = n % 26 === 0 ? -1 : 1;
        const px = p2.x + side * p2.w * 2.05;
        const bw = 26 * s;
        const bh = 18 * s;
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(px - bw * 0.4, p2.y - 3 * s, bw * 0.9, 4 * s);
        ctx.fillStyle = side < 0 ? "#d9d3c4" : "#e7d7c4";
        ctx.fillRect(px - bw / 2, p2.y - bh, bw, bh);
        ctx.fillStyle = "#8d3b32";
        ctx.beginPath();
        ctx.moveTo(px - bw * 0.62, p2.y - bh + 1);
        ctx.lineTo(px, p2.y - bh - 12 * s);
        ctx.lineTo(px + bw * 0.62, p2.y - bh + 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#9fd0ea";
        ctx.fillRect(px - bw * 0.18, p2.y - bh * 0.72, bw * 0.36, bh * 0.32);
      }
      segmentBand(p1, p2, 0.01, -1.16, "#d5dbe3");
      segmentBand(p1, p2, 0.01, 1.16, "#d5dbe3");
      clipY = p1.y;
    }

    const visible = [];
    for (const car of state.traffic) {
      const rel = car.z - state.pos / SEG_LEN;
      let z = ((rel % segments.length) + segments.length) % segments.length;
      if (z < 4 || z > DRAW_DIST - 4) continue;
      const p = byN[Math.floor(z)];
      if (!p || p.y < 0 || p.y > h) continue;
      visible.push({ car, z, p });
    }
    visible.sort((a, b) => b.z - a.z);
    for (const { car, z, p } of visible) {
      const nearBoost = z < 12 ? 1.55 : z < 28 ? 1.25 : 1;
      const scale = Math.min(2.1, Math.max(0.22, (p.w / 360) * nearBoost));
      drawCarSprite(
        p.x + car.x * p.w * 0.85,
        p.y,
        scale,
        car.color,
        !!car.oncoming,
        car.kind || "sedan"
      );
    }

    const haze = ctx.createLinearGradient(0, h * 0.3, 0, h * 0.5);
    haze.addColorStop(0, "rgba(198,214,220,0)");
    haze.addColorStop(1, "rgba(198,214,220,0.55)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, h * 0.3, w, h * 0.22);

    state.curve = segments[base].curve;
    ctx.restore();
    drawPlayerHood(w, h);
  }

  function drawPlayerHood(w, h) {
    const top = h * 0.74;
    const paint = ctx.createLinearGradient(w * 0.5, top, w * 0.5, h);
    paint.addColorStop(0, "#f03540");
    paint.addColorStop(0.1, "#c41824");
    paint.addColorStop(0.35, "#8a1018");
    paint.addColorStop(0.65, "#4a080c");
    paint.addColorStop(1, "#140204");
    ctx.fillStyle = paint;
    ctx.beginPath();
    ctx.moveTo(w * 0.14, top + 14);
    ctx.quadraticCurveTo(w * 0.5, top - h * 0.035, w * 0.86, top + 14);
    ctx.lineTo(w * 1.06, h + 4);
    ctx.lineTo(-w * 0.06, h + 4);
    ctx.closePath();
    ctx.fill();

    // Power-bulge / huvlinjer
    ctx.strokeStyle = "rgba(0,0,0,.32)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.26, top + 20);
    ctx.quadraticCurveTo(w * 0.3, h * 0.88, w * 0.28, h);
    ctx.moveTo(w * 0.74, top + 20);
    ctx.quadraticCurveTo(w * 0.7, h * 0.88, w * 0.72, h);
    ctx.moveTo(w * 0.5, top + 16);
    ctx.lineTo(w * 0.5, h);
    ctx.stroke();

    // Sidoreflexer
    for (const side of [-1, 1]) {
      const gleam = ctx.createLinearGradient(w * (0.5 + side * 0.22), top, w * (0.5 + side * 0.22), h);
      gleam.addColorStop(0, "rgba(255,255,255,.22)");
      gleam.addColorStop(0.5, "rgba(255,255,255,.04)");
      gleam.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gleam;
      ctx.beginPath();
      ctx.moveTo(w * (0.5 + side * 0.12), top + 18);
      ctx.lineTo(w * (0.5 + side * 0.28), top + 22);
      ctx.lineTo(w * (0.5 + side * 0.32), h);
      ctx.lineTo(w * (0.5 + side * 0.08), h);
      ctx.closePath();
      ctx.fill();
    }

    // Vindrutebas / svart list + torkarbas
    ctx.fillStyle = "rgba(8,6,6,.82)";
    ctx.beginPath();
    ctx.moveTo(w * 0.2, top + 2);
    ctx.quadraticCurveTo(w * 0.5, top - 8, w * 0.8, top + 2);
    ctx.lineTo(w * 0.78, top + 16);
    ctx.quadraticCurveTo(w * 0.5, top + 10, w * 0.22, top + 16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#2a1a1c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.32, top + 12);
    ctx.lineTo(w * 0.42, top + 4);
    ctx.moveTo(w * 0.55, top + 12);
    ctx.lineTo(w * 0.68, top + 5);
    ctx.stroke();

    // Emblem
    ctx.fillStyle = "rgba(255,224,138,.35)";
    ctx.font = `bold ${Math.max(10, w * 0.018)}px Outfit, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("N", w * 0.5, top + (h - top) * 0.35);

    for (const side of [-1, 1]) {
      const cx = w * (0.5 + side * 0.3);
      const cy = top + (h - top) * 0.62;
      if (state.engineOn) {
        const beam = ctx.createRadialGradient(cx, cy, 2, cx, cy - 40, 90);
        beam.addColorStop(0, "rgba(255,242,210,.6)");
        beam.addColorStop(1, "rgba(255,236,190,0)");
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 14, 70, 36, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const lamp = ctx.createRadialGradient(cx - 4, cy - 3, 1, cx, cy, w * 0.038);
      lamp.addColorStop(0, state.engineOn ? "#fff" : "#fff8e8");
      lamp.addColorStop(0.5, state.engineOn ? "#ffe08a" : "#d8d0b8");
      lamp.addColorStop(1, "#4a4030");
      ctx.fillStyle = lamp;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.036, h * 0.022, side * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1a0c0e";
      ctx.lineWidth = 2;
      ctx.stroke();
      // DRL-streck
      ctx.strokeStyle = state.engineOn ? "rgba(220,240,255,.85)" : "rgba(180,190,200,.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - side * w * 0.01, cy + h * 0.018);
      ctx.quadraticCurveTo(cx + side * w * 0.02, cy + h * 0.028, cx + side * w * 0.045, cy + h * 0.012);
      ctx.stroke();
    }
  }

  function drawMirrorView(mctx, mw, mh, mode) {
    // mode: "rear" | "left" | "right" — riktig spegelvy bakåt/sidan
    mctx.clearRect(0, 0, mw, mh);

    const sky = mctx.createLinearGradient(0, 0, 0, mh * 0.48);
    sky.addColorStop(0, "#4f9ec8");
    sky.addColorStop(1, "#c7e5f4");
    mctx.fillStyle = sky;
    mctx.fillRect(0, 0, mw, mh);

    mctx.fillStyle = "#3d6b38";
    mctx.fillRect(0, mh * 0.48, mw, mh * 0.52);

    const lean = state.steer * 0.00035 * (mode === "rear" ? -1 : mode === "left" ? -0.6 : 0.6);
    const cx = mw * 0.5 + lean * mw + (mode === "left" ? mw * 0.08 : mode === "right" ? -mw * 0.08 : 0);
    const topW = mode === "rear" ? mw * 0.12 : mw * 0.18;
    const botW = mode === "rear" ? mw * 0.95 : mw * 0.7;

    mctx.fillStyle = "#323840";
    mctx.beginPath();
    mctx.moveTo(cx - topW / 2, mh * 0.48);
    mctx.lineTo(cx + topW / 2, mh * 0.48);
    mctx.lineTo(cx + botW / 2, mh);
    mctx.lineTo(cx - botW / 2, mh);
    mctx.closePath();
    mctx.fill();

    // Mittlinje (streckad bakåt)
    mctx.strokeStyle = "rgba(242,244,247,.85)";
    mctx.lineWidth = 2;
    mctx.setLineDash([6, 6]);
    mctx.beginPath();
    mctx.moveTo(cx, mh * 0.5);
    mctx.lineTo(cx, mh);
    mctx.stroke();
    mctx.setLineDash([]);

    // Bilar bakom / bredvid
    for (const car of state.traffic) {
      const rel = car.z - state.pos / SEG_LEN;
      let z = ((rel % segments.length) + segments.length) % segments.length;
      if (mode === "rear") {
        if (z < segments.length - 35 || z > segments.length - 2) continue;
        const t = (segments.length - z) / 35;
        const y = mh * (0.55 + t * 0.35);
        const s = 0.25 + t * 0.55;
        const x = cx + car.x * (mw * 0.25) * (1 - t * 0.3);
        mctx.fillStyle = car.color;
        mctx.fillRect(x - 10 * s, y - 6 * s, 20 * s, 10 * s);
        mctx.fillStyle = "#ffe9a0";
        mctx.fillRect(x - 8 * s, y + 2 * s, 4 * s, 2 * s);
        mctx.fillRect(x + 4 * s, y + 2 * s, 4 * s, 2 * s);
      } else {
        const sideOk = mode === "left" ? car.x < 0 : car.x > 0;
        if (!sideOk || z < 4 || z > 40) continue;
        const t = z / 40;
        const y = mh * (0.52 + t * 0.35);
        const s = 0.35 + (1 - t) * 0.4;
        const x = mode === "left" ? mw * (0.25 + t * 0.2) : mw * (0.75 - t * 0.2);
        mctx.fillStyle = car.color;
        mctx.fillRect(x - 9 * s, y - 5 * s, 18 * s, 9 * s);
      }
    }

    // Glasskimmer
    const sheen = mctx.createLinearGradient(0, 0, mw, mh);
    sheen.addColorStop(0, "rgba(255,255,255,.18)");
    sheen.addColorStop(0.4, "rgba(255,255,255,0)");
    sheen.addColorStop(1, "rgba(180,210,255,.1)");
    mctx.fillStyle = sheen;
    mctx.fillRect(0, 0, mw, mh);

    // Kant
    mctx.strokeStyle = "rgba(0,0,0,.35)";
    mctx.lineWidth = 2;
    mctx.strokeRect(1, 1, mw - 2, mh - 2);
  }

  function drawMirrors() {
    drawMirrorView(rearCtx, rear.width, rear.height, "rear");
    drawMirrorView(leftCtx, leftM.width, leftM.height, "left");
    if (rightCtx) drawMirrorView(rightCtx, rightM.width, rightM.height, "right");
  }

  function nearestRoadDist(x, z) {
    let best = Infinity;
    for (const p of MAP_ROADS) {
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  function drawMinimap() {
    const mw = minimap.width;
    const mh = minimap.height;
    mapCtx.clearRect(0, 0, mw, mh);

    // Gräs
    mapCtx.fillStyle = "#2f552c";
    mapCtx.fillRect(0, 0, mw, mh);

    const scale = 0.48;
    const ox = mw / 2;
    const oy = mh / 2;

    // Oval väg
    mapCtx.strokeStyle = "#3a4048";
    mapCtx.lineWidth = 14;
    mapCtx.beginPath();
    mapCtx.ellipse(ox, oy, 140 * scale, 95 * scale, 0, 0, Math.PI * 2);
    mapCtx.stroke();
    mapCtx.strokeStyle = "#f2f4f7";
    mapCtx.lineWidth = 1.5;
    mapCtx.setLineDash([4, 4]);
    mapCtx.beginPath();
    mapCtx.ellipse(ox, oy, 140 * scale, 95 * scale, 0, 0, Math.PI * 2);
    mapCtx.stroke();
    mapCtx.setLineDash([]);

    // Korsning
    mapCtx.strokeStyle = "#3a4048";
    mapCtx.lineWidth = 12;
    mapCtx.beginPath();
    mapCtx.moveTo(ox - 140 * scale, oy);
    mapCtx.lineTo(ox + 140 * scale, oy);
    mapCtx.moveTo(ox, oy - 95 * scale);
    mapCtx.lineTo(ox, oy + 95 * scale);
    mapCtx.stroke();

    // Andra bilar på kartan (ungefär)
    for (let i = 0; i < state.traffic.length; i += 2) {
      const car = state.traffic[i];
      const ang = ((car.z % 64) / 64) * Math.PI * 2 + state.heading;
      const cx = ox + Math.cos(ang) * 140 * scale * 0.92;
      const cy = oy + Math.sin(ang) * 95 * scale * 0.92;
      mapCtx.fillStyle = car.color;
      mapCtx.fillRect(cx - 2, cy - 2, 4, 4);
    }

    // Spelare
    const px = ox + state.mapX * scale;
    const pz = oy + state.mapZ * scale;
    mapCtx.save();
    mapCtx.translate(px, pz);
    mapCtx.rotate(state.heading);
    mapCtx.fillStyle = "#e81e30";
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 6);
    mapCtx.lineTo(0, 3);
    mapCtx.lineTo(-5, 6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();

    // Ram
    mapCtx.strokeStyle = "rgba(255,255,255,.2)";
    mapCtx.lineWidth = 2;
    mapCtx.strokeRect(1, 1, mw - 2, mh - 2);
  }

  function updatePhysics(dt) {
    if (!(state.engineOn && state.phase === "drive")) {
      if (state.engineOn) setEngineSound();
      return;
    }

    // Can't drive with door open — safety
    if (state.doorAjar) {
      state.speed = Math.max(0, state.speed - 40 * dt);
      hint.textContent = "Stäng dörren innan du kör!";
      setEngineSound();
      return;
    }

    if (!state.belted && state.gear !== "N") {
      state.speed = Math.max(0, state.speed - 40 * dt);
      hint.textContent = "Sätt på bilbältet innan du kör!";
      setEngineSound();
      return;
    }

    const gas = state.input.up;
    const brake = state.input.down;

    if (state.shiftCooldown > 0) state.shiftCooldown -= dt;

    if (state.engineBroken) {
      state.speed = Math.max(0, state.speed - 28 * dt);
      state.rpm = 0;
      setEngineSound();
      hint.textContent = "Motorn är sönder! Tryck Byt motor.";
      return;
    }

    // Maxfart per växel (interna enheter) + acceleration
    // 1:an kan övervarva förbi "säker" fart — sönder vid 75 km/h
    const sport = state.driveMode === "sport";
    const speedMul = sport ? 1.22 : 0.78;
    const accelMul = sport ? 1.45 : 0.62;
    // Interna enheter: km/h = speed * 3.6  →  växel 6 max 300 km/h
    const gearMax = { R: 12, N: 0, 1: 22, 2: 28, 3: 40, 4: 55, 5: 70, 6: 300 / 3.6 };
    const gearSafe = { R: 12, N: 0, 1: 14, 2: 28, 3: 40, 4: 55, 5: 70, 6: 280 / 3.6 };
    const gearAccel = { R: 16, N: 0, 1: 32, 2: 26, 3: 22, 4: 18, 5: 16, 6: 14 };
    const inGear = state.gear !== "N";
    const topMul = state.gear === "6" ? 1 : speedMul;
    const maxForGear = (gearMax[state.gear] || 0) * topMul;
    const safeForGear = (gearSafe[state.gear] || 0) * topMul;
    const baseAccel = (gearAccel[state.gear] || 0) * accelMul;

    let power = 0;
    if (gas && inGear) {
      if (state.gear === "R") {
        const room = Math.max(0.2, 1 - Math.abs(state.speed) / maxForGear);
        power = -baseAccel * room;
      } else {
        const room = Math.max(0.2, 1 - state.speed / Math.max(1, maxForGear));
        power = baseAccel * room;
        // Varningston: slut på "säker" fart i växeln (övervarv)
        if (state.speed > safeForGear) power *= 0.85;
        if (state.speed < 3 && state.gearIndex >= 4) power *= 0.45;
        else if (state.speed < 2 && state.gearIndex >= 3) power *= 0.7;
      }
    }

    const brakeForce = brake ? (sport ? 44 : 18) : 0;
    const drag = 1.2 + Math.abs(state.speed) * 0.04 + (Math.abs(state.playerX) > 0.95 ? 8 : 0);
    // Motorbroms bara när man INTE gasar
    const engineBrake = inGear && !gas ? 2.5 + Math.max(0, state.gearIndex) * 0.55 : 0;

    if (state.gear === "R") {
      const resist = brakeForce + drag + engineBrake;
      if (state.speed < 0) state.speed += (power + resist) * dt; // power är negativ
      else state.speed += (power - resist) * dt;
      state.speed = Math.max(-maxForGear, Math.min(0, state.speed));
    } else if (state.gear === "N") {
      state.speed -= (brakeForce + drag + 1.2) * dt * Math.sign(state.speed || 1);
      if (Math.abs(state.speed) < 0.35) state.speed = 0;
      state.speed = Math.max(0, state.speed);
    } else {
      const resist = brakeForce + drag + engineBrake;
      const prev = state.speed;
      state.speed += (power - resist) * dt;
      // Under gas: tappa inte fart bara för att man växlade upp
      if (gas && inGear && state.speed < prev) {
        state.speed = prev + Math.max(0, (baseAccel * 0.15 - drag) * dt);
      }
      state.speed = Math.max(0, Math.min(maxForGear || 300 / 3.6, state.speed));
    }

    const kmh = Math.abs(state.speed) * 3.6;

    // 1:an i 75 km/h → motorn går sönder
    if (state.gear === "1" && kmh >= 75) {
      breakEngine();
      return;
    }

    // RPM från växel + gas
    if (state.gear === "N") {
      const bounce = gas ? Math.sin(performance.now() / 70) * 380 * state.rev : 0;
      state.rpm = 850 + state.rev * 6500 + bounce;
    } else if (state.gear === "R") {
      state.rpm = 900 + Math.abs(state.speed) * 70 + (gas ? 400 : 0);
    } else {
      const load = safeForGear > 0 ? state.speed / safeForGear : 0;
      state.rpm = Math.min(8000, 900 + load * 5200 + (gas ? 400 : 0));
      if (state.gear === "1" && kmh > 55) {
        hint.textContent = "VARNING! Växla upp (E) — motorn kan gå sönder!";
      }
    }

    let turn = 0;
    if (state.input.left) turn -= 1;
    if (state.input.right) turn += 1;

    const speedFactor = 1 / (1 + state.speed * 0.04);
    const steerGain = sport ? 380 : 180;
    state.steerRate += (turn * steerGain * speedFactor - state.steer * (sport ? 2.2 : 3.4) - state.steerRate * (sport ? 4.5 : 7)) * dt;
    state.steer += state.steerRate * dt;
    state.steer = Math.max(-480, Math.min(480, state.steer));
    if (turn === 0) {
      state.steer *= 1 - Math.min(1, dt * 2.4);
      state.steerRate *= 1 - Math.min(1, dt * 3.5);
    }

    const pull = state.curve * 0.0011 * state.speed;
    state.playerX += (state.steer / 1200) * state.speed * dt * (sport ? 0.5 : 0.22) - pull * dt;
    if (Math.abs(state.playerX) > 1.05) {
      state.speed *= 1 - dt * 0.7;
      state.playerX = Math.sign(state.playerX) * 1.05;
    }

    // Kör runt på kartan: styrning vrider bilen, gas flyttar dig
    const turnRate = (state.steer / 420) * Math.min(1, Math.abs(state.speed) / 8) * 1.8;
    state.heading += turnRate * dt;
    const move = state.speed * dt * 1.15;
    state.mapX += Math.sin(state.heading) * move;
    state.mapZ += Math.cos(state.heading) * move;

    // Gränser
    state.mapX = Math.max(-170, Math.min(170, state.mapX));
    state.mapZ = Math.max(-120, Math.min(120, state.mapZ));

    state.pos += Math.abs(state.speed) * dt * 55;
    state.distance += Math.abs(state.speed) * dt;
    state.fuel = Math.max(0.05, state.fuel - dt * 0.0015 * (0.4 + state.speed / 40));

    const playerSeg = state.pos / SEG_LEN;
    for (const car of state.traffic) {
      car.z += (car.speed * dt * 55) / SEG_LEN;
      let rel = car.z - playerSeg;
      // Håll bilar synliga framför / mötande
      if (car.oncoming) {
        if (rel < -5) {
          car.z = playerSeg + 50 + Math.random() * 90;
          car.x = -0.46;
          car.speed = -(18 + Math.random() * 14);
        }
      } else if (rel < -12 || rel > DRAW_DIST + 10) {
        car.z = playerSeg + 16 + Math.random() * 90;
        car.x = 0.46;
        car.speed = 12 + Math.random() * 28;
        car.oncoming = false;
        car.kind = carKinds[Math.floor(Math.random() * carKinds.length)];
        car.color = carColors[Math.floor(Math.random() * carColors.length)];
      }
    }

    if (state.hitCd > 0) state.hitCd -= dt;
    else if (Math.abs(state.speed) > 2) {
      for (const car of state.traffic) {
        let rel = car.z - playerSeg;
        rel = ((rel % segments.length) + segments.length) % segments.length;
        if (rel > segments.length / 2) rel -= segments.length;
        if (rel > 0.35 && rel < 2.6 && Math.abs(car.x - state.playerX) < 0.2) {
          state.speed *= 0.42;
          state.bump = 1;
          state.hitCd = 0.85;
          playBump();
          hint.textContent = "Krock! Sväng undan och gasa igen.";
          toast("Du körde in i en bil!", 1600);
          break;
        }
      }
    }

    state.blink += dt;
    const blinkOn = Math.floor(state.blink * 3) % 2 === 0;
    blinkL.classList.toggle("on", state.input.left && blinkOn);
    blinkR.classList.toggle("on", state.input.right && blinkOn);
    setEngineSound();

    if (state.gear === "N" && gas) {
      hint.textContent = "REVAR! Släpp gasen och tryck E för 1:an när du vill köra";
    } else if (state.gear === "N" && state.engineOn) {
      hint.textContent = state.hasRevved
        ? "Snygg rev! Tryck E för 1:an, sedan gasa för att köra"
        : "Håll W för att varva motorn";
    } else if (state.rpm > 6200 && state.gearIndex > 0 && state.gearIndex < 6) {
      hint.textContent = "Högt varv! Tryck E för att växla upp";
    } else if (state.gearIndex >= 4 && state.speed < 5 && gas) {
      hint.textContent = "Lite hög växel — Q växlar ner om det känns segt";
    } else if (Math.abs(state.speed) < 2 && !gas) {
      hint.textContent = "W gas · S broms · A/D sväng · E upp · Q ner";
    } else if (state.playerX < 0.05) {
      hint.textContent = "Du är för långt åt vänster — håll dig till höger ▶";
    } else if (state.playerX > 0.85) {
      hint.textContent = "För långt åt höger — sväng lite vänster ◀";
    } else if (state.speed > 8) {
      hint.textContent = "Bra körning! E upp · Q ner";
    }
  }

  function syncGearLabel() {
    if (state.gearIndex === -1) state.gear = "R";
    else if (state.gearIndex === 0) state.gear = "N";
    else state.gear = String(state.gearIndex);

    if (gearEl) gearEl.textContent = state.gear;
    if (shifter) shifter.dataset.gear = state.gear;
    if (gearDisplay) {
      gearDisplay.classList.remove("pulse");
      void gearDisplay.offsetWidth;
      gearDisplay.classList.add("pulse");
    }
  }

  function shiftUp() {
    if (state.phase !== "drive" || !state.engineOn) return;
    if (state.shiftCooldown > 0) return;
    // R -> N -> 1 -> 2 ... 6
    if (state.gearIndex < 6) {
      state.gearIndex += 1;
      state.shiftCooldown = 0.18;
      syncGearLabel();
      toast(`Växel ${state.gear}`, 900);
      flashPaddle("right");
    }
  }

  function shiftDown() {
    if (state.phase !== "drive" || !state.engineOn) return;
    if (state.shiftCooldown > 0) return;
    if (state.speed > 8 && state.gearIndex <= 0) {
      toast("Stanna innan backen (R)");
      return;
    }
    if (state.gearIndex > -1) {
      state.gearIndex -= 1;
      state.shiftCooldown = 0.18;
      syncGearLabel();
      toast(`Växel ${state.gear}`, 900);
      flashPaddle("left");
    }
  }

  function flashPaddle() {
    const el = document.querySelector(".bmw-wheel .hub");
    if (!el) return;
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 150);
  }

  function playBreakSound() {
    ensureAudio();
    if (!audio.ctx) return;
    audio.ctx.resume();
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    const f = audio.ctx.createBiquadFilter();
    o.type = "sawtooth";
    f.type = "bandpass";
    f.frequency.value = 200;
    o.connect(f);
    f.connect(g);
    g.connect(audio.sfx || audio.ctx.destination);
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.start(t);
    o.stop(t + 0.75);
  }

  function breakEngine() {
    if (state.engineBroken) return;
    state.engineBroken = true;
    state.engineOn = false;
    state.rpm = 0;
    state.input.up = false;
    state.input.down = false;
    state.input.left = false;
    state.input.right = false;
    state.holdingEngine = false;
    state.engineSwap = "remove";
    driveNowBtn.hidden = true;
    repairBtn.hidden = false;
    app.classList.add("engine-broken");
    engineLight.classList.add("on");
    playBreakSound();
    if (audio.master && audio.ctx) {
      audio.master.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05);
    }
    hint.textContent = "BOOM! Motorn gick sönder. Tryck Byt motor.";
    toast("Motorn gick sönder! Du måste byta motor.", 4000);
  }

  function openEngineBay() {
    if (!state.engineBroken) return;
    if (state.engineSwap === "idle") state.engineSwap = "remove";
    engineBay.hidden = false;
    syncEngineBayUI();
    hint.textContent = "Ta ur den sönder motorn, ta en ny och sätt i.";
    toast("Öppna huven. Byt motorn.");
  }

  function syncEngineBayUI() {
    const step = state.engineSwap;
    brokenEngine.hidden = step !== "remove";
    engineEmpty.hidden = !(step === "pickNew" || step === "holdNew");
    fittedEngine.hidden = step !== "fitted";
    newEngineBtn.hidden = step !== "pickNew";
    engineDoneBtn.hidden = step !== "fitted";
    engineSlot.classList.toggle("ready", step === "holdNew");
    app.classList.toggle("holding-engine", state.holdingEngine);
    if (heldEngine) heldEngine.hidden = !state.holdingEngine;

    if (step === "remove") {
      engineBayHint.textContent = "Tryck på den sönder motorn för att ta ur den.";
    } else if (step === "pickNew") {
      engineBayHint.textContent = "Bra. Ta nu den nya motorn.";
    } else if (step === "holdNew") {
      engineBayHint.textContent = "Håll den nya motorn och släpp den i motorrummet.";
    } else if (step === "fitted") {
      engineBayHint.textContent = "Ny motor sitter i. Stäng huven.";
    }
  }

  function removeBrokenEngine() {
    if (state.engineSwap !== "remove") return;
    state.engineSwap = "pickNew";
    syncEngineBayUI();
    toast("Du tog ur den sönder motorn.");
    hint.textContent = "Ta den nya motorn.";
  }

  function pickNewEngine(clientX, clientY) {
    if (state.engineSwap !== "pickNew" && state.engineSwap !== "holdNew") return;
    state.holdingEngine = true;
    state.engineSwap = "holdNew";
    syncEngineBayUI();
    moveHeldEngine(clientX ?? window.innerWidth * 0.5, clientY ?? window.innerHeight * 0.55);
    toast("Du håller den nya motorn. Sätt den i motorrummet.");
    hint.textContent = "Dra den nya motorn till det tomma motorrummet.";
  }

  function moveHeldEngine(clientX, clientY) {
    if (!heldEngine || heldEngine.hidden) return;
    heldEngine.style.left = `${clientX}px`;
    heldEngine.style.top = `${clientY}px`;
  }

  function isOverEngineSlot(clientX, clientY) {
    const r = engineSlot.getBoundingClientRect();
    const pad = 20;
    return (
      clientX >= r.left - pad &&
      clientX <= r.right + pad &&
      clientY >= r.top - pad &&
      clientY <= r.bottom + pad
    );
  }

  function fitNewEngine() {
    if (!state.holdingEngine || state.engineSwap !== "holdNew") return;
    state.holdingEngine = false;
    state.engineSwap = "fitted";
    syncEngineBayUI();
    toast("Ny motor sitter i!");
    hint.textContent = "Tryck Klart — stäng huven.";
  }

  function repairEngine() {
    if (!state.engineBroken) return;
    if (state.engineSwap !== "fitted") {
      openEngineBay();
      return;
    }
    state.engineBroken = false;
    state.keyInIgnition = false;
    state.holdingKey = false;
    state.holdingEngine = false;
    state.engineOn = false;
    state.speed = 0;
    state.rpm = 0;
    state.gearIndex = 0;
    state.engineSwap = "idle";
    syncGearLabel();
    repairBtn.hidden = true;
    engineBay.hidden = true;
    if (heldEngine) heldEngine.hidden = true;
    app.classList.remove("engine-broken");
    app.classList.remove("holding-engine");
    engineLight.classList.remove("on");
    keyBtn.disabled = false;
    keyCaption.textContent = "Ta upp bilnyckel";
    updateKeyholeUI();
    driveNowBtn.hidden = true;
    hint.textContent = "Motor bytt! Ta upp nyckeln och starta igen.";
    toast("Du bytte motorn! Starta bilen igen.");
  }

  function updateUI() {
    if (!state.inside) return;
    const kmh = Math.round(Math.abs(state.speed) * 3.6);
    speedEl.textContent = String(kmh);
    steering.style.transform = `rotate(${state.steer * 0.2}deg)`;
    const rpmAngle = -120 + Math.min(240, (state.rpm / 8000) * 240);
    rpmNeedle.setAttribute("transform", `rotate(${rpmAngle} 50 50)`);
    const fuelAngle = -110 + state.fuel * 220;
    fuelNeedle.setAttribute("transform", `rotate(${fuelAngle} 50 50)`);
    engineLight.classList.toggle("on", state.engineBroken || (state.engineOn && state.rpm > 4200));
    app.classList.toggle("engine-on", state.engineOn);
  }

  function render() {
    if (!state.inside || viewport.hidden) return;
    const r = canvas.parentElement.getBoundingClientRect();
    drawRoad(r.width, r.height);
    drawMirrors();
    drawMinimap();
  }

  function showCabinControls() {
    beltStation.hidden = false;
    keyBtn.hidden = false;
    keyBtn.disabled = false;
    keyholeWrap.hidden = false;
    driveNowBtn.hidden = true;
    updateBeltUI();
    updateKeyholeUI();
  }

  /** Ett klick: stäng dörr, bälte, nyckel, start, 1:an — så man kan köra direkt */
  function driveNow() {
    if (!state.inside) {
      toast("Sätt dig i bilen först!");
      return;
    }
    if (state.engineBroken) {
      toast("Motorn är sönder — laga den först!");
      repairBtn.hidden = false;
      return;
    }

    ensureAudio();
    audio.ctx?.resume();

    if (state.doorAjar) {
      state.doorAjar = false;
      playDoorSound(false);
      doorOverlay.hidden = true;
      innerDoorBtn.textContent = "Öppna dörr";
      innerDoorBtn.classList.remove("warn");
    }

    state.belted = true;
    state.holdingKey = false;
    state.keyInIgnition = true;
    state.engineOn = true;
    state.speed = 0;
    state.gearIndex = 1;
    state.phase = "drive";
    syncGearLabel();
    updateBeltUI();
    updateKeyholeUI();
    updateExitButton();

    keyBtn.hidden = false;
    keyBtn.disabled = true;
    keyCaption.textContent = "I nyckelhålet";
    keyholeWrap.hidden = false;
    beltStation.hidden = false;
    driveNowBtn.hidden = true;

    setEngineSound();
    hint.textContent = "W gas · A/D sväng · E upp · Q ner";
    toast("Du kör! Tryck gas ▲ eller W", 3500);
  }

  function updateBeltUI() {
    belt.hidden = state.belted;
    unbelt.hidden = !state.belted;
    buckle.classList.toggle("show", true);
    buckle.classList.toggle("locked", state.belted);
    const beltVis = document.getElementById("seatbeltVisual");
    if (beltVis) beltVis.hidden = !state.belted;
  }

  function updateKeyholeUI() {
    keyholeWrap.hidden = false;
    slot.classList.toggle("ready", state.holdingKey && !state.keyInIgnition);
    slot.classList.toggle("turned", state.keyInIgnition);
    keyInHole.hidden = !state.keyInIgnition;
    keyOut.hidden = !state.keyInIgnition;
    app.classList.toggle("holding-key", state.holdingKey && !state.keyInIgnition);
    keyBtn.classList.toggle("holding-empty", state.holdingKey && !state.keyInIgnition);
    if (heldKey) heldKey.hidden = !(state.holdingKey && !state.keyInIgnition);
    if (state.keyInIgnition) {
      keyholeLabel.textContent = "Nyckel i tändningen";
    } else if (state.holdingKey) {
      keyholeLabel.textContent = "Släpp nyckeln här";
    } else {
      keyholeLabel.textContent = "Nyckelhål";
    }
  }

  function moveHeldKey(clientX, clientY) {
    if (!heldKey || heldKey.hidden) return;
    heldKey.style.left = `${clientX}px`;
    heldKey.style.top = `${clientY}px`;
  }

  function isOverKeyhole(clientX, clientY) {
    const r = slot.getBoundingClientRect();
    const pad = 18;
    return (
      clientX >= r.left - pad &&
      clientX <= r.right + pad &&
      clientY >= r.top - pad &&
      clientY <= r.bottom + pad
    );
  }

  function pickUpKey(clientX, clientY) {
    if (state.doorAjar) {
      toast("Stäng dörren först!");
      return;
    }
    if (state.keyInIgnition) return;
    if (!(state.phase === "ready" || state.phase === "pickup" || state.phase === "keyOut" || state.phase === "insert" || state.phase === "belt" || state.phase === "drive")) {
      return;
    }
    if (state.holdingKey) return;

    ensureAudio();
    audio.ctx?.resume();
    state.holdingKey = true;
    if (!state.engineOn) state.phase = "insert";
    keyBtn.disabled = false;
    keyBtn.classList.remove("guide");
    keyCaption.textContent = "Håller";
    updateKeyholeUI();
    const x = clientX ?? window.innerWidth * 0.55;
    const y = clientY ?? window.innerHeight * 0.72;
    moveHeldKey(x, y);
    hint.textContent = "Håll nyckeln och dra den till nyckelhålet";
    toast("Du håller bilnyckeln. Dra den till nyckelhålet.");
  }

  function startEngine() {
    if (state.doorAjar) {
      toast("Stäng dörren innan du startar!");
      return;
    }
    if (state.engineBroken) {
      toast("Motorn är sönder — laga den först!");
      repairBtn.hidden = false;
      return;
    }
    if (!state.holdingKey || state.keyInIgnition) {
      if (!state.holdingKey && !state.keyInIgnition) toast("Ta upp nyckeln först!");
      return;
    }

    ensureAudio();
    audio.ctx?.resume();
    playStarter();
    state.engineOn = true;
    state.holdingKey = false;
    state.keyInIgnition = true;
    state.gearIndex = 0;
    state.phase = "drive";
    state.rpm = 850;
    syncGearLabel();
    keyCaption.textContent = "I nyckelhålet";
    keyBtn.disabled = true;
    keyBtn.classList.remove("guide");
    keyBtn.classList.remove("holding-empty");
    if (heldKey) heldKey.hidden = true;
    app.classList.remove("holding-key");
    updateKeyholeUI();
    driveNowBtn.hidden = true;
    beltStation.hidden = false;
    updateBeltUI();
    setEngineSound();
    hint.textContent = "Motorn är igång! Håll W för att varva";
    toast("Du satte i nyckeln. Håll W för att varva!", 3200);
  }

  function playStarter() {
    ensureAudio();
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      const f = audio.ctx.createBiquadFilter();
      o.type = "sawtooth";
      f.type = "lowpass";
      f.frequency.value = 260;
      o.connect(f);
      f.connect(g);
      g.connect(audio.sfx || audio.ctx.destination);
      const start = t + i * 0.13;
      o.frequency.setValueAtTime(32 + i * 7, start);
      o.frequency.linearRampToValueAtTime(86 + i * 9, start + 0.1);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.22, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      o.start(start);
      o.stop(start + 0.13);
    }
  }

  function updateRev(dt) {
    const canRev = state.engineOn && !state.engineBroken && state.phase === "drive";
    const flooring = canRev && state.input.up;
    const target = flooring ? (state.gear === "N" ? 1 : 0.28) : 0;
    const rate = state.driveMode === "sport"
      ? (target > state.rev ? 10 : 5)
      : (target > state.rev ? 2.6 : 1.6);
    state.rev += (target - state.rev) * Math.min(1, dt * rate);
    if (state.rev < 0.01) state.rev = 0;
    if (state.bump > 0) state.bump = Math.max(0, state.bump - dt * 1.7);
    if (state.gear === "N" && state.rev > 0.7) state.hasRevved = true;

    const shaking = state.gear === "N" && state.rev > 0.2;
    app.classList.toggle("revving", shaking);
    if (revExhaust) revExhaust.hidden = !shaking;
  }

  function takeOutKey() {
    if (!state.keyInIgnition) return;
    if (state.speed > 1.5) {
      toast("Stanna bilen innan du tar ut nyckeln!");
      return;
    }

    state.engineOn = false;
    state.keyInIgnition = false;
    state.holdingKey = true;
    state.speed = 0;
    state.rpm = 0;
    state.gearIndex = 0;
    syncGearLabel();
    state.phase = "keyOut";
    state.input.up = false;
    state.input.down = false;
    state.input.left = false;
    state.input.right = false;

    keyBtn.disabled = false;
    keyCaption.textContent = "Håller — lägg undan?";
    updateKeyholeUI();
    moveHeldKey(window.innerWidth * 0.55, window.innerHeight * 0.72);
    updateKeyholeUI();
    updateExitButton();
    setEngineSound();
    if (audio.master && audio.ctx) {
      audio.master.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05);
    }

    hint.textContent = "Nyckeln är ute. Lägg undan den, öppna dörren och gå ur.";
    toast("Du tog ut nyckeln ur nyckelhålet. Motorn är av.");
  }

  function putKeyAway() {
    if (state.phase !== "keyOut" || !state.holdingKey) return;
    state.holdingKey = false;
    state.phase = "ready";
    keyCaption.textContent = "Ta upp bilnyckel";
    keyBtn.disabled = false;
    updateKeyholeUI();
    updateExitButton();
    hint.textContent = state.doorAjar
      ? "Öppna är klart — ta av bältet om det sitter på, sedan Gå ur bilen."
      : "Nyckeln är undanlagd. Ta upp den när du vill köra.";
    toast("Nyckeln ligger undan.");
  }

  function putBelt() {
    if (state.doorAjar) {
      toast("Stäng dörren först!");
      return;
    }
    if (state.belted) return;

    state.belted = true;
    updateBeltUI();
    toast("Klick! Bilbältet sitter på.");

    if (state.engineOn && state.keyInIgnition) {
      state.phase = "drive";
      if (state.gearIndex <= 0) state.gearIndex = 1;
      syncGearLabel();
      driveNowBtn.hidden = true;
      hint.textContent = "W gas · S broms · A/D sväng · E upp · Q ner";
    } else {
      driveNowBtn.hidden = false;
      hint.textContent = "Bra! Ta upp nyckeln och sätt i — eller KÖR NU";
    }
  }

  function removeBelt() {
    if (!state.belted) return;
    if (state.speed > 1) {
      toast("Stanna innan du tar av bilbältet!");
      return;
    }
    state.belted = false;
    updateBeltUI();
    updateExitButton();
    if (state.phase === "drive") {
      state.phase = "belt";
      hint.textContent = "Sätt på bilbältet igen innan du kör";
    } else if (state.doorAjar && !state.engineOn) {
      hint.textContent = "Bältet är av — tryck Gå ur bilen";
    }
    toast("Bilbältet är av.");
  }

  function setDriveMode(mode, announce = true) {
    state.driveMode = mode === "sport" ? "sport" : "comfort";
    const sport = state.driveMode === "sport";
    modeComfortBtn.classList.toggle("on", !sport);
    modeSportBtn.classList.toggle("on", sport);
    modeComfortBtn.setAttribute("aria-pressed", String(!sport));
    modeSportBtn.setAttribute("aria-pressed", String(sport));
    app.classList.toggle("mode-sport", sport);
    app.classList.toggle("mode-comfort", !sport);
    if (announce && state.inside) {
      hint.textContent = sport
        ? "Sportläge: snabb gas, vass styrning, högt ljud"
        : "Komfortläge: mjuk gas, lugn styrning, tystare";
      toast(sport ? "Sportläge på" : "Komfortläge på", 1600);
    }
  }

  function setInput(dir, on) {
    if (state.phase !== "drive") return;
    if (dir in state.input) state.input[dir] = on;
  }

  driverDoor.addEventListener("click", openDriverDoor);
  passengerDoor.addEventListener("click", openPassengerDoor);
  enterCar.addEventListener("click", sitInCar);
  closeDoorOutside.addEventListener("click", closeDriverOutside);
  innerDoorBtn.addEventListener("click", toggleInnerDoor);
  exitCarBtn.addEventListener("click", exitCar);
  driveNowBtn.addEventListener("click", driveNow);
  modeComfortBtn.addEventListener("click", () => setDriveMode("comfort"));
  modeSportBtn.addEventListener("click", () => setDriveMode("sport"));
  repairBtn.addEventListener("click", () => {
    if (state.engineSwap === "fitted") repairEngine();
    else openEngineBay();
  });
  engineSlot.addEventListener("click", () => {
    if (state.engineSwap === "remove") removeBrokenEngine();
    else if (state.engineSwap === "holdNew") fitNewEngine();
  });
  engineSlot.addEventListener("pointerup", (e) => {
    if (state.holdingEngine && state.engineSwap === "holdNew") {
      e.preventDefault();
      fitNewEngine();
    }
  });
  newEngineBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try { newEngineBtn.setPointerCapture(e.pointerId); } catch (_) {}
    pickNewEngine(e.clientX, e.clientY);
  });
  newEngineBtn.addEventListener("click", (e) => {
    if (!state.holdingEngine) pickNewEngine(e.clientX, e.clientY);
  });
  engineDoneBtn.addEventListener("click", repairEngine);

  keyBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (state.phase === "keyOut" && state.holdingKey) {
      putKeyAway();
      return;
    }
    if (state.holdingKey) return;
    try { keyBtn.setPointerCapture(e.pointerId); } catch (_) {}
    pickUpKey(e.clientX, e.clientY);
  });
  keyBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (state.phase === "keyOut" && state.holdingKey) putKeyAway();
    else if (!state.holdingKey && !state.keyInIgnition) pickUpKey(e.clientX, e.clientY);
  });

  window.addEventListener("pointermove", (e) => {
    if (state.holdingEngine) moveHeldEngine(e.clientX, e.clientY);
    if (state.holdingKey && !state.keyInIgnition) moveHeldKey(e.clientX, e.clientY);
  });

  window.addEventListener("pointerup", (e) => {
    if (state.holdingEngine && state.engineSwap === "holdNew") {
      moveHeldEngine(e.clientX, e.clientY);
      if (isOverEngineSlot(e.clientX, e.clientY)) fitNewEngine();
    }
    if (state.holdingKey && !state.keyInIgnition) {
      moveHeldKey(e.clientX, e.clientY);
      if (isOverKeyhole(e.clientX, e.clientY)) startEngine();
    }
  });

  slot.addEventListener("click", startEngine);
  slot.addEventListener("pointerup", (e) => {
    e.preventDefault();
    if (state.holdingKey && !state.keyInIgnition) startEngine();
  });
  keyOut.addEventListener("click", takeOutKey);
  belt.addEventListener("click", putBelt);
  unbelt.addEventListener("click", removeBelt);

  const map = {
    ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
    a: "left", d: "right", w: "up", s: "down",
  };
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "e") {
      e.preventDefault();
      if (!e.repeat) shiftUp();
      return;
    }
    if (k === "q") {
      e.preventDefault();
      if (!e.repeat) shiftDown();
      return;
    }
    const d = map[e.key] || map[k];
    if (!d) return;
    e.preventDefault();
    setInput(d, true);
  });
  window.addEventListener("keyup", (e) => {
    const d = map[e.key] || map[e.key.toLowerCase()];
    if (!d) return;
    e.preventDefault();
    setInput(d, false);
  });

  window.addEventListener("resize", resize);

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state.inside) {
      updateRev(dt);
      updatePhysics(dt);
      updateUI();
      render();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function beginInside() {
    state.inside = true;
    state.doorAjar = false;
    state.driverOpen = false;
    state.passengerOpen = false;
    state.phase = "ready";
    state.belted = true;
    state.holdingKey = false;
    state.keyInIgnition = false;
    state.engineOn = false;
    state.gearIndex = 0;

    app.classList.remove("outside");
    exterior.hidden = true;
    viewport.hidden = false;
    cockpit.hidden = false;
    doorOverlay.hidden = true;
    innerDoorBtn.textContent = "Öppna dörr";
    innerDoorBtn.classList.remove("warn");
    driveNowBtn.hidden = true;

    showCabinControls();
    beltStation.hidden = false;
    keyBtn.hidden = false;
    keyBtn.disabled = false;
    keyBtn.classList.add("guide");
    keyCaption.textContent = "Ta upp";
    keyholeWrap.hidden = false;
    syncGearLabel();
    updateBeltUI();
    updateKeyholeUI();
    updateExitButton();
    hint.textContent = "Du sitter i bilen. Ta upp nyckeln och sätt den i nyckelhålet.";
    resize();
    requestAnimationFrame(resize);
  }

  // —— Bilskärm + mobil (TikTok, YouTube, Bluetooth, Inställningar) ——
  const phoneScreen = document.getElementById("phoneScreen");
  const openPhoneBtn = document.getElementById("openPhone");
  const pickPhoneBtn = document.getElementById("pickPhone");
  const closePhoneBtn = document.getElementById("closePhone");
  const phoneHome = document.getElementById("phoneHome");
  const phoneAppView = document.getElementById("phoneAppView");
  const phoneAppBody = document.getElementById("phoneAppBody");
  const phoneBack = document.getElementById("phoneBack");
  const phoneTitle = document.getElementById("phoneTitle");
  const phoneClock = document.getElementById("phoneClock");
  const phoneBtBadge = document.getElementById("phoneBtBadge");
  const screenTime = document.getElementById("screenTime");
  const screenBt = document.getElementById("screenBt");
  const screenHome = document.getElementById("screenHome");
  const screenApp = document.getElementById("screenApp");
  const screenAppBody = document.getElementById("screenAppBody");
  const screenAppTitle = document.getElementById("screenAppTitle");
  const screenBack = document.getElementById("screenBack");
  const screenGlass = document.getElementById("screenGlass");

  const mediaState = {
    phoneOut: false,
    phoneBtOn: false,
    carBtOn: true,
    connected: false,
    btScanning: false,
    btPairing: false,
    btPin: "4821",
    phoneBattery: 78,
    volume: 70,
    brightness: 80,
    ttIndex: 0,
    ttLiked: {},
    ytId: "jfKfPfyJRdk",
    musicIndex: 0,
    musicPlaying: false,
    radioIndex: 0,
    radioOn: false,
    googleQ: "",
    snapFacing: "user",
    snapStream: null,
    snapPhoto: null,
  };

  const YT_PRESETS = [
    { id: "jfKfPfyJRdk", title: "Lofi beats — live" },
    { id: "5qap5aO4i9A", title: "Chill hop radio" },
    { id: "DWcJFNf70Ic", title: "Night drive mix" },
    { id: "4xDzrJKXOOY", title: "Synthwave radio" },
  ];

  const MUSIC_TRACKS = [
    { title: "Night Drive", artist: "Nermin Beats", emoji: "🌙", id: "jfKfPfyJRdk" },
    { title: "Asphalt Dreams", artist: "Garage Mix", emoji: "🏎️", id: "5qap5aO4i9A" },
    { title: "Redline", artist: "Sportläge", emoji: "🔥", id: "4xDzrJKXOOY" },
    { title: "City Lights", artist: "Highway FM", emoji: "🌃", id: "DWcJFNf70Ic" },
  ];

  const RADIO_STATIONS = [
    { name: "P3 Väg", freq: "99.3", id: "jfKfPfyJRdk", vibe: "Pop & hits" },
    { name: "Nermin FM", freq: "102.7", id: "5qap5aO4i9A", vibe: "Chill hop" },
    { name: "Sport Radio", freq: "105.1", id: "4xDzrJKXOOY", vibe: "Synthwave" },
    { name: "Night Cruise", freq: "88.9", id: "DWcJFNf70Ic", vibe: "Night drive" },
  ];

  // YouTube-klipp (fungerar) + lokal fallback-video om iframe blockeras
  const TIKTOK_CLIPS = [
    {
      user: "@nermin_drives",
      cap: "När 1:an går sönder vid 75 km/h 💀 #bil #pov",
      music: "♪ Engine Fail — Nermin Beats",
      likes: "12.4K",
      comments: "842",
      shares: "1.1K",
      yt: "aqz-KE-bpKQ",
      src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    },
    {
      user: "@asphalt_kid",
      cap: "POV: du glömde bilbältet 😬 #körning",
      music: "♪ Seatbelt Check — RoadTape",
      likes: "48.2K",
      comments: "3.2K",
      shares: "9.4K",
      yt: "ScMzIvxBSi4",
      src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
    },
    {
      user: "@sportlage",
      cap: "W W W — sedan E till 6:an 🔥 #sportläge",
      music: "♪ Redline — GarageMix",
      likes: "91K",
      comments: "5.6K",
      shares: "22K",
      yt: "dQw4w9WgXcQ",
      src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    },
    {
      user: "@night_highway",
      cap: "Midnattsrace på E4 🌙 #nightdrive",
      music: "♪ Midnight Cruise — Lofi Road",
      likes: "33.1K",
      comments: "1.9K",
      shares: "4.2K",
      yt: "lXKb8nTywMw",
      src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    },
    {
      user: "@byt_motor",
      cap: "Byt motor på 8 sekunder 🛠️ #mekaniker",
      music: "♪ Workshop — ToolKit",
      likes: "67K",
      comments: "4.1K",
      shares: "11K",
      yt: "M7lc1UVf-VE",
      src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    },
  ];

  const BT_NEARBY = [
    { id: "car", name: "Nermin Sportbil", type: "Bilstereo", sig: "▂▄▆█", primary: true },
    { id: "buds", name: "AirPods Pro", type: "Hörlurar", sig: "▂▄▆░" },
    { id: "watch", name: "Galaxy Watch", type: "Klocka", sig: "▂▄░░" },
    { id: "speaker", name: "JBL Flip 6", type: "Högtalare", sig: "▂░░░" },
  ];

  const GOOGLE_SUGGEST = [
    "väder stockholm",
    "kortaste vägen till ica",
    "hur byter man bilmotor",
    "tiktok bil trends",
    "nermin bilspel",
  ];

  const SNAP_FRIENDS = [
    { name: "Alex", av: "🏎️" },
    { name: "Mia", av: "😎" },
    { name: "Kim", av: "🎧" },
    { name: "Sam", av: "🔥" },
    { name: "Add", av: "+" },
  ];

  function tickClocks() {
    const d = new Date();
    const t = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    if (phoneClock) phoneClock.textContent = t;
    if (screenTime) screenTime.textContent = t;
  }

  function syncBtUi() {
    if (screenBt) {
      screenBt.textContent = mediaState.connected ? "BT mobil" : mediaState.carBtOn ? "BT på" : "BT av";
      screenBt.classList.toggle("on", mediaState.connected || mediaState.carBtOn);
    }
    if (phoneBtBadge) {
      phoneBtBadge.textContent = mediaState.connected ? "BT bil" : mediaState.phoneBtOn ? "BT på" : "BT av";
      phoneBtBadge.classList.toggle("on", mediaState.connected || mediaState.phoneBtOn);
    }
    if (pickPhoneBtn) {
      pickPhoneBtn.classList.toggle("on", mediaState.phoneOut);
      pickPhoneBtn.textContent = mediaState.phoneOut ? "Mobil uppe" : "Ta upp mobil";
    }
    if (screenGlass) screenGlass.style.filter = `brightness(${0.55 + mediaState.brightness / 200})`;
  }

  function playTone(freq = 440, dur = 0.15) {
    ensureAudio();
    if (!audio.ctx) return;
    audio.ctx.resume();
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    o.connect(g);
    g.connect(audio.sfx || audio.ctx.destination);
    const t = audio.ctx.currentTime;
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function connectPhoneToCar(opts = {}) {
    const { silent = false, skipPair = false } = opts;
    if (!mediaState.phoneOut) {
      if (!silent) toast("Ta upp mobilen först!");
      return false;
    }
    if (!mediaState.phoneBtOn) {
      if (!silent) toast("Slå på Bluetooth på mobilen först!");
      return false;
    }
    if (!mediaState.carBtOn) {
      if (!silent) toast("Slå på Bluetooth i bilen först!");
      return false;
    }
    if (mediaState.connected) return true;

    if (!skipPair && !mediaState.btPairing) {
      mediaState.btPairing = true;
      mediaState.btPin = String(1000 + Math.floor(Math.random() * 9000));
      playTone(520, 0.1);
      if (!silent) toast("Bekräfta PIN på båda enheterna…", 2000);
      return "pairing";
    }

    mediaState.btPairing = false;
    mediaState.btScanning = false;
    mediaState.connected = true;
    syncBtUi();
    playTone(720, 0.18);
    playTone(880, 0.12);
    if (!silent) {
      toast("Ansluten: Media + samtal via Bluetooth", 2800);
      hint.textContent = "Bluetooth ansluten — TikTok, YouTube, Snapchat & Google på bilskärmen.";
    }
    return true;
  }

  function confirmBtPair() {
    mediaState.btPairing = false;
    return connectPhoneToCar({ skipPair: true });
  }

  function cancelBtPair() {
    mediaState.btPairing = false;
    toast("Parkoppling avbruten", 1200);
  }

  function disconnectBt() {
    mediaState.connected = false;
    mediaState.btPairing = false;
    mediaState.btScanning = false;
    syncBtUi();
    toast("Bluetooth frånkopplad", 1400);
  }

  function startBtScan(onDone) {
    if (!mediaState.phoneBtOn && !mediaState.carBtOn) {
      toast("Slå på Bluetooth först");
      return;
    }
    mediaState.btScanning = true;
    playTone(400, 0.08);
    setTimeout(() => {
      mediaState.btScanning = false;
      onDone?.();
    }, 1600);
  }

  function stopSnapCamera() {
    if (mediaState.snapStream) {
      mediaState.snapStream.getTracks().forEach((t) => t.stop());
      mediaState.snapStream = null;
    }
  }

  function showPhoneHome() {
    if (!phoneHome) return;
    stopSnapCamera();
    phoneHome.hidden = false;
    phoneAppView.hidden = true;
    phoneTitle.textContent = "Din mobil";
    phoneAppBody.innerHTML = "";
  }

  function openPhone() {
    if (!phoneScreen) return;
    mediaState.phoneOut = true;
    tickClocks();
    showPhoneHome();
    phoneScreen.hidden = false;
    syncBtUi();
    toast("Du håller mobilen. Öppna Bluetooth och anslut till bilen.");
  }

  function closePhone() {
    if (!phoneScreen) return;
    stopSnapCamera();
    phoneScreen.hidden = true;
    showPhoneHome();
    syncBtUi();
  }

  function putPhoneAway() {
    if (mediaState.connected) disconnectBt();
    mediaState.phoneOut = false;
    closePhone();
    syncBtUi();
    toast("Mobilen ligger undan.");
  }

  function ytEmbedHtml(videoId, tall = false, autoplay = false) {
    const h = tall ? "max-height:220px;aspect-ratio:16/9" : "";
    const ap = autoplay ? "&autoplay=1&mute=1" : "";
    return `<div class="yt-embed" style="${h}"><iframe src="https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1${ap}" title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  }

  function tiktokHtml(forPhone = false) {
    const i = mediaState.ttIndex % TIKTOK_CLIPS.length;
    const clip = TIKTOK_CLIPS[i];
    const liked = !!mediaState.ttLiked[i];
    const ytSrc = `https://www.youtube-nocookie.com/embed/${clip.yt}?rel=0&modestbranding=1&autoplay=1&mute=1&playsinline=1&loop=1&playlist=${clip.yt}`;
    return `
      <div class="tt-feed${forPhone ? "" : " car"}" id="ttFeed">
        <div class="tt-fallback">Laddar klipp…</div>
        <iframe id="ttFrame" src="${ytSrc}" title="TikTok" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
        <video id="ttVideo" src="${clip.src}" muted loop playsinline hidden></video>
        <div class="tt-side">
          <button type="button" id="ttLike"><span class="tt-ico">${liked ? "❤" : "♡"}</span>${liked ? "Dig" : clip.likes}</button>
          <button type="button" id="ttComment"><span class="tt-ico">💬</span>${clip.comments}</button>
          <button type="button" id="ttShare"><span class="tt-ico">↗</span>${clip.shares}</button>
        </div>
        <div class="tt-overlay">
          <p class="tt-user">${clip.user}</p>
          <p class="tt-cap">${clip.cap}</p>
          <p class="tt-music">${clip.music}</p>
        </div>
      </div>
      <div class="tt-actions">
        <button type="button" class="phone-action" id="ttPlay">Spela / ljud</button>
        <button type="button" class="phone-action" id="ttNext">Nästa</button>
        <button type="button" class="phone-action secondary" id="ttPrev">Förra</button>
      </div>`;
  }

  function wireTikTok(root, reopen) {
    const frame = root.querySelector("#ttFrame");
    const video = root.querySelector("#ttVideo");
    const fallback = root.querySelector(".tt-fallback");

    const showVideoFallback = () => {
      if (!video) return;
      if (frame) frame.hidden = true;
      video.hidden = false;
      video.muted = true;
      video.play?.().catch(() => {});
      if (fallback) fallback.textContent = "Video";
    };

    // Om YouTube inte syns efter en stund → visa MP4-fallback
    setTimeout(() => {
      if (!root.isConnected) return;
      if (frame && !frame.hidden) {
        // iframe finns — dölj "Laddar"
        if (fallback) fallback.style.display = "none";
      }
    }, 900);

    frame?.addEventListener("error", showVideoFallback);
    video?.addEventListener("loadeddata", () => {
      if (fallback) fallback.style.display = "none";
    });
    video?.addEventListener("error", () => {
      if (fallback) fallback.textContent = "Tryck Spela";
    });

    root.querySelector("#ttPlay")?.addEventListener("click", () => {
      if (frame && !frame.hidden) {
        // Byt till video med ljud (användar-gest)
        showVideoFallback();
        if (video) {
          video.muted = false;
          video.play?.().catch(() => showVideoFallback());
        }
        toast("Spelar klipp", 1000);
        return;
      }
      if (video) {
        video.muted = !video.muted;
        video.play?.().catch(() => {});
        toast(video.muted ? "Tyst" : "Ljud på", 900);
      }
    });

    root.querySelector("#ttNext")?.addEventListener("click", () => {
      mediaState.ttIndex = (mediaState.ttIndex + 1) % TIKTOK_CLIPS.length;
      reopen();
    });
    root.querySelector("#ttPrev")?.addEventListener("click", () => {
      mediaState.ttIndex = (mediaState.ttIndex - 1 + TIKTOK_CLIPS.length) % TIKTOK_CLIPS.length;
      reopen();
    });
    root.querySelector("#ttLike")?.addEventListener("click", () => {
      const i = mediaState.ttIndex % TIKTOK_CLIPS.length;
      mediaState.ttLiked[i] = !mediaState.ttLiked[i];
      playTone(mediaState.ttLiked[i] ? 660 : 320, 0.08);
      reopen();
    });
    root.querySelector("#ttComment")?.addEventListener("click", () => toast("Kommentarer — skriv något snart!", 1400));
    root.querySelector("#ttShare")?.addEventListener("click", () => {
      playTone(500, 0.1);
      toast(mediaState.connected ? "Delat till bilskärmen via BT" : "Delat med vänner", 1600);
    });
  }

  function musicHtml() {
    const t = MUSIC_TRACKS[mediaState.musicIndex % MUSIC_TRACKS.length];
    return `
      <div class="music-now">
        <div class="music-art">${t.emoji}</div>
        <h3>${t.title}</h3>
        <p class="artist">${t.artist}</p>
        ${mediaState.musicPlaying ? ytEmbedHtml(t.id, true, true) : ""}
        <div class="music-controls">
          <button type="button" class="phone-action secondary" id="musicPrev">⏮</button>
          <button type="button" class="phone-action" id="musicPlay">${mediaState.musicPlaying ? "Pausa" : "Spela"}</button>
          <button type="button" class="phone-action secondary" id="musicNext">⏭</button>
        </div>
      </div>
      <div class="phone-list" id="musicList"></div>`;
  }

  function wireMusic(root, reopen) {
    root.querySelector("#musicPlay")?.addEventListener("click", () => {
      mediaState.musicPlaying = !mediaState.musicPlaying;
      if (mediaState.musicPlaying) mediaState.radioOn = false;
      playTone(mediaState.musicPlaying ? 520 : 300, 0.1);
      reopen();
    });
    root.querySelector("#musicPrev")?.addEventListener("click", () => {
      mediaState.musicIndex = (mediaState.musicIndex - 1 + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
      mediaState.musicPlaying = true;
      mediaState.radioOn = false;
      reopen();
    });
    root.querySelector("#musicNext")?.addEventListener("click", () => {
      mediaState.musicIndex = (mediaState.musicIndex + 1) % MUSIC_TRACKS.length;
      mediaState.musicPlaying = true;
      mediaState.radioOn = false;
      reopen();
    });
    const list = root.querySelector("#musicList");
    MUSIC_TRACKS.forEach((track, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "phone-row" + (idx === mediaState.musicIndex ? " on" : "");
      b.innerHTML = `<span>${track.emoji} ${track.title}</span><span class="meta">${track.artist}</span>`;
      b.addEventListener("click", () => {
        mediaState.musicIndex = idx;
        mediaState.musicPlaying = true;
        mediaState.radioOn = false;
        reopen();
      });
      list?.appendChild(b);
    });
  }

  function radioHtml() {
    const s = RADIO_STATIONS[mediaState.radioIndex % RADIO_STATIONS.length];
    return `
      <div class="radio-dial">
        <div class="radio-freq">${s.freq} FM</div>
        <div class="radio-wave${mediaState.radioOn ? " on" : ""}"></div>
        <strong>${s.name}</strong>
        <p style="margin:.25rem 0 0;opacity:.7;font-size:.75rem">${s.vibe}</p>
        ${mediaState.radioOn ? ytEmbedHtml(s.id, true, true) : ""}
        <button type="button" class="phone-action" id="radioToggle" style="margin-top:.55rem">${mediaState.radioOn ? "Stäng av" : "Slå på radio"}</button>
      </div>
      <div class="phone-list" id="radioList"></div>`;
  }

  function wireRadio(root, reopen) {
    root.querySelector("#radioToggle")?.addEventListener("click", () => {
      mediaState.radioOn = !mediaState.radioOn;
      if (mediaState.radioOn) mediaState.musicPlaying = false;
      playTone(mediaState.radioOn ? 440 : 280, 0.12);
      toast(mediaState.radioOn ? `Lyssnar på ${RADIO_STATIONS[mediaState.radioIndex].name}` : "Radio av", 1400);
      reopen();
    });
    const list = root.querySelector("#radioList");
    RADIO_STATIONS.forEach((st, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "phone-row" + (idx === mediaState.radioIndex ? " on" : "");
      b.innerHTML = `<span>${st.freq} · ${st.name}</span><span class="meta">${st.vibe}</span>`;
      b.addEventListener("click", () => {
        mediaState.radioIndex = idx;
        mediaState.radioOn = true;
        mediaState.musicPlaying = false;
        reopen();
      });
      list?.appendChild(b);
    });
  }

  function googleHtml(compact = false) {
    const q = mediaState.googleQ;
    const results = q
      ? [
          { title: `${q} — Wikipedia`, url: `sv.wikipedia.org/wiki/${encodeURIComponent(q)}`, snip: `Läs mer om ${q}. Öppna i webbläsaren.` },
          { title: `Kartor: ${q}`, url: `maps.google.com/search/${encodeURIComponent(q)}`, snip: "Hitta vägbeskrivning och trafik." },
          { title: `YouTube: ${q}`, url: `youtube.com/results?search_query=${encodeURIComponent(q)}`, snip: "Videor och livesändningar." },
        ]
      : [];
    return `
      <div class="g-search">
        <div class="g-logo"><span class="b">G</span><span class="r">o</span><span class="y">o</span><span class="b">g</span><span class="g2">l</span><span class="r">e</span></div>
        <div class="g-bar">
          <input id="gInput" type="search" placeholder="Sök på Google" value="${q.replace(/"/g, "&quot;")}" autocomplete="off" />
          <button type="button" id="gGo">Sök</button>
        </div>
        <div class="g-btns">
          <button type="button" class="g-btn" id="gLucky">Jag har tur</button>
        </div>
        ${
          q
            ? `<div id="gResults">${results
                .map(
                  (r) => `<div class="g-result"><a href="https://${r.url}" target="_blank" rel="noopener">${r.title}</a><div class="url">${r.url}</div><p>${r.snip}</p></div>`
                )
                .join("")}</div>`
            : `<div class="g-suggest">${GOOGLE_SUGGEST.map((s) => `<button type="button" data-gq="${s}">🔍 ${s}</button>`).join("")}</div>`
        }
        ${compact ? "" : `<p style="margin:.6rem 0 0;font-size:.7rem;color:#70757a;text-align:center">Sökningar öppnas i ny flik</p>`}
      </div>`;
  }

  function wireGoogle(root, reopen) {
    const run = (q) => {
      mediaState.googleQ = (q || root.querySelector("#gInput")?.value || "").trim();
      if (!mediaState.googleQ) return;
      playTone(480, 0.08);
      reopen();
    };
    root.querySelector("#gGo")?.addEventListener("click", () => run());
    root.querySelector("#gLucky")?.addEventListener("click", () => {
      mediaState.googleQ = GOOGLE_SUGGEST[Math.floor(Math.random() * GOOGLE_SUGGEST.length)];
      reopen();
    });
    root.querySelector("#gInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") run();
    });
    root.querySelectorAll("[data-gq]").forEach((b) => {
      b.addEventListener("click", () => run(b.dataset.gq));
    });
  }

  function snapHtml(forPhone = true) {
    return `
      <div class="snap-app">
        <div class="snap-stories" id="snapStories">
          ${SNAP_FRIENDS.map((f) => `<button type="button" class="snap-story" data-friend="${f.name}"><div class="av">${f.av}</div>${f.name}</button>`).join("")}
        </div>
        <div class="snap-cam">
          <div class="snap-top"><span>Snapchat</span><span id="snapHint">Kamera</span></div>
          <video id="snapVideo" autoplay muted playsinline ${mediaState.snapPhoto ? "hidden" : ""}></video>
          <img id="snapPreview" alt="Snap" ${mediaState.snapPhoto ? `src="${mediaState.snapPhoto}"` : "hidden"} />
          <button type="button" class="snap-shutter" id="snapShutter" aria-label="Ta snap"><span></span></button>
        </div>
        <div class="snap-bar">
          <button type="button" class="phone-action" id="snapFlip">Byt kamera</button>
          <button type="button" class="phone-action secondary" id="snapSend"${mediaState.snapPhoto ? "" : " disabled"}>Skicka</button>
          ${forPhone ? "" : ""}
        </div>
      </div>`;
  }

  async function startSnapCamera(root) {
    stopSnapCamera();
    const video = root.querySelector("#snapVideo");
    const preview = root.querySelector("#snapPreview");
    if (mediaState.snapPhoto && preview) {
      preview.hidden = false;
      if (video) video.hidden = true;
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      root.querySelector("#snapHint").textContent = "Ingen kamera";
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mediaState.snapFacing },
        audio: false,
      });
      mediaState.snapStream = stream;
      if (video) {
        video.srcObject = stream;
        video.hidden = false;
        video.play?.().catch(() => {});
      }
      if (preview) preview.hidden = true;
      root.querySelector("#snapHint").textContent = "Live";
    } catch {
      root.querySelector("#snapHint").textContent = "Tillåt kamera";
      toast("Tillåt kamera för Snapchat", 2000);
    }
  }

  function wireSnap(root, reopen) {
    startSnapCamera(root);
    root.querySelector("#snapShutter")?.addEventListener("click", () => {
      const video = root.querySelector("#snapVideo");
      if (mediaState.snapPhoto) {
        mediaState.snapPhoto = null;
        reopen();
        return;
      }
      if (!video || video.hidden || !video.videoWidth) {
        toast("Vänta på kameran…", 1200);
        return;
      }
      const c = document.createElement("canvas");
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      c.getContext("2d").drawImage(video, 0, 0);
      mediaState.snapPhoto = c.toDataURL("image/jpeg", 0.85);
      stopSnapCamera();
      playTone(700, 0.06);
      reopen();
    });
    root.querySelector("#snapFlip")?.addEventListener("click", () => {
      mediaState.snapFacing = mediaState.snapFacing === "user" ? "environment" : "user";
      mediaState.snapPhoto = null;
      reopen();
    });
    root.querySelector("#snapSend")?.addEventListener("click", () => {
      if (!mediaState.snapPhoto) return;
      playTone(640, 0.12);
      toast(mediaState.connected ? "Snap skickad till bilskärmen!" : "Snap skickad till vänner!", 1800);
      mediaState.snapPhoto = null;
      reopen();
    });
    root.querySelectorAll("[data-friend]").forEach((b) => {
      b.addEventListener("click", () => toast(`Öppnar story: ${b.dataset.friend}`, 1200));
    });
  }

  function btHtml(scope) {
    const isPhone = scope === "phone";
    const on = isPhone ? mediaState.phoneBtOn : mediaState.carBtOn;
    const orbClass = mediaState.connected ? "connected" : mediaState.btScanning || mediaState.btPairing ? "scanning" : "";
    if (mediaState.btPairing) {
      return `
        <div class="bt-panel">
          <div class="bt-pair">
            <p>Parkopplar med Nermin Sportbil</p>
            <div class="pin">${mediaState.btPin}</div>
            <p style="opacity:.7;font-size:.8rem">Bekräfta att PIN stämmer på båda enheter</p>
            <button type="button" class="phone-action" id="btConfirm">Parkoppla</button>
            <button type="button" class="phone-action secondary" id="btCancel" style="margin-top:.35rem">Avbryt</button>
          </div>
        </div>`;
    }
    return `
      <div class="bt-panel">
        <div class="bt-status">
          <div class="bt-orb ${orbClass}">BT</div>
          <div>
            <strong>${on ? (mediaState.connected ? "Ansluten" : mediaState.btScanning ? "Söker…" : "På") : "Av"}</strong>
            <div style="font-size:.72rem;opacity:.7">${
              mediaState.connected
                ? isPhone
                  ? `Nermin Sportbil · Media · Batteri ${mediaState.phoneBattery}%`
                  : `Din mobil · Media + samtal · ${mediaState.phoneBattery}%`
                : isPhone
                  ? "Hitta bilstereo i närheten"
                  : mediaState.phoneOut
                    ? "Mobil synlig"
                    : "Ingen mobil uppe"
            }</div>
          </div>
        </div>
        ${
          mediaState.connected
            ? `<div class="bt-profiles">
                <span class="bt-chip on">Media-ljud</span>
                <span class="bt-chip on">Telefonsamtal</span>
                <span class="bt-chip on">A2DP</span>
                <span class="bt-chip">HFP</span>
              </div>`
            : ""
        }
        <button type="button" class="phone-action" id="btPower" style="margin-top:.55rem">${on ? "Stäng av Bluetooth" : "Slå på Bluetooth"}</button>
        ${on && !mediaState.connected ? `<button type="button" class="phone-action secondary" id="btScan" style="margin-top:.3rem">${mediaState.btScanning ? "Söker…" : "Sök enheter"}</button>` : ""}
        ${mediaState.connected ? `<button type="button" class="phone-action secondary" id="btDisc" style="margin-top:.3rem">Koppla från</button>` : ""}
        <div style="margin-top:.55rem" id="btList">
          ${
            on
              ? BT_NEARBY.filter((d) => (isPhone ? true : d.primary || mediaState.phoneOut)).map(
                  (d) => `
            <button type="button" class="bt-device${mediaState.connected && d.primary ? " on" : ""}" data-bt="${d.id}">
              <span class="sig">${d.sig}</span>
              <span class="info"><span class="name">${d.name}</span><span class="sub">${d.type}${mediaState.connected && d.primary ? " · Ansluten" : ""}</span></span>
            </button>`
                ).join("")
              : `<p style="opacity:.65;font-size:.8rem">Slå på Bluetooth för att se enheter</p>`
          }
        </div>
      </div>`;
  }

  function wireBt(root, scope, reopen) {
    const isPhone = scope === "phone";
    root.querySelector("#btPower")?.addEventListener("click", () => {
      if (isPhone) {
        mediaState.phoneBtOn = !mediaState.phoneBtOn;
        if (!mediaState.phoneBtOn) {
          mediaState.connected = false;
          mediaState.btPairing = false;
        }
      } else {
        mediaState.carBtOn = !mediaState.carBtOn;
        if (!mediaState.carBtOn) {
          mediaState.connected = false;
          mediaState.btPairing = false;
        }
      }
      syncBtUi();
      playTone((isPhone ? mediaState.phoneBtOn : mediaState.carBtOn) ? 600 : 280, 0.12);
      reopen();
    });
    root.querySelector("#btScan")?.addEventListener("click", () => {
      startBtScan(reopen);
      reopen();
    });
    root.querySelector("#btDisc")?.addEventListener("click", () => {
      disconnectBt();
      reopen();
    });
    root.querySelector("#btConfirm")?.addEventListener("click", () => {
      confirmBtPair();
      reopen();
    });
    root.querySelector("#btCancel")?.addEventListener("click", () => {
      cancelBtPair();
      reopen();
    });
    root.querySelectorAll("[data-bt]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.bt;
        if (id !== "car") {
          toast("Anslut till Nermin Sportbil för bilappar", 1600);
          return;
        }
        if (mediaState.connected) {
          disconnectBt();
          reopen();
          return;
        }
        if (!isPhone && !mediaState.phoneOut) {
          openPhone();
          toast("Ta upp mobilen och slå på BT", 2000);
        }
        if (!isPhone && mediaState.phoneOut && !mediaState.phoneBtOn) {
          mediaState.phoneBtOn = true;
          syncBtUi();
        }
        const r = connectPhoneToCar();
        reopen();
        if (r === "pairing") {
          /* pairing UI shown */
        }
      });
    });
  }

  function settingsHtml() {
    return `
      <div class="phone-panel">
        <p>Volym: <strong id="volVal">${mediaState.volume}</strong></p>
        <input type="range" id="volRange" min="0" max="100" value="${mediaState.volume}" />
        <p style="margin-top:.5rem">Ljusstyrka: <strong id="briVal">${mediaState.brightness}</strong></p>
        <input type="range" id="briRange" min="20" max="100" value="${mediaState.brightness}" />
        <p style="margin-top:.5rem">Bluetooth bil: ${mediaState.carBtOn ? "På" : "Av"}</p>
        <button type="button" class="phone-action" id="carBtToggle">${mediaState.carBtOn ? "Stäng av BT" : "Slå på BT"}</button>
        <p style="margin-top:.4rem;opacity:.75">${mediaState.connected ? "Ansluten till Din mobil · A2DP + HFP" : "Ingen mobil ansluten"}</p>
      </div>`;
  }

  function wireSettings(root, reopen) {
    root.querySelector("#volRange")?.addEventListener("input", (e) => {
      mediaState.volume = Number(e.target.value);
      root.querySelector("#volVal").textContent = String(mediaState.volume);
      if (audio.master && audio.ctx) {
        audio.master.gain.setTargetAtTime(mediaState.volume / 1000, audio.ctx.currentTime, 0.05);
      }
    });
    root.querySelector("#briRange")?.addEventListener("input", (e) => {
      mediaState.brightness = Number(e.target.value);
      root.querySelector("#briVal").textContent = String(mediaState.brightness);
      syncBtUi();
    });
    root.querySelector("#carBtToggle")?.addEventListener("click", () => {
      mediaState.carBtOn = !mediaState.carBtOn;
      if (!mediaState.carBtOn) mediaState.connected = false;
      syncBtUi();
      playTone(mediaState.carBtOn ? 600 : 280, 0.12);
      reopen();
    });
  }

  function needBtGate(body, reopenLabel) {
    body.innerHTML = `
      <p>Anslut mobilen via Bluetooth först för ${reopenLabel}.</p>
      <button type="button" class="phone-action" id="needPhone">Ta upp mobil</button>
      <button type="button" class="phone-action secondary" id="needBt" style="margin-top:.3rem">Öppna Bluetooth</button>`;
    body.querySelector("#needPhone")?.addEventListener("click", openPhone);
    body.querySelector("#needBt")?.addEventListener("click", () => openCarApp("bluetooth"));
  }

  function renderPhoneApp(name) {
    const titles = {
      bluetooth: "Bluetooth",
      tiktok: "TikTok",
      youtube: "YouTube",
      musik: "Musik",
      radio: "Radio",
      google: "Google",
      snapchat: "Snapchat",
      settings: "Inställningar",
    };
    phoneTitle.textContent = titles[name] || "App";
    phoneHome.hidden = true;
    phoneAppView.hidden = false;
    stopSnapCamera();

    if (name === "bluetooth") {
      phoneAppBody.innerHTML = btHtml("phone");
      wireBt(phoneAppBody, "phone", () => renderPhoneApp("bluetooth"));
      return;
    }

    if (name === "tiktok") {
      phoneAppBody.innerHTML = `<div class="phone-panel" style="padding:0">${tiktokHtml(true)}</div>`;
      wireTikTok(phoneAppBody, () => renderPhoneApp("tiktok"));
      return;
    }

    if (name === "youtube") {
      phoneAppBody.innerHTML = `
        <div class="phone-panel">
          ${ytEmbedHtml(mediaState.ytId, true)}
          <div class="phone-list" id="ytList" style="margin-top:.5rem"></div>
        </div>`;
      const list = phoneAppBody.querySelector("#ytList");
      YT_PRESETS.forEach((v) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "phone-row" + (v.id === mediaState.ytId ? " on" : "");
        b.innerHTML = `<span>${v.title}</span><span class="meta">Spela</span>`;
        b.addEventListener("click", () => {
          mediaState.ytId = v.id;
          renderPhoneApp("youtube");
        });
        list.appendChild(b);
      });
      return;
    }

    if (name === "musik") {
      phoneAppBody.innerHTML = `<div class="phone-panel">${musicHtml()}</div>`;
      wireMusic(phoneAppBody, () => renderPhoneApp("musik"));
      return;
    }

    if (name === "radio") {
      phoneAppBody.innerHTML = `<div class="phone-panel">${radioHtml()}</div>`;
      wireRadio(phoneAppBody, () => renderPhoneApp("radio"));
      return;
    }

    if (name === "google") {
      phoneAppBody.innerHTML = googleHtml(false);
      wireGoogle(phoneAppBody, () => renderPhoneApp("google"));
      return;
    }

    if (name === "snapchat") {
      phoneAppBody.innerHTML = snapHtml(true);
      wireSnap(phoneAppBody, () => renderPhoneApp("snapchat"));
      return;
    }

    if (name === "settings") {
      phoneAppBody.innerHTML = settingsHtml();
      wireSettings(phoneAppBody, () => renderPhoneApp("settings"));
    }
  }

  function showCarHome() {
    if (!screenHome) return;
    stopSnapCamera();
    screenHome.hidden = false;
    screenApp.hidden = true;
    screenAppBody.innerHTML = "";
  }

  function openCarApp(name) {
    if (!screenApp) return;
    const titles = {
      tiktok: "TikTok",
      youtube: "YouTube",
      musik: "Musik",
      radio: "Radio",
      google: "Google",
      snapchat: "Snapchat",
      bluetooth: "Bluetooth",
      settings: "Inställningar",
    };
    screenAppTitle.textContent = titles[name] || "App";
    screenHome.hidden = true;
    screenApp.hidden = false;
    stopSnapCamera();

    if (name === "tiktok") {
      if (!mediaState.connected) {
        needBtGate(screenAppBody, "TikTok");
        return;
      }
      screenAppBody.innerHTML = tiktokHtml(false);
      wireTikTok(screenAppBody, () => openCarApp("tiktok"));
      return;
    }

    if (name === "youtube") {
      screenAppBody.innerHTML = `
        ${ytEmbedHtml(mediaState.ytId, false)}
        <div class="phone-list" id="carYt" style="margin-top:.3rem"></div>`;
      const list = screenAppBody.querySelector("#carYt");
      YT_PRESETS.forEach((v) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "phone-row" + (v.id === mediaState.ytId ? " on" : "");
        b.innerHTML = `<span>${v.title}</span><span class="meta">▶</span>`;
        b.addEventListener("click", () => {
          mediaState.ytId = v.id;
          openCarApp("youtube");
        });
        list.appendChild(b);
      });
      return;
    }

    if (name === "musik") {
      screenAppBody.innerHTML = musicHtml();
      wireMusic(screenAppBody, () => openCarApp("musik"));
      return;
    }

    if (name === "radio") {
      screenAppBody.innerHTML = radioHtml();
      wireRadio(screenAppBody, () => openCarApp("radio"));
      return;
    }

    if (name === "google") {
      if (!mediaState.connected) {
        needBtGate(screenAppBody, "Google");
        return;
      }
      screenAppBody.innerHTML = googleHtml(true);
      wireGoogle(screenAppBody, () => openCarApp("google"));
      return;
    }

    if (name === "snapchat") {
      if (!mediaState.connected) {
        needBtGate(screenAppBody, "Snapchat");
        return;
      }
      screenAppBody.innerHTML = snapHtml(false);
      wireSnap(screenAppBody, () => openCarApp("snapchat"));
      return;
    }

    if (name === "bluetooth") {
      screenAppBody.innerHTML = btHtml("car");
      wireBt(screenAppBody, "car", () => openCarApp("bluetooth"));
      return;
    }

    if (name === "settings") {
      screenAppBody.innerHTML = settingsHtml();
      wireSettings(screenAppBody, () => openCarApp("settings"));
    }
  }

  openPhoneBtn?.addEventListener("click", () => {
    if (mediaState.phoneOut && !phoneScreen.hidden) closePhone();
    else openPhone();
  });
  pickPhoneBtn?.addEventListener("click", () => {
    if (mediaState.phoneOut) putPhoneAway();
    else openPhone();
  });
  closePhoneBtn?.addEventListener("click", putPhoneAway);
  phoneBack?.addEventListener("click", showPhoneHome);
  phoneScreen?.addEventListener("click", (e) => {
    if (e.target === phoneScreen) closePhone();
  });
  document.querySelectorAll(".phone-app").forEach((btn) => {
    btn.addEventListener("click", () => renderPhoneApp(btn.dataset.app));
  });
  document.querySelectorAll("[data-car-app]").forEach((btn) => {
    btn.addEventListener("click", () => openCarApp(btn.dataset.carApp));
  });
  screenBack?.addEventListener("click", showCarHome);
  setInterval(tickClocks, 30000);
  tickClocks();
  syncBtUi();
  showCarHome();

  beginInside();
  setDriveMode("comfort", false);
  toast("Du sitter i bilen. Ta upp nyckeln!", 3400);
})();
