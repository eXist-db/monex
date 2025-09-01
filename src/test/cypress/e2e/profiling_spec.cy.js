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
    it ('should load Query Profiling', () => {
      cy.get('h1')
        .contains('Profiling')
        .url().should('include', '/monex/profiling.html')
        .wait(1000)
        .get('[href="?action=enable"]').click()
        .get('[href="?action=refresh"]').click()
        .get('[href="?action=disable"]').click()
      cy.contains('/db/apps/monex/controller.xql')
        .url().should('include', 'profiling.html?action=disable')
    })
  })