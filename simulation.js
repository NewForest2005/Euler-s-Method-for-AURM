// MeNewLab — física, método numérico, gráficas y animación.

// Función auxiliar para seleccionar elementos de la página (muchas gracias por esta funcion Claude :) ).
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
  phaseChart: $("phaseChart"),
  diameter: $("diameterInput"), mass: $("massInput"), rho: $("rhoInput"),
  mu: $("muInput"), ca: $("caInput"), atmoTemp: $("atmoTempInput"),
  altitude: $("altitudeInput"), physicalK1: $("physicalK1"), physicalK2: $("physicalK2"),
  re: $("reMetric"), dragChart: $("dragChart"), regimeValue: $("regimeValue"),
  regimeText: $("regimeText"), analyticalLegend: $("analyticalLegend"), kUnit: $("kUnit")
};

let state = { config: null, data: null, currentTime: 0, running: false, lastFrame: 0 };

const descriptions = {
  "quadratic-gravity": "Caída vertical desde el reposo con resistencia del aire cuadrática.",
  "linear-gravity": "Caída vertical desde el reposo con resistencia del aire lineal.",
  quadratic: "Lanzamiento horizontal frenado por resistencia cuadrática.",
  linear: "Lanzamiento horizontal frenado por resistencia lineal.",
  dragon: "Reentrada vertical de Dragon con densidad atmosférica variable."
};

const AIR = {
  kB: 1.380649e-23,
  m0: 4.81e-26
};

function isDragon(config) {
  return config.model === "dragon";
}

// Densidad exponencial de la atmósfera, usando la escala de altura H.
function atmosphericDensity(altitude, config) {
  const safeAltitude = Math.max(0, altitude);
  const scaleHeight = (AIR.kB * config.atmoTemp) / (AIR.m0 * config.g);
  return config.rho0 * Math.exp(-safeAltitude / scaleHeight);
}

// Aproximación educativa de la curva de una esfera C_a(Re).
function dragCoefficientFromRe(reynolds) {
  if (reynolds <= 0) return 0.44;
  if (reynolds < 1) return 24 / reynolds;
  if (reynolds < 1000) {
    return (24 / reynolds) * (1 + 0.15 * reynolds ** 0.687);
  }
  if (reynolds < 200000) return 0.44;
  if (reynolds < 300000) return 0.44 - 0.24 * ((reynolds - 200000) / 100000);
  return 0.20;
}

function physicalCoefficients(config, density = config.rho0) {
  const area = Math.PI * config.diameter ** 2 / 4;
  const k1 = (density * config.ca * area) / (2 * config.mass);
  const k2 = (3 * Math.PI * config.diameter * config.mu) / config.mass;
  return { area, k1, k2 };
}

function dragonPhysics(position, velocity, config) {
  const altitude = config.altitude - position;
  const density = atmosphericDensity(altitude, config);
  const reynolds = Math.abs(velocity) * config.diameter * density / config.mu;
  const dragCoefficient = dragCoefficientFromRe(reynolds);
  const { area, k1 } = physicalCoefficients(config, density);
  return {
    acceleration: config.g - k1 * velocity * Math.abs(velocity),
    altitude,
    density,
    reynolds,
    dragCoefficient,
    area,
    k1
  };
}

// Aceleración para cada modelo físico.
function acceleration(position, velocity, config) {
  if (isDragon(config)) return dragonPhysics(position, velocity, config).acceleration;
  const drag = config.model.includes("quadratic")
    ? config.k * velocity * Math.abs(velocity)
    : config.k * velocity;
  return config.model.includes("gravity") ? config.g - drag : -drag;
}

// Soluciones analíticas para comparar la aproximación de Euler.
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

  // Resistencia cuadrática con gravedad, comenzando desde el reposo.
  const q = Math.sqrt(g * k);
  return {
    x: Math.log(Math.cosh(q * time)) / k,
    v: Math.sqrt(g / k) * Math.tanh(q * time)
  };
}

