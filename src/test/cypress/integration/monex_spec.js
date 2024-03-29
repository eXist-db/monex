describe('Monex', function () {
  beforeEach('log in', function () {
    cy.visit('/apps/monex/')
      .contains('Sign in as a dba user')
      .get('.login-box-body')
      .get(':nth-child(1) > .form-control').type('admin')
      .get('.btn').click()
      .url().should('include', '/monex/index.html')
  })
  describe('monitoring page', function (){
    it('should load start page', function() {
      cy.visit('/apps/monex/index.html')
        .url().should('include', '/monex/index.html')
      // pause continuous status updates via UI
        .wait(1000)
        .get('#pause-btn').click()
      // ensure jmx data is displayed in GUI
        .get('[data-bind="text: jmx.Database.InstanceId"]').contains('exist')
        .get('#jmx-uptime').contains(/^\d*h\s\d*m$/)
    })
  })
  describe('profiling', function () {
    it ('should load Query Profiling', function () {
      cy.visit('/apps/monex/profiling.html')
        .url().should('include', '/monex/profiling.html')
        .wait(1000)
        .get('[href="?action=enable"]').click()
        .get('[href="?action=refresh"]').click()
        .get('[href="?action=disable"]').click()
      cy.contains('/db/apps/monex/controller.xql')
        .url().should('include', 'profiling.html?action=disable')
    })
  })
  describe('indexes', function () {
    it ('should load Browse Indexes', function () {
      cy.visit('/apps/monex/indexes.html')
        .wait(1000)
        .url().should('include', '/monex/indexes.html')
      cy.contains('/db/apps/monex/indexes-test').click()
        .url().should('include', 'collection.html?collection=/db/apps/monex/indexes-test')
    })
  })
  describe('remote console', function () {
    it ('should load remote dev console', function () {
      cy.visit('/apps/monex/console.html')
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

  describe('remote monitoring', function () {
    it ('should load remote monitoring', function () {
      cy.visit('/apps/monex/remotes.html')
        .wait(1000)
        .url().should('include', '/monex/remotes.html')
    })
  })
})
