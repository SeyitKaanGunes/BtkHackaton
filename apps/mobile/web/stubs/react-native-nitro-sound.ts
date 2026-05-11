export enum AVEncoderAudioQualityIOSType {
  min = 0,
  low = 32,
  medium = 64,
  high = 96,
  max = 127
}

export type AudioSet = Record<string, unknown>;
export type RecordBackType = { currentPosition: number; currentMetering?: number; isRecording?: boolean; recordSecs?: number };

const Sound = {
  setSubscriptionDuration() {},
  addRecordBackListener() {},
  removeRecordBackListener() {},
  async startRecorder(): Promise<never> {
    throw new Error("Mikrofon kaydı web önizlemede desteklenmiyor.");
  },
  async stopRecorder(): Promise<never> {
    throw new Error("Mikrofon kaydı web önizlemede desteklenmiyor.");
  },
  async pauseRecorder(): Promise<never> {
    throw new Error("Mikrofon kaydı web önizlemede desteklenmiyor.");
  },
  async resumeRecorder(): Promise<never> {
    throw new Error("Mikrofon kaydı web önizlemede desteklenmiyor.");
  },
  mmss(seconds: number) {
    return String(seconds);
  },
  mmssss(milliseconds: number) {
    return String(milliseconds);
  }
};

export default Sound;
