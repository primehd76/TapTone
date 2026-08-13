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

// --- ENSURE DIRS & DEFAULT XML EXIST ---
const soundDir = path.join(__dirname, 'assets/sounds');
const profileDir = path.join(__dirname, 'data/profiles');

if (!fs.existsSync(soundDir)) fs.mkdirSync(soundDir, { recursive: true });
if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

// Auto-generate default.xml if missing
if (!fs.existsSync(path.join(profileDir, 'default.xml'))) {
    const builder = new Builder();
    const emptyProfile = {
        SoundboardProfile: { $: { name: "default", is_readonly: "true" }, Pages: { Page: [] } }
    };
    for(let i=1; i<=5; i++) emptyProfile.SoundboardProfile.Pages.Page.push({ $: { index: i.toString() }, Button: [] });
    fs.writeFileSync(path.join(profileDir, 'default.xml'), builder.buildObject(emptyProfile));
}

// --- MULTER SETUP (UPLOAD) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, soundDir),
    filename: (req, file, cb) => {
        let fileName = file.originalname;
        let ext = path.extname(fileName);
        let baseName = path.basename(fileName, ext);
        let counter = 1;
        while (fs.existsSync(path.join(soundDir, fileName))) {
            fileName = `${baseName} (${counter})${ext}`;
            counter++;
        }
        cb(null, fileName);
    }
});
const upload = multer({ storage: storage });

// --- API AUDIO FILES ---
app.get('/api/library', (req, res) => {
    const sounds = fs.readdirSync(soundDir).filter(f => f.endsWith('.wav'));
    const profiles = fs.readdirSync(profileDir).filter(f => f.endsWith('.xml'));
    res.json({ sounds, profiles });
});
app.post('/api/upload', upload.single('file'), (req, res) => res.json({ status: 'success' }));
app.post('/api/delete-sound', (req, res) => {
    const filePath = path.join(soundDir, req.body.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ status: 'success' });
});
app.post('/api/rename-sound', (req, res) => {
    const oldPath = path.join(soundDir, req.body.oldName);
    let newName = req.body.newName.endsWith('.wav') ? req.body.newName : `${req.body.newName}.wav`;
    const newPath = path.join(soundDir, newName);
    if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
    res.json({ status: 'success' });
});

// --- API PROFILES (XML) ---
app.post('/api/load-profile', async (req, res) => {
    try {
        const filePath = path.join(profileDir, req.body.profileName);
        if (!fs.existsSync(filePath)) return res.json({ error: "Profile not found" });
        const result = await parseStringPromise(fs.readFileSync(filePath, 'utf-8'));
        res.json({ status: 'success', data: result });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/save-profile', (req, res) => {
    // BLOCK OVERWRITE OF DEFAULT.XML
    if (req.body.profileName === 'default.xml') {
        return res.json({ status: 'error', message: 'Cannot overwrite default profile' });
    }
    const builder = new Builder();
    const xml = builder.buildObject(req.body.data);
    fs.writeFileSync(path.join(profileDir, req.body.profileName), xml);
    res.json({ status: 'success' });
});

app.post('/api/rename-profile', (req, res) => {
    if (req.body.oldName === 'default.xml') return res.json({ status: 'error' });
    const oldPath = path.join(profileDir, req.body.oldName);
    let newName = req.body.newName.endsWith('.xml') ? req.body.newName : `${req.body.newName}.xml`;
    const newPath = path.join(profileDir, newName);
    if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
    res.json({ status: 'success' });
});

app.post('/api/delete-profile', (req, res) => {
    const filePath = path.join(profileDir, req.body.profileName);
    if (fs.existsSync(filePath) && req.body.profileName !== 'default.xml') fs.unlinkSync(filePath);
    res.json({ status: 'success' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`[TapTone] Server running on port ${PORT}`));