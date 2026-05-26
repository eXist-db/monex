/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
/// <reference types="cypress" />

describe('indexes', () => {
  beforeEach('log in', () => {
    cy.loginApi()
    cy.visit('indexes.html')
  })

  it('should load Browse Indexes', () => {
    cy.get('h1')
      .contains('Indexes')
      .url()
      .should('include', '/monex/indexes.html')
    cy.get('.indexes-kpi').should('be.visible')
    cy.contains('.indexes-section-title', 'Configured collections').should('be.visible')
    cy.contains('/db/apps/monex/indexes-test')
      .parents('tr')
      .find('.indexes-vector-summary-badge')
      .should('contain', 'Vector')
    cy.contains('/db/apps/monex/indexes-test').click()
    cy.url().should('include', 'collection.html?collection=/db/apps/monex/indexes-test')
  })

  it('should list vector-field definitions when configured', () => {
    cy.contains('/db/apps/monex/indexes-test').click()
    cy.url().should('include', 'collection.html?collection=/db/apps/monex/indexes-test')
    cy.get('.indexes-kpi').should('be.visible')
    cy.contains('.indexes-kpi .kpi-label', 'Legacy range').should('be.visible')
    cy.contains('.indexes-kpi .kpi-label', 'New range').should('be.visible')
    cy.contains('.indexes-vector-store-subhead', 'Vector store:').should('be.visible')
    cy.contains('.indexes-section-title', 'Index definitions').should('be.visible')
    cy.get('.indexes-definitions th').contains('Detail').should('be.visible')
    cy.get('.indexes-vector-row').should('be.visible')
    cy.contains('test-embedding').should('be.visible')
    cy.get('.vector-stat-badge').contains('KNN').should('be.visible')
    cy.contains('Browse qname').should('be.visible')
    cy.contains('Browse node').should('be.visible')
  })
})
