/*
 * eXist-db Open Source Native XML Database
 * Copyright (C) 2017 The eXist-db Authors
 *
 * info@exist-db.org
 * https://www.exist-db.org
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA
 */

/// <reference types='cypress' />

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
      url: 'http://localhost:8080/exist/rest/db',
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
    const ws1 = new WebSocket('ws://localhost:8080/exist/rconsole')
    const ws2 = new WebSocket('ws://localhost:8080/exist/rconsole')

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
      url: 'http://localhost:8080/exist/rest/db',
      qs: {
        _query: 'import module namespace console="http://exist-db.org/xquery/console"; console:log("c1", "111")'
      }
    })
    cy.request({
      method: 'GET',
      url: 'http://localhost:8080/exist/rest/db',
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