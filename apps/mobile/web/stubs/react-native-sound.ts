type Callback = (error?: Error | null, props?: { duration?: number; numberOfChannels?: number }) => void;

export default class Sound {
  static MAIN_BUNDLE = "";
  static DOCUMENT = "";
  static LIBRARY = "";
  static CACHES = "";

  static setActive() {}
  static setCategory() {}
  static setMode() {}
  static enable() {}

  constructor(_file: string, basePathOrCallback?: string | Callback, callback?: Callback) {
    const nextCallback = typeof basePathOrCallback === "function" ? basePathOrCallback : callback;
    nextCallback?.(new Error("Ses oynatma web önizlemede desteklenmiyor."), {});
  }

  isLoaded() {
    return false;
  }

  play(onEnd?: (success: boolean) => void) {
    onEnd?.(false);
    return this;
  }

  pause(cb?: () => void) {
    cb?.();
    return this;
  }

  stop(cb?: () => void) {
    cb?.();
    return this;
  }

  reset() {
    return this;
  }

  release() {
    return this;
  }

  getNumberOfChannels() {
    return 0;
  }

  getDuration() {
    return 0;
  }

  getVolume() {
    return 0;
  }

  setVolume() {
    return this;
  }

  getPan() {
    return 0;
  }

  setPan() {
    return this;
  }

  getNumberOfLoops() {
    return 0;
  }

  setNumberOfLoops() {
    return this;
  }

  getCurrentTime(cb?: (seconds: number, isPlaying: boolean) => void) {
    cb?.(0, false);
  }

  setCurrentTime() {
    return this;
  }

  getSpeed() {
    return 1;
  }

  setSpeed() {
    return this;
  }

  getPitch() {
    return 1;
  }

  setPitch() {}
  enableInSilenceMode() {}
}
