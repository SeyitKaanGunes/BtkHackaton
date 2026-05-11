type KeychainOptions = {
  service?: string;
};

type Credentials = {
  username: string;
  password: string;
  service?: string;
  storage?: string;
};

const storagePrefix = "fintwin:keychain:";

function storageKey(service?: string) {
  return `${storagePrefix}${service ?? "default"}`;
}

export const ACCESSIBLE = {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "AccessibleWhenUnlockedThisDeviceOnly"
} as const;

export const ACCESS_CONTROL = {
  BIOMETRY_CURRENT_SET: "BiometryCurrentSet"
} as const;

export const AUTHENTICATION_TYPE = {
  BIOMETRICS: "Biometrics"
} as const;

export const BIOMETRY_TYPE = {
  FACE_ID: "FaceID",
  TOUCH_ID: "TouchID",
  FINGERPRINT: "Fingerprint",
  FACE: "Face",
  IRIS: "Iris"
} as const;

export async function setGenericPassword(username: string, password: string, options: KeychainOptions = {}) {
  localStorage.setItem(storageKey(options.service), JSON.stringify({ username, password, service: options.service }));
  return { service: options.service, storage: "web" };
}

export async function getGenericPassword(options: KeychainOptions = {}): Promise<Credentials | false> {
  const raw = localStorage.getItem(storageKey(options.service));
  if (!raw) return false;
  return JSON.parse(raw) as Credentials;
}

export async function resetGenericPassword(options: KeychainOptions = {}) {
  localStorage.removeItem(storageKey(options.service));
  return true;
}

export async function getSupportedBiometryType() {
  return null;
}

export async function canImplyAuthentication() {
  return false;
}

export default {
  ACCESSIBLE,
  ACCESS_CONTROL,
  AUTHENTICATION_TYPE,
  BIOMETRY_TYPE,
  setGenericPassword,
  getGenericPassword,
  resetGenericPassword,
  getSupportedBiometryType,
  canImplyAuthentication
};
