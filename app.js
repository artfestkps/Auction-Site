/**
 * Main Controller for College Arts Fest Live Auction Dashboard
 * Implements the snake draft sequence, state management, Google Sheets API,
 * local storage sync, and custom canvas confetti.
 */

// Category and Class definitions
const CATEGORIES = [
  { id: "super_senior", name: "Super Senior", startHouseIdx: 0, classes: ["D3", "D2", "D1"] },
  { id: "senior", name: "Senior", startHouseIdx: 1, classes: ["SS2", "SS1", "S5"] },
  { id: "junior", name: "Junior", startHouseIdx: 2, classes: ["S4", "S3"] },
  { id: "sub_junior", name: "Sub Junior", startHouseIdx: 3, classes: ["S2", "S1"] }
];

// Beautiful Islamic student avatar SVG
const ISLAMIC_AVATAR_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; display: block;">
  <defs>
    <radialGradient id="avatarBg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </radialGradient>
  </defs>
  <circle cx="50" cy="50" r="50" fill="url(#avatarBg)" />
  <circle cx="50" cy="51" r="17" fill="#ffd1a9" />
  <path d="M28 85 C28 71 38 66 50 66 C62 66 72 71 72 85 Z" fill="#ffffff" />
  <path d="M50 66 V73" stroke="#e2e8f0" stroke-width="1.5" stroke-linecap="round" />
  <circle cx="50" cy="75" r="1" fill="#cbd5e1" />
  <path d="M33 39 C33 24 67 24 67 39 Z" fill="#ffffff" />
  <path d="M32 37 C32 37 32 40 32 40 C32 42 35 43 50 43 C65 43 68 42 68 40 C68 40 68 37 68 37 Z" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.5" />
  <circle cx="32" cy="51" r="4" fill="#ffd1a9" />
  <circle cx="68" cy="51" r="4" fill="#ffd1a9" />
  <circle cx="43" cy="49" r="2" fill="#1e293b" />
  <circle cx="57" cy="49" r="2" fill="#1e293b" />
  <path d="M45 56 Q50 59 55 56" stroke="#1e293b" stroke-width="1.5" stroke-linecap="round" fill="none" />
