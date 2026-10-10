// EulerLab — physics, numerical method, charts, and animation

// Short helper for selecting elements from the page.
const $ = (id) => document.getElementById(id);

// Controles y elementos de display
const els = {
  model: $("modelSelect"), k: $("kInput"), dt: $("dtInput"), v0: $("v0Input"),
  T: $("totalTimeInput"), g: $("gInput"), apply: $("applyButton"),
  play: $("playButton"), reset: $("resetButton"), speed: $("speedInput"),
  speedOut: $("speedOutput"), motion: $("motionCanvas"), title: $("motionTitle"),
  status: $("statusPill"), time: $("timeMetric"), position: $("positionMetric"),
  velocity: $("velocityMetric"), error: $("errorMetric"), desc: $("modelDescription"),
  err: $("errorMessage"), maxX: $("maxPositionError"), maxV: $("maxVelocityError"),
  insightTitle: $("insightTitle"), insightText: $("insightText"),
  positionChart: $("positionChart"),
  velocityChart: $("velocityChart"),
  phaseChart: $("phaseChart")
};

let state = { config: null, data: null, currentTime: 0, running: false, lastFrame: 0 };

const descriptions = {
  "quadratic-gravity": "Caída vertical desde el reposo con resistencia del aire cuadrática.",
  "linear-gravity": "Caída vertical desde el reposo con resistencia del aire lineal.",
  quadratic: "Lanzamiento horizontal frenado por rozamiento cuadrático.",
  linear: "Lanzamiento horizontal frenado por rozamiento lineal."
};

// Aceleracion para cada modelo fisico.
function acceleration(velocity, config) {
  const drag = config.model.includes("quadratic")
    ? config.k * velocity * Math.abs(velocity)
    : config.k * velocity;
  return config.model.includes("gravity") ? config.g - drag : -drag;
}

// Soluciones analiticas utilizadas para comparar la aproximacion dada por Euler.
function analytical(time, config) {
  const { k, g, v0 } = config;

  if (config.model === "linear") {
    return {
      x: (v0 * (1 - Math.exp(-k * time))) / k,
      v: v0 * Math.exp(-k * time)
    };
  }
  if (config.model === "quadratic") {
    return {
      x: Math.log(1 + k * v0 * time) / k,
      v: v0 / (1 + k * v0 * time)
    };
  }
  if (config.model === "linear-gravity") {
    return {
      x: (g * time) / k - (g * (1 - Math.exp(-k * time))) / (k * k),
      v: (g * (1 - Math.exp(-k * time))) / k
    };
  }

  // Quadratic drag with gravity, starting from rest.
  const q = Math.sqrt(g * k);
  return {
    x: Math.log(Math.cosh(q * time)) / k,
    v: Math.sqrt(g / k) * Math.tanh(q * time)
  };
}

// Euler's method: calculate position and velocity one step at a time.
function simulate(config) {
  const times = [0];
  const positions = [0];
  const velocities = [config.model.includes("gravity") ? 0 : config.v0];
  const analyticalPositions = [0];
  const analyticalVelocities = [velocities[0]];
  let time = 0;

  while (time < config.T - 1e-10) {
    const step = Math.min(config.dt, config.T - time);
    const currentVelocity = velocities[velocities.length - 1];
    const currentAcceleration = acceleration(currentVelocity, config);
    positions.push(positions[positions.length - 1] + currentVelocity * step);
    velocities.push(currentVelocity + currentAcceleration * step);
    time += step;
    times.push(time);

    const exact = analytical(time, config);
    analyticalPositions.push(exact.x);
    analyticalVelocities.push(exact.v);
  }

  return {
    t: times,
    x: positions,
    v: velocities,
    analX: analyticalPositions,
    analV: analyticalVelocities
  };
}

// Read controls and reject invalid physical parameters.
function readConfig() {
  const config = {
    model: els.model.value,
    k: Number(els.k.value),
    dt: Number(els.dt.value),
    v0: Number(els.v0.value),
    T: Number(els.T.value),
    g: Number(els.g.value)
  };

  if (!Number.isFinite(config.k) || config.k < 0.001 || config.k > 2) {
    throw Error("Drag coefficient k must be between 0.001 and 2.");
  }
  if (!Number.isFinite(config.dt) || config.dt < 0.001 || config.dt > 0.5) {
    throw Error("Time step Δt must be between 0.001 and 0.5 s.");
  }
  if (!Number.isFinite(config.T) || config.T < 0.5 || config.T > 60) {
    throw Error("Total time must be between 0.5 and 60 s.");
  }
  if (!Number.isFinite(config.v0) || config.v0 < 0 || config.v0 > 100) {
    throw Error("Initial velocity must be between 0 and 100 m/s.");
  }
  if (!Number.isFinite(config.g) || config.g < 0 || config.g > 30) {
    throw Error("Gravity must be between 0 and 30 m/s².");
  }
  return config;
}

