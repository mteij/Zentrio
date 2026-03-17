package com.zentrio.mteij

import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.webkit.WebView

class MainActivity : TauriActivity() {
  private var appWebView: WebView? = null
  private val tvInputLogTag = "ZentrioTvInput"

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
        else -> null
      }

      if (remoteAction != null) {
        val webView = appWebView
        Log.d(
          tvInputLogTag,
          "dispatchKeyEvent action=$remoteAction keyCode=${event.keyCode} hasWebView=${webView != null}",
        )
        if (webView != null) {
          webView.post {
            webView.requestFocus()
            webView.dispatchKeyEvent(event)
            webView.evaluateJavascript(
              """
              (function () {
                const action = '$remoteAction';
                const keyMap = {
                  left: 'ArrowLeft',
                  right: 'ArrowRight',
                  up: 'ArrowUp',
                  down: 'ArrowDown'
                };
                const key = keyMap[action];

                window.dispatchEvent(new CustomEvent('zentrio:tv-remote', {
                  detail: { action }
                }));

                if (key) {
                  const keyboardEvent = new KeyboardEvent('keydown', {
                    key,
                    bubbles: true,
                    cancelable: true
                  });
                  window.dispatchEvent(keyboardEvent);
                  document.dispatchEvent(keyboardEvent);
                }
              })();
              """.trimIndent(),
              null,
            )
          }
        } else {
          Log.w(tvInputLogTag, "Dropped remote action $remoteAction because WebView is null")
        }
      }
    }

    return super.dispatchKeyEvent(event)
  }
}
