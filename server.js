const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Builder, parseString } = require('xml2js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// --- MULTER SETUP FOR FILE UPLOADS ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) cb(null, 'assets/sounds/');
        else if (file.mimetype.startsWith('image/')) cb(null, 'assets/images/');
        else cb(new Error('Invalid file type'));
    },
    filename: (req, file, cb) => {
        // Handle auto-rename (1), (2) etc logic here if file exists
        let fileName = file.originalname;
        let ext = path.extname(fileName);
        let baseName = path.basename(fileName, ext);
        let counter = 1;
        
        const folder = file.mimetype.startsWith('audio/') ? 'assets/sounds/' : 'assets/images/';
        while (fs.existsSync(path.join(__dirname, folder, fileName))) {
            fileName = `${baseName} (${counter})${ext}`;
            counter++;
        }
        cb(null, fileName);
    }
});
const upload = multer({ storage: storage });

// --- API ROUTES ---

// 1. Get List of Profiles & Sounds
app.get('/api/library', (req, res) => {
    const sounds = fs.readdirSync(path.join(__dirname, 'assets/sounds')).filter(f => f.endsWith('.wav'));
    const profiles = fs.readdirSync(path.join(__dirname, 'data/profiles')).filter(f => f.endsWith('.xml'));
    res.json({ sounds, profiles });
});

// 2. Save Profile (JSON to XML)
app.post('/api/save-profile', (req, res) => {
    const { profileName, data } = req.body;
    const builder = new Builder();
    const xml = builder.buildObject(data);
    
    fs.writeFileSync(path.join(__dirname, 'data/profiles', profileName), xml);
    res.json({ status: 'success', message: 'Profile saved as XML' });
});

// 3. Upload File
app.post('/api/upload', upload.single('file'), (req, res) => {
    res.json({ status: 'success', filename: req.file.filename });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TapTone] Server is running on http://0.0.0.0:${PORT}`);
});