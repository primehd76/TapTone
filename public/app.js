console.log("[TapTone] Core Engine Initialized.");

// --- GLOBAL STATE ---
let isEditMode = false;
let currentProfile = "event_podcast.xml";
let buttonState = {}; // Stores config for each button (1_1 to 3_5)
let activeConfigId = null; 

// --- AUDIO & MIDI ENGINE ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
let audioBuffers = {}; // Preloaded sounds
let playingSources = []; // Tracks currently playing audio

// Init MIDI
if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
} else {
    console.warn("Web MIDI API not supported in this browser.");
}

function onMIDISuccess(midiAccess) {
    console.log("[TapTone] MIDI Ready.");
    for (var input of midiAccess.inputs.values()) {
        input.onmidimessage = handleMIDIMessage;
    }
}
function onMIDIFailure() { console.error("Could not access your MIDI devices."); }

function handleMIDIMessage(message) {
    const command = message.data[0];
    const note = message.data[1];
    const velocity = (message.data.length > 2) ? message.data[2] : 0; // a velocity value might not be included with a noteOff command

    if (command === 144 && velocity > 0) { // 144 = Note On
        if (isEditMode && activeConfigId) {
            // Assign MIDI
            document.getElementById('input-midi').value = note;
            buttonState[activeConfigId].midiNote = note;
            console.log(`Assigned MIDI Note ${note} to ${activeConfigId}`);
        } else {
            // Play mapped button
            Object.keys(buttonState).forEach(id => {
                if (buttonState[id].midiNote == note) {
                    triggerButtonAction(id);
                }
            });
        }
    }
}

// --- UI LOGIC ---
const gridContainer = document.getElementById('sound-grid');
const btnSettings = document.getElementById('btn-settings');
const selectedBtnLabel = document.getElementById('selected-btn-id');

function generateGrid() {
    gridContainer.innerHTML = ''; 
    for (let row = 1; row <= 3; row++) {
        for (let col = 1; col <= 5; col++) {
            const btnId = `${row}_${col}`;
            buttonState[btnId] = { name: "Empty", action: "blank", file: "", midiNote: "" }; // Default State
            
            const button = document.createElement('button');
            button.className = 'sound-btn';
            button.id = `btn_${btnId}`;
            button.dataset.id = btnId;
            button.innerHTML = `<span class="btn-text">Empty</span>`; 
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

    // Visual Feedback
    btn.classList.add('is-playing');
    setTimeout(() => btn.classList.remove('is-playing'), 300);

    // Logic
    if (data.action === "play_sound" && data.file) {
        // Example: To implement Zero-Latency Web Audio API buffer playback later
        console.log(`[Audio Engine] Playing: ${data.file}`);
    } else if (data.action === "stop_all") {
        console.log(`[Audio Engine] Stopping all sounds.`);
    }
}

// --- EDIT MODE & CONFIG LOGIC ---
function openConfigForButton(id) {
    activeConfigId = id;
    document.querySelectorAll('.sound-btn').forEach(b => b.style.borderColor = '');
    document.getElementById(`btn_${id}`).style.borderColor = '#00ff88';
    
    selectedBtnLabel.innerText = `(${id})`;
    document.getElementById('input-btn-name').value = buttonState[id].name;
    document.getElementById('select-action-type').value = buttonState[id].action;
    document.getElementById('input-sound-file').value = buttonState[id].file;
    document.getElementById('input-midi').value = buttonState[id].midiNote;
}

btnSettings.addEventListener('click', async () => {
    isEditMode = !isEditMode;
    
    if (isEditMode) {
        // ENTER EDIT MODE
        document.body.classList.add('edit-mode');
        btnSettings.innerText = "💾 Save Profile & Exit";
        btnSettings.classList.add('save-mode');
    } else {
        // SAVE AND EXIT
        btnSettings.innerText = "Saving...";
        
        // Prepare Data for XML Conversion
        const profileData = {
            SoundboardProfile: {
                $: { name: "Event Podcast", is_readonly: "false" },
                Pages: {
                    Page: [{ $: { index: "1" }, Button: [] }]
                }
            }
        };

        // Populate JSON with button states
        Object.keys(buttonState).forEach(id => {
            profileData.SoundboardProfile.Pages.Page[0].Button.push({
                $: { id: id },
                Name: buttonState[id].name,
                Action: { $: { type: buttonState[id].action }, SoundFile: buttonState[id].file },
                MidiMapping: { Note: buttonState[id].midiNote }
            });
        });

        // Send to Backend
        try {
            await fetch('/api/save-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileName: currentProfile, data: profileData })
            });
            console.log("[TapTone] Profile Saved Successfully!");
        } catch (err) {
            console.error("Failed to save profile:", err);
        }

        // Reset UI
        document.body.classList.remove('edit-mode');
        btnSettings.innerText = "⚙️ Edit Settings";
        btnSettings.classList.remove('save-mode');
        document.querySelectorAll('.sound-btn').forEach(b => b.style.borderColor = '');
        activeConfigId = null;
    }
});

// Init UI
generateGrid();