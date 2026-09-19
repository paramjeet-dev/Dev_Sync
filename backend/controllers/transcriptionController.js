const { transcribeAudioFile } = require('../services/transcription/transcriptionService');

async function transcribe(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided.' });
    }

    const { language } = req.body;
    const result = await transcribeAudioFile(req.file.path, { language });

    res.status(200).json({
      text: result.text,
      language: result.language,
      sizeBytes: req.file.size,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { transcribe };
