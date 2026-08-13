console.log("[TapTone] Core Engine Initialized.");

// --- GLOBAL STATE ---
let isEditMode = false;
let currentProfile = "event_podcast.xml";
let buttonState = {}; 
let activeConfigId = null; 

// --- AUDIO & MIDI ENGINE ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
let audioBuffers = {}; 
let playingSources = []; 

// 1. Preload Audio to RAM for Zero Latency
async function preloadAudio(fileName) {
    if (audioBuffers[fileName]) return; // Skip if already loaded
    try {
        const response = await fetch(`/assets/sounds/${fileName}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioBuffers[fileName] = audioBuffer;
        console.log(`[Audio Engine] Preloaded: ${fileName}`);
    } catch (err) {
        console.error(`Failed to load audio: ${fileName}`, err);
    }
}

// 2. Play Audio Node
function playAudio(fileName) {
    if (!audioBuffers[fileName]) {
        console.warn(`[Audio Engine] Buffer not found for ${fileName}. Attempting to load...`);
        preloadAudio(fileName).then(() => playAudio(fileName));
        return;
    }
    
    // Resume context if browser suspends it
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffers[fileName];
    source.connect(audioCtx.destination);
    source.start(0);
    playingSources.push(source);

    source.onended = () => {
        // Cleanup memory when playback finishes
        playingSources = playingSources.filter(s => s !== source);
    };
}

// 3. Stop All Audio
function stopAllAudio() {
    playingSources.forEach(source => {
        try { source.stop(); } catch (e) {}
    });
    playingSources = [];
    console.log("[Audio Engine] All sounds stopped.");
}

// --- MIDI INIT ---
if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(
        (midiAccess) => {
            console.log("[TapTone] MIDI Ready.");
            for (var input of midiAccess.inputs.values()) {
                input.onmidimessage = handleMIDIMessage;
            }
        }, 
        () => console.error("Could not access your MIDI devices.")
    );
}

function handleMIDIMessage(message) {
    const command = message.data[0];
    const note = message.data[1];
    const velocity = (message.data.length > 2) ? message.data[2] : 0;

    if (command === 144 && velocity > 0) { // 144 = Note On
        if (isEditMode && activeConfigId) {
            document.getElementById('input-midi').value = note;
            buttonState[activeConfigId].midiNote = note;
        } else {
            Object.keys(buttonState).forEach(id => {
                if (buttonState[id].midiNote == note) triggerButtonAction(id);
            });
        }
    }
}

// --- UI & DATA FETCHING ---
const gridContainer = document.getElementById('sound-grid');
const btnSettings = document.getElementById('btn-settings');
const selectedBtnLabel = document.getElementById('selected-btn-id');
const audioListUI = document.getElementById('audio-list');

// Fetch Library from Backend
async function fetchLibrary() {
    try {
        const res = await fetch('/api/library');
        const data = await res.json();
        
        audioListUI.innerHTML = '';
        data.sounds.forEach(sound => {
            const li = document.createElement('li');
            li.className = 'file-item';
            li.draggable = true;
            li.innerText = sound;
            
            // Drag Start Logic
            li.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', sound);
            });
            
            audioListUI.appendChild(li);
            preloadAudio(sound); // Preload all fetched sounds
        });
    } catch (err) {
        console.error("Failed to fetch library", err);
    }
}

function generateGrid() {
    gridContainer.innerHTML = ''; 
    for (let row = 1; row <= 3; row++) {
        for (let col = 1; col <= 5; col++) {
            const btnId = `${row}_${col}`;
            buttonState[btnId] = { name: "Empty", action: "blank", file: "", midiNote: "", bgColor: "#2a2d3e" }; 
            
            const button = document.createElement('button');
            button.className = 'sound-btn';
            button.id = `btn_${btnId}`;
            button.innerHTML = `<span class="btn-text" id="text_${btnId}">Empty</span>`; 
            gridContainer.appendChild(button);
            
            button.addEventListener('mousedown', () => {
                if (isEditMode) openConfigForButton(btnId);
                else triggerButtonAction(btnId);
            });
        }
    }
}

function triggerButtonAction(id) {
    const btn = document.getElementById(`btn_${id}`);
    const data = buttonState[id];

    btn.classList.add('is-playing');
    setTimeout(() => btn.classList.remove('is-playing'), 250);

    if (data.action === "play_sound" && data.file) {
        playAudio(data.file);
    } else if (data.action === "stop_all") {
        stopAllAudio();
    }
}

// --- EDIT MODE CONFIG ---
function openConfigForButton(id) {
    activeConfigId = id;
    document.querySelectorAll('.sound-btn').forEach(b => b.style.borderColor = '');
    document.getElementById(`btn_${id}`).style.borderColor = '#00ff88';
    
    selectedBtnLabel.innerText = `(${id})`;
    document.getElementById('input-btn-name').value = buttonState[id].name === "Empty" ? "" : buttonState[id].name;
    document.getElementById('select-action-type').value = buttonState[id].action;
    document.getElementById('input-sound-file').value = buttonState[id].file;
    document.getElementById('input-midi').value = buttonState[id].midiNote;
    document.getElementById('input-bg-color').value = buttonState[id].bgColor || "#2a2d3e";
}

// REAL-TIME UI UPDATES (Typing in inputs updates the Grid immediately)
document.getElementById('input-btn-name').addEventListener('input', (e) => {
    if (!activeConfigId) return;
    const val = e.target.value || "Empty";
    buttonState[activeConfigId].name = val;
    document.getElementById(`text_${activeConfigId}`).innerText = val;
});

document.getElementById('select-action-type').addEventListener('change', (e) => {
    if (activeConfigId) buttonState[activeConfigId].action = e.target.value;
});

document.getElementById('input-bg-color').addEventListener('input', (e) => {
    if (!activeConfigId) return;
    buttonState[activeConfigId].bgColor = e.target.value;
    document.getElementById(`btn_${activeConfigId}`).style.background = e.target.value;
});

// DRAG AND DROP TARGET LOGIC
const dropZone = document.getElementById('input-sound-file');
dropZone.addEventListener('dragover', (e) => e.preventDefault());
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    const fileName = e.dataTransfer.getData('text/plain');
    if (activeConfigId && fileName) {
        dropZone.value = fileName;
        buttonState[activeConfigId].file = fileName;
        buttonState[activeConfigId].action = "play_sound";
        document.getElementById('select-action-type').value = "play_sound";
    }
});
dropZone.addEventListener('input', (e) => {
    if (activeConfigId) buttonState[activeConfigId].file = e.target.value;
});

// --- TOGGLE EDIT MODE ---
btnSettings.addEventListener('click', async () => {
    isEditMode = !isEditMode;
    
    if (isEditMode) {
        document.body.classList.add('edit-mode');
        btnSettings.innerText = "💾 Save Profile & Exit";
        btnSettings.classList.add('save-mode');
        fetchLibrary(); // Load files when opening edit mode
    } else {
        btnSettings.innerText = "Saving...";
        
        const profileData = {
            SoundboardProfile: {
                $: { name: "Event Podcast", is_readonly: "false" },
                Pages: { Page: [{ $: { index: "1" }, Button: [] }] }
            }
        };

        Object.keys(buttonState).forEach(id => {
            profileData.SoundboardProfile.Pages.Page[0].Button.push({
                $: { id: id },
                Name: buttonState[id].name,
                Action: { $: { type: buttonState[id].action }, SoundFile: buttonState[id].file },
                Appearance: { BgColor: buttonState[id].bgColor },
                MidiMapping: { Note: buttonState[id].midiNote }
            });
        });

        try {
            await fetch('/api/save-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileName: currentProfile, data: profileData })
            });
            console.log("[TapTone] Profile Saved.");
        } catch (err) {
            console.error("Failed to save profile:", err);
        }

        document.body.classList.remove('edit-mode');
        btnSettings.innerText = "⚙️ Edit Settings";
        btnSettings.classList.remove('save-mode');
        document.querySelectorAll('.sound-btn').forEach(b => b.style.borderColor = '');
        activeConfigId = null;
    }
});

// INITIALIZE
generateGrid();