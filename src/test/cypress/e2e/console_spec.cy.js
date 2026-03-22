/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
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
    const ws1 = new WebSocket('ws://localhost:8080/exist/ws')
    const ws2 = new WebSocket('ws://localhost:8080/exist/ws')

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

describe('query execution', () => {
  it('should show query editor with run button', () => {
    cy.get('#query-input').should('be.visible')
    cy.get('#run-query').should('be.visible').contains('Run')
  })

  it('should execute a simple query and show results', () => {
    cy.get('#query-input').clear().type('1 + 1')
    cy.get('#run-query').click()

    cy.get('#results-box').should('be.visible')
    cy.get('#results-output').should('contain', '2')
    cy.get('#result-meta').should('contain', 'item')
    cy.get('#result-elapsed').should('not.be.empty')
    cy.get('#error-box').should('not.be.visible')
  })

  it('should execute the default placeholder query and show 10 items', () => {
    // The textarea is pre-filled with "for $i in 1 to 10 return $i"
    cy.get('#query-input').should('have.value', 'for $i in 1 to 10 return $i')
    cy.get('#run-query').click()

    cy.get('#results-box').should('be.visible')
    cy.get('#result-meta').should('contain', '10 items')
    cy.get('#results-title').should('contain', '1-10 of 10 items')
    cy.get('#results-output').should('contain', '1')
    cy.get('#results-output').should('contain', '10')
    cy.get('#error-box').should('not.be.visible')
  })

  it('should execute a sequence and show item count', () => {
    cy.get('#query-input').clear().type('for $i in 1 to 10 return $i')
    cy.get('#run-query').click()

    cy.get('#results-box').should('be.visible')
    cy.get('#result-meta').should('contain', '10 items')
  })

  it('should display error for invalid query', () => {
    cy.get('#query-input').clear().type('this is not valid xquery !!!')
    cy.get('#run-query').click()

    cy.get('#error-box').should('be.visible')
    cy.get('#error-output').should('not.be.empty')
    cy.get('#results-box').should('not.be.visible')
  })

  it('should show empty result message for zero-hit query', () => {
    cy.get('#query-input').clear().type('()')
    cy.get('#run-query').click()

    cy.get('#results-box').should('be.visible')
    cy.get('#results-output').should('contain', '(empty result)')
  })

  it('should close cursor and hide results', () => {
    cy.get('#query-input').clear().type('1 to 5')
    cy.get('#run-query').click()

    cy.get('#results-box').should('be.visible')
    cy.get('#close-cursor').should('be.visible').click()
    cy.get('#results-box').should('not.be.visible')
    cy.get('#close-cursor').should('not.be.visible')
  })
})

describe('query pagination', () => {
  it('should paginate results exceeding page size', () => {
    // Default page size is 20, so 50 items = 3 pages
    cy.get('#query-input').clear().type('for $i in 1 to 50 return $i')
    cy.get('#run-query').click()

    cy.get('#results-box').should('be.visible')
    cy.get('#result-meta').should('contain', '50 items')
    cy.get('#page-indicator').should('contain', '1 / 3')

    // Navigate forward
    cy.get('#page-next').click()
    cy.get('#page-indicator').should('contain', '2 / 3')

    // Navigate to last
    cy.get('#page-last').click()
    cy.get('#page-indicator').should('contain', '3 / 3')
    cy.get('#page-next').should('be.disabled')

    // Navigate back to first
    cy.get('#page-first').click()
    cy.get('#page-indicator').should('contain', '1 / 3')
    cy.get('#page-prev').should('be.disabled')
  })

  it('should disable prev/first on first page', () => {
    cy.get('#query-input').clear().type('1 to 25')
    cy.get('#run-query').click()

    cy.get('#results-box').should('be.visible')
    cy.get('#page-first').should('be.disabled')
    cy.get('#page-prev').should('be.disabled')
    cy.get('#page-next').should('not.be.disabled')
  })
})

describe('query history', () => {
  beforeEach(() => {
    // Clear any prior history
    cy.window().then((win) => {
      delete win.localStorage['monex.queryHistory']
    })
    cy.visit('console.html')
  })

  it('should record executed queries in history', () => {
    cy.get('#query-input').clear().type('1 + 1')
    cy.get('#run-query').click()
    cy.get('#results-box').should('be.visible')

    cy.get('#history-box').should('be.visible')
    cy.get('#history-rows .history-row').should('have.length', 1)
    cy.get('#history-rows .history-row').first().should('contain', '1 + 1')
  })

  it('should load query text when clicking a history entry', () => {
    cy.get('#query-input').clear().type('"hello"')
    cy.get('#run-query').click()
    cy.get('#results-box').should('be.visible')

    // Change the input, then click history to restore
    cy.get('#query-input').clear().type('something else')
    cy.get('#history-rows .history-row').first().click()
    cy.get('#query-input').should('have.value', '"hello"')
  })

  it('should clear history', () => {
    cy.get('#query-input').clear().type('1')
    cy.get('#run-query').click()
    cy.get('#results-box').should('be.visible')
    cy.get('#history-box').should('be.visible')

    cy.get('#clear-history').click()
    cy.get('#history-box').should('not.be.visible')
  })

  it('should show item count and elapsed time in history', () => {
    cy.get('#query-input').clear().type('1 to 5')
    cy.get('#run-query').click()
    cy.get('#results-box').should('be.visible')

    cy.get('#history-rows .history-row').first().within(() => {
      cy.get('td').eq(2).should('contain', '5')
      // Elapsed column should have some value (e.g. "2ms", "0ms")
      cy.get('td').eq(3).should('not.be.empty')
    })
  })
})

describe('results title range', () => {
  it('should show range in results title', () => {
    cy.get('#query-input').clear().type('for $i in 1 to 50 return $i')
    cy.get('#run-query').click()
    cy.get('#results-box').should('be.visible')

    cy.get('#results-title').should('contain', '1-20 of 50 items')

    cy.get('#page-next').click()
    cy.get('#results-title').should('contain', '21-40 of 50 items')
  })
})
