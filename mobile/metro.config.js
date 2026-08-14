/**
 * Metro configuration for the Expo app.
 *
 * The UI dictionary lives in the shared repo-level `shared/i18n` directory,
 * outside the mobile project root. `watchFolders` lets Metro watch and bundle
 * those files (and hot-reload them in development).
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

module.exports = config;
