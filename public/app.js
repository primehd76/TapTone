console.log("[TapTone] Core Engine Initialized.");

let isEditMode = false;
let currentProfile = "default.xml";
let buttonState = {}; 
let activeConfigId = null; 
let audioBuffers = {}; 
let playingSources = []; 

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const gridContainer = document.getElementById('sound-grid');
const btnSettings = document.getElementById('btn-settings');
const audioListUI = document.getElementById('audio-list');
const profileSelect = document.getElementById('profile-select');

// --- 1. INITIALIZATION & DATA FETCHING ---
async function initApp() {
    generateEmptyGrid();
    await fetchLibrary();
    await loadProfile(currentProfile);
}

function generateEmptyGrid() {
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

async function fetchLibrary() {
    const res = await fetch('/api/library');
    const data = await res.json();
    
    // Render Audio List
    audioListUI.innerHTML = '';
    data.sounds.forEach(sound => {
        const wrap = document.createElement('div');
        wrap.className = 'file-item-wrapper';
        
        const li = document.createElement('li');
        li.className = 'file-item';
        li.draggable = true;
        li.innerText = sound;
        li.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', sound));
        
        const actions = document.createElement('div');
        actions.className = 'file-actions';
        
        const btnRename = document.createElement('button');
        btnRename.innerText = '✏️';
        btnRename.onclick = () => renameAudio(sound);
        
        const btnDel = document.createElement('button');
        btnDel.innerText = '❌';
        btnDel.onclick = () => deleteAudio(sound);
        
        actions.appendChild(btnRename);
        actions.appendChild(btnDel);
        wrap.appendChild(li);
        wrap.appendChild(actions);
        audioListUI.appendChild(wrap);
        
        preloadAudio(sound);
    });

    // Render Profiles Dropdown
    profileSelect.innerHTML = '';
    data.profiles.forEach(prof => {
        const opt = document.createElement('option');
        opt.value = prof;
        opt.innerText = prof;
        if (prof === currentProfile) opt.selected = true;
        profileSelect.appendChild(opt);
    });
}

// --- 2. PROFILE CRUD LOGIC ---
async function loadProfile(profileName) {
    document.getElementById('current-profile-name').innerText = profileName.replace('.xml', '');
    currentProfile = profileName;
    
    const res = await fetch('/api/load-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileName })
    });
    const { status, data } = await res.json();
    
    generateEmptyGrid(); // Reset grid before populating
    
    if (status === 'success' && data.SoundboardProfile.Pages) {
        const buttons = data.SoundboardProfile.Pages[0].Page[0].Button || [];
        buttons.forEach(b => {
            const id = b.$.id;
            buttonState[id] = {
                name: b.Name ? b.Name[0] : "Empty",
                action: b.Action ? b.Action[0].$.type : "blank",
                file: (b.Action && b.Action[0].SoundFile) ? b.Action[0].SoundFile[0] : "",
                bgColor: (b.Appearance && b.Appearance[0].BgColor) ? b.Appearance[0].BgColor[0] : "#2a2d3e",
                midiNote: (b.MidiMapping && b.MidiMapping[0].Note) ? b.MidiMapping[0].Note[0] : ""
            };
            // Apply visual state
            document.getElementById(`text_${id}`).innerText = buttonState[id].name;
            document.getElementById(`btn_${id}`).style.background = buttonState[id].bgColor;
        });
    }
}

profileSelect.addEventListener('change', (e) => loadProfile(e.target.value));

document.getElementById('btn-new-profile').addEventListener('click', async () => {
    let name = prompt("Enter new profile name (without .xml):");
    if (!name) return;
    name = name.trim() + '.xml';
    
    // Save an empty profile to trigger creation
    await saveProfileToAPI(name);
    await fetchLibrary();
    profileSelect.value = name;
    loadProfile(name);
});

document.getElementById('btn-del-profile').addEventListener('click', async () => {
    if (currentProfile === 'default.xml') return alert("Cannot delete default profile.");
    if (!confirm(`Delete profile ${currentProfile}?`)) return;
    
    await fetch('/api/delete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileName: currentProfile })
    });
    currentProfile = 'default.xml';
    await fetchLibrary();
    loadProfile(currentProfile);
});

