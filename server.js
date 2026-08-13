const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Builder, parseStringPromise } = require('xml2js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// --- MULTER SETUP (UPLOAD) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'assets/sounds/'),
    filename: (req, file, cb) => {
        let fileName = file.originalname;
        let ext = path.extname(fileName);
        let baseName = path.basename(fileName, ext);
        let counter = 1;
        while (fs.existsSync(path.join(__dirname, 'assets/sounds/', fileName))) {
            fileName = `${baseName} (${counter})${ext}`;
            counter++;
        }
        cb(null, fileName);
    }
});
const upload = multer({ storage: storage });

// --- API AUDIO FILES ---
app.get('/api/library', (req, res) => {
    const sounds = fs.existsSync('assets/sounds') ? fs.readdirSync('assets/sounds').filter(f => f.endsWith('.wav')) : [];
    const profiles = fs.existsSync('data/profiles') ? fs.readdirSync('data/profiles').filter(f => f.endsWith('.xml')) : [];
    res.json({ sounds, profiles });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    res.json({ status: 'success', filename: req.file.filename });
});

app.post('/api/delete-sound', (req, res) => {
    const filePath = path.join(__dirname, 'assets/sounds', req.body.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ status: 'success' });
});

app.post('/api/rename-sound', (req, res) => {
    const oldPath = path.join(__dirname, 'assets/sounds', req.body.oldName);
    let newName = req.body.newName.endsWith('.wav') ? req.body.newName : `${req.body.newName}.wav`;
    const newPath = path.join(__dirname, 'assets/sounds', newName);
    if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
    res.json({ status: 'success' });
});

// --- API PROFILES (XML) ---
app.post('/api/load-profile', async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'data/profiles', req.body.profileName);
        if (!fs.existsSync(filePath)) return res.json({ error: "Profile not found" });
        const xmlData = fs.readFileSync(filePath, 'utf-8');
        const result = await parseStringPromise(xmlData);
        res.json({ status: 'success', data: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/save-profile', (req, res) => {
    const builder = new Builder();
    const xml = builder.buildObject(req.body.data);
    fs.writeFileSync(path.join(__dirname, 'data/profiles', req.body.profileName), xml);
    res.json({ status: 'success' });
});

app.post('/api/delete-profile', (req, res) => {
    const filePath = path.join(__dirname, 'data/profiles', req.body.profileName);
    if (fs.existsSync(filePath) && req.body.profileName !== 'default.xml') fs.unlinkSync(filePath);
    res.json({ status: 'success' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TapTone] Server is running on http://0.0.0.0:${PORT}`);
});