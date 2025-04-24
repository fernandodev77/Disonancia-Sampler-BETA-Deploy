/***** CONFIGURACIÓN DEL AUDIO *****/
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

// Lista de samples locales por defecto (ruta en ./Audio/)
// Si se carga un preset distinto a "Default", se usará la ruta: ./Audio/<Preset>/sampleN.wav
// Inicialmente no cargamos ningún sample para mejorar la inicialización del audio
let audioFiles = [
  '',
  '',
  '',
  '',
  '',
  '',
  ''
];
const buffers = [null, null, null, null, null, null, null];

async function loadSample(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return await audioCtx.decodeAudioData(arrayBuffer);
}

async function loadSamples() {
  buffers.length = 0;
  for (let url of audioFiles) {
    try {
      const buffer = await loadSample(url);
      buffers.push(buffer);
    } catch (e) {
      console.error('Error al cargar el sample: ' + url, e);
    }
  }
  updateSampleNames();
}
loadSamples();

/***** CREACIÓN DE CANALES *****/
const channels = [];
for (let i = 0; i < 7; i++) {
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 0.5;
  const panNode = audioCtx.createStereoPanner();
  panNode.pan.value = 0;
  gainNode.connect(panNode);
  channels.push({ gainNode, panNode });
}

/***** CONFIGURACIÓN DE EFECTOS *****/
const masterGain = audioCtx.createGain();
masterGain.gain.value = 0.8; // Default to 80%
const dryGain = audioCtx.createGain();
dryGain.gain.value = 1;
masterGain.connect(dryGain);
dryGain.connect(audioCtx.destination);

