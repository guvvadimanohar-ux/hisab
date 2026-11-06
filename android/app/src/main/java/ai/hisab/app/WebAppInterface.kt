package ai.hisab.app

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.webkit.JavascriptInterface
import android.widget.Toast

/**
 * JavaScript Interface exposing native Android capabilities to Hisab AI Web Frontend.
 */
class WebAppInterface(private val context: Context) {

    @JavascriptInterface
    fun saveDownload(name: String, base64: String) {
        (context as? MainActivity)?.saveDownload(name, base64)
    }

    @JavascriptInterface
    fun showToast(message: String) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }

    @JavascriptInterface
    fun shareText(title: String, text: String) {
        val sendIntent = Intent().apply {
            action = Intent.ACTION_SEND
            putExtra(Intent.EXTRA_TITLE, title)
            putExtra(Intent.EXTRA_TEXT, text)
            type = "text/plain"
        }
        val shareIntent = Intent.createChooser(sendIntent, title)
        shareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(shareIntent)
    }

    @JavascriptInterface
    fun vibrate(durationMs: Long = 50) {
        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(durationMs)
        }
    }

    @JavascriptInterface
    fun isNativeAndroid(): Boolean {
        return true
    }

    @JavascriptInterface
    fun setCustomServer(url: String) {
        val prefs = context.getSharedPreferences("hisab_prefs", Context.MODE_PRIVATE)
        if (url.trim().isEmpty()) {
            prefs.edit().remove("custom_server").apply()
        } else {
            prefs.edit().putString("custom_server", url.trim()).apply()
        }
    }

    @JavascriptInterface
    fun getCustomServer(): String {
        val prefs = context.getSharedPreferences("hisab_prefs", Context.MODE_PRIVATE)
        return prefs.getString("custom_server", "") ?: ""
    }
}
