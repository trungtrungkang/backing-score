# Audio & Playback Algorithms — Tài liệu kỹ thuật nội bộ

**Phiên bản:** 1.1  
**Cập nhật:** 2026-03-25  
**Phạm vi:** MetronomeEngine, MusicXML Analyzer, MIDI Sync, Playhead Tracking, Pitch Detection

---

## Mục Lục

1. [Corrected Timemap — Đồng bộ từ MIDI file thực](#1-corrected-timemap)
2. [MusicXML Analyzer — Trích xuất cấu trúc nhạc](#2-musicxml-analyzer)
3. [Metronome Scheduler — Đánh nhịp chính xác](#3-metronome-scheduler)
4. [Playhead Tracking — Tracking vị trí phát lại](#4-playhead-tracking)
5. [TimemapEntry Schema — Cấu trúc dữ liệu](#5-timemapentry-schema)

---

## 1. Corrected Timemap

### Vấn đề: Raw timemap vs. MIDI timemap

`payload.notationData.timemap` (raw timemap) do MusicXML Analyzer tạo ra là tính gần đúng — nó chỉ xấp xỉ thời điểm các ô nhịp dựa trên cấu trúc XML được phân tích. Tuy nhiên, file MIDI được tạo bởi Verovio chứa **tempo event thực tế** (nhịp rit./accel. từ ký hiệu nhạc). Nếu metronome dùng raw timemap thay vì MIDI timemap, sẽ bị drift tích lũy.

### Giải pháp: correctedTimemapRef

Khi `stretchedMidiBase64` được tạo ra (trong `useScoreEngine.ts`), hệ thống chạy lại timemap với thời gian tính từ chính các MIDI tick:

```typescript
// useScoreEngine.ts — build correctedTimemap từ MIDI ticks
const scaledTempos = midi.header.tempos; // Tempo events từ Verovio MIDI
const ppq = midi.header.ppq;             // Pulses per quarter note

const ticksToMs = (targetTick: number): number => {
  let ms = 0, lastTick = 0, currentBpm = scaledTempos[0]?.bpm;
  for (const t of scaledTempos) {
    if (t.ticks >= targetTick) break;
    ms += (t.ticks - lastTick) / ppq * (60000 / currentBpm);
    lastTick = t.ticks;
    currentBpm = t.bpm;
  }
  ms += (targetTick - lastTick) / ppq * (60000 / currentBpm);
  return ms;
};

let accTicks = 0;
correctedTimemapRef.current = timemap.map(entry => {
  const correctedTimeMs = ticksToMs(accTicks);       // Thời gian từ MIDI ticks
  accTicks += entry.durationInQuarters * ppq;         // Cộng dồn tick
  return { ...entry, timeMs: correctedTimeMs };       // Override timeMs
});
```

### Nguồn sự thật (Source of truth)

| Thành phần | Dùng gì |
|---|---|
| Metronome scheduling | `correctedTimemapRef.current` → fallback `payload.notationData.timemap` |
| MIDI player (html-midi-player) | MIDI file trực tiếp từ Verovio — không cần timemap |
| Playhead scrolling (SVG) | `correctedTimemapRef.current` qui đổi ms → measure → pixel |
| Audio stems (AudioManager) | Không dùng timemap — chạy theo wall clock |

> **Quan trọng:** Metronome và MIDI player phải dùng cùng một nguồn tempo để không bị lệch pha. `correctedTimemapRef` đảm bảo điều này.

---

## 2. MusicXML Analyzer

**File:** `src/lib/score/musicxml-analyzer.ts`  
**Hàm chính:** `analyzeMusicXML(xmlText: string): MusicXMLAnalysis`

### 2.1 Pipeline phân tích

```
MusicXML text
  │
  ├── Parse DOM (DOMParser)
  │
  ├── Đọc part[0] → tất cả <measure>
  │
  ├── Cho mỗi measure:
  │   ├── Đọc time signature (<attributes><time>)
  │   ├── Đọc divisions (<attributes><divisions>)
  │   ├── Đọc tempo changes (<direction><sound tempo="X">)
  │   ├── Theo dõi beatPos tích lũy (voice 1)
  │   ├── Tính durationInQuarters thực tế
  │   ├── Detect pickup/anacrusis (implicit="yes")
  │   └── Detect repeats (<repeat>, <ending>, <direction>)
  │
  ├── Expand repeats → playback sequence
  │
  └── Build timemap + measureMap
```

### 2.2 Tính durationInQuarters thực tế

Mỗi ô nhịp được tính thời lượng thực theo tổng duration của các note trong voice 1 (thay vì chỉ dùng time signature):

```typescript
// Theo dõi số division đã dùng trong measure
let voiceDurations: Record<string, number> = {};

// Với mỗi <note>:
const dur = getNumericContent(child, "duration") || 0;
const voice = getTextContent(child, "voice") || "1";
voiceDurations[voice] = (voiceDurations[voice] || 0) + dur;

// Duration thực tế = max của tất cả voice
const actualDurationDivisions = Math.max(...Object.values(voiceDurations));
info.durationInQuarters = actualDurationDivisions / currentDivisions;
```

**Tại sao quan trọng?** Ô nhịp lấy đà (pickup/anacrusis) có thể chỉ có 1 phách trong khi time signature là 4/4. `durationInQuarters` là giá trị thực tế từ notes, không phải nominal từ time signature.

### 2.3 Detect pickup measure (anacrusis)

```typescript
const isImplicit = measure.getAttribute("implicit") === "yes";
// Nếu ô nhịp đầu tiên là implicit, nó là ô nhịp lấy đà
// → không đếm vào số ô nhịp chính, startsAtBeat được tính
```

**`startsAtBeat`** được đưa vào `TimemapEntry` để MetronomeEngine biết:
- Ô nhịp này bắt đầu ở phách nào trong một bar đầy đủ
- Ví dụ: 3/4 với pickup phách 3 → `startsAtBeat = 2` (0-indexed)
- Metronome sẽ dùng **weak beat sound** cho phách đầu của ô nhịp này

### 2.4 tempoAtBeat — Tempo thay đổi trong ô nhịp

Khi có rit./accel. xảy ra TRONG một ô nhịp (không chỉ tại điểm bắt đầu), analyzer theo dõi beatPos tích lũy:

```typescript
// Theo dõi cumulative duration ở voice 1 để biết beatPos của tempo change
let cumulativeDurVoice1 = 0;

// Sau mỗi note ở voice 1:
cumulativeDurVoice1 += dur;

// Khi gặp <sound tempo="X"> trong <direction>:
const beatPos = cumulativeDurVoice1 / currentDivisions; // Tính bằng quarter notes
info.tempoAtBeat = info.tempoAtBeat || [];
info.tempoAtBeat.push({ beatPos, tempo: newTempo });
```

MetronomeEngine dùng `tempoAtBeat` để tính thời gian chính xác cho từng phách trong ô nhịp có tempo thay đổi.

### 2.5 Expand repeats

Analyzer resolve tất cả:
- `<repeat direction="forward">` / `<repeat direction="backward">`
- `<ending number="1">` / `<ending number="2">` (volta brackets)
- Da Capo al Fine, Dal Segno, Coda, Fine

Kết quả là mảng `playbackSequence` — thứ tự **thực tế** các ô nhịp sẽ được phát (sau khi expand lặp lại), dùng để tính `measureMap` và `timemap`.

---

## 3. Metronome Scheduler

**File:** `src/lib/audio/MetronomeEngine.ts`

### 3.1 Lookahead Scheduler Pattern

Metronome **không** dùng `setInterval` để phát âm thanh trực tiếp (không chính xác). Thay vào đó dùng **lookahead scheduling**:

```
setInterval (25ms)
  └── scheduler()
      └── Tìm tất cả beats trong window [now, now + 0.5s]
          └── scheduleNote(beatContextTime) → Web Audio Oscillator
```

**Tham số:**
- `lookahead = 25ms` — tần suất gọi scheduler
- `scheduleAheadTime = 0.5s` — thời gian nhìn trước

**Tại sao cần lookahead?** JavaScript event loop có jitter ~4ms. Bằng cách schedule âm thanh trước 0.5s vào Web Audio timeline (chạy độc lập với JS), click metronome sẽ chính xác đến ~0.02ms.

### 3.2 Tọa độ thời gian (measure, beat)

Metronome theo dõi vị trí hiện tại bằng `nextTick = { measure: number, beat: number }`:
- `measure`: 1-indexed (ô nhịp 1, 2, 3...)
- `beat`: 0-indexed trong ô nhịp (0 = phách đầu)

### 3.3 `getTimeOfTick(measure, beat)` — Chuyển đổi tọa độ → thời gian (ms)

Đây là hàm quan trọng nhất, tính thời gian ms của một (measure, beat) cụ thể:

```typescript
// Ưu tiên dùng timemap nếu có
if (syncToTimemap && timemap.length > 0) {
  const mapEvent = timemap.find(t => t.measure === measureTarget); // Điểm bắt đầu measure
  
  if (mapEvent.tempoAtBeat) {
    // ── Có per-beat tempo data (rit./accel.) ──
    // Tích phân thời gian từng phách với BPM tại thời điểm đó
    let beatOffsetMs = 0;
    for (let b = 0; b < beatTarget; b++) {
      const beatTempo = getTempoAtBeat(mapEvent.tempoAtBeat, b, baseTempo);
      beatOffsetMs += 60000 / beatTempo; // ms cho một beat
    }
    return mapEvent.timeMs + beatOffsetMs;
  }
  
  // ── Không có per-beat data: chia đều duration ô nhịp ──
  const measureDurationMs = nextTimemapEntry.timeMs - mapEvent.timeMs;
  const msPerSubBeat = measureDurationMs / beatsPerBar;
  return mapEvent.timeMs + (beatTarget * msPerSubBeat);
}
```

### 3.4 Scheduler loop

```typescript
private scheduler() {
  const lookaheadUntil = context.currentTime + scheduleAheadTime;
  
  while (true) {
    const beatSongMs = getTimeOfTick(nextTick.measure, nextTick.beat);
    
    // Bỏ qua các beat đã qua (nếu seek)
    if (beatSongMs < syncOffsetMsSong) { advanceTick(); continue; }
    
    // Chuyển từ song time → AudioContext time
    const relativeSecs = (beatSongMs - syncOffsetMsSong) / 1000.0;
    const beatContextTime = syncStartTimeContext + (relativeSecs / playbackRate);
    
    // Dừng nếu vượt khỏi lookahead window
    if (beatContextTime > lookaheadUntil) break;
    
    // Schedule Web Audio oscillator
    scheduleNote(isStrongBeat, beatContextTime);
    advanceTick();
  }
}
```

### 3.5 Strong vs. Weak beat

- Beat 0 của ô nhịp → **Strong** (tiếng cao, 880 Hz) — **trừ khi** `startsAtBeat > 0`
- Các beat khác → **Weak** (tiếng thấp, 440 Hz)

Logic `isStrongBeatInMeasure()`:
```typescript
// Không phải beat 0 → luôn weak
if (beat !== 0) return false;

// Ô nhịp pickup (partial) → weak dù là beat 0
const entry = timemap.find(t => t.measure === measure);
if (entry?.startsAtBeat > 0) return false;

return true; // Strong
```

### 3.6 AudioContext Latency Compensation

Khi AudioManager khởi động playback, có khoảng delay ~60ms do SoundTouch worklet xử lý audio:

```typescript
const workletLatencyCompSec = workletLoaded ? 0.060 : 0;
metronome.start(
  offsetMs,
  context.currentTime + 0.05 + workletLatencyCompSec  // Bù latency
);
```

Metronome được schedule muộn hơn một chút (~60ms) để đồng bộ với tiếng nhạc thực sự phát ra qua worklet.

---

## 4. Playhead Tracking

### 4.1 Hai hệ thống tracking

| Hệ thống | Dùng cho | Cơ chế |
|---|---|---|
| AudioManager | Khi có audio stems | `(context.currentTime - startTime) * playbackRate` |
| MIDI-only mode | Khi không có stems | `performance.now()` — frame clock |

### 4.2 Xác định ô nhịp đang phát (active measure)

```typescript
// Tìm ô nhịp có timeMs <= positionMs (binary search qua timemap)
let activeMeasure = 1;
for (const entry of timemap) {
  if (entry.timeMs <= positionMs) activeMeasure = entry.measure;
  else break;
}
```

### 4.3 Tính vị trí playhead trong SVG (pixel)

Verovio SVG gán class/ID cho từng element theo measure. Playhead được tính bằng nội suy tuyến tính:

```
progress = (positionMs - measureStartMs) / (nextMeasureStartMs - measureStartMs)
playheadX = measureLeft + measureWidth * progress
```

Nếu ô nhịp hiện tại là ô cuối (không có `nextMeasureStartMs`), ước tính từ tempo:
```
estimatedDurationMs = (durationInQuarters / tempo) * 60000
```

### 4.4 Scroll auto-follow

Khi playhead vượt ra ngoài viewport:
1. Verovio trả về SVG page index của element hiện tại
2. Tính pixel offset trong trang SVG đang render
3. Scroll container đến vị trí đó với animation mượt

---

## 5. TimemapEntry Schema

**File:** `src/lib/daw/types.ts`

```typescript
export interface TimemapEntry {
  timeMs: number;               // Thời điểm bắt đầu ô nhịp (ms từ đầu bài)
  measure: number;              // Số ô nhịp (1-indexed, sau expand repeats)
  timeSignature?: string;       // Nhịp (ví dụ "3/4") — nếu thay đổi tại đây
  tempo?: number;               // BPM tại ô nhịp này — nếu thay đổi
  durationInQuarters?: number;  // Thời lượng thực tế (quarter notes) — cho pickup
  tempoAtBeat?: {               // Tempo thay đổi trong ô nhịp (rit./accel.)
    beatPos: number;            //   Vị trí phách tính bằng quarter notes từ đầu ô nhịp
    tempo: number;              //   BPM tại điểm đó
  }[];
  startsAtBeat?: number;        // Pickup: phách nào ô nhịp bắt đầu (0-indexed)
                                // >0 → beat 0 của ô nhịp này là weak beat
}
```

### Ví dụ: Waltz 3/4 với pickup phách 3

```json
[
  { "measure": 1, "timeMs": 0, "durationInQuarters": 1, "startsAtBeat": 2 },
  { "measure": 2, "timeMs": 500, "timeSignature": "3/4" },
  { "measure": 3, "timeMs": 2000 }
]
```

- Ô nhịp 1: pickup, 1 phách (= 1 quarter note), bắt đầu ở phách 3 của bar 3/4
- `startsAtBeat = 2` → MetronomeEngine: beat 0 của measure 1 là **weak**
- Ô nhịp 2 trở đi: đầy đủ 3 phách, beat 0 là **strong**

### Ví dụ: Rit. trong ô nhịp (tempoAtBeat)

```json
{
  "measure": 47,
  "timeMs": 94200,
  "tempo": 92,
  "tempoAtBeat": [
    { "beatPos": 0, "tempo": 92 },
    { "beatPos": 1, "tempo": 85 },
    { "beatPos": 2, "tempo": 78 },
    { "beatPos": 3, "tempo": 70 }
  ]
}
```

MetronomeEngine tích phân từng phách với BPM tại thời điểm đó thay vì chia đều.

---

## Tóm tắt: Nguồn dữ liệu cho Metronome

```
MusicXML → Verovio → MIDI file
                          │
                          ├── MIDI tempo events → correctedTimemap (tick-accurate)
                          │       └── Metronome: setTimemap(correctedTimemap)
                          │
                          └── html-midi-player phát nhạc

MusicXML → analyzeMusicXML() → raw timemap (dùng cho SVG playhead + measureMap)
                                    └── Fallback khi chưa có correctedTimemap
```

> **Quy tắc:** Metronome phải luôn dùng `correctedTimemapRef.current` (derived từ MIDI ticks) — không bao giờ dùng raw timemap từ MusicXML analyzer cho scheduling. Lý do: MIDI và metronome phải chia sẻ cùng một "đồng hồ" tempo.