</svg>
`;

// Default Houses configuration
const DEFAULT_HOUSES = [
  { name: "House 1", color: "#ef4444" }, // Crimson Red
  { name: "House 2", color: "#3b82f6" }, // Cobalt Blue
  { name: "House 3", color: "#10b981" }, // Emerald Green
  { name: "House 4", color: "#f59e0b" }  // Amber Yellow/Orange
];

// App State
let state = {
  students: [],          // Raw student database
  picks: [],             // Pick log: { admissionNo, studentName, class, category, house, pickIndex, timestamp }
  activeCategoryIdx: 0,  // Index in CATEGORIES
  activeClass: "D3",     // Name of active class
  apiURL: "https://script.google.com/macros/s/AKfycbyCpEuuJN9GLbT1dbRlsK1Avouauv6h3SYUNOt8ko-O-k25txJ-6M8TC2PeORiJ1OfAYw/exec", // Google Apps Script Web App URL
  houses: JSON.parse(JSON.stringify(DEFAULT_HOUSES)),
  selectedStudent: null, // Temporary storage for modal confirm
  isOfflineMode: true,
  isLoading: false
};

// Local storage keys
const STORAGE_KEY = "college_auction_dashboard_state_v1";

// DOM Elements
const DOM = {
  studentGrid: document.getElementById("student-grid"),
  classTitle: document.getElementById("active-class-title"),
  categoryBadge: document.getElementById("active-category-badge"),
  categoryList: document.getElementById("category-list"),
  classGrid: document.getElementById("class-grid"),
  currentHouseBanner: document.getElementById("current-house-banner"),
  currentHouseName: document.getElementById("current-house-name"),
  currentHouseColor: document.getElementById("current-house-color-pill"),
  upcomingQueue: document.getElementById("upcoming-queue"),
  housesContainer: document.getElementById("houses-container"),
  
  // Modals
  studentModal: document.getElementById("student-modal"),
  settingsModal: document.getElementById("settings-modal"),
  
  // Student Preview in Modal
  previewPhoto: document.getElementById("preview-photo"),
  previewPhotoFallback: document.getElementById("preview-photo-fallback"),
  previewName: document.getElementById("preview-name"),
  previewAdm: document.getElementById("preview-adm"),
  previewClass: document.getElementById("preview-class"),
  previewCategory: document.getElementById("preview-category"),
  modalHouseTarget: document.getElementById("modal-house-target"),
  modalHouseName: document.getElementById("modal-house-name"),
  
  // Settings Form Inputs
  settingsApiUrl: document.getElementById("settings-api-url"),
  settingsImportCsv: document.getElementById("settings-import-csv"),
  
  // Header Buttons
  btnUndo: document.getElementById("btn-undo"),
  btnSettingsResetPicks: document.getElementById("btn-settings-reset-picks"),
  btnFinishClass: document.getElementById("btn-finish-class"),
  btnSettings: document.getElementById("btn-settings"),
  btnSync: document.getElementById("btn-sync"),
  
  // Status indicator
  statusIndicator: document.getElementById("status-indicator"),
  statusDot: document.getElementById("status-dot"),
  statusText: document.getElementById("status-text"),
  
  // Toasts
  toast: document.getElementById("toast"),
  toastText: document.getElementById("toast-text"),
  toastIcon: document.getElementById("toast-icon"),
  
  // Confetti
  confettiCanvas: document.getElementById("confetti-canvas")
};

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  loadStateFromLocalStorage();
  setupEventListeners();
  renderCategoryList();
  renderClassGrid();
  
  if (state.apiURL) {
    syncWithGoogleSheets();
  } else {
    updateStatusIndicator();
    renderAll();
  }
});

// Setup Event Listeners
function setupEventListeners() {
  // Modal Confirm & Cancel
  document.getElementById("btn-modal-confirm").addEventListener("click", confirmStudentSelection);
  document.getElementById("btn-modal-cancel").addEventListener("click", () => closeModal(DOM.studentModal));
  
  // Settings Modal Buttons
  document.getElementById("btn-settings-save").addEventListener("click", saveSettings);
  document.getElementById("btn-settings-close").addEventListener("click", () => closeModal(DOM.settingsModal));
  document.getElementById("btn-settings-reset").addEventListener("click", resetAllData);
  document.getElementById("btn-settings-reset-picks").addEventListener("click", resetOnlyPicks);
  document.getElementById("btn-settings-export-picks").addEventListener("click", exportPicksCsv);
  DOM.btnSettings.addEventListener("click", openSettingsModal);
  
  // Main Header Actions
  DOM.btnUndo.addEventListener("click", undoLastPick);
  DOM.btnFinishClass.addEventListener("click", finishCurrentClass);
  DOM.btnSync.addEventListener("click", syncWithGoogleSheets);
  
  // CSV Import File Change
  DOM.settingsImportCsv.addEventListener("change", importCsvFile);
  
  // Close Modals on overlay click
  DOM.studentModal.addEventListener("click", (e) => {
    if (e.target === DOM.studentModal) closeModal(DOM.studentModal);
  });
  DOM.settingsModal.addEventListener("click", (e) => {
    if (e.target === DOM.settingsModal) closeModal(DOM.settingsModal);
  });
}

/* ==========================================
   DRAFT LOGIC ENGINE (SNAKE DRAFT FORMULA)
   ========================================== */

/**
 * Calculates whose turn it is in the active category based on the number of picks already made.
 * @param {number} categoryIdx - The index of the active category
 * @param {number} pickIndexInCat - The index of the pick within the category (0-based)
 * @returns {number} The 0-based house index (0 to 3)
 */
function calculateHouseTurn(categoryIdx, pickIndexInCat) {
  const cat = CATEGORIES[categoryIdx];
  const S = cat.startHouseIdx; // Start house: Category 1: 0, Cat 2: 1, Cat 3: 2, Cat 4: 3
  
  const r = pickIndexInCat % 8;
  let offset = 0;
  
  if (r === 0 || r === 7) offset = 0;
  else if (r === 1 || r === 6) offset = 1;
  else if (r === 2 || r === 5) offset = 2;
  else if (r === 3 || r === 4) offset = 3;
  
  return (S + offset) % 4;
}

/**
 * Gets the list of picks recorded for the current category.
 */
function getPicksInActiveCategory() {
  const activeCat = CATEGORIES[state.activeCategoryIdx];
  // Since student category values in sheet could vary slightly in case, we do lowercase comparison
  return state.picks.filter(p => p.category.trim().toLowerCase() === activeCat.name.trim().toLowerCase());
}

/**
 * Updates the turn display banner and the upcoming turn queue.
 */
function updateTurnDisplay() {
  const picksInCat = getPicksInActiveCategory();
  const pickIndex = picksInCat.length;
  
  const activeHouseIdx = calculateHouseTurn(state.activeCategoryIdx, pickIndex);
  const activeHouse = state.houses[activeHouseIdx];
  
  // Update main turn banner
  DOM.currentHouseName.textContent = activeHouse.name;
  DOM.currentHouseColor.style.color = activeHouse.color;
  DOM.currentHouseColor.style.backgroundColor = activeHouse.color;
  
  // Set CSS class for glowing card borders
  DOM.currentHouseBanner.className = "current-house-banner";
  DOM.currentHouseBanner.classList.add(`house-${activeHouseIdx + 1}`);
  DOM.currentHouseBanner.style.color = activeHouse.color;
  
  // Generate upcoming draft order (Next 4 turns)
  DOM.upcomingQueue.innerHTML = "";
  for (let i = 1; i <= 4; i++) {
    const nextHouseIdx = calculateHouseTurn(state.activeCategoryIdx, pickIndex + i);
    const nextHouse = state.houses[nextHouseIdx];
    
    const div = document.createElement("div");
    div.className = "queue-item";
    div.innerHTML = `
      <span class="house-color-pill" style="color: ${nextHouse.color}; background-color: ${nextHouse.color};"></span>
      <span>Turn ${pickIndex + i + 1}: <strong>${nextHouse.name}</strong></span>
    `;
    DOM.upcomingQueue.appendChild(div);
  }
}

/* ==========================================
   STATE & DATA SYNCHRONIZATION
   ========================================== */

function saveStateToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    students: state.students,
    picks: state.picks,
    activeCategoryIdx: state.activeCategoryIdx,
    activeClass: state.activeClass,
    apiURL: state.apiURL,
    houses: state.houses
  }));
}

function loadStateFromLocalStorage() {
  const local = localStorage.getItem(STORAGE_KEY);
  if (local) {
    try {
      const data = JSON.parse(local);
      state.students = data.students || [];
      state.picks = data.picks || [];
      state.activeCategoryIdx = data.activeCategoryIdx !== undefined ? data.activeCategoryIdx : 0;
      state.activeClass = data.activeClass || "D3";
      state.apiURL = data.apiURL || "https://script.google.com/macros/s/AKfycbyCpEuuJN9GLbT1dbRlsK1Avouauv6h3SYUNOt8ko-O-k25txJ-6M8TC2PeORiJ1OfAYw/exec";
      state.houses = data.houses || JSON.parse(JSON.stringify(DEFAULT_HOUSES));
      
      // Update form values
      DOM.settingsApiUrl.value = state.apiURL;
      updateHouseInputsInSettings();
    } catch (e) {
      console.error("Error loading localStorage state:", e);
    }
  }
}

function updateStatusIndicator() {
  if (state.isLoading) {
    DOM.statusDot.className = "status-dot";
    DOM.statusText.textContent = "Connecting...";
    return;
  }
  
  if (state.apiURL) {
    if (state.isOfflineMode) {
      DOM.statusDot.className = "status-dot local";
      DOM.statusText.textContent = "Sync Offline (Local Mode)";
    } else {
      DOM.statusDot.className = "status-dot connected";
      DOM.statusText.textContent = "Connected to Google Sheets";
    }
  } else {
    DOM.statusDot.className = "status-dot local";
    DOM.statusText.textContent = "Local Mode (No Sheets Link)";
  }
}

/**
 * Pulls all students and picks from Google Sheet API.
 */
async function syncWithGoogleSheets() {
  if (!state.apiURL) {
    showToast("Google Sheets App Script URL is not set.", "error");
    return;
  }
  
  state.isLoading = true;
  updateStatusIndicator();
  
  try {
    const response = await fetch(state.apiURL, {
      method: "GET",
      mode: "cors"
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Sync students
      state.students = result.students || [];
      
      // Sync picks
      state.picks = result.picks || [];
      
      state.isOfflineMode = false;
      showToast("Synced successfully with Google Sheets!", "success");
    } else {
      state.isOfflineMode = true;
      showToast(result.error || "Failed to sync. Running in local mode.", "error");
    }
  } catch (error) {
    console.error("Sync error:", error);
    state.isOfflineMode = true;
    showToast("Connection failed. Running in offline/local mode.", "error");
  } finally {
    state.isLoading = false;
    updateStatusIndicator();
    saveStateToLocalStorage();
    renderAll();
  }
}

/**
 * Pushes a new selection to Google Sheets.
 */
async function postPickToSheets(pick) {
  if (!state.apiURL || state.isOfflineMode) return;
  
  try {
    await fetch(state.apiURL, {
      method: "POST",
      mode: "no-cors", // Use no-cors to prevent preflight OPTIONS issues on basic Apps Script endpoints if they aren't fully configured
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "addPick",
        ...pick
      })
    });
  } catch (err) {
    console.error("Failed to post pick to sheets:", err);
    showToast("Failed to write to Google Sheets. Pick saved locally.", "error");
    state.isOfflineMode = true;
    updateStatusIndicator();
  }
}

/**
 * Triggers undo in Google Sheets.
 */
async function postUndoToSheets() {
  if (!state.apiURL || state.isOfflineMode) return;
  
  try {
    await fetch(state.apiURL, {
      method: "POST",
      mode: "no-cors", // Bypass preflight precheck blocks
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "undoPick"
      })
    });
  } catch (err) {
    console.error("Failed to post undo to sheets:", err);
    state.isOfflineMode = true;
    updateStatusIndicator();
  }
}

/**
 * Resets picks in Google Sheets.
 */
async function postResetToSheets() {
  if (!state.apiURL || state.isOfflineMode) return;
  
  try {
    await fetch(state.apiURL, {
      method: "POST",
      mode: "no-cors", // Bypass preflight precheck blocks
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "resetPicks"
      })
    });
  } catch (err) {
    console.error("Failed to post reset to sheets:", err);
  }
}

/* ==========================================
   DASHBOARD RENDERING
   ========================================== */

function renderAll() {
  renderStudentGrid();
  updateTurnDisplay();
  renderHouseScoreboard();
  renderCategoryList();
  renderClassGrid();
}

/**
 * Renders the category selection sidebar items.
 */
function renderCategoryList() {
  DOM.categoryList.innerHTML = "";
  CATEGORIES.forEach((cat, idx) => {
    const item = document.createElement("div");
    item.className = "category-item";
    if (state.activeCategoryIdx === idx) {
      item.classList.add("active");
    }
    
    item.innerHTML = `
      <span class="category-name">${cat.name}</span>
      <span class="category-classes">${cat.classes.join(", ")}</span>
    `;
    
    item.addEventListener("click", () => {
      state.activeCategoryIdx = idx;
      // Automatically load the first class in this category
      state.activeClass = cat.classes[0];
      saveStateToLocalStorage();
      renderAll();
    });
    
    DOM.categoryList.appendChild(item);
  });
}

/**
 * Renders the class pagination buttons.
 */
function renderClassGrid() {
  DOM.classGrid.innerHTML = "";
  const activeCat = CATEGORIES[state.activeCategoryIdx];
  
  activeCat.classes.forEach(cls => {
    const btn = document.createElement("button");
    btn.className = "class-btn";
    if (state.activeClass === cls) {
      btn.classList.add("active");
    }
    btn.textContent = cls;
    
    btn.addEventListener("click", () => {
      state.activeClass = cls;
      saveStateToLocalStorage();
      renderAll();
    });
    
    DOM.classGrid.appendChild(btn);
  });
}

/**
 * Renders the grid of students for the active class.
 */
function renderStudentGrid() {
  DOM.studentGrid.innerHTML = "";
  
  // Filter students by active class
  // Handle casing/spacing differences in sheet
  const classFiltered = state.students.filter(s => s.class.trim().toUpperCase() === state.activeClass.toUpperCase());
  
  if (classFiltered.length === 0) {
    DOM.studentGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👤</div>
        <h3 class="empty-state-title">No Students Found</h3>
        <p class="empty-state-desc">No student data found for class ${state.activeClass}. Please import a CSV or link a Google Sheet.</p>
      </div>
    `;
    DOM.classTitle.textContent = state.activeClass;
    DOM.categoryBadge.textContent = CATEGORIES[state.activeCategoryIdx].name;
    return;
  }
  
  DOM.classTitle.textContent = state.activeClass;
  DOM.categoryBadge.textContent = CATEGORIES[state.activeCategoryIdx].name;
  
  classFiltered.forEach(student => {
    // Check if student has been picked already
    const pick = state.picks.find(p => p.admissionNo.trim() === student.admissionNo.trim());
    
    const card = document.createElement("li");
    card.className = "student-card";
    
    // Resolve image URL
    // Public Google Drive thumbnail URL works beautifully without auth or CORS blocks
    let imgUrl = "";
    if (student.photoFileId) {
      imgUrl = `https://drive.google.com/thumbnail?id=${student.photoFileId.trim()}&sz=w400`;
    }
    
    card.innerHTML = `
      <div class="student-photo-container">
        ${imgUrl ? 
          `<img class="student-photo" src="${imgUrl}" alt="${student.studentName}" onerror="this.style.display='none'; this.nextElementSibling.innerHTML=ISLAMIC_AVATAR_SVG; this.nextElementSibling.style.display='flex';">` : 
          ''
        }
        <div class="student-photo-fallback" style="display: ${imgUrl ? 'none' : 'flex'}">
          ${ISLAMIC_AVATAR_SVG}
        </div>
      </div>
      <div class="student-card-info">
        <div class="student-name">${student.studentName}</div>
        <div class="student-adm">Adm: ${student.admissionNo}</div>
      </div>
    `;
    
    if (pick) {
      // Mark as selected with appropriate house styling
      const houseIndex = state.houses.findIndex(h => h.name === pick.house);
      card.classList.add("selected");
      if (houseIndex !== -1) {
        card.classList.add(`selected-house-${houseIndex + 1}`);
      }
      
      const badge = document.createElement("div");
      badge.className = "selection-badge";
      badge.innerHTML = "✓";
      card.appendChild(badge);
    } else {
      // Add click preview interaction
      card.addEventListener("click", () => openStudentPreview(student));
    }
    
    DOM.studentGrid.appendChild(card);
  });
}

