const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON requests from the frontend
app.use(express.json());

// Serve the Frontend UI (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Serve the Assets folder (allows the browser to load .wav and .png files)
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Basic API Endpoint to check server health
app.get('/api/status', (req, res) => {
    res.json({ 
        app: 'TapTone', 
        status: 'Running', 
        latency: 'Zero Latency Mode Ready' 
    });
});

// Start the server on all network interfaces to allow external access
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TapTone] Server is running on http://0.0.0.0:${PORT}`);
});