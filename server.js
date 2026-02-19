// server.js - Node.js ID Card Generator with Cloudinary
const express = require('express');
const multer = require('multer');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Parse Cloudinary URL if provided
function parseCloudinaryUrl(url) {
    if (!url) {
        return {};
    }
    if (url === '') {
        console.warn('CLOUDINARY_URL is set but empty');
        return {};
    }
    if (!url.startsWith('cloudinary://')) {
        console.warn('CLOUDINARY_URL has invalid format, expected: cloudinary://api_key:api_secret@cloud_name');
        return {};
    }
    try {
        // Format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
        const urlObj = new URL(url);
        return {
            cloud_name: urlObj.hostname,
            api_key: urlObj.username,
            api_secret: urlObj.password
        };
    } catch (error) {
        console.error('Failed to parse CLOUDINARY_URL:', error.message);
        return {};
    }
}

// Configure Cloudinary
const cloudinaryUrlConfig = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || cloudinaryUrlConfig.cloud_name,
  api_key: process.env.CLOUDINARY_API_KEY || cloudinaryUrlConfig.api_key,
  api_secret: process.env.CLOUDINARY_API_SECRET || cloudinaryUrlConfig.api_secret
});

// Configuration
const TEMPLATES_FOLDER = path.join(__dirname, 'static');

// Constants (matching your Python version)
const CM_TO_PX = 300 / 2.54;
const CARD_WIDTH = 1012;
const CARD_HEIGHT = 638;
const QR_SIZE = { width: 150, height: 150 };
const QR_POSITION = { x: 470, y: 419 };
const PHOTO_SIZE = { width: 280, height: 280 };
const PHOTO_POSITION = { x: 640, y: 280 };
const DPI = 300;

// Font registration - tries multiple paths
const fontPaths = [
    path.join(__dirname, 'fonts', 'arialbd.ttf'),
    path.join(__dirname, 'fonts', 'Arial-Bold.ttf'),
    'C:\\Windows\\Fonts\\arialbd.ttf',  // Windows
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',  // Mac
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'  // Linux
];

let fontLoaded = false;
for (const fontPath of fontPaths) {
    try {
        if (fsSync.existsSync(fontPath)) {
            GlobalFonts.registerFromPath(fontPath, 'ArialBold');
            console.log(`✓ Font loaded from: ${fontPath}`);
            fontLoaded = true;
            break;
        }
    } catch (err) {
        console.log(`Failed to load font from ${fontPath}`);
    }
}

if (!fontLoaded) {
    console.warn('⚠ No custom font loaded. Using system default.');
}

// Multer configuration - use memory storage for direct Cloudinary upload
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 16 * 1024 * 1024 }, // 16MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files (PNG, JPG, JPEG, GIF) are allowed'));
    }
});