// Método de Euler: calcula posición y velocidad paso a paso.
function simulate(config) {
  const times = [0];
  const positions = [0];
  const velocities = [isDragon(config) || !config.model.includes("gravity") ? config.v0 : 0];
  const analyticalPositions = isDragon(config) ? null : [0];
  const analyticalVelocities = isDragon(config) ? null : [velocities[0]];
  const densities = isDragon(config) ? [atmosphericDensity(config.altitude, config)] : null;
  const reynolds = isDragon(config) ? [0] : null;
  let time = 0;

  while (time < config.T - 1e-10) {
    const step = Math.min(config.dt, config.T - time);
    const currentPosition = positions[positions.length - 1];
    const currentVelocity = velocities[velocities.length - 1];
    const currentAcceleration = acceleration(currentPosition, currentVelocity, config);
    positions.push(positions[positions.length - 1] + currentVelocity * step);
    velocities.push(currentVelocity + currentAcceleration * step);
    time += step;
    times.push(time);

    if (isDragon(config)) {
      const local = dragonPhysics(positions[positions.length - 1], velocities[velocities.length - 1], config);
      densities.push(local.density);
      reynolds.push(local.reynolds);
    } else {
      const exact = analytical(time, config);
      analyticalPositions.push(exact.x);
      analyticalVelocities.push(exact.v);
    }
  }

  return {
    t: times,
    x: positions,
    v: velocities,
    analX: analyticalPositions,
    analV: analyticalVelocities,
    density: densities,
    reynolds
  };
}

// Lee los controles y rechaza parámetros físicos inválidos.
function readConfig() {
  const config = {
    model: els.model.value,
    k: Number(els.k.value),
    dt: Number(els.dt.value),
    v0: Number(els.v0.value),
    T: Number(els.T.value),
    g: Number(els.g.value),
    diameter: Number(els.diameter.value),
    mass: Number(els.mass.value),
    rho0: Number(els.rho.value),
    mu: Number(els.mu.value),
    ca: Number(els.ca.value),
    atmoTemp: Number(els.atmoTemp.value),
    altitude: Number(els.altitude.value)
  };

  if (!Number.isFinite(config.k) || config.k < 0.001 || config.k > 2) {
    throw Error("El coeficiente k debe estar entre 0.001 y 2.");
  }
  if (!Number.isFinite(config.dt) || config.dt < 0.001 || config.dt > 0.5) {
    throw Error("El paso de tiempo Δt debe estar entre 0.001 y 0.5 s.");
  }
  if (!Number.isFinite(config.T) || config.T < 0.5 || config.T > 5000) {
    throw Error("El tiempo total debe estar entre 0.5 y 5000 s.");
  }
  if (!Number.isFinite(config.v0) || config.v0 < 0 || config.v0 > 100) {
    throw Error("La velocidad inicial debe estar entre 0 y 100 m/s.");
  }
  if (!Number.isFinite(config.g) || config.g < 0 || config.g > 30) {
    throw Error("La gravedad debe estar entre 0 y 30 m/s².");
  }
  if (isDragon(config) && config.g === 0) {
    throw Error("Dragon necesita una gravedad mayor que cero.");
  }
  if (!Number.isFinite(config.diameter) || config.diameter <= 0) {
    throw Error("El diámetro debe ser positivo.");
  }
  if (!Number.isFinite(config.mass) || config.mass <= 0) {
    throw Error("La masa debe ser positiva.");
  }
  if (!Number.isFinite(config.rho0) || config.rho0 <= 0) {
    throw Error("La densidad del aire debe ser positiva.");
  }
  if (!Number.isFinite(config.mu) || config.mu <= 0) {
    throw Error("La viscosidad debe ser positiva.");
  }
  if (!Number.isFinite(config.ca) || config.ca <= 0) {
    throw Error("Cₐ debe ser positivo.");
  }
  if (!Number.isFinite(config.atmoTemp) || config.atmoTemp <= 0) {
    throw Error("La temperatura atmosférica debe ser positiva.");
  }
  if (!Number.isFinite(config.altitude) || config.altitude < 0) {
    throw Error("La altitud inicial no puede ser negativa.");
  }
  return config;
}

