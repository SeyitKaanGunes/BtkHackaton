type Listener = (...args: unknown[]) => void;

const speechSynthesis = typeof window !== "undefined" ? window.speechSynthesis : undefined;
let lang = "tr-TR";

const Tts = {
  setDefaultLanguage(next: string) {
    lang = next;
    return Promise.resolve();
  },
  setDefaultRate(_rate: number) {
    return Promise.resolve();
  },
  setDefaultPitch(_pitch: number) {
    return Promise.resolve();
  },
  speak(text: string) {
    if (!speechSynthesis) return Promise.resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    return Promise.resolve();
  },
  stop() {
    speechSynthesis?.cancel();
    return Promise.resolve();
  },
  addEventListener(_event: string, _cb: Listener) {
    return { remove() {} };
  },
  removeEventListener(_event: string, _cb: Listener) {}
};

export default Tts;
