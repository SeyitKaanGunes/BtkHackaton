import * as RNFS from "react-native-fs";
import Sound from "react-native-sound";
import { synthesizeSpeech } from "./api";

let currentSound: Sound | null = null;

export async function speakWithGemini(text: string) {
  const speech = await synthesizeSpeech(text);
  await playBase64Audio(speech.audioBase64, speech.mimeType);
  return speech;
}

export async function playBase64Audio(audioBase64: string, mimeType: string) {
  const extension = extensionForMimeType(mimeType);
  const path = `${RNFS.CachesDirectoryPath}/fintwin-voice-${Date.now()}.${extension}`;
  await RNFS.writeFile(path, audioBase64, "base64");

  return new Promise<void>((resolve, reject) => {
    stopCurrentSound();
    Sound.setCategory("Playback");
    let sound: Sound | undefined;
    sound = new Sound(path, "", (error) => {
      if (!sound) {
        RNFS.unlink(path).catch(() => undefined);
        reject(new Error("Ses oynatıcı başlatılamadı."));
        return;
      }
      if (error) {
        cleanup(path, sound);
        reject(error instanceof Error ? error : new Error("Ses dosyası yüklenemedi."));
        return;
      }

      const loadedSound = sound;
      currentSound = loadedSound;
      loadedSound.play((success) => {
        cleanup(path, loadedSound);
        if (success) {
          resolve();
        } else {
          reject(new Error("Ses oynatılamadı."));
        }
      });
    });
  });
}

function stopCurrentSound() {
  if (!currentSound) return;
  const previous = currentSound;
  currentSound = null;
  previous.stop(() => previous.release());
}

function cleanup(path: string, sound: Sound) {
  if (currentSound === sound) currentSound = null;
  sound.release();
  RNFS.unlink(path).catch(() => undefined);
}

function extensionForMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("mp4")) return "mp4";
  if (normalized.includes("m4a")) return "m4a";
  if (normalized.includes("wav") || normalized.includes("wave")) return "wav";
  if (normalized.includes("webm")) return "webm";
  return "wav";
}