// Middleware
app.use(express.static('static'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Helper functions
function ptToPx(pt) {
    return Math.max(1, Math.round(pt * DPI / 72.0));
}

function validateFormInput(data) {
    const required = ['name', 'reg', 'dept', 'faculty', 'gender', 'expiry'];
    
    for (const field of required) {
        if (!data[field] || !data[field].trim()) {
            return { valid: false, error: `Missing field: ${field}` };
        }
    }
    
    if (data.name.length > 100) {
        return { valid: false, error: 'Name too long (max 100 characters)' };
    }
    
    if (data.reg.length > 50) {
        return { valid: false, error: 'Registration number too long (max 50 characters)' };
    }
    
    if (!/^[A-Za-z0-9 ._/-]+$/.test(data.reg)) {
        return { valid: false, error: 'Invalid characters in registration number' };
    }
    
    return { valid: true };
}

async function generateQRCode(data) {
    const qrText = `Name: ${data.name}\nReg: ${data.reg}\nDept: ${data.dept}`;
    return await QRCode.toBuffer(qrText, {
        width: QR_SIZE.width,
        margin: 1
    });
}

async function generateIDCard(formData, photoUrl) {
    const { name, reg, dept, faculty, gender, expiry } = formData;
    
    // Sanitize reg number for filenames
    const safeReg = reg.replace(/[^a-z0-9_-]/gi, '_');
    
    // Generate QR code buffer
    const qrBuffer = await generateQRCode({ name, reg, dept });
    
    // Load templates
    const frontTemplatePath = path.join(TEMPLATES_FOLDER, 'front_template.png');
    const backTemplatePath = path.join(TEMPLATES_FOLDER, 'back_template.png');
    
    // Check if templates exist
    if (!fsSync.existsSync(frontTemplatePath)) {
        throw new Error(`Front template not found at: ${frontTemplatePath}`);
    }
    if (!fsSync.existsSync(backTemplatePath)) {
        throw new Error(`Back template not found at: ${backTemplatePath}`);
    }
    
    // Create front card
    const frontCanvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
    const frontCtx = frontCanvas.getContext('2d');
    
    const frontTemplate = await loadImage(frontTemplatePath);
    frontCtx.drawImage(frontTemplate, 0, 0, CARD_WIDTH, CARD_HEIGHT);
    
    // Add QR code from buffer
    const qrImage = await loadImage(qrBuffer);
    frontCtx.drawImage(qrImage, QR_POSITION.x, QR_POSITION.y, QR_SIZE.width, QR_SIZE.height);
    
    // Add photo from Cloudinary URL
    const photoImage = await loadImage(photoUrl);
    frontCtx.drawImage(photoImage, PHOTO_POSITION.x, PHOTO_POSITION.y, PHOTO_SIZE.width, PHOTO_SIZE.height);
    
    // Generate front card buffer
    const frontBuffer = frontCanvas.toBuffer('image/png');
    
    // Upload front card to Cloudinary
    const frontUploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'futo-id-cards/generated',
                public_id: `futo_${safeReg}_front`,
                resource_type: 'image'
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        uploadStream.end(frontBuffer);
    });
    
    // Create back card
    const backCanvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
    const backCtx = backCanvas.getContext('2d');
    
    const backTemplate = await loadImage(backTemplatePath);
    backCtx.drawImage(backTemplate, 0, 0, CARD_WIDTH, CARD_HEIGHT);
    
    // Set font and color
    backCtx.fillStyle = '#000000';
    
    // Name
    backCtx.font = `${ptToPx(7)}px ${fontLoaded ? 'ArialBold' : 'Arial, sans-serif'}`;
    backCtx.fillText(name.toUpperCase(), 0.74 * CM_TO_PX, 0.60 * CM_TO_PX + ptToPx(7));
    
    // Faculty, Dept, Reg, Gender
    backCtx.font = `${ptToPx(4.319)}px ${fontLoaded ? 'ArialBold' : 'Arial, sans-serif'}`;
    const blockX = 1.81 * CM_TO_PX;
    backCtx.fillText(faculty, blockX, 1.03 * CM_TO_PX + ptToPx(4.319));
    backCtx.fillText(dept, blockX, 1.38 * CM_TO_PX + ptToPx(4.319));
    backCtx.fillText(reg, blockX, 1.73 * CM_TO_PX + ptToPx(4.319));
    backCtx.fillText(gender, blockX, 2.08 * CM_TO_PX + ptToPx(4.319));
    
    // Expiry
    backCtx.font = `${ptToPx(6)}px ${fontLoaded ? 'ArialBold' : 'Arial, sans-serif'}`;
    const expX = 0.74 * CM_TO_PX;
    backCtx.fillText('EXPIRY', expX, 3.87 * CM_TO_PX + ptToPx(6));
    backCtx.fillText(expiry, expX, 4.17 * CM_TO_PX + ptToPx(6));
    
    // Generate back card buffer
    const backBuffer = backCanvas.toBuffer('image/png');
    
    // Upload back card to Cloudinary
    const backUploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'futo-id-cards/generated',
                public_id: `futo_${safeReg}_back`,
                resource_type: 'image'
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        uploadStream.end(backBuffer);
    });
    
    console.log(`✓ Generated ID card for: ${reg}`);
    return { 
        frontUrl: frontUploadResult.secure_url, 
        backUrl: backUploadResult.secure_url 
    };
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/generate', upload.single('photo'), async (req, res) => {
    try {
        // Validate form input
        const validation = validateFormInput(req.body);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }
        
        // Check if photo was uploaded
        if (!req.file) {
            return res.status(400).json({ error: 'No photo uploaded' });
        }
        
        // Upload photo to Cloudinary directly from memory buffer
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'futo-id-cards/uploads',
                    transformation: [{ width: 280, height: 280, crop: 'fill' }],
                    resource_type: 'image'
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            uploadStream.end(req.file.buffer);
        });
        
        const photoUrl = uploadResult.secure_url;
        const { frontUrl, backUrl } = await generateIDCard(req.body, photoUrl);
        
        // Return JSON with Cloudinary URLs
        res.json({ success: true, frontUrl, backUrl });
        
    } catch (error) {
        console.error('Error generating ID card:', error);
        res.status(500).json({ error: `Error: ${error.message}` });
    }
});

// Error handlers
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'File too large (max 16MB)' });
        }
    }
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    const cloudinaryConfig = cloudinary.config();
    const isCloudinaryConfigured = cloudinaryConfig.cloud_name && cloudinaryConfig.api_key && cloudinaryConfig.api_secret;
    
    console.log('═══════════════════════════════════════════════════');
    console.log('🎉 FUTO ID Card Generator (Node.js + Cloudinary)');
    console.log(`📍 Open your browser: http://localhost:${PORT}`);
    console.log('═══════════════════════════════════════════════════');
    console.log(`✓ Cloudinary: ${isCloudinaryConfigured ? 'Configured' : 'Not configured'}`);
    console.log(`✓ Font loaded: ${fontLoaded ? 'Yes' : 'No (using default)'}`);
    console.log('═══════════════════════════════════════════════════');
});

// Export for Vercel serverless
module.exports = app;