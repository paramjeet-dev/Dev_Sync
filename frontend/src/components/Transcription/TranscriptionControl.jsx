import { useState } from 'react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { transcribeAudio } from '../../services/chatApi';

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
        if (!blob) throw new Error('No audio captured.');
        const result = await transcribeAudio(blob);
        setTranscript(result.text || '');
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Transcription failed.');
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
    socket.emit('chat:send', { message: transcript.trim() }, (response) => {
      if (response?.ok) {
        setTranscript('');
      } else {
        setError(response?.error || 'Failed to send transcript to chat.');
      }
    });
  }

  const statusLabel = recording
    ? 'Recording… click to stop'
    : processing
    ? 'Processing…'
    : 'Click to record';

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

      {(recorderError || error) && (
        <div className="transcription-error">{recorderError || error}</div>
      )}

      {transcript && (
        <div className="transcription-result">
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={3}
          />
          <button onClick={insertIntoChat} disabled={!connected}>
            Send to chat
          </button>
        </div>
      )}
    </div>
  );
}
