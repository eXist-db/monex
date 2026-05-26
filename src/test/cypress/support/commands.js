/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --

Cypress.Commands.add('loginApi', () => {
  // Create base64 encoded credentials for Basic Auth
  const credentials = btoa('admin:')

  cy.session(
    'login',
    () => {
      cy.request({
        followRedirect: false,
        method: 'POST',
        url: 'index.html',
        form: true,
        body: {
          user: 'admin',
          password: '',
          duration: 'P7D'
        }
      }).then(({ body, headers, status }) => {
        cy.log('Response Status:', status)
        cy.log('Response Headers:', headers)
        cy.log('Response Body:', body)

        const sessionCookie = headers['set-cookie']?.find(cookie => cookie.startsWith('JSESSIONID='))
        if (sessionCookie) {
          const sessionId = sessionCookie.split(';')[0]
          cy.setCookie('JSESSIONID', sessionId)
        } else {
          cy.log('No session cookie found')
        }
      })
    },
    {
      validate() {
        cy.visit('index.html')
        cy.contains('h1', 'Monitoring').should('be.visible')
      },
      cacheAcrossSpecs: true
    }
  )
})

function existRootUrl () {
  const baseUrl = new URL(Cypress.config('baseUrl'))
  return `${baseUrl.protocol}//${baseUrl.host}/exist`
}

function runningQueryIdsFromStatus (xml) {
  const section = xml.match(/<jmx:RunningQueries>([\s\S]*?)<\/jmx:RunningQueries>/)
  if (!section) {
    return []
  }
  const ids = []
  const re = /<jmx:id>(\d+)<\/jmx:id>/g
  let match
  while ((match = re.exec(section[1])) !== null) {
    ids.push(parseInt(match[1], 10))
  }
  return [...new Set(ids)]
}

Cypress.Commands.add('startBackgroundRestQuery', (query) => {
  cy.task('startBackgroundRestQuery', { existRoot: existRootUrl(), query })
})

Cypress.Commands.add('waitForJmxRunningQuery', (options = {}) => {
  const timeout = options.timeout || 30000
  const interval = options.interval || 500

  function poll (start) {
    return cy.window().its('JMX_INSTANCES.0.token').then((token) => {
      return cy.request(`${existRootUrl()}/status?c=processes&token=${token}`).then((resp) => {
        const ids = runningQueryIdsFromStatus(resp.body)
        if (ids.length > 0) {
          return cy.wrap(ids[0])
        }
        if (Date.now() - start > timeout) {
          throw new Error(`Timed out after ${timeout}ms waiting for a running query in JMX`)
        }
        return cy.wait(interval).then(() => poll(start))
      })
    })
  }

  return poll(Date.now())
})

Cypress.Commands.add('killRunningQueryViaJmx', (queryId) => {
  cy.window().its('JMX_INSTANCES.0.token').then((token) => {
    cy.request({
      url: `${existRootUrl()}/status`,
      qs: {
        operation: 'killQuery',
        mbean: 'org.exist.management.exist:type=ProcessReport',
        token,
        args: queryId
      }
    })
  })
})

Cypress.Commands.add('skipUnlessConsoleModule', () => {
  const baseUrl = new URL(Cypress.config('baseUrl'))
  const existRoot = `${baseUrl.protocol}//${baseUrl.host}/exist`
  cy.request({
    method: 'GET',
    url: `${existRoot}/rest/db`,
    auth: { username: 'admin', password: '' },
    qs: {
      _query: 'import module namespace console="http://exist-db.org/xquery/console"; true()'
    },
    failOnStatusCode: false
  }).then(function (response) {
    if (response.status !== 200) {
      cy.log('Skipping: console XQuery module not available on this eXist instance')
      this.skip()
    }
  })
})
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This is will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })
