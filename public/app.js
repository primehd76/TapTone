console.log("[TapTone] Dashboard Initialized.");

// Check connection to the backend server
fetch('/api/status')
    .then(response => response.json())
    .then(data => {
        console.log("[TapTone] Server Status:", data);
    })
    .catch(err => console.error("[TapTone] Server disconnected:", err));

// Select the grid container
const gridContainer = document.getElementById('sound-grid');

// Function to generate the 5x3 Grid dynamically
function generateGrid() {
    gridContainer.innerHTML = ''; // Clear existing layout
    
    // Loop for 3 rows and 5 columns (15 buttons total)
    for (let row = 1; row <= 3; row++) {
        for (let col = 1; col <= 5; col++) {
            const btnId = `${row}_${col}`;
            
            const button = document.createElement('button');
            button.className = 'sound-btn';
            button.dataset.id = btnId;
            
            // Default text for empty slot
            const span = document.createElement('span');
            span.className = 'btn-text';
            span.innerText = `Empty`; 
            
            button.appendChild(span);
            gridContainer.appendChild(button);
            
            // Temporary click event for UI testing (visual feedback)
            button.addEventListener('mousedown', () => {
                button.classList.add('is-playing');
                // Simulate audio playing duration (200ms)
                setTimeout(() => button.classList.remove('is-playing'), 200); 
            });
        }
    }
}

// Initialize the User Interface
generateGrid();