/**
 * Renders the detailed house stats cards and their selected students list.
 */
function renderHouseScoreboard() {
  DOM.housesContainer.innerHTML = "";
  
  state.houses.forEach((house, idx) => {
    // Filter picks for this house
    const housePicks = state.picks.filter(p => p.house === house.name);
    
    const card = document.createElement("div");
    card.className = `house-stats-card house-${idx + 1}`;
    card.style.color = house.color;
    
    // Build picks tag list
    let picksHtml = "";
    if (housePicks.length === 0) {
      picksHtml = `<div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">No picks yet</div>`;
    } else {
      housePicks.forEach(p => {
        picksHtml += `
          <div class="pick-tag" title="${p.studentName} (${p.class})">
            <span class="pick-tag-name">${p.studentName}</span>
            <span class="pick-tag-class">${p.class}</span>
          </div>
        `;
      });
    }
    
    card.innerHTML = `
      <div class="house-stats-header">
        <span class="house-stats-name">${house.name}</span>
        <span class="house-stats-count">${housePicks.length}</span>
      </div>
      <div class="house-picks-mini">
        ${picksHtml}
      </div>
    `;
    
    DOM.housesContainer.appendChild(card);
  });
}

/* ==========================================
   INTERACTIVE USER FLOWS & CONFIRMATIONS
   ========================================== */

