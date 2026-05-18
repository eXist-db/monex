/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
/// <reference types='cypress' />

describe('JMX token wiring', () => {
  beforeEach('log in', () => {
    cy.loginApi()
    cy.visit('index.html')
  })

  it('app:instances-data renders a valid token for localhost', () => {
    // The page sets window.JMX_INSTANCES from app:instances-data, which
    // resolves $app:jmx-token (which calls monex:jmx-token()). If that
    // chain breaks, the try/catch in app.xql swallows the error and the
    // token serializes as the string "false". This test fails fast on
    // that whole class of regression.
    cy.window().its('JMX_INSTANCES').should('be.an', 'array').and('have.length.greaterThan', 0)
    cy.window().its('JMX_INSTANCES.0.token')
      .should('be.a', 'string')
      .and('match', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('JMX endpoint accepts the rendered token', () => {
    // End-to-end: the token in JMX_INSTANCES actually authorizes the
    // /exist/status endpoint that the monitoring page polls. Catches
    // regressions where the token is well-formed but stale, mismatched,
    // or behind the wrong auth path.
    cy.window().its('JMX_INSTANCES.0.token').then((token) => {
      const baseUrl = new URL(Cypress.config('baseUrl'))
      cy.request({
        url: `${baseUrl.protocol}//${baseUrl.host}/exist/status?c=instances&token=${token}`
      }).its('status').should('eq', 200)
    })
  })
})
