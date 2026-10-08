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
  const controls = document.getElementById("controls");
  const steering = document.getElementById("steering");
  const speedEl = document.getElementById("speed");
  const gearEl = document.getElementById("gear");
  const gearDisplay = document.getElementById("gearDisplay");
  const shifter = document.getElementById("shifter");
  const blinkL = document.getElementById("blinkL");
  const blinkR = document.getElementById("blinkR");
  const rpmNeedle = document.getElementById("rpmNeedle");
  const fuelNeedle = document.getElementById("fuelNeedle");
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
  const ROAD_W = 2200;
  const CAM_H = 1200;
  const DRAW_DIST = 140;
  const FOV = 100;

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
    playerX: 0.35,
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

  const carColors = ["#c0392b", "#2980b9", "#2c3e50", "#bdc3c7", "#27ae60", "#8e44ad", "#d35400"];
  for (let n = 0; n < 14; n++) {
    state.traffic.push({
      z: 30 + n * 55 + Math.random() * 20,
      x: Math.random() > 0.45 ? 0.45 : -0.4,
      speed: 28 + Math.random() * 18,
      color: carColors[n % carColors.length],
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

  function setEngineSound() {
    if (!audio.ctx || !audio.engine) return;
    const gas = state.input.up && state.phase === "drive";
    const rpm = state.rpm || (700 + Math.abs(state.speed) * 55 + (gas ? 350 : 0) + (state.engineOn ? 80 : 0));
    const t = audio.ctx.currentTime;
    audio.engine.oscA.frequency.setTargetAtTime(rpm / 14, t, 0.06);
    audio.engine.oscB.frequency.setTargetAtTime(rpm / 28, t, 0.06);
    audio.engine.oscC.frequency.setTargetAtTime(rpm / 9, t, 0.08);
    audio.engine.filter.frequency.setTargetAtTime(160 + Math.abs(state.speed) * 4 + (gas ? 80 : 0), t, 0.08);
    const vol = state.engineOn ? 0.04 + Math.abs(state.speed) * 0.0011 + (gas ? 0.025 : 0) : 0;
    audio.master.gain.setTargetAtTime(vol, t, 0.08);
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
    keyBtn.hidden = true;
    beltStation.hidden = true;
    keyholeWrap.hidden = true;
    controls.hidden = true;
    driveNowBtn.hidden = false;
    updateExitButton();
    hint.textContent = "Tryck KÖR NU — eller stäng dörren och gör själv.";
    toast("Tryck KÖR NU för att börja köra!");
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
    controls.hidden = true;
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
        hint.textContent = "Tryck KÖR NU — eller bälte + nyckel själv.";
        toast("Dörren stängd. Tryck KÖR NU!");
      } else {
        hint.textContent = "Dörren är stängd.";
        toast("Dörren är stängd.");
        showCabinControls();
        if (!(state.engineOn && state.belted)) driveNowBtn.hidden = false;
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
    if (dz <= 1) return null;
    const scale = FOV / dz;
    return {
      x: w / 2 + scale * dx * (w / 2),
      y: h / 2 - scale * dy * (h / 2),
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
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    g.addColorStop(0, "#3f8fbf");
    g.addColorStop(0.55, "#8fc8e6");
    g.addColorStop(1, "#d5ebf6");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,246,210,.95)";
    ctx.beginPath();
    ctx.arc(w * 0.72 - curveLean * 40, h * 0.16, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCarSprite(x, y, scale, color) {
    const bw = 90 * scale;
    const bh = 42 * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath();
    ctx.ellipse(0, bh * 0.35, bw * 0.55, bh * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-bw * 0.5, 0);
    ctx.lineTo(-bw * 0.42, -bh * 0.35);
    ctx.lineTo(-bw * 0.1, -bh * 0.55);
    ctx.lineTo(bw * 0.2, -bh * 0.55);
    ctx.lineTo(bw * 0.48, -bh * 0.28);
    ctx.lineTo(bw * 0.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(170,210,235,.9)";
    ctx.fillRect(-bw * 0.08, -bh * 0.5, bw * 0.28, bh * 0.2);
    ctx.fillStyle = "#ffe9a0";
    ctx.fillRect(bw * 0.38, -bh * 0.18, bw * 0.08, bh * 0.1);
    ctx.fillStyle = "#ff4d4d";
    ctx.fillRect(-bw * 0.48, -bh * 0.16, bw * 0.07, bh * 0.09);
    ctx.fillStyle = "#111";
    ctx.fillRect(-bw * 0.34, -bh * 0.02, bw * 0.14, bh * 0.14);
    ctx.fillRect(bw * 0.14, -bh * 0.02, bw * 0.14, bh * 0.14);
    ctx.restore();
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
    const camY = CAM_H + (segments[base].y || 0);
    const camZ = 0;
    const playerWorldX = state.playerX * ROAD_W;
    let x = 0;
    let dx = 0;
    let maxY = h;
    const lean = state.curve * 0.015 + state.steer * 0.0004;

    drawSky(w, h, lean);
    ctx.fillStyle = "#3d6b38";
    ctx.fillRect(0, h * 0.48, w, h * 0.52);

    const pts = [];
    for (let n = 0; n < DRAW_DIST; n++) {
      const seg = segments[(base + n) % segments.length];
      const segPrev = segments[(base + n - 1 + segments.length) % segments.length];
      const p1 = project(playerWorldX - x, camY - segPrev.y, camZ + (n - 1) * SEG_LEN - (state.pos % SEG_LEN), playerWorldX, camY, camZ, w, h);
      const p2 = project(playerWorldX - x, camY - seg.y, camZ + n * SEG_LEN - (state.pos % SEG_LEN), playerWorldX, camY, camZ, w, h);
      x += dx;
      dx += seg.curve;
      if (!p1 || !p2) continue;
      pts.push({ p1, p2, n, alt: ((base + n) % 2) === 0 });
    }

    for (let i = pts.length - 1; i >= 0; i--) {
      const { p1, p2, alt, n } = pts[i];
      if (p2.y >= maxY) continue;
      const grass = alt ? "#3a6a36" : "#345f31";
      const rumble = alt ? "#d9dee6" : "#c0392b";
      const road = alt ? "#3a4048" : "#323840";
      polygon(0, p1.y, w, p1.y, w, p2.y, 0, p2.y, grass);
      segmentBand(p1, p2, 1.15, 1.0, rumble);
      segmentBand(p1, p2, 1.0, 0, road);
      if (alt) {
        segmentBand(p1, p2, 0.04, 0, "#f2f4f7");
        segmentBand(p1, p2, 0.02, -0.52, "rgba(255,255,255,.75)");
        segmentBand(p1, p2, 0.02, 0.52, "rgba(255,255,255,.75)");
      }
      if (n % 3 === 0) {
        const s = p2.scale;
        for (const side of [-1, 1]) {
          const px = p2.x + side * p2.w * 1.08;
          ctx.fillStyle = "#cfd6de";
          ctx.fillRect(px - 2 * s * 40, p2.y - 70 * s * 40, 4 * s * 40, 70 * s * 40);
          ctx.fillStyle = "#e74c3c";
          ctx.fillRect(px - 6 * s * 40, p2.y - 78 * s * 40, 12 * s * 40, 10 * s * 40);
        }
      }
      if (n % 5 === 0) {
        const s = p2.scale * 40;
        for (const side of [-1, 1]) {
          const px = p2.x + side * p2.w * (1.35 + (n % 7) * 0.03);
          ctx.fillStyle = "#4a321f";
          ctx.fillRect(px - 3 * s, p2.y - 10 * s, 6 * s, 18 * s);
          ctx.fillStyle = "#1e5a2a";
          ctx.beginPath();
          ctx.moveTo(px, p2.y - 55 * s);
          ctx.lineTo(px + 22 * s, p2.y - 8 * s);
          ctx.lineTo(px - 22 * s, p2.y - 8 * s);
          ctx.closePath();
          ctx.fill();
        }
      }
      maxY = p2.y;
    }

    if (state.phase === "drive" && state.speed < 12) {
      ctx.fillStyle = "rgba(70, 220, 130, 0.8)";
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.58);
      ctx.lineTo(w * 0.54, h * 0.64);
      ctx.lineTo(w * 0.515, h * 0.64);
      ctx.lineTo(w * 0.515, h * 0.7);
      ctx.lineTo(w * 0.485, h * 0.7);
      ctx.lineTo(w * 0.485, h * 0.64);
      ctx.lineTo(w * 0.46, h * 0.64);
      ctx.closePath();
      ctx.fill();
    }

    for (const car of state.traffic) {
      const rel = car.z - state.pos / SEG_LEN;
      const z = ((rel % segments.length) + segments.length) % segments.length;
      if (z <= 1 || z > DRAW_DIST - 2) continue;
      const approx = pts[Math.min(pts.length - 1, Math.floor(z))];
      if (!approx) continue;
      const p = approx.p2;
      drawCarSprite(p.x + car.x * p.w, p.y, p.scale * 42, car.color);
    }

    state.curve = segments[base].curve;
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

    if (!state.belted) {
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
      hint.textContent = "Motorn är sönder! Tryck Laga motorn.";
      return;
    }

    // Maxfart per växel (interna enheter) + acceleration
    // 1:an kan övervarva förbi "säker" fart — sönder vid 75 km/h
    const gearMax = { R: 12, N: 0, 1: 22, 2: 22, 3: 30, 4: 38, 5: 46, 6: 55 };
    const gearSafe = { R: 12, N: 0, 1: 14, 2: 22, 3: 30, 4: 38, 5: 46, 6: 55 };
    const gearAccel = { R: 16, N: 0, 1: 32, 2: 26, 3: 22, 4: 18, 5: 15, 6: 12 };
    const inGear = state.gear !== "N";
    const maxForGear = gearMax[state.gear] || 0;
    const safeForGear = gearSafe[state.gear] || 0;
    const baseAccel = gearAccel[state.gear] || 0;

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

    const brakeForce = brake ? 32 : 0;
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
      state.speed = Math.max(0, Math.min(55, state.speed));
    }

    const kmh = Math.abs(state.speed) * 3.6;

    // 1:an i 75 km/h → motorn går sönder
    if (state.gear === "1" && kmh >= 75) {
      breakEngine();
      return;
    }

    // RPM från växel + gas
    if (state.gear === "N") {
      state.rpm = 900 + (gas ? 2200 : 0);
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
    state.steerRate += (turn * 280 * speedFactor - state.steer * 2.5 - state.steerRate * 5.5) * dt;
    state.steer += state.steerRate * dt;
    state.steer = Math.max(-480, Math.min(480, state.steer));
    if (turn === 0) {
      state.steer *= 1 - Math.min(1, dt * 2.4);
      state.steerRate *= 1 - Math.min(1, dt * 3.5);
    }

    const pull = state.curve * 0.0009 * state.speed;
    state.playerX += (state.steer / 900) * state.speed * dt * 0.55 - pull * dt;
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

    // Håll dig nära vägarna (oval + kors) — annars grus/saktare
    const off = nearestRoadDist(state.mapX, state.mapZ);
    if (off > 18) {
      state.speed *= 1 - dt * 1.2;
      hint.textContent = "Du är utanför vägen! Sväng tillbaka till kartans väg.";
    }

    // Gränser
    state.mapX = Math.max(-170, Math.min(170, state.mapX));
    state.mapZ = Math.max(-120, Math.min(120, state.mapZ));

    state.pos += Math.abs(state.speed) * dt * 55;
    state.distance += Math.abs(state.speed) * dt;
    state.fuel = Math.max(0.05, state.fuel - dt * 0.0015 * (0.4 + state.speed / 40));

    for (const car of state.traffic) {
      car.z += (car.speed * dt * 55) / SEG_LEN;
      if (car.z * SEG_LEN < state.pos - 40 * SEG_LEN) {
        car.z = state.pos / SEG_LEN + 80 + Math.random() * 60;
        car.x = Math.random() > 0.5 ? 0.42 : -0.42;
      }
    }

    state.blink += dt;
    const blinkOn = Math.floor(state.blink * 3) % 2 === 0;
    blinkL.classList.toggle("on", state.input.left && blinkOn);
    blinkR.classList.toggle("on", state.input.right && blinkOn);
    setEngineSound();

    if (state.gear === "N" && gas) {
      hint.textContent = "Du är i N — tryck E för 1:ans växel";
    } else if (state.rpm > 6200 && state.gearIndex > 0 && state.gearIndex < 6) {
      hint.textContent = "Högt varv! Tryck E för att växla upp";
    } else if (state.gearIndex >= 4 && state.speed < 5 && gas) {
      hint.textContent = "Lite hög växel — Q växlar ner om det känns segt";
    } else if (Math.abs(state.speed) < 2 && !gas) {
      hint.textContent = "Gas ▲ / W · E upp · Q ner";
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
    controls.hidden = true;
    driveNowBtn.hidden = true;
    repairBtn.hidden = false;
    app.classList.add("engine-broken");
    engineLight.classList.add("on");
    playBreakSound();
    if (audio.master && audio.ctx) {
      audio.master.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05);
    }
    hint.textContent = "BOOM! Motorn gick sönder i 1:an. Laga motorn.";
    toast("Motorn gick sönder! (75 km/h i växel 1)", 4000);
  }

  function repairEngine() {
    if (!state.engineBroken) return;
    state.engineBroken = false;
    state.keyInIgnition = false;
    state.holdingKey = false;
    state.engineOn = false;
    state.speed = 0;
    state.rpm = 0;
    state.gearIndex = 0;
    syncGearLabel();
    repairBtn.hidden = true;
    app.classList.remove("engine-broken");
    engineLight.classList.remove("on");
    keyBtn.disabled = false;
    keyCaption.textContent = "Ta upp bilnyckel";
    updateKeyholeUI();
    driveNowBtn.hidden = false;
    hint.textContent = "Motorn är lagad. Starta igen med nyckel eller KÖR NU.";
    toast("Motorn är lagad! Du kan köra igen.");
  }

  function updateUI() {
    if (!state.inside) return;
    const kmh = Math.round(Math.abs(state.speed) * 3.6);
    speedEl.textContent = String(kmh);
    steering.style.transform = `rotate(${state.steer * 0.2}deg)`;
    const rpmAngle = -120 + Math.min(240, (state.rpm / 5000) * 240);
    rpmNeedle.setAttribute("transform", `rotate(${rpmAngle} 50 50)`);
    const fuelAngle = -110 + state.fuel * 220;
    fuelNeedle.setAttribute("transform", `rotate(${fuelAngle} 50 50)`);
    engineLight.classList.toggle("on", state.engineBroken || (state.engineOn && state.rpm > 4200));
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
    driveNowBtn.hidden = state.phase === "drive" && state.engineOn;
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
    controls.hidden = false;
    driveNowBtn.hidden = true;

    setEngineSound();
    hint.textContent = "Gas ▲ eller W · Sväng ◀▶ · E upp · Q ner";
    toast("Du kör! Tryck gas ▲ eller W", 3500);
  }

  function updateBeltUI() {
    belt.hidden = state.belted;
    unbelt.hidden = !state.belted;
    buckle.classList.toggle("show", true);
    buckle.classList.toggle("locked", state.belted);
  }

  function updateKeyholeUI() {
    keyholeWrap.hidden = false;
    slot.classList.toggle("ready", state.holdingKey && !state.keyInIgnition);
    slot.classList.toggle("turned", state.keyInIgnition);
    keyInHole.hidden = !state.keyInIgnition;
    keyOut.hidden = !state.keyInIgnition;
    if (state.keyInIgnition) {
      keyholeLabel.textContent = "Nyckel i tändningen";
    } else if (state.holdingKey) {
      keyholeLabel.textContent = "Sätt i nyckeln här";
    } else {
      keyholeLabel.textContent = "Nyckelhål";
    }
  }

  function pickUpKey() {
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
    keyBtn.disabled = true;
    keyCaption.textContent = "I handen";
    controls.hidden = true;
    updateKeyholeUI();
    hint.textContent = "Sätt i nyckeln i nyckelhålet och vrid om";
    toast("Du har bilnyckeln. Sätt den i nyckelhålet.");
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
    state.engineOn = true;
    state.holdingKey = false;
    state.keyInIgnition = true;
    keyCaption.textContent = "I nyckelhålet";
    keyBtn.disabled = true;
    updateKeyholeUI();
    setEngineSound();

    if (!state.belted) {
      state.phase = "belt";
      driveNowBtn.hidden = false;
      hint.textContent = "Sätt på bilbältet — eller tryck KÖR NU";
      toast("Nyckeln sitter i. Sätt på bilbältet!");
    } else {
      state.phase = "drive";
      state.gearIndex = 1;
      syncGearLabel();
      controls.hidden = false;
      driveNowBtn.hidden = true;
      hint.textContent = "Gas ▲ / W · E upp · Q ner";
      toast("Motorn igång! Kör!");
    }
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

    controls.hidden = true;
    keyBtn.disabled = false;
    keyCaption.textContent = "I handen — lägg undan?";
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
      controls.hidden = false;
      driveNowBtn.hidden = true;
      hint.textContent = "Gas ▲ / W · E upp · Q ner";
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
      controls.hidden = true;
      hint.textContent = "Sätt på bilbältet igen innan du kör";
    } else if (state.doorAjar && !state.engineOn) {
      hint.textContent = "Bältet är av — tryck Gå ur bilen";
    }
    toast("Bilbältet är av.");
  }

  function setInput(dir, on) {
    if (state.phase !== "drive") return;
    if (dir in state.input) state.input[dir] = on;
    document.querySelectorAll(`.pedal[data-dir="${dir}"]`).forEach((b) => b.classList.toggle("pressed", on));
  }

  driverDoor.addEventListener("click", openDriverDoor);
  passengerDoor.addEventListener("click", openPassengerDoor);
  enterCar.addEventListener("click", sitInCar);
  closeDoorOutside.addEventListener("click", closeDriverOutside);
  innerDoorBtn.addEventListener("click", toggleInnerDoor);
  exitCarBtn.addEventListener("click", exitCar);
  driveNowBtn.addEventListener("click", driveNow);
  repairBtn.addEventListener("click", repairEngine);
  keyBtn.addEventListener("click", () => {
    if (state.phase === "keyOut" && state.holdingKey) putKeyAway();
    else pickUpKey();
  });
  slot.addEventListener("click", startEngine);
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

  document.getElementById("shiftUp").addEventListener("click", (e) => {
    e.preventDefault();
    shiftUp();
  });
  document.getElementById("shiftDown").addEventListener("click", (e) => {
    e.preventDefault();
    shiftDown();
  });

  controls.querySelectorAll(".pedal[data-dir]").forEach((btn) => {
    const dir = btn.dataset.dir;
    const on = (e) => { e.preventDefault(); setInput(dir, true); };
    const off = (e) => { e.preventDefault(); setInput(dir, false); };
    btn.addEventListener("pointerdown", on);
    btn.addEventListener("pointerup", off);
    btn.addEventListener("pointerleave", off);
    btn.addEventListener("pointercancel", off);
  });

  window.addEventListener("resize", resize);

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state.inside) {
      updatePhysics(dt);
      updateUI();
      render();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  updateExteriorUI();
  toast("Din röda sportbil väntar — öppna förardörren");
})();