function updatePhysicalSummary(config) {
  const coefficients = physicalCoefficients(config);
  els.physicalK1.textContent = coefficients.k1.toExponential(2);
  els.physicalK2.textContent = coefficients.k2.toExponential(2);
}

function updateKUnit(model) {
  if (model === "dragon") {
    els.kUnit.textContent = "no usado";
  } else if (model.includes("quadratic")) {
    els.kUnit.textContent = "1/m";
  } else {
    els.kUnit.textContent = "1/s";
  }
}

// Aplica los controles actuales y genera una simulación nueva.
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
      : config.model === "dragon"
        ? "Reentrada vertical de Dragon"
        : "Objeto desacelerando por la resistencia";
    els.status.textContent = "LISTO";
    els.analyticalLegend.style.display = isDragon(config) ? "none" : "inline";
    updateKUnit(config.model);
    updatePhysicalSummary(config);
    updateMetrics();
    drawMotion();
    drawCharts();
    drawDragChart();
  } catch (error) {
    els.err.textContent = error.message;
  }
}

function maxError(values, exactValues) {
  if (!exactValues) return null;
  return Math.max(...values.map((value, index) => Math.abs(value - exactValues[index])));
}

function currentIndex() {
  const { t } = state.data;
  let index = 0;
  while (index < t.length - 1 && t[index + 1] <= state.currentTime) index++;
  return index;
}

// Interpola entre dos pasos para que la animación sea visualmente continua.
function currentState() {
  const data = state.data;
  const index = currentIndex();

  if (index >= data.t.length - 1) {
    return { position: data.x[index], velocity: data.v[index] };
  }

  const duration = data.t[index + 1] - data.t[index];
  const fraction = duration > 0
    ? (state.currentTime - data.t[index]) / duration
    : 0;

  return {
    position: data.x[index] + fraction * (data.x[index + 1] - data.x[index]),
    velocity: data.v[index] + fraction * (data.v[index + 1] - data.v[index])
  };
}

// Actualizar los valores mostrados en la parte posterior del canvas de movimiento.
function updateMetrics() {
  if (!state.data) return;
  const data = state.data;
  const index = currentIndex();
  const frame = currentState();
  const positionError = maxError(data.x, data.analX);
  const velocityError = maxError(data.v, data.analV);
  els.time.innerHTML = `${data.t[index].toFixed(2)} <small>s</small>`;
  els.position.innerHTML = `${frame.position.toFixed(2)} <small>m</small>`;
  els.velocity.innerHTML = `${frame.velocity.toFixed(2)} <small>m/s</small>`;
  if (state.config.model === "dragon") {
    els.error.innerHTML = "No disponible";
    els.maxX.textContent = "No disponible";
    els.maxV.textContent = "No disponible";
    els.insightTitle.textContent = "Modelo Dragon: sin solución analítica cerrada";
    els.insightText.textContent = "La comparación se realiza entre pasos de Euler y las variables atmosféricas locales.";
  } else {
    els.error.innerHTML = `${Math.abs(data.x[index] - data.analX[index]).toFixed(3)} <small>m</small>`;
    els.maxX.textContent = `${positionError.toFixed(3)} m`;
    els.maxV.textContent = `${velocityError.toFixed(3)} m/s`;
    const relativeError = positionError / (Math.max(...data.analX) || 1);
    els.insightTitle.textContent = relativeError < 0.01
      ? "El error numérico permanece pequeño"
      : "Intenta reducir Δt para mayor precisión";
    els.insightText.textContent =
      `El error máximo de posición es ${positionError.toFixed(3)} m en ${state.config.T} segundos.`;

    if (!state.config.model.includes("gravity") && state.config.v0 === 0) {
      els.insightTitle.textContent = "Reposo permanente en los casos 1 y 2";
      els.insightText.textContent =
        "Con v₀ = 0 y sin gravedad, la resistencia no puede iniciar el movimiento: x(t) y v(t) permanecen constantes.";
    }
  }

  const currentRe = data.reynolds
    ? data.reynolds[index]
    : Math.abs(data.v[index]) * state.config.diameter * state.config.rho0 / state.config.mu;
  els.re.textContent = currentRe > 0 ? currentRe.toFixed(1) : "0";
  if (currentRe < 1) {
    els.regimeValue.textContent = "Lineal";
    els.regimeText.textContent = "Re < 1: la resistencia viscosa domina.";
  } else {
    els.regimeValue.textContent = "Cuadrático";
    els.regimeText.textContent = "Re > 1: la resistencia inercial domina.";
  }
}

