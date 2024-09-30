const { getDataConnect, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'default',
  service: 'rsf_app_backup',
  location: 'us-central1'
};
exports.connectorConfig = connectorConfig;

