/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
/// <reference types="cypress" />

describe('Monex timelines page', () => {
  beforeEach('log in', () => {
    cy.loginApi()
  })

  describe('page assets', () => {
    it('serves daterangepicker css from resources/css', () => {
      cy.request('resources/css/daterangepicker.css').its('status').should('eq', 200)
    })

    it('does not request daterangepicker css from legacy paths', () => {
      cy.intercept('GET', '**/resources/scripts/daterangepicker.css').as('scriptsCss')
      cy.intercept('GET', '**/resources/img/daterangepicker.css').as('imgCss')
      cy.visitMonexTimelinesPage({ instance: 'localhost' })
      cy.get('#reportrange').should('be.visible')
      cy.get('@scriptsCss.all').then((interceptions) => {
        expect(interceptions, 'scripts path css').to.have.length(0)
      })
      cy.get('@imgCss.all').then((interceptions) => {
        expect(interceptions, 'img path css').to.have.length(0)
      })
    })
  })

  describe('stored snapshots', () => {
    beforeEach('seed JMX history for chart range', () => {
      cy.ensureMonexDetailsSnapshot().as('snapshot')
    })

    it('loads charts for instance and date range URL', () => {
      cy.get('@snapshot').then((snapshot) => {
        cy.visitMonexTimelinesPage(snapshot)
        cy.url().should('include', 'timelines.html')
        cy.url().should('include', `instance=${snapshot.instance}`)
        cy.url().should('include', 'start=')
        cy.url().should('include', 'end=')
      })

      cy.contains('h1', 'Timelines').should('be.visible')
      cy.get('#reportrange').should('be.visible')
      cy.get('#brokers-graph', { timeout: 30000 }).should(($el) => {
        const chart = $el.data('chart')
        expect(chart, 'brokers chart').to.exist
        expect(chart.data.datasets[0].data.length, 'brokers chart points').to.be.greaterThan(0)
      })
    })

    it('opens detailed status when a chart point is clicked', () => {
      cy.get('@snapshot').then((snapshot) => {
        cy.visitMonexTimelinesPage(snapshot)
      })

      cy.get('#brokers-graph', { timeout: 30000 }).should(($el) => {
        expect($el.data('chart')).to.exist
      })

      cy.window().then((win) => {
        cy.stub(win, 'open').as('openDetails')
      })

      cy.get('#brokers-graph').then(($el) => {
        const chart = $el.data('chart')
        cy.get('@snapshot').then((snapshot) => {
          let clicked = false
          chart.data.datasets.forEach((dataset, datasetIndex) => {
            dataset.data.forEach((point, index) => {
              if (!clicked && point.x === snapshot.timestamp) {
                chart.options.onClick.call(chart, {}, [{ datasetIndex, index }])
                clicked = true
              }
            })
          })
          expect(clicked, `timeline point for ${snapshot.timestamp}`).to.eq(true)
        })
      })

      cy.get('@openDetails').should('have.been.calledOnce')
      cy.get('@snapshot').then((snapshot) => {
        cy.get('@openDetails').its('firstCall.args.0').should(
          'eq',
          `details.html?timestamp=${snapshot.timestamp}&instance=${snapshot.instance}`
        )
      })
    })
  })
})
