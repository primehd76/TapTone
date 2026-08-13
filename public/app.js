console.log("[TapTone] Core Engine Initialized.");

let isEditMode = false;
let currentProfile = "default.xml";
let activePage = 1;
let buttonState = {}; 
let activeConfigId = null; 
let audioBuffers = {}; 
let playingSources = []; 

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const gridContainer = document.getElementById('sound-grid');
const btnSettings = document.getElementById('btn-settings');
const audioListUI = document.getElementById('audio-list');
const profileSelect = document.getElementById('profile-select');

// --- 1. INITIALIZATION & 5-PAGE STATES ---
function initButtonStates() {
    buttonState = {};
    for (let p = 1; p <= 5; p++) {
        buttonState[p] = {};
        for (let row = 1; row <= 3; row++) {
            for (let col = 1; col <= 5; col++) {
                const btnId = `${row}_${col}`;
                buttonState[p][btnId] = { 
                    name: "Empty", 
                    action: "blank", 
                    file: "", 
                    midiNote: "", 
                    bgColor: "#2a2d3e",
                    fontColor: "#ffffff",
                    displayMode: "text",
                    icon: "🔥"
                };
            }
        }
    }
}

async function initApp() {
    initButtonStates();
    renderGrid();
    await fetchLibrary();
    await loadProfile(currentProfile);
}

// --- 2. GRID RENDERING & PAGE NAVIGATION ---
function renderGrid() {
    gridContainer.innerHTML = ''; 
    document.getElementById('page-indicator').innerText = `Page ${activePage} / 5`;

    for (let row = 1; row <= 3; row++) {
        for (let col = 1; col <= 5; col++) {
            const btnId = `${row}_${col}`;
            const pageOfThisButton = activePage; 
            const data = buttonState[pageOfThisButton][btnId];
            
            const button = document.createElement('button');
            button.className = 'sound-btn';
            button.id = `btn_${btnId}`;
            button.style.background = data.bgColor;
            button.style.color = data.fontColor || "#ffffff";
            
            const span = document.createElement('span');
            span.className = 'btn-text';
            span.id = `text_${btnId}`;
            
            // Render Text atau Stock Icon berdasarkan displayMode
            if (data.displayMode === "icon") {
                span.innerText = data.icon || "🔥";
                span.style.fontSize = "28px"; // Ukuran icon lebih besar
            } else {
                span.innerText = data.name === "Empty" ? "Empty" : data.name;
                span.style.fontSize = ""; 
            }
            
            button.appendChild(span);
            gridContainer.appendChild(button);
            
            button.addEventListener('mousedown', () => {
                if (isEditMode) {
                    openConfigForButton(btnId, pageOfThisButton);
                } else {
                    triggerButtonAction(btnId, pageOfThisButton);
                }
            });

            button.addEventListener('dragover', (e) => { if (isEditMode) e.preventDefault(); });
            button.addEventListener('drop', (e) => {
                e.preventDefault();
                if (isEditMode) {
                    const file = e.dataTransfer.getData('text/plain');
                    buttonState[pageOfThisButton][btnId].file = file;
                    buttonState[pageOfThisButton][btnId].action = "play_sound";
                    
                    if (buttonState[pageOfThisButton][btnId].name === "Empty") {
                        const cleanName = file.replace('.wav', '');
                        buttonState[pageOfThisButton][btnId].name = cleanName;
                    }
                    renderGrid();
                    if (activeConfigId === btnId) openConfigForButton(btnId, pageOfThisButton);
                }
            });
        }
    }
}

document.getElementById('btn-next-page').addEventListener('click', () => {
    if (activePage < 5) {
        activePage++;
        renderGrid();
        if (activeConfigId && isEditMode) openConfigForButton(activeConfigId, activePage);
    }
});

document.getElementById('btn-prev-page').addEventListener('click', () => {
    if (activePage > 1) {
        activePage--;
        renderGrid();
        if (activeConfigId && isEditMode) openConfigForButton(activeConfigId, activePage);
    }
});

