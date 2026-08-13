console.log("[TapTone] Dashboard Initialized.");

const gridContainer = document.getElementById('sound-grid');
const btnSettings = document.getElementById('btn-settings');
const selectedBtnLabel = document.getElementById('selected-btn-id');
let isEditMode = false;

// 1. Generate 5x3 Square Grid
function generateGrid() {
    gridContainer.innerHTML = ''; 
    for (let row = 1; row <= 3; row++) {
        for (let col = 1; col <= 5; col++) {
            const btnId = `${row}_${col}`;
            
            const button = document.createElement('button');
            button.className = 'sound-btn';
            button.dataset.id = btnId;
            
            const span = document.createElement('span');
            span.className = 'btn-text';
            span.innerText = `Empty`; 
            
            button.appendChild(span);
            gridContainer.appendChild(button);
            
            // Event Listener untuk Tombol
            button.addEventListener('mousedown', () => {
                if (isEditMode) {
                    // Jika mode edit, klik tombol tidak membunyikan suara, tapi membuka config
                    document.querySelectorAll('.sound-btn').forEach(b => b.style.borderColor = '');
                    button.style.borderColor = '#00ff88'; // Highlight tombol yang sedang diedit
                    selectedBtnLabel.innerText = `(${btnId})`;
                } else {
                    // Jika play mode, jalankan animasi suara
                    button.classList.add('is-playing');
                    setTimeout(() => button.classList.remove('is-playing'), 200); 
                }
            });
        }
    }
}

// 2. Toggle Edit Mode
btnSettings.addEventListener('click', () => {
    isEditMode = !isEditMode;
    
    if (isEditMode) {
        document.body.classList.add('edit-mode');
        btnSettings.innerText = "💾 Exit & Save";
        // Reset pilihan tombol
        document.querySelectorAll('.sound-btn').forEach(b => b.style.borderColor = '');
        selectedBtnLabel.innerText = `(None)`;
    } else {
        document.body.classList.remove('edit-mode');
        btnSettings.innerText = "⚙️ Edit Settings";
        document.querySelectorAll('.sound-btn').forEach(b => b.style.borderColor = '');
    }
});

// Initialize
generateGrid();