// Apply the current controls and generate a fresh simulation.
function apply() {
  try {
    const config = readConfig();
    state = {
      config,
      data: simulate(config),
      currentTime: 0,
      running: false,
      lastFrame: 0
    };
    els.err.textContent = "";
    els.desc.textContent = descriptions[config.model];
    els.title.textContent = config.model.includes("gravity")
      ? "Objeto en caída libre"
      : "Objeto desacelerando por la resistencia";
    els.status.textContent = "READY";
    updateMetrics();
    drawMotion();
    drawCharts();
  } catch (error) {
    els.err.textContent = error.message;
  }
}

function maxError(values, exactValues) {
  return Math.max(...values.map((value, index) => Math.abs(value - exactValues[index])));
}

function currentIndex() {
  const { t } = state.data;
  let index = 0;
  while (index < t.length - 1 && t[index + 1] <= state.currentTime) index++;
  return index;
}

// Actualizar los valores mostrados en la parte posterior del canvas de movimiento.
function updateMetrics() {
  if (!state.data) return;
  const data = state.data;
  const index = currentIndex();
  const positionError = maxError(data.x, data.analX);
  const velocityError = maxError(data.v, data.analV);
  els.time.innerHTML = `${data.t[index].toFixed(2)} <small>s</small>`;
  els.position.innerHTML = `${data.x[index].toFixed(2)} <small>m</small>`;
  els.velocity.innerHTML = `${data.v[index].toFixed(2)} <small>m/s</small>`;
  els.error.innerHTML = `${Math.abs(data.x[index] - data.analX[index]).toFixed(3)} <small>m</small>`;
  els.maxX.textContent = `${positionError.toFixed(3)} m`;
  els.maxV.textContent = `${velocityError.toFixed(3)} m/s`;

  const relativeError = positionError / (Math.max(...data.analX) || 1);
  els.insightTitle.textContent = relativeError < 0.01
    ? "El error numérico permanece pequeño"
    : "Intenta reducir Δt para mayor precisión";
  els.insightText.textContent =
    `El error máximo de posición es ${positionError.toFixed(3)} m en ${state.config.T} segundos.`;
}

// Preparar un canvas para renderizado en alta resolucion en pantallas de Retina.
function setupCanvas(canvas) {
  const rectangle = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = rectangle.width * pixelRatio;
  canvas.height = rectangle.height * pixelRatio;
  const context = canvas.getContext("2d");
  context.scale(pixelRatio, pixelRatio);
  return { ctx: context, w: rectangle.width, h: rectangle.height };
}

function range(valuesA, valuesB) {
  return [Math.min(...valuesA, ...valuesB), Math.max(...valuesA, ...valuesB)];
}

