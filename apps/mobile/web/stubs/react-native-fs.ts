export async function readFile(): Promise<never> {
  throw new Error("Dosya okuma web önizlemede desteklenmiyor.");
}
