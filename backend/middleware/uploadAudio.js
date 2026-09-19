const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../config/env');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'tmp');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set([
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/ogg',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `audio-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error(`Unsupported audio type: ${file.mimetype}`));
  }
  cb(null, true);
}

const uploadAudio = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.maxAudioSizeMb * 1024 * 1024 },
});

module.exports = uploadAudio;
