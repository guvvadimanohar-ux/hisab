#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/dist/.mac-build"
xcrun swiftc -O -target arm64-apple-macos12.0 -module-cache-path "$ROOT/dist/.mac-build/cache" "$ROOT/macos/HisabAI.swift" -o "$ROOT/dist/.mac-build/HisabAI" -framework Cocoa -framework WebKit
for EDITION in Offline Online; do
  STAGE="$(mktemp -d /private/tmp/hisab-dmg.XXXXXX)"
  trap 'rm -rf "$STAGE"' EXIT
  APP="$STAGE/Hisab AI $EDITION.app"
  mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/Web"
  COPYFILE_DISABLE=1 cp "$ROOT/dist/.mac-build/HisabAI" "$APP/Contents/MacOS/HisabAI"
  if [ "$EDITION" = Offline ]; then
    COPYFILE_DISABLE=1 cp -R "$ROOT/android/app/src/main/assets/." "$APP/Contents/Resources/Web/"
  fi
  python3 - "$APP" "$EDITION" <<'PYTHON'
import plistlib, re, sys
from pathlib import Path
app, edition = Path(sys.argv[1]), sys.argv[2]
for page in (app/'Contents/Resources/Web').glob('*.html'):
    page.write_text(re.sub(r'((?:src|href)=["\'])/(?!/)', r'\1./', page.read_text()))
info = dict(CFBundleExecutable='HisabAI', CFBundleIdentifier='ai.hisab.desktop.'+edition.lower(),
    CFBundleName='Hisab AI '+edition, CFBundlePackageType='APPL', CFBundleShortVersionString='1.0.0',
    CFBundleVersion='1', LSMinimumSystemVersion='12.0', NSHighResolutionCapable=True,
    HisabOnlineEdition=edition=='Online',
    NSMicrophoneUsageDescription='Use your microphone for Hisab AI voice commands.')
if edition == 'Online':
    info['NSAppTransportSecurity'] = {'NSAllowsLocalNetworking': True,
        'NSExceptionDomains': {'localhost': {'NSExceptionAllowsInsecureHTTPLoads': True},
                               '127.0.0.1': {'NSExceptionAllowsInsecureHTTPLoads': True}}}
with (app/'Contents/Info.plist').open('wb') as f: plistlib.dump(info, f)
PYTHON
  xattr -cr "$APP"
  codesign --force --deep --sign - "$APP"
  codesign --verify --deep --strict "$APP"
  ln -s /Applications "$STAGE/Applications"
  hdiutil create -volname "Hisab AI $EDITION" -srcfolder "$STAGE" -ov -format UDZO "$ROOT/dist/Hisab-AI-$EDITION-macOS.dmg"
  COPYFILE_DISABLE=1 cp -R "$APP" "$ROOT/dist/"
  rm -rf "$STAGE"
  trap - EXIT
done
