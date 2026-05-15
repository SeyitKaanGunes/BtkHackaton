package com.fintwinmobile

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class FintwinConfigModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "FintwinConfig"

  override fun getConstants(): MutableMap<String, Any> =
      hashMapOf("googleWebClientId" to BuildConfig.GOOGLE_WEB_CLIENT_ID)
}
