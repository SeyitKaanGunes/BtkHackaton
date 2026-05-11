export const CachesDirectoryPath = "/tmp";

export async function readFile(): Promise<never> {
  throw new Error("Dosya okuma web önizlemede desteklenmiyor.");
}

export async function writeFile(): Promise<never> {
  throw new Error("Ses dosyası yazma web önizlemede desteklenmiyor.");
}

export async function unlink(): Promise<void> {
  return undefined;
}
