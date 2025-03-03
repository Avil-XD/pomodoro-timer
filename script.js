// Check local storage availability
const isLocalStorageAvailable = () => {
    try {
        const test = "__storage_test__";
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
};

// Create audio context for cross-browser compatibility
let audioContext = null;
const createAudioContext = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
    } catch (e) {
        console.warn("Web Audio API is not supported in this browser");
    }
};

// DOM Elements
const elements = {
    currentTime: document.getElementById("current-time"),
    timerDisplay: document.getElementById("timer").querySelector(".timer-display"),
    modeIndicator: document.getElementById("mode-indicator"),
    start: document.getElementById("start"),
    pause: document.getElementById("pause"),
    reset: document.getElementById("reset"),
    settingsBtn: document.getElementById("settings-btn"),
    settingsPanel: document.getElementById("settings-panel"),
    focusTime: document.getElementById("focus-time"),
    breakTime: document.getElementById("break-time"),
    longBreakTime: document.getElementById("long-break-time"),
    autoStartBreaks: document.getElementById("auto-start-breaks"),
    saveSettings: document.getElementById("save-settings"),
    timeFormat: document.getElementById("time-format"),
    timer: document.getElementById("timer")
};

// Validate all required DOM elements
Object.entries(elements).forEach(([key, element]) => {
    if (!element) {
        console.error(`Required element "${key}" not found`);
    }
});

// Timer state
let timerState = {
    isRunning: false,
    timeLeft: 25 * 60, // in seconds
    totalTime: 25 * 60,
    mode: 'focus',
    pomodorosCompleted: 0
};

// Settings state with defaults
let settings = {
    focusTime: 25,
    breakTime: 5,
    longBreakTime: 15,
    autoStartBreaks: false,
    timeFormat: '24'
};

// Load settings from localStorage
function loadSettings() {
    if (!isLocalStorageAvailable()) {
        console.warn("LocalStorage is not available. Settings will not persist.");
        return;
    }

    try {
        const savedSettings = localStorage.getItem("pomodoroSettings");
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            settings = {
                ...settings,
                focusTime: parseInt(parsed.focusTime) || settings.focusTime,
                breakTime: parseInt(parsed.breakTime) || settings.breakTime,
                longBreakTime: parseInt(parsed.longBreakTime) || settings.longBreakTime,
                autoStartBreaks: Boolean(parsed.autoStartBreaks),
                timeFormat: ["12", "24"].includes(parsed.timeFormat) ? parsed.timeFormat : "24"
            };
        }
    } catch (error) {
        console.error("Error loading settings:", error);
        localStorage.removeItem("pomodoroSettings");
    }
    
    updateSettingsInputs();
}

// Load saved timer state
function loadTimerState() {
    if (!isLocalStorageAvailable()) return;
    
    try {
        const savedState = localStorage.getItem("timerState");
        if (savedState) {
            const state = JSON.parse(savedState);
            timerState = {
                ...timerState,
                timeLeft: parseInt(state.timeLeft) || timerState.timeLeft,
                mode: state.mode || timerState.mode,
                pomodorosCompleted: parseInt(state.pomodorosCompleted) || 0,
                isRunning: false // Always start paused when restoring state
            };
            updateTimerDisplay();
            updateModeIndicator();
        }
    } catch (error) {
        console.error("Error loading timer state:", error);
        localStorage.removeItem("timerState");
    }
}

// Save settings to localStorage
function saveSettings() {
    if (!isLocalStorageAvailable()) {
        console.warn("LocalStorage is not available. Settings will not persist.");
        return;
    }

    try {
        settings = {
            focusTime: Math.max(1, Math.min(60, parseInt(elements.focusTime.value) || 25)),
            breakTime: Math.max(1, Math.min(30, parseInt(elements.breakTime.value) || 5)),
            longBreakTime: Math.max(1, Math.min(60, parseInt(elements.longBreakTime.value) || 15)),
            autoStartBreaks: elements.autoStartBreaks.checked,
            timeFormat: elements.timeFormat.value
        };

        localStorage.setItem("pomodoroSettings", JSON.stringify(settings));
        elements.settingsPanel.classList.add("hidden");
        resetTimer();
    } catch (error) {
        console.error("Error saving settings:", error);
        alert("There was an error saving your settings. Please try again.");
    }
}