/**
 * Opens the selection confirmation modal for a clicked student card.
 */
function openStudentPreview(student) {
  state.selectedStudent = student;
  
  // Get active turn details
  const picksInCat = getPicksInActiveCategory();
  const activeHouseIdx = calculateHouseTurn(state.activeCategoryIdx, picksInCat.length);
  const activeHouse = state.houses[activeHouseIdx];
  
  // Populate image
  let imgUrl = "";
  if (student.photoFileId) {
    imgUrl = `https://drive.google.com/thumbnail?id=${student.photoFileId.trim()}&sz=w600`;
  }
  
  if (imgUrl) {
    DOM.previewPhoto.src = imgUrl;
    DOM.previewPhoto.style.display = "block";
    DOM.previewPhotoFallback.style.display = "none";
    DOM.previewPhoto.onerror = () => {
      DOM.previewPhoto.style.display = "none";
      DOM.previewPhotoFallback.style.display = "flex";
      DOM.previewPhotoFallback.innerHTML = ISLAMIC_AVATAR_SVG;
    };
  } else {
    DOM.previewPhoto.style.display = "none";
    DOM.previewPhotoFallback.style.display = "flex";
    DOM.previewPhotoFallback.innerHTML = ISLAMIC_AVATAR_SVG;
  }
  
  // Details
  DOM.previewName.textContent = student.studentName;
  DOM.previewAdm.textContent = student.admissionNo;
  DOM.previewClass.textContent = student.class;
  DOM.previewCategory.textContent = student.category;
  
  // Highlight target house
  DOM.modalHouseName.textContent = activeHouse.name;
  DOM.modalHouseTarget.style.color = activeHouse.color;
  DOM.modalHouseTarget.style.borderColor = activeHouse.color;
  DOM.modalHouseTarget.style.backgroundColor = `${activeHouse.color}15`;
  
  openModal(DOM.studentModal);
}