async function saveProfileToAPI(profileName) {
    const profileData = {
        SoundboardProfile: {
            $: { name: profileName.replace('.xml', ''), is_readonly: profileName === 'default.xml' ? "true" : "false" },
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
    await fetch('/api/save-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileName, data: profileData })
    });
}

// --- 3. AUDIO FILES CRUD ---
document.getElementById('btn-upload-sound').addEventListener('click', () => document.getElementById('file-upload-input').click());
document.getElementById('file-upload-input').addEventListener('change', (e) => {
    if (!e.target.files.length) return;
    
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress-bar');
    
    // Tampilkan progress bar
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    btnSettings.innerText = "Uploading...";

    // Pakai XMLHttpRequest agar bisa melacak progress (Fetch API tidak bisa)
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            progressBar.style.width = percentComplete + '%';
        }
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            console.log("[TapTone] Upload success.");
            fetchLibrary(); // Refresh list audio
        } else {
            alert("Upload failed! Server responded with status: " + xhr.status);
        }
        
        // Sembunyikan progress bar setelah selesai (dengan sedikit jeda)
        setTimeout(() => {
            progressContainer.style.display = 'none';
            e.target.value = ''; // Reset input agar bisa upload file yang sama lagi
            btnSettings.innerText = "💾 Save Profile & Exit";
        }, 500);
    };

    xhr.onerror = () => {
        alert("Upload error! Please check your network or Docker connection.");
        progressContainer.style.display = 'none';
        e.target.value = '';
        btnSettings.innerText = "💾 Save Profile & Exit";
    };

    xhr.send(formData);
});

async function deleteAudio(filename) {
    if (!confirm(`Delete sound ${filename}?`)) return;
    await fetch('/api/delete-sound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
    });
    fetchLibrary();
}

async function renameAudio(oldName) {
    let newName = prompt("Enter new filename:", oldName);
    if (!newName || newName === oldName) return;
    await fetch('/api/rename-sound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName })
    });
    fetchLibrary();
}

// --- 4. PLAYBACK ENGINE ---
async function preloadAudio(fileName) {
    if (audioBuffers[fileName]) return;
    try {
        const res = await fetch(`/assets/sounds/${fileName}`);
        audioBuffers[fileName] = await audioCtx.decodeAudioData(await res.arrayBuffer());
    } catch (e) { console.warn(`Skipping missing audio: ${fileName}`); }
}

function playAudio(fileName) {
    if (!audioBuffers[fileName]) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffers[fileName];
    source.connect(audioCtx.destination);
    source.start(0);
    playingSources.push(source);
    source.onended = () => playingSources = playingSources.filter(s => s !== source);
}

function stopAllAudio() {
    playingSources.forEach(s => { try { s.stop(); } catch(e){} });
    playingSources = [];
}

function triggerButtonAction(id) {
    const btn = document.getElementById(`btn_${id}`);
    const data = buttonState[id];
    btn.classList.add('is-playing');
    setTimeout(() => btn.classList.remove('is-playing'), 250);

    if (data.action === "play_sound" && data.file) playAudio(data.file);
    else if (data.action === "stop_all") stopAllAudio();
}

// --- 5. EDIT MODE & BINDINGS ---
function openConfigForButton(id) {
    activeConfigId = id;
    document.querySelectorAll('.sound-btn').forEach(b => b.style.borderColor = '');
    document.getElementById(`btn_${id}`).style.borderColor = '#00ff88';
    
    document.getElementById('selected-btn-id').innerText = `(${id})`;
    document.getElementById('input-btn-name').value = buttonState[id].name === "Empty" ? "" : buttonState[id].name;
    document.getElementById('select-action-type').value = buttonState[id].action;
    document.getElementById('input-sound-file').value = buttonState[id].file;
    document.getElementById('input-bg-color').value = buttonState[id].bgColor;
}

// Bind Config Panel Inputs
document.getElementById('input-btn-name').addEventListener('input', (e) => {
    if (!activeConfigId) return;
    buttonState[activeConfigId].name = e.target.value || "Empty";
    document.getElementById(`text_${activeConfigId}`).innerText = buttonState[activeConfigId].name;
});
document.getElementById('select-action-type').addEventListener('change', (e) => activeConfigId && (buttonState[activeConfigId].action = e.target.value));
document.getElementById('input-bg-color').addEventListener('input', (e) => {
    if (!activeConfigId) return;
    buttonState[activeConfigId].bgColor = e.target.value;
    document.getElementById(`btn_${activeConfigId}`).style.background = e.target.value;
});

// Drag & Drop
const dropZone = document.getElementById('input-sound-file');
dropZone.addEventListener('dragover', e => e.preventDefault());
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    if (activeConfigId) {
        const file = e.dataTransfer.getData('text/plain');
        dropZone.value = file;
        buttonState[activeConfigId].file = file;
        buttonState[activeConfigId].action = "play_sound";
        document.getElementById('select-action-type').value = "play_sound";
    }
});

btnSettings.addEventListener('click', async () => {
    isEditMode = !isEditMode;
    if (isEditMode) {
        document.body.classList.add('edit-mode');
        btnSettings.innerText = "💾 Save Profile & Exit";
        btnSettings.classList.add('save-mode');
    } else {
        btnSettings.innerText = "Saving...";
        await saveProfileToAPI(currentProfile);
        document.body.classList.remove('edit-mode');
        btnSettings.innerText = "⚙️ Edit Settings";
        btnSettings.classList.remove('save-mode');
        document.querySelectorAll('.sound-btn').forEach(b => b.style.borderColor = '');
        activeConfigId = null;
    }
});

// Boot
initApp();