// Update settings input values
function updateSettingsInputs() {
    if (!elements.focusTime || !elements.breakTime || !elements.longBreakTime) return;
    
    elements.focusTime.value = settings.focusTime;
    elements.breakTime.value = settings.breakTime;
    elements.longBreakTime.value = settings.longBreakTime;
    elements.autoStartBreaks.checked = settings.autoStartBreaks;
    elements.timeFormat.value = settings.timeFormat;
}

// Format time as HH:MM:SS
function formatTime(timeInSeconds) {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = timeInSeconds % 60;
    
    if (hours > 0) {
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Update current time
function updateCurrentTime() {
    if (!elements.currentTime) return;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString("en-US", {
        hour12: settings.timeFormat === "12",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
    elements.currentTime.textContent = timeString;
}

// Update timer display
function updateTimerDisplay() {
    if (!elements.timerDisplay) return;
    
    elements.timerDisplay.textContent = formatTime(timerState.timeLeft);
    document.title = `${formatTime(timerState.timeLeft)} - ${timerState.mode === "focus" ? "Focus" : "Break"}`;
}

// Update mode indicator
function updateModeIndicator() {
    if (!elements.modeIndicator) return;
    
    const mode = timerState.mode === "focus" ? "Focus Time" : 
                (timerState.mode === "break" ? "Break Time" : "Long Break");
    elements.modeIndicator.textContent = mode;
}

// Timer tick function
function timerTick() {
    if (!timerState.isRunning) return;

    if (timerState.timeLeft > 0) {
        timerState.timeLeft--;
        updateTimerDisplay();
    } else {
        handleTimerComplete();
    }
}

// Cross-platform notification sound
async function playNotificationSound() {
    try {
        if (audioContext === null) {
            createAudioContext();
        }

        if (audioContext) {
            // Use Web Audio API
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.1);
            gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.5);
        } else {
            // Fallback to standard Audio API
            const audio = new Audio("data:audio/wav;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAGDgYtAgAyN+QWaAAihwMWm4G8QQRDiMcCBcH3Cc+CDv/7xA4Tvh9Rz/y8QADBwMWgQAZG/ILNAARQ4GLTcDeIIIhxGOBAuD7hOfBB3/94gcJ3w+o5/5eIAIAAAVwWgQAVQ2ORaIQwEMAJiDg95G4nQL7mQVWI6GwRcfsZAcsKkJvxgxEjzFUgfHoSQ9Qq7KNwqHwuB13MA4a1q/DmBrHgPcmjiGoh//EwC5nGPEmS4RcfkVKOhJf+WOgoxJclFz3kgn//dBA+ya1GhurNn8zb//9NNutNuhz31f////9vt///z+IdAEAAAK4LQIAKobHItEIYCGAExBwe8jcToF9zIKrEdDYIuP2MgOWFSE34wYiR5iqQPj0JIeoVdlG4VD4XA67mAcNa1fhzA1jwHuTRxDUQ//iYBczjHiTJcIuPyKlHQkv/LHQUYkuSi57yQT//uggfZNajQ3Vmz+Zt//+mm3Wm3Q576v////+32///5/EOgAAADVghQAAAAA==");
            await audio.play();
        }
    } catch (error) {
        console.warn("Could not play notification sound:", error);
    }
}

// Handle timer completion
function handleTimerComplete() {
    playNotificationSound();
    
    if (timerState.mode === "focus") {
        timerState.pomodorosCompleted++;
        if (timerState.pomodorosCompleted % 4 === 0) {
            startLongBreak();
        } else {
            startBreak();
        }
    } else {
        startFocus();
    }

    if (settings.autoStartBreaks) {
        startTimer();
    } else {
        timerState.isRunning = false;
        updateControlsDisplay();
    }
}

// Update controls display
function updateControlsDisplay() {
    if (!elements.start || !elements.pause) return;
    
    if (timerState.isRunning) {
        elements.start.style.display = "none";
        elements.pause.style.display = "inline-block";
    } else {
        elements.start.style.display = "inline-block";
        elements.pause.style.display = "none";
    }
    
    if (elements.timer) {
        elements.timer.classList.toggle("active", timerState.isRunning);
    }
}

// Timer control functions
function startTimer() {
    if (!timerState.isRunning) {
        timerState.isRunning = true;
        updateControlsDisplay();
        setupIntervals();
    }
}

function pauseTimer() {
    timerState.isRunning = false;
    updateControlsDisplay();
}

function resetTimer() {
    timerState.isRunning = false;
    updateControlsDisplay();
    
    try {
        if (timerState.mode === "focus") {
            timerState.timeLeft = settings.focusTime * 60;
        } else if (timerState.mode === "break") {
            timerState.timeLeft = settings.breakTime * 60;
        } else {
            timerState.timeLeft = settings.longBreakTime * 60;
        }
        
        timerState.totalTime = timerState.timeLeft;
        updateTimerDisplay();
    } catch (error) {
        console.error("Error resetting timer:", error);
        // Fallback to default values
        timerState.timeLeft = 25 * 60;
        timerState.totalTime = timerState.timeLeft;
        updateTimerDisplay();
    }
}

function startFocus() {
    timerState.mode = "focus";
    timerState.timeLeft = settings.focusTime * 60;
    timerState.totalTime = timerState.timeLeft;
    updateModeIndicator();
    updateTimerDisplay();
}

function startBreak() {
    timerState.mode = "break";
    timerState.timeLeft = settings.breakTime * 60;
    timerState.totalTime = timerState.timeLeft;
    updateModeIndicator();
    updateTimerDisplay();
}

function startLongBreak() {
    timerState.mode = "longBreak";
    timerState.timeLeft = settings.longBreakTime * 60;
    timerState.totalTime = timerState.timeLeft;
    updateModeIndicator();
    updateTimerDisplay();
}

// Clean up intervals on page visibility change
let clockInterval = null;
let timerInterval = null;

function setupIntervals() {
    clearInterval(clockInterval);
    clearInterval(timerInterval);
    clockInterval = setInterval(updateCurrentTime, 1000);
    timerInterval = setInterval(timerTick, 1000);
}

function cleanupIntervals() {
    clearInterval(clockInterval);
    clearInterval(timerInterval);
}

// Handle page visibility change
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        cleanupIntervals();
    } else {
        updateCurrentTime(); // Immediate update when page becomes visible
        setupIntervals();
    }
});

