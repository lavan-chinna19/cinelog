// Monorepo-aware Metro config: lets the app import @cinelog/shared from ../../packages.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// The web app hoists a newer React to the workspace root. React Native 0.81 needs
// exactly the React this app pins (19.1.0), and a second copy crashes the app at
// launch. Force every `react` import (including ones from react-native itself) to
// the app's own copy.
const singletons = ['react'];
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const base = moduleName.split('/')[0];
  if (singletons.includes(base)) {
    return context.resolveRequest({ ...context, originModulePath: path.join(projectRoot, 'index.js') }, moduleName, platform);
  }
  return defaultResolve ? defaultResolve(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
