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
  const modeExtremeBtn = document.getElementById("modeExtreme");
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
  const CAM_DEPTH = 0.92;
  const DRAW_DIST = 180;

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
    carHits: 0,
    exploded: false,
    driveMode: "comfort",
    engineSwap: "idle", // idle | remove | pickNew | holdNew | fitted
    holdingEngine: false,
    // Karta — kör runt fritt
    mapX: 0,
    mapZ: -120,
    heading: 0, // radianer, 0 = norr (+Z)
    traffic: [],
    input: { left: false, right: false, up: false, down: false },
    wheelDragging: false,
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

  const audio = { ctx: null, master: null, engine: null, noise: null, sfx: null, music: null };

  function makeNoiseBuffer(ctx, seconds = 2) {
    const len = Math.floor(seconds * ctx.sampleRate);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function ensureAudio() {
    if (audio.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio.ctx = new AC();
    const ctx = audio.ctx;

    audio.master = ctx.createGain();
    audio.master.gain.value = 0;
    audio.master.connect(ctx.destination);

    // —— Bensinmotor (V8-känsla): dunk + avgaser + gasbrus ——
    const engBus = ctx.createGain();
    engBus.gain.value = 1;

    // Avgasgrund (djup sågtand)
    const exhaust = ctx.createOscillator();
    const exhaustGain = ctx.createGain();
    const exhaustFilter = ctx.createBiquadFilter();
    exhaust.type = "sawtooth";
    exhaust.frequency.value = 55;
    exhaustFilter.type = "lowpass";
    exhaustFilter.frequency.value = 380;
    exhaustFilter.Q.value = 0.7;
    exhaustGain.gain.value = 0.55;
    exhaust.connect(exhaustFilter);
    exhaustFilter.connect(exhaustGain);
    exhaustGain.connect(engBus);

    // Cylinderdunk (smal fyrkant = “pop”)
    const pulse = ctx.createOscillator();
    const pulseGain = ctx.createGain();
    const pulseFilter = ctx.createBiquadFilter();
    pulse.type = "square";
    pulse.frequency.value = 28;
    pulseFilter.type = "bandpass";
    pulseFilter.frequency.value = 120;
    pulseFilter.Q.value = 2.2;
    pulseGain.gain.value = 0.42;
    pulse.connect(pulseFilter);
    pulseFilter.connect(pulseGain);
    pulseGain.connect(engBus);

    // Övre harmoniska / “rasp” vid varv
    const rasp = ctx.createOscillator();
    const raspGain = ctx.createGain();
    const raspFilter = ctx.createBiquadFilter();
    rasp.type = "sawtooth";
    rasp.frequency.value = 110;
    raspFilter.type = "bandpass";
    raspFilter.frequency.value = 520;
    raspFilter.Q.value = 1.4;
    raspGain.gain.value = 0.18;
    rasp.connect(raspFilter);
    raspFilter.connect(raspGain);
    raspGain.connect(engBus);

    // Amplitude-modulering i takt med tändning (4-takts V8 ≈ rpm/15 Hz)
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const am = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 40;
    lfoGain.gain.value = 0.35;
    am.gain.value = 0.65;
    lfo.connect(lfoGain);
    lfoGain.connect(am.gain);
    engBus.connect(am);

    // Mild “dist” via wave shaper → mer rå bensinljud
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = ((Math.PI + 4) * x) / (Math.PI + 4 * Math.abs(x));
    }
    shaper.curve = curve;
    shaper.oversample = "2x";

    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = "lowpass";
    bodyFilter.frequency.value = 900;
    bodyFilter.Q.value = 0.9;

    const engGain = ctx.createGain();
    engGain.gain.value = 0.7;
    am.connect(shaper);
    shaper.connect(bodyFilter);
    bodyFilter.connect(engGain);
    engGain.connect(audio.master);

    exhaust.start();
    pulse.start();
    rasp.start();
    lfo.start();

    // Förbränningsbrus + vägbrus
    const noiseBuf = makeNoiseBuffer(ctx, 2.5);
    const combustion = ctx.createBufferSource();
    combustion.buffer = noiseBuf;
    combustion.loop = true;
    const combFilter = ctx.createBiquadFilter();
    combFilter.type = "bandpass";
    combFilter.frequency.value = 280;
    combFilter.Q.value = 1.1;
    const combGain = ctx.createGain();
    combGain.gain.value = 0;
    combustion.connect(combFilter);
    combFilter.connect(combGain);
    combGain.connect(audio.master);
    combustion.start();

    const road = ctx.createBufferSource();
    road.buffer = noiseBuf;
    road.loop = true;
    const roadFilter = ctx.createBiquadFilter();
    roadFilter.type = "bandpass";
    roadFilter.frequency.value = 700;
    roadFilter.Q.value = 0.8;
    const roadGain = ctx.createGain();
    roadGain.gain.value = 0;
    road.connect(roadFilter);
    roadFilter.connect(roadGain);
    roadGain.connect(audio.master);
    road.start();

    // Insug / gas när man trycker W
    const intake = ctx.createBufferSource();
    intake.buffer = noiseBuf;
    intake.loop = true;
    const intakeFilter = ctx.createBiquadFilter();
    intakeFilter.type = "highpass";
    intakeFilter.frequency.value = 900;
    const intakeGain = ctx.createGain();
    intakeGain.gain.value = 0;
    intake.connect(intakeFilter);
    intakeFilter.connect(intakeGain);
    intakeGain.connect(audio.master);
    intake.start();

    audio.engine = {
      exhaust,
      exhaustGain,
      exhaustFilter,
      pulse,
      pulseGain,
      pulseFilter,
      rasp,
      raspGain,
      raspFilter,
      lfo,
      lfoGain,
      bodyFilter,
      engGain,
      combFilter,
      combGain,
      intakeFilter,
      intakeGain,
    };
    audio.noise = { filter: roadFilter, gain: roadGain };
    audio.sfx = ctx.createGain();
    audio.sfx.gain.value = 0.2;
    audio.sfx.connect(ctx.destination);

    // Musikbus (separat från motor)
    const musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(ctx.destination);
    audio.music = {
      gain: musicGain,
      playing: false,
      mode: "music", // "music" | "radio"
      track: 0,
      station: 0,
      step: 0,
      nextTime: 0,
      timer: null,
      staticGain: null,
      staticSrc: null,
    };
  }

  // —— Genererad bilmusik (4 låtar) ——
  const MUSIC_TRACKS = [
    {
      name: "Nermin Drive",
      bpm: 112,
      root: 52,
      melody: [0, 2, 4, 2, 5, 4, 2, 0, 4, 5, 7, 5, 4, 2, 0, 2],
      bass: [0, 0, 4, 4, 5, 5, 4, 4, 0, 0, 5, 5, 4, 4, 0, 0],
      wave: "triangle",
      bassWave: "sawtooth",
      filter: 1800,
    },
    {
      name: "Night Road",
      bpm: 96,
      root: 48,
      melody: [0, 3, 5, 3, 7, 5, 3, 0, 5, 7, 10, 7, 5, 3, 0, 3],
      bass: [0, 0, 5, 5, 3, 3, 7, 7, 0, 0, 3, 3, 5, 5, 0, 0],
      wave: "sine",
      bassWave: "triangle",
      filter: 1200,
    },
    {
      name: "Coastline",
      bpm: 124,
      root: 55,
      melody: [4, 2, 0, 2, 5, 7, 5, 4, 2, 4, 7, 9, 7, 5, 4, 2],
      bass: [0, 4, 5, 4, 0, 4, 7, 4, 0, 5, 4, 2, 0, 4, 5, 0],
      wave: "square",
      bassWave: "sawtooth",
      filter: 2200,
    },
    {
      name: "Redline",
      bpm: 138,
      root: 50,
      melody: [0, 3, 5, 7, 5, 3, 0, 5, 7, 8, 10, 8, 7, 5, 3, 0],
      bass: [0, 0, 0, 3, 5, 5, 5, 3, 0, 0, 7, 5, 3, 3, 0, 0],
      wave: "sawtooth",
      bassWave: "square",
      filter: 2600,
    },
  ];

  // —— Radiokanaler ——
  const RADIO_STATIONS = [
    {
      name: "P3 99.2",
      short: "P3",
      bpm: 118,
      root: 57,
      melody: [0, 4, 7, 4, 9, 7, 4, 0, 5, 7, 11, 7, 4, 2, 0, 4],
      bass: [0, 0, 5, 5, 7, 7, 5, 5, 0, 0, 4, 4, 5, 5, 0, 0],
      wave: "triangle",
      bassWave: "sine",
      filter: 2000,
      static: 0.02,
      vol: 1,
    },
    {
      name: "Mix Megapol",
      short: "Mix",
      bpm: 128,
      root: 60,
      melody: [0, 2, 4, 7, 4, 2, 0, 4, 7, 9, 7, 4, 2, 4, 0, 2],
      bass: [0, 0, 0, 4, 5, 5, 5, 4, 0, 0, 7, 5, 4, 4, 0, 0],
      wave: "square",
      bassWave: "sawtooth",
      filter: 2400,
      static: 0.015,
      vol: 1,
    },
    {
      name: "NRJ",
      short: "NRJ",
      bpm: 132,
      root: 55,
      melody: [0, 3, 5, 7, 10, 7, 5, 3, 0, 5, 7, 10, 12, 10, 7, 5],
      bass: [0, 0, 3, 3, 5, 5, 7, 7, 0, 0, 5, 5, 3, 3, 0, 0],
      wave: "sawtooth",
      bassWave: "square",
      filter: 2800,
      static: 0.025,
      vol: 1,
    },
    {
      name: "Rockklassiker",
      short: "Rock",
      // Klassisk rock-groove: powerchords Em–G–D–A-känsla
      bpm: 120,
      root: 52, // E
      melody: [0, 0, 0, 3, 7, 7, 5, 3, 0, 0, 7, 5, 3, 5, 7, 12],
      bass: [0, 0, 0, 0, 3, 3, 3, 3, 7, 7, 7, 5, 0, 0, 5, 7],
      wave: "sawtooth",
      bassWave: "sawtooth",
      filter: 3200,
      static: 0.012,
      vol: 1.45,
      style: "rock",
    },
  ];

  function midiToHz(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function scheduleMusicNote(freq, start, dur, type, vol, filterFreq) {
    if (!audio.ctx || !audio.music) return;
    const ctx = audio.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    o.type = type;
    o.frequency.value = freq;
    f.type = "lowpass";
    f.frequency.value = filterFreq;
    o.connect(f);
    f.connect(g);
    g.connect(audio.music.gain);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  function scheduleDrum(start, kind, rock = false) {
    if (!audio.ctx || !audio.music) return;
    const ctx = audio.ctx;
    if (kind === "kick") {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(rock ? 160 : 140, start);
      o.frequency.exponentialRampToValueAtTime(38, start + 0.14);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(rock ? 0.48 : 0.35, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      o.connect(g);
      g.connect(audio.music.gain);
      o.start(start);
      o.stop(start + 0.18);
    } else if (kind === "snare") {
      const buf = makeNoiseBuffer(ctx, 0.12);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1800;
      f.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(rock ? 0.28 : 0.16, start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);
      src.connect(f);
      f.connect(g);
      g.connect(audio.music.gain);
      src.start(start);
      src.stop(start + 0.12);
      // Snare-body
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(180, start);
      o.frequency.exponentialRampToValueAtTime(90, start + 0.08);
      og.gain.setValueAtTime(0.0001, start);
      og.gain.exponentialRampToValueAtTime(0.12, start + 0.005);
      og.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
      o.connect(og);
      og.connect(audio.music.gain);
      o.start(start);
      o.stop(start + 0.1);
    } else if (kind === "hat") {
      const buf = makeNoiseBuffer(ctx, 0.05);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = rock ? 7000 : 6000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(rock ? 0.11 : 0.08, start + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.04);
      src.connect(f);
      f.connect(g);
      g.connect(audio.music.gain);
      src.start(start);
      src.stop(start + 0.05);
    }
  }

  function currentPlaylist() {
    const m = audio.music;
    if (!m) return null;
    if (m.mode === "radio") return RADIO_STATIONS[m.station % RADIO_STATIONS.length];
    return MUSIC_TRACKS[m.track % MUSIC_TRACKS.length];
  }

  function ensureRadioStatic() {
    if (!audio.ctx || !audio.music) return;
    const m = audio.music;
    if (m.staticSrc) return;
    const ctx = audio.ctx;
    const buf = makeNoiseBuffer(ctx, 1.5);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1800;
    f.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f);
    f.connect(g);
    g.connect(m.gain);
    src.start();
    m.staticSrc = src;
    m.staticGain = g;
    m.staticFilter = f;
  }

  function setRadioStaticLevel(level) {
    if (!audio.music?.staticGain || !audio.ctx) return;
    audio.music.staticGain.gain.setTargetAtTime(level, audio.ctx.currentTime, 0.08);
  }

  function musicTick() {
    if (!audio.ctx || !audio.music || !audio.music.playing) return;
    const ctx = audio.ctx;
    const m = audio.music;
    const track = currentPlaylist();
    if (!track) return;
    const rock = track.style === "rock";
    const stepSec = 60 / track.bpm / 2;
    const lookAhead = 0.18;
    const volMul = track.vol || 1;
    const melVol = (m.mode === "radio" ? 0.1 : 0.09) * volMul;
    const bassVol = (m.mode === "radio" ? 0.11 : 0.12) * volMul;

    while (m.nextTime < ctx.currentTime + lookAhead) {
      const i = m.step % 16;
      const t = m.nextTime;

      if (rock) {
        // Rockbeat: kick på 1+3, snare på 2+4, hihat åttondelar
        if (i % 8 === 0 || i % 8 === 6) scheduleDrum(t, "kick", true);
        if (i % 8 === 4) scheduleDrum(t, "snare", true);
        scheduleDrum(t, "hat", true);
      } else {
        if (i % 4 === 0) scheduleDrum(t, "kick");
        if (i % 2 === 1) scheduleDrum(t, "hat");
      }

      const melDeg = track.melody[i];
      const bassDeg = track.bass[i];
      const melMidi = track.root + 12 + melDeg;
      const bassMidi = track.root + bassDeg;

      if (rock) {
        // Powerchord: grundton + kvint (+ oktav ibland)
        scheduleMusicNote(midiToHz(melMidi), t, stepSec * 0.9, "sawtooth", melVol * 1.1, track.filter);
        scheduleMusicNote(midiToHz(melMidi + 7), t, stepSec * 0.9, "sawtooth", melVol * 0.75, track.filter * 0.85);
        if (i % 4 === 0) {
          scheduleMusicNote(midiToHz(melMidi + 12), t, stepSec * 0.5, "square", melVol * 0.35, track.filter);
        }
        // Tung bas varje slag
        scheduleMusicNote(midiToHz(bassMidi), t, stepSec * 0.95, "sawtooth", bassVol * 1.2, 700);
        if (i % 2 === 0) {
          scheduleMusicNote(midiToHz(bassMidi + 12), t, stepSec * 0.4, "triangle", bassVol * 0.35, 900);
        }
      } else {
        scheduleMusicNote(midiToHz(melMidi), t, stepSec * 0.85, track.wave, melVol, track.filter);
        if (i % 2 === 0) {
          scheduleMusicNote(midiToHz(bassMidi), t, stepSec * 1.5, track.bassWave, bassVol, 500);
        }
      }

      m.nextTime += stepSec;
      m.step += 1;
    }
  }

  function startPlayback(mode, index) {
    ensureAudio();
    if (!audio.ctx || !audio.music) return;
    audio.ctx.resume();
    const m = audio.music;
    m.mode = mode;
    if (mode === "radio") {
      if (typeof index === "number") m.station = index;
      carScreenState.radioOn = true;
      carScreenState.musicOn = false;
      ensureRadioStatic();
      const st = RADIO_STATIONS[m.station % RADIO_STATIONS.length];
      setRadioStaticLevel(st.static || 0.02);
    } else {
      if (typeof index === "number") m.track = index;
      carScreenState.musicOn = true;
      carScreenState.radioOn = false;
      setRadioStaticLevel(0);
    }
    m.playing = true;
    m.step = 0;
    m.nextTime = audio.ctx.currentTime + 0.05;
    const st = mode === "radio" ? RADIO_STATIONS[m.station % RADIO_STATIONS.length] : null;
    const masterVol = mode === "radio" ? (st?.style === "rock" ? 0.72 : 0.5) : 0.55;
    m.gain.gain.cancelScheduledValues(audio.ctx.currentTime);
    m.gain.gain.setTargetAtTime(masterVol, audio.ctx.currentTime, 0.08);
    if (m.timer) clearInterval(m.timer);
    musicTick();
    m.timer = setInterval(musicTick, 40);
  }

  function startMusic(trackIndex) {
    startPlayback("music", trackIndex);
  }

  function stopMusic() {
    if (!audio.music || !audio.ctx) return;
    const m = audio.music;
    m.playing = false;
    if (m.timer) {
      clearInterval(m.timer);
      m.timer = null;
    }
    setRadioStaticLevel(0);
    m.gain.gain.cancelScheduledValues(audio.ctx.currentTime);
    m.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.12);
    carScreenState.musicOn = false;
    carScreenState.radioOn = false;
  }

  function toggleMusic() {
    ensureAudio();
    audio.ctx?.resume();
    if (audio.music?.playing && audio.music.mode === "music") {
      stopMusic();
    } else {
      startMusic(carScreenState.track);
    }
  }

  function nextMusicTrack() {
    ensureAudio();
    audio.ctx?.resume();
    carScreenState.track = (carScreenState.track + 1) % MUSIC_TRACKS.length;
    startMusic(carScreenState.track);
  }

  function startRadio(stationIndex) {
    startPlayback("radio", stationIndex);
  }

  function stopRadio() {
    if (audio.music?.mode === "radio") stopMusic();
    else {
      carScreenState.radioOn = false;
    }
  }

  function toggleRadio() {
    ensureAudio();
    audio.ctx?.resume();
    if (audio.music?.playing && audio.music.mode === "radio") {
      stopRadio();
    } else {
      startRadio(carScreenState.radio);
    }
  }

  function changeRadioStation(delta) {
    ensureAudio();
    audio.ctx?.resume();
    const n = RADIO_STATIONS.length;
    carScreenState.radio = (carScreenState.radio + delta + n) % n;
    // Kort statisk “surr” när man byter kanal, sedan spela
    ensureRadioStatic();
    setRadioStaticLevel(0.14);
    const station = carScreenState.radio;
    setTimeout(() => startRadio(station), 160);
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
    const e = audio.engine;
    const gas = state.input.up && state.engineOn && state.phase === "drive";
    const rev = state.rev || 0;
    const rpm = state.rpm || (700 + Math.abs(state.speed) * 55 + (gas ? 350 : 0) + (state.engineOn ? 80 : 0));
    const t = audio.ctx.currentTime;
    const sport = state.driveMode === "sport" || state.driveMode === "extreme";
    const extreme = state.driveMode === "extreme";

    // Ojämn förbränning (riktig bensinmotor går inte perfekt jämnt)
    const jitter = gas
      ? Math.sin(t * 29) * 22 + Math.sin(t * 47) * 12 + Math.sin(t * 73) * 6
      : Math.sin(t * 9) * 5;
    const r = Math.max(600, rpm + jitter);

    // V8 4-takt: tändfrekvens ≈ rpm/15, vevaxel ≈ rpm/60
    const crankHz = r / 60;
    const fireHz = r / 15;
    const smooth = gas ? 0.04 : 0.09;

    e.exhaust.frequency.setTargetAtTime(crankHz * 1.05, t, smooth);
    e.pulse.frequency.setTargetAtTime(fireHz, t, smooth);
    e.rasp.frequency.setTargetAtTime(crankHz * 2.15, t, smooth);
    e.lfo.frequency.setTargetAtTime(fireHz, t, smooth);

    // Mer öppet avgassystem när man gasar / sport
    const bodyOpen = 520 + r * 0.09 + rev * 900 + (gas ? 280 : 0) + (sport ? 180 : 0);
    e.bodyFilter.frequency.setTargetAtTime(bodyOpen, t, 0.06);
    e.exhaustFilter.frequency.setTargetAtTime(220 + r * 0.04 + (gas ? 160 : 0), t, 0.07);
    e.pulseFilter.frequency.setTargetAtTime(90 + r * 0.02 + (gas ? 40 : 0), t, 0.07);
    e.raspFilter.frequency.setTargetAtTime(400 + r * 0.08 + rev * 500, t, 0.06);

    // Dunk och rasp starkare under gas
    e.pulseGain.gain.setTargetAtTime(gas ? 0.55 : 0.28, t, 0.05);
    e.raspGain.gain.setTargetAtTime((gas ? 0.28 : 0.1) * (sport ? 1.35 : 0.85), t, 0.05);
    e.lfoGain.gain.setTargetAtTime(gas ? 0.42 : 0.22, t, 0.06);
    e.exhaustGain.gain.setTargetAtTime(gas ? 0.62 : 0.4, t, 0.06);

    // Förbränningsbrus
    e.combFilter.frequency.setTargetAtTime(200 + r * 0.035 + (gas ? 80 : 0), t, 0.08);
    e.combGain.gain.setTargetAtTime(
      state.engineOn ? (0.04 + (gas ? 0.09 : 0.03) + rev * 0.12) * (sport ? 1.3 : 0.85) : 0,
      t,
      0.07
    );

    // Insugsljud när man gasar
    e.intakeFilter.frequency.setTargetAtTime(700 + rev * 1400 + (gas ? 400 : 0), t, 0.05);
    e.intakeGain.gain.setTargetAtTime(gas ? (sport ? 0.09 : 0.045) + rev * 0.06 : 0, t, 0.04);

    const loud = extreme ? 2.4 : sport ? 1.65 : 0.62;
    const load = gas ? 1.2 : 0.82;
    const speedVol = extreme
      ? Math.min(0.35, Math.abs(state.speed) * 0.00008)
      : Math.abs(state.speed) * 0.0011;
    const vol = state.engineOn
      ? (0.055 + speedVol + rev * (sport ? 0.26 : 0.1)) * loud * load
      : 0;
    audio.master.gain.setTargetAtTime(vol, t, sport ? 0.03 : 0.11);

    if (audio.noise) {
      const offroad = Math.abs(state.playerX) > 0.92 ? 0.00095 : 0.00036;
      audio.noise.gain.gain.setTargetAtTime(
        Math.abs(state.speed) * offroad + (state.bump > 0.2 ? 0.012 : 0),
        t,
        0.08
      );
      audio.noise.filter.frequency.setTargetAtTime(
        400 + Math.abs(state.speed) * 11 + state.bump * 420,
        t,
        0.08
      );
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
    stopMusic();
    carScreenState.musicOn = false;
    carScreenState.radioOn = false;
    closeYouTube(true);
    closePhone();

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
    const g = ctx.createLinearGradient(0, 0, 0, horizon + 8);
    g.addColorStop(0, "#2a5f8f");
    g.addColorStop(0.28, "#5a9bc4");
    g.addColorStop(0.62, "#a8cfe0");
    g.addColorStop(0.88, "#d4e6ee");
    g.addColorStop(1, "#e8f0f2");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const sunX = w * 0.78 - curveLean * 40;
    const sunY = h * 0.14;
    const halo = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 140);
    halo.addColorStop(0, "rgba(255,248,220,1)");
    halo.addColorStop(0.18, "rgba(255,236,180,0.55)");
    halo.addColorStop(0.45, "rgba(255,220,160,0.12)");
    halo.addColorStop(1, "rgba(255,220,160,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 140, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff8e0";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 22, 0, Math.PI * 2);
    ctx.fill();

    // Mjuka moln i lager
    const clouds = [
      [0.08, 0.12, 78, 0.55],
      [0.22, 0.2, 52, 0.72],
      [0.4, 0.1, 68, 0.5],
      [0.58, 0.18, 44, 0.65],
      [0.74, 0.13, 58, 0.48],
      [0.9, 0.22, 36, 0.6],
    ];
    for (const [cx, cy, rw, a] of clouds) {
      const x = cx * w - curveLean * 28;
      const y = cy * h;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rw, rw * 0.36, 0, 0, Math.PI * 2);
      ctx.ellipse(x + rw * 0.52, y + 5, rw * 0.68, rw * 0.3, 0, 0, Math.PI * 2);
      ctx.ellipse(x - rw * 0.48, y + 7, rw * 0.52, rw * 0.26, 0, 0, Math.PI * 2);
      ctx.ellipse(x + rw * 0.12, y - 8, rw * 0.4, rw * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Berg i tre djuplager
    const ranges = [
      { color: "#8aa0b0", lean: 22, amp: 1.15, steps: 20, seed: 41 },
      { color: "#6f8798", lean: 14, amp: 0.85, steps: 14, seed: 73 },
      { color: "#557084", lean: 8, amp: 0.55, steps: 10, seed: 19 },
    ];
    for (const range of ranges) {
      ctx.fillStyle = range.color;
    ctx.beginPath();
      ctx.moveTo(-30, horizon);
      for (let i = 0; i <= range.steps; i++) {
        const t = i / range.steps;
        const x = t * w - curveLean * range.lean;
        const wave =
          Math.sin(t * 9 + range.seed) * 0.45 +
          Math.sin(t * 17 + range.seed * 0.3) * 0.3 +
          ((i * range.seed) % 11) / 22;
        const peak = horizon - (22 + wave * 70) * range.amp * (h / 520);
      ctx.lineTo(x, peak);
    }
    ctx.lineTo(w + 40, horizon);
    ctx.closePath();
    ctx.fill();
    }

    // Låg dis vid horisonten
    const haze = ctx.createLinearGradient(0, horizon - 40, 0, horizon + 10);
    haze.addColorStop(0, "rgba(210,224,230,0)");
    haze.addColorStop(1, "rgba(210,224,230,0.55)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon - 40, w, 50);
  }

  function carDims(kind, s) {
    if (kind === "suv") return { w: 108 * s, h: 68 * s, top: -0.98 };
    if (kind === "sport") return { w: 100 * s, h: 44 * s, top: -0.72 };
    if (kind === "hatch") return { w: 88 * s, h: 52 * s, top: -0.88 };
    return { w: 96 * s, h: 54 * s, top: -0.9 };
  }

  function drawCarSprite(x, y, scale, color, oncoming = false, kind = "sedan") {
    const s = Math.max(0.18, scale);
    const { w, h } = carDims(kind, s);
    ctx.save();
    ctx.translate(x, y);
    // Mjuk skugga på asfalten
    const sh = ctx.createRadialGradient(0, h * 0.48, 2, 0, h * 0.5, w * 0.58);
    sh.addColorStop(0, "rgba(0,0,0,.5)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.5, w * 0.55, h * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    if (oncoming) drawCarFront(w, h, color, kind, s);
    else drawCarRear(w, h, color, kind, s);
    ctx.restore();
  }

  function drawWheelPair(w, h, s, kind) {
    const spread = kind === "sport" ? 0.36 : 0.34;
    for (const side of [-1, 1]) {
      const wx = side * w * spread;
      const wy = h * 0.3;
      // Däck
      ctx.fillStyle = "#0c0c0e";
      ctx.beginPath();
      ctx.ellipse(wx, wy, w * 0.11, h * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      // Sidovägg
      ctx.strokeStyle = "#2a2a2e";
      ctx.lineWidth = Math.max(1, s * 1.2);
      ctx.beginPath();
      ctx.ellipse(wx, wy, w * 0.085, h * 0.14, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Fälg
      const rim = ctx.createRadialGradient(wx - 2, wy - 2, 1, wx, wy, w * 0.055);
      rim.addColorStop(0, "#d8dee6");
      rim.addColorStop(0.45, "#8a929c");
      rim.addColorStop(1, "#2a3038");
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.ellipse(wx, wy, w * 0.055, h * 0.085, 0, 0, Math.PI * 2);
      ctx.fill();
      // Ekrar
      ctx.strokeStyle = "rgba(255,255,255,.35)";
      ctx.lineWidth = Math.max(0.8, s);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + Math.cos(a) * w * 0.04, wy + Math.sin(a) * h * 0.06);
        ctx.stroke();
      }
      ctx.fillStyle = "#12151a";
      ctx.beginPath();
      ctx.ellipse(wx, wy, w * 0.016, h * 0.025, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCarBodyPath(w, h, top, kind, front) {
    ctx.beginPath();
    if (front) {
      ctx.moveTo(-w * 0.44, h * 0.22);
      ctx.quadraticCurveTo(-w * 0.52, h * 0.04, -w * 0.48, -h * 0.06);
      ctx.lineTo(-w * 0.4, top * 0.42);
      if (kind === "sport") {
        ctx.quadraticCurveTo(-w * 0.22, top * 0.85, -w * 0.08, top);
        ctx.lineTo(w * 0.08, top);
        ctx.quadraticCurveTo(w * 0.22, top * 0.85, w * 0.4, top * 0.42);
      } else if (kind === "suv") {
        ctx.lineTo(-w * 0.32, top);
        ctx.lineTo(w * 0.32, top);
        ctx.lineTo(w * 0.4, top * 0.42);
      } else {
        ctx.quadraticCurveTo(-w * 0.22, top, 0, top);
        ctx.quadraticCurveTo(w * 0.22, top, w * 0.4, top * 0.42);
      }
      ctx.lineTo(w * 0.48, -h * 0.06);
      ctx.quadraticCurveTo(w * 0.52, h * 0.04, w * 0.44, h * 0.22);
      ctx.closePath();
    } else {
      ctx.moveTo(-w * 0.45, h * 0.24);
      ctx.quadraticCurveTo(-w * 0.53, h * 0.05, -w * 0.49, -h * 0.1);
      ctx.lineTo(-w * 0.42, top * 0.5);
      if (kind === "sport") {
        ctx.quadraticCurveTo(-w * 0.3, top * 0.95, -w * 0.14, top);
        ctx.lineTo(w * 0.14, top);
        ctx.quadraticCurveTo(w * 0.3, top * 0.95, w * 0.42, top * 0.5);
      } else if (kind === "suv") {
        ctx.lineTo(-w * 0.34, top);
        ctx.lineTo(w * 0.34, top);
        ctx.lineTo(w * 0.42, top * 0.5);
      } else if (kind === "hatch") {
        ctx.quadraticCurveTo(-w * 0.28, top, -w * 0.1, top);
        ctx.lineTo(w * 0.1, top);
        ctx.quadraticCurveTo(w * 0.28, top, w * 0.42, top * 0.5);
      } else {
        ctx.quadraticCurveTo(-w * 0.3, top, -w * 0.12, top);
        ctx.lineTo(w * 0.12, top);
        ctx.quadraticCurveTo(w * 0.3, top, w * 0.42, top * 0.5);
      }
      ctx.lineTo(w * 0.49, -h * 0.1);
      ctx.quadraticCurveTo(w * 0.53, h * 0.05, w * 0.45, h * 0.24);
      ctx.closePath();
    }
  }

  function drawCarRear(w, h, color, kind, s) {
    const top = (kind === "suv" ? -0.98 : kind === "sport" ? -0.7 : kind === "hatch" ? -0.86 : -0.9) * h;
    drawWheelPair(w, h, s, kind);

    // Stötfångare under
    ctx.fillStyle = shadeColor(color, -40);
    ctx.beginPath();
    ctx.moveTo(-w * 0.42, h * 0.18);
    ctx.quadraticCurveTo(0, h * 0.28, w * 0.42, h * 0.18);
    ctx.lineTo(w * 0.4, h * 0.08);
    ctx.quadraticCurveTo(0, h * 0.16, -w * 0.4, h * 0.08);
    ctx.closePath();
    ctx.fill();

    const body = ctx.createLinearGradient(-w * 0.55, top, w * 0.55, h * 0.25);
    body.addColorStop(0, shadeColor(color, 70));
    body.addColorStop(0.22, shadeColor(color, 28));
    body.addColorStop(0.5, color);
    body.addColorStop(0.78, shadeColor(color, -25));
    body.addColorStop(1, shadeColor(color, -55));
    ctx.fillStyle = body;
    drawCarBodyPath(w, h, top, kind, false);
    ctx.fill();

    // Lackglans
    const shine = ctx.createLinearGradient(0, top, 0, h * 0.05);
    shine.addColorStop(0, "rgba(255,255,255,.4)");
    shine.addColorStop(0.35, "rgba(255,255,255,.12)");
    shine.addColorStop(0.7, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.moveTo(-w * 0.28, top + h * 0.06);
    ctx.lineTo(w * 0.28, top + h * 0.06);
    ctx.lineTo(w * 0.36, -h * 0.02);
    ctx.lineTo(-w * 0.36, -h * 0.02);
    ctx.closePath();
    ctx.fill();

    // Panel-linjer
    ctx.strokeStyle = "rgba(0,0,0,.22)";
    ctx.lineWidth = Math.max(1, s * 0.8);
    ctx.beginPath();
    ctx.moveTo(-w * 0.18, -h * 0.08);
    ctx.lineTo(-w * 0.18, h * 0.12);
    ctx.moveTo(w * 0.18, -h * 0.08);
    ctx.lineTo(w * 0.18, h * 0.12);
    ctx.stroke();

    // Bakruta + svart karm
    ctx.fillStyle = "#0a1018";
    ctx.beginPath();
    ctx.moveTo(-w * 0.28, top + h * 0.06);
    ctx.quadraticCurveTo(0, top - h * 0.01, w * 0.28, top + h * 0.06);
    ctx.lineTo(w * 0.34, -h * 0.02);
    ctx.quadraticCurveTo(0, -h * 0.1, -w * 0.34, -h * 0.02);
    ctx.closePath();
    ctx.fill();
    const glass = ctx.createLinearGradient(0, top, 0, -h * 0.02);
    glass.addColorStop(0, "rgba(200,230,250,.85)");
    glass.addColorStop(0.4, "rgba(60,110,150,.9)");
    glass.addColorStop(1, "rgba(12,28,42,.95)");
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.moveTo(-w * 0.24, top + h * 0.1);
    ctx.quadraticCurveTo(0, top + h * 0.02, w * 0.24, top + h * 0.1);
    ctx.lineTo(w * 0.3, -h * 0.04);
    ctx.quadraticCurveTo(0, -h * 0.1, -w * 0.3, -h * 0.04);
    ctx.closePath();
    ctx.fill();
    // Fönsterreflektion
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.beginPath();
    ctx.ellipse(-w * 0.08, top + h * 0.14, w * 0.09, h * 0.035, -0.35, 0, Math.PI * 2);
    ctx.fill();

    // Speglar
    for (const side of [-1, 1]) {
      const mx = side * w * 0.48 - (side > 0 ? 0 : w * 0.08);
      ctx.fillStyle = shadeColor(color, -18);
      ctx.fillRect(mx, -h * 0.2, w * 0.08, h * 0.1);
      ctx.fillStyle = "#a8d4ec";
      ctx.fillRect(side * w * 0.47 - (side > 0 ? 0 : w * 0.05), -h * 0.18, w * 0.05, h * 0.06);
    }

    // Bakljus
    for (const side of [-1, 1]) {
      const lx = side * w * 0.36;
      ctx.fillStyle = "#ff1414";
      ctx.shadowColor = "rgba(255,20,20,.9)";
      ctx.shadowBlur = 16 * s;
      ctx.beginPath();
      ctx.ellipse(lx, -h * 0.01, w * 0.11, h * 0.065, side * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffd0d0";
      ctx.beginPath();
      ctx.ellipse(lx - side * w * 0.025, -h * 0.025, w * 0.04, h * 0.028, 0, 0, Math.PI * 2);
      ctx.fill();
      // Blinkers
      ctx.fillStyle = "#ffb020";
      ctx.beginPath();
      ctx.ellipse(lx + side * w * 0.07, h * 0.02, w * 0.035, h * 0.025, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mittbromsljus
    ctx.fillStyle = "#ff3030";
    ctx.fillRect(-w * 0.12, top + h * 0.04, w * 0.24, h * 0.028);

    // Avgas
    ctx.fillStyle = "#1a1a1a";
    ctx.strokeStyle = "#5a5a5a";
    ctx.lineWidth = Math.max(1, s);
    for (const side of [-1, 1]) {
    ctx.beginPath();
      ctx.ellipse(side * w * 0.2, h * 0.22, w * 0.04, h * 0.032, 0, 0, Math.PI * 2);
    ctx.fill();
      ctx.stroke();
    }

    // Skylt
    if (s > 0.45) {
      ctx.fillStyle = "#f4f1e8";
      ctx.fillRect(-w * 0.16, h * 0.04, w * 0.32, h * 0.09);
      ctx.strokeStyle = "#1a3a6e";
      ctx.lineWidth = Math.max(1, s);
      ctx.strokeRect(-w * 0.16, h * 0.04, w * 0.32, h * 0.09);
      ctx.fillStyle = "#1a3a6e";
      ctx.font = `bold ${Math.max(6, 8.5 * s)}px "IBM Plex Sans", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("NER 42A", 0, h * 0.085);
    }

    if (kind === "sport") {
      ctx.fillStyle = shadeColor(color, -40);
      ctx.fillRect(-w * 0.3, top - h * 0.08, w * 0.6, h * 0.055);
      ctx.fillRect(-w * 0.28, top - h * 0.03, w * 0.05, h * 0.09);
      ctx.fillRect(w * 0.23, top - h * 0.03, w * 0.05, h * 0.09);
    }
    if (kind === "suv") {
      ctx.strokeStyle = shadeColor(color, -30);
      ctx.lineWidth = Math.max(1.5, s * 1.5);
      ctx.beginPath();
      ctx.moveTo(-w * 0.3, top + h * 0.02);
      ctx.lineTo(-w * 0.3, top - h * 0.06);
      ctx.lineTo(w * 0.3, top - h * 0.06);
      ctx.lineTo(w * 0.3, top + h * 0.02);
      ctx.stroke();
    }
  }

  function drawCarFront(w, h, color, kind, s) {
    const top = (kind === "suv" ? -0.98 : kind === "sport" ? -0.68 : kind === "hatch" ? -0.86 : -0.88) * h;
    drawWheelPair(w, h, s, kind);

    // Undre stötfångare
    ctx.fillStyle = shadeColor(color, -45);
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, h * 0.16);
    ctx.quadraticCurveTo(0, h * 0.26, w * 0.4, h * 0.16);
    ctx.lineTo(w * 0.38, h * 0.06);
    ctx.quadraticCurveTo(0, h * 0.14, -w * 0.38, h * 0.06);
    ctx.closePath();
    ctx.fill();

    const body = ctx.createLinearGradient(-w * 0.55, top, w * 0.55, h * 0.25);
    body.addColorStop(0, shadeColor(color, 75));
    body.addColorStop(0.25, shadeColor(color, 30));
    body.addColorStop(0.5, color);
    body.addColorStop(0.8, shadeColor(color, -30));
    body.addColorStop(1, shadeColor(color, -50));
    ctx.fillStyle = body;
    drawCarBodyPath(w, h, top, kind, true);
    ctx.fill();

    const shine = ctx.createLinearGradient(0, top, 0, 0);
    shine.addColorStop(0, "rgba(255,255,255,.42)");
    shine.addColorStop(0.5, "rgba(255,255,255,.08)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.moveTo(-w * 0.26, top + h * 0.08);
    ctx.lineTo(w * 0.26, top + h * 0.08);
    ctx.lineTo(w * 0.34, -h * 0.02);
    ctx.lineTo(-w * 0.34, -h * 0.02);
    ctx.closePath();
    ctx.fill();

    // Vindruta
    ctx.fillStyle = "#0a1218";
    ctx.beginPath();
    ctx.moveTo(-w * 0.26, top + h * 0.08);
    ctx.quadraticCurveTo(0, top, w * 0.26, top + h * 0.08);
    ctx.lineTo(w * 0.32, -h * 0.0);
    ctx.quadraticCurveTo(0, -h * 0.08, -w * 0.32, -h * 0.0);
    ctx.closePath();
    ctx.fill();
    const glass = ctx.createLinearGradient(0, top, 0, 0);
    glass.addColorStop(0, "rgba(230,248,255,.9)");
    glass.addColorStop(0.35, "rgba(90,160,200,.85)");
    glass.addColorStop(1, "rgba(20,50,70,.95)");
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.moveTo(-w * 0.22, top + h * 0.12);
    ctx.quadraticCurveTo(0, top + h * 0.04, w * 0.22, top + h * 0.12);
    ctx.lineTo(w * 0.28, -h * 0.01);
    ctx.quadraticCurveTo(0, -h * 0.07, -w * 0.28, -h * 0.01);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.4)";
    ctx.beginPath();
    ctx.ellipse(w * 0.05, top + h * 0.12, w * 0.1, h * 0.03, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Grill
    ctx.fillStyle = "#0a0a0c";
    ctx.beginPath();
    ctx.moveTo(-w * 0.22, h * 0.02);
    ctx.quadraticCurveTo(0, h * 0.12, w * 0.22, h * 0.02);
    ctx.lineTo(w * 0.2, -h * 0.04);
    ctx.quadraticCurveTo(0, h * 0.02, -w * 0.2, -h * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#4a5058";
    ctx.lineWidth = Math.max(0.8, s);
    for (let i = 0; i < 5; i++) {
      const x = -w * 0.16 + i * w * 0.08;
      ctx.beginPath();
      ctx.moveTo(x, -h * 0.02);
      ctx.lineTo(x, h * 0.06);
      ctx.stroke();
    }
    // Emblem
    ctx.fillStyle = "#d0d6de";
    ctx.beginPath();
    ctx.arc(0, h * 0.01, w * 0.03, 0, Math.PI * 2);
    ctx.fill();

    // Strålkastare
    for (const side of [-1, 1]) {
      const lx = side * w * 0.34;
      ctx.fillStyle = "#fff6d8";
      ctx.shadowColor = "rgba(255,236,180,.95)";
      ctx.shadowBlur = 14 * s;
      ctx.beginPath();
      ctx.ellipse(lx, -h * 0.02, w * 0.11, h * 0.075, side * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      const lens = ctx.createRadialGradient(lx - side * 3, -h * 0.04, 1, lx, -h * 0.02, w * 0.08);
      lens.addColorStop(0, "#ffffff");
      lens.addColorStop(0.4, "#ffe8a0");
      lens.addColorStop(1, "#c8b070");
      ctx.fillStyle = lens;
      ctx.beginPath();
      ctx.ellipse(lx, -h * 0.02, w * 0.07, h * 0.05, side * 0.1, 0, Math.PI * 2);
      ctx.fill();
      // Dimljus
      ctx.fillStyle = "#ffe0a0";
      ctx.beginPath();
      ctx.ellipse(lx, h * 0.1, w * 0.04, h * 0.028, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Speglar
    for (const side of [-1, 1]) {
      ctx.fillStyle = shadeColor(color, -12);
      ctx.fillRect(side * w * 0.46 - (side > 0 ? 0 : w * 0.08), -h * 0.22, w * 0.08, h * 0.1);
      ctx.fillStyle = "#9ecce8";
      ctx.fillRect(side * w * 0.45 - (side > 0 ? 0 : w * 0.05), -h * 0.2, w * 0.05, h * 0.06);
    }

    // Framskylt (nära)
    if (s > 0.55) {
      ctx.fillStyle = "#f4f1e8";
      ctx.fillRect(-w * 0.12, h * 0.08, w * 0.24, h * 0.07);
      ctx.strokeStyle = "#1a3a6e";
      ctx.lineWidth = Math.max(1, s);
      ctx.strokeRect(-w * 0.12, h * 0.08, w * 0.24, h * 0.07);
    }
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

  function drawTree(px, py, s, variant) {
    const trunkH = (12 + (variant % 3) * 3) * s;
    ctx.fillStyle = "#4a3424";
    ctx.fillRect(px - 1.4 * s, py - trunkH, 2.8 * s, trunkH);
    const greens = ["#1e4a28", "#2a5c32", "#245830", "#326a38"];
    const g = greens[variant % greens.length];
    ctx.fillStyle = g;
    ctx.beginPath();
    if (variant % 3 === 0) {
      // Gran
      ctx.moveTo(px, py - trunkH - 28 * s);
      ctx.lineTo(px + 14 * s, py - trunkH + 2 * s);
      ctx.lineTo(px - 14 * s, py - trunkH + 2 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px, py - trunkH - 20 * s);
      ctx.lineTo(px + 18 * s, py - trunkH + 10 * s);
      ctx.lineTo(px - 18 * s, py - trunkH + 10 * s);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.ellipse(px, py - trunkH - 10 * s, 13 * s, 11 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(px - 8 * s, py - trunkH - 4 * s, 9 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(px + 8 * s, py - trunkH - 5 * s, 9 * s, 7.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.ellipse(px - 4 * s, py - trunkH - 14 * s, 4 * s, 3 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function extremeVibCap(speedKmh) {
    // Begränsa skakning så Extreme 10 000 km/h inte blir ospelbart
    if (state.driveMode === "extreme") return Math.min(6.5, 2.8 + speedKmh * 0.00025);
    return 2.8;
  }

  function drawRoad(w, h) {
    const base = Math.floor(state.pos / SEG_LEN) % segments.length;
    const baseY = segments[base].y || 0;
    const camY = CAM_H + baseY;
    const playerWorldX = state.playerX * ROAD_W + state.steer * 1.7;
    let x = 0;
    let dx = 0;
    const lean = state.curve * 0.8 + state.steer * 0.0011;
    const roll = Math.max(-0.09, Math.min(0.09, state.steer * 0.00015));
    const speedKmh = Math.abs(state.speed) * 3.6;
    const vib =
      speedKmh > 8
        ? Math.sin(performance.now() / 42) * Math.min(extremeVibCap(speedKmh), speedKmh * 0.018)
        : 0;
    const shake = (state.bump > 0 ? (Math.random() - 0.5) * 20 * state.bump : 0) + vib;
    const pitchMul =
      state.driveMode === "extreme" ? 2.4 : state.driveMode === "sport" ? 1.65 : 0.42;
    const pitch =
      ((state.input.up ? -16 : 0) + (state.input.down ? 12 : 0)) * pitchMul +
      Math.sin(performance.now() / 180) * Math.min(extremeVibCap(speedKmh), speedKmh * 0.02);

    ctx.save();
    ctx.translate(w / 2 + shake, h * 0.58 + shake * 0.45);
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
      const worldIdx = base + n;
      pts.push({ p1, p2, n, alt: (worldIdx % 2) === 0, fog, worldIdx, curve: seg.curve });
      byN[n] = p2;
    }

    let clipY = h + 4;
    for (let i = 0; i < pts.length; i++) {
      const { p1, p2, alt, n, fog, worldIdx, curve } = pts[i];
      if (p1.y >= clipY) continue;
      if (p2.y >= p1.y) continue;

      const grassA = fogPaint(alt ? "#4a6e3c" : "#3f6236", fog);
      const grassB = fogPaint(alt ? "#557848" : "#4a6c40", fog);
      const shoulder = fogPaint(alt ? "#7a7264" : "#6a6356", fog);
      const road = fogPaint(alt ? "#404850" : "#353c44", fog);
      const paint = fogPaint("#f5f2e8", fog);
      const curbLite = fogPaint(alt ? "#e8e4dc" : "#c62828", fog);
      const curbDark = fogPaint(alt ? "#c62828" : "#e8e4dc", fog);

      // Gräs med subtila ränder
      polygon(0, p1.y, w, p1.y, w, p2.y, 0, p2.y, grassA);
      if ((worldIdx % 4) === 0) {
        segmentBand(p1, p2, 2.4, -1.8, grassB);
        segmentBand(p1, p2, 2.4, 1.8, grassB);
      }

      segmentBand(p1, p2, 1.18, 0, shoulder);
      segmentBand(p1, p2, 1, 0, road);

      // Kantlinjer
      segmentBand(p1, p2, 0.016, -0.97, paint);
      segmentBand(p1, p2, 0.016, 0.97, paint);

      // Röd/vit kantsten
      segmentBand(p1, p2, 0.022, -1.12, curbLite);
      segmentBand(p1, p2, 0.022, 1.12, curbDark);

      // Streckad mittlinje som rullar med positionen
      const dashOn = ((worldIdx + Math.floor(state.pos / (SEG_LEN * 0.5))) % 4) < 2;
      if (dashOn) segmentBand(p1, p2, 0.014, 0, paint);

      // Körfältslinjer (svagare)
      if ((worldIdx % 6) < 3) {
        const lane = fogPaint("#c8c4b8", fog);
        segmentBand(p1, p2, 0.006, -0.33, lane);
        segmentBand(p1, p2, 0.006, 0.33, lane);
      }

      const s = Math.max(0.35, p2.w / 240);

      // Vägräcken i kurvor
      if (Math.abs(curve) > 0.9 && fog < 0.82 && n % 2 === 0) {
        const side = curve > 0 ? -1 : 1;
        const px = p2.x + side * p2.w * 1.2;
        ctx.fillStyle = fogPaint("#9aa3ad", fog);
        ctx.fillRect(px - 1.2 * s, p2.y - 14 * s, 2.4 * s, 14 * s);
        ctx.fillStyle = fogPaint("#c5ccd4", fog);
        ctx.fillRect(px - 5 * s, p2.y - 16 * s, 10 * s, 2.2 * s);
      }

      // Lampstolpar
      if (n % 6 === 0 && fog < 0.88) {
        for (const side of [-1, 1]) {
          const px = p2.x + side * p2.w * 1.22;
          const poleH = 40 * s;
          ctx.fillStyle = fogPaint("#c8d0d8", fog);
          ctx.fillRect(px - Math.max(1, s * 0.75), p2.y - poleH, Math.max(2, s * 1.4), poleH);
          ctx.fillStyle = fogPaint("#e8ecf0", fog);
          ctx.fillRect(px - side * 8 * s, p2.y - poleH - 2 * s, side * 10 * s, 2.2 * s);
          ctx.fillStyle = state.engineOn ? "rgba(255,240,180,0.35)" : fogPaint("#f1c40f", fog);
          ctx.beginPath();
          ctx.ellipse(px - side * 8 * s, p2.y - poleH - 1 * s, 4 * s, 3 * s, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Träd
      if (n % 5 === 0 && fog < 0.84) {
        for (const side of [-1, 1]) {
          const dist = 1.5 + ((n + side + 3) % 4) * 0.12;
          const px = p2.x + side * p2.w * dist;
          drawTree(px, p2.y, s * (0.85 + (n % 3) * 0.12), n + side + worldIdx);
        }
      }

      // Hus
      if (n % 11 === 0 && fog < 0.72) {
        const side = (worldIdx % 22) < 11 ? -1 : 1;
        const px = p2.x + side * p2.w * (2.0 + (n % 3) * 0.1);
        const bw = 28 * s;
        const bh = (16 + (n % 4) * 4) * s;
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fillRect(px - bw * 0.45, p2.y - 2 * s, bw, 4 * s);
        ctx.fillStyle = fogPaint(side < 0 ? "#d4cec0" : "#e2d4c4", fog);
        ctx.fillRect(px - bw / 2, p2.y - bh, bw, bh);
        ctx.fillStyle = fogPaint("#7a3a30", fog);
        ctx.beginPath();
        ctx.moveTo(px - bw * 0.62, p2.y - bh + 1);
        ctx.lineTo(px, p2.y - bh - 11 * s);
        ctx.lineTo(px + bw * 0.62, p2.y - bh + 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = fogPaint("#7eb8d8", fog);
        ctx.fillRect(px - bw * 0.28, p2.y - bh * 0.78, bw * 0.22, bh * 0.28);
        ctx.fillRect(px + bw * 0.06, p2.y - bh * 0.78, bw * 0.22, bh * 0.28);
        ctx.fillStyle = fogPaint("#5a4030", fog);
        ctx.fillRect(px - bw * 0.08, p2.y - bh * 0.42, bw * 0.16, bh * 0.42);
      }

      // Skylt
      if (n % 29 === 0 && fog < 0.75) {
        const side = 1;
        const px = p2.x + side * p2.w * 1.35;
        ctx.fillStyle = fogPaint("#889098", fog);
        ctx.fillRect(px - 1.2 * s, p2.y - 36 * s, 2.4 * s, 36 * s);
        ctx.fillStyle = fogPaint("#1a6a3a", fog);
        ctx.fillRect(px - 14 * s, p2.y - 48 * s, 28 * s, 14 * s);
        ctx.strokeStyle = fogPaint("#f5f2e8", fog);
        ctx.lineWidth = Math.max(1, s);
        ctx.strokeRect(px - 14 * s, p2.y - 48 * s, 28 * s, 14 * s);
      }

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
      const weave = Math.sin((car.z + performance.now() * 0.0004) * 0.35) * 0.03;
      drawCarSprite(
        p.x + (car.x + weave) * p.w * 0.85,
        p.y,
        scale,
        car.color,
        !!car.oncoming,
        car.kind || "sedan"
      );
    }

    const haze = ctx.createLinearGradient(0, h * 0.28, 0, h * 0.52);
    haze.addColorStop(0, "rgba(198,214,220,0)");
    haze.addColorStop(0.55, "rgba(198,214,220,0.28)");
    haze.addColorStop(1, "rgba(198,214,220,0.5)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, h * 0.28, w, h * 0.24);

    // Vindrutereflektion / solfläck
    const glass = ctx.createLinearGradient(0, 0, w * 0.4, h * 0.35);
    glass.addColorStop(0, "rgba(255,255,255,0.08)");
    glass.addColorStop(0.4, "rgba(255,255,255,0)");
    glass.addColorStop(1, "rgba(180,210,255,0.04)");
    ctx.fillStyle = glass;
    ctx.fillRect(0, 0, w, h * 0.55);

    state.curve = segments[base].curve;
    ctx.restore();
    drawPlayerHood(w, h);
  }

  function drawPlayerHood(w, h) {
    const top = h * 0.76;
    const paint = ctx.createLinearGradient(w * 0.5, top, w * 0.5, h);
    paint.addColorStop(0, "#e02a36");
    paint.addColorStop(0.12, "#b41824");
    paint.addColorStop(0.4, "#7a1018");
    paint.addColorStop(0.75, "#3a080c");
    paint.addColorStop(1, "#180406");
    ctx.fillStyle = paint;
    ctx.beginPath();
    ctx.moveTo(w * 0.16, top + 10);
    ctx.quadraticCurveTo(w * 0.5, top - h * 0.03, w * 0.84, top + 10);
    ctx.lineTo(w * 1.05, h + 4);
    ctx.lineTo(-w * 0.05, h + 4);
    ctx.closePath();
    ctx.fill();

    // Huvlinjer
    ctx.strokeStyle = "rgba(0,0,0,.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.28, top + 18);
    ctx.quadraticCurveTo(w * 0.32, h * 0.9, w * 0.3, h);
    ctx.moveTo(w * 0.72, top + 18);
    ctx.quadraticCurveTo(w * 0.68, h * 0.9, w * 0.7, h);
    ctx.stroke();

    // Glans i mitten
    const gleam = ctx.createLinearGradient(w * 0.5, top, w * 0.5, h);
    gleam.addColorStop(0, "rgba(255,255,255,.35)");
    gleam.addColorStop(0.4, "rgba(255,255,255,.08)");
    gleam.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gleam;
    ctx.beginPath();
    ctx.moveTo(w * 0.46, top + 12);
    ctx.lineTo(w * 0.54, top + 12);
    ctx.lineTo(w * 0.56, h);
    ctx.lineTo(w * 0.44, h);
    ctx.closePath();
    ctx.fill();

    // Vindrutebas / svart list
    ctx.fillStyle = "rgba(10,8,8,.7)";
    ctx.beginPath();
    ctx.moveTo(w * 0.22, top + 4);
    ctx.quadraticCurveTo(w * 0.5, top - 4, w * 0.78, top + 4);
    ctx.lineTo(w * 0.76, top + 14);
    ctx.quadraticCurveTo(w * 0.5, top + 8, w * 0.24, top + 14);
    ctx.closePath();
    ctx.fill();

    for (const side of [-1, 1]) {
      const cx = w * (0.5 + side * 0.29);
      const cy = top + (h - top) * 0.58;
      if (state.engineOn) {
        const beam = ctx.createRadialGradient(cx, cy, 2, cx, cy - 36, 80);
        beam.addColorStop(0, "rgba(255,240,200,.55)");
        beam.addColorStop(1, "rgba(255,236,190,0)");
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 12, 60, 32, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const lamp = ctx.createRadialGradient(cx - 4, cy - 3, 1, cx, cy, w * 0.035);
      lamp.addColorStop(0, state.engineOn ? "#fff" : "#fff8e8");
      lamp.addColorStop(0.55, state.engineOn ? "#ffe08a" : "#d8d0b8");
      lamp.addColorStop(1, "#6a6450");
      ctx.fillStyle = lamp;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.032, h * 0.02, side * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1a0c0e";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawMirrorView(mctx, mw, mh, mode) {
    mctx.clearRect(0, 0, mw, mh);

    const sky = mctx.createLinearGradient(0, 0, 0, mh * 0.48);
    sky.addColorStop(0, "#2f6a9a");
    sky.addColorStop(0.55, "#7eb4d0");
    sky.addColorStop(1, "#c8e2f0");
    mctx.fillStyle = sky;
    mctx.fillRect(0, 0, mw, mh);

    // Berg i spegeln
    mctx.fillStyle = "#7a94a4";
    mctx.beginPath();
    mctx.moveTo(0, mh * 0.48);
    for (let i = 0; i <= 8; i++) {
      const px = (i / 8) * mw;
      mctx.lineTo(px, mh * 0.48 - (8 + (i * 17) % 18));
    }
    mctx.lineTo(mw, mh * 0.48);
    mctx.closePath();
    mctx.fill();

    mctx.fillStyle = "#3a6236";
    mctx.fillRect(0, mh * 0.48, mw, mh * 0.52);

    const lean = state.steer * 0.00035 * (mode === "rear" ? -1 : mode === "left" ? -0.6 : 0.6);
    const cx = mw * 0.5 + lean * mw + (mode === "left" ? mw * 0.08 : mode === "right" ? -mw * 0.08 : 0);
    const topW = mode === "rear" ? mw * 0.12 : mw * 0.18;
    const botW = mode === "rear" ? mw * 0.95 : mw * 0.7;

    mctx.fillStyle = "#2e343c";
    mctx.beginPath();
    mctx.moveTo(cx - topW / 2, mh * 0.48);
    mctx.lineTo(cx + topW / 2, mh * 0.48);
    mctx.lineTo(cx + botW / 2, mh);
    mctx.lineTo(cx - botW / 2, mh);
    mctx.closePath();
    mctx.fill();

    // Kantlinjer
    mctx.strokeStyle = "rgba(242,244,247,.7)";
    mctx.lineWidth = 1.5;
    mctx.beginPath();
    mctx.moveTo(cx - topW * 0.9, mh * 0.5);
    mctx.lineTo(cx - botW * 0.92, mh);
    mctx.moveTo(cx + topW * 0.9, mh * 0.5);
    mctx.lineTo(cx + botW * 0.92, mh);
    mctx.stroke();

    mctx.strokeStyle = "rgba(242,244,247,.85)";
    mctx.lineWidth = 2;
    mctx.setLineDash([5, 7]);
    mctx.beginPath();
    mctx.moveTo(cx, mh * 0.5);
    mctx.lineTo(cx, mh);
    mctx.stroke();
    mctx.setLineDash([]);

    for (const car of state.traffic) {
      const rel = car.z - state.pos / SEG_LEN;
      let z = ((rel % segments.length) + segments.length) % segments.length;
      if (mode === "rear") {
        if (z < segments.length - 40 || z > segments.length - 2) continue;
        const t = (segments.length - z) / 40;
        const y = mh * (0.54 + t * 0.36);
        const s = 0.22 + t * 0.6;
        const x = cx + car.x * (mw * 0.28) * (1 - t * 0.25);
        mctx.fillStyle = "rgba(0,0,0,.3)";
        mctx.beginPath();
        mctx.ellipse(x, y + 4 * s, 11 * s, 2.5 * s, 0, 0, Math.PI * 2);
        mctx.fill();
        mctx.fillStyle = car.color;
        mctx.fillRect(x - 11 * s, y - 7 * s, 22 * s, 11 * s);
        mctx.fillStyle = "#ff3030";
        mctx.fillRect(x - 9 * s, y + 1 * s, 5 * s, 2.5 * s);
        mctx.fillRect(x + 4 * s, y + 1 * s, 5 * s, 2.5 * s);
      } else {
        const sideOk = mode === "left" ? car.x < 0 : car.x > 0;
        if (!sideOk || z < 4 || z > 42) continue;
        const t = z / 42;
        const y = mh * (0.52 + t * 0.35);
        const s = 0.32 + (1 - t) * 0.42;
        const x = mode === "left" ? mw * (0.22 + t * 0.22) : mw * (0.78 - t * 0.22);
        mctx.fillStyle = car.color;
        mctx.fillRect(x - 10 * s, y - 6 * s, 20 * s, 10 * s);
        mctx.fillStyle = "#ffe9a0";
        mctx.fillRect(x - 8 * s, y - 5 * s, 4 * s, 2 * s);
        mctx.fillRect(x + 4 * s, y - 5 * s, 4 * s, 2 * s);
      }
    }

    const sheen = mctx.createLinearGradient(0, 0, mw, mh);
    sheen.addColorStop(0, "rgba(255,255,255,.2)");
    sheen.addColorStop(0.35, "rgba(255,255,255,0)");
    sheen.addColorStop(1, "rgba(160,200,255,.12)");
    mctx.fillStyle = sheen;
    mctx.fillRect(0, 0, mw, mh);

    mctx.strokeStyle = "rgba(0,0,0,.4)";
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
    const scale = 0.52;
    const ox = mw / 2;
    const oy = mh / 2;

    mapCtx.clearRect(0, 0, mw, mh);

    // GPS-stil: kartan roterar så bilen alltid pekar uppåt
    mapCtx.save();
    mapCtx.translate(ox, oy);
    mapCtx.rotate(-state.heading);
    mapCtx.translate(-state.mapX * scale, -state.mapZ * scale);

    // Terrängbotten
    mapCtx.fillStyle = "#1e3a28";
    mapCtx.fillRect(-220, -180, 440, 360);

    // Park / skogsområden
    const parks = [
      [-90, -55, 50, 40],
      [70, 40, 55, 35],
      [-40, 60, 35, 30],
      [55, -70, 40, 28],
    ];
    for (const [px, pz, pw, ph] of parks) {
      mapCtx.fillStyle = "#2a5a34";
    mapCtx.beginPath();
      mapCtx.ellipse(px * scale, pz * scale, pw * scale, ph * scale, 0, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.fillStyle = "#3a7044";
    mapCtx.beginPath();
      mapCtx.ellipse(px * scale + 4, pz * scale - 3, pw * scale * 0.45, ph * scale * 0.4, 0, 0, Math.PI * 2);
      mapCtx.fill();
    }

    // Vatten
    mapCtx.fillStyle = "#2a6a8a";
    mapCtx.beginPath();
    mapCtx.ellipse(20 * scale, -10 * scale, 28 * scale, 18 * scale, 0.3, 0, Math.PI * 2);
    mapCtx.fill();
    mapCtx.fillStyle = "rgba(180,220,240,.25)";
    mapCtx.beginPath();
    mapCtx.ellipse(14 * scale, -14 * scale, 10 * scale, 6 * scale, 0.3, 0, Math.PI * 2);
    mapCtx.fill();

    // Kvarter / byggnadsblock
    const blocks = [
      [-100, -40, 28, 22], [-100, 20, 28, 24],
      [75, -35, 30, 20], [75, 25, 30, 26],
      [-45, -80, 32, 18], [20, 70, 36, 20],
      [-70, 45, 22, 18], [40, -55, 24, 16],
    ];
    for (const [bx, bz, bw, bh] of blocks) {
      mapCtx.fillStyle = "#3a4550";
      mapCtx.fillRect((bx - bw / 2) * scale, (bz - bh / 2) * scale, bw * scale, bh * scale);
      mapCtx.fillStyle = "#4a5864";
      mapCtx.fillRect((bx - bw / 2) * scale, (bz - bh / 2) * scale, bw * scale, 3);
    }

    function strokeRoad(drawPath, width, color) {
      mapCtx.strokeStyle = color;
      mapCtx.lineWidth = width;
      mapCtx.lineCap = "round";
      mapCtx.lineJoin = "round";
      mapCtx.beginPath();
      drawPath();
    mapCtx.stroke();
    }

    // Oval huvudväg (asfalt)
    const rx = 140 * scale;
    const rz = 95 * scale;
    strokeRoad(() => mapCtx.ellipse(0, 0, rx, rz, 0, 0, Math.PI * 2), 16, "#2a3038");
    strokeRoad(() => mapCtx.ellipse(0, 0, rx, rz, 0, 0, Math.PI * 2), 13, "#4a5560");
    // Kantlinjer
    mapCtx.setLineDash([]);
    strokeRoad(() => mapCtx.ellipse(0, 0, rx + 5.5, rz + 5.5, 0, 0, Math.PI * 2), 1.2, "rgba(230,235,240,.55)");
    strokeRoad(() => mapCtx.ellipse(0, 0, rx - 5.5, rz - 5.5, 0, 0, Math.PI * 2), 1.2, "rgba(230,235,240,.55)");
    // Mittstreck
    mapCtx.setLineDash([5, 6]);
    strokeRoad(() => mapCtx.ellipse(0, 0, rx, rz, 0, 0, Math.PI * 2), 1.4, "rgba(255,220,100,.85)");
    mapCtx.setLineDash([]);

    // Korsvägar
    strokeRoad(() => {
      mapCtx.moveTo(-140 * scale, 0);
      mapCtx.lineTo(140 * scale, 0);
    }, 14, "#2a3038");
    strokeRoad(() => {
      mapCtx.moveTo(-140 * scale, 0);
      mapCtx.lineTo(140 * scale, 0);
    }, 11, "#4a5560");
    strokeRoad(() => {
      mapCtx.moveTo(0, -95 * scale);
      mapCtx.lineTo(0, 95 * scale);
    }, 14, "#2a3038");
    strokeRoad(() => {
      mapCtx.moveTo(0, -95 * scale);
      mapCtx.lineTo(0, 95 * scale);
    }, 11, "#4a5560");

    mapCtx.setLineDash([4, 5]);
    mapCtx.strokeStyle = "rgba(255,220,100,.75)";
    mapCtx.lineWidth = 1.2;
    mapCtx.beginPath();
    mapCtx.moveTo(-130 * scale, 0);
    mapCtx.lineTo(130 * scale, 0);
    mapCtx.moveTo(0, -85 * scale);
    mapCtx.lineTo(0, 85 * scale);
    mapCtx.stroke();
    mapCtx.setLineDash([]);

    // POI-markörer
    const pois = [
      { x: -90, z: 0, label: "P", color: "#3a8ad4" },
      { x: 0, z: -70, label: "⛽", color: "#d4a03a" },
      { x: 90, z: 20, label: "H", color: "#d44a4a" },
      { x: -30, z: 70, label: "★", color: "#5ad27a" },
    ];
    for (const poi of pois) {
      const qx = poi.x * scale;
      const qz = poi.z * scale;
      mapCtx.fillStyle = poi.color;
      mapCtx.beginPath();
      mapCtx.arc(qx, qz, 5, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.fillStyle = "#fff";
      mapCtx.font = "bold 7px sans-serif";
      mapCtx.textAlign = "center";
      mapCtx.textBaseline = "middle";
      mapCtx.fillText(poi.label, qx, qz + 0.5);
    }

    // Trafik
    for (let i = 0; i < state.traffic.length; i++) {
      const car = state.traffic[i];
      const ang = ((car.z % 64) / 64) * Math.PI * 2;
      const lane = car.oncoming ? 0.86 : 1.0;
      const cx = Math.cos(ang) * 140 * scale * lane * (car.x < 0 ? 0.92 : 1.02);
      const cy = Math.sin(ang) * 95 * scale * lane * (car.x < 0 ? 0.92 : 1.02);
      mapCtx.save();
      mapCtx.translate(cx, cy);
      mapCtx.rotate(ang + Math.PI / 2 + (car.oncoming ? Math.PI : 0));
      mapCtx.fillStyle = car.color;
      mapCtx.fillRect(-2.5, -4, 5, 8);
      mapCtx.fillStyle = "rgba(255,255,255,.35)";
      mapCtx.fillRect(-1.5, -3, 3, 2);
      mapCtx.restore();
    }

    mapCtx.restore();

    // Spelarpil (alltid i mitten, pekar upp)
    mapCtx.save();
    mapCtx.translate(ox, oy);
    // Skugga
    mapCtx.fillStyle = "rgba(0,0,0,.35)";
    mapCtx.beginPath();
    mapCtx.moveTo(0, -9);
    mapCtx.lineTo(7, 8);
    mapCtx.lineTo(0, 4);
    mapCtx.lineTo(-7, 8);
    mapCtx.closePath();
    mapCtx.fill();
    // Bilpil
    const arrow = mapCtx.createLinearGradient(0, -10, 0, 8);
    arrow.addColorStop(0, "#ff6a6a");
    arrow.addColorStop(1, "#c01020");
    mapCtx.fillStyle = arrow;
    mapCtx.beginPath();
    mapCtx.moveTo(0, -9);
    mapCtx.lineTo(6.5, 7);
    mapCtx.lineTo(0, 3.5);
    mapCtx.lineTo(-6.5, 7);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.strokeStyle = "#fff";
    mapCtx.lineWidth = 1;
    mapCtx.stroke();
    mapCtx.restore();

    // Kompass N
    mapCtx.save();
    mapCtx.translate(mw - 16, 16);
    mapCtx.rotate(-state.heading);
    mapCtx.fillStyle = "#e8f0f8";
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(4, 5);
    mapCtx.lineTo(0, 2);
    mapCtx.lineTo(-4, 5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.fillStyle = "#ff6a6a";
    mapCtx.font = "bold 8px sans-serif";
    mapCtx.textAlign = "center";
    mapCtx.fillText("N", 0, -9);
    mapCtx.restore();

    // Hastighet / GPS-hud
    const kmh = Math.round(Math.abs(state.speed) * 3.6);
    mapCtx.fillStyle = "rgba(0,0,0,.45)";
    mapCtx.fillRect(4, mh - 22, 48, 16);
    mapCtx.fillStyle = "#8dffb4";
    mapCtx.font = "bold 10px sans-serif";
    mapCtx.textAlign = "left";
    mapCtx.fillText(`${kmh}`, 8, mh - 10);
    mapCtx.fillStyle = "#9eb0c0";
    mapCtx.font = "8px sans-serif";
    mapCtx.fillText("km/h", 28, mh - 10);

    // Glasglans
    const sheen = mapCtx.createLinearGradient(0, 0, mw, mh);
    sheen.addColorStop(0, "rgba(255,255,255,.08)");
    sheen.addColorStop(0.4, "rgba(255,255,255,0)");
    sheen.addColorStop(1, "rgba(100,160,220,.06)");
    mapCtx.fillStyle = sheen;
    mapCtx.fillRect(0, 0, mw, mh);

    // Ram
    mapCtx.strokeStyle = "rgba(255,255,255,.22)";
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
    const extreme = state.driveMode === "extreme";
    const speedMul = extreme ? 2.5 : sport ? 1.22 : 0.78;
    const accelMul = extreme ? 12 : sport ? 1.45 : 0.62;
    // Interna enheter: km/h = speed * 3.6  →  växel 6 max 300 (sport) / 10000 (extreme)
    const top6 = extreme ? 10000 / 3.6 : 300 / 3.6;
    const gearMax = { R: 12, N: 0, 1: 22, 2: 28, 3: 40, 4: 55, 5: 70, 6: top6 };
    const gearSafe = { R: 12, N: 0, 1: 14, 2: 28, 3: 40, 4: 55, 5: 70, 6: extreme ? 9500 / 3.6 : 280 / 3.6 };
    const gearAccel = {
      R: extreme ? 40 : 16,
      N: 0,
      1: extreme ? 90 : 32,
      2: extreme ? 80 : 26,
      3: extreme ? 70 : 22,
      4: extreme ? 60 : 18,
      5: extreme ? 55 : 16,
      6: extreme ? 120 : 14,
    };
    const inGear = state.gear !== "N";
    const topMul = state.gear === "6" || extreme ? 1 : speedMul;
    const maxForGear = (gearMax[state.gear] || 0) * (state.gear === "6" ? 1 : topMul);
    const safeForGear = (gearSafe[state.gear] || 0) * (state.gear === "6" ? 1 : topMul);
    const baseAccel = (gearAccel[state.gear] || 0) * accelMul;

    let power = 0;
    if (gas && inGear) {
      if (state.gear === "R") {
        const room = Math.max(0.2, 1 - Math.abs(state.speed) / maxForGear);
        power = -baseAccel * room;
      } else {
        const room = Math.max(extreme ? 0.08 : 0.2, 1 - state.speed / Math.max(1, maxForGear));
        power = baseAccel * room;
        // Varningston: slut på "säker" fart i växeln (övervarv)
        if (!extreme && state.speed > safeForGear) power *= 0.85;
        if (!extreme && state.speed < 3 && state.gearIndex >= 4) power *= 0.45;
        else if (!extreme && state.speed < 2 && state.gearIndex >= 3) power *= 0.7;
      }
    }

    const brakeForce = brake ? (extreme ? 90 : sport ? 44 : 18) : 0;
    const drag = extreme
      ? 0.35 + Math.abs(state.speed) * 0.0012 + (Math.abs(state.playerX) > 0.95 ? 4 : 0)
      : 1.2 + Math.abs(state.speed) * 0.04 + (Math.abs(state.playerX) > 0.95 ? 8 : 0);
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
      state.speed = Math.max(0, Math.min(maxForGear || top6, state.speed));
    }

    const kmh = Math.abs(state.speed) * 3.6;

    // 1:an i 75 km/h → motorn går sönder (inte i Extreme)
    if (!extreme && state.gear === "1" && kmh >= 75) {
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

    // Tyngre ratt i fart, mer grepp i sport
    // Om man drar i ratten med musen: låt inte fysiken kämpa emot
    if (!state.wheelDragging) {
      const speedFactor = 1 / (1 + state.speed * (sport ? 0.032 : 0.048));
      const steerGain = sport ? 420 : 200;
      const selfCenter = sport ? 1.9 : 3.1;
      const damp = sport ? 4.2 : 6.6;
      state.steerRate += (turn * steerGain * speedFactor - state.steer * selfCenter - state.steerRate * damp) * dt;
    state.steer += state.steerRate * dt;
      state.steer = Math.max(-520, Math.min(520, state.steer));
    if (turn === 0) {
        state.steer *= 1 - Math.min(1, dt * (sport ? 1.8 : 2.6));
        state.steerRate *= 1 - Math.min(1, dt * (sport ? 2.8 : 3.8));
      }
    } else {
      state.steerRate = 0;
    }

    const pull = state.curve * 0.00125 * state.speed;
    const latGain = sport ? 0.55 : 0.26;
    state.playerX += (state.steer / 1180) * state.speed * dt * latGain - pull * dt;

    // Vägren / gräs — skumpar och bromsar
    if (Math.abs(state.playerX) > 0.92) {
      state.bump = Math.max(state.bump, 0.35 + Math.min(0.5, Math.abs(state.speed) * 0.02));
      state.speed *= 1 - dt * (1.1 + Math.abs(state.playerX - 0.92) * 2);
    }
    if (Math.abs(state.playerX) > 1.08) {
      state.speed *= 1 - dt * 0.9;
      state.playerX = Math.sign(state.playerX) * 1.08;
      state.bump = Math.max(state.bump, 0.7);
    }
    if (state.bump > 0) state.bump = Math.max(0, state.bump - dt * 2.4);

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
    else if (!state.exploded && !state.engineBroken && Math.abs(state.speed) > 2) {
      for (const car of state.traffic) {
        let rel = car.z - playerSeg;
        rel = ((rel % segments.length) + segments.length) % segments.length;
        if (rel > segments.length / 2) rel -= segments.length;
        if (rel > 0.35 && rel < 2.6 && Math.abs(car.x - state.playerX) < 0.2) {
          state.speed *= 0.42;
          state.bump = 1;
          state.hitCd = 0.85;
          state.carHits += 1;
          playBump();
          const left = 10 - state.carHits;
          if (state.carHits >= 10) {
            explodeCar();
          } else {
            hint.textContent = `Krock! ${state.carHits}/10 — ${left} kvar tills bilen exploderar`;
            toast(`Krock ${state.carHits}/10`, 1400);
          }
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
    } else if (Math.abs(state.playerX) > 0.92) {
      hint.textContent = "Vägren! Sväng tillbaka på asfalten";
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

  function playExplosionSound() {
    ensureAudio();
    if (!audio.ctx) return;
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    const dest = audio.sfx || ctx.destination;
    // Djup boom
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    o.type = "sawtooth";
    f.type = "lowpass";
    f.frequency.value = 180;
    o.connect(f);
    f.connect(g);
    g.connect(dest);
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.start(t);
    o.stop(t + 1.15);
    // Brus/eld
    const len = Math.floor(ctx.sampleRate * 0.7);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    const ng = ctx.createGain();
    const nf = ctx.createBiquadFilter();
    src.buffer = buf;
    nf.type = "bandpass";
    nf.frequency.value = 500;
    src.connect(nf);
    nf.connect(ng);
    ng.connect(dest);
    ng.gain.setValueAtTime(0.35, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.start(t);
  }

  function explodeCar() {
    if (state.exploded) return;
    state.exploded = true;
    state.carHits = 10;
    state.speed = 0;
    state.bump = 1.5;
    const boom = document.getElementById("carBoom");
    if (boom) {
      boom.hidden = false;
      boom.classList.remove("show");
      void boom.offsetWidth;
      boom.classList.add("show");
      clearTimeout(explodeCar._t);
      explodeCar._t = setTimeout(() => {
        boom.classList.remove("show");
        boom.hidden = true;
      }, 2200);
    }
    playExplosionSound();
    app.classList.add("car-exploded");
    breakEngine();
    hint.textContent = "💥 BILEN EXPLODERADE efter 10 krockar! Byt motor.";
    toast("💥 BOOM! 10 krockar — bilen exploderade!", 4500);
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
    if (!state.exploded) {
      hint.textContent = "BOOM! Motorn gick sönder. Tryck Byt motor.";
      toast("Motorn gick sönder! Du måste byta motor.", 4000);
    }
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
    state.exploded = false;
    state.carHits = 0;
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
    app.classList.remove("car-exploded");
    app.classList.remove("holding-engine");
    engineLight.classList.remove("on");
    const boom = document.getElementById("carBoom");
    if (boom) {
      boom.hidden = true;
      boom.classList.remove("show");
    }
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
    const steerDeg = state.steer * 0.2;
    // 3D-ratt: tippad mot föraren + snurr vid styrning
    steering.style.transform = `rotateX(28deg) rotateY(${(-state.steer * 0.012).toFixed(2)}deg) rotateZ(${steerDeg}deg) translateZ(8px)`;
    // 3D-kupé följer styrning och fart
    const roll = Math.max(-4.5, Math.min(4.5, state.steer * 0.007));
    const yaw = Math.max(-3.5, Math.min(3.5, -state.steer * 0.005));
    const pitch = Math.max(-2.5, Math.min(3, (state.input.up ? -1.8 : 0) + (state.input.down ? 2.2 : 0) + state.speed * 0.01));
    app.style.setProperty("--cabin-roll", `${roll}deg`);
    app.style.setProperty("--cabin-yaw", `${yaw}deg`);
    app.style.setProperty("--cabin-pitch", `${pitch}deg`);
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
    state.driveMode = mode === "extreme" ? "extreme" : mode === "sport" ? "sport" : "comfort";
    const sport = state.driveMode === "sport";
    const extreme = state.driveMode === "extreme";
    const comfort = state.driveMode === "comfort";
    modeComfortBtn.classList.toggle("on", comfort);
    modeSportBtn.classList.toggle("on", sport);
    modeExtremeBtn?.classList.toggle("on", extreme);
    modeComfortBtn.setAttribute("aria-pressed", String(comfort));
    modeSportBtn.setAttribute("aria-pressed", String(sport));
    modeExtremeBtn?.setAttribute("aria-pressed", String(extreme));
    app.classList.toggle("mode-sport", sport);
    app.classList.toggle("mode-comfort", comfort);
    app.classList.toggle("mode-extreme", extreme);
    if (announce && state.inside) {
      if (extreme) {
        hint.textContent = "EXTREME: max 10 000 km/h — växla till 6:an och gasa!";
        toast("EXTREME MODE — 10 000 km/h 🚀", 2200);
      } else if (sport) {
        hint.textContent = "Sportläge: snabb gas, vass styrning, högt ljud";
        toast("Sportläge på", 1600);
      } else {
        hint.textContent = "Komfortläge: mjuk gas, lugn styrning, tystare";
        toast("Komfortläge på", 1600);
      }
    }
    if (carScreenState.app === "korlage") openCarApp("korlage");
  }

  // —— Bilskärm med appar ——
  const carScreen = document.getElementById("carScreen");
  const screenHome = document.getElementById("screenHome");
  const screenApp = document.getElementById("screenApp");
  const screenAppBody = document.getElementById("screenAppBody");
  const screenAppTitle = document.getElementById("screenAppTitle");
  const screenOff = document.getElementById("screenOff");
  const screenApps = document.getElementById("screenApps");
  const screenTime = document.getElementById("screenTime");

  const carScreenState = {
    app: null,
    off: false,
    musicOn: false,
    radioOn: false,
    track: 0,
    temp: 21,
    ac: true,
    radio: 0,
    call: null,
    ytId: null,
  };

  const SCREEN_APPS = [
    { id: "musik", name: "Musik", icon: "♪" },
    { id: "youtube", name: "YouTube", icon: "▶" },
    { id: "navi", name: "Navi", icon: "◎" },
    { id: "klimat", name: "Klimat", icon: "❄" },
    { id: "telefon", name: "Telefon", icon: "☎" },
    { id: "korlage", name: "Körläge", icon: "⚑" },
    { id: "radio", name: "Radio", icon: "◈" },
  ];

  const YT_PRESETS = [
    { id: "jfKfPfyJRdk", label: "Lofi" },
    { id: "5qap5aO4i9A", label: "Chill" },
    { id: "DWcJFNf70Ic", label: "Drive" },
    { id: "aqz-KE-bpKQ", label: "Big Buck" },
    { id: "kJQP7kiw5Fk", label: "Despacito" },
    { id: "9bZkp7q19f0", label: "Gangnam" },
    { id: "OPf0YbXqDm0", label: "Uptown" },
    { id: "60ItHLz5WEA", label: "Faded" },
    { id: "JGwWNGJdvx8", label: "Shape" },
    { id: "fJ9rUzIMcZQ", label: "Queen" },
    { id: "hT_nvWreIhg", label: "Counting" },
    { id: "YQHsXMglC9A", label: "Hello" },
  ];

  // TikTok-flöde (många korta/kul YouTube-klipp)
  const TIKTOK_VIDEOS = [
    { id: "kJQP7kiw5Fk", user: "@luis_fonsi", caption: "Despacito vibes 🔥", likes: "12.4M" },
    { id: "9bZkp7q19f0", user: "@psy", caption: "Gangnam Style forever", likes: "9.1M" },
    { id: "OPf0YbXqDm0", user: "@bruno", caption: "Uptown Funk 🕺", likes: "7.8M" },
    { id: "60ItHLz5WEA", user: "@alanwalker", caption: "Faded — night drive", likes: "6.2M" },
    { id: "JGwWNGJdvx8", user: "@edsheeran", caption: "Shape of You", likes: "11M" },
    { id: "fJ9rUzIMcZQ", user: "@queen", caption: "Bohemian Rhapsody", likes: "8.4M" },
    { id: "hT_nvWreIhg", user: "@onerepublic", caption: "Counting Stars", likes: "5.5M" },
    { id: "YQHsXMglC9A", user: "@adele", caption: "Hello from the other side", likes: "10.2M" },
    { id: "RgKAFK5djSk", user: "@mileycyrus", caption: "Wrecking Ball", likes: "4.9M" },
    { id: "CevxZvSJLk8", user: "@katyperry", caption: "Roar 🦁", likes: "6.7M" },
    { id: "e-ORhEE9VVg", user: "@taylorswift", caption: "Blank Space", likes: "9.3M" },
    { id: "pRpeEdMmmQ0", user: "@shakira", caption: "Waka Waka ⚽", likes: "7.1M" },
    { id: "PT2_F-1esPk", user: "@theweeknd", caption: "Blinding Lights", likes: "8.8M" },
    { id: "2Vv-BfVoq4g", user: "@edsheeran", caption: "Perfect", likes: "5.9M" },
    { id: "lp-EO5I60KA", user: "@eminem", caption: "Lose Yourself", likes: "4.2M" },
    { id: "rYEDA3JcQqw", user: "@adele", caption: "Rolling in the Deep", likes: "6.0M" },
    { id: "09R8_2nJtjg", user: "@maroon5", caption: "Sugar", likes: "5.1M" },
    { id: "ru0K8uYEZWw", user: "@justinbieber", caption: "Sorry", likes: "4.6M" },
    { id: "0KSOMA3QBU0", user: "@katyperry", caption: "Dark Horse", likes: "5.3M" },
    { id: "hTWKbfoikeg", user: "@nirvana", caption: "Smells Like Teen Spirit", likes: "3.8M" },
    { id: "fKopy74weus", user: "@imagine", caption: "Thunder", likes: "4.4M" },
    { id: "DyDfgMOUjCI", user: "@billie", caption: "bad guy vibes", likes: "7.5M" },
    { id: "LsoLMvh55uM", user: "@postmalone", caption: "Circles", likes: "3.9M" },
    { id: "DGtyOiOzCxU", user: "@dualipa", caption: "New Rules", likes: "4.7M" },
    { id: "il2irL2HAkw", user: "@theweeknd", caption: "Starboy", likes: "5.0M" },
    { id: "aJOTlE1K90k", user: "@maroon5", caption: "Girls Like You", likes: "6.3M" },
    { id: "VuNIsY6JdUw", user: "@taylorswift", caption: "You Belong With Me", likes: "3.5M" },
    { id: "nfWlot6h_JM", user: "@taylorswift", caption: "Shake It Off", likes: "8.1M" },
    { id: "QYh6mYIJG2Y", user: "@arianagrande", caption: "7 rings", likes: "4.0M" },
    { id: "tcYodMQYZoQ", user: "@dualipa", caption: "Don't Start Now", likes: "3.6M" },
    { id: "SlPhMPnQ58k", user: "@avicii", caption: "Wake Me Up", likes: "5.8M" },
    { id: "IcrbM1l_BoI", user: "@avicii", caption: "Levels", likes: "4.1M" },
    { id: "ygTXCb2evr0", user: "@calvinharris", caption: "Summer", likes: "3.2M" },
    { id: "y6120QOlsfU", user: "@sandstorm", caption: "Sandstorm ⚡", likes: "2.9M" },
    { id: "dQw4w9WgXcQ", user: "@rickastley", caption: "Never Gonna Give You Up", likes: "15M" },
    { id: "jNQXAC9IVRw", user: "@jawed", caption: "Me at the zoo 🦒", likes: "1.2M" },
    { id: "aqz-KE-bpKQ", user: "@blender", caption: "Big Buck Bunny", likes: "2.1M" },
    { id: "jfKfPfyJRdk", user: "@lofi", caption: "lofi hip hop radio 📚", likes: "20M" },
    { id: "5qap5aO4i9A", user: "@chillhop", caption: "Chill beats to drive to", likes: "9.5M" },
    { id: "DWcJFNf70Ic", user: "@nermin_drive", caption: "Night highway ASMR", likes: "1.8M" },
    { id: "ZbZSe6N_BXs", user: "@pharrell", caption: "Happy 😄", likes: "6.9M" },
    { id: "ktvTqknDobU", user: "@imaginedragons", caption: "Radioactive", likes: "4.8M" },
    { id: "fLexgOxsZu0", user: "@bruno", caption: "24K Magic", likes: "3.3M" },
    { id: "2vjPBrBU-TM", user: "@sia", caption: "Chandelier", likes: "5.4M" },
    { id: "YykjpeuMNEk", user: "@coldplay", caption: "Hymn For The Weekend", likes: "4.5M" },
    { id: "dvgZkm1xWPE", user: "@coldplay", caption: "Viva La Vida", likes: "3.7M" },
    { id: "UceaB4D0jpo", user: "@calvinharris", caption: "This Is What You Came For", likes: "3.1M" },
    { id: "iS1g8G_njx8", user: "@seanpaul", caption: "Temperature", likes: "2.4M" },
    { id: "lWA2pjMjpBs", user: "@rihanna", caption: "Diamonds", likes: "5.6M" },
    { id: "HL1UzIK-flA", user: "@rihanna", caption: "We Found Love", likes: "4.3M" },
    { id: "bpOSxM0rNPM", user: "@arianagrande", caption: "Into You", likes: "2.8M" },
    { id: "gCYcHz2k5x0", user: "@martingarrix", caption: "Animals", likes: "3.0M" },
    { id: "IcrbM1l_BoI", user: "@dj_nermin", caption: "Club mix energy", likes: "1.1M" },
    { id: "hT_nvWreIhg", user: "@roadtrip_sv", caption: "Sverige roadtrip 🇸🇪", likes: "890K" },
    { id: "PT2_F-1esPk", user: "@city_nights", caption: "Neon city TikTok", likes: "2.2M" },
    { id: "2Vv-BfVoq4g", user: "@love_songs", caption: "Romantic drive 💕", likes: "1.5M" },
    { id: "60ItHLz5WEA", user: "@bassboost", caption: "Bass boosted Faded", likes: "3.4M" },
    { id: "OPf0YbXqDm0", user: "@dancecrew", caption: "Funk challenge", likes: "6.1M" },
    { id: "9bZkp7q19f0", user: "@kpop_daily", caption: "Dance tutorial", likes: "2.7M" },
    { id: "kJQP7kiw5Fk", user: "@latina_hits", caption: "Summer hit replay", likes: "4.9M" },
    { id: "dQw4w9WgXcQ", user: "@prankking", caption: "Gotcha 😂", likes: "8.2M" },
    { id: "jfKfPfyJRdk", user: "@studywithme", caption: "Focus with me", likes: "12M" },
    { id: "aqz-KE-bpKQ", user: "@animation", caption: "Cute bunny chaos", likes: "1.9M" },
    { id: "jNQXAC9IVRw", user: "@history", caption: "First YouTube ever", likes: "2.0M" },
    { id: "fJ9rUzIMcZQ", user: "@rock_classics", caption: "Rockklassiker moment", likes: "3.8M" },
    { id: "hTWKbfoikeg", user: "@grunge", caption: "90s energy", likes: "2.5M" },
    { id: "ZbZSe6N_BXs", user: "@feelgood", caption: "Smile more ✨", likes: "5.2M" },
    { id: "e-ORhEE9VVg", user: "@swifties", caption: "Era tour vibes", likes: "7.0M" },
    { id: "nfWlot6h_JM", user: "@party_sv", caption: "Shake it off remix", likes: "1.6M" },
    { id: "SlPhMPnQ58k", user: "@festival", caption: "Festival flashback", likes: "2.3M" },
    { id: "YykjpeuMNEk", user: "@coldplay_live", caption: "Live lights show", likes: "3.9M" },
    { id: "lWA2pjMjpBs", user: "@glam", caption: "Diamond glow up", likes: "2.6M" },
    { id: "dvgZkm1xWPE", user: "@epic_hits", caption: "Viva la vida edit", likes: "1.4M" },
    { id: "ygTXCb2evr0", user: "@summer_mix", caption: "Beach party TikTok", likes: "2.0M" },
    { id: "UceaB4D0jpo", user: "@club_drop", caption: "Drop the beat 💥", likes: "1.7M" },
    { id: "gCYcHz2k5x0", user: "@edm_only", caption: "Animals remix", likes: "2.1M" },
    { id: "fLexgOxsZu0", user: "@partyking", caption: "24K flex", likes: "1.3M" },
    { id: "2vjPBrBU-TM", user: "@dance_stage", caption: "Chandelier cover", likes: "1.9M" },
    { id: "HL1UzIK-flA", user: "@love_hits", caption: "We Found Love", likes: "2.8M" },
    { id: "bpOSxM0rNPM", user: "@ariana_fan", caption: "Into You dance", likes: "1.5M" },
    { id: "VuNIsY6JdUw", user: "@swift_era", caption: "Belong with me", likes: "2.4M" },
    { id: "il2irL2HAkw", user: "@starboy_sv", caption: "Starboy night", likes: "1.8M" },
    { id: "LsoLMvh55uM", user: "@posty", caption: "Circles on loop", likes: "2.2M" },
    { id: "DyDfgMOUjCI", user: "@billie_e", caption: "bad guy energy", likes: "3.5M" },
    { id: "09R8_2nJtjg", user: "@sweet_tooth", caption: "Sugar challenge", likes: "1.6M" },
    { id: "ru0K8uYEZWw", user: "@jb_forever", caption: "Sorry not sorry", likes: "2.0M" },
    { id: "0KSOMA3QBU0", user: "@katy_fan", caption: "Dark Horse trend", likes: "1.4M" },
    { id: "rYEDA3JcQqw", user: "@adele_tears", caption: "Deep feels", likes: "2.9M" },
    { id: "lp-EO5I60KA", user: "@rap_motivation", caption: "Lose Yourself gym", likes: "3.1M" },
    { id: "pRpeEdMmmQ0", user: "@worldcup", caption: "Waka Waka 2026", likes: "4.0M" },
    { id: "RgKAFK5djSk", user: "@miley_mood", caption: "Wrecking Ball", likes: "2.3M" },
    { id: "CevxZvSJLk8", user: "@roar_mode", caption: "I got the eye of the tiger", likes: "2.7M" },
    { id: "hT_nvWreIhg", user: "@stars_above", caption: "Counting Stars night", likes: "1.7M" },
    { id: "YQHsXMglC9A", user: "@hello_again", caption: "Hello? It's me", likes: "3.3M" },
  ];

  const SNAP_STORIES = [
    { name: "Mamma", id: "YQHsXMglC9A", time: "2m", color: "#ff6b9d" },
    { name: "Kompis", id: "OPf0YbXqDm0", time: "8m", color: "#6ad0ff" },
    { name: "Nermin", id: "PT2_F-1esPk", time: "15m", color: "#8dffb4" },
    { name: "Verkstad", id: "aqz-KE-bpKQ", time: "22m", color: "#ffb84d" },
    { name: "Taxi", id: "60ItHLz5WEA", time: "31m", color: "#c9a0ff" },
    { name: "Lisa", id: "2Vv-BfVoq4g", time: "45m", color: "#ff8fab" },
    { name: "Erik", id: "JGwWNGJdvx8", time: "1h", color: "#7ec8ff" },
    { name: "Sara", id: "nfWlot6h_JM", time: "1h", color: "#ffe066" },
    { name: "Jonas", id: "kJQP7kiw5Fk", time: "2h", color: "#69db7c" },
    { name: "Anna", id: "e-ORhEE9VVg", time: "2h", color: "#ff8787" },
    { name: "Pelle", id: "9bZkp7q19f0", time: "3h", color: "#74c0fc" },
    { name: "Mia", id: "CevxZvSJLk8", time: "3h", color: "#da77f2" },
    { name: "Alex", id: "dQw4w9WgXcQ", time: "4h", color: "#63e6be" },
    { name: "Nora", id: "fJ9rUzIMcZQ", time: "5h", color: "#ffa8a8" },
    { name: "Omar", id: "hTWKbfoikeg", time: "6h", color: "#a5d8ff" },
    { name: "Kim", id: "ZbZSe6N_BXs", time: "7h", color: "#ffec99" },
    { name: "Leo", id: "SlPhMPnQ58k", time: "8h", color: "#b2f2bb" },
    { name: "Freja", id: "lWA2pjMjpBs", time: "9h", color: "#e599f7" },
    { name: "Hugo", id: "ktvTqknDobU", time: "10h", color: "#ffc9c9" },
    { name: "Ella", id: "aJOTlE1K90k", time: "11h", color: "#99e9f2" },
    { name: "Viktor", id: "DGtyOiOzCxU", time: "12h", color: "#ffd8a8" },
    { name: "Wilma", id: "QYh6mYIJG2Y", time: "14h", color: "#d0bfff" },
    { name: "Isak", id: "y6120QOlsfU", time: "16h", color: "#96f2d7" },
    { name: "Alva", id: "tcYodMQYZoQ", time: "18h", color: "#ffc9de" },
  ];

  const PHONE_YT_VIDEOS = [
    { id: "jfKfPfyJRdk", title: "lofi hip hop radio — beats to relax/study to", ch: "Lofi Girl" },
    { id: "5qap5aO4i9A", title: "Chillhop Radio — jazzy & lofi hip hop beats", ch: "Chillhop Music" },
    { id: "DWcJFNf70Ic", title: "Night Drive Mix — synthwave", ch: "Nermin Drive" },
    { id: "aqz-KE-bpKQ", title: "Big Buck Bunny", ch: "Blender Foundation" },
    { id: "kJQP7kiw5Fk", title: "Luis Fonsi — Despacito ft. Daddy Yankee", ch: "Luis Fonsi" },
    { id: "9bZkp7q19f0", title: "PSY — GANGNAM STYLE", ch: "officialpsy" },
    { id: "OPf0YbXqDm0", title: "Mark Ronson — Uptown Funk ft. Bruno Mars", ch: "MarkRonsonVEVO" },
    { id: "60ItHLz5WEA", title: "Alan Walker — Faded", ch: "Alan Walker" },
    { id: "JGwWNGJdvx8", title: "Ed Sheeran — Shape of You", ch: "Ed Sheeran" },
    { id: "fJ9rUzIMcZQ", title: "Queen — Bohemian Rhapsody", ch: "Queen Official" },
    { id: "hT_nvWreIhg", title: "OneRepublic — Counting Stars", ch: "OneRepublic" },
    { id: "YQHsXMglC9A", title: "Adele — Hello", ch: "Adele" },
    { id: "RgKAFK5djSk", title: "Miley Cyrus — Wrecking Ball", ch: "Miley Cyrus" },
    { id: "CevxZvSJLk8", title: "Katy Perry — Roar", ch: "KatyPerryVEVO" },
    { id: "e-ORhEE9VVg", title: "Taylor Swift — Blank Space", ch: "Taylor Swift" },
    { id: "pRpeEdMmmQ0", title: "Shakira — Waka Waka", ch: "Shakira" },
    { id: "PT2_F-1esPk", title: "The Weeknd — Blinding Lights", ch: "The Weeknd" },
    { id: "2Vv-BfVoq4g", title: "Ed Sheeran — Perfect", ch: "Ed Sheeran" },
    { id: "lp-EO5I60KA", title: "Eminem — Lose Yourself", ch: "EminemMusic" },
    { id: "rYEDA3JcQqw", title: "Adele — Rolling in the Deep", ch: "Adele" },
    { id: "09R8_2nJtjg", title: "Maroon 5 — Sugar", ch: "Maroon5VEVO" },
    { id: "ru0K8uYEZWw", title: "Justin Bieber — Sorry", ch: "JustinBieberVEVO" },
    { id: "0KSOMA3QBU0", title: "Katy Perry — Dark Horse", ch: "KatyPerryVEVO" },
    { id: "hTWKbfoikeg", title: "Nirvana — Smells Like Teen Spirit", ch: "Nirvana" },
    { id: "fKopy74weus", title: "Imagine Dragons — Thunder", ch: "ImagineDragons" },
    { id: "LsoLMvh55uM", title: "Post Malone — Circles", ch: "Post Malone" },
    { id: "DGtyOiOzCxU", title: "Dua Lipa — New Rules", ch: "Dua Lipa" },
    { id: "aJOTlE1K90k", title: "Maroon 5 — Girls Like You", ch: "Maroon 5" },
    { id: "nfWlot6h_JM", title: "Taylor Swift — Shake It Off", ch: "Taylor Swift" },
    { id: "QYh6mYIJG2Y", title: "Ariana Grande — 7 rings", ch: "Ariana Grande" },
    { id: "tcYodMQYZoQ", title: "Dua Lipa — Don't Start Now", ch: "Dua Lipa" },
    { id: "SlPhMPnQ58k", title: "Avicii — Wake Me Up", ch: "Avicii" },
    { id: "IcrbM1l_BoI", title: "Avicii — Levels", ch: "Avicii" },
    { id: "y6120QOlsfU", title: "Darude — Sandstorm", ch: "Darude" },
    { id: "dQw4w9WgXcQ", title: "Rick Astley — Never Gonna Give You Up", ch: "RickAstleyVEVO" },
    { id: "jNQXAC9IVRw", title: "Me at the zoo", ch: "jawed" },
    { id: "ZbZSe6N_BXs", title: "Pharrell Williams — Happy", ch: "PharrellWilliamsVEVO" },
    { id: "ktvTqknDobU", title: "Imagine Dragons — Radioactive", ch: "ImagineDragonsVEVO" },
    { id: "fLexgOxsZu0", title: "Bruno Mars — 24K Magic", ch: "Bruno Mars" },
    { id: "2vjPBrBU-TM", title: "Sia — Chandelier", ch: "Sia" },
    { id: "YykjpeuMNEk", title: "Coldplay — Hymn For The Weekend", ch: "Coldplay" },
    { id: "dvgZkm1xWPE", title: "Coldplay — Viva La Vida", ch: "Coldplay" },
    { id: "UceaB4D0jpo", title: "Calvin Harris — This Is What You Came For", ch: "CalvinHarrisVEVO" },
    { id: "lWA2pjMjpBs", title: "Rihanna — Diamonds", ch: "RihannaVEVO" },
    { id: "HL1UzIK-flA", title: "Rihanna — We Found Love", ch: "RihannaVEVO" },
    { id: "gCYcHz2k5x0", title: "Martin Garrix — Animals", ch: "Martin Garrix" },
    { id: "VuNIsY6JdUw", title: "Taylor Swift — You Belong With Me", ch: "Taylor Swift" },
    { id: "il2irL2HAkw", title: "The Weeknd — Starboy", ch: "The Weeknd" },
  ];

  const TRACKS = MUSIC_TRACKS.map((t) => t.name);
  const STATIONS = RADIO_STATIONS.map((s) => s.name);
  const CONTACTS = ["Mamma", "Kompis", "Verkstad", "Nermin"];
  const PLACES = ["Hem", "Ring-ateljé", "Bensinstation", "Stad"];

  const phoneState = {
    open: false,
    app: "home",
    ttIndex: 0,
    ttLiked: new Set(),
    snapSeen: new Set(),
    ytId: null,
    settings: {
      brightness: 100,
      sound: true,
      autoplay: true,
      wallpaper: "default",
      name: "Nermin",
    },
    bluetooth: {
      on: true,
      connecting: null,
      connected: new Set(),
    },
    wifi: {
      on: true,
      connecting: null,
      connected: "nermin-car",
    },
    sms: {
      active: null,
      threads: {
        Mamma: [
          { from: "them", text: "Kommer du hem snart?", time: "12:01" },
          { from: "me", text: "Ja, kör bilen nu 🚗", time: "12:02" },
        ],
        Kompis: [
          { from: "them", text: "Spelar du in TikTok?", time: "11:40" },
          { from: "me", text: "Självklart 😂", time: "11:41" },
        ],
        Verkstad: [
          { from: "them", text: "Din motor är klar imorgon", time: "Igår" },
        ],
        Nermin: [
          { from: "them", text: "Välkommen till Nermin Phone!", time: "09:00" },
        ],
        Taxi: [{ from: "them", text: "Bilen är 5 min bort", time: "08:15" }],
      },
    },
    dial: "",
    notes: "Handla bensin\nRing mamma\nKör till stan",
    photos: [],
    camStream: null,
    camFacing: "user",
    snapShot: null,
    myStory: [],
  };

  function stopPhoneCamera() {
    const stream = phoneState.camStream;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      phoneState.camStream = null;
    }
    const video = document.getElementById("phoneCamVideo");
    if (video) video.srcObject = null;
    const snapVid = document.getElementById("snapCamVideo");
    if (snapVid) snapVid.srcObject = null;
  }

  async function startPhoneCameraStream(videoEl, hintEl, facing = "user") {
    stopPhoneCamera();
    if (hintEl) hintEl.textContent = "Startar kamera…";
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      phoneState.camStream = stream;
      phoneState.camFacing = facing;
      if (videoEl) {
        videoEl.srcObject = stream;
        await videoEl.play().catch(() => {});
      }
      if (hintEl) hintEl.textContent = "";
      return true;
    } catch (_) {
      if (hintEl) hintEl.textContent = "Ingen kamera — tryck för simulerad snap";
      return false;
    }
  }

  function captureFromVideo(videoEl) {
    if (videoEl?.srcObject && videoEl.videoWidth > 0) {
      const canvas = document.createElement("canvas");
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const c = canvas.getContext("2d");
      if (phoneState.camFacing !== "environment") {
        c.translate(canvas.width, 0);
        c.scale(-1, 1);
      }
      c.drawImage(videoEl, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.85);
    }
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 640;
    const c = canvas.getContext("2d");
    const g = c.createLinearGradient(0, 0, 0, 640);
    g.addColorStop(0, "#fffc00");
    g.addColorStop(0.35, "#1a2838");
    g.addColorStop(1, "#0a1018");
    c.fillStyle = g;
    c.fillRect(0, 0, 480, 640);
    c.fillStyle = "#111";
    c.font = "bold 36px Outfit, sans-serif";
    c.fillText("Snap!", 190, 320);
    c.fillStyle = "#fff";
    c.font = "16px sans-serif";
    c.fillText(new Date().toLocaleString("sv-SE"), 140, 580);
    return canvas.toDataURL("image/jpeg", 0.9);
  }

  function openPhotoViewer(index) {
    const p = phoneState.photos[index];
    if (!p?.src) return;
    let overlay = document.getElementById("photoViewer");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "photoViewer";
      overlay.className = "photo-viewer";
      overlay.innerHTML = `
        <img id="photoViewerImg" alt="Foto" />
        <button type="button" class="photo-viewer-close" id="photoViewerClose">✕</button>
        <button type="button" class="photo-viewer-del" id="photoViewerDel">Radera</button>
      `;
      document.getElementById("phoneDisplay")?.appendChild(overlay);
      overlay.querySelector("#photoViewerClose")?.addEventListener("click", () => {
        overlay.hidden = true;
      });
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.hidden = true;
      });
    }
    const img = overlay.querySelector("#photoViewerImg");
    if (img) img.src = p.src;
    overlay.hidden = false;
    const del = overlay.querySelector("#photoViewerDel");
    if (del) {
      del.onclick = () => {
        phoneState.photos.splice(index, 1);
        overlay.hidden = true;
        toast("Foto raderat", 1200);
        if (phoneState.app === "photos") renderSimpleApp("photos");
      };
    }
  }

  const WIFI_NETWORKS = [
    { id: "nermin-car", name: "Nermin_Car_Hotspot", lock: true, bars: 4 },
    { id: "home", name: "Nermin-Hem", lock: true, bars: 3 },
    { id: "cafe", name: "Cafe_Free_WiFi", lock: false, bars: 2 },
    { id: "guest", name: "Guest_5G", lock: true, bars: 2 },
    { id: "mall", name: "ShoppingCenter", lock: false, bars: 1 },
    { id: "stadium", name: "Arena_Public", lock: false, bars: 1 },
  ];

  const BT_DEVICES = [
    { id: "car", name: "Nermin Sportbil", type: "Bilen", icon: "🚗", hint: "Ljud & handsfree" },
    { id: "airpods", name: "AirPods Pro", type: "Hörlurar", icon: "🎧", hint: "Trådlösa lurar" },
    { id: "speaker", name: "Nermin Högtalare", type: "Högtalare", icon: "🔊", hint: "Portabel bass" },
    { id: "tv", name: "Vardagsrums-TV", type: "TV", icon: "📺", hint: "Skärm & ljud" },
    { id: "speaker2", name: "JBL Boombox", type: "Högtalare", icon: "🔈", hint: "Party-läge" },
    { id: "airpods2", name: "AirPods Max", type: "Hörlurar", icon: "🎵", hint: "Over-ear" },
  ];

  const callOverlay = document.getElementById("callOverlay");
  const callCard = callOverlay?.querySelector(".call-card");
  const callNameEl = document.getElementById("callName");
  const callStatusEl = document.getElementById("callStatus");
  const callAnswerBtn = document.getElementById("callAnswer");
  const callDeclineBtn = document.getElementById("callDecline");
  const callHangupBtn = document.getElementById("callHangup");

  const phoneCall = {
    phase: "idle", // idle | ringing | talking
    caller: null,
    nextAt: 0,
    missTimer: null,
    ringTimer: null,
    talkTimer: null,
    musicWas: null,
  };

  function duckMusicForCall(on) {
    if (!audio.music?.gain || !audio.ctx) return;
    const g = audio.music.gain.gain;
    const now = audio.ctx.currentTime;
    if (on) {
      phoneCall.musicWas = g.value;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(Math.min(g.value, 0.04), now + 0.15);
    } else if (phoneCall.musicWas != null) {
      const target = audio.music.playing ? Math.max(phoneCall.musicWas, 0.18) : 0;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(target, now + 0.2);
      phoneCall.musicWas = null;
    }
  }

  function stopRingtone() {
    clearInterval(phoneCall.ringTimer);
    phoneCall.ringTimer = null;
  }

  function hideCallOverlay() {
    if (callOverlay) callOverlay.hidden = true;
    callCard?.classList.remove("talking");
    app.classList.remove("phone-ringing");
    if (callAnswerBtn) callAnswerBtn.hidden = false;
    if (callDeclineBtn) callDeclineBtn.hidden = false;
    if (callHangupBtn) callHangupBtn.hidden = true;
  }

  function endPhoneCall(message) {
    clearTimeout(phoneCall.missTimer);
    clearTimeout(phoneCall.talkTimer);
    phoneCall.missTimer = null;
    phoneCall.talkTimer = null;
    stopRingtone();
    duckMusicForCall(false);
    const who = phoneCall.caller;
    phoneCall.phase = "idle";
    phoneCall.caller = null;
    if (carScreenState.call === who) carScreenState.call = null;
    hideCallOverlay();
    if (carScreenState.app === "telefon") renderCarApp("telefon");
    if (message) toast(message, 1600);
  }

  function hangupIncomingCall() {
    if (phoneCall.phase !== "talking" && phoneCall.phase !== "ringing") return;
    endPhoneCall(`Samtal med ${phoneCall.caller || "kontakt"} avslutat`);
  }

  callHangupBtn?.addEventListener("click", hangupIncomingCall);
  callDeclineBtn?.addEventListener("click", hangupIncomingCall);
  callAnswerBtn?.addEventListener("click", () => {
    /* Inkommande samtal borttagna */
  });

  function tickScreenClock() {
    if (!screenTime) return;
    const d = new Date();
    screenTime.textContent = d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  }

  function renderScreenHome() {
    if (!screenApps) return;
    screenApps.innerHTML = "";
    for (const item of SCREEN_APPS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "screen-app-btn";
      btn.setAttribute("role", "listitem");
      btn.dataset.app = item.id;
      btn.innerHTML = `<span class="screen-app-icon ${item.id}">${item.icon}</span><span>${item.name}</span>`;
      btn.addEventListener("click", () => openCarApp(item.id));
      screenApps.appendChild(btn);
    }
  }

  function showScreenHome() {
    carScreenState.app = null;
    closeYouTube(false);
    const frame = document.getElementById("ytFrame");
    const wrap = document.querySelector(".yt-player-wrap");
    if (frame) frame.src = "";
    wrap?.classList.remove("has-video");
    carScreenState.ytId = null;
    if (screenHome) screenHome.hidden = false;
    if (screenApp) screenApp.hidden = true;
    if (screenOff) screenOff.hidden = true;
  }

  function setScreenPower(on) {
    carScreenState.off = !on;
    if (carScreen) carScreen.dataset.off = on ? "0" : "1";
    if (screenOff) screenOff.hidden = on;
    if (!on) {
      if (screenHome) screenHome.hidden = true;
      if (screenApp) screenApp.hidden = true;
    } else {
      showScreenHome();
    }
  }

  function parseYouTubeId(input) {
    if (!input) return null;
    const raw = String(input).trim();
    if (/^[\w-]{11}$/.test(raw)) return raw;
    try {
      const url = new URL(raw);
      if (url.hostname.includes("youtu.be")) {
        const id = url.pathname.split("/").filter(Boolean)[0];
        return id && /^[\w-]{11}$/.test(id) ? id : null;
      }
      if (url.hostname.includes("youtube.com") || url.hostname.includes("youtube-nocookie.com")) {
        const v = url.searchParams.get("v");
        if (v && /^[\w-]{11}$/.test(v)) return v;
        const parts = url.pathname.split("/").filter(Boolean);
        const markers = ["embed", "shorts", "live", "v"];
        for (let i = 0; i < parts.length - 1; i++) {
          if (markers.includes(parts[i]) && /^[\w-]{11}$/.test(parts[i + 1])) return parts[i + 1];
        }
      }
    } catch (_) {
      /* ignore */
    }
    const m = raw.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  function playYouTube(videoId) {
    const frame = document.getElementById("ytFrame");
    const wrap = document.querySelector(".yt-player-wrap");
    const input = document.getElementById("ytInput");
    if (!frame || !videoId) return;
    // Pausa bilmusik/radio så YouTube hörs
    stopMusic();
    carScreenState.ytId = videoId;
    frame.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
    wrap?.classList.add("has-video");
    if (input) input.value = `https://youtu.be/${videoId}`;
    document.querySelectorAll(".yt-preset").forEach((btn) => {
      btn.classList.toggle("on", btn.dataset.id === videoId);
    });
    toast("YouTube spelar", 1200);
  }

  function openYouTube() {
    const overlay = document.getElementById("ytOverlay");
    if (!overlay) return;
    overlay.hidden = false;
    carScreenState.app = "youtube";
    if (screenHome) screenHome.hidden = true;
    if (screenApp) {
      screenApp.hidden = false;
      if (screenAppTitle) screenAppTitle.textContent = "YouTube";
      if (screenAppBody) {
        screenAppBody.innerHTML = "";
        const p = document.createElement("p");
        p.textContent = "Stor skärm öppen";
        const row = document.createElement("div");
        row.className = "screen-row";
        row.append(
          action("Visa skärm", {
            primary: true,
            onClick: () => {
              overlay.hidden = false;
            },
          }),
          action("Stäng", {
            onClick: closeYouTube,
          })
        );
        screenAppBody.append(p, row);
      }
    }
    if (!carScreenState.ytId) {
      // Starta med en preset så det syns direkt
      playYouTube(YT_PRESETS[0].id);
    }
  }

  function closeYouTube(full = false) {
    const overlay = document.getElementById("ytOverlay");
    const frame = document.getElementById("ytFrame");
    const wrap = document.querySelector(".yt-player-wrap");
    if (overlay) overlay.hidden = true;
    if (full) {
      if (frame) frame.src = "";
      wrap?.classList.remove("has-video");
      carScreenState.ytId = null;
      document.querySelectorAll(".yt-preset").forEach((btn) => btn.classList.remove("on"));
      showScreenHome();
    }
  }

  function initYouTube() {
    const presets = document.getElementById("ytPresets");
    const form = document.getElementById("ytForm");
    const closeBtn = document.getElementById("ytClose");
    if (presets) {
      presets.innerHTML = "";
      for (const item of YT_PRESETS) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "yt-preset";
        btn.dataset.id = item.id;
        btn.textContent = item.label;
        btn.addEventListener("click", () => playYouTube(item.id));
        presets.appendChild(btn);
      }
    }
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("ytInput");
      const id = parseYouTubeId(input?.value || "");
      if (!id) {
        toast("Klistra in en giltig YouTube-länk", 1800);
        return;
      }
      playYouTube(id);
    });
    closeBtn?.addEventListener("click", () => closeYouTube(true));
    document.getElementById("ytOverlay")?.addEventListener("click", (e) => {
      if (e.target.id === "ytOverlay") closeYouTube(false);
    });
  }

  function openCarApp(id) {
    if (carScreenState.off) return;
    const meta = SCREEN_APPS.find((a) => a.id === id);
    if (!meta) return;
    if (id === "youtube") {
      openYouTube();
      return;
    }
    closeYouTube(false);
    carScreenState.app = id;
    if (screenHome) screenHome.hidden = true;
    if (screenApp) screenApp.hidden = false;
    if (screenOff) screenOff.hidden = true;
    if (screenAppTitle) screenAppTitle.textContent = meta.name;
    renderCarApp(id);
  }

  function chip(label, opts = {}) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `screen-chip${opts.on ? " on" : ""}${opts.danger ? " danger" : ""}`;
    b.textContent = label;
    if (opts.onClick) b.addEventListener("click", opts.onClick);
    return b;
  }

  function action(label, opts = {}) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `screen-action${opts.primary ? " primary" : ""}`;
    b.textContent = label;
    if (opts.onClick) b.addEventListener("click", opts.onClick);
    return b;
  }

  function renderCarApp(id) {
    if (!screenAppBody) return;
    screenAppBody.innerHTML = "";

    if (id === "musik") {
      carScreenState.musicOn = !!(audio.music && audio.music.playing);
      const title = document.createElement("p");
      title.textContent = TRACKS[carScreenState.track];
      const big = document.createElement("div");
      big.className = "screen-big";
      big.textContent = carScreenState.musicOn ? "▶ Spelar" : "❚❚ Paus";
      const row = document.createElement("div");
      row.className = "screen-row";
      row.append(
        action(carScreenState.musicOn ? "Pausa" : "Spela", {
          primary: true,
          onClick: () => {
            toggleMusic();
            toast(carScreenState.musicOn ? `Spelar: ${TRACKS[carScreenState.track]}` : "Musik pausad", 1400);
            renderCarApp("musik");
          },
        }),
        action("Nästa", {
          onClick: () => {
            nextMusicTrack();
            toast(`Nästa: ${TRACKS[carScreenState.track]}`, 1400);
            renderCarApp("musik");
          },
        })
      );
      const list = document.createElement("div");
      list.className = "screen-row";
      TRACKS.forEach((name, i) => {
        list.append(
          chip(name.split(" ")[0], {
            on: i === carScreenState.track && carScreenState.musicOn,
            onClick: () => {
              carScreenState.track = i;
              carScreenState.musicOn = true;
              startMusic(i);
              toast(`Spelar: ${name}`, 1400);
              renderCarApp("musik");
            },
          })
        );
      });
      screenAppBody.append(title, big, row, list);
      return;
    }

    if (id === "navi") {
      const p = document.createElement("p");
      p.textContent = "Vart ska vi?";
      const row = document.createElement("div");
      row.className = "screen-row";
      for (const place of PLACES) {
        row.append(
          chip(place, {
            onClick: () => {
              toast(`Navi: kör mot ${place}`, 1800);
              hint.textContent = `Navigation till ${place} — följ vägen`;
            },
          })
        );
      }
      screenAppBody.append(p, row);
      return;
    }

    if (id === "klimat") {
      const big = document.createElement("div");
      big.className = "screen-big";
      big.textContent = `${carScreenState.temp}°`;
      const row = document.createElement("div");
      row.className = "screen-row";
      row.append(
        action("−", {
          onClick: () => {
            carScreenState.temp = Math.max(16, carScreenState.temp - 1);
            renderCarApp("klimat");
          },
        }),
        action("+", {
          onClick: () => {
            carScreenState.temp = Math.min(28, carScreenState.temp + 1);
            renderCarApp("klimat");
          },
        }),
        chip(carScreenState.ac ? "AC på" : "AC av", {
          on: carScreenState.ac,
          onClick: () => {
            carScreenState.ac = !carScreenState.ac;
            toast(carScreenState.ac ? "AC på" : "AC av", 1200);
            renderCarApp("klimat");
          },
        })
      );
      const hintP = document.createElement("p");
      hintP.textContent = carScreenState.ac ? "Luftkonditionering kör" : "Fläkt utan AC";
      screenAppBody.append(big, row, hintP);
      return;
    }

    if (id === "telefon") {
      const p = document.createElement("p");
      p.textContent = carScreenState.call ? `Samtal: ${carScreenState.call}` : "Välj kontakt";
      const row = document.createElement("div");
      row.className = "screen-row";
      if (carScreenState.call) {
        row.append(
          action("Lägg på", {
            primary: true,
            onClick: () => {
              if (phoneCall.phase === "talking" && phoneCall.caller === carScreenState.call) {
                hangupIncomingCall();
              } else {
                toast(`Samtal med ${carScreenState.call} avslutat`, 1400);
                carScreenState.call = null;
                renderCarApp("telefon");
              }
            },
          })
        );
      } else {
        for (const name of CONTACTS) {
          row.append(
            chip(name, {
              onClick: () => {
                if (phoneCall.phase !== "idle") return;
                carScreenState.call = name;
                toast(`Ringer ${name}…`, 1600);
                renderCarApp("telefon");
              },
            })
          );
        }
      }
      screenAppBody.append(p, row);
      return;
    }

    if (id === "korlage") {
      const p = document.createElement("p");
      p.textContent = "Välj hur bilen ska kännas";
      const row = document.createElement("div");
      row.className = "screen-row";
      row.append(
        chip("Komfort", {
          on: state.driveMode === "comfort",
          onClick: () => setDriveMode("comfort"),
        }),
        chip("Sport", {
          on: state.driveMode === "sport",
          danger: true,
          onClick: () => setDriveMode("sport"),
        }),
        chip("Extreme", {
          on: state.driveMode === "extreme",
          danger: true,
          onClick: () => setDriveMode("extreme"),
        })
      );
      const info = document.createElement("p");
      info.textContent =
        state.driveMode === "extreme"
          ? "🚀 Max 10 000 km/h · galen gas"
          : state.driveMode === "sport"
            ? "Vass gas · starkt ljud · snabb ratt"
            : "Mjuk gas · tystare · lugn ratt";
      screenAppBody.append(p, row, info);
      return;
    }

    if (id === "radio") {
      carScreenState.radioOn = !!(audio.music && audio.music.playing && audio.music.mode === "radio");
      const big = document.createElement("div");
      big.className = "screen-big";
      big.style.fontSize = "1.05rem";
      big.textContent = STATIONS[carScreenState.radio];
      const status = document.createElement("p");
      status.textContent = carScreenState.radioOn ? "● Sänder" : "○ Av";
      const row = document.createElement("div");
      row.className = "screen-row";
      row.append(
        action(carScreenState.radioOn ? "Stäng av" : "Slå på", {
          primary: true,
          onClick: () => {
            toggleRadio();
            toast(
              carScreenState.radioOn ? `Radio: ${STATIONS[carScreenState.radio]}` : "Radio av",
              1400
            );
            renderCarApp("radio");
          },
        }),
        action("←", {
          onClick: () => {
            changeRadioStation(-1);
            toast(STATIONS[carScreenState.radio], 1200);
            renderCarApp("radio");
          },
        }),
        action("→", {
          onClick: () => {
            changeRadioStation(1);
            toast(STATIONS[carScreenState.radio], 1200);
            renderCarApp("radio");
          },
        })
      );
      const list = document.createElement("div");
      list.className = "screen-row";
      RADIO_STATIONS.forEach((st, i) => {
        list.append(
          chip(st.short || st.name, {
            on: i === carScreenState.radio && carScreenState.radioOn,
            onClick: () => {
              carScreenState.radio = i;
              startRadio(i);
              toast(`Radio: ${st.name}`, 1400);
              renderCarApp("radio");
            },
          })
        );
      });
      screenAppBody.append(big, status, row, list);
    }
  }

  function tickPhoneClock() {
    const el = document.getElementById("phoneClock");
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  }

  function applyPhoneSettings() {
    const s = phoneState.settings;
    const display = document.getElementById("phoneDisplay");
    const greet = document.querySelector(".phone-greeting");
    if (display) {
      const dim = Math.max(0.35, s.brightness / 100);
      display.style.filter = `brightness(${dim})`;
      display.dataset.wallpaper = s.wallpaper;
    }
    if (greet) greet.textContent = `Hej ${s.name} 👋`;
  }

  function renderPhoneSettings() {
    const body = document.getElementById("settingsBody");
    if (!body) return;
    const s = phoneState.settings;
    body.innerHTML = "";

    const group = (title) => {
      const p = document.createElement("p");
      p.className = "settings-group";
      p.textContent = title;
      body.appendChild(p);
    };

    const row = (label, hint, control) => {
      const wrap = document.createElement("div");
      wrap.className = "settings-row";
      const left = document.createElement("div");
      left.innerHTML = `<label>${label}</label>${hint ? `<span class="settings-hint">${hint}</span>` : ""}`;
      wrap.append(left, control);
      body.appendChild(wrap);
    };

    const toggle = (key) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "settings-toggle" + (s[key] ? " on" : "");
      btn.setAttribute("aria-pressed", s[key] ? "true" : "false");
      btn.addEventListener("click", () => {
        s[key] = !s[key];
        applyPhoneSettings();
        renderPhoneSettings();
        if (key === "sound") {
          toast(s.sound ? "Ljud på" : "Ljud av", 1200);
        }
      });
      return btn;
    };

    group("Skärm");
    const bright = document.createElement("input");
    bright.type = "range";
    bright.className = "settings-slider";
    bright.min = "40";
    bright.max = "100";
    bright.value = String(s.brightness);
    bright.addEventListener("input", () => {
      s.brightness = Number(bright.value);
      applyPhoneSettings();
    });
    row("Ljusstyrka", `${s.brightness}%`, bright);

    const wall = document.createElement("select");
    wall.className = "settings-select";
    for (const [val, label] of [
      ["default", "Standard"],
      ["ocean", "Hav"],
      ["sunset", "Solnedgång"],
      ["forest", "Skog"],
    ]) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = label;
      if (s.wallpaper === val) opt.selected = true;
      wall.appendChild(opt);
    }
    wall.addEventListener("change", () => {
      s.wallpaper = wall.value;
      applyPhoneSettings();
      toast("Bakgrund uppdaterad", 1000);
    });
    row("Bakgrund", "Hemskärm", wall);

    group("Ljud");
    row("Ljud", "Notiser & feedback", toggle("sound"));

    group("Appar");
    row("Autoplay", "Spela video automatiskt", toggle("autoplay"));

    group("Anslutning");
    const btBtn = document.createElement("button");
    btBtn.type = "button";
    btBtn.className = "settings-select";
    btBtn.textContent = "Öppna →";
    btBtn.addEventListener("click", () => showPhoneView("bluetooth"));
    row("Bluetooth", "Bilen, AirPods, högtalare, TV", btBtn);
    const wifiBtn = document.createElement("button");
    wifiBtn.type = "button";
    wifiBtn.className = "settings-select";
    wifiBtn.textContent = "Öppna →";
    wifiBtn.addEventListener("click", () => showPhoneView("wifi"));
    row("Wi-Fi", "Nätverk & hotspot", wifiBtn);

    group("Profil");
    const nameInput = document.createElement("input");
    nameInput.className = "settings-select";
    nameInput.type = "text";
    nameInput.maxLength = 16;
    nameInput.value = s.name;
    nameInput.style.width = "110px";
    nameInput.addEventListener("change", () => {
      const v = nameInput.value.trim() || "Nermin";
      s.name = v.slice(0, 16);
      applyPhoneSettings();
      toast(`Hej ${s.name}!`, 1200);
    });
    row("Namn", "Visas på hemskärmen", nameInput);

    const about = document.createElement("div");
    about.className = "settings-about";
    about.innerHTML = `<strong>Nermin Phone</strong>Version 1.0 · TikTok, Snapchat, YouTube<br>Inställningar sparas under körningen.`;
    body.appendChild(about);
  }

  function updateBtPowerBtn() {
    const btn = document.getElementById("btPower");
    if (!btn) return;
    const on = phoneState.bluetooth.on;
    btn.textContent = on ? "På" : "Av";
    btn.classList.toggle("off", !on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function updateBtStatus() {
    const el = document.getElementById("btStatus");
    if (!el) return;
    const bt = phoneState.bluetooth;
    if (!bt.on) {
      el.textContent = "Bluetooth är av";
      return;
    }
    if (bt.connecting) {
      const d = BT_DEVICES.find((x) => x.id === bt.connecting);
      el.textContent = `Ansluter till ${d?.name || "enhet"}…`;
      return;
    }
    const n = bt.connected.size;
    if (n === 0) el.textContent = "Söker enheter i närheten…";
    else if (n === 1) {
      const id = [...bt.connected][0];
      const d = BT_DEVICES.find((x) => x.id === id);
      el.textContent = `Ansluten: ${d?.name || "1 enhet"}`;
    } else el.textContent = `${n} enheter anslutna`;
  }

  function renderBluetooth() {
    const list = document.getElementById("btList");
    if (!list) return;
    const bt = phoneState.bluetooth;
    updateBtPowerBtn();
    updateBtStatus();
    list.innerHTML = "";

    if (!bt.on) {
      const empty = document.createElement("p");
      empty.className = "bt-empty";
      empty.textContent = "Slå på Bluetooth för att se enheter.";
      list.appendChild(empty);
      return;
    }

    const my = document.createElement("p");
    my.className = "bt-group";
    my.textContent = "Mina enheter";
    list.appendChild(my);

    for (const d of BT_DEVICES) {
      const connected = bt.connected.has(d.id);
      const pairing = bt.connecting === d.id;
      const row = document.createElement("button");
      row.type = "button";
      row.className = "bt-row" + (connected ? " connected" : "") + (pairing ? " pairing" : "");
      row.disabled = !!bt.connecting && !pairing;
      row.innerHTML = `
        <span class="bt-icon">${d.icon}</span>
        <span class="bt-info">
          <strong>${d.name}</strong>
          <span>${pairing ? "Parkopar…" : connected ? "Ansluten · " + d.hint : d.type + " · " + d.hint}</span>
        </span>
        <span class="bt-action">${pairing ? "…" : connected ? "Koppla från" : "Anslut"}</span>
      `;
      row.addEventListener("click", () => toggleBluetoothDevice(d.id));
      list.appendChild(row);
    }
  }

  function toggleBluetoothDevice(id) {
    const bt = phoneState.bluetooth;
    if (!bt.on || bt.connecting) return;
    const device = BT_DEVICES.find((d) => d.id === id);
    if (!device) return;

    if (bt.connected.has(id)) {
      bt.connected.delete(id);
      toast(`Kopplade från ${device.name}`, 1400);
      renderBluetooth();
      return;
    }

    bt.connecting = id;
    renderBluetooth();
    setTimeout(() => {
      if (!phoneState.bluetooth.on) {
        phoneState.bluetooth.connecting = null;
        renderBluetooth();
        return;
      }
      phoneState.bluetooth.connecting = null;
      phoneState.bluetooth.connected.add(id);
      toast(`Ansluten till ${device.name}`, 1600);
      if (id === "car") {
        // Spegla till bilens skärm-signal
        const sig = document.getElementById("screenSignal");
        if (sig) sig.textContent = "BT●●";
      }
      renderBluetooth();
    }, 900 + Math.random() * 700);
  }

  function updateWifiSignal() {
    const el = document.getElementById("phoneSignal");
    if (!el) return;
    const w = phoneState.wifi;
    if (!w.on) {
      el.textContent = "LTE · ▮▮";
      return;
    }
    if (!w.connected) {
      el.textContent = "Wi-Fi av · ▮";
      return;
    }
    const net = WIFI_NETWORKS.find((n) => n.id === w.connected);
    const bars = "▮".repeat(Math.max(1, net?.bars || 2));
    el.textContent = `Wi-Fi · ${bars}`;
  }

  function renderWifi() {
    const list = document.getElementById("wifiList");
    const power = document.getElementById("wifiPower");
    const status = document.getElementById("wifiStatus");
    const w = phoneState.wifi;
    if (power) {
      power.textContent = w.on ? "På" : "Av";
      power.classList.toggle("off", !w.on);
      power.setAttribute("aria-pressed", w.on ? "true" : "false");
    }
    if (status) {
      if (!w.on) status.textContent = "Wi-Fi är av";
      else if (w.connecting) status.textContent = "Ansluter…";
      else if (w.connected) {
        const n = WIFI_NETWORKS.find((x) => x.id === w.connected);
        status.textContent = `Ansluten till ${n?.name || "nätverk"}`;
      } else status.textContent = "Söker nätverk…";
    }
    updateWifiSignal();
    if (!list) return;
    list.innerHTML = "";
    if (!w.on) {
      const empty = document.createElement("p");
      empty.className = "bt-empty";
      empty.textContent = "Slå på Wi-Fi för att se nätverk.";
      list.appendChild(empty);
      return;
    }
    const g = document.createElement("p");
    g.className = "bt-group";
    g.textContent = "Nätverk";
    list.appendChild(g);
    for (const n of WIFI_NETWORKS) {
      const connected = w.connected === n.id;
      const pairing = w.connecting === n.id;
      const row = document.createElement("button");
      row.type = "button";
      row.className = "bt-row" + (connected ? " connected" : "") + (pairing ? " pairing" : "");
      row.disabled = !!w.connecting && !pairing;
      const lock = n.lock ? "🔒" : "Öppet";
      row.innerHTML = `
        <span class="bt-icon">📶</span>
        <span class="bt-info">
          <strong>${n.name}</strong>
          <span>${pairing ? "Ansluter…" : connected ? "Ansluten" : lock + " · " + "▮".repeat(n.bars)}</span>
        </span>
        <span class="bt-action">${pairing ? "…" : connected ? "Glöm" : "Anslut"}</span>
      `;
      row.addEventListener("click", () => toggleWifiNetwork(n.id));
      list.appendChild(row);
    }
  }

  function toggleWifiNetwork(id) {
    const w = phoneState.wifi;
    if (!w.on || w.connecting) return;
    const net = WIFI_NETWORKS.find((n) => n.id === id);
    if (!net) return;
    if (w.connected === id) {
      w.connected = null;
      toast(`Kopplade från ${net.name}`, 1400);
      renderWifi();
      return;
    }
    w.connecting = id;
    renderWifi();
    setTimeout(() => {
      if (!phoneState.wifi.on) {
        phoneState.wifi.connecting = null;
        renderWifi();
        return;
      }
      phoneState.wifi.connecting = null;
      phoneState.wifi.connected = id;
      toast(`Wi-Fi: ${net.name}`, 1500);
      renderWifi();
    }, 800 + Math.random() * 600);
  }

  function renderSmsThreads() {
    const list = document.getElementById("smsThreads");
    const chat = document.getElementById("smsChat");
    if (chat) chat.hidden = true;
    if (list) list.hidden = false;
    if (!list) return;
    list.innerHTML = "";
    const names = Object.keys(phoneState.sms.threads);
    for (const name of names) {
      const msgs = phoneState.sms.threads[name];
      const last = msgs[msgs.length - 1];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sms-row";
      btn.innerHTML = `<strong>${name}</strong><span>${last?.text || ""}</span><em>${last?.time || ""}</em>`;
      btn.addEventListener("click", () => openSmsThread(name));
      list.appendChild(btn);
    }
  }

  function openSmsThread(name) {
    phoneState.sms.active = name;
    const list = document.getElementById("smsThreads");
    const chat = document.getElementById("smsChat");
    const title = document.getElementById("smsChatName");
    const bubbles = document.getElementById("smsBubbles");
    if (list) list.hidden = true;
    if (chat) chat.hidden = false;
    if (title) title.textContent = name;
    if (!bubbles) return;
    bubbles.innerHTML = "";
    for (const m of phoneState.sms.threads[name] || []) {
      const div = document.createElement("div");
      div.className = "sms-bubble " + (m.from === "me" ? "me" : "them");
      div.textContent = m.text;
      bubbles.appendChild(div);
    }
    bubbles.scrollTop = bubbles.scrollHeight;
  }

  function sendSms(text) {
    const name = phoneState.sms.active;
    if (!name || !text.trim()) return;
    const now = new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
    if (!phoneState.sms.threads[name]) phoneState.sms.threads[name] = [];
    phoneState.sms.threads[name].push({ from: "me", text: text.trim(), time: now });
    openSmsThread(name);
    setTimeout(() => {
      const replies = ["Ok!", "👍", "Ses snart", "Haha", "Ring mig", "Coolt"];
      phoneState.sms.threads[name].push({
        from: "them",
        text: replies[Math.floor(Math.random() * replies.length)],
        time: new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }),
      });
      if (phoneState.sms.active === name) openSmsThread(name);
    }, 900);
  }

  function renderPhoneDialer() {
    const num = document.getElementById("dialNumber");
    const pad = document.getElementById("dialPad");
    const contacts = document.getElementById("dialContacts");
    if (num) num.textContent = phoneState.dial || "Ange nummer";
    if (pad && !pad.dataset.ready) {
      pad.dataset.ready = "1";
      for (const k of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = k;
        b.addEventListener("click", () => {
          if (phoneState.dial.length >= 15) return;
          phoneState.dial += k;
          if (num) num.textContent = phoneState.dial;
        });
        pad.appendChild(b);
      }
    }
    if (contacts) {
      contacts.innerHTML = "";
      for (const name of CONTACTS) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "dial-contact";
        b.textContent = name;
        b.addEventListener("click", () => startOutboundCall(name));
        contacts.appendChild(b);
      }
    }
  }

  function startOutboundCall(name) {
    if (phoneCall.phase !== "idle") {
      toast("Du är redan i ett samtal", 1400);
      return;
    }
    phoneCall.phase = "talking";
    phoneCall.caller = name;
    carScreenState.call = name;
    if (callNameEl) callNameEl.textContent = name;
    if (callStatusEl) callStatusEl.textContent = "Samtal pågår…";
    callCard?.classList.add("talking");
    if (callAnswerBtn) callAnswerBtn.hidden = true;
    if (callDeclineBtn) callDeclineBtn.hidden = true;
    if (callHangupBtn) callHangupBtn.hidden = false;
    if (callOverlay) callOverlay.hidden = false;
    toast(`Ringer ${name}…`, 1400);
    clearTimeout(phoneCall.talkTimer);
    phoneCall.talkTimer = setTimeout(() => {
      if (phoneCall.phase === "talking") endPhoneCall(`${name} la på`);
    }, 25000);
  }

  function renderSimpleApp(id) {
    const title = document.getElementById("simpleTitle");
    const body = document.getElementById("simpleBody");
    if (!body) return;
    body.innerHTML = "";
    const titles = {
      camera: "Kamera",
      photos: "Bilder",
      maps: "Kartor",
      weather: "Väder",
      calc: "Kalkylator",
      notes: "Anteckningar",
      clock: "Klocka",
    };
    if (title) title.textContent = titles[id] || "App";

    if (id === "camera") {
      stopPhoneCamera();
      const view = document.createElement("div");
      view.className = "cam-view live";
      const video = document.createElement("video");
      video.id = "phoneCamVideo";
      video.setAttribute("playsinline", "");
      video.setAttribute("autoplay", "");
      video.muted = true;
      const flash = document.createElement("div");
      flash.className = "cam-flash";
      const hint = document.createElement("p");
      hint.className = "cam-hint";
      hint.textContent = "Startar kamera…";
      view.append(video, flash, hint);

      const bar = document.createElement("div");
      bar.className = "cam-bar";
      const shoot = document.createElement("button");
      shoot.type = "button";
      shoot.className = "cam-shutter";
      shoot.textContent = "Ta foto";
      shoot.disabled = true;
      const flip = document.createElement("button");
      flip.type = "button";
      flip.className = "cam-flip";
      flip.textContent = "Byt";
      const toPhotos = document.createElement("button");
      toPhotos.type = "button";
      toPhotos.className = "cam-album";
      toPhotos.textContent = "Bilder";
      toPhotos.addEventListener("click", () => {
        stopPhoneCamera();
        showPhoneView("photos");
      });

      const startCam = async (facing = "user") => {
        stopPhoneCamera();
        hint.textContent = "Startar kamera…";
        shoot.disabled = true;
        try {
          if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("unsupported");
          }
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
          phoneState.camStream = stream;
          phoneState.camFacing = facing;
          video.srcObject = stream;
          await video.play().catch(() => {});
          hint.textContent = "";
          shoot.disabled = false;
        } catch (_) {
          hint.textContent = "Ingen kamera — tryck för simulerat foto";
          shoot.disabled = false;
          shoot.dataset.fake = "1";
        }
      };

      shoot.addEventListener("click", () => {
        flash.classList.remove("pop");
        void flash.offsetWidth;
        flash.classList.add("pop");

        let dataUrl = null;
        if (video.srcObject && video.videoWidth > 0) {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const c = canvas.getContext("2d");
          // spegla framsida som i mobilkamera
          if (phoneState.camFacing !== "environment") {
            c.translate(canvas.width, 0);
            c.scale(-1, 1);
          }
          c.drawImage(video, 0, 0);
          dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        } else {
          // Fallback: genererad bil-bild
          const canvas = document.createElement("canvas");
          canvas.width = 480;
          canvas.height = 640;
          const c = canvas.getContext("2d");
          const g = c.createLinearGradient(0, 0, 0, 640);
          g.addColorStop(0, "#1a3048");
          g.addColorStop(1, "#0a1018");
          c.fillStyle = g;
          c.fillRect(0, 0, 480, 640);
          c.fillStyle = "#c02828";
          c.fillRect(80, 280, 320, 90);
          c.fillStyle = "#1a2838";
          c.fillRect(120, 250, 240, 40);
          c.fillStyle = "#fff";
          c.font = "bold 28px Outfit, sans-serif";
          c.fillText("Nermin", 175, 340);
          c.font = "16px sans-serif";
          c.fillStyle = "#8aa0b8";
          c.fillText(new Date().toLocaleString("sv-SE"), 140, 580);
          dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        }

        phoneState.photos.unshift({
          t: Date.now(),
          label: "Foto " + (phoneState.photos.length + 1),
          src: dataUrl,
        });
        toast("Foto sparat!", 1200);
      });

      flip.addEventListener("click", () => {
        const next = phoneState.camFacing === "environment" ? "user" : "environment";
        startCam(next);
      });

      bar.append(toPhotos, shoot, flip);
      body.append(view, bar);
      startCam(phoneState.camFacing || "user");
      return;
    }

    if (id === "photos") {
      stopPhoneCamera();
      if (!phoneState.photos.length) {
        body.innerHTML = "<p class='bt-empty'>Inga bilder ännu. Ta ett foto i Kameran.</p>";
        const go = document.createElement("button");
        go.type = "button";
        go.className = "simple-btn";
        go.textContent = "Öppna kamera";
        go.addEventListener("click", () => showPhoneView("camera"));
        body.appendChild(go);
        return;
      }
      const grid = document.createElement("div");
      grid.className = "photo-grid";
      phoneState.photos.forEach((p, i) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "photo-cell";
        if (p.src) {
          cell.style.backgroundImage = `url(${p.src})`;
          cell.textContent = "";
        } else {
          cell.textContent = p.label;
        }
        cell.addEventListener("click", () => openPhotoViewer(i));
        grid.appendChild(cell);
      });
      body.appendChild(grid);
      return;
    }

    if (id === "maps") {
      body.innerHTML = `
        <div class="maps-card">
          <strong>Du är här</strong>
          <p>Närmaste: Bensinstation · 1,2 km</p>
          <p>Hem · 4,8 km</p>
          <p>Ring-ateljé · 2,1 km</p>
        </div>`;
      const go = document.createElement("button");
      go.type = "button";
      go.className = "simple-btn";
      go.textContent = "Navigera hem";
      go.addEventListener("click", () => toast("Navigation startad ◎", 1400));
      body.appendChild(go);
      return;
    }

    if (id === "weather") {
      body.innerHTML = `
        <div class="weather-card">
          <div class="weather-temp">12°</div>
          <p>Molnigt · Malmö</p>
          <p>Vind 4 m/s · Fukt 68%</p>
          <div class="weather-days">
            <span>Lör 11°</span><span>Sön 14°</span><span>Mån 9°</span>
          </div>
        </div>`;
      return;
    }

    if (id === "calc") {
      const display = document.createElement("div");
      display.className = "calc-display";
      display.textContent = "0";
      let cur = "0";
      const keys = document.createElement("div");
      keys.className = "calc-keys";
      for (const k of ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", "C", "=", "+"]) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = k;
        b.addEventListener("click", () => {
          if (k === "C") cur = "0";
          else if (k === "=") {
            try {
              // eslint-disable-next-line no-new-func
              cur = String(Function(`"use strict"; return (${cur})`)());
            } catch (_) {
              cur = "Fel";
            }
          } else if (cur === "0" || cur === "Fel") cur = /[0-9]/.test(k) ? k : "0" + k;
          else cur += k;
          display.textContent = cur;
        });
        keys.appendChild(b);
      }
      body.append(display, keys);
      return;
    }

    if (id === "notes") {
      const ta = document.createElement("textarea");
      ta.className = "notes-area";
      ta.value = phoneState.notes;
      ta.addEventListener("input", () => {
        phoneState.notes = ta.value;
      });
      body.appendChild(ta);
      return;
    }

    if (id === "clock") {
      const big = document.createElement("div");
      big.className = "clock-big";
      const tick = () => {
        big.textContent = new Date().toLocaleTimeString("sv-SE");
      };
      tick();
      const iv = setInterval(tick, 1000);
      big.dataset.iv = String(iv);
      body.appendChild(big);
      const alarm = document.createElement("p");
      alarm.className = "bt-empty";
      alarm.textContent = "Nästa alarm: 07:00";
      body.appendChild(alarm);
    }
  }

  function showPhoneView(name) {
    phoneState.app = name;
    const home = document.getElementById("phoneHome");
    const tt = document.getElementById("phoneTikTok");
    const snap = document.getElementById("phoneSnap");
    const yt = document.getElementById("phoneYtApp");
    const settings = document.getElementById("phoneSettings");
    const bluetooth = document.getElementById("phoneBluetooth");
    const wifi = document.getElementById("phoneWifi");
    const sms = document.getElementById("phoneSms");
    const dial = document.getElementById("phoneDial");
    const simple = document.getElementById("phoneSimple");
    if (home) home.hidden = name !== "home";
    if (tt) tt.hidden = name !== "tiktok";
    if (snap) snap.hidden = name !== "snapchat";
    if (yt) yt.hidden = name !== "youtube";
    if (settings) settings.hidden = name !== "settings";
    if (bluetooth) bluetooth.hidden = name !== "bluetooth";
    if (wifi) wifi.hidden = name !== "wifi";
    if (sms) sms.hidden = name !== "sms";
    if (dial) dial.hidden = name !== "phone";
    const simpleApps = ["camera", "photos", "maps", "weather", "calc", "notes", "clock"];
    if (simple) simple.hidden = !simpleApps.includes(name);
    if (name !== "tiktok") stopPhoneTikTok();
    if (name !== "snapchat") closeSnapViewer();
    if (name !== "youtube") stopPhoneYouTube();
    if (name !== "camera" && name !== "snapchat") stopPhoneCamera();
    if (name === "tiktok") {
      renderTikTok();
    } else if (name === "snapchat") {
      openSnapCamera();
    } else if (name === "youtube") {
      renderPhoneYouTubeList();
    } else if (name === "settings") {
      renderPhoneSettings();
    } else if (name === "bluetooth") {
      renderBluetooth();
    } else if (name === "wifi") {
      renderWifi();
    } else if (name === "sms") {
      renderSmsThreads();
    } else if (name === "phone") {
      renderPhoneDialer();
    } else if (simpleApps.includes(name)) {
      renderSimpleApp(name);
    }
  }

  function embedUrl(id, opts = {}) {
    const wantAuto = opts.autoplay !== false && phoneState.settings.autoplay !== false;
    const auto = wantAuto ? 1 : 0;
    return `https://www.youtube-nocookie.com/embed/${id}?autoplay=${auto}&rel=0&modestbranding=1&playsinline=1`;
  }

  function stopPhoneTikTok() {
    const feed = document.getElementById("ttFeed");
    if (feed) feed.innerHTML = "";
  }

  function stopPhoneYouTube() {
    const frame = document.getElementById("pytFrame");
    const player = document.getElementById("pytPlayer");
    if (frame) frame.src = "";
    player?.classList.remove("has-video");
    phoneState.ytId = null;
  }

  function renderTikTok() {
    const feed = document.getElementById("ttFeed");
    const userEl = document.getElementById("ttUser");
    const captionEl = document.getElementById("ttCaption");
    const likeBtn = document.getElementById("ttLike");
    if (!feed || !TIKTOK_VIDEOS.length) return;
    const i = ((phoneState.ttIndex % TIKTOK_VIDEOS.length) + TIKTOK_VIDEOS.length) % TIKTOK_VIDEOS.length;
    phoneState.ttIndex = i;
    const v = TIKTOK_VIDEOS[i];
    stopMusic();
    feed.innerHTML = "";
    const iframe = document.createElement("iframe");
    iframe.title = v.caption;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.src = embedUrl(v.id);
    feed.appendChild(iframe);
    if (userEl) userEl.textContent = `${v.user} · ${v.likes}`;
    if (captionEl) captionEl.textContent = v.caption;
    likeBtn?.classList.toggle("on", phoneState.ttLiked.has(i));
  }

  function ttNext(delta) {
    phoneState.ttIndex += delta;
    renderTikTok();
  }

  function setSnapMode(mode) {
    // mode: cam | preview | chats
    const cam = document.getElementById("snapCam");
    const preview = document.getElementById("snapPreview");
    const chats = document.getElementById("snapChats");
    if (cam) cam.hidden = mode !== "cam";
    if (preview) preview.hidden = mode !== "preview";
    if (chats) chats.hidden = mode !== "chats";
    if (mode !== "cam") stopPhoneCamera();
  }

  async function openSnapCamera() {
    closeSnapViewer();
    setSnapMode("cam");
    phoneState.snapShot = null;
    const video = document.getElementById("snapCamVideo");
    const hint = document.getElementById("snapCamHint");
    const shutter = document.getElementById("snapShutter");
    if (shutter) shutter.disabled = true;
    const ok = await startPhoneCameraStream(video, hint, phoneState.camFacing || "user");
    if (shutter) shutter.disabled = false;
    if (!ok && hint) hint.textContent = "Tryck på den gula knappen för snap";
    renderSnapBadge();
  }

  function renderSnapBadge() {
    let unseen = 0;
    for (let i = 0; i < SNAP_STORIES.length; i++) {
      if (!phoneState.snapSeen.has(i)) unseen++;
    }
    unseen += phoneState.myStory.filter((s) => !s.seen).length;
    const b1 = document.getElementById("snapBadge");
    const b2 = document.getElementById("snapBadge2");
    if (b1) b1.textContent = String(unseen);
    if (b2) b2.textContent = String(unseen);
  }

  function takeSnapPhoto() {
    const video = document.getElementById("snapCamVideo");
    const flash = document.getElementById("snapCamFlash");
    if (flash) {
      flash.classList.remove("pop");
      void flash.offsetWidth;
      flash.classList.add("pop");
    }
    const src = captureFromVideo(video);
    phoneState.snapShot = src;
    phoneState.photos.unshift({
      t: Date.now(),
      label: "Snap " + (phoneState.photos.length + 1),
      src,
    });
    showSnapPreview(src);
  }

  function showSnapPreview(src) {
    setSnapMode("preview");
    const img = document.getElementById("snapPreviewImg");
    if (img) img.src = src;
    const list = document.getElementById("snapSendList");
    if (!list) return;
    list.innerHTML = "";
    const friends = SNAP_STORIES.map((s) => s.name);
    for (const name of friends.slice(0, 12)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "snap-send-friend";
      btn.textContent = name;
      btn.addEventListener("click", () => sendSnapTo(name));
      list.appendChild(btn);
    }
  }

  function sendSnapTo(name) {
    if (!phoneState.snapShot) return;
    toast(`Snap skickad till ${name}! 👻`, 1600);
    phoneState.snapShot = null;
    openSnapCamera();
  }

  function postMyStory() {
    if (!phoneState.snapShot) return;
    phoneState.myStory.unshift({ src: phoneState.snapShot, t: Date.now(), seen: false });
    toast("Tillagd i din story!", 1400);
    phoneState.snapShot = null;
    openSnapCamera();
  }

  function renderSnapChatList() {
    const list = document.getElementById("snapStories");
    if (!list) return;
    list.innerHTML = "";

    if (phoneState.myStory.length) {
      const mine = document.createElement("button");
      mine.type = "button";
      mine.className = "snap-row unseen";
      mine.innerHTML = `
        <span class="snap-avatar" style="background-image:url(${phoneState.myStory[0].src});background-color:#fffc00"></span>
        <span><strong>Min story</strong><span>${phoneState.myStory.length} snap(s)</span></span>
      `;
      mine.addEventListener("click", () => openMyStory());
      list.appendChild(mine);
    }

    for (let i = 0; i < SNAP_STORIES.length; i++) {
      const s = SNAP_STORIES[i];
      const seen = phoneState.snapSeen.has(i);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "snap-row" + (seen ? "" : " unseen");
      btn.innerHTML = `
        <span class="snap-avatar" style="background-image:url(https://i.ytimg.com/vi/${s.id}/hqdefault.jpg);background-color:${s.color}"></span>
        <span><strong>${s.name}</strong><span>${s.time} sedan</span></span>
      `;
      btn.addEventListener("click", () => openSnapStory(i));
      list.appendChild(btn);
    }
    renderSnapBadge();
  }

  function showSnapChats() {
    stopPhoneCamera();
    setSnapMode("chats");
    renderSnapChatList();
  }

  function openMyStory() {
    const story = phoneState.myStory[0];
    if (!story) return;
    story.seen = true;
    const viewer = document.getElementById("snapViewer");
    const frame = document.getElementById("snapFrame");
    const photo = document.getElementById("snapPhotoView");
    const nameEl = document.getElementById("snapViewerName");
    if (nameEl) nameEl.textContent = "Min story";
    if (frame) {
      frame.hidden = true;
      frame.src = "";
    }
    if (photo) {
      photo.hidden = false;
      photo.src = story.src;
    }
    if (viewer) viewer.hidden = false;
    renderSnapBadge();
  }

  function openSnapStory(index) {
    const s = SNAP_STORIES[index];
    if (!s) return;
    phoneState.snapSeen.add(index);
    const viewer = document.getElementById("snapViewer");
    const frame = document.getElementById("snapFrame");
    const photo = document.getElementById("snapPhotoView");
    const nameEl = document.getElementById("snapViewerName");
    if (nameEl) nameEl.textContent = s.name;
    if (photo) {
      photo.hidden = true;
      photo.src = "";
    }
    if (frame) {
      frame.hidden = false;
      stopMusic();
      frame.src = embedUrl(s.id);
    }
    if (viewer) viewer.hidden = false;
    renderSnapBadge();
  }

  function closeSnapViewer() {
    const viewer = document.getElementById("snapViewer");
    const frame = document.getElementById("snapFrame");
    const photo = document.getElementById("snapPhotoView");
    if (frame) {
      frame.src = "";
      frame.hidden = false;
    }
    if (photo) {
      photo.hidden = true;
      photo.src = "";
    }
    if (viewer) viewer.hidden = true;
  }

  function renderPhoneYouTubeList() {
    const list = document.getElementById("pytList");
    if (!list) return;
    list.innerHTML = "";
    for (const v of PHONE_YT_VIDEOS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pyt-item" + (phoneState.ytId === v.id ? " on" : "");
      btn.innerHTML = `
        <span class="pyt-thumb" style="background-image:url(https://i.ytimg.com/vi/${v.id}/mqdefault.jpg)"></span>
        <span><strong>${v.title}</strong><span>${v.ch}</span></span>
      `;
      btn.addEventListener("click", () => playPhoneYouTube(v.id));
      list.appendChild(btn);
    }
  }

  function playPhoneYouTube(id) {
    const frame = document.getElementById("pytFrame");
    const player = document.getElementById("pytPlayer");
    if (!frame || !id) return;
    stopMusic();
    phoneState.ytId = id;
    frame.src = embedUrl(id);
    player?.classList.add("has-video");
    renderPhoneYouTubeList();
    toast("YouTube spelar", 1000);
  }

  function openPhone(e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const overlay = document.getElementById("phoneOverlay");
    if (!overlay) {
      toast("Mobilen hittades inte", 1600);
      return;
    }
    // Stäng bilens stora YT så ljud inte dubblas
    try { closeYouTube(false); } catch (_) {}
    phoneState.open = true;
    overlay.hidden = false;
    overlay.removeAttribute("hidden");
    overlay.style.display = "flex";
    tickPhoneClock();
    showPhoneView("home");
  }

  function closePhone() {
    const overlay = document.getElementById("phoneOverlay");
    phoneState.open = false;
    try {
      stopPhoneTikTok();
      stopPhoneYouTube();
      stopPhoneCamera();
      closeSnapViewer();
      const pv = document.getElementById("photoViewer");
      if (pv) pv.hidden = true;
      showPhoneView("home");
    } catch (_) {}
    if (overlay) {
      overlay.hidden = true;
      overlay.setAttribute("hidden", "");
      overlay.style.display = "";
    }
  }

  function initPhone() {
    const openBtn = document.getElementById("phoneOpenBtn");
    if (openBtn) {
      openBtn.addEventListener("click", openPhone);
      openBtn.onclick = openPhone; // extra säkring mot cache/dubbelbindning
    }
    document.getElementById("phoneDismiss")?.addEventListener("click", closePhone);
    document.getElementById("phoneHomePill")?.addEventListener("click", () => showPhoneView("home"));
    document.getElementById("phoneOverlay")?.addEventListener("click", (e) => {
      if (e.target.id === "phoneOverlay") closePhone();
    });
    document.querySelectorAll("[data-phone-app]").forEach((btn) => {
      btn.addEventListener("click", () => showPhoneView(btn.dataset.phoneApp));
    });
    document.getElementById("ttPrev")?.addEventListener("click", () => ttNext(-1));
    document.getElementById("ttNext")?.addEventListener("click", () => ttNext(1));
    document.getElementById("ttLike")?.addEventListener("click", () => {
      const i = phoneState.ttIndex;
      if (phoneState.ttLiked.has(i)) phoneState.ttLiked.delete(i);
      else phoneState.ttLiked.add(i);
      document.getElementById("ttLike")?.classList.toggle("on", phoneState.ttLiked.has(i));
    });
    document.getElementById("ttComment")?.addEventListener("click", () => toast("Kommentarer snart 💬", 1200));
    document.getElementById("ttShare")?.addEventListener("click", () => toast("Delat med kompisar!", 1200));
    document.getElementById("snapCloseVid")?.addEventListener("click", () => {
      closeSnapViewer();
      if (phoneState.app === "snapchat") openSnapCamera();
    });
    document.getElementById("snapShutter")?.addEventListener("click", takeSnapPhoto);
    document.getElementById("snapFlipCam")?.addEventListener("click", () => {
      const next = phoneState.camFacing === "environment" ? "user" : "environment";
      const video = document.getElementById("snapCamVideo");
      const hint = document.getElementById("snapCamHint");
      startPhoneCameraStream(video, hint, next);
    });
    document.getElementById("snapShowChats")?.addEventListener("click", showSnapChats);
    document.getElementById("snapOpenStories")?.addEventListener("click", showSnapChats);
    document.getElementById("snapBackCam")?.addEventListener("click", () => openSnapCamera());
    document.getElementById("snapRetake")?.addEventListener("click", () => openSnapCamera());
    document.getElementById("snapSendStory")?.addEventListener("click", postMyStory);
    document.getElementById("btPower")?.addEventListener("click", () => {
      const bt = phoneState.bluetooth;
      bt.on = !bt.on;
      if (!bt.on) {
        bt.connecting = null;
        bt.connected.clear();
        const sig = document.getElementById("screenSignal");
        if (sig) sig.textContent = "●●●";
        toast("Bluetooth av", 1200);
      } else {
        toast("Bluetooth på — söker enheter", 1400);
      }
      if (phoneState.app === "bluetooth") renderBluetooth();
      else updateBtPowerBtn();
    });

    document.getElementById("wifiPower")?.addEventListener("click", () => {
      const w = phoneState.wifi;
      w.on = !w.on;
      if (!w.on) {
        w.connecting = null;
        w.connected = null;
        toast("Wi-Fi av", 1200);
      } else {
        toast("Wi-Fi på", 1200);
      }
      if (phoneState.app === "wifi") renderWifi();
      else updateWifiSignal();
    });

    document.getElementById("smsBack")?.addEventListener("click", () => {
      phoneState.sms.active = null;
      renderSmsThreads();
    });
    document.getElementById("smsCompose")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("smsInput");
      sendSms(input?.value || "");
      if (input) input.value = "";
    });
    document.getElementById("dialCall")?.addEventListener("click", () => {
      const n = phoneState.dial.trim();
      if (!n) {
        toast("Välj kontakt eller ange nummer", 1400);
        return;
      }
      startOutboundCall(n);
    });
    document.getElementById("dialDel")?.addEventListener("click", () => {
      phoneState.dial = phoneState.dial.slice(0, -1);
      const num = document.getElementById("dialNumber");
      if (num) num.textContent = phoneState.dial || "Ange nummer";
    });

    updateWifiSignal();

    const feed = document.getElementById("ttFeed");
    let touchY = null;
    feed?.addEventListener(
      "wheel",
      (e) => {
        if (phoneState.app !== "tiktok") return;
        e.preventDefault();
        if (e.deltaY > 18) ttNext(1);
        else if (e.deltaY < -18) ttNext(-1);
      },
      { passive: false }
    );
    feed?.addEventListener(
      "touchstart",
      (e) => {
        touchY = e.touches[0]?.clientY ?? null;
      },
      { passive: true }
    );
    feed?.addEventListener(
      "touchend",
      (e) => {
        if (touchY == null) return;
        const y = e.changedTouches[0]?.clientY ?? touchY;
        const dy = touchY - y;
        if (dy > 50) ttNext(1);
        else if (dy < -50) ttNext(-1);
        touchY = null;
      },
      { passive: true }
    );

    setInterval(tickPhoneClock, 20000);
    tickPhoneClock();
    applyPhoneSettings();
  }

  function initCarScreen() {
    renderScreenHome();
    initYouTube();
    initPhone();
    tickScreenClock();
    setInterval(tickScreenClock, 20000);
    showScreenHome();
    document.getElementById("screenBack")?.addEventListener("click", showScreenHome);
    document.getElementById("screenWake")?.addEventListener("click", () => setScreenPower(true));
    // Långtryck på statusraden stänger av skärmen
    document.querySelector(".screen-bar")?.addEventListener("dblclick", () => {
      setScreenPower(false);
      toast("Skärm av — dubbelklicka igen via Slå på", 1600);
    });
  }

  function setInput(dir, on) {
    if (state.phase !== "drive") return;
    if (dir in state.input) state.input[dir] = on;
  }

  // —— Dra i ratten för att styra ——
  const wheelSteer = { dragging: false, lastX: 0 };
  if (steering) {
    steering.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      wheelSteer.dragging = true;
      state.wheelDragging = true;
      wheelSteer.lastX = e.clientX;
      try { steering.setPointerCapture(e.pointerId); } catch (_) {}
    });
    steering.addEventListener("pointermove", (e) => {
      if (!wheelSteer.dragging) return;
      const dx = e.clientX - wheelSteer.lastX;
      wheelSteer.lastX = e.clientX;
      state.steer = Math.max(-520, Math.min(520, state.steer + dx * 3.2));
      state.steerRate = 0;
    });
    const endWheel = () => {
      if (!wheelSteer.dragging) return;
      wheelSteer.dragging = false;
      state.wheelDragging = false;
    };
    steering.addEventListener("pointerup", endWheel);
    steering.addEventListener("pointercancel", endWheel);
    steering.addEventListener("lostpointercapture", endWheel);
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
  modeExtremeBtn?.addEventListener("click", () => setDriveMode("extreme"));
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

  // —— 3D-snurr på sportbilen utifrån ——
  const parkedCar = document.getElementById("parkedCar");
  const carSpin = { y: -18, x: 8, dragging: false, lastX: 0, lastY: 0 };
  function applyCarSpin() {
    app.style.setProperty("--car-spin-y", `${carSpin.y}deg`);
    app.style.setProperty("--car-spin-x", `${carSpin.x}deg`);
  }
  applyCarSpin();
  if (parkedCar) {
    parkedCar.addEventListener("pointerdown", (e) => {
      if (state.inside) return;
      if (e.target.closest("button, a, .door")) return;
      carSpin.dragging = true;
      carSpin.lastX = e.clientX;
      carSpin.lastY = e.clientY;
      try { parkedCar.setPointerCapture(e.pointerId); } catch (_) {}
    });
    parkedCar.addEventListener("pointermove", (e) => {
      if (!carSpin.dragging) return;
      carSpin.y += (e.clientX - carSpin.lastX) * 0.35;
      carSpin.x = Math.max(-6, Math.min(22, carSpin.x - (e.clientY - carSpin.lastY) * 0.2));
      carSpin.lastX = e.clientX;
      carSpin.lastY = e.clientY;
      applyCarSpin();
    });
    const endSpin = () => { carSpin.dragging = false; };
    parkedCar.addEventListener("pointerup", endSpin);
    parkedCar.addEventListener("pointercancel", endSpin);
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state.inside) {
      updateRev(dt);
      updatePhysics(dt);
      updateUI();
      render();
    } else if (!carSpin.dragging) {
      // Långsam auto-rotation när man står utanför
      carSpin.y += dt * 8;
      applyCarSpin();
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
    beltStation.hidden = true;
    keyBtn.hidden = false;
    keyBtn.disabled = false;
    keyBtn.classList.add("guide");
    keyCaption.textContent = "Ta upp";
    keyholeWrap.hidden = false;
    syncGearLabel();
    updateKeyholeUI();
    updateExitButton();
    hint.textContent = "Du sitter i bilen. Ta upp nyckeln och sätt den i nyckelhålet.";
    resize();
    requestAnimationFrame(resize);
  }

  beginInside();
  setDriveMode("comfort", false);
  initCarScreen();
  toast("Du sitter i bilen. Ta upp nyckeln!", 3400);
})();
