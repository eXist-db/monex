/// <reference types="cypress" />

describe('Monex index page', () => {
  beforeEach('log in', () => {
    cy.loginApi()
    cy.visit('/')
  })
  describe('monitoring page', () => {
    it('should load start page', () => {
      cy.get('h1')
        .contains('Monitoring')
        .url()
        .should('include', '/monex/index.html')
      // pause continuous status updates via UI
        .wait(1000)
        .get('#pause-btn').click()
      // ensure jmx data is displayed in GUI
        .get('[data-bind="text: jmx.Database.InstanceId"]').contains('exist')
        .get('#jmx-uptime').contains(/^\d*h\s\d*m$/)
    })
  })  
})