// --- 3. FETCH LIBRARY & PROFILES ---
async function fetchLibrary() {
    const res = await fetch('/api/library');
    const data = await res.json();
    
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

    profileSelect.innerHTML = '';
    data.profiles.forEach(prof => {
        const opt = document.createElement('option');
        opt.value = prof;
        opt.innerText = prof;
        if (prof === currentProfile) opt.selected = true;
        profileSelect.appendChild(opt);
    });
}

// --- 4. PROFILE CRUD & XML PARSING ---
async function loadProfile(profileName) {
    document.getElementById('current-profile-name').innerText = profileName.replace('.xml', '');
    currentProfile = profileName;
    
    const res = await fetch('/api/load-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileName })
    });
    const { status, data } = await res.json();
    
    initButtonStates(); 
    
    if (status === 'success' && data.SoundboardProfile.Pages && data.SoundboardProfile.Pages[0].Page) {
        const pages = data.SoundboardProfile.Pages[0].Page;
        pages.forEach(page => {
            const pageIndex = parseInt(page.$.index);
            const buttons = page.Button || [];
            
            buttons.forEach(b => {
                const id = b.$.id;
                if (buttonState[pageIndex] && buttonState[pageIndex][id]) {
                    buttonState[pageIndex][id] = {
                        name: b.Name ? b.Name[0] : "Empty",
                        action: b.Action ? b.Action[0].$.type : "blank",
                        file: (b.Action && b.Action[0].SoundFile) ? b.Action[0].SoundFile[0] : "",
                        bgColor: (b.Appearance && b.Appearance[0].BgColor) ? b.Appearance[0].BgColor[0] : "#2a2d3e",
                        fontColor: (b.Appearance && b.Appearance[0].FontColor) ? b.Appearance[0].FontColor[0] : "#ffffff",
                        displayMode: (b.Appearance && b.Appearance[0].DisplayMode) ? b.Appearance[0].DisplayMode[0] : "text",
                        icon: (b.Appearance && b.Appearance[0].Icon) ? b.Appearance[0].Icon[0] : "🔥",
                        midiNote: (b.MidiMapping && b.MidiMapping[0].Note) ? b.MidiMapping[0].Note[0] : ""
                    };
                }
            });
        });
    }
    renderGrid();
}

profileSelect.addEventListener('change', (e) => loadProfile(e.target.value));

document.getElementById('btn-new-profile').addEventListener('click', async () => {
    let name = prompt("Enter new profile name (without .xml):");
    if (!name) return;
    name = name.trim() + '.xml';
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
    const pagesArray = [];
    for (let p = 1; p <= 5; p++) {
        const pageButtons = [];
        Object.keys(buttonState[p]).forEach(id => {
            const data = buttonState[p][id];
            pageButtons.push({
                $: { id: id },
                Name: data.name,
                Action: { $: { type: data.action }, SoundFile: data.file },
                Appearance: { 
                    BgColor: data.bgColor, 
                    FontColor: data.fontColor,
                    DisplayMode: data.displayMode,
                    Icon: data.icon
                },
                MidiMapping: { Note: data.midiNote }
            });
        });
        pagesArray.push({ $: { index: p.toString() }, Button: pageButtons });
    }

    const profileData = {
        SoundboardProfile: {
            $: { name: profileName.replace('.xml', ''), is_readonly: profileName === 'default.xml' ? "true" : "false" },
            Pages: { Page: pagesArray }
        }
    };
    
    await fetch('/api/save-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileName, data: profileData })
    });
}

