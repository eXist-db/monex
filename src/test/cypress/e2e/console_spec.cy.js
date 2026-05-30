/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
/// <reference types='cypress' />

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

  it('should show log message', function () {
    cy.skipUnlessConsoleModule()
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
  it('should deliver the correct messages to each WebSocket channel', function () {
    cy.skipUnlessConsoleModule()
    const ws1 = new WebSocket(`${wsRoot}/ws`)
    const ws2 = new WebSocket(`${wsRoot}/ws`)

    cy.wrap(
      Promise.all([
        new Cypress.Promise((resolve) => { ws1.onopen = () => { ws1.send(JSON.stringify({ channel: 'c1' })); resolve() } }),
        new Cypress.Promise((resolve) => { ws2.onopen = () => { ws2.send(JSON.stringify({ channel: 'c2' })); resolve() } })
      ])
    )

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

    cy.wrap(Promise.all([messageFromC1, messageFromC2])).then(([msg1, msg2]) => {
      expect(msg1).to.equal('111')
      expect(msg2).to.equal('222')
    })
  })
})
