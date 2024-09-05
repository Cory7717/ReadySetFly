module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      "nativewind/babel",
      "@babel/plugin-transform-runtime" // Optional: can be helpful for Hermes
    ],
  };
};

// module.exports = function (api) {
//   api.cache(true);
//   return {
//     presets: ['babel-preset-expo'],
//     plugins: [
//       'nativewind/babel',
//       '@babel/plugin-transform-runtime',
//       ['module:react-native-dotenv', {
//         "moduleName": "@env",
//         "path": ".env",
//         "blocklist": null,
//         "allowlist": null,
//         "safe": false,
//         "allowUndefined": true,
//       }]
//     ],
//   };
// };
