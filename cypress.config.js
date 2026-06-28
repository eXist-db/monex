/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
import { defineConfig } from 'cypress'
import setupPlugins from './src/test/cypress/plugins/index.js'

export default defineConfig({
  allowCypressEnv: false,
  fileServerFolder: 'src/main/xar-resources',
  fixturesFolder: 'src/test/cypress/fixtures',
  screenshotsFolder: 'target/cypress/screenshots',
  videosFolder: 'target/cypress/videos',
  downloadsFolder: 'target/cypress/downloads',
  projectId: 'snavwf',
  e2e: {
    setupNodeEvents (on, config) {
      return setupPlugins(on, config)
    },
    retries: {
      runMode: 2,
      openMode: 0
    },
    baseUrl: 'http://localhost:8080/exist/apps/monex',
    excludeSpecPattern: 'src/test/cypress/e2e/examples/*.js',
    specPattern: 'src/test/cypress/e2e/**/*.{js,jsx,ts,tsx}',
    supportFile: 'src/test/cypress/support/e2e.js',
  },
})
