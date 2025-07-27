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

/// <reference types="cypress" />
beforeEach('log in', function () {
    cy.visit('console.html')
      .contains('Sign in as a dba user')
      .get('.login-box-body')
      .get(':nth-child(1) > .form-control').type('admin')
      .get('.btn').click()
      .url().should('include', '/monex/index.html')
  })

describe('remote console', function () {
    it ('should load remote dev console', function () {
      cy.visit('console.html')
        .wait(1000)
        .url().should('include', '/monex/console.html')
      cy.get('#status').should('be.visible').contains('Connected')
    })

    it ('should show log message', function () {
      cy.visit('/apps/monex/console.html')
        .url().should('include', '/monex/console.html')
        .wait(1000)
      cy.get('#status').should('be.visible').contains('Connected')
      cy.request({
        method: 'GET',
        url: '/rest/db?_query=import%20module%20namespace%20console="http://exist-db.org/xquery/console";%20console:log("TEST")'
      }).then(function (response) {
        cy.log('response received', response)
        cy.wait(1000).get('#console td.message').contains('TEST')
      })
    })
  })

  describe('remote console channels', function () {
    it ('should show the message from the right channel', function () {
      // WebSocket connection 1.
      const ws1 = new WebSocket('ws://localhost:8080/exist/rconsole')
      ws1.onopen = () => {
        ws1.send(JSON.stringify({ channel: 'c1' }))
      }
      ws1.onmessage = (e) => {
        if (e.data == "ping") return;
        const messageData = JSON.parse(e.data)
        // Verify message content
        expect(messageData.message).to.eq('111')
        // Close connection and end test
        ws.close()
        done()
      }
      ws1.onerror = (error) => {
        done(error)
      }

      // WebSocket connection 2.
      const ws2 = new WebSocket('ws://localhost:8080/exist/rconsole')
      ws2.onopen = () => {
        ws2.send(JSON.stringify({ channel: 'c2' }))
      }
      ws2.onmessage = (e) => {
        if (e.data == "ping") return;
        const messageData = JSON.parse(e.data)
        // Verify message content
        expect(messageData.message).to.eq('222')
        // Close connection and end test
        ws.close()
        done()
      }
      ws2.onerror = (error) => {
        done(error)
      }

      // Send messages to both web sockets.
      cy.request({
        method: 'GET',
        url: '/rest/db?_query=import%20module%20namespace%20console="http://exist-db.org/xquery/console";%20console:log("c1", "111")'
      })
      cy.request({
        method: 'GET',
        url: '/rest/db?_query=import%20module%20namespace%20console="http://exist-db.org/xquery/console";%20console:log("c2", "222")'
      })
    })
  })