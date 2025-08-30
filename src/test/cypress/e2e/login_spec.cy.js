/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2017 The eXist-db Authors
 */
describe('Login page', () => {
    beforeEach('log in', () => {
    cy.visit('/')
    cy.clearAllSessionStorage()
  })

  it('should succeed with default credentials', () => {
    cy.get('.login-box-body')
      .contains('Sign in as a dba user')
    cy.get(':nth-child(1) > .form-control')
      .type('admin')
    cy.get('.btn')
      .click()
      .url()
      .should('include', '/monex/index.html')
    cy.get('h1')
      .contains('Monitoring')
  })

  it('should fail with bad credentials', () => {
    cy.get('.login-box-body')
      .contains('Sign in as a dba user')
    cy.get(':nth-child(1) > .form-control')
      .type('foobar')
    cy.get('.btn')
      .click()
      .url()
      .should('include', '/monex/index.html')
    cy.get('h1')
      .should('not.exist')
  })
})