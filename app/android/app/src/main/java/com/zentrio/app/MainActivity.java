package com.zentrio.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Bridge bridge = this.getBridge();
        if (bridge != null && bridge.getWebView() != null) {
            WebSettings webSettings = bridge.getWebView().getSettings();

            // Allow media (audio/video) playback without requiring a user gesture.
            // This is important so Stremio streams can start correctly inside
            // the Capacitor WebView on Android.
            webSettings.setMediaPlaybackRequiresUserGesture(false);

            // Allow JavaScript to open windows automatically (some players/popups rely on this).
            webSettings.setJavaScriptCanOpenWindowsAutomatically(true);
        }
    }
}
