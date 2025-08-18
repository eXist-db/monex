/// <reference types="cypress" />

describe('indexes', () => {
    beforeEach('log in', () => {
        cy.loginApi()
        cy.visit('indexes.html')
    })

    it('should load Browse Indexes', () => {
        cy.get('h1')
          .contains('Indexes')
          .wait(1000)
          .url().should('include', '/monex/indexes.html')
        cy.contains('/db/apps/monex/indexes-test').click()
          .url().should('include', 'collection.html?collection=/db/apps/monex/indexes-test')
    })
})