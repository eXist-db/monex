/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
/// <reference types="cypress" />

describe('remote monitoring', () => {
    beforeEach('log in', () => {
    cy.loginApi()
    cy.visit('remotes.html')
  })

  it('should load remote monitoring', () => {
    cy.get('h1')
      .contains('Remote Monitoring')
      .wait(1000)
      .url().should('include', '/monex/remotes.html')
  })

  it('documents vector JMX alert examples', () => {
    cy.contains('h4', 'Vector alerts (eXist 7+)').should('be.visible')
    cy.contains('code', 'VectorEmbedding/ReadyModelCount').should('be.visible')
    cy.contains('code', 'VectorStore/EntryCount').should('be.visible')
    cy.contains('code', 'vector.dbx,cache-type=DATA').should('be.visible')
  })
})