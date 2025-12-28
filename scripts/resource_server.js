
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3001;
const STORAGE_ROOT = '/var/www';

// Enable CORS for frontend access
app.use(cors());

// Ensure directories exist
['music', 'images', 'animations'].forEach(dir => {
    const fullPath = path.join(STORAGE_ROOT, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }
});

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const type = (req.body.type || 'misc').trim(); // music, images, animations
        const allowedTypes = ['music', 'images', 'animations'];

        // Sanitize type to prevents path traversal
        const targetDir = allowedTypes.includes(type) ? type : 'misc';
        const uploadPath = path.join(STORAGE_ROOT, targetDir);

        // Ensure dir exists (just in case)
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Keep original name but sanitize
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const uniqueName = `${Date.now()}-${safeName}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Upload Endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const type = (req.body.type || 'misc').trim();
    // Construct public URL using the Nginx reverse-proxy or direct file access
    // Domain: 46.62.209.244.nip.io
    const publicUrl = `https://46.62.209.244.nip.io/${type}/${req.file.filename}`;

    console.log(`[Upload] Saved ${req.file.filename} to ${type}`);

    res.json({
        success: true,
        url: publicUrl,
        filename: req.file.filename,
        path: req.file.path // Internal path for worker if needed
    });
});

app.listen(PORT, () => {
    console.log(`Upload Server running on port ${PORT}`);
});
