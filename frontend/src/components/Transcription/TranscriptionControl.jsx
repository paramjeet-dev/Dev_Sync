import { useState } from 'react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { transcribeAudio } from '../../services/chatApi';
import { getErrorMessage } from '../../services/errors';

export default function TranscriptionControl({ socket, connected }) {
  const { recording, error: recorderError, startRecording, stopRecording } = useAudioRecorder();
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);

  async function handleToggleRecording() {
    if (recording) {
      setProcessing(true);
      setError(null);
      try {
        const blob = await stopRecording();
        if (!blob || blob.size === 0) {
          setError('No audio was captured. Please try recording again.');
          return;
        }
        const result = await transcribeAudio(blob);
        if (!result.text?.trim()) {
          setError("We couldn't hear anything in that recording. Please try again.");
          return;
        }
        setTranscript(result.text);
      } catch (err) {
        setError(getErrorMessage(err, 'Transcription failed. Please try again.'));
      } finally {
        setProcessing(false);
      }
    } else {
      setTranscript('');
      setError(null);
      await startRecording();
    }
  }

  function insertIntoChat() {
    if (!transcript.trim() || !socket || !connected) return;
    // metadata.type = 'transcript' makes the message render with the transcript accent in chat.
    socket
      .timeout(8000)
      .emit('chat:send', { message: transcript.trim(), metadata: { type: 'transcript' } }, (err, response) => {
        if (err || !response?.ok) {
          setError(err ? "Couldn't reach the server. Your transcript is still here — try again." : response?.error || 'Failed to send transcript to chat.');
        } else {
          setTranscript('');
        }
      });
  }

  const statusLabel = recording ? 'Recording… click to stop' : processing ? 'Processing…' : 'Click to record';

  return (
    <div className="transcription-panel">
      <div className="transcription-header">Voice Transcription</div>

      <button
        className={`record-btn ${recording ? 'recording' : ''}`}
        onClick={handleToggleRecording}
        disabled={processing}
      >
        {recording ? '⏹ Stop' : '🎙 Record'}
      </button>
      <div className="transcription-status">{statusLabel}</div>

      {(recorderError || error) && <div className="transcription-error">{recorderError || error}</div>}

      {transcript && (
        <div className="transcription-result">
          <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={3} />
          <button onClick={insertIntoChat} disabled={!connected}>
            Send to chat
          </button>
        </div>
      )}
    </div>
  );
}
