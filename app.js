const audio = document.getElementById("audio");
const playBtn = document.getElementById("playBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const muteBtn = document.getElementById("muteBtn");
const playModeSelect = document.getElementById("playMode");
const autoNextToggle = document.getElementById("autoNext");
const progress = document.getElementById("progress");
const volume = document.getElementById("volume");
const speed = document.getElementById("speed");
const fileInput = document.getElementById("fileInput");
const dropzone = document.getElementById("dropzone");
const trackList = document.getElementById("trackList");
const trackTitle = document.getElementById("trackTitle");
const trackSubtitle = document.getElementById("trackSubtitle");
const currentTimeLabel = document.getElementById("currentTime");
const remainingTimeLabel = document.getElementById("remainingTime");
const durationLabel = document.getElementById("duration");
const systemStatus = document.getElementById("systemStatus");
const timecodeDisplay = document.getElementById("timecodeDisplay");
const canvas = document.getElementById("waveform");
const canvasCtx = canvas.getContext("2d");
const fadeInBtn = document.getElementById("fadeInBtn");
const fadeOutBtn = document.getElementById("fadeOutBtn");
const addCueBtn = document.getElementById("addCueBtn");
const clearCueBtn = document.getElementById("clearCueBtn");
const cueList = document.getElementById("cueList");
const levelBars = document.querySelectorAll(".level-bar");

let audioContext;
let analyser;
let dataArray;
let animationId;
let tracks = [];
let currentIndex = -1;
let cuePoints = [];
let fadeRequest;
let draggedIndex = null;

const ensureAudioContextRunning = async () => {
  if (!audioContext) {
    return;
  }
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
};

const formatTime = (time) => {
  if (!Number.isFinite(time)) {
    return "00:00";
  }
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
};

const formatTimecode = (time) => {
  if (!Number.isFinite(time)) {
    return "00:00:00";
  }
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor(time % 60);
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const updateTime = () => {
  currentTimeLabel.textContent = formatTime(audio.currentTime);
  durationLabel.textContent = formatTime(audio.duration);
  const remaining = audio.duration ? Math.max(audio.duration - audio.currentTime, 0) : 0;
  remainingTimeLabel.textContent = formatTime(remaining);
  timecodeDisplay.textContent = formatTimecode(audio.currentTime);
  if (audio.duration) {
    progress.value = ((audio.currentTime / audio.duration) * 100).toFixed(2);
  }
};

const updatePlayButton = () => {
  if (audio.paused) {
    playBtn.textContent = "▶ 播放";
  } else {
    playBtn.textContent = "⏸ 暂停";
  }
};

const updateMuteButton = () => {
  muteBtn.textContent = audio.muted ? "取消静音" : "静音";
};

const setSystemStatus = (text, isActive = false) => {
  systemStatus.textContent = text;
  systemStatus.style.color = isActive ? "#2dd4bf" : "#f8fafc";
};

const setActiveTrack = (index) => {
  if (index < 0 || index >= tracks.length) {
    return;
  }
  currentIndex = index;
  const track = tracks[index];
  audio.src = track.url;
  audio.load();
  trackTitle.textContent = track.name;
  trackSubtitle.textContent = track.detail;
  cuePoints = [];
  renderCueList();
  highlightTrack();
};

const getPlayMode = () => playModeSelect.value;

const updateLoopState = () => {
  audio.loop = getPlayMode() === "single-loop";
};

const highlightTrack = () => {
  document.querySelectorAll(".track").forEach((trackEl, idx) => {
    trackEl.classList.toggle("active", idx === currentIndex);
  });
};

const initAudioContext = () => {
  if (audioContext) {
    return;
  }
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  const source = audioContext.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(audioContext.destination);
  dataArray = new Uint8Array(analyser.frequencyBinCount);
};

const playTrack = async () => {
  if (currentIndex === -1 && tracks.length > 0) {
    setActiveTrack(0);
  }
  if (!audio.src) {
    return;
  }
  updateLoopState();
  initAudioContext();
  await ensureAudioContextRunning();
  await audio.play();
  updatePlayButton();
  drawWaveform();
};

const pauseTrack = () => {
  audio.pause();
  updatePlayButton();
};

const updateLevelMeters = (level) => {
  levelBars.forEach((bar) => {
    const width = Math.min(100, Math.max(8, level * 120));
    bar.style.width = `${width}%`;
  });
};

const drawWaveform = () => {
  if (!analyser) {
    return;
  }
  animationId = requestAnimationFrame(drawWaveform);
  analyser.getByteTimeDomainData(dataArray);
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  canvasCtx.fillStyle = "rgba(8, 12, 24, 0.95)";
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeStyle = "#7c5cff";
  canvasCtx.beginPath();
  const sliceWidth = canvas.width / dataArray.length;
  let x = 0;
  let rms = 0;
  for (let i = 0; i < dataArray.length; i += 1) {
    const v = dataArray[i] / 128.0;
    const y = (v * canvas.height) / 2;
    const centered = v - 1;
    rms += centered * centered;
    if (i === 0) {
      canvasCtx.moveTo(x, y);
    } else {
      canvasCtx.lineTo(x, y);
    }
    x += sliceWidth;
  }
  canvasCtx.lineTo(canvas.width, canvas.height / 2);
  canvasCtx.stroke();

  canvasCtx.strokeStyle = "rgba(45, 212, 191, 0.8)";
  canvasCtx.beginPath();
  const barCount = 32;
  const step = Math.floor(dataArray.length / barCount);
  for (let i = 0; i < barCount; i += 1) {
    const value = dataArray[i * step] / 255;
    const barHeight = value * canvas.height * 0.6;
    const barX = i * (canvas.width / barCount) + 2;
    const barY = canvas.height - barHeight - 6;
    canvasCtx.moveTo(barX, canvas.height - 6);
    canvasCtx.lineTo(barX, barY);
  }
  canvasCtx.stroke();

  const rmsValue = Math.sqrt(rms / dataArray.length);
  updateLevelMeters(rmsValue);
};

const stopWaveform = () => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
};

const addTracks = (files) => {
  const fileArray = Array.from(files);
  fileArray.forEach((file) => {
    const url = URL.createObjectURL(file);
    tracks.push({
      name: file.name.replace(/\.[^/.]+$/, ""),
      detail: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      url,
      file,
    });
  });
  renderTrackList();
  if (currentIndex === -1 && tracks.length > 0) {
    setActiveTrack(0);
  }
};

const renderTrackList = () => {
  trackList.innerHTML = "";
  tracks.forEach((track, index) => {
    const item = document.createElement("li");
    item.className = "track";
    item.setAttribute("draggable", "true");
    item.dataset.index = index;
    item.innerHTML = `
      <div class="track__info">
        <span class="track__order">#${index + 1}</span>
        <div class="track__meta">
          <span class="track__name">${track.name}</span>
          <span class="track__duration">${track.detail}</span>
        </div>
      </div>
      <div class="track__actions">
        <button class="track__move" data-action="move-up" data-index="${index}" aria-label="上移">↑</button>
        <button class="track__move" data-action="move-down" data-index="${index}" aria-label="下移">↓</button>
        <button data-action="play" data-index="${index}">播放</button>
        <button data-action="remove" data-index="${index}">移除</button>
      </div>
    `;
    trackList.appendChild(item);
  });
  highlightTrack();
};

const removeTrack = (index) => {
  const [removed] = tracks.splice(index, 1);
  if (removed?.url) {
    URL.revokeObjectURL(removed.url);
  }
  if (index === currentIndex) {
    if (tracks.length === 0) {
      currentIndex = -1;
      audio.pause();
      audio.removeAttribute("src");
      trackTitle.textContent = "未选择曲目";
      trackSubtitle.textContent = "请导入音频文件开始播放";
    } else {
      const nextIndex = Math.min(index, tracks.length - 1);
      setActiveTrack(nextIndex);
      playTrack();
    }
  } else if (index < currentIndex) {
    currentIndex -= 1;
  }
  renderTrackList();
};

const moveTrack = (fromIndex, toIndex) => {
  if (fromIndex === toIndex) {
    return;
  }
  const [moved] = tracks.splice(fromIndex, 1);
  tracks.splice(toIndex, 0, moved);
  if (currentIndex === fromIndex) {
    currentIndex = toIndex;
  } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
    currentIndex -= 1;
  } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
    currentIndex += 1;
  }
  renderTrackList();
};

