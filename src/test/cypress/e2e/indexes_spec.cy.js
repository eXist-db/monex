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
      .wait(1000)
      .url().should('include', '/monex/indexes.html')
    cy.contains('/db/apps/monex/indexes-test').click()
      .url().should('include', 'collection.html?collection=/db/apps/monex/indexes-test')
  })

  it('should list vector-field definitions when configured', () => {
    cy.contains('/db/apps/monex/indexes-test').click()
    cy.url().should('include', 'collection.html?collection=/db/apps/monex/indexes-test')
    cy.contains('vector-field:', { timeout: 10000 }).should('be.visible')
    cy.contains('test-embedding').should('be.visible')
    cy.contains('Lucene vector-store:').should('be.visible')
  })
})
