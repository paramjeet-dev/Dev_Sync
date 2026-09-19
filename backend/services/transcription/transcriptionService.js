const fs = require('fs');
const OpenAI = require('openai');
const config = require('../../config/env');

let client = null;
function getClient() {
  if (!config.openaiApiKey) {
    const err = new Error('Transcription is not configured (missing OPENAI_API_KEY).');
    err.statusCode = 503;
    throw err;
  }
  if (!client) {
    client = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return client;
}

/**
 * Forwards an audio file (already saved to disk by multer) to the Whisper API
 * and returns a normalized transcript response. The OpenAI API key never
 * leaves the server.
 */
async function transcribeAudioFile(filePath, { language } = {}) {
  const openai = getClient();

  try {
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
      language: language || undefined,
      response_format: 'json',
    });

    return {
      text: response.text || '',
      language: language || null,
    };
  } catch (err) {
    const wrapped = new Error(
      err?.response?.data?.error?.message || err.message || 'Transcription failed.'
    );
    wrapped.statusCode = err?.status || 502;
    throw wrapped;
  } finally {
    // Clean up the temporary audio file regardless of success/failure.
    fs.unlink(filePath, () => {});
  }
}

module.exports = { transcribeAudioFile };
