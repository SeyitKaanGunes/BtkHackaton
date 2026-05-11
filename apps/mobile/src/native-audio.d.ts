declare module "react-native-sound" {
  export default class Sound {
    static MAIN_BUNDLE: string;
    static DOCUMENT: string;
    static LIBRARY: string;
    static CACHES: string;
    static setCategory(category: string): void;

    constructor(fileName: string, basePath: string, callback: (error: Error | null) => void);

    play(onEnd?: (success: boolean) => void): this;
    stop(callback?: () => void): this;
    release(): this;
  }
}

declare module "react-native-nitro-sound" {
  export enum AVEncoderAudioQualityIOSType {
    min = 0,
    low = 32,
    medium = 64,
    high = 96,
    max = 127
  }

  export type AudioSet = Record<string, unknown>;

  export type RecordBackType = {
    currentPosition: number;
    currentMetering?: number;
    isRecording?: boolean;
    recordSecs?: number;
  };

  type NitroSound = {
    setSubscriptionDuration(value: number): void;
    addRecordBackListener(listener: (event: RecordBackType) => void): void;
    removeRecordBackListener(): void;
    startRecorder(uri?: string, audioSet?: AudioSet, meteringEnabled?: boolean): Promise<string>;
    stopRecorder(): Promise<string>;
  };

  const Sound: NitroSound;
  export default Sound;
}