// --- 5. AUDIO FILES CRUD ---
document.getElementById('btn-upload-sound').addEventListener('click', () => document.getElementById('file-upload-input').click());
document.getElementById('file-upload-input').addEventListener('change', (e) => {
    if (!e.target.files.length) return;
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    
    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress-bar');
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);
    xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) progressBar.style.width = ((event.loaded / event.total) * 100) + '%';
    };
    xhr.onload = () => {
        if (xhr.status === 200) fetchLibrary();
        setTimeout(() => { progressContainer.style.display = 'none'; e.target.value = ''; }, 500);
    };
    xhr.send(formData);
});

async function deleteAudio(filename) {
    if (!confirm(`Delete sound ${filename}?`)) return;
    await fetch('/api/delete-sound', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename }) });
    fetchLibrary();
}

async function renameAudio(oldName) {
    let newName = prompt("Enter new filename:", oldName);
    if (!newName || newName === oldName) return;
    await fetch('/api/rename-sound', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldName, newName }) });
    fetchLibrary();
}

// --- 6. PLAYBACK ENGINE ---
async function preloadAudio(fileName) {
    if (audioBuffers[fileName]) return;
    try {
        const res = await fetch(`/assets/sounds/${fileName}`);
        audioBuffers[fileName] = await audioCtx.decodeAudioData(await res.arrayBuffer());
    } catch (e) {}
}

