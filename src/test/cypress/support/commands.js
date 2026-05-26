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

function parseExistInteger (body) {
  const text = String(body || '').trim()
  const match = text.match(/<exist:value[^>]*>(\d+)<\/exist:value>/)
  if (match) {
    return parseInt(match[1], 10)
  }
  const parsed = parseInt(text, 10)
  return Number.isFinite(parsed) ? parsed : null
}

Cypress.Commands.add('ensureMonexDetailsSnapshot', (instance) => {
  return cy.fixture('monex-details-snapshot.json').then((meta) => {
    const targetInstance = instance || meta.instance
      return cy.fixture('monex-details-snapshot.xq').then((queryTemplate) => {
      const query = queryTemplate.replace(/__INSTANCE__/g, targetInstance)
      return cy.request({
        method: 'POST',
        url: `${existRootUrl()}/rest/db`,
        auth: { username: 'admin', password: '' },
        form: true,
        body: { _query: query }
      }).then((response) => {
        const timestamp = parseExistInteger(response.body)
        expect(timestamp, 'snapshot timestamp').to.eq(meta.timestamp)
        const verifyQuery = [
          'xquery version "3.1";',
          'declare namespace jmx = "http://exist-db.org/jmx";',
          `if (exists(collection("/db/apps/monex/data/${targetInstance}")/jmx:jmx)) then "ok" else error(QName("", "missing-snapshot"))`
        ].join(' ')
        return cy.request({
          method: 'POST',
          url: `${existRootUrl()}/rest/db`,
          auth: { username: 'admin', password: '' },
          form: true,
          body: { _query: verifyQuery },
          retryOnStatusCodeFailure: true,
          timeout: 30000
        }).then((verifyResponse) => {
          expect(String(verifyResponse.body || '')).to.contain('ok')
          return cy.wrap({ ...meta, instance: targetInstance, timestamp })
        })
      })
    })
  })
})

Cypress.Commands.add('visitMonexDetailsPage', ({ timestamp, instance = 'localhost' } = {}) => {
  cy.visit(`details.html?timestamp=${timestamp}&instance=${instance}`)
})

Cypress.Commands.add('visitMonexTimelinesPage', ({ instance = 'localhost', start, end, timelineStart, timelineEnd } = {}) => {
  const rangeStart = start || timelineStart
  const rangeEnd = end || timelineEnd
  const qs = { instance }
  if (rangeStart && rangeEnd) {
    qs.start = rangeStart
    qs.end = rangeEnd
  }
  cy.visit({ url: 'timelines.html', qs })
})

Cypress.Commands.add('latestMonexSnapshotTimestamp', (instance = 'localhost') => {
  const existRoot = existRootUrl()
  const query = [
    'xquery version "3.1";',
    'import module namespace app="http://exist-db.org/apps/admin/templates" at "/db/apps/monex/modules/app.xql";',
    'declare namespace jmx = "http://exist-db.org/jmx";',
    `let $col := "/db/apps/monex/data/${instance}" return`,
    'if (not(util:collection-available($col))) then () else (',
    '  for $rec in collection($col)/jmx:jmx',
    '  order by xs:dateTime($rec/jmx:timestamp) descending',
    '  return app:time-to-milliseconds(xs:dateTime($rec/jmx:timestamp))',
    ')[1]'
  ].join(' ')

  return cy.request({
    method: 'GET',
    url: `${existRoot}/rest/db`,
    auth: { username: 'admin', password: '' },
    qs: { _query: query },
    failOnStatusCode: false
  }).then((response) => {
    if (response.status !== 200) {
      return null
    }
    const body = String(response.body || '').trim()
    if (!body || body === '()' || body === 'null') {
      return null
    }
    const parsed = parseInt(body, 10)
    return Number.isFinite(parsed) ? parsed : null
  })
})

Cypress.Commands.add('visitLatestDetailsPage', (instance = 'localhost') => {
  cy.latestMonexSnapshotTimestamp(instance).then((timestamp) => {
    if (!timestamp) {
      cy.log(`No stored Monex snapshots for ${instance}; skipping details page test`)
      cy.wrap(null, { log: false }).then(function () {
        this.skip()
      })
      return
    }
    cy.visit(`details.html?timestamp=${timestamp}&instance=${instance}`)
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
