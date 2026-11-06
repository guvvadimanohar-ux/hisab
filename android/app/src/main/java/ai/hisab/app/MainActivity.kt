package ai.hisab.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.Menu
import android.view.MenuItem
import android.widget.EditText
import androidx.appcompat.app.AlertDialog
import android.webkit.*
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.webkit.WebViewAssetLoader

/**
 * 100% Standalone Offline Hisab AI Android App
 * Runs completely locally with zero internet and zero server connection.
 * All HTML, CSS, JavaScript, and local store databases are embedded directly in the APK.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var assetLoader: WebViewAssetLoader

    private var pendingDownload: ByteArray? = null
    private val saveFileLauncher = registerForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        val bytes = pendingDownload
        pendingDownload = null
        if (uri != null && bytes != null) {
            try { contentResolver.openOutputStream(uri)?.use { it.write(bytes) } }
            catch (error: Exception) { Toast.makeText(this, "Could not save backup", Toast.LENGTH_LONG).show() }
        }
    }

    fun saveDownload(name: String, base64: String) {
        runOnUiThread {
            if (pendingDownload != null) return@runOnUiThread
            try {
                pendingDownload = android.util.Base64.decode(base64, android.util.Base64.DEFAULT)
                saveFileLauncher.launch(name.substringAfterLast('/').take(150).ifEmpty { "hisab-backup.json" })
            } catch (error: Exception) { pendingDownload = null }
        }
    }

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingPermissionRequest: PermissionRequest? = null

    // Local Standalone URL served securely via WebViewAssetLoader
    private val standaloneAppUrl = "https://appassets.androidplatform.net/app.html"

    // File Picker Activity Result Launcher (for CSV statements)
    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (filePathCallback != null) {
            val results = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            filePathCallback?.onReceiveValue(results)
            filePathCallback = null
        }
    }

    // Microphone Permission Launcher
    private val micPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            pendingPermissionRequest?.grant(pendingPermissionRequest?.resources)
            Toast.makeText(this, "Microphone enabled for Hisab Voice AI", Toast.LENGTH_SHORT).show()
        } else {
            pendingPermissionRequest?.deny()
            Toast.makeText(this, "Microphone permission denied", Toast.LENGTH_SHORT).show()
        }
        pendingPermissionRequest = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Initialize WebViewAssetLoader to intercept /assets/ and / and serve from APK
        assetLoader = WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        initViews()
        if (BuildConfig.ONLINE_EDITION) {
            findViewById<android.widget.Button>(R.id.connectServerButton).apply {
                visibility = View.VISIBLE
                setOnClickListener { showServerDialog() }
            }
        }
        setupWebView()
        setupSwipeRefresh()
        setupBackNavigation()


        loadStandaloneApp()
    }

    private fun initViews() {
        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)
        swipeRefresh = findViewById(R.id.swipeRefreshLayout)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.allowFileAccessFromFileURLs = false
        settings.allowUniversalAccessFromFileURLs = false
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        // Register Native Android JS Interface
        if (!BuildConfig.ONLINE_EDITION) webView.addJavascriptInterface(WebAppInterface(this), "AndroidBridge")

        // Setup WebChromeClient
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                    swipeRefresh.isRefreshing = false
                }
            }

            // WebRTC Voice Recording Permission Request
            override fun onPermissionRequest(request: PermissionRequest?) {
                if (request == null) return
                for (res in request.resources) {
                    if (res == PermissionRequest.RESOURCE_AUDIO_CAPTURE) {
                        if (ContextCompat.checkSelfPermission(
                                this@MainActivity,
                                Manifest.permission.RECORD_AUDIO
                            ) == PackageManager.PERMISSION_GRANTED
                        ) {
                            request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                        } else {
                            pendingPermissionRequest = request
                            micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                        }
                        return
                    }
                }
                request.grant(request.resources)
            }

            // Native CSV File Chooser
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }

                try {
                    filePickerLauncher.launch(intent)
                } catch (e: ActivityNotFoundException) {
                    this@MainActivity.filePathCallback = null
                    Toast.makeText(this@MainActivity, "No file manager found", Toast.LENGTH_SHORT).show()
                    return false
                }
                return true
            }
        }

        // Setup WebViewClient with AssetLoader for 100% Offline Loading
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val url = request?.url ?: return null
                val response = assetLoader.shouldInterceptRequest(url)
                if (response != null) return response

                // Direct fallback for local assets on appassets.androidplatform.net
                if (url.host == "appassets.androidplatform.net") {
                    val rawPath = url.path?.removePrefix("/assets/")?.removePrefix("/") ?: ""
                    try {
                        val stream = assets.open(rawPath)
                        val mimeType = when {
                            rawPath.endsWith(".html") -> "text/html"
                            rawPath.endsWith(".css") -> "text/css"
                            rawPath.endsWith(".js") -> "application/javascript"
                            rawPath.endsWith(".svg") -> "image/svg+xml"
                            rawPath.endsWith(".png") -> "image/png"
                            rawPath.endsWith(".json") -> "application/json"
                            else -> "application/octet-stream"
                        }
                        return WebResourceResponse(mimeType, "UTF-8", stream)
                    } catch (e: Exception) {
                        // ignore and return null
                    }
                }
                return null
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false

                // 1. WhatsApp Intent (wa.me or whatsapp://)
                if (url.startsWith("https://wa.me/") || url.startsWith("whatsapp://")) {
                    return openExternalIntent(url, "com.whatsapp")
                }

                // 2. SMS Intent (sms:)
                if (url.startsWith("sms:")) {
                    return openSmsIntent(url)
                }

                // 3. Phone Call Intent (tel:)
                if (url.startsWith("tel:")) {
                    val intent = Intent(Intent.ACTION_DIAL, Uri.parse(url))
                    startActivity(intent)
                    return true
                }

                // 4. Mail Intent (mailto:)
                if (url.startsWith("mailto:")) {
                    val intent = Intent(Intent.ACTION_SENDTO, Uri.parse(url))
                    startActivity(intent)
                    return true
                }

                val target = Uri.parse(url)
                if (BuildConfig.ONLINE_EDITION && target.scheme in listOf("http", "https")) {
                    val server = Uri.parse(getSharedPreferences("hisab_prefs", MODE_PRIVATE).getString("custom_server", ""))
                    if (target.scheme != server.scheme || target.host != server.host || target.port != server.port) {
                        return openExternalIntent(url)
                    }
                }
                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                swipeRefresh.isRefreshing = false
                webView.visibility = View.VISIBLE
                if (!BuildConfig.ONLINE_EDITION && Uri.parse(url).host == "appassets.androidplatform.net") {
                    webView.evaluateJavascript("""
                        if (!window.hisabNativeDownloads) {
                            window.hisabNativeDownloads = true;
                            document.addEventListener('click', async function(event) {
                                const a = event.target.closest('a[download]');
                                if (!a || !a.href.startsWith('blob:')) return;
                                event.preventDefault();
                                const blob = await fetch(a.href).then(r => r.blob());
                                const reader = new FileReader();
                                reader.onload = () => AndroidBridge.saveDownload(a.download, reader.result.split(',')[1]);
                                reader.readAsDataURL(blob);
                            }, true);
                        }
                    """.trimIndent(), null)
                }
            }
        }
    }

    private fun setupSwipeRefresh() {
        swipeRefresh.setColorSchemeResources(R.color.primary)
        swipeRefresh.setOnRefreshListener {
            webView.reload()
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    private fun requestMicPermissionIfNeeded() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.RECORD_AUDIO),
                101
            )
        }
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        if (BuildConfig.ONLINE_EDITION) menu.add("Connect to server")
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        if (item.title == "Connect to server") { showServerDialog(); return true }
        return super.onOptionsItemSelected(item)
    }

    private fun validServer(value: String): Boolean {
        val uri = Uri.parse(value)
        val host = uri.host ?: return false
        val privateHost = host == "localhost" || host == "10.0.2.2" || host.startsWith("127.") ||
            host.startsWith("192.168.") || host.startsWith("10.") ||
            Regex("172\\.(1[6-9]|2[0-9]|3[01])\\..+").matches(host)
        return uri.userInfo == null && (uri.scheme == "https" || (uri.scheme == "http" && privateHost))
    }

    private fun showServerDialog() {
        val prefs = getSharedPreferences("hisab_prefs", MODE_PRIVATE)
        val input = EditText(this).apply {
            hint = "https://your-server.com or http://192.168.1.10:8099"
            setText(prefs.getString("custom_server", ""))
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_URI
        }
        val dialog = AlertDialog.Builder(this).setTitle("Connect Hisab AI")
            .setMessage("Enter your Hisab AI server address. For a local server, use your computer's Wi-Fi IP and port 8099. Both devices must use the same Wi-Fi.")
            .setView(input).setPositiveButton("Connect", null).setNegativeButton("Cancel", null).create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val url = input.text.toString().trim().trimEnd('/')
                if (!validServer(url)) { input.error = "Use HTTPS, or HTTP on your local network" }
                else { prefs.edit().putString("custom_server", url).apply(); dialog.dismiss(); webView.loadUrl(url + "/") }
            }
        }
        dialog.show()
    }

    private fun loadStandaloneApp() {
        if (!BuildConfig.ONLINE_EDITION) { webView.loadUrl(standaloneAppUrl); return }
        val server = getSharedPreferences("hisab_prefs", MODE_PRIVATE).getString("custom_server", "") ?: ""
        if (validServer(server)) webView.loadUrl(server.trimEnd('/') + "/") else showServerDialog()
    }

    private fun openExternalIntent(url: String, targetPackage: String? = null): Boolean {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                if (targetPackage != null) setPackage(targetPackage)
            }
            startActivity(intent)
            return true
        } catch (e: Exception) {
            return try {
                val fallbackIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                startActivity(fallbackIntent)
                true
            } catch (err: Exception) {
                Toast.makeText(this, "Could not open WhatsApp. Is it installed?", Toast.LENGTH_SHORT).show()
                false
            }
        }
    }

    private fun openSmsIntent(url: String): Boolean {
        try {
            val intent = Intent(Intent.ACTION_SENDTO, Uri.parse(url))
            startActivity(intent)
            return true
        } catch (e: Exception) {
            Toast.makeText(this, "No SMS app found", Toast.LENGTH_SHORT).show()
            return false
        }
    }
}
