package com.zentrio.mteij

import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.webkit.WebView
import android.webkit.ValueCallback

class MainActivity : TauriActivity() {
  private var appWebView: WebView? = null
  private val tvInputLogTag = "ZentrioTvInput"

  private fun forwardRemoteAction(webView: WebView, remoteAction: String) {
    webView.post {
      webView.requestFocus()
      webView.evaluateJavascript(
        """
        (function () {
          const action = '$remoteAction';

          window.dispatchEvent(new CustomEvent('zentrio:tv-remote', {
            detail: { action }
          }));

          return JSON.stringify({
            action,
            href: window.location.href,
            readyState: document.readyState,
            appTarget: document.body?.dataset?.appTarget ?? null,
            primaryInput: document.body?.dataset?.primaryInput ?? null,
            focusReady: !!window.__ZENTRIO_TV_FOCUS_READY__,
            focusEnabled: !!window.__ZENTRIO_TV_FOCUS_ENABLED__,
            activeTag: document.activeElement?.tagName ?? null,
            activeId: document.activeElement?.id ?? null,
            activeClass: document.activeElement?.className ?? null,
            focusDebug: window.__ZENTRIO_TV_DEBUG__ ?? null
          });
        })();
        """.trimIndent(),
        ValueCallback { result ->
          Log.d(tvInputLogTag, "forwardRemoteAction result=$result")
        },
      )
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
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
    appWebView = webView
    webView.isFocusable = true
    webView.isFocusableInTouchMode = true
    webView.requestFocus()
    // Enable third-party cookies for cross-origin auth (tauri://localhost -> localhost:3000)
    android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
    Log.d(tvInputLogTag, "WebView created and focused")
  }

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (event.action == KeyEvent.ACTION_DOWN) {
      val remoteAction = when (event.keyCode) {
        KeyEvent.KEYCODE_DPAD_LEFT -> "left"
        KeyEvent.KEYCODE_DPAD_RIGHT -> "right"
        KeyEvent.KEYCODE_DPAD_UP -> "up"
        KeyEvent.KEYCODE_DPAD_DOWN -> "down"
        KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> "activate"
        KeyEvent.KEYCODE_BACK -> "back"
        else -> null
      }

      if (remoteAction != null) {
        val webView = appWebView
        Log.d(
          tvInputLogTag,
          "dispatchKeyEvent action=$remoteAction keyCode=${event.keyCode} hasWebView=${webView != null}",
        )
        if (webView != null) {
          forwardRemoteAction(webView, remoteAction)
          return true
        } else {
          Log.w(tvInputLogTag, "Dropped remote action $remoteAction because WebView is null")
        }
      }
    }

    return super.dispatchKeyEvent(event)
  }
}