function playAudio(fileName) {
    if (!audioBuffers[fileName]) { preloadAudio(fileName).then(() => playAudio(fileName)); return; }
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

function triggerButtonAction(id, page = activePage) {
    const btn = document.getElementById(`btn_${id}`);
    const data = buttonState[page][id];
    btn.classList.add('is-playing');
    setTimeout(() => btn.classList.remove('is-playing'), 250);

    if (data.action === "play_sound" && data.file) playAudio(data.file);
    else if (data.action === "stop_all") stopAllAudio();
    else if (data.action === "next_page" && activePage < 5) { activePage++; renderGrid(); }
    else if (data.action === "prev_page" && activePage > 1) { activePage--; renderGrid(); }
}

// --- 7. EDIT MODE & BINDINGS ---
function openConfigForButton(id, page = activePage) {
    activeConfigId = id;
    document.querySelectorAll('.sound-btn').forEach(b => b.style.borderColor = '');
    document.getElementById(`btn_${id}`).style.borderColor = '#00ff88';
    
    const data = buttonState[page][id];
    document.getElementById('selected-btn-id').innerText = `(P${page} - ${id})`;
    document.getElementById('input-btn-name').value = data.name === "Empty" ? "" : data.name;
    document.getElementById('select-action-type').value = data.action;
    document.getElementById('input-sound-file').value = data.file;
    document.getElementById('select-display-mode').value = data.displayMode || "text";
    document.getElementById('select-stock-icon').value = data.icon || "🔥";
    
    // Tampilkan/Sembunyikan Picker Icon
    const iconContainer = document.getElementById('icon-picker-container');
    iconContainer.style.display = data.displayMode === "icon" ? "block" : "none";

    // Set Colors
    document.getElementById('input-bg-color').value = data.bgColor || "#2a2d3e";
    document.getElementById('input-bg-hex').value = data.bgColor || "#2a2d3e";
    document.getElementById('input-font-color').value = data.fontColor || "#ffffff";
    document.getElementById('input-font-hex').value = data.fontColor || "#ffffff";
    document.getElementById('input-midi').value = data.midiNote || "";
}

// Real-time Inputs
document.getElementById('input-btn-name').addEventListener('input', (e) => {
    if (!activeConfigId) return;
    const val = e.target.value || "Empty";
    buttonState[activePage][activeConfigId].name = val;
    if (buttonState[activePage][activeConfigId].displayMode === "text") {
        document.getElementById(`text_${activeConfigId}`).innerText = val;
    }
});

document.getElementById('select-action-type').addEventListener('change', (e) => {
    if (activeConfigId) buttonState[activePage][activeConfigId].action = e.target.value;
});

document.getElementById('select-display-mode').addEventListener('change', (e) => {
    if (!activeConfigId) return;
    const mode = e.target.value;
    buttonState[activePage][activeConfigId].displayMode = mode;
    
    const iconContainer = document.getElementById('icon-picker-container');
    iconContainer.style.display = mode === "icon" ? "block" : "none";
    
    const span = document.getElementById(`text_${activeConfigId}`);
    if (mode === "icon") {
        const icon = buttonState[activePage][activeConfigId].icon || "🔥";
        span.innerText = icon;
        span.style.fontSize = "28px";
    } else {
        const name = buttonState[activePage][activeConfigId].name;
        span.innerText = name === "Empty" ? "Empty" : name;
        span.style.fontSize = "";
    }
});

document.getElementById('select-stock-icon').addEventListener('change', (e) => {
    if (!activeConfigId) return;
    const icon = e.target.value;
    buttonState[activePage][activeConfigId].icon = icon;
    if (buttonState[activePage][activeConfigId].displayMode === "icon") {
        document.getElementById(`text_${activeConfigId}`).innerText = icon;
    }
});

// Background Color Synchronizer (Picker <-> Hex Input)
document.getElementById('input-bg-color').addEventListener('input', (e) => {
    if (!activeConfigId) return;
    const val = e.target.value;
    document.getElementById('input-bg-hex').value = val;
    buttonState[activePage][activeConfigId].bgColor = val;
    document.getElementById(`btn_${activeConfigId}`).style.background = val;
});
document.getElementById('input-bg-hex').addEventListener('input', (e) => {
    if (!activeConfigId) return;
    const val = e.target.value;
    document.getElementById('input-bg-color').value = val;
    buttonState[activePage][activeConfigId].bgColor = val;
    document.getElementById(`btn_${activeConfigId}`).style.background = val;
});

// Font Color Synchronizer (Picker <-> Hex Input)
document.getElementById('input-font-color').addEventListener('input', (e) => {
    if (!activeConfigId) return;
    const val = e.target.value;
    document.getElementById('input-font-hex').value = val;
    buttonState[activePage][activeConfigId].fontColor = val;
    document.getElementById(`btn_${activeConfigId}`).style.color = val;
});
document.getElementById('input-font-hex').addEventListener('input', (e) => {
    if (!activeConfigId) return;
    const val = e.target.value;
    document.getElementById('input-font-color').value = val;
    buttonState[activePage][activeConfigId].fontColor = val;
    document.getElementById(`btn_${activeConfigId}`).style.color = val;
});

// Clear Buttons
document.getElementById('btn-clear-sound').addEventListener('click', () => {
    if (!activeConfigId) return;
    buttonState[activePage][activeConfigId].file = "";
    buttonState[activePage][activeConfigId].action = "blank";
    document.getElementById('input-sound-file').value = "";
    document.getElementById('select-action-type').value = "blank";
});

document.getElementById('btn-clear-midi').addEventListener('click', () => {
    if (!activeConfigId) return;
    buttonState[activePage][activeConfigId].midiNote = "";
    document.getElementById('input-midi').value = "";
});

// Drag & Drop
const dropZone = document.getElementById('input-sound-file');
dropZone.addEventListener('dragover', e => e.preventDefault());
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    if (activeConfigId) {
        const file = e.dataTransfer.getData('text/plain');
        dropZone.value = file;
        buttonState[activePage][activeConfigId].file = file;
        buttonState[activePage][activeConfigId].action = "play_sound";
        document.getElementById('select-action-type').value = "play_sound";
        
        if (buttonState[activePage][activeConfigId].name === "Empty") {
            const cleanName = file.replace('.wav', '');
            buttonState[activePage][activeConfigId].name = cleanName;
            document.getElementById('input-btn-name').value = cleanName;
            if (buttonState[activePage][activeConfigId].displayMode === "text") {
                document.getElementById(`text_${activeConfigId}`).innerText = cleanName;
            }
        }
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
        renderGrid();
    }
});

// Boot
initApp();