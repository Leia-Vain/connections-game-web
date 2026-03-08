/* global CONNECTIONS_PUZZLE */

const solvedClasses = ["bg1", "bg2", "bg3", "bg4"];
const PUZZLE_STORAGE_KEY = "connections_custom_puzzle_v1";

const elements = {
  title: document.getElementById("title"),
  subtitle: document.getElementById("subtitle"),
  message: document.getElementById("message"),
  board: document.getElementById("board"),
  solved: document.getElementById("solved-groups"),
  mistakesLeft: document.getElementById("mistakes-left"),
  foundCount: document.getElementById("found-count"),
  selectedCount: document.getElementById("selected-count"),
  submitBtn: document.getElementById("submit-btn"),
  deselectBtn: document.getElementById("deselect-btn"),
  shuffleBtn: document.getElementById("shuffle-btn"),
  restartBtn: document.getElementById("restart-btn"),
};

const state = {
  puzzle: null,
  words: [],
  selected: new Set(),
  solvedGroups: [],
  mistakes: 0,
  over: false,
  maxMistakes: 4,
  loadError: "",
};

function shuffle(array) {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function normalize(word) {
  return String(word).trim().toLowerCase();
}

function decodeBase64Url(text) {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const fill = padded.length % 4 === 0 ? 0 : 4 - (padded.length % 4);
  const normalized = padded + "=".repeat(fill);
  return decodeURIComponent(escape(atob(normalized)));
}

function decodeShortField(value) {
  return decodeURIComponent(String(value || "").replace(/\+/g, "%20"));
}

function parseShortPuzzle(payload) {
  const parts = payload.split("~");
  if (!parts.length || parts[0] !== "v1") {
    return null;
  }
  if (parts.length !== 24) {
    return null;
  }
  const maxMistakes = Number(parts[1]);
  const title = decodeShortField(parts[2]);
  const subtitle = decodeShortField(parts[3]);
  if (!Number.isInteger(maxMistakes) || maxMistakes <= 0) {
    return null;
  }
  let index = 4;
  const groups = [];
  for (let g = 0; g < 4; g += 1) {
    const label = decodeShortField(parts[index]);
    const words = [
      decodeShortField(parts[index + 1]),
      decodeShortField(parts[index + 2]),
      decodeShortField(parts[index + 3]),
      decodeShortField(parts[index + 4]),
    ];
    index += 5;
    groups.push({ label, words });
  }
  return { title, subtitle, maxMistakes, groups };
}

function parseHashPuzzle() {
  const hash = window.location.hash || "";
  if (hash.startsWith("#s=")) {
    const shortPayload = hash.slice(3).trim();
    if (!shortPayload) {
      return null;
    }
    return parseShortPuzzle(shortPayload);
  }
  if (hash.startsWith("#p=")) {
    const encoded = hash.slice(3).trim();
    if (!encoded) {
      return null;
    }
    try {
      return JSON.parse(decodeBase64Url(encoded));
    } catch (error) {
      return null;
    }
  }
  return null;
}

function parsePuzzleIdFromQuery() {
  const params = new URLSearchParams(window.location.search || "");
  const raw = (params.get("id") || "").trim();
  if (!raw) {
    return "";
  }
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/i.test(raw)) {
    return "";
  }
  return raw.toLowerCase();
}

async function fetchPuzzleById(id) {
  try {
    const url = `puzzles/${encodeURIComponent(id)}.json`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    return null;
  }
}

