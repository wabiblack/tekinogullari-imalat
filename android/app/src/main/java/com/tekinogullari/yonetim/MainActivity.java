package com.tekinogullari.yonetim;

import android.app.Activity;
import android.print.PrintManager;
import android.print.PrintDocumentAdapter;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.Manifest;
import android.content.pm.PackageManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.JavascriptInterface;
import java.security.SecureRandom;

import android.os.Message;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final String ADMIN_URL = "https://tekinogullari-imalat.vercel.app/admin/";
    private static final String ADMIN_HOST = "tekinogullari-imalat.vercel.app";
    private static final int FILE_REQUEST_CODE = 42;


    private static final int NOTIFICATION_PERMISSION_REQUEST = 635;

    public final class NotificationBridge {
        @JavascriptInterface
        public String getDeviceToken() {
            SharedPreferences prefs = getSharedPreferences("tekin_device_notifications", Context.MODE_PRIVATE);
            String existing = prefs.getString("device_token", null);
            if (existing != null && existing.matches("^[0-9a-f]{64}$")) return existing;
            byte[] bytes = new byte[32];
            new SecureRandom().nextBytes(bytes);
            StringBuilder result = new StringBuilder(64);
            for (byte b : bytes) result.append(String.format(java.util.Locale.ROOT, "%02x", b & 0xff));
            String token = result.toString();
            prefs.edit().putString("device_token", token).apply();
            return token;
        }
        @JavascriptInterface
        public void startBackgroundChecks() {
            runOnUiThread(() -> {
                QuoteNotificationJob.schedule(MainActivity.this);
                if (Build.VERSION.SDK_INT >= 33 &&
                    checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        NOTIFICATION_PERMISSION_REQUEST);
                }
            });
        }
        @JavascriptInterface
        public void stopBackgroundChecks() {
            QuoteNotificationJob.stop(getApplicationContext());
        }
        @JavascriptInterface
        public void printPdf(String documentHtml) {
            if (documentHtml == null || documentHtml.length() > 160000 ||
                !documentHtml.startsWith("<!DOCTYPE html><html lang=\"tr\">")) return;
            runOnUiThread(() -> {
                final WebView printable = new WebView(MainActivity.this);
                printView = printable;
                printable.getSettings().setJavaScriptEnabled(false);
                printable.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        PrintManager manager = (PrintManager)getSystemService(Context.PRINT_SERVICE);
                        if (manager != null) {
                            PrintDocumentAdapter adapter = printable.createPrintDocumentAdapter("Tekinogullari-Belge");
                            manager.print("Tekinoğulları Belge",adapter,null);
                        }
                    }
                });
                printable.loadDataWithBaseURL("https://tekinogullari-imalat.vercel.app/",
                    documentHtml, "text/html","UTF-8",null);
            });
        }
        @JavascriptInterface
        public void checkNow() {
            QuoteNotificationJob.checkImmediately(getApplicationContext());
        }
    }

    private WebView webView;
    private WebView printView;
    private ValueCallback<Uri[]> pendingFileChooser;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.setBackgroundColor(0xFFFAFAFA);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        webView.addJavascriptInterface(new NotificationBridge(), "TekinAndroid");
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                return !isAdminUrl(uri) && openExternal(uri);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (pendingFileChooser != null) {
                    pendingFileChooser.onReceiveValue(null);
                }
                pendingFileChooser = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_REQUEST_CODE);
                    return true;
                } catch (ActivityNotFoundException e) {
                    pendingFileChooser = null;
                    Toast.makeText(MainActivity.this, "Dosya seçici bulunamadı.", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                if (!isUserGesture) return false;
                WebView popup = new WebView(MainActivity.this);
                popup.setWebViewClient(new WebViewClient() {
                    private boolean dispatched = false;
                    private void dispatch(String url) {
                        if (dispatched || url == null || url.equals("about:blank")) return;
                        dispatched = true;
                        openExternal(Uri.parse(url));
                        popup.stopLoading();
                    }
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView child, WebResourceRequest request) {
                        dispatch(request.getUrl().toString());
                        return true;
                    }
                    @Override
                    public void onPageStarted(WebView child, String url, Bitmap favicon) {
                        dispatch(url);
                    }
                });
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popup);
                resultMsg.sendToTarget();
                return true;
            }
        });

        if (savedInstanceState == null) webView.loadUrl(startUrl(getIntent()));
        else webView.restoreState(savedInstanceState);
    }

    private String startUrl(Intent intent) {
        if (intent != null &&
            "com.tekinogullari.yonetim.OPEN_JOBS".equals(intent.getAction())) {
            return ADMIN_URL + "?view=jobs";
        }
        if (intent != null &&
            "com.tekinogullari.yonetim.OPEN_QUOTES".equals(intent.getAction())) {
            return ADMIN_URL + "?view=quotes";
        }
        return ADMIN_URL;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (webView != null) webView.loadUrl(startUrl(intent));
    }

    private boolean isAdminUrl(Uri uri) {
        return "https".equalsIgnoreCase(uri.getScheme())
            && ADMIN_HOST.equalsIgnoreCase(uri.getHost());
    }

    private boolean openExternal(Uri uri) {
        String scheme = uri.getScheme();
        if (!"https".equalsIgnoreCase(scheme)
                && !"http".equalsIgnoreCase(scheme)
                && !"tel".equalsIgnoreCase(scheme)
                && !"mailto".equalsIgnoreCase(scheme)
                && !"whatsapp".equalsIgnoreCase(scheme)) {
            return true;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Bağlantı açılamadı. Uygun uygulamayı kontrol et.", Toast.LENGTH_LONG).show();
        }
        return true;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_REQUEST_CODE || pendingFileChooser == null) return;
        pendingFileChooser.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
        pendingFileChooser = null;
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        if (webView != null) webView.saveState(state);
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (printView != null) { printView.destroy(); printView = null; }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
