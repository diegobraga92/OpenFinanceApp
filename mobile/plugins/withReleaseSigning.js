/**
 * Config plugin: sign the Android **release** APK with a private keystore
 * instead of the publicly-known Android debug keystore.
 *
 * Google Play Protect blocks sideloaded APKs signed with the debug/test key
 * (`androiddebugkey`/`android`) because that key is shared and public. Using a
 * private release keystore stops Play Protect from flagging the APK as
 * "signed with a test key".
 *
 * Credentials are read from Gradle project properties (never hard-coded), so
 * they can be injected from CI secrets or `gradle.properties`:
 *
 *   - PUDIM_RELEASE_STORE_FILE
 *   - PUDIM_RELEASE_STORE_PASSWORD
 *   - PUDIM_RELEASE_KEY_ALIAS
 *   - PUDIM_RELEASE_KEY_PASSWORD
 *
 * When no keystore is configured the release build falls back to the debug
 * keystore, so local `expo run:android` keeps working out of the box.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withReleaseSigning(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const filePath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'build.gradle',
      );
      let gradle = fs.readFileSync(filePath, 'utf8');

      if (!gradle.includes('PUDIM_RELEASE_STORE_FILE')) {
        // 1. Add a `release` signing config alongside the generated `debug` one.
        gradle = gradle.replace(
          [
            '        debug {',
            "            storeFile file('debug.keystore')",
            "            storePassword 'android'",
            "            keyAlias 'androiddebugkey'",
            "            keyPassword 'android'",
            '        }',
          ].join('\n'),
          [
            '        debug {',
            "            storeFile file('debug.keystore')",
            "            storePassword 'android'",
            "            keyAlias 'androiddebugkey'",
            "            keyPassword 'android'",
            '        }',
            '        release {',
            "            if (project.hasProperty('PUDIM_RELEASE_STORE_FILE')) {",
            "                storeFile file(project.property('PUDIM_RELEASE_STORE_FILE'))",
            "                storePassword project.property('PUDIM_RELEASE_STORE_PASSWORD')",
            "                keyAlias project.property('PUDIM_RELEASE_KEY_ALIAS')",
            "                keyPassword project.property('PUDIM_RELEASE_KEY_PASSWORD')",
            '            }',
            '        }',
          ].join('\n'),
        );

        // 2. Point the release build type at the release keystore when one is
        //    configured, otherwise keep the debug fallback.
        gradle = gradle.replace(
          [
            '        release {',
            '            // Caution! In production, you need to generate your own keystore file.',
            '            // see https://reactnative.dev/docs/signed-apk-android.',
            '            signingConfig signingConfigs.debug',
          ].join('\n'),
          [
            '        release {',
            '            // Caution! In production, you need to generate your own keystore file.',
            '            // see https://reactnative.dev/docs/signed-apk-android.',
            "            signingConfig project.hasProperty('PUDIM_RELEASE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
          ].join('\n'),
        );

        fs.writeFileSync(filePath, gradle);
      }

      return config;
    },
  ]);
};