// Event listeners with error handling
function addSafeEventListener(element, event, handler) {
    try {
        if (element && typeof element.addEventListener === "function") {
            element.addEventListener(event, handler);
        } else {
            console.error(`Invalid element for event listener: ${event}`);
        }
    } catch (error) {
        console.error(`Error adding event listener: ${error}`);
    }
}

// Add event listeners
addSafeEventListener(elements.start, "click", startTimer);
addSafeEventListener(elements.pause, "click", pauseTimer);
addSafeEventListener(elements.reset, "click", resetTimer);
addSafeEventListener(elements.settingsBtn, "click", () => elements.settingsPanel.classList.toggle("hidden"));
addSafeEventListener(elements.saveSettings, "click", saveSettings);

// Initialize
loadSettings();
loadTimerState();
updateTimerDisplay();
updateModeIndicator();
updateControlsDisplay();

// Start intervals
setupIntervals();
updateCurrentTime(); // Initial update

// Handle beforeunload to save state
window.addEventListener("beforeunload", () => {
    if (isLocalStorageAvailable() && timerState.isRunning) {
        localStorage.setItem("timerState", JSON.stringify({
            timeLeft: timerState.timeLeft,
            mode: timerState.mode,
            pomodorosCompleted: timerState.pomodorosCompleted
        }));
    }
});