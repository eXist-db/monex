describe('Monex', function () {
  beforeEach('log in', function () {
    cy.visit('/')
      .contains('Sign in as a dba user')
      .get('.login-box-body')
      .get(':nth-child(1) > .form-control').type('admin')
      .get('.btn').click()
      .url().should('include', '/monex/index.html')
  })
  describe('monitoring page', function (){
    it('should load start page', function() {
      cy.visit('index.html')
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
      cy.visit('profiling.html')
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
      cy.visit('indexes.html')
        .wait(1000)
        .url().should('include', '/monex/indexes.html')
      cy.contains('/db/apps/monex/indexes-test').click()
        .url().should('include', 'collection.html?collection=/db/apps/monex/indexes-test')
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