function parseStoredPuzzle() {
  try {
    const raw = localStorage.getItem(PUZZLE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function validatePuzzle(puzzle) {
  if (!puzzle || !Array.isArray(puzzle.groups) || puzzle.groups.length !== 4) {
    throw new Error("Puzzle must have exactly 4 groups.");
  }
  const allWords = [];
  puzzle.groups.forEach((group, index) => {
    if (!group.label || !Array.isArray(group.words) || group.words.length !== 4) {
      throw new Error(`Group ${index + 1} must include label and 4 words.`);
    }
    group.words.forEach((word) => allWords.push(normalize(word)));
  });
  const unique = new Set(allWords);
  if (unique.size !== 16) {
    throw new Error("Puzzle must have exactly 16 unique words.");
  }
}

function setMessage(text, isError = false) {
  elements.message.textContent = text;
  elements.message.classList.toggle("error", isError);
}

function updateHud() {
  elements.mistakesLeft.textContent = String(state.maxMistakes - state.mistakes);
  elements.foundCount.textContent = `${state.solvedGroups.length} / 4`;
  elements.selectedCount.textContent = `${state.selected.size} / 4`;
}

function renderSolvedGroups() {
  elements.solved.innerHTML = "";
  state.solvedGroups.forEach((group, i) => {
    const card = document.createElement("article");
    card.className = `solved-card ${solvedClasses[i % solvedClasses.length]}`;
    const words = group.words.join(", ");
    card.innerHTML = `<h3>${group.label}</h3><p>${words}</p>`;
    elements.solved.appendChild(card);
  });
}

function isWordSolved(word) {
  return state.solvedGroups.some((group) =>
    group.words.some((groupWord) => normalize(groupWord) === normalize(word))
  );
}

function renderBoard() {
  elements.board.innerHTML = "";
  state.words.forEach((word) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tile";
    button.textContent = word;
    if (state.selected.has(word)) {
      button.classList.add("selected");
    }
    if (isWordSolved(word)) {
      button.classList.add("hidden");
      button.disabled = true;
    }
    button.addEventListener("click", () => toggleSelect(word));
    elements.board.appendChild(button);
  });
}

function toggleSelect(word) {
  if (state.over || isWordSolved(word)) {
    return;
  }
  if (state.selected.has(word)) {
    state.selected.delete(word);
  } else {
    if (state.selected.size >= 4) {
      setMessage("You can only select 4 words at a time.", true);
      return;
    }
    state.selected.add(word);
  }
  setMessage("Select four connected words.");
  updateHud();
  renderBoard();
}

function deselectAll() {
  state.selected.clear();
  updateHud();
  renderBoard();
}

function getMatchingGroup(selectedWords) {
  const selectedNormalized = selectedWords.map(normalize).sort();
  return state.puzzle.groups.find((group) => {
    if (state.solvedGroups.includes(group)) {
      return false;
    }
    const groupNormalized = group.words.map(normalize).sort();
    return groupNormalized.every((word, i) => word === selectedNormalized[i]);
  });
}

function oneAwayHint(selectedWords) {
  const selectedSet = new Set(selectedWords.map(normalize));
  return state.puzzle.groups.some((group) => {
    if (state.solvedGroups.includes(group)) {
      return false;
    }
    const overlap = group.words
      .map(normalize)
      .filter((word) => selectedSet.has(word)).length;
    return overlap === 3;
  });
}

function revealAll() {
  state.puzzle.groups.forEach((group) => {
    if (!state.solvedGroups.includes(group)) {
      state.solvedGroups.push(group);
    }
  });
  state.over = true;
  renderSolvedGroups();
  renderBoard();
}

function submitSelection() {
  if (state.over) {
    return;
  }
  const selectedWords = Array.from(state.selected);
  if (selectedWords.length !== 4) {
    setMessage("Select exactly 4 words before submitting.", true);
    return;
  }
  const match = getMatchingGroup(selectedWords);
  if (match) {
    state.solvedGroups.push(match);
    state.selected.clear();
    renderSolvedGroups();
    renderBoard();
    updateHud();
    if (state.solvedGroups.length === 4) {
      state.over = true;
      setMessage("You solved all 4 groups.");
      return;
    }
    setMessage("Correct group found.");
    return;
  }

  state.mistakes += 1;
  const left = state.maxMistakes - state.mistakes;
  if (left <= 0) {
    updateHud();
    revealAll();
    setMessage("No mistakes left. Puzzle over.", true);
    return;
  }
  updateHud();
  const hint = oneAwayHint(selectedWords) ? " One away." : "";
  setMessage(`Not a group.${hint} Mistakes left: ${left}.`, true);
}

function restartGame() {
  state.words = shuffle(state.puzzle.groups.flatMap((group) => group.words));
  state.selected.clear();
  state.solvedGroups = [];
  state.mistakes = 0;
  state.over = false;
  updateHud();
  renderSolvedGroups();
  renderBoard();
  setMessage("Select four connected words.");
}

function wireActions() {
  elements.submitBtn.addEventListener("click", submitSelection);
  elements.deselectBtn.addEventListener("click", deselectAll);
  elements.shuffleBtn.addEventListener("click", () => {
    if (state.over) {
      return;
    }
    const unsolved = state.words.filter((word) => !isWordSolved(word));
    const solved = state.words.filter((word) => isWordSolved(word));
    state.words = shuffle(unsolved).concat(solved);
    renderBoard();
    setMessage("Shuffled unsolved words.");
  });
  elements.restartBtn.addEventListener("click", restartGame);
}

function init() {
  initialize();
}

async function initialize() {
  const fromHash = parseHashPuzzle();
  const fromStorage = parseStoredPuzzle();
  const puzzleId = parsePuzzleIdFromQuery();
  const fromId = fromHash ? null : (puzzleId ? await fetchPuzzleById(puzzleId) : null);

  if (puzzleId && !fromId && !fromHash) {
    state.loadError = `Could not load puzzle id "${puzzleId}". Showing fallback puzzle.`;
  }

  state.puzzle = fromHash || fromId || fromStorage || CONNECTIONS_PUZZLE;

  try {
    validatePuzzle(state.puzzle);
    elements.title.textContent = state.puzzle.title || "Connections";
    elements.subtitle.textContent =
      state.puzzle.subtitle || "Pick four words that share a connection.";
    state.maxMistakes =
      Number.isInteger(state.puzzle.maxMistakes) && state.puzzle.maxMistakes > 0
        ? state.puzzle.maxMistakes
        : 4;
    wireActions();
    restartGame();
    if (state.loadError) {
      setMessage(state.loadError, true);
    }
  } catch (error) {
    setMessage(error.message || "Invalid puzzle configuration.", true);
    elements.submitBtn.disabled = true;
    elements.deselectBtn.disabled = true;
    elements.shuffleBtn.disabled = true;
    elements.restartBtn.disabled = true;
  }
}

init();
