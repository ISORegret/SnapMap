package com.snapmap.app;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    applyShortcutPath(intent);
  }

  @Override
  protected void load() {
    super.load();
    applyShortcutPath(getIntent());
  }

  private void applyShortcutPath(Intent intent) {
    if (intent == null) return;
    android.net.Uri data = intent.getData();
    if (data == null) return;
    String fragment = data.getFragment();
    if (fragment == null || fragment.isEmpty()) return;
    String path = "#" + fragment;
    new Handler(Looper.getMainLooper()).postDelayed(() -> {
      Bridge bridge = getBridge();
      if (bridge == null) return;
      WebView webView = bridge.getWebView();
      if (webView == null) return;
      String escaped = path.replace("'", "\\'").replace("\n", " ");
      String js = "window.location.hash = '" + escaped + "';";
      webView.evaluateJavascript(js, null);
    }, 1200);
  }
}
