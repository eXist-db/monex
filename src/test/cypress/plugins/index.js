/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
// ***********************************************************
// This example plugins/index.js can be used to load plugins
//
// You can change the location of this file or turn off loading
// the plugins file with the 'pluginsFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/plugins-guide
// ***********************************************************

// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)

export default (on, config) => {
  on('task', {
    log (message) {
      // eslint-disable-next-line no-console
      console.log(message)
      return null
    },
    startBackgroundRestQuery ({ existRoot, query }) {
      const url = new URL(`${existRoot}/rest/db`)
      url.searchParams.set('_query', query)
      fetch(url, {
        headers: { Authorization: 'Basic ' + Buffer.from('admin:').toString('base64') }
      }).catch(() => {})
      return null
    }
  })

  return config
}
