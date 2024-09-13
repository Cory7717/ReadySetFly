export default function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv', {
        moduleName: '@env',
        path: '.env',  // Ensure this path is correct
        allowlist: null,
        blocklist: null,
        safe: false,
        allowUndefined: true,
      }]
    ]
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
