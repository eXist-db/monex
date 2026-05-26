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

function runningQueriesFromStatus (xml) {
  const section = xml.match(/<jmx:RunningQueries>([\s\S]*?)<\/jmx:RunningQueries>/)
  if (!section) {
    return []
  }
  const rows = []
  const rowRe = /<jmx:RunningQuery[^>]*>([\s\S]*?)<\/jmx:RunningQuery>/g
  let rowMatch
  while ((rowMatch = rowRe.exec(section[1])) !== null) {
    const block = rowMatch[1]
    const id = block.match(/<jmx:id>([^<]*)<\/jmx:id>/)
    const uri = block.match(/<jmx:requestURI>([^<]*)<\/jmx:requestURI>/)
    rows.push({
      id: id ? id[1] : '',
      requestURI: uri ? uri[1] : ''
    })
  }
  if (rows.length === 0) {
    const ids = runningQueryIdsFromStatus(xml)
    return ids.map((id) => ({ id: String(id), requestURI: '' }))
  }
  return rows
}

function trackRequestUriFromStatus (xml) {
  const match = xml.match(/<jmx:TrackRequestURI>\s*([^<]*)\s*<\/jmx:TrackRequestURI>/i)
  return match ? match[1] : '(missing)'
}

Cypress.Commands.add('logActivityDashboardDiagnostics', (label) => {
  const tag = label ? `[${label}] ` : ''

  cy.window({ log: false }).then((win) => {
    const vm = win.JMX.connection && win.JMX.connection.getViewModel()
    const runningQueries = vm && vm.jmx && vm.jmx.ProcessReport && vm.jmx.ProcessReport.RunningQueries
    const rows = runningQueries ? (win.ko.isObservable(runningQueries) ? runningQueries() : runningQueries) : []
    const dashboard = {
      viewModelReady: !!vm,
      trackRequestUri: vm && vm.jmx && vm.jmx.ProcessReport
        ? (win.ko.isObservable(vm.jmx.ProcessReport.TrackRequestURI)
          ? vm.jmx.ProcessReport.TrackRequestURI()
          : vm.jmx.ProcessReport.TrackRequestURI)
        : null,
      runningQueryRows: (rows || []).map((row) => ({
        id: win.JMX.util.jmxFieldText(win.JMX.util.runningQueryField(row, 'id')),
        requestURI: win.JMX.util.activityRequestUri(row),
        uriLabel: win.activityUriLabel ? win.activityUriLabel(row) : null
      })),
      visibleRunningRows: Cypress.$('.running-queries tbody tr:not(.activity-row-ended)').length,
      visibleUriLinks: Cypress.$('.running-queries .activity-uri-link:visible').length,
      flyoutOpen: vm && vm.activityFlyout ? vm.activityFlyout.open() : null
    }

    cy.task('log', `${tag}Dashboard activity state:\n${JSON.stringify(dashboard, null, 2)}`, { log: false })
  })

  cy.window({ log: false }).its('JMX_INSTANCES.0.token').then((token) => {
    if (!token) {
      cy.task('log', `${tag}JMX status: no token on window.JMX_INSTANCES`, { log: false })
      return
    }
    cy.request({
      url: `${existRootUrl()}/status?c=processes&token=${token}`,
      failOnStatusCode: false
    }).then((resp) => {
      const jmx = {
        trackRequestUri: trackRequestUriFromStatus(resp.body),
        runningQueries: runningQueriesFromStatus(resp.body)
      }
      cy.task('log', `${tag}JMX ProcessReport snapshot:\n${JSON.stringify(jmx, null, 2)}`, { log: false })
    })
  })
})

Cypress.Commands.add('waitForMonitoringViewModel', (options = {}) => {
  const timeout = options.timeout || 15000
  const interval = options.interval || 250
  const started = Date.now()

  const poll = () => {
    return cy.window({ log: false }).then((win) => {
      const vm = win.JMX.connection && win.JMX.connection.getViewModel()
      if (vm && vm.jmx && vm.activityFlyout) {
        return cy.wrap(vm, { log: false })
      }
      if (Date.now() - started > timeout) {
        cy.logActivityDashboardDiagnostics('waitForMonitoringViewModel timeout')
        throw new Error(`Dashboard view model not ready after ${timeout}ms`)
      }
      return cy.wait(interval, { log: false }).then(poll)
    })
  }

  return poll()
})

Cypress.Commands.add('seedMonitoringRunningQueryUri', (options = {}) => {
  const requestURI = options.requestURI ||
    '/exist/rest/db?_query=import%20module%20namespace%20util%3D%22http%3A%2F%2Fexist-db.org%2Fxquery%2Futil%22%3B%20util%3Await(1)'
  const queryId = options.id || 99001

  cy.window().then((win) => {
    const vm = win.JMX.connection.getViewModel()
    if (!vm) {
      cy.logActivityDashboardDiagnostics('seedMonitoringRunningQueryUri missing view model')
      throw new Error('Dashboard view model is not ready')
    }

    win.JMX.util.resetActivityBuffers()
    const pollData = win.JMX.util.fixjs({
      jmx: {
        ProcessReport: {
          RunningQueries: [{
            id: String(queryId),
            thread: 'cypress-uri-flyout',
            sourceKey: '/db/apps/monex/test',
            requestURI,
            terminating: 'false'
          }],
          RunningJobs: [],
          RecentQueryHistory: [],
          TrackRequestURI: 'true',
          HistoryTimespan: '120000',
          MinTime: '100'
        },
        LockManager: { WaitingThreads: [] }
      }
    })

    if (win.Monex && win.Monex.activity && win.Monex.activity.cleanupActivityTooltips) {
      win.Monex.activity.cleanupActivityTooltips()
    }
    win.ko.mapping.fromJS(pollData, vm)
    win.__cypressLastPollData = pollData
  })
})

Cypress.Commands.add('simulateMonitoringPollRefresh', () => {
  cy.window().then((win) => {
    const vm = win.JMX.connection.getViewModel()
    const pollData = win.__cypressLastPollData
    if (!vm || !pollData) {
      cy.logActivityDashboardDiagnostics('simulateMonitoringPollRefresh missing state')
      throw new Error('Cannot simulate poll refresh without seeded dashboard data')
    }
    if (win.Monex && win.Monex.activity && win.Monex.activity.cleanupActivityTooltips) {
      win.Monex.activity.cleanupActivityTooltips()
    }
    win.ko.mapping.fromJS(pollData, vm)
    if (vm.activityFlyout) {
      vm.activityFlyout.afterPoll()
    }
  })
})

Cypress.Commands.add('pauseMonitoringPoll', () => {
  cy.get('#pause-btn').then(($btn) => {
    if ($btn.hasClass('active')) {
      return
    }
    cy.wrap($btn).click()
    cy.get('#pause-btn').should('have.class', 'active')
  })
})

Cypress.Commands.add('waitForDashboardRunningQueryRow', (options = {}) => {
  const timeout = options.timeout || 30000
  cy.get('.workload-panel').scrollIntoView()
  cy.get('.running-queries tbody tr:not(.activity-row-ended)', { timeout })
    .should('have.length.at.least', 1)
})

Cypress.Commands.add('waitForDashboardActiveThreadStack', (options = {}) => {
  const timeout = options.timeout || 30000
  cy.waitForDashboardRunningQueryRow({ timeout })
  cy.contains('h4.activity-section-title', 'Active threads', { timeout })
    .closest('.activity-section')
    .find('.stack:visible')
    .should('have.length.at.least', 1)
})

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
          cy.logActivityDashboardDiagnostics('waitForJmxRunningQuery timeout')
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
