const { defineConfig } = require('cypress')

module.exports = defineConfig({
  fileServerFolder: 'src/main/xar-resources',
  fixturesFolder: 'src/test/cypress/fixtures',
  screenshotsFolder: 'src/test/cypress/screenshots',
  videosFolder: 'src/test/cypress/videos',
  projectId: 'snavwf',
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      return require('./src/test/cypress/plugins/index.js')(on, config)
    },
    baseUrl: 'http://localhost:8080/exist/apps/monex',
    excludeSpecPattern: 'src/test/cypress/e2e/examples/*.js',
    specPattern: 'src/test/cypress/e2e/**/*.{js,jsx,ts,tsx}',
    supportFile: 'src/test/cypress/support/e2e.js',
  },
})
