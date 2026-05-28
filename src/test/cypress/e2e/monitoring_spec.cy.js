/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
/// <reference types="cypress" />

describe('Monex index page', () => {
  beforeEach('log in', () => {
    cy.loginApi()
    cy.visit('/')
  })

  describe('monitoring page', () => {
    it('should load start page', () => {
      cy.get('h1')
        .contains('Monitoring')
        .url()
        .should('include', '/monex/index.html')
      cy.wait(1000)
      cy.get('#pause-btn').click()
      cy.get('[data-bind="text: jmx.Database.InstanceId"]').contains('exist')
      cy.get('#jmx-uptime').contains(/^\d*h\s\d*m$/)
    })

    it('should show capacity and activity panels', () => {
      cy.wait(1500)
      cy.get('#pause-btn').click()

      cy.get('.dashboard-host-row').should('be.visible')
      cy.contains('.box-title', 'JVM heap').should('be.visible')
      cy.contains('.box-title', 'Disk').should('be.visible')
      cy.contains('.box-title', 'CPU').should('be.visible')
      cy.contains('.box-title', 'Broker pool').should('be.visible')
      cy.contains('.box-title', 'Page Caches').should('be.visible')
      cy.contains('.box-title', 'Embeddings').should('be.visible')
      cy.contains('.box-title', 'Activity').should('be.visible')

      cy.get('.kpi-strip .kpi-label').contains('Status').should('be.visible')
      cy.get('.kpi-strip .kpi-label').contains('Brokers').should('be.visible')
      cy.get('.kpi-strip .kpi-label').contains('Queries').should('be.visible')
      cy.get('.kpi-strip .kpi-label').contains('Waiting').should('be.visible')
      cy.get('.kpi-strip .kpi-label').contains('Uptime').should('be.visible')
      cy.get('.dashboard-system-footer .database-status-label').should('not.exist')
    })

    it('should populate embeddings panel from JMX vector MBeans', () => {
      cy.waitForMonitoringViewModel({ timeout: 20000 })
      cy.get('#pause-btn').click()

      cy.window().then((win) => {
        const vm = win.JMX.connection.getViewModel()
        expect(vm.vector.available(), 'vector extension via JMX').to.eq(true)
        expect(vm.vector.total(), 'model count').to.be.greaterThan(0)
        expect(vm.vector.ready(), 'ready models').to.be.greaterThan(0)
        expect(vm.vectorStore && vm.vectorStore.available(), 'vector store').to.eq(true)

        const ready = win.Monex.kpi.readyVectorModels(vm.vector)
        expect(ready.length).to.be.greaterThan(0)
        const label = win.Monex.kpi.vectorModelLabel(ready[0])
        expect(label).to.match(/MiniLM-L6-v2/)

        expect(win.Monex.kpi.vectorEmbeddingsKpiText(vm.vector)).to.match(/^\d+ \/ \d+$/)
        expect(win.Monex.kpi.vectorEntriesKpiVisible(vm)).to.eq(true)
      })

      cy.get('.kpi-strip .kpi-label').contains('Models').should('not.exist')
      cy.get('.kpi-strip .kpi-label').contains('Vector entries').should('not.exist')

      cy.contains('.box-title', 'Embeddings')
        .parents('.box')
        .within(() => {
          cy.contains('.embedding-catalog-line', 'Catalog:').should('be.visible')
          cy.get('.embedding-models-table').contains('MiniLM-L6-v2').should('be.visible')
          cy.get('.embedding-dot.ready').should('exist')
          cy.get('.embedding-store-cell').should('have.attr', 'title').and('match', /vector\.dbx/)
        })
    })

    it('should format shared cache pool as memory with utilization bar', () => {
      cy.wait(1500)
      cy.get('#pause-btn').click()

      cy.contains('.panel-subhead', 'Pool memory').should('be.visible')
      cy.contains('.cache-pool-row', 'MB').should('be.visible')
      cy.contains('.cache-pool-row', '% of pool').should('be.visible')
      cy.get('.cache-pool-row .progress-bar').should('exist')
    })

    it('should list index page caches with tooltips and triage controls', () => {
      cy.wait(1500)
      cy.get('#pause-btn').click()

      cy.contains('.panel-subhead', 'Index page caches').should('be.visible')
      cy.get('.cache-file-row').should('have.length.at.least', 1)
      cy.get('.cache-file-row .cache-type').contains('BTREE').should('exist')

      cy.get('body').then(($body) => {
        if ($body.find('.cache-show-all').length) {
          cy.get('.cache-show-all').click()
          cy.get('.cache-file-row').should('have.length.at.least', 3)
          cy.get('.cache-show-all').contains('Show fewer caches').click()
          cy.get('.cache-show-all').contains('Show all').should('be.visible')
        }
      })
    })

    it('should use unified activity panel without idle thread placeholder', () => {
      cy.wait(1500)
      cy.get('#pause-btn').click()

      cy.contains('.activity-section-title', 'Recent queries').should('be.visible')
      cy.contains('No active threads').should('not.exist')
      cy.get('#jmx-recent-queries').should('exist')
    })

    it('should expose unified activity panel settings', () => {
      cy.wait(1500)
      cy.get('#pause-btn').click()

      cy.get('#recording-settings-btn').should('be.visible').click()
      cy.get('#recording-settings-modal').should('be.visible')
      cy.get('#recording-settings-modal .modal-title').contains('Server recording').should('be.visible')
      cy.get('.dashboard-toolbar').contains('label', 'Keep visible').should('be.visible')
      cy.get('#display-retention-preset option').should('have.length.at.least', 5)
      cy.get('#display-retention-preset').should('have.value', '300000')

      cy.get('#activity-panel-settings').should('not.exist')
      cy.contains('label', 'Slow query threshold').should('be.visible')
      cy.contains('label', 'Record on server for').should('be.visible')
      cy.contains('label', 'Record request URI').should('be.visible')
      cy.get('.activity-recording-fields-split').should('be.visible')
      cy.get('.activity-recording-footnote').should('be.visible')
      cy.get('#threshold-preset').should('not.be.disabled')
      cy.get('#history-preset').should('not.be.disabled')
      cy.get('#track-uri').should('not.be.disabled')
      cy.get('#configure').should('not.be.disabled')

      cy.get('#recording-settings-modal .close').click()
      cy.get('#recent-queries-settings-btn').should('be.visible').click()
      cy.get('#recording-settings-modal').should('be.visible')
      cy.get('#threshold-preset option').should('have.length.at.least', 5)
    })

    it('should accept recording threshold input from the settings modal', () => {
      cy.wait(1500)
      cy.get('#pause-btn').click()
      cy.get('#recent-queries-settings-btn').click()
      cy.get('#recording-settings-modal').should('be.visible')

      cy.get('#threshold-preset').select('custom')
      cy.get('#threshold-custom-wrap').should('be.visible')
      cy.get('#threshold-custom').clear().type('750')
      cy.get('#threshold-custom').should('have.value', '750')
      cy.get('#configure-dirty').should('be.visible')
    })

    it('should keep server history changes unsaved without affecting dashboard display retention', () => {
      cy.wait(1500)
      cy.get('#pause-btn').click()
      cy.get('#recording-settings-btn').click()

      cy.window().then((win) => {
        const displayBefore = win.JMX.util.dashboardDisplayRetentionMs()

        cy.get('#history-preset').invoke('val').then((current) => {
          cy.get('#history-preset option').then(($options) => {
            const alternate = Cypress.$.map($options, (el) => el.value)
              .find((value) => value !== 'custom' && value !== current)
            expect(alternate, 'alternate history preset').to.exist
            cy.get('#history-preset').select(alternate)
            expect(win.JMX.util.dashboardDisplayRetentionMs()).to.eq(displayBefore)
            cy.get('#configure-dirty').should('be.visible')
          })
        })
      })
    })

    it('should format long request URIs for display', () => {
      cy.window().then((win) => {
        const encoded = '/exist/rest/db?_query=import%20module%20namespace%20util%3D%22http%3A%2F%2Fexist-db.org%2Fxquery%2Futil%22%3B%20util%3Await(1)'
        expect(win.JMX.util.formatActivityUri(encoded)).to.eq('REST · db · XQuery')
        expect(win.JMX.util.formatActivityUri('/exist/apps/monex/index.html')).to.eq('apps/monex/index.html')
        expect(win.JMX.util.formatActivityUri('')).to.eq('—')
        expect(win.JMX.util.activityRequestUri({ requestURI: win.ko.observable(encoded) })).to.eq(encoded)
        expect(win.JMX.util.formatActivityUri(win.JMX.util.activityRequestUri({ requestURI: win.ko.observable(encoded) }))).to.eq('REST · db · XQuery')
        expect(win.JMX.util.activityRequestUri({ requestURI: {} })).to.eq('')
      })
    })

    it('should keep URI flyout open across dashboard poll refresh', () => {
      cy.waitForMonitoringViewModel({ timeout: 15000 })
      cy.pauseMonitoringPoll()
      cy.seedMonitoringRunningQueryUri()

      cy.get('.running-queries .activity-uri-link:visible', { timeout: 10000 })
        .should('have.length.at.least', 1)
      cy.get('.running-queries .activity-uri-link:visible').first().click()
      cy.get('#activity-uri-flyout').should('be.visible')

      cy.simulateMonitoringPollRefresh()
      cy.get('#activity-uri-flyout').should('be.visible')

      cy.get('#activity-uri-flyout .activity-uri-flyout-close').click()
      cy.get('#activity-uri-flyout').should('not.be.visible')
    })

    it('should keep stack flyout open across dashboard poll refresh', { timeout: 60000 }, () => {
      const slowQuery = 'import module namespace util = "http://exist-db.org/xquery/util"; util:wait(120000)'

      cy.wait(1500)
      cy.startBackgroundRestQuery(slowQuery)
      cy.waitForJmxRunningQuery({ timeout: 45000 }).as('runningQueryId')
      cy.waitForDashboardActiveThreadStack({ timeout: 45000 })

      cy.contains('h4.activity-section-title', 'Active threads')
        .closest('.activity-section')
        .find('.stack:visible')
        .first()
        .click()
      cy.get('#activity-uri-flyout').should('be.visible')
      cy.wait(2200)
      cy.get('#activity-uri-flyout').should('be.visible')
      cy.get('#activity-uri-flyout .activity-uri-flyout-close').click()
      cy.get('#activity-uri-flyout').should('not.be.visible')

      cy.get('@runningQueryId').then((queryId) => {
        cy.killRunningQueryViaJmx(queryId)
      })
    })

    it('should apply dashboard display retention from presets', () => {
      cy.window().then((win) => {
        win.JMX.util.setDashboardDisplayRetentionMs(120000)
        expect(win.JMX.util.dashboardDisplayRetentionMs()).to.eq(120000)
        win.JMX.util.setDashboardDisplayRetentionMs(300000)
        expect(win.JMX.util.dashboardDisplayRetentionMs()).to.eq(300000)
      })
    })

    it('should buffer ended running queries after they drop off JMX', () => {
      cy.window().then((win) => {
        win.JMX.util.resetActivityBuffers()
        win.JMX.util.setDashboardDisplayRetentionMs(300000)

        const report = {
          RunningQueries: [{ id: 99, sourceKey: '/db/test', requestURI: '/exist/test', terminating: 'false' }],
          RunningJobs: [],
          RecentQueryHistory: [],
          HistoryTimespan: '120000',
          MinTime: '100',
          TrackRequestURI: 'true'
        }

        const live = win.JMX.util.fixjs({
          jmx: {
            ProcessReport: report,
            LockManager: { WaitingThreads: [] }
          }
        })
        expect(live.jmx.ProcessReport.RunningQueries).to.have.length(1)
        expect(live.jmx.ProcessReport.RunningQueries[0].activityEnded).to.not.be.true

        const ended = win.JMX.util.fixjs({
          jmx: {
            ProcessReport: Object.assign({}, report, { RunningQueries: [] }),
            LockManager: { WaitingThreads: [] }
          }
        })
        expect(ended.jmx.ProcessReport.RunningQueries).to.have.length(1)
        expect(ended.jmx.ProcessReport.RunningQueries[0].activityEnded).to.be.true
      })
    })

    it('should keep garbage collect in the JVM heap panel', () => {
      cy.wait(1500)
      cy.get('#pause-btn').click()

      cy.contains('.box-title', 'JVM heap')
        .parents('.box')
        .find('#gc-btn')
        .should('be.visible')
        .and('have.class', 'btn-primary')
    })

    it('should show CPU and disk gauges in the host row and keep OS metrics out of the footer', () => {
      cy.wait(1500)
      cy.get('#pause-btn').click()

      cy.get('.dashboard-host-row').within(() => {
        cy.contains('.box-title', 'JVM heap').should('be.visible')
        cy.get('#memory-graph').should('exist')
        cy.get('.host-sparkline-wrap').should('be.visible')
        cy.contains('.box-title', 'CPU').should('be.visible')
        cy.get('#cpu-process-gauge').should('exist')
        cy.get('#cpu-system-gauge').should('exist')
        cy.get('#cpu-process-gauge canvas').should('exist')
        cy.get('#cpu-system-gauge canvas').should('exist')
        cy.get('#disk-data-gauge').should('exist')
        cy.get('#disk-data-gauge canvas').should('exist')
      })

      cy.get('.cpu-bar-row').should('not.exist')
      cy.get('.workload-panel-cpu').should('not.exist')
      cy.get('.cpu-compact-row').should('not.exist')
      cy.get('.dashboard-system-footer').contains('Free memory').should('not.exist')
      cy.get('.dashboard-system-footer').contains('System CPU').should('not.exist')
    })

    it('should show broker pool as stacked in-use and idle segments', () => {
      cy.wait(1500)
      cy.get('#pause-btn').click()

      cy.contains('.box-title', 'Broker pool')
        .parents('.box')
        .within(() => {
          cy.get('.broker-pool-stacked .broker-segment-in-use').should('exist')
          cy.get('.broker-pool-stacked .broker-segment-idle').should('exist')
          cy.get('.broker-pool-legend').contains('In use').should('be.visible')
          cy.get('.broker-pool-legend').contains('Idle').should('be.visible')
        })
    })

    it('should label the memory sparkline time window', () => {
      cy.wait(1500)
      cy.get('#pause-btn').click()

      cy.get('.memory-sparkline-caption').contains('Last ~2 min').should('be.visible')
      cy.get('#memory-graph').should('exist')
    })

    it('should resolve running query kill ids from mapped and plain rows', () => {
      cy.window().then((win) => {
        expect(win.JMX.util.runningQueryKillId({ id: 42 })).to.eq(42)
        expect(win.JMX.util.runningQueryKillId({ id: '987654321' })).to.eq(987654321)
        expect(win.JMX.util.runningQueryKillId({ value: { id: 11 } })).to.eq(11)
        expect(win.JMX.util.runningQueryKillId({ id: win.ko.observable(123456) })).to.eq(123456)
        expect(win.JMX.util.runningQueryKillId({ thread: 'qtp1-1' })).to.eq(null)
      })
    })

    it('should kill a running query without throwing from the kill handler', () => {
      const slowQuery = 'import module namespace util = "http://exist-db.org/xquery/util"; util:wait(120000)'

      cy.wait(1500)

      cy.window().then((win) => {
        cy.stub(win.JMX.connection, 'invoke').as('killInvoke')
      })

      cy.startBackgroundRestQuery(slowQuery)
      cy.waitForJmxRunningQuery({ timeout: 30000 })
      cy.wait(1500)

      cy.get('.workload-panel').scrollIntoView()

      cy.get('.running-queries tbody tr:not(.activity-row-ended) .kill-query', { timeout: 15000 })
        .first()
        .should('be.visible')
        .click()

      cy.get('@killInvoke').should('have.been.calledWithMatch',
        'killQuery',
        'org.exist.management.exist:type=ProcessReport',
        [Cypress.sinon.match.number]
      )

      cy.get('@killInvoke').then((stub) => {
        const queryId = stub.getCall(0).args[2][0]
        cy.killRunningQueryViaJmx(queryId)
      })
    })
  })
})
