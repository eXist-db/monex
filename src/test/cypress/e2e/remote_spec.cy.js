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
})