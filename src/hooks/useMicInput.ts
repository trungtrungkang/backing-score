import { useState, useRef, useCallback, useEffect } from "react";

export function useMicInput() {
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [isMicInitialized, setIsMicInitialized] = useState(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  // Acoustic Smoothing Filter: Sustain notes for 500ms gracefully.
  const activePitchesRef = useRef<Set<number>>(new Set());
  const pitchTimersRef = useRef<Map<number, number>>(new Map());

  const disconnectMic = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioCtxRef.current) audioCtxRef.current.close().catch(console.error);

    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    animationFrameRef.current = 0;
    activePitchesRef.current.clear();
    pitchTimersRef.current.clear();

    setActiveNotes(new Set());
    setIsMicInitialized(false);
  }, []);

  const initializeMic = useCallback(async (): Promise<boolean> => {
    if (isMicInitialized) return true;

    try {
      // Bắt buộc tắt toàn bộ Noise Suppression mặc định của OS (iOS cực kỳ hung hăng với cái này)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        }
      });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      
      const analyser = audioCtx.createAnalyser();
      // Flowkey Magic: Kéo FFT Size lên Mức Tối đa (32768) để chia tần số ra các mảng cực mịn (1.34 Hz/bin)
      // Điều này cho phép thuật toán Peak-Picking dò ra chuẩn xác các hợp âm (Polyphonic Chords) mà YIN bó tay!
      analyser.fftSize = 32768; 
      analyser.smoothingTimeConstant = 0.5; 
      analyserRef.current = analyser;

      // Khuếch đại âm lượng vật lý.
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 4.0; 

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(gainNode);
      gainNode.connect(analyser);

      setIsMicInitialized(true);

      const processAudio = () => {
        if (!analyserRef.current || !audioCtxRef.current) return;
        
        const binCount = analyserRef.current.frequencyBinCount; // 16384 bins
        // Dùng Frequency Domain (Phổ tần số) thay vì Time Domain (Sóng thời gian) để bóc tách Hợp Âm
        const buffer = new Float32Array(binCount);
        analyserRef.current.getFloatFrequencyData(buffer); // Trả về dạng Decibels (dB)
        
        const now = performance.now();
        const sampleRate = audioCtxRef.current.sampleRate;
        const binSize = (sampleRate / 2) / binCount;
        
        // 1. Phân loại Âm Lượng Nhất (Loudest Peak) để loại bỏ Tạp âm nền (Background Noise)
        let maxAmp = -Infinity;
        for (let i = 0; i < binCount; i++) {
          if (buffer[i] > maxAmp) maxAmp = buffer[i];
        }

        // Ngưỡng phát hiện tiếng ồn thấp nhất tuyệt đối.
        const THRESHOLD_DB = -55;

        // Bỏ qua 5 bin đầu tiên (Nhiễu điện DC) và 5 bin cuối
        for (let i = 5; i < binCount - 5; i++) {
          const amp = buffer[i];
          
          // Thuật toán: Tìm Điểm Cực Đại (Local Maxima / Peak Picking) khắt khe
          // Điều kiện 1: Tần số phải to hơn mức Ngưỡng (Threshold)
          // Điều kiện 2: Chỉ lấy Các ngọn nến sáng nhất (Không được bé hơn Nốt to nhất quá 30dB)
          if (amp > THRESHOLD_DB && amp > maxAmp - 35) {
            
            // Điều kiện 3: Nó phải là "Đỉnh Núi" (To hơn bin hai bên)
            if (amp > buffer[i - 1] && amp > buffer[i + 1]) {
              
              // Điều kiện 4: LỌC TẠP ÂM (Prominence Filter). Mấu chốt chặn tiếng HO/VỖ TAY!
              // Tiếng ho là "Broadband Noise" (sóng Gồ Ghề Mập Mạp). Piano là sóng "Tonal" (Cao Vút Nhọn Hoắt).
              // Ta sẽ soi 10 bin xung quanh nó (+/- 5 bin). Đỉnh nhô lên bao nhiêu DB?
              let localSum = 0;
              for (let j = -5; j <= 5; j++) {
                localSum += buffer[i + j];
              }
              const localAvg = localSum / 11;
              
              // Nếu Đỉnh chỉ nhô cao hơn mức trung bình xung quanh 10dB -> Là tiếng ho/rác -> BỎ!
              // Nếu Đỉnh đâm xuyên qua mức trung bình > 15dB -> Là Nốt Nhạc của Piano/Guitar.
              if (amp - localAvg > 12) { 
                
                // Parabolic Interpolation (Làm tròn Parabol) để đoán tần số cực nét giữa 2 Bin
                const valL = buffer[i - 1];
                const valC = buffer[i];
                const valR = buffer[i + 1];
                const p = 0.5 * (valL - valR) / (valL - 2 * valC + valR);
                
                const exactBin = i + p;
                const freq = exactBin * binSize;
                
                // Giới hạn dải tần số của Đàn Piano
                if (freq >= 27.5 && freq <= 4186) { 
                  const midiNote = Math.round(69 + 12 * Math.log2(freq / 440));
                  if (midiNote > 0 && midiNote < 128) {
                    // Nhặt được 1 nốt Sạch trong Hợp âm!
                    pitchTimersRef.current.set(midiNote, now);
                  }
                }
              }
            }
          }
        }
        
        // 2. Tăng Time-To-Live (Grace period) lên 500ms. 
        // Khi gõ mạn đàn (attack noise), Peak Picker có thể trượt mẻ Null trong 1-2 frames. Thời gian trễ vớt vát lại nốt.
        const newPitches = new Set<number>();
        pitchTimersRef.current.forEach((lastSeen, note) => {
            if (now - lastSeen < 500) {
                newPitches.add(note);
            } else {
                pitchTimersRef.current.delete(note);
            }
        });

        // Prevent layout thrashing: Diff the exact Set boundaries manually
        let hasChanged = false;
        if (newPitches.size !== activePitchesRef.current.size) {
           hasChanged = true;
        } else {
           for (const n of newPitches) {
               if (!activePitchesRef.current.has(n)) { hasChanged = true; break; }
           }
        }

        if (hasChanged) {
           activePitchesRef.current = newPitches;
           setActiveNotes(new Set(newPitches));
        }

        animationFrameRef.current = requestAnimationFrame(processAudio);
      };

      processAudio();
      return true;

    } catch (err) {
      console.warn("Microphone access denied or unsupported", err);
      return false;
    }
  }, [isMicInitialized]);

  useEffect(() => {
    return disconnectMic;
  }, [disconnectMic]);

  return { activeNotes, initializeMic, isMicInitialized, disconnectMic };
}