/**
 * Confirms selection, records the pick, syncs back, and triggers visual rewards.
 */
async function confirmStudentSelection() {
  if (!state.selectedStudent) return;
  
  const student = state.selectedStudent;
  const picksInCat = getPicksInActiveCategory();
  const pickIndex = picksInCat.length; // Index within category
  
  const activeHouseIdx = calculateHouseTurn(state.activeCategoryIdx, pickIndex);
  const activeHouse = state.houses[activeHouseIdx];
  
  // Construct pick payload
  const newPick = {
    admissionNo: student.admissionNo.trim(),
    studentName: student.studentName.trim(),
    class: student.class.trim(),
    category: student.category.trim(),
    house: activeHouse.name,
    pickIndex: pickIndex,
    timestamp: new Date().toISOString()
  };
  
  // Add to local state first for instant response
  state.picks.push(newPick);
  saveStateToLocalStorage();
  
  closeModal(DOM.studentModal);
  
  // Instantly trigger animation on card if visible in grid
  const cardElements = Array.from(DOM.studentGrid.querySelectorAll(".student-card"));
  const cardEl = cardElements.find(el => el.querySelector(".student-adm").textContent.includes(student.admissionNo));
  
  if (cardEl) {
    cardEl.classList.add("selected", `selected-house-${activeHouseIdx + 1}`);
    const badge = document.createElement("div");
    badge.className = "selection-badge";
    badge.innerHTML = "✓";
    cardEl.appendChild(badge);
  }
  
  // Trigger effects
  triggerConfetti(activeHouse.color);
  showToast(`${student.studentName} drafted by ${activeHouse.name}!`, "success");
  
  // Write to Sheets API (fires asynchronously)
  postPickToSheets(newPick);
  
  // Delay refresh slightly so the card select effect finishes beautifully
  setTimeout(() => {
    state.selectedStudent = null;
    renderAll();
  }, 1600);
}