// Dibujo el objeto moviendose y su trayectoria.
function drawMotion() {
  const { ctx, w, h } = setupCanvas(els.motion);
  const data = state.data;
  const config = state.config;
  const index = currentIndex();
  const maxPosition = Math.max(...data.x, 1);
  const ground = h - 43;
  const vertical = config.model.includes("gravity");
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "#d9e8e3";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(28, ground);
  ctx.lineTo(w - 28, ground);
  ctx.stroke();
  ctx.fillStyle = "#9db3ad";
  ctx.font = "10px DM Mono";
  ctx.fillText(vertical ? "ground" : "start", 30, ground + 22);
  ctx.fillText(`${maxPosition.toFixed(1)} m`, w - 63, ground + 22);

  // Dashed trajectory.
  ctx.strokeStyle = "#b9ddd4";
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  const skip = Math.max(1, Math.floor(data.x.length / 80));
  for (let n = 0; n < data.x.length; n += skip) {
    if (vertical) {
      const y = ground - (data.x[n] / maxPosition) * (ground - 30);
      ctx.lineTo(w / 2, y);
    } else {
      const x = 30 + (data.x[n] / maxPosition) * (w - 60);
      ctx.lineTo(x, ground);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Current object position.
  const positionRatio = data.x[index] / maxPosition;
  const objectX = vertical ? w / 2 : 30 + positionRatio * (w - 60);
  const objectY = vertical ? ground - positionRatio * (ground - 30) : ground;
  ctx.fillStyle = "#159b88";
  ctx.beginPath();
  ctx.arc(objectX, objectY, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(objectX - 3, objectY - 3, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawCharts() {
  drawChart(els.positionChart, state.data.x, state.data.analX);
  drawChart(els.velocityChart, state.data.v, state.data.analV);
  drawChart(els.phaseChart, state.data.x, state.data.v, true);
}

// Draw one of the three analysis charts.
function drawChart(canvas, values, exactValues, phaseChart = false) {
  const { ctx, w, h } = setupCanvas(canvas);
  const padding = { left: 35, right: 10, top: 12, bottom: 25 };
  const plotWidth = w - padding.left - padding.right;
  const plotHeight = h - padding.top - padding.bottom;
  const xValues = phaseChart ? state.data.x : state.data.t;
  const yValues = phaseChart ? state.data.v : values;
  const [minY, maxY] = range(yValues, phaseChart ? state.data.v : exactValues);
  const maxX = Math.max(...xValues, 1);
  const yRange = maxY - minY || 1;
  ctx.clearRect(0, 0, w, h);
  ctx.font = "9px DM Mono";
  ctx.fillStyle = "#98aaa6";
  ctx.strokeStyle = "#edf1ef";
  ctx.lineWidth = 1;

  // Horizontal grid lines and y-axis labels.
  for (let row = 0; row < 4; row++) {
    const y = padding.top + (plotHeight * row) / 3;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
    ctx.fillText((maxY - (yRange * row) / 3).toFixed(1), 3, y + 3);
  }
  ctx.fillText("0", padding.left - 3, h - 7);
  ctx.fillText(maxX.toFixed(1), w - 28, h - 7);

  function drawLine(lineValues, color, dashed) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dashed ? [4, 4] : []);
    ctx.beginPath();
    lineValues.forEach((value, index) => {
      const x = padding.left + (xValues[index] / maxX) * plotWidth;
      const y = padding.top + ((maxY - value) / yRange) * plotHeight;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawLine(values, "#159b88", false);
  drawLine(exactValues, "#f3835a", true);
}

// Animation loop. Speed changes only playback, not the calculated data.
function animationFrame(now) {
  if (!state.running) return;
  if (!state.lastFrame) state.lastFrame = now;
  const elapsed = (now - state.lastFrame) / 1000;
  state.lastFrame = now;
  state.currentTime = Math.min(state.config.T, state.currentTime + elapsed * Number(els.speed.value));
  updateMetrics();
  drawMotion();

  if (state.currentTime >= state.config.T) {
    state.running = false;
    els.play.innerHTML = "▶ <span>Play</span>";
    els.status.textContent = "COMPLETE";
  } else {
    requestAnimationFrame(animationFrame);
  }
}

// User interactions.
els.apply.addEventListener("click", apply);

els.reset.addEventListener("click", () => {
  state.currentTime = 0;
  state.running = false;
  state.lastFrame = 0;
  els.play.innerHTML = "▶ <span>Play</span>";
  els.status.textContent = "READY";
  updateMetrics();
  drawMotion();
});

els.play.addEventListener("click", () => {
  if (state.currentTime >= state.config.T) state.currentTime = 0;
  state.running = !state.running;
  els.play.innerHTML = state.running ? "Ⅱ <span>Pause</span>" : "▶ <span>Play</span>";
  els.status.textContent = state.running ? "RUNNING" : "PAUSED";
  if (state.running) {
    state.lastFrame = 0;
    requestAnimationFrame(animationFrame);
  }
});

els.speed.addEventListener("input", () => {
  els.speedOut.textContent = `${els.speed.value}×`;
});

els.model.addEventListener("change", () => {
  els.desc.textContent = descriptions[els.model.value];
  if (els.model.value.includes("gravity")) els.v0.value = 0;
});

window.addEventListener("resize", () => {
  if (state.data) {
    drawMotion();
    drawCharts();
  }
});

// Start the app using the default parameters.
apply();