const getNextIndex = () => {
  if (tracks.length === 0) {
    return -1;
  }
  const mode = getPlayMode();
  if (mode === "shuffle") {
    if (tracks.length === 1) {
      return 0;
    }
    let nextIndex = currentIndex;
    while (nextIndex === currentIndex) {
      nextIndex = Math.floor(Math.random() * tracks.length);
    }
    return nextIndex;
  }
  if (currentIndex < tracks.length - 1) {
    return currentIndex + 1;
  }
  return mode === "list-loop" ? 0 : -1;
};

const getPrevIndex = () => {
  if (tracks.length === 0) {
    return -1;
  }
  if (currentIndex > 0) {
    return currentIndex - 1;
  }
  return getPlayMode() === "list-loop" ? tracks.length - 1 : -1;
};

const fadeVolume = (target, duration = 3000, onComplete) => {
  if (fadeRequest) {
    cancelAnimationFrame(fadeRequest);
  }
  const startVolume = audio.volume;
  const startTime = performance.now();
  const tick = (now) => {
    const progressValue = Math.min((now - startTime) / duration, 1);
    audio.volume = startVolume + (target - startVolume) * progressValue;
    if (progressValue < 1) {
      fadeRequest = requestAnimationFrame(tick);
    } else if (onComplete) {
      onComplete();
    }
  };
  fadeRequest = requestAnimationFrame(tick);
};

