/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
/// <reference types='cypress' />

// Derive the eXist server URL from the Cypress baseUrl so the tests run
// against whatever port the spec is configured for. cy.request needs
// auth for /exist/rest/db calls (eXist 7.0+ rejects guest access to the
// console module via REST), so we send Basic admin: credentials inline.
const baseUrl = new URL(Cypress.config('baseUrl'))
const existRoot = `${baseUrl.protocol}//${baseUrl.host}/exist`
const wsRoot = `${baseUrl.protocol === 'https:' ? 'wss' : 'ws'}://${baseUrl.host}/exist`
const adminAuth = { username: 'admin', password: '' }

beforeEach('log in', () => {
  cy.loginApi()
  cy.visit('console.html')
})

describe('remote console', () => {
  it('should load remote dev console', () => {
    cy.get('h1')
      .contains('Console')
      .url()
      .should('include', '/monex/console.html')
    cy.get('#status')
      .should('be.visible')
      .contains('Connected')
  })

  it('should show log message', () => {
    cy.get('#status')
      .should('be.visible')
      .contains('Connected')
    cy.request({
      method: 'GET',
      url: `${existRoot}/rest/db`,
      auth: adminAuth,
      qs: {
        _query: 'import module namespace console="http://exist-db.org/xquery/console"; console:log("TEST")'
      }
    }).then(function (response) {
      cy.log('response received', response)
      cy.get('#console td.message').contains('TEST')
    })
  })
})

describe('remote console channels', () => {
  it('should deliver the correct messages to each WebSocket channel', () => {
    // Open two WebSocket connections (channels c1 and c2)
    const ws1 = new WebSocket(`${wsRoot}/ws`)
    const ws2 = new WebSocket(`${wsRoot}/ws`)

    // Wait for both sockets to connect
    cy.wrap(
      Promise.all([
        new Cypress.Promise((resolve) => { ws1.onopen = () => { ws1.send(JSON.stringify({ channel: 'c1' })); resolve() } }),
        new Cypress.Promise((resolve) => { ws2.onopen = () => { ws2.send(JSON.stringify({ channel: 'c2' })); resolve() } })
      ])
    )

    // Create promises for receiving messages
    const messageFromC1 = new Cypress.Promise((resolve) => {
      ws1.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.message === '111') resolve(msg.message)
        } catch (err) {
          // ignore non-JSON messages (e.g. ping frames)
        }
      }
    })

    const messageFromC2 = new Cypress.Promise((resolve) => {
      ws2.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.message === '222') resolve(msg.message)
        } catch (err) {
          // ignore non-JSON messages (e.g. ping frames)
        }
      }
    })

    // Trigger the server to send messages
    cy.request({
      method: 'GET',
      url: `${existRoot}/rest/db`,
      auth: adminAuth,
      qs: {
        _query: 'import module namespace console="http://exist-db.org/xquery/console"; console:log("c1", "111")'
      }
    })
    cy.request({
      method: 'GET',
      url: `${existRoot}/rest/db`,
      auth: adminAuth,
      qs: {
        _query: 'import module namespace console="http://exist-db.org/xquery/console"; console:log("c2", "222")'
      }
    })

    // Validate messages
    cy.wrap(Promise.all([messageFromC1, messageFromC2])).then(([msg1, msg2]) => {
      expect(msg1).to.equal('111')
      expect(msg2).to.equal('222')
    })
  })
})