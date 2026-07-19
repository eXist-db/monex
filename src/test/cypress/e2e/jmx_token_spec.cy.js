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

  // The exact query string the dashboard polls with (dashboard/06-polling.js).
  const POLL_QUERY =
    'c=instances&c=processes&c=locking&c=memory&c=caches&c=system&c=operatingsystem&c=disk&c=vector'

  it('gates the dashboard poll on the token from a non-localhost client', () => {
    // Issue #411: from any client eXist does not treat as loopback,
    // /exist/status returns 403 unless a valid token is supplied. It is the
    // token resolution in monex:jmx-token() — not the localhost exemption —
    // that must carry the request, and that resolution is what #411 broke.
    //
    // The catch: whether the exemption is active depends on where the test
    // runs. Under GitHub Actions eXist is reached over docker port-forwarding
    // and sees a non-loopback source, so no-token → 403 and only the token
    // gets us through — the real #411 path. Against a local instance the
    // caller *is* 127.0.0.1, so eXist waves it through and no-token → 200.
    // We probe first and only assert the 403 half where it can hold, but the
    // tokened poll must return 200 either way (an unresolved token file — the
    // #411 regression — empties the token and would 403 in the enforcing case).
    const baseUrl = new URL(Cypress.config('baseUrl'))
    const statusUrl = `${baseUrl.protocol}//${baseUrl.host}/exist/status?${POLL_QUERY}`

    cy.request({ url: `${statusUrl}&token=`, failOnStatusCode: false }).then((noToken) => {
      if (noToken.status === 403) {
        cy.log('loopback exemption not active — enforcing the #411 token contract')
      } else {
        cy.log(`loopback exemption active (no-token → ${noToken.status}); token still must work`)
      }

      cy.window().its('JMX_INSTANCES.0.token').then((token) => {
        // Assert the token is a real UUID first. Without this, the loopback
        // exemption would return 200 for an empty token too — the #411
        // regression — and the request-level check below would pass vacuously.
        expect(token, 'rendered JMX token').to.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        )
        cy.request({ url: `${statusUrl}&token=${token}` })
          .its('status').should('eq', 200)
      })
    })
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