const renderCueList = () => {
  cueList.innerHTML = "";
  if (cuePoints.length === 0) {
    const empty = document.createElement("li");
    empty.className = "cue-item";
    empty.textContent = "暂无 Cue 点，点击“记录 Cue”添加。";
    cueList.appendChild(empty);
    return;
  }
  cuePoints.forEach((cue, index) => {
    const item = document.createElement("li");
    item.className = "cue-item";
    item.innerHTML = `
      <span>${cue.label} · ${formatTime(cue.time)}</span>
      <button data-index="${index}">跳转</button>
    `;
    cueList.appendChild(item);
  });
};

const addCuePoint = () => {
  if (!audio.src) {
    return;
  }
  const cue = {
    time: audio.currentTime,
    label: `Cue ${cuePoints.length + 1}`,
  };
  cuePoints.push(cue);
  renderCueList();
};

playBtn.addEventListener("click", () => {
  if (audio.paused) {
    playTrack();
  } else {
    pauseTrack();
  }
});

prevBtn.addEventListener("click", () => {
  const prevIndex = getPrevIndex();
  if (prevIndex !== -1) {
    setActiveTrack(prevIndex);
    playTrack();
  }
});

nextBtn.addEventListener("click", () => {
  const nextIndex = getNextIndex();
  if (nextIndex !== -1) {
    setActiveTrack(nextIndex);
    playTrack();
  }
});

muteBtn.addEventListener("click", () => {
  audio.muted = !audio.muted;
  updateMuteButton();
});

playModeSelect.addEventListener("change", updateLoopState);

autoNextToggle.addEventListener("change", () => {
  if (autoNextToggle.checked && audio.ended) {
    const nextIndex = getNextIndex();
    if (nextIndex !== -1) {
      setActiveTrack(nextIndex);
      playTrack();
    }
  }
});

progress.addEventListener("input", (event) => {
  if (audio.duration) {
    const nextTime = (event.target.value / 100) * audio.duration;
    audio.currentTime = nextTime;
  }
});

