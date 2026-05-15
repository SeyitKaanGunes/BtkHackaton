import { NativeModules, Platform } from "react-native";
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from "@react-native-google-signin/google-signin";
import { googleWebClientIdMissingMessage, pickGoogleWebClientId } from "./googleSignInConfig";

type RuntimeEnv = Record<string, string | undefined>;

type FintwinNativeModules = typeof NativeModules & {
  FintwinConfig?: {
    googleWebClientId?: string;
  };
};

export class GoogleSignInCancelledError extends Error {
  constructor(message = "Google girişi iptal edildi.") {
    super(message);
    this.name = "GoogleSignInCancelledError";
  }
}

let configuredWebClientId: string | undefined;

export function getGoogleSignInConfigState() {
  const webClientId = resolveGoogleWebClientId();
  return {
    ready: Boolean(webClientId),
    message: webClientId ? undefined : googleWebClientIdMissingMessage()
  };
}

export async function requestGoogleIdToken() {
  const webClientId = resolveGoogleWebClientId();
  if (!webClientId) {
    throw new Error(googleWebClientIdMissingMessage());
  }

  configureGoogleSignIn(webClientId);

  try {
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      throw new GoogleSignInCancelledError();
    }

    const idToken = response.data.idToken?.trim();
    if (!idToken) {
      throw new Error("Google oturum token'ı alınamadı. Web client ID yapılandırmasını kontrol et.");
    }
    return idToken;
  } catch (error) {
    if (error instanceof GoogleSignInCancelledError) throw error;
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) throw new GoogleSignInCancelledError();
      if (error.code === statusCodes.IN_PROGRESS) throw new Error("Google giriş işlemi zaten devam ediyor.");
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error("Google Play Services kullanılabilir değil veya güncel değil.");
    }
    throw error;
  }
}

function configureGoogleSignIn(webClientId: string) {
  if (configuredWebClientId === webClientId) return;

  GoogleSignin.configure({
    webClientId,
    scopes: ["openid", "email", "profile"]
  });
  configuredWebClientId = webClientId;
}

function resolveGoogleWebClientId() {
  const runtimeEnv = (globalThis as { process?: { env?: RuntimeEnv } }).process?.env ?? {};
  const nativeGoogleWebClientId = (NativeModules as FintwinNativeModules).FintwinConfig?.googleWebClientId;
  return pickGoogleWebClientId({ env: runtimeEnv, nativeGoogleWebClientId });
}
