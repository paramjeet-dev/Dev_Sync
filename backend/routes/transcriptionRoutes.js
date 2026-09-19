const express = require('express');
const { transcribe } = require('../controllers/transcriptionController');
const { requireAuth } = require('../middleware/requireAuth');
const uploadAudio = require('../middleware/uploadAudio');

const router = express.Router();

router.post('/', requireAuth, uploadAudio.single('audio'), transcribe);

module.exports = router;
