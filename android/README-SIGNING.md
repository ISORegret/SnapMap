# Signed APK for SnapMap (one-time setup)

Do this **once**. After that, you can build a signed release APK without the Android Studio wizard.

## 1. Create the keystore

Open a terminal in the **android** folder of the project, then run:

**Windows (PowerShell):**
```powershell
cd android
keytool -genkey -v -keystore snapmap-release.keystore -alias snapmap -keyalg RSA -keysize 2048 -validity 10000
```

**Mac/Linux:**
```bash
cd android
keytool -genkey -v -keystore snapmap-release.keystore -alias snapmap -keyalg RSA -keysize 2048 -validity 10000
```

When prompted:
- **Keystore password:** pick a password (e.g. something you’ll remember) and use it again when asked.
- **Key password:** press Enter to use the same password as the keystore.
- Fill in name, org, etc. (any value is fine).

This creates `snapmap-release.keystore` in the `android` folder. **Back up this file and the password** somewhere safe.

## 2. Add your password to key.properties

1. In the **android** folder, copy the example file:
   - **Windows:** `copy key.properties.example key.properties`
   - **Mac/Linux:** `cp key.properties.example key.properties`

2. Open **key.properties** and replace:
   - `YOUR_KEYSTORE_PASSWORD` with the keystore password you chose.
   - `YOUR_KEY_PASSWORD` with the same password (unless you set a different key password).

Save the file. Don’t commit `key.properties` or the `.keystore` file to git (they’re in .gitignore).

## 3. Build a signed release APK

**From Android Studio:**  
**Build → Build Bundle(s) / APK(s) → Build APK(s)**  
Choose the **release** build variant if asked. The signed APK is at:

**`android/app/build/outputs/apk/release/app-release.apk`**

**From terminal (from project root):**
```bash
npm run build:android
cd android
./gradlew assembleRelease
```
(On Windows: `.\gradlew.bat assembleRelease`)

Same output: `android/app/build/outputs/apk/release/app-release.apk`.

---

You can now share or upload that APK; no need to use “Generate Signed App Bundle or APK” again unless you want to change the keystore.