// Prepara un canvas para pantallas Retina.
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

// Render del objeto y sutrayectoria
function drawMotion() {
  const { ctx, w, h } = setupCanvas(els.motion);
  const data = state.data;
  const config = state.config;
  const index = currentIndex();
  const frame = currentState();
  const maxPosition = Math.max(...data.x, 1);
  const ground = h - 43;
  const vertical = config.model.includes("gravity") || isDragon(config);
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "#d9e8e3";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(28, ground);
  ctx.lineTo(w - 28, ground);
  ctx.stroke();
  ctx.fillStyle = "#9db3ad";
  ctx.font = "10px DM Mono";
  ctx.fillText(vertical ? "suelo" : "inicio", 30, ground + 22);
  ctx.fillText(`${maxPosition.toFixed(1)} m`, w - 63, ground + 22);

  // Trayectoria punteada.
  ctx.strokeStyle = "#b9ddd4";
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  const skip = Math.max(1, Math.floor(data.x.length / 80));
  for (let n = 0; n < data.x.length; n += skip) {
    if (vertical) {
      const y = 30 + (data.x[n] / maxPosition) * (ground - 30);
      if (n === 0) ctx.moveTo(w / 2, y);
      else ctx.lineTo(w / 2, y);
    } else {
      const x = 30 + (data.x[n] / maxPosition) * (w - 60);
      if (n === 0) ctx.moveTo(x, ground);
      else ctx.lineTo(x, ground);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Posición actual del objeto.
  const positionRatio = frame.position / maxPosition;
  const objectX = vertical ? w / 2 : 30 + positionRatio * (w - 60);
  const objectY = vertical ? 30 + positionRatio * (ground - 30) : ground;
  ctx.fillStyle = "#159b88";
  ctx.beginPath();
  ctx.arc(objectX, objectY, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(objectX - 3, objectY - 3, 2, 0, Math.PI * 2);
  ctx.fill();

  // Flecha que muestra la dirección y magnitud de la velocidad.
  const arrowLength = Math.min(54, Math.abs(frame.velocity) * 2.2);
  const direction = frame.velocity >= 0 ? 1 : -1;
  const arrowX = vertical ? objectX : objectX + direction * arrowLength;
  const arrowY = vertical ? objectY + direction * arrowLength : objectY;
  ctx.strokeStyle = "#f3835a";
  ctx.fillStyle = "#f3835a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(objectX, objectY);
  ctx.lineTo(arrowX, arrowY);
  ctx.stroke();
  ctx.beginPath();
  if (vertical) {
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX - 4, arrowY - direction * 8);
    ctx.lineTo(arrowX + 4, arrowY - direction * 8);
  } else {
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX - direction * 8, arrowY - 4);
    ctx.lineTo(arrowX - direction * 8, arrowY + 4);
  }
  ctx.closePath();
  ctx.fill();
}

function drawCharts() {
  drawChart(els.positionChart, state.data.x, state.data.analX);
  drawChart(els.velocityChart, state.data.v, state.data.analV);
  drawChart(els.phaseChart, state.data.v, state.data.analV, true, state.data.analX);
}

// Dibuja una de las tres gráficas de análisis.
function drawChart(canvas, values, exactValues, phaseChart = false, exactXValues = null) {
  const { ctx, w, h } = setupCanvas(canvas);
  const padding = { left: 35, right: 10, top: 12, bottom: 25 };
  const plotWidth = w - padding.left - padding.right;
  const plotHeight = h - padding.top - padding.bottom;
  const xValues = phaseChart ? state.data.x : state.data.t;
  const yValues = phaseChart ? state.data.v : values;
  const [minY, maxY] = range(yValues, exactValues || []);
  const maxX = Math.max(...xValues, 1);
  const yRange = maxY - minY || 1;
  ctx.clearRect(0, 0, w, h);
  ctx.font = "9px DM Mono";
  ctx.fillStyle = "#98aaa6";
  ctx.strokeStyle = "#edf1ef";
  ctx.lineWidth = 1;

  // Líneas horizontales de la cuadrícula y etiquetas del eje vertical.
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

  function drawLine(lineValues, color, dashed, lineXValues = xValues) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dashed ? [4, 4] : []);
    ctx.beginPath();
    lineValues.forEach((value, index) => {
      const x = padding.left + (lineXValues[index] / maxX) * plotWidth;
      const y = padding.top + ((maxY - value) / yRange) * plotHeight;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawLine(values, "#159b88", false);
  if (exactValues) {
    drawLine(exactValues, "#f3835a", true, exactXValues || xValues);
  }
}

// Dibuja la relación aproximada entre el coeficiente de arrastre y Reynolds.
function drawDragChart() {
  const { ctx, w, h } = setupCanvas(els.dragChart);
  const left = 42;
  const right = 12;
  const top = 14;
  const bottom = 28;
  const width = w - left - right;
  const height = h - top - bottom;
  const minLog = -2;
  const maxLog = 7;
  const maxCd = 25;

  ctx.clearRect(0, 0, w, h);
  ctx.font = "9px DM Mono";
  ctx.fillStyle = "#98aaa6";
  ctx.strokeStyle = "#edf1ef";

  for (let row = 0; row < 4; row++) {
    const y = top + (height * row) / 3;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(w - right, y);
    ctx.stroke();
    ctx.fillText((maxCd - (maxCd * row) / 3).toFixed(0), 8, y + 3);
  }

  ctx.strokeStyle = "#159b88";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 180; i++) {
    const logRe = minLog + ((maxLog - minLog) * i) / 180;
    const reynolds = 10 ** logRe;
    const coefficient = Math.min(maxCd, dragCoefficientFromRe(reynolds));
    const x = left + ((logRe - minLog) / (maxLog - minLog)) * width;
    const y = top + (1 - coefficient / maxCd) * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillText("Re = 1", left + (2 / 9) * width, h - 8);
  ctx.fillText("Re = 10⁷", w - 52, h - 8);
  ctx.fillText("Cₐ", 8, top - 3);
  ctx.fillText("Re (escala log)", w - 88, h - 8);
}

// Animacion de la simulacion.
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
    els.play.innerHTML = "▶ <span>Reproducir</span>";
    els.status.textContent = "COMPLETO";
  } else {
    requestAnimationFrame(animationFrame);
  }
}

// Interfaz de Usuario.
els.apply.addEventListener("click", apply);

els.reset.addEventListener("click", () => {
  state.currentTime = 0;
  state.running = false;
  state.lastFrame = 0;
  els.play.innerHTML = "▶ <span>Reproducir</span>";
  els.status.textContent = "LISTO";
  updateMetrics();
  drawMotion();
});

els.play.addEventListener("click", () => {
  if (state.currentTime >= state.config.T) state.currentTime = 0;
  state.running = !state.running;
  els.play.innerHTML = state.running ? "Ⅱ <span>Pausar</span>" : "▶ <span>Reproducir</span>";
  els.status.textContent = state.running ? "EJECUTANDO" : "PAUSADO";
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
  apply();
});

window.addEventListener("resize", () => {
  if (state.data) {
    drawMotion();
    drawCharts();
    drawDragChart();
  }
});

// Inicia la aplicación con los parámetros predeterminados.
apply();