// Reverb
function createImpulseResponse(duration, decay) {
  const sampleRate = audioCtx.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioCtx.createBuffer(2, length, sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}
const convolver = audioCtx.createConvolver();
convolver.buffer = createImpulseResponse(2, 2);
const reverbGain = audioCtx.createGain();
reverbGain.gain.value = 0;
masterGain.connect(convolver);
convolver.connect(reverbGain);
reverbGain.connect(audioCtx.destination);

// Delay
const delayNode = audioCtx.createDelay(1.0);
const delayFeedback = audioCtx.createGain();
delayFeedback.gain.value = 0.3;
const delayWetGain = audioCtx.createGain();
delayWetGain.gain.value = 0;
delayNode.delayTime.value = 0.15;
masterGain.connect(delayNode);
delayNode.connect(delayFeedback);
delayFeedback.connect(delayNode);
delayNode.connect(delayWetGain);
delayWetGain.connect(audioCtx.destination);

// Filtro
const filterNode = audioCtx.createBiquadFilter();
filterNode.type = 'lowpass';
filterNode.frequency.value = 10000;
const filterGain = audioCtx.createGain();
filterGain.gain.value = 0;
masterGain.connect(filterNode);
filterNode.connect(filterGain);
filterGain.connect(audioCtx.destination);

// Distorsión
const distortion = audioCtx.createWaveShaper();
function makeDistortionCurve(amount) {
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; i++) {
    const x = i * 2 / n_samples - 1;
    curve[i] = (3 + amount) * x * 20 * deg / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}
distortion.curve = makeDistortionCurve(0);
distortion.oversample = '4x';
const distortionGain = audioCtx.createGain();
distortionGain.gain.value = 0;
masterGain.connect(distortion);
distortion.connect(distortionGain);
distortionGain.connect(audioCtx.destination);

// Chorus
const chorusDelay = audioCtx.createDelay();
chorusDelay.delayTime.value = 0.03;
const chorusLFO = audioCtx.createOscillator();
chorusLFO.type = 'sine';
chorusLFO.frequency.value = 0.25;
const chorusLFOGain = audioCtx.createGain();
chorusLFOGain.gain.value = 0.005;
chorusLFO.connect(chorusLFOGain);
chorusLFOGain.connect(chorusDelay.delayTime);
chorusLFO.start();
const chorusWetGain = audioCtx.createGain();
chorusWetGain.gain.value = 0;
masterGain.connect(chorusDelay);
chorusDelay.connect(chorusWetGain);
chorusWetGain.connect(audioCtx.destination);

// Phaser
const phaserAllpass1 = audioCtx.createBiquadFilter();
phaserAllpass1.type = 'allpass';
phaserAllpass1.frequency.value = 800;
const phaserAllpass2 = audioCtx.createBiquadFilter();
phaserAllpass2.type = 'allpass';
phaserAllpass2.frequency.value = 1200;
const phaserWetGain = audioCtx.createGain();
phaserWetGain.gain.value = 0;
masterGain.connect(phaserAllpass1);
phaserAllpass1.connect(phaserAllpass2);
phaserAllpass2.connect(phaserWetGain);
phaserWetGain.connect(audioCtx.destination);
// LFO para el phaser
const phaserLFO = audioCtx.createOscillator();
phaserLFO.type = 'sine';
phaserLFO.frequency.value = 0.5; // valor inicial
const phaserLFOGain = audioCtx.createGain();
phaserLFOGain.gain.value = 600; // profundidad de modulación en Hz
phaserLFO.connect(phaserLFOGain);
phaserLFOGain.connect(phaserAllpass1.frequency);
phaserLFOGain.connect(phaserAllpass2.frequency);
phaserLFO.start();

// FrequencyShifter (Ring Modulation)
const freqShifterLFO = audioCtx.createOscillator();
freqShifterLFO.type = 'sine';
freqShifterLFO.frequency.value = 0; // Inicialmente 0 Hz
const freqShifterLFOGain = audioCtx.createGain();
freqShifterLFOGain.gain.value = 0; // Profundidad inicial 0
const freqShifterGain = audioCtx.createGain();
freqShifterGain.gain.value = 1;
const freqShifterWetGain = audioCtx.createGain();
freqShifterWetGain.gain.value = 0;
const freqShifterDryGain = audioCtx.createGain();
freqShifterDryGain.gain.value = 1;
// Nodo de modulación en anillo
const freqShifterRingMod = audioCtx.createGain();
masterGain.connect(freqShifterRingMod);
freqShifterLFO.connect(freqShifterLFOGain);
freqShifterLFOGain.connect(freqShifterRingMod.gain);
freqShifterRingMod.connect(freqShifterWetGain);
masterGain.connect(freqShifterDryGain);
// Mezcla realista dry/wet
const freqShifterMix = audioCtx.createGain();
freqShifterWetGain.connect(freqShifterMix);
freqShifterDryGain.connect(freqShifterMix);
freqShifterMix.connect(audioCtx.destination);
// Controlador de dry/wet
function setFreqShifterWet(value) {
  // Cuando el wet está al máximo, silenciar completamente el dry
  if (value >= 0.99) {
    freqShifterWetGain.gain.value = 1;
    freqShifterDryGain.gain.value = 0;
  } else if (value <= 0.01) {
    freqShifterWetGain.gain.value = 0;
    freqShifterDryGain.gain.value = 1;
  } else {
    freqShifterWetGain.gain.value = value;
    freqShifterDryGain.gain.value = 1 - value;
  }
}
freqShifterLFO.start();

// Pitch Shift (simple implementation)
const pitchShiftToggle = document.getElementById('pitchShiftToggle');
const pitchShiftKnob = document.getElementById('pitchShiftKnob');
let pitchShiftAmount = 0; // en semitonos
let pitchShiftActive = false;

// Inicializar el valor del knob a 0 (dry)
pitchShiftKnob.value = 0;

pitchShiftKnob.addEventListener('input', (e) => {
  // Ahora el rango es de 0 (dry) a 1 (máximo efecto)
  // El rango de semitonos será de 0 a +24
  pitchShiftAmount = Math.round(parseFloat(e.target.value) * 24);
  if (pitchShiftToggle.checked) {
    pitchShiftActive = true;
  }
  // Actualizar rotación del knob
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});
pitchShiftToggle.addEventListener('change', (e) => {
  pitchShiftActive = e.target.checked;
});

// AutoWah mejorado
const autoWahToggle = document.getElementById('autoWahToggle');
const autoWahFreqKnob = document.getElementById('autoWahFreqKnob');
const autoWahQKnob = document.getElementById('autoWahQKnob');
const autoWahDepthKnob = document.getElementById('autoWahDepthKnob');
const autoWahFilter = audioCtx.createBiquadFilter();
autoWahFilter.type = 'bandpass';
autoWahFilter.frequency.value = 350;
autoWahFilter.Q.value = 5;
const autoWahGain = audioCtx.createGain();
autoWahGain.gain.value = 0;
masterGain.connect(autoWahFilter);
autoWahFilter.connect(autoWahGain);
autoWahGain.connect(audioCtx.destination);

const autoWahLFO = audioCtx.createOscillator();
autoWahLFO.type = 'sine';
autoWahLFO.frequency.value = 2;
const autoWahLFOGain = audioCtx.createGain();
autoWahLFOGain.gain.value = 0;
autoWahLFO.connect(autoWahLFOGain);
autoWahLFOGain.connect(autoWahFilter.frequency);
autoWahLFO.start();

// Tremolo
const tremoloGain = audioCtx.createGain();
tremoloGain.gain.value = 1;
const tremoloLFO = audioCtx.createOscillator();
tremoloLFO.type = 'sine';
tremoloLFO.frequency.value = 5;
const tremoloDepth = audioCtx.createGain();
tremoloDepth.gain.value = 0;
tremoloLFO.connect(tremoloDepth);
tremoloDepth.connect(tremoloGain.gain);
masterGain.connect(tremoloGain);
tremoloGain.connect(audioCtx.destination);
tremoloLFO.start();

// Conectar canales al master
channels.forEach(ch => {
  ch.panNode.connect(masterGain);
});

/***** INTERFAZ DEL SECUENCIADOR *****/
const sequencerState = [];
for (let i = 0; i < 7; i++) {
  sequencerState[i] = new Array(16).fill(false);
}

const sequencerGrid = document.getElementById('sequencer-grid');
const sampleNames = [];

for (let i = 0; i < 7; i++) {
  const channelDiv = document.createElement('div');
  channelDiv.className = 'channel';
  channelDiv.dataset.channel = i;

  const headerDiv = document.createElement('div');
  headerDiv.className = 'channel-header';

  const labelDiv = document.createElement('div');
  labelDiv.className = 'channel-label';
  labelDiv.textContent = 'Canal ' + (i + 1);

  const sampleNameLabel = document.createElement('span');
  sampleNameLabel.className = 'sample-name';
  sampleNameLabel.textContent = '(' + audioFiles[i].split('/').pop() + ')';
  labelDiv.appendChild(sampleNameLabel);
  headerDiv.appendChild(labelDiv);

  const configButton = document.createElement('button');
  configButton.className = 'channel-config-btn';
  configButton.innerHTML = '🎚️ Mix';
  headerDiv.appendChild(configButton);

  const loadSampleBtn = document.createElement('button');
  loadSampleBtn.className = 'load-sample-btn';
  loadSampleBtn.innerHTML = '📁 Cargar';
  headerDiv.appendChild(loadSampleBtn);

  channelDiv.appendChild(headerDiv);

  const configDiv = document.createElement('div');
  configDiv.className = 'channel-config';
  configDiv.style.display = 'none';
  configDiv.innerHTML = `
    <label>Volumen:
      <input type="range" class="volume-slider" min="0" max="1" step="0.01" value="0.5">
    </label>
    <label>Panning:
      <input type="range" class="panning-slider" min="-1" max="1" step="0.1" value="0">
    </label>
  `;
  channelDiv.appendChild(configDiv);
  configButton.addEventListener('click', () => {
    configDiv.style.display = configDiv.style.display === 'none' ? 'block' : 'none';
  });
  const volumeSlider = configDiv.querySelector('.volume-slider');
  const panningSlider = configDiv.querySelector('.panning-slider');
  volumeSlider.addEventListener('input', (e) => {
    channels[i].gainNode.gain.value = parseFloat(e.target.value);
  });
  panningSlider.addEventListener('input', (e) => {
    channels[i].panNode.pan.value = parseFloat(e.target.value);
  });

  const stepsDiv = document.createElement('div');
  stepsDiv.className = 'steps';
  for (let j = 0; j < 16; j++) {
    const stepBtn = document.createElement('button');
    stepBtn.className = 'step';
    stepBtn.dataset.step = j;
    if ((j + 1) % 4 === 0) stepBtn.classList.add('beat');
    stepsDiv.appendChild(stepBtn);
  }
  channelDiv.appendChild(stepsDiv);
  sequencerGrid.appendChild(channelDiv);
  sampleNames.push(sampleNameLabel);
}

document.querySelectorAll('.step').forEach(button => {
  button.addEventListener('click', () => {
    const step = parseInt(button.getAttribute('data-step'));
    const channel = parseInt(button.closest('.channel').dataset.channel);
    sequencerState[channel][step] = !sequencerState[channel][step];
    button.classList.toggle('active', sequencerState[channel][step]);
  });
});

/***** CONTROLES Y EFECTOS *****/
const tempoSlider = document.getElementById('tempo');
const tempoDisplay = document.getElementById('tempoDisplay');
const playButton = document.getElementById('play');
const stopButton = document.getElementById('stop');
const masterVolumeSlider = document.getElementById('master-volume');
const masterVolumeValue = document.getElementById('master-volume-value');

const reverbToggle = document.getElementById('reverbToggle');
const reverbKnob = document.getElementById('reverbKnob');
const reverbDecayKnob = document.getElementById('reverbDecayKnob');

const delayToggle = document.getElementById('delayToggle');
const delayKnob = document.getElementById('delayKnob');
const delayFeedbackKnob = document.getElementById('delayFeedbackKnob');

const filterToggle = document.getElementById('filterToggle');
const filterKnob = document.getElementById('filterKnob');
const filterQKnob = document.getElementById('filterQKnob');

const distortionToggle = document.getElementById('distortionToggle');
const distortionKnob = document.getElementById('distortionKnob');

const chorusToggle = document.getElementById('chorusToggle');
const chorusKnob = document.getElementById('chorusKnob');

const phaserToggle = document.getElementById('phaserToggle');
const phaserKnob = document.getElementById('phaserKnob');
const phaserRateKnob = document.getElementById('phaserRateKnob');

tempoSlider.addEventListener('input', (e) => {
  tempoDisplay.textContent = e.target.value;
});

// Master Volume Control
masterVolumeSlider.addEventListener('input', (e) => {
  const volumeValue = parseInt(e.target.value);
  masterVolumeValue.textContent = volumeValue + '%';
  masterGain.gain.value = volumeValue / 100;
});

// Reverb: control de wet y decay
reverbToggle.addEventListener('change', () => {
  reverbGain.gain.value = reverbToggle.checked ? parseFloat(reverbKnob.value) : 0;
});
reverbKnob.addEventListener('input', (e) => {
  if (reverbToggle.checked) reverbGain.gain.value = parseFloat(e.target.value);
  // Actualizar rotación del knob
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});
reverbDecayKnob.addEventListener('input', (e) => {
  const decay = parseFloat(e.target.value);
  convolver.buffer = createImpulseResponse(2, decay);
  // Actualizar rotación del knob
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});

// Delay: control de time y feedback
delayToggle.addEventListener('change', () => {
  delayWetGain.gain.value = delayToggle.checked ? parseFloat(delayKnob.value) : 0;
});
delayKnob.addEventListener('input', (e) => {
  if (delayToggle.checked) {
    delayWetGain.gain.value = parseFloat(e.target.value);
    delayNode.delayTime.value = parseFloat(e.target.value);
  }
  // Actualizar rotación del knob
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});
delayFeedbackKnob.addEventListener('input', (e) => {
  delayFeedback.gain.value = parseFloat(e.target.value);
  // Actualizar rotación del knob
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});

// Filtro: control de frecuencia y Q
filterToggle.addEventListener('change', () => {
  filterGain.gain.value = filterToggle.checked ? 1 : 0;
  filterNode.frequency.value = filterToggle.checked ? parseFloat(filterKnob.value) : 10000;
  if (filterToggle.checked) filterNode.Q.value = parseFloat(filterQKnob.value);
});
filterKnob.addEventListener('input', (e) => {
  if (filterToggle.checked) filterNode.frequency.value = parseFloat(e.target.value);
  // Actualizar rotación del knob
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});
filterQKnob.addEventListener('input', (e) => {
  if (filterToggle.checked) filterNode.Q.value = parseFloat(e.target.value);
  // Actualizar rotación del knob
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});

// Distorsión
distortionToggle.addEventListener('change', () => {
  if (distortionToggle.checked) {
    const amount = parseFloat(distortionKnob.value) * 400;
    distortion.curve = makeDistortionCurve(amount);
    distortionGain.gain.value = parseFloat(distortionKnob.value);
  } else {
    distortionGain.gain.value = 0;
  }
});
distortionKnob.addEventListener('input', (e) => {
  if (distortionToggle.checked) {
    const amount = parseFloat(e.target.value) * 400;
    distortion.curve = makeDistortionCurve(amount);
    distortionGain.gain.value = parseFloat(e.target.value);
  }
  // Actualizar rotación del knob
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});

// Chorus
chorusToggle.addEventListener('change', () => {
  chorusWetGain.gain.value = chorusToggle.checked ? parseFloat(chorusKnob.value) : 0;
});
chorusKnob.addEventListener('input', (e) => {
  if (chorusToggle.checked) chorusWetGain.gain.value = parseFloat(e.target.value);
  // Actualizar rotación del knob
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});

// Phaser
phaserToggle.addEventListener('change', () => {
  phaserWetGain.gain.value = phaserToggle.checked ? parseFloat(phaserKnob.value) : 0;
});
phaserKnob.addEventListener('input', (e) => {
  if (phaserToggle.checked) phaserWetGain.gain.value = parseFloat(e.target.value);
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});
phaserRateKnob.addEventListener('input', (e) => {
  phaserLFO.frequency.value = parseFloat(e.target.value);
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});

/***** CARGA DE SAMPLE EXTERNO POR CANAL *****/
document.querySelectorAll('.load-sample-btn').forEach((btn, index) => {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'audio/*,.mp3,.wav,.ogg,.aac,.m4a';
  fileInput.style.display = 'none';
  btn.parentElement.appendChild(fileInput);
  btn.addEventListener('click', () => {
    fileInput.click();
  });
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = await audioCtx.decodeAudioData(arrayBuffer);
      buffers[index] = buffer;
      sampleNames[index].textContent = '(' + file.name + ')';
    }
  });
});

