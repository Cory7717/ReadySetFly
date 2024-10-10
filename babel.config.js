module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'module:react-native-dotenv', // For environment variables
      'nativewind/babel', // For NativeWind styling
    ],
  };
};
