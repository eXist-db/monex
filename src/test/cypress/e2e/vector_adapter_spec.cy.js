/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
/// <reference types="cypress" />

function jmxPayloadFromFixture (win, fixturePath) {
  return cy.fixture(fixturePath).then((xmlString) => {
    const doc = win.$.parseXML(xmlString)
    const jmx = win.JMX.util.jmx2js(doc.documentElement)
    return win.Monex.vector.jmxVectorToPayload(jmx)
  })
}

describe('Vector JMX adapter', () => {
  beforeEach('load dashboard scripts', () => {
    cy.loginApi()
    cy.visit('index.html')
    cy.get('#dashboard').should('be.visible')
  })

  it('maps store-only c=vector XML through jmx2js', () => {
    cy.window().then((win) => {
      jmxPayloadFromFixture(win, 'jmx-vector-store-only.xml').then((payload) => {
        expect(payload.available, 'no VectorEmbedding').to.eq(false)
        expect(payload.total).to.eq(0)
        expect(payload.ready).to.eq(0)
        expect(payload.models).to.deep.eq([])
        expect(payload.store.available).to.eq(true)
        expect(payload.store.entryCountKnown).to.eq(true)
        expect(payload.store.entryCount).to.eq(0)
        expect(payload.store.fileSize).to.eq(8192)
        expect(payload.store.storageBackend).to.eq('vector.dbx')
      })
    })
  })

  it('maps full embedding JMX to dashboard totals', () => {
    cy.window().then((win) => {
      jmxPayloadFromFixture(win, 'jmx-vector-sample.xml').then((payload) => {
        expect(payload.available).to.eq(true)
        expect(payload.total).to.eq(10)
        expect(payload.ready).to.eq(1)
        expect(payload.knnBackend).to.eq('lucene')
        expect(payload.metrics.knnBackend).to.eq('lucene')
        expect(payload.metrics.embedCallCount).to.eq(0)
        expect(payload.metrics.knnQueryCount).to.eq(0)

        const ready = payload.models.filter((m) => m.status === 'available')
        expect(ready).to.have.length(1)
        expect(ready[0].id).to.eq('all-MiniLM-L6-v2')
        expect(ready[0].dimension).to.eq(384)
        expect(ready[0].provider).to.eq('ONNX')
      })
    })
  })

  it('syncVectorFromJmx updates the KO view model from fixture JMX', () => {
    cy.window().then((win) => {
      jmxPayloadFromFixture(win, 'jmx-vector-sample.xml').then(() => {
        return cy.fixture('jmx-vector-sample.xml').then((xmlString) => {
          const doc = win.$.parseXML(xmlString)
          const jmx = win.JMX.util.jmx2js(doc.documentElement)
          const vm = {
            vector: win.Monex.kpi.createVectorViewModel(null),
            vectorStore: win.Monex.vector.createVectorStoreViewModel(null)
          }
          win.Monex.vector.syncVectorFromJmx(vm, jmx)

          expect(vm.vector.available()).to.eq(true)
          expect(vm.vector.total()).to.eq(10)
          expect(vm.vector.ready()).to.eq(1)
          expect(vm.vectorStore.available()).to.eq(true)
          expect(vm.vectorStore.entryCount()).to.eq(0)
          expect(win.Monex.kpi.vectorEmbeddingsKpiText(vm.vector)).to.eq('1 / 10')
        })
      })
    })
  })
})
