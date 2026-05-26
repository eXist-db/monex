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

      cy.contains('.box-title', 'Java Memory').should('be.visible')
      cy.contains('.box-title', 'Page Caches').should('be.visible')
      cy.contains('.box-title', 'Embeddings').should('be.visible')
      cy.contains('.box-title', 'Activity').should('be.visible')

      cy.get('.kpi-strip .kpi-label').contains('Brokers').should('be.visible')
      cy.get('.kpi-strip .kpi-label').contains('Queries').should('be.visible')
      cy.get('.kpi-strip .kpi-label').contains('Waiting').should('be.visible')
      cy.get('.kpi-strip .kpi-label').contains('Uptime').should('be.visible')
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

    it('should scope recent query settings under Recent queries with presets', () => {
      cy.wait(1500)
      cy.get('#pause-btn').click()

      cy.get('#configure-history-wrap')
        .parents('.activity-section-recent')
        .should('exist')
      cy.get('#configure-history-wrap').should('be.visible')
      cy.contains('label', 'Slow query threshold').should('be.visible')
      cy.contains('label', 'Keep on server for').should('be.visible')
      cy.contains('label', 'Record request URI').should('be.visible')
      cy.get('#threshold-preset option').should('have.length.at.least', 5)
      cy.get('#history-preset option').should('have.length.at.least', 5)
      cy.get('.activity-history-hint')
        .should('contain', 'Recent queries')
        .and('contain', 'Reloading clears the dashboard buffer')
    })

    it('should keep display retention on saved server history until Set', () => {
      cy.wait(1500)
      cy.get('#pause-btn').click()

      cy.window().then((win) => {
        win.JMX.util.setRecentQueryServerHistory(120000)
        const displayBefore = win.JMX.util.recentQueryDisplayRetentionMs()
        expect(displayBefore).to.eq(300000)

        cy.get('#history-preset').invoke('val').then((current) => {
          cy.get('#history-preset option').then(($options) => {
            const alternate = Cypress.$.map($options, (el) => el.value)
              .find((value) => value !== 'custom' && value !== current)
            expect(alternate, 'alternate history preset').to.exist
            cy.get('#history-preset').select(alternate)
            expect(win.JMX.util.recentQueryDisplayRetentionMs()).to.eq(displayBefore)
            cy.get('#configure-dirty').should('be.visible')
          })
        })
      })
    })

    it('should apply a 5 minute floor to display retention from server history', () => {
      cy.window().then((win) => {
        win.JMX.util.setRecentQueryServerHistory(120000)
        expect(win.JMX.util.recentQueryDisplayRetentionMs()).to.eq(300000)
        win.JMX.util.setRecentQueryServerHistory(600000)
        expect(win.JMX.util.recentQueryDisplayRetentionMs()).to.eq(600000)
      })
    })

    it('should keep garbage collect in the java memory panel', () => {
      cy.wait(1500)
      cy.get('#pause-btn').click()

      cy.contains('.box-title', 'Java Memory')
        .parents('.box')
        .find('button')
        .contains('Garbage Collect')
        .should('be.visible')
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

      cy.get('.running-queries .kill-query', { timeout: 15000 })
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
