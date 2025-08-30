/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2017 The eXist-db Authors
 */
// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --

Cypress.Commands.add('loginApi', () => {
  // Create base64 encoded credentials for Basic Auth
  const credentials = btoa('admin:')

  cy.session(
    'login',
    () => {
      cy.request({
        followRedirect: false,
        method: 'POST',
        url: 'index.html',
        form: true,
        body: {
          user: 'admin',
          password: '',
          duration: 'P7D'
        }
      }).then(({ body, headers, status }) => {
        cy.log('Response Status:', status)
        cy.log('Response Headers:', headers)
        cy.log('Response Body:', body)

        const sessionCookie = headers['set-cookie']?.find(cookie => cookie.startsWith('JSESSIONID='))
        if (sessionCookie) {
          const sessionId = sessionCookie.split(';')[0]
          cy.setCookie('JSESSIONID', sessionId)
        } else {
          cy.log('No session cookie found')
        }
      })
    },
    {
      validate() {
        cy.visit('index.html')
        cy.contains('h1', 'Monitoring').should('be.visible')
      },
      cacheAcrossSpecs: true
    }
  )
})
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This is will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })
