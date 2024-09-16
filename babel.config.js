module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv', {
        moduleName: '@env',
        path: '.env', // Ensure this path is correct
        allowlist: null,
        blocklist: null,
        safe: false,
        allowUndefined: false,  //Changed this to false based on chatGPT on Sept 15
       }],
      // Babel Transform Plugins for various modern JS features
      '@babel/plugin-transform-class-properties',
      '@babel/plugin-transform-nullish-coalescing-operator',
      '@babel/plugin-transform-optional-chaining',
      '@babel/plugin-transform-object-rest-spread',
      '@babel/plugin-transform-logical-assignment-operators',
      '@babel/plugin-transform-numeric-separator',
      '@babel/plugin-transform-async-generator-functions',
      // Optional: NativeWind (if you're using it)
      'nativewind/babel', // Only if you're using NativeWind for styling
      // Optional: Plugin to enable transform runtime for optimization
      '@babel/plugin-transform-runtime'
    ]
  };
};
