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
                    bgColor: "#2a2d3e" 
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
            
            const span = document.createElement('span');
            span.className = 'btn-text';
            span.id = `text_${btnId}`;
            span.innerText = data.name === "Empty" ? "Empty" : data.name; 
            
            button.appendChild(span);
            gridContainer.appendChild(button);
            
            // Mouse click handler
            button.addEventListener('mousedown', () => {
                if (isEditMode) {
                    openConfigForButton(btnId, pageOfThisButton);
                } else {
                    triggerButtonAction(btnId, pageOfThisButton);
                }
            });

            // Drag & Drop handler directly to grid button
            button.addEventListener('dragover', (e) => {
                if (isEditMode) e.preventDefault();
            });

            button.addEventListener('drop', (e) => {
                e.preventDefault();
                if (isEditMode) {
                    const file = e.dataTransfer.getData('text/plain');
                    buttonState[pageOfThisButton][btnId].file = file;
                    buttonState[pageOfThisButton][btnId].action = "play_sound";
                    
                    if (buttonState[pageOfThisButton][btnId].name === "Empty") {
                        buttonState[pageOfThisButton][btnId].name = file.replace('.wav', '');
                    }
                    
                    renderGrid();
                    if (activeConfigId === btnId) {
                        openConfigForButton(btnId, pageOfThisButton);
                    }
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

// --- 4. PROFILE CRUD & 5-PAGE XML PARSING ---
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
                Appearance: { BgColor: data.bgColor },
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

// --- 6. PLAYBACK ENGINE (ZERO-LATENCY WEB AUDIO API) ---
async function preloadAudio(fileName) {
    if (audioBuffers[fileName]) return;
    try {
        const res = await fetch(`/assets/sounds/${fileName}`);
        const arrayBuffer = await res.arrayBuffer();
        audioBuffers[fileName] = await audioCtx.decodeAudioData(arrayBuffer);
    } catch (e) { 
        console.warn(`Skipping audio: ${fileName}`); 
    }
}

function playAudio(fileName) {
    if (!audioBuffers[fileName]) {
        preloadAudio(fileName).then(() => playAudio(fileName));
        return;
    }
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffers[fileName];
    source.connect(audioCtx.destination);
    source.start(0);
    
    playingSources.push(source);
    source.onended = () => {
        playingSources = playingSources.filter(s => s !== source);
    };
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

    if (data.action === "play_sound" && data.file) {
        playAudio(data.file);
    } else if (data.action === "stop_all") {
        stopAllAudio();
    } else if (data.action === "next_page" && activePage < 5) { 
        activePage++; 
        renderGrid(); 
    } else if (data.action === "prev_page" && activePage > 1) { 
        activePage--; 
        renderGrid(); 
    }
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
    document.getElementById('input-bg-color').value = data.bgColor;
}

document.getElementById('input-btn-name').addEventListener('input', (e) => {
    if (!activeConfigId) return;
    const val = e.target.value || "Empty";
    buttonState[activePage][activeConfigId].name = val;
    document.getElementById(`text_${activeConfigId}`).innerText = val;
});

document.getElementById('select-action-type').addEventListener('change', (e) => {
    if (activeConfigId) buttonState[activePage][activeConfigId].action = e.target.value;
});

document.getElementById('input-bg-color').addEventListener('input', (e) => {
    if (!activeConfigId) return;
    buttonState[activePage][activeConfigId].bgColor = e.target.value;
    document.getElementById(`btn_${activeConfigId}`).style.background = e.target.value;
});

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
            document.getElementById(`text_${activeConfigId}`).innerText = cleanName;
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