/**
 * Undoes the most recent pick.
 */
async function undoLastPick() {
  if (state.picks.length === 0) {
    showToast("No picks to undo.", "error");
    return;
  }
  
  const undone = state.picks.pop();
  saveStateToLocalStorage();
  
  showToast(`Undo pick: Reverted selection of ${undone.studentName}.`, "success");
  
  // Post to Sheets API
  postUndoToSheets();
  
  renderAll();
}

/**
 * Transitions to the next class, or next category if the class was the last in line.
 */
function finishCurrentClass() {
  const activeCat = CATEGORIES[state.activeCategoryIdx];
  const currentClassIdx = activeCat.classes.indexOf(state.activeClass);
  
  if (currentClassIdx < activeCat.classes.length - 1) {
    // Load next class in active category
    state.activeClass = activeCat.classes[currentClassIdx + 1];
    showToast(`Loading next class: ${state.activeClass}`, "success");
    saveStateToLocalStorage();
    renderAll();
  } else {
    // Category finished! Go to next category
    if (state.activeCategoryIdx < CATEGORIES.length - 1) {
      state.activeCategoryIdx += 1;
      const nextCat = CATEGORIES[state.activeCategoryIdx];
      state.activeClass = nextCat.classes[0];
      
      showToast(`Category Finished! Next: ${nextCat.name} (${state.activeClass})`, "success");
      saveStateToLocalStorage();
      renderAll();
    } else {
      showToast("All classes and categories completed! Auction finished.", "success");
    }
  }
}

/* ==========================================
   SETTINGS & CSV IMPORT/EXPORT
   ========================================== */

function openSettingsModal() {
  DOM.settingsApiUrl.value = state.apiURL;
  updateHouseInputsInSettings();
  openModal(DOM.settingsModal);
}

