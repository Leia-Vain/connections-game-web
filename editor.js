/* global CONNECTIONS_PUZZLE */

const PUZZLE_STORAGE_KEY = "connections_custom_puzzle_v1";
const GROUP_COUNT = 4;
const WORDS_PER_GROUP = 4;

const els = {
  title: document.getElementById("title"),
  subtitle: document.getElementById("subtitle"),
  mistakes: document.getElementById("mistakes"),
  groups: document.getElementById("groups"),
  saveLocal: document.getElementById("save-local"),
  openGame: document.getElementById("open-game"),
  shareBtn: document.getElementById("share-link-btn"),
  clearLocal: document.getElementById("clear-local"),
  shareLink: document.getElementById("share-link"),
  copyLink: document.getElementById("copy-link"),
  status: document.getElementById("status"),
};

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

function clonePuzzle(puzzle) {
  return JSON.parse(JSON.stringify(puzzle));
}

function normalize(word) {
  return String(word).trim().toLowerCase();
}

function validatePuzzle(puzzle) {
  if (!puzzle || !Array.isArray(puzzle.groups) || puzzle.groups.length !== GROUP_COUNT) {
    throw new Error("Puzzle must have 4 groups.");
  }
  const words = [];
  puzzle.groups.forEach((group, i) => {
    if (!group.label || !Array.isArray(group.words) || group.words.length !== WORDS_PER_GROUP) {
      throw new Error(`Group ${i + 1} needs a label and 4 words.`);
    }
    group.words.forEach((word) => {
      if (!String(word).trim()) {
        throw new Error(`Group ${i + 1} has an empty word.`);
      }
      words.push(normalize(word));
    });
  });
  if (new Set(words).size !== GROUP_COUNT * WORDS_PER_GROUP) {
    throw new Error("All 16 words must be unique.");
  }
}

function encodeShortField(value) {
  return encodeURIComponent(String(value || "").trim()).replace(/%20/g, "+");
}

function serializeShortPuzzle(puzzle) {
  const parts = [
    "v1",
    String(puzzle.maxMistakes),
    encodeShortField(puzzle.title),
    encodeShortField(puzzle.subtitle),
  ];
  puzzle.groups.forEach((group) => {
    parts.push(encodeShortField(group.label));
    group.words.forEach((word) => parts.push(encodeShortField(word)));
  });
  return parts.join("~");
}

function gamePageUrl() {
  return new URL("index.html", window.location.href).href;
}

function renderForm(puzzle) {
  els.title.value = puzzle.title || "Connections";
  els.subtitle.value = puzzle.subtitle || "Pick four words that share a connection.";
  els.mistakes.value = String(Number.isInteger(puzzle.maxMistakes) ? puzzle.maxMistakes : 4);
  els.groups.innerHTML = "";

  puzzle.groups.forEach((group, groupIndex) => {
    const card = document.createElement("article");
    card.className = "group-card";
    const title = document.createElement("h2");
    title.textContent = `Group ${groupIndex + 1}`;
    card.appendChild(title);

    const label = document.createElement("label");
    label.textContent = "Category Label";
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.value = group.label || "";
    labelInput.dataset.groupIndex = String(groupIndex);
    labelInput.dataset.kind = "label";
    label.appendChild(labelInput);
    card.appendChild(label);

    const wordsWrap = document.createElement("div");
    wordsWrap.className = "words";
    for (let i = 0; i < WORDS_PER_GROUP; i += 1) {
      const wordInput = document.createElement("input");
      wordInput.type = "text";
      wordInput.placeholder = `Word ${i + 1}`;
      wordInput.value = group.words[i] || "";
      wordInput.dataset.groupIndex = String(groupIndex);
      wordInput.dataset.wordIndex = String(i);
      wordInput.dataset.kind = "word";
      wordsWrap.appendChild(wordInput);
    }
    card.appendChild(wordsWrap);
    els.groups.appendChild(card);
  });
}

function readForm() {
  const groups = [];
  for (let g = 0; g < GROUP_COUNT; g += 1) {
    const labelInput = els.groups.querySelector(`input[data-kind="label"][data-group-index="${g}"]`);
    const words = [];
    for (let w = 0; w < WORDS_PER_GROUP; w += 1) {
      const wordInput = els.groups.querySelector(
        `input[data-kind="word"][data-group-index="${g}"][data-word-index="${w}"]`
      );
      words.push(wordInput ? wordInput.value.trim() : "");
    }
    groups.push({
      label: labelInput ? labelInput.value.trim() : "",
      words,
    });
  }
  return {
    title: els.title.value.trim() || "Connections",
    subtitle: els.subtitle.value.trim() || "Pick four words that share a connection.",
    maxMistakes: Number(els.mistakes.value) || 4,
    groups,
  };
}

function saveLocalPuzzle(puzzle) {
  localStorage.setItem(PUZZLE_STORAGE_KEY, JSON.stringify(puzzle));
}

function generateShareLink(puzzle) {
  const shortPayload = serializeShortPuzzle(puzzle);
  return `${gamePageUrl()}#s=${shortPayload}`;
}

function loadInitialPuzzle() {
  try {
    const raw = localStorage.getItem(PUZZLE_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (error) {
    // Ignore and fall back.
  }
  return clonePuzzle(CONNECTIONS_PUZZLE);
}

function handleSaveLocal() {
  try {
    const puzzle = readForm();
    validatePuzzle(puzzle);
    saveLocalPuzzle(puzzle);
    setStatus("Saved locally. Opening index.html will use your private puzzle.");
  } catch (error) {
    setStatus(error.message || "Failed to save puzzle.", true);
  }
}

function handleOpenGame() {
  try {
    const puzzle = readForm();
    validatePuzzle(puzzle);
    saveLocalPuzzle(puzzle);
    window.open(gamePageUrl(), "_blank");
    setStatus("Opened game with your local puzzle.");
  } catch (error) {
    setStatus(error.message || "Could not open game.", true);
  }
}

function handleGenerateShareLink() {
  try {
    const puzzle = readForm();
    validatePuzzle(puzzle);
    const url = generateShareLink(puzzle);
    els.shareLink.value = url;
    setStatus("Short share link generated. This link opens play mode only.");
  } catch (error) {
    setStatus(error.message || "Could not generate share link.", true);
  }
}

function handleCopyLink() {
  const value = els.shareLink.value.trim();
  if (!value) {
    setStatus("Generate a share link first.", true);
    return;
  }
  navigator.clipboard.writeText(value)
    .then(() => setStatus("Share link copied to clipboard."))
    .catch(() => setStatus("Could not copy automatically. Copy the link manually.", true));
}

function handleClearLocal() {
  localStorage.removeItem(PUZZLE_STORAGE_KEY);
  renderForm(clonePuzzle(CONNECTIONS_PUZZLE));
  els.shareLink.value = "";
  setStatus("Local puzzle cleared. Default sample restored.");
}

function init() {
  const puzzle = loadInitialPuzzle();
  renderForm(puzzle);
  setStatus("Editor ready. Fill 4 groups x 4 words.");

  els.saveLocal.addEventListener("click", handleSaveLocal);
  els.openGame.addEventListener("click", handleOpenGame);
  els.shareBtn.addEventListener("click", handleGenerateShareLink);
  els.copyLink.addEventListener("click", handleCopyLink);
  els.clearLocal.addEventListener("click", handleClearLocal);
}

init();