/***** CARGA DE PRESETS *****/
const presetSelect = document.getElementById('presetSelect');
const loadPresetButton = document.getElementById('loadPreset');
loadPresetButton.addEventListener('click', () => {
  const preset = presetSelect.value;
  if (preset === "Default") {
    // Borrar samples de los canales
    for (let i = 0; i < 7; i++) {
      buffers[i] = null;
      sampleNames[i].textContent = "(No sample)";
    }
  } else {
    const newAudioFiles = [];
    for (let i = 1; i <= 7; i++) {
      newAudioFiles.push(`./Audio/${preset}/sample${i}.wav`);
    }
    buffers.length = 0;
    audioFiles = newAudioFiles;
    loadSamples();
  }
});

/***** MOTOR DEL SECUENCIADOR CON TEMPO DINÁMICO *****/
let currentStep = 0;
let sequencerTimeout = null;
let running = false;

function playStep() {
  document.querySelectorAll('.step').forEach(button => {
    const step = parseInt(button.getAttribute('data-step'));
    button.classList.toggle('current', step === currentStep);
  });
  for (let ch = 0; ch < 7; ch++) {
    if (sequencerState[ch][currentStep] && buffers[ch]) {
      const sampleSource = audioCtx.createBufferSource();
      sampleSource.buffer = buffers[ch];
      // Pitch Shift modificado: 0 = dry, >0 = pitch up
      if (pitchShiftActive && pitchShiftAmount > 0) {
        let ratio = Math.pow(2, pitchShiftAmount / 12);
        sampleSource.playbackRate.value = ratio;
        sampleSource.connect(autoWahToggle.checked ? autoWahFilter : channels[ch].gainNode);
      } else {
        sampleSource.playbackRate.value = 1;
        sampleSource.connect(autoWahToggle.checked ? autoWahFilter : channels[ch].gainNode);
      }
      sampleSource.start();
    }
  }
  currentStep = (currentStep + 1) % 16;
  scheduleNextStep();
}

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar todos los knobs con su rotación inicial
  const knobs = document.querySelectorAll('.knob input[type="range"]');
  knobs.forEach(knob => {
    const rotation = (knob.value - knob.min) / (knob.max - knob.min);
    knob.parentElement.style.setProperty('--rotation', rotation);
  });
  
  // Inicializar los controles de efectos
  if (reverbToggle.checked) {
    reverbGain.gain.value = parseFloat(reverbKnob.value);
  }
  
  if (delayToggle.checked) {
    delayWetGain.gain.value = parseFloat(delayKnob.value);
    delayNode.delayTime.value = parseFloat(delayKnob.value);
  }
  
  if (filterToggle.checked) {
    filterGain.gain.value = 1;
    filterNode.frequency.value = parseFloat(filterKnob.value);
    filterNode.Q.value = parseFloat(filterQKnob.value);
  }
  
  if (distortionToggle.checked) {
    const amount = parseFloat(distortionKnob.value) * 400;
    distortion.curve = makeDistortionCurve(amount);
    distortionGain.gain.value = parseFloat(distortionKnob.value);
  }
  
  if (chorusToggle.checked) {
    chorusWetGain.gain.value = parseFloat(chorusKnob.value);
  }
  
  if (phaserToggle.checked) {
    phaserWetGain.gain.value = parseFloat(phaserKnob.value);
  }
  
  // Configurar el botón de expansión/contracción de efectos
  const toggleEffectsBtn = document.getElementById('toggleEffects');
  const effectsControlsContainer = document.getElementById('effectsControlsContainer');
  
  // Ocultar los efectos inicialmente
  effectsControlsContainer.style.display = 'none';
  toggleEffectsBtn.textContent = '+';
  document.querySelector('.master-effects').style.minHeight = '120px';
  
  toggleEffectsBtn.addEventListener('click', () => {
    const isVisible = effectsControlsContainer.style.display !== 'none';
    effectsControlsContainer.style.display = isVisible ? 'none' : 'grid';
    toggleEffectsBtn.textContent = isVisible ? '+' : '-';
    
    // Mantener la altura mínima del contenedor de efectos
    document.querySelector('.master-effects').style.minHeight = isVisible ? '120px' : 'auto';
  });
});