function updateHouseInputsInSettings() {
  for (let i = 1; i <= 4; i++) {
    document.getElementById(`settings-house-${i}-name`).value = state.houses[i-1].name;
    document.getElementById(`settings-house-${i}-color`).value = state.houses[i-1].color;
  }
}

function saveSettings() {
  state.apiURL = DOM.settingsApiUrl.value.trim();
  
  // Read house names and colors
  for (let i = 1; i <= 4; i++) {
    state.houses[i-1].name = document.getElementById(`settings-house-${i}-name`).value.trim();
    state.houses[i-1].color = document.getElementById(`settings-house-${i}-color`).value.trim();
  }
  
  saveStateToLocalStorage();
  closeModal(DOM.settingsModal);
  showToast("Settings saved successfully.", "success");
  
  if (state.apiURL) {
    syncWithGoogleSheets();
  } else {
    updateStatusIndicator();
    renderAll();
  }
}

function resetAllData() {
  if (confirm("WARNING: This will delete all local student data, selections, and reset configurations. Are you sure?")) {
    localStorage.removeItem(STORAGE_KEY);
    
    // Clear Google sheet if linked
    if (state.apiURL && !state.isOfflineMode) {
      postResetToSheets();
    }
    
    state = {
      students: [],
      picks: [],
      activeCategoryIdx: 0,
      activeClass: "D3",
      apiURL: "",
      houses: JSON.parse(JSON.stringify(DEFAULT_HOUSES)),
      selectedStudent: null,
      isOfflineMode: true,
      isLoading: false
    };
    
    DOM.settingsApiUrl.value = "";
    updateHouseInputsInSettings();
    saveStateToLocalStorage();
    closeModal(DOM.settingsModal);
    renderAll();
    updateStatusIndicator();
    showToast("All data reset successfully.", "success");
  }
}

function resetOnlyPicks() {
  if (confirm("Are you sure you want to clear all selections and start the draft from the beginning? Your student database will be preserved.")) {
    state.picks = [];
    
    // Clear Google sheet if linked
    if (state.apiURL && !state.isOfflineMode) {
      postResetToSheets();
    }
    
    saveStateToLocalStorage();
    closeModal(DOM.settingsModal);
    renderAll();
    showToast("All draft selections cleared. Ready to start from the beginning!", "success");
  }
}

/**
 * Parses uploaded student CSV file.
 */
function importCsvFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const rows = parseCsvString(text);
    
    if (rows.length <= 1) {
      showToast("CSV file is empty or invalid.", "error");
      return;
    }
    
    const headers = rows[0];
    const mappings = {};
    
    // Dynamic mapping finder
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j].trim().toLowerCase();
      if (header.includes("admission") || header.includes("adm")) {
        mappings["admissionNo"] = j;
      } else if (header.includes("student name") || header.includes("name")) {
        mappings["studentName"] = j;
      } else if (header === "class" || header.includes("grade")) {
        mappings["class"] = j;
      } else if (header.includes("category") || header.includes("section")) {
        mappings["category"] = j;
      } else if (header.includes("photo") || header.includes("file") || header.includes("id")) {
        mappings["photoFileId"] = j;
      }
    }
    
    // Require at least name and admission number
    if (mappings.admissionNo === undefined || mappings.studentName === undefined) {
      showToast("CSV columns must include 'Admission No' and 'Student Name'.", "error");
      return;
    }
    
    const importedStudents = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < headers.length) continue;
      
      importedStudents.push({
        admissionNo: mappings.admissionNo !== undefined ? row[mappings.admissionNo].trim() : "",
        studentName: mappings.studentName !== undefined ? row[mappings.studentName].trim() : "",
        class: mappings.class !== undefined ? row[mappings.class].trim() : "",
        category: mappings.category !== undefined ? row[mappings.category].trim() : "",
        photoFileId: mappings.photoFileId !== undefined ? row[mappings.photoFileId].trim() : ""
      });
    }
    
    state.students = importedStudents;
    saveStateToLocalStorage();
    renderAll();
    closeModal(DOM.settingsModal);
    showToast(`Successfully imported ${importedStudents.length} students!`, "success");
  };
  reader.readAsText(file);
}

/**
 * Standard RFC-4180 CSV parser supporting quotes and commas inside cells.
 */
