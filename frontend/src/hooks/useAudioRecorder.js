import { useCallback, useRef, useState } from 'react';

export function useAudioRecorder() {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(null);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      setError('Microphone access was denied or unavailable.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return resolve(null);

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        setRecording(false);
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  return { recording, error, startRecording, stopRecording };
}