function scheduleNextStep() {
  if (!running) return;
  const bpm = parseInt(tempoSlider.value);
  const intervalTime = (60 / bpm / 4) * 1000;
  sequencerTimeout = setTimeout(playStep, intervalTime);
}

function startSequencer() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (!running) {
    running = true;
    scheduleNextStep();
  }
}

function stopSequencer() {
  running = false;
  if (sequencerTimeout) clearTimeout(sequencerTimeout);
  document.querySelectorAll('.step').forEach(button => button.classList.remove('current'));
  currentStep = 0;
}

playButton.addEventListener('click', startSequencer);
stopButton.addEventListener('click', stopSequencer);

function updateSampleNames() {
  for (let i = 0; i < 7; i++) {
    if (audioFiles[i] && audioFiles[i].trim() !== '') {
      const fileName = audioFiles[i].split('/').pop();
      sampleNames[i].textContent = '(' + fileName + ')';
    } else {
      sampleNames[i].textContent = '(No sample)';
    }
  }
}

// --- FrequencyShifter y Tremolo: controles de interfaz ---
const freqShifterToggle = document.getElementById('freqShifterToggle');
const freqShifterKnob = document.getElementById('freqShifterKnob');
const freqShifterWetKnob = document.getElementById('freqShifterWetKnob');
const tremoloToggle = document.getElementById('tremoloToggle');
const tremoloDepthKnob = document.getElementById('tremoloDepthKnob');
const tremoloRateKnob = document.getElementById('tremoloRateKnob');

