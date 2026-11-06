# Hisab AI — 100% Standalone Offline Android App 📱

This is a **completely standalone, offline Android application** for Hisab AI. It requires:
- ❌ **NO backend server**
- ❌ **NO Wi-Fi connection**
- ❌ **NO internet connection**
- ✅ **Works 100% in Airplane Mode**

All assets (HTML, CSS, JavaScript, Store Database Engine, Charts, and Analytics) are packaged **directly inside the APK**.

---

## 🏗️ Architecture & Offline Capabilities

| Feature | How It Works Offline |
| :--- | :--- |
| **📦 Embedded Engine** | All web assets are bundled inside `android/app/src/main/assets/` and loaded securely via `androidx.webkit.WebViewAssetLoader` from `https://appassets.androidplatform.net/assets/index.html`. |
| **💾 Persistent On-Device Database** | Customer profiles, manual transactions, and Udhaar loans are saved directly to device storage (`localStorage` / DOM Storage) via `offlineEngine.js`. Data persists across phone restarts and app updates. |
| **📊 Real-Time Financial Analytics** | Instant calculation of Total Inflow (Jama), Outflow (Kharcha), Net Balance, Repeated Customers, and Category Spending Splits without calling any remote API. |
| **💬 Native WhatsApp Dues Reminder** | Directly triggers native Android `com.whatsapp` package intent with customer mobile number and drafted polite payment reminder message. |
| **📱 Native SMS Dues Reminder** | Dispatches native `android.intent.action.SENDTO` (`sms:`) intent to the device's default SMS app. |
| **📂 Offline CSV Bank Statement Ingestion** | Uses native file picker (`WebChromeClient.onShowFileChooser`) to let merchants select bank/UPI statements from their phone storage and parses/imports rows directly on the phone. |
| **🎙️ Offline Voice Commands & Smart Assistant** | Answers store questions ("Who is the top paying customer?", "Total udhaar balance?", "Repeated customers?") directly from local ledger data. |
| **📥 One-Click Data Backup / Export** | Exports full JSON store backup files directly into the Android device's Downloads folder. |

---

## 🛠️ How to Build the APK in Android Studio

1. **Open the Project**:
   - Launch **Android Studio**.
   - Click **Open** (or `File > Open`).
   - Select the `android` folder: `/Users/vakkantivishnu/Downloads/hisabai/android`.
   - Android Studio will automatically sync Gradle and prepare the project.

2. **Run on an Android Phone or Emulator**:
   - Plug in your Android phone via USB (with **USB Debugging** enabled in Developer Options) or choose an Android Emulator.
   - Click the green **Run (▶)** button in Android Studio.
   - The app will install and open immediately. Turn on **Airplane Mode** to verify that everything works with zero internet!

3. **Generate Standalone APK File**:
   - In Android Studio's top menu, go to:
     **Build > Build Bundle(s) / APK(s) > Build APK(s)**
   - When the build finishes, click the **locate** link in the bottom-right notification.
   - Copy `app-debug.apk` to any Android phone and install it directly!

---

## 📁 Source Code Directory Structure

```
android/
├── build.gradle                          # Root Gradle build script
├── settings.gradle                       # Gradle project settings
├── gradle.properties                     # Performance flags
└── app/
    ├── build.gradle                      # App module (Android SDK 34, AndroidX, WebKit)
    └── src/main/
        ├── AndroidManifest.xml           # Permissions (Mic, Audio, Storage, WhatsApp/SMS Intents)
        ├── java/ai/hisab/app/
        │   ├── MainActivity.kt           # Native Kotlin Activity with WebViewAssetLoader
        │   └── WebAppInterface.kt        # Native Android Bridge (Toasts, Share, Vibration)
        ├── assets/                       # 100% Embedded Offline Web Assets
        │   ├── index.html                # Standalone UI
        │   ├── css/app.css               # Styling & design system
        │   ├── js/merchantApp.js         # Merchant Controller
        │   ├── js/offlineEngine.js       # Local persistent storage & analytics engine
        │   └── assets/icon.svg           # Rupee branding icon
        └── res/
            ├── values/                   # strings.xml, colors.xml, themes.xml
            ├── layout/activity_main.xml  # SwipeRefreshLayout + Offline WebView
            └── mipmap-anydpi-v26/        # Adaptive launcher icons
```
