const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');
const path = require('path');

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);

  // Add 'png' file extension to assetExts
  config.resolver.assetExts.push('png');

  // Resolve symlinks (especially for Windows environments)
  config.resolver.blockList = exclusionList([
    /node_modules\/.*\/node_modules\/react-native\/.*/,  // Exclude duplicate react-native instances
    /unsupportedIterableToArray\.js/,                   // Exclude the problematic file
  ]);

  // This ensures that symlinks and dependencies are properly handled
  config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'react-native': path.resolve(__dirname, 'node_modules/react-native'),
  };

  return config;
})();