// FrequencyShifter
freqShifterToggle.addEventListener('change', () => {
  if (freqShifterToggle.checked) {
    freqShifterWetGain.gain.value = parseFloat(freqShifterWetKnob.value);
    freqShifterDryGain.gain.value = 1 - parseFloat(freqShifterWetKnob.value);
    freqShifterLFO.frequency.value = parseFloat(freqShifterKnob.value);
    freqShifterLFOGain.gain.value = 1;
  } else {
    freqShifterWetGain.gain.value = 0;
    freqShifterDryGain.gain.value = 1;
    freqShifterLFOGain.gain.value = 0;
  }
});
freqShifterKnob.addEventListener('input', (e) => {
  if (freqShifterToggle.checked) {
    freqShifterLFO.frequency.value = parseFloat(e.target.value);
  }
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});
freqShifterWetKnob.addEventListener('input', (e) => {
  if (freqShifterToggle.checked) {
    freqShifterWetGain.gain.value = parseFloat(e.target.value);
    freqShifterDryGain.gain.value = 1 - parseFloat(e.target.value);
  }
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});

// Pitch Shift
pitchShiftToggle.addEventListener('change', () => {
  pitchShiftActive = pitchShiftToggle.checked;
});
pitchShiftKnob.addEventListener('input', (e) => {
  pitchShiftAmount = parseFloat(e.target.value);
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});

