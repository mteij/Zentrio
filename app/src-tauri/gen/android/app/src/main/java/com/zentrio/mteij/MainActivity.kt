package com.zentrio.mteij

import android.os.Bundle

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    pluginManager.load(null, "immersive-mode", ImmersiveModePlugin(this), "{}")
    super.onCreate(savedInstanceState)
    ImmersiveModeState.apply(this)
  }

  override fun onResume() {
    super.onResume()
    ImmersiveModeState.apply(this)
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      ImmersiveModeState.apply(this)
    }
  }

  override fun onWebViewCreate(webView: android.webkit.WebView) {
    super.onWebViewCreate(webView)
    // Enable third-party cookies for cross-origin auth (tauri://localhost -> localhost:3000)
    android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
  }
}
