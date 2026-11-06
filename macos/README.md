# Hisab AI — offline and online installers

The four installers are in `dist/`:

- `Hisab-AI-Offline-Android.apk`: standalone local ledger, Android 7 or newer.
- `Hisab-AI-Online-Android.apk`: connects to your Hisab AI server, Android 7 or newer.
- `Hisab-AI-Offline-macOS.dmg`: standalone local ledger, Apple Silicon, macOS 12 or newer.
- `Hisab-AI-Online-macOS.dmg`: connects to your Hisab AI server, Apple Silicon, macOS 12 or newer.

Both editions can be installed together. They use different app identifiers and separate storage. Offline records do not automatically synchronize to the online account.

## Installation

Android: copy the APK to your phone, open it, and allow installation from that source when Android asks. These are debug-signed test builds, not Google Play release builds.

Mac: open the DMG and drag its app into Applications. These apps are ad-hoc signed, not Apple-notarized. If macOS blocks opening, review and approve it in System Settings > Privacy & Security.

## Offline edition

Open the app directly to the merchant dashboard. Customers, transactions, loans and repayments are stored on the device. CSV import and JSON backup export use native file pickers. The assistant calculates answers from local ledger data. Voice recognition depends on the platform; server AI and live bank synchronization are not available offline.

## Online edition without hosting

1. On your Mac, start the existing backend from this project with `npm start` (Node.js 22 or newer required).
2. Mac app: select **Connect to server** in the app menu and enter `http://localhost:8099`.
3. Android app: tap **Connect to server**, then enter `http://YOUR-MAC-WIFI-IP:8099`. Find that IP in macOS System Settings > Wi-Fi > Details > TCP/IP. Both devices must use the same Wi-Fi. Android's `localhost` refers to the phone, not your Mac. Permit the server through your Mac firewall if prompted.
4. Register or sign in on the server's Hisab website and open the Merchant Portal. Keep the server running while using the online apps.

For a hosted server later, enter its HTTPS origin, for example `https://your-hisab-domain.com`. No server is deployed by these installers. Real bank access and external AI require the corresponding backend configuration; the project's default mock bank mode uses demonstration data. Use local HTTP only on trusted Wi-Fi, and HTTPS for public access.

## Rebuild

Mac: `./scripts/build-macos.sh` requires Xcode Command Line Tools and generates both DMGs.

Android: from the `android` directory, use installed Gradle 8.13 with `:app:assembleOfflineDebug :app:assembleOnlineDebug`, then copy the APKs from `app/build/outputs/apk/offline/debug/` and `app/build/outputs/apk/online/debug/` into `dist/`.
