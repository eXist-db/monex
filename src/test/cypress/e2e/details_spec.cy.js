/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
/// <reference types="cypress" />

describe('Monex details page', () => {
  beforeEach('log in', () => {
    cy.loginApi()
  })

  describe('without a stored snapshot', () => {
    it('shows guidance when opened without a timestamp', () => {
      cy.visit('details.html?instance=localhost')

      cy.contains('.breadcrumb .active', 'Detailed Status').should('be.visible')
      cy.contains('.details-timestamp-empty', 'Select a snapshot').should('be.visible')
      cy.get('#details-empty-state').should('be.visible')
      cy.contains('#details-empty-state', 'No stored snapshot for this timestamp').should('be.visible')
      cy.get('#details-dashboard').should('not.be.visible')
    })

    it('shows guidance for an unknown timestamp', () => {
      cy.visitMonexDetailsPage({ timestamp: 1, instance: 'localhost' })

      cy.contains('.breadcrumb .active', 'Detailed Status').should('be.visible')
      cy.get('#details-empty-state').should('be.visible')
      cy.contains('#details-empty-state', 'No stored snapshot for this timestamp').should('be.visible')
      cy.get('#details-dashboard').should('not.be.visible')
      cy.get('#details-empty-state a[href="remotes.html"]').should('be.visible')
      cy.get('#details-timelines-link')
        .should('have.attr', 'href', 'timelines.html?instance=localhost')
    })
  })

  describe('historical snapshot (timelines URL)', () => {
    beforeEach('seed stored JMX and open the URL timelines uses', () => {
      cy.ensureMonexDetailsSnapshot().then((snapshot) => {
        cy.wrap(snapshot).as('snapshot')
        cy.visitMonexDetailsPage(snapshot)
        cy.get('#jmx-data').invoke('text').should('have.length.gt', 500)
        cy.get('#details-empty-state').should('not.be.visible')
        cy.get('#details-dashboard').should('be.visible')
        cy.get('#jmx-uptime', { timeout: 10000 }).should('contain', 'h')
      })
    })

    it('loads dashboard metrics from stored JMX', () => {
      cy.get('#details-empty-state').should('not.be.visible')
      cy.get('#details-dashboard').should('be.visible')
      cy.get('#jmx-data').invoke('text').should('contain', 'jmx:jmx')
      cy.get('.kpi-strip .kpi-value').first().should('contain', '1')
      cy.get('#jmx-uptime').should('contain', '1h')
    })

    it('should expose activity flyout panel and initialize handlers', () => {
      cy.get('#activity-uri-flyout').should('exist')
      cy.get('#activity-stack-flyout').should('not.exist')
      cy.get('#jmx-recent-queries .activity-uri-link:visible').should('have.length.at.least', 1)
    })

    it('should format request URIs without object placeholders', () => {
      cy.window().then((win) => {
        const encoded = '/exist/rest/db?_query=import%20module%20namespace%20util%3D%22http%3A%2F%2Fexist-db.org%2Fxquery%2Futil%22%3B%20util%3Await(1)'
        expect(win.JMX.util.activityRequestUri({ requestURI: win.ko.observable(encoded) })).to.eq(encoded)
        expect(win.JMX.util.formatActivityUri(win.JMX.util.activityRequestUri({ requestURI: {} }))).to.eq('—')
      })

      cy.get('#jmx-recent-queries .activity-uri-link:visible').should('have.length.at.least', 1)
      cy.get('#jmx-recent-queries .activity-uri-link:visible').each(($link) => {
        expect($link.text()).to.not.contain('[object Object]')
        expect($link.text()).to.contain('REST')
      })
    })

    it('should open and close URI and stack flyouts', () => {
      cy.get('#jmx-recent-queries .activity-uri-link:visible').first().click()
      cy.get('#activity-uri-flyout').should('be.visible')
      cy.get('#activity-uri-flyout .activity-uri-flyout-text').should('contain', '/exist/rest/db')
      cy.get('#activity-uri-flyout .activity-uri-flyout-close').click()
      cy.get('#activity-uri-flyout').should('not.be.visible')

      cy.get('.stack').first().click()
      cy.get('#activity-uri-flyout').should('be.visible')
      cy.get('#activity-uri-flyout .activity-stack-flyout-text').should('contain', 'org.exist.test.Main.run')
      cy.get('#activity-uri-flyout .activity-uri-flyout-close').click()
      cy.get('#activity-uri-flyout').should('not.be.visible')
    })

    it('should keep recent query table markup aligned with monitoring', () => {
      cy.contains('.activity-section-title', 'Recent queries').should('be.visible')
      cy.get('.activity-recent-table').should('exist')
      cy.get('#jmx-recent-queries').should('exist')
      cy.get('#activity-panel-settings').should('not.exist')
    })
  })
})