// AutoWah
autoWahToggle.addEventListener('change', () => {
  autoWahGain.gain.value = autoWahToggle.checked ? parseFloat(autoWahDepthKnob.value) : 0;
  autoWahLFOGain.gain.value = autoWahToggle.checked ? parseFloat(autoWahDepthKnob.value) * 1000 : 0;
});
autoWahFreqKnob.addEventListener('input', (e) => {
  autoWahFilter.frequency.value = parseFloat(e.target.value);
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});
autoWahQKnob.addEventListener('input', (e) => {
  autoWahFilter.Q.value = parseFloat(e.target.value);
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});
autoWahDepthKnob.addEventListener('input', (e) => {
  if (autoWahToggle.checked) {
    autoWahGain.gain.value = parseFloat(e.target.value);
    autoWahLFOGain.gain.value = parseFloat(e.target.value) * 1000;
  }
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});
function updateTremolo() {
  tremoloDepth.gain.value = tremoloToggle.checked ? parseFloat(tremoloDepthKnob.value) : 0;
  tremoloLFO.frequency.value = parseFloat(tremoloRateKnob.value);
}
tremoloToggle.addEventListener('change', updateTremolo);
tremoloDepthKnob.addEventListener('input', (e) => {
  updateTremolo();
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});
tremoloRateKnob.addEventListener('input', (e) => {
  updateTremolo();
  const rotation = (e.target.value - e.target.min) / (e.target.max - e.target.min);
  e.target.parentElement.style.setProperty('--rotation', rotation);
});
// Inicializar valores al cargar
if (freqShifterToggle.checked) {
  freqShifterLFO.frequency.value = parseFloat(freqShifterKnob.value);
  freqShifterLFOGain.gain.value = parseFloat(freqShifterKnob.value);
}

if (tremoloToggle.checked) {
  tremoloDepth.gain.value = parseFloat(tremoloDepthKnob.value);
  tremoloLFO.frequency.value = 5; // Ajustar frecuencia para audibilidad
}