function parseCsvString(text) {
  let p = '', c = '', r = [];
  let q = false;
  r.push(['']);
  for (let i = 0; i < text.length; i++) {
    c = text[i];
    let next = text[i+1];
    if (c === '"') {
      if (q && next === '"') { r[r.length-1][r[r.length-1].length-1] += '"'; i++; }
      else { q = !q; }
    } else if (c === ',' && !q) {
      r[r.length-1].push('');
    } else if (c === '\n' && !q) {
      if (p === '\r') { r[r.length-1][r[r.length-1].length-1] = r[r.length-1][r[r.length-1].length-1].slice(0, -1); }
      r.push(['']);
    } else {
      r[r.length-1][r[r.length-1].length-1] += c;
    }
    p = c;
  }
  // Trim empty final row if exists
  if (r.length > 1 && r[r.length-1].length === 1 && r[r.length-1][0] === '') {
    r.pop();
  }
  return r;
}

/**
 * Exports currently recorded picks into a printable/importable CSV file.
 */
function exportPicksCsv() {
  if (state.picks.length === 0) {
    showToast("No picks recorded to export.", "error");
    return;
  }
  
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Admission No,Student Name,Class,Category,Selected House,Timestamp,Pick Index\n";
  
  state.picks.forEach(p => {
    const row = [
      `"${p.admissionNo}"`,
      `"${p.studentName.replace(/"/g, '""')}"`,
      `"${p.class}"`,
      `"${p.category}"`,
      `"${p.house}"`,
      `"${p.timestamp}"`,
      p.pickIndex
    ].join(",");
    csvContent += row + "\n";
  });
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `auction_picks_export_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ==========================================
   UI UTILITY FUNCTIONS
   ========================================== */

function openModal(modal) {
  modal.classList.add("active");
}

function closeModal(modal) {
  modal.classList.remove("active");
}

function showToast(message, type = "success") {
  DOM.toastText.textContent = message;
  
  if (type === "success") {
    DOM.toastIcon.innerHTML = `<span class="toast-success-icon">✓</span>`;
  } else {
    DOM.toastIcon.innerHTML = `<span class="toast-error-icon">✗</span>`;
  }
  
  DOM.toast.classList.add("active");
  
  // Auto dismiss after 3 seconds
  setTimeout(() => {
    DOM.toast.classList.remove("active");
  }, 3000);
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

/* ==========================================
   LIGHTWEIGHT CUSTOM CANVAS CONFETTI
   ========================================== */

let confettiActive = false;
let confettiParticles = [];
const confettiColors = ["#f43f5e", "#3b82f6", "#10b981", "#eab308", "#a855f7", "#ff007f", "#00ffff"];

function triggerConfetti(houseColor) {
  const canvas = DOM.confettiCanvas;
  const ctx = canvas.getContext("2d");
  
  // Resize canvas to cover window
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  confettiParticles = [];
  confettiActive = true;
  
  // Emit particles from bottom-left and bottom-right
  const numParticles = 120;
  for (let i = 0; i < numParticles; i++) {
    const isLeft = i < numParticles / 2;
    confettiParticles.push({
      x: isLeft ? 50 : canvas.width - 50,
      y: canvas.height - 50,
      radius: Math.random() * 4 + 4,
      color: Math.random() > 0.4 ? houseColor : confettiColors[Math.floor(Math.random() * confettiColors.length)],
      vx: (isLeft ? Math.random() * 8 + 6 : -(Math.random() * 8 + 6)),
      vy: -(Math.random() * 15 + 15),
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 10 - 5,
      opacity: 1,
      decay: Math.random() * 0.015 + 0.01
    });
  }
  
  // Animation Loop
  function updateConfetti() {
    if (!confettiActive) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let activeCount = 0;
    confettiParticles.forEach(p => {
      if (p.opacity <= 0) return;
      activeCount++;
      
      // Apply physics
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.5; // Gravity
      p.vx *= 0.98; // Friction
      p.rotation += p.rotationSpeed;
      p.opacity -= p.decay;
      
      // Draw particle
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      
      // Rectangle particle
      ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 1.2);
      ctx.restore();
    });
    
    if (activeCount > 0) {
      requestAnimationFrame(updateConfetti);
    } else {
      confettiActive = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  
  updateConfetti();
}

// Window resize handler for confetti
window.addEventListener("resize", () => {
  if (confettiActive) {
    DOM.confettiCanvas.width = window.innerWidth;
    DOM.confettiCanvas.height = window.innerHeight;
  }
});
