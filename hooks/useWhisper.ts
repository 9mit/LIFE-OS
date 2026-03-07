import { useState, useRef, useCallback, useEffect } from "react";

export function useWhisper() {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcription, setTranscription] = useState("");
    const [whisperProgress, setWhisperProgress] = useState<any>(null);

    const workerRef = useRef<Worker | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        if (!workerRef.current) {
            workerRef.current = new Worker(new URL("../utils/whisperWorker.ts", import.meta.url), { type: "module" });
            workerRef.current.addEventListener("message", (event) => {
                const { status, text, error } = event.data;
                if (status === "progress") {
                    setWhisperProgress(event.data);
                } else if (status === "complete") {
                    setTranscription((prev) => (prev ? prev + " " + text : text).trim());
                    setIsTranscribing(false);
                } else if (status === "error") {
                    console.error("Whisper transcription error:", error);
                    setIsTranscribing(false);
                }
            });
        }

        return () => {
            // Don't terminate worker on unmount to keep model in memory
        };
    }, []);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunksRef.current = [];
            const mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                setIsTranscribing(true);
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                await processAudio(audioBlob);

                // Stop all tracks
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start();
            mediaRecorderRef.current = mediaRecorder;
            setIsRecording(true);
            setTranscription(""); // Clear previous
        } catch (err) {
            console.error("Error accessing microphone:", err);
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, [isRecording]);

    const processAudio = async (audioBlob: Blob) => {
        try {
            // Decode audio to 16kHz for Whisper
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: 16000,
            });
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const audioData = audioBuffer.getChannelData(0); // Float32Array

            if (workerRef.current) {
                workerRef.current.postMessage({ id: Date.now(), audio: audioData });
            }
        } catch (err) {
            console.error("Error processing audio:", err);
            setIsTranscribing(false);
        }
    };

    return {
        isRecording,
        isTranscribing,
        transcription,
        whisperProgress,
        startRecording,
        stopRecording,
    };
}