volume.addEventListener("input", (event) => {
  audio.volume = Number(event.target.value);
});

speed.addEventListener("change", (event) => {
  audio.playbackRate = Number(event.target.value);
});

fadeInBtn.addEventListener("click", () => {
  if (audio.paused) {
    playTrack();
  }
  fadeVolume(1, 3000);
  setSystemStatus("FADE IN", true);
});

fadeOutBtn.addEventListener("click", () => {
  fadeVolume(0, 3000, () => {
    audio.pause();
    setSystemStatus("READY");
  });
  setSystemStatus("FADE OUT", true);
});

addCueBtn.addEventListener("click", addCuePoint);

clearCueBtn.addEventListener("click", () => {
  cuePoints = [];
  renderCueList();
});

cueList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }
  const index = Number(button.dataset.index);
  const cue = cuePoints[index];
  if (cue) {
    audio.currentTime = cue.time;
  }
});

audio.addEventListener("timeupdate", updateTime);

audio.addEventListener("ended", () => {
  stopWaveform();
  if (!autoNextToggle.checked || getPlayMode() === "single-loop") {
    return;
  }
  const nextIndex = getNextIndex();
  if (nextIndex !== -1) {
    setActiveTrack(nextIndex);
    playTrack();
  }
});

audio.addEventListener("loadedmetadata", () => {
  updateTime();
});

audio.addEventListener("pause", () => {
  stopWaveform();
  updatePlayButton();
  setSystemStatus("PAUSED");
});

audio.addEventListener("play", () => {
  updatePlayButton();
  setSystemStatus("PLAYING", true);
});

audio.addEventListener("volumechange", updateMuteButton);

audio.addEventListener("error", () => {
  trackSubtitle.textContent = "无法播放当前音频，请尝试其他文件。";
  setSystemStatus("ERROR");
});

trackList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }
  const index = Number(button.dataset.index);
  const action = button.dataset.action;
  if (action === "play") {
    setActiveTrack(index);
    playTrack();
  }
  if (action === "move-up" && index > 0) {
    moveTrack(index, index - 1);
  }
  if (action === "move-down" && index < tracks.length - 1) {
    moveTrack(index, index + 1);
  }
  if (action === "remove") {
    removeTrack(index);
  }
});

trackList.addEventListener("dragstart", (event) => {
  const item = event.target.closest(".track");
  if (!item) {
    return;
  }
  draggedIndex = Number(item.dataset.index);
  event.dataTransfer.effectAllowed = "move";
  item.classList.add("dragging");
});

trackList.addEventListener("dragover", (event) => {
  event.preventDefault();
  const item = event.target.closest(".track");
  if (!item) {
    return;
  }
  item.classList.add("dragover");
});

trackList.addEventListener("dragleave", (event) => {
  const item = event.target.closest(".track");
  if (!item) {
    return;
  }
  item.classList.remove("dragover");
});

trackList.addEventListener("drop", (event) => {
  event.preventDefault();
  const item = event.target.closest(".track");
  if (!item) {
    return;
  }
  const dropIndex = Number(item.dataset.index);
  item.classList.remove("dragover");
  if (Number.isInteger(draggedIndex)) {
    moveTrack(draggedIndex, dropIndex);
  }
  draggedIndex = null;
});

trackList.addEventListener("dragend", () => {
  document.querySelectorAll(".track").forEach((track) => {
    track.classList.remove("dragging", "dragover");
  });
  draggedIndex = null;
});

fileInput.addEventListener("change", (event) => {
  if (event.target.files?.length) {
    addTracks(event.target.files);
  }
  event.target.value = "";
});

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragover");
  if (event.dataTransfer.files?.length) {
    addTracks(event.dataTransfer.files);
  }
});

volume.value = audio.volume;
updatePlayButton();
updateMuteButton();
updateTime();
updateLoopState();
renderCueList();
