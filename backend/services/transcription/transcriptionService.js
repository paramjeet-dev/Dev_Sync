const fs = require('fs');
const OpenAI = require('openai');
const config = require('../../config/env');

let client = null;

function publicError(statusCode, publicMessage) {
  const e = new Error(publicMessage);
  e.statusCode = statusCode;
  e.publicMessage = publicMessage;
  return e;
}

function getClient() {
  if (!config.openaiApiKey) {
    // eslint-disable-next-line no-console
    console.error('[transcription] OPENAI_API_KEY is not configured.');
    throw publicError(503, 'Voice transcription is currently unavailable.');
  }
  if (!client) client = new OpenAI({ apiKey: config.openaiApiKey });
  return client;
}

function toPublicError(err) {
  // Log the real cause server-side; never forward provider text or status codes.
  // eslint-disable-next-line no-console
  console.error('[transcription] OpenAI error:', err?.status, err?.message);
  switch (err?.status) {
    case 429:
      return publicError(429, 'Transcription is busy right now. Please try again in a moment.');
    case 400:
    case 413:
    case 415:
      return publicError(400, "We couldn't process that recording. Please try recording again.");
    default:
      return publicError(503, 'Voice transcription is currently unavailable.');
  }
}

/**
 * Forwards an audio file (already saved by multer) to Whisper and returns a
 * normalized transcript. The API key never leaves the server, and provider
 * error text never reaches the client.
 */
async function transcribeAudioFile(filePath, { language } = {}) {
  try {
    const openai = getClient(); // inside try so the temp file is always cleaned up
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
      language: language || undefined,
      response_format: 'json',
    });
    return { text: response.text || '', language: language || null };
  } catch (err) {
    throw err.publicMessage ? err : toPublicError(err);
  } finally {
    fs.unlink(filePath, () => {});
  }
}

module.exports = { transcribeAudioFile };
