/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
/// <reference types="cypress" />

describe('profiling', () => {
    beforeEach('log in', () => {
    cy.loginApi()
    cy.visit('profiling.html')
  })
    it('should load Query Profiling', () => {
      cy.get('h1')
        .contains('Profiling')
        .url().should('include', '/monex/profiling.html')
        .wait(1000)
      cy.get('[href="?action=enable"]').click()
      cy.get('[href="?action=refresh"]').click()
      cy.get('[href="?action=disable"]').click()
      cy.contains('/db/apps/monex/controller.xql')
        .url().should('include', 'profiling.html?action=disable')
    })

    it('should expose Vector / KNN profiling tab', () => {
      cy.contains('.nav-tabs a', 'Vector / KNN').click()
      cy.get('#vector').should('be.visible')
      cy.get('#vector thead').contains('Kind')
      cy.get('#vector code').contains('ft:query-vector')
    })
  })