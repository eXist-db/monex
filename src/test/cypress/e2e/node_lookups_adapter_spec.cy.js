/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
/// <reference types="cypress" />

function jmxFromFixture (win, fixturePath) {
  return cy.fixture(fixturePath).then((xmlString) => {
    const doc = win.$.parseXML(xmlString)
    return win.JMX.util.jmx2js(doc.documentElement)
  })
}

// The payload of a poll, from cumulative counters
function payload (c, limit) {
  return {
    available: true,
    indexDepth: 5,
    indexScanLimit: limit,
    exactHits: c.own,
    readForward: c.short + c.long + c.over,
    climbed: c.climbed,
    recordsScanned: c.records,
    shortReads: c.short,
    longReads: c.long,
    beyondLimit: c.over,
    rejectedEntries: 0,
    forwardLinkHops: 0,
    documentStatistics: false,
    topDocuments: []
  }
}

// A view model that has seen a baseline poll and then one poll per step, stepMs apart
function run (win, limit, steps, stepMs = 1000) {
  const NL = win.Monex.nodeLookups
  const m = NL.createViewModel(null)
  m.available(true)
  m.indexScanLimit(limit)
  m.indexDepth(5)
  const c = { own: 0, short: 0, long: 0, over: 0, climbed: 0, records: 0 }
  let t = 1e12
  NL.record(m, payload(c, limit), t)
  steps.forEach((step) => {
    Object.keys(c).forEach((k) => { c[k] += step[k] || 0 })
    t += stepMs
    NL.record(m, payload(c, limit), t)
  })
  m.exactHits(c.own)
  m.readForward(c.short + c.long + c.over)
  m.climbed(c.climbed)
  m.beyondLimit(c.over)
  return { m, c, t }
}

const rep = (step, k) => Array.from({ length: k }, () => step)

describe('Node lookups JMX adapter', () => {
  beforeEach('load dashboard scripts', () => {
    cy.loginApi()
    cy.visit('index.html')
    cy.get('#dashboard').should('be.visible')
  })

  it('maps the servlet output of the NodeLookups bean', () => {
    cy.window().then((win) => {
      jmxFromFixture(win, 'jmx-nodelookups-sample.xml').then((jmx) => {
        const p = win.Monex.nodeLookups.jmxNodeLookupsToPayload(jmx)
        expect(p.available).to.eq(true)
        expect(p.indexDepth).to.eq(5)
        expect(p.indexScanLimit).to.eq(64)
        expect(p.exactHits).to.eq(70)
        expect(p.readForward).to.eq(1278)
        expect(p.shortReads).to.eq(974)
        expect(p.longReads).to.eq(304)
        expect(p.beyondLimit).to.eq(0)
        expect(p.recordsScanned).to.eq(21654)
        expect(p.documentStatistics).to.eq(true)
        expect(p.topDocuments).to.have.length(2)
        expect(p.topDocuments[0].uri).to.eq('/db/wide.xml')
        expect(p.topDocuments[0].perLookup).to.be.closeTo(17.39, 0.01)
      })
    })
  })

  it('is hidden, and keeps no window, when the server has no NodeLookups bean', () => {
    cy.window().then((win) => {
      const NL = win.Monex.nodeLookups
      jmxFromFixture(win, 'jmx-vector-store-only.xml').then((jmx) => {
        expect(NL.jmxNodeLookupsToPayload(jmx).available).to.eq(false)
        const vm = { nodeLookups: NL.createViewModel(null) }
        NL.syncFromJmx(vm, jmx, 1e12)
        expect(NL.panelVisible(vm), 'panel stays hidden').to.eq(false)
        const r = run(win, 64, rep({ own: 1 }, 5))
        NL.record(r.m, { available: false }, r.t + 1000)
        expect(r.m.window().samples).to.have.length(0)
      })
    })
  })

  it('takes the first poll as a baseline and shows a window from the third sample', () => {
    cy.window().then((win) => {
      const NL = win.Monex.nodeLookups
      const two = run(win, 64, rep({ own: 1 }, 2))
      expect(two.m.window().samples).to.have.length(2)
      expect(NL.recordsPerRead(two.m)).to.eq('—')
      expect(NL.heroSub(two.m)).to.eq('Collecting…')
      expect(NL.spanText(run(win, 64, rep({ own: 1 }, 3)).m)).to.eq('Last 3 sec')
    })
  })

  it('derives the change between polls, the cost of the lookups that read, and a gap where nothing read', () => {
    cy.window().then((win) => {
      const r = run(win, 64, [{ own: 10, short: 4, long: 1, records: 52 }, { own: 20 }, { short: 6, climbed: 1, records: 48 }])
      const x = r.m.window().samples
      expect(x[0].reads).to.eq(5)
      expect(x[0].cost).to.be.closeTo(10.4, 1e-9)
      expect(x[1].cost, 'no read, no cost').to.eq(null)
      expect(x[2].cost).to.be.closeTo(48 / 7, 1e-9)
      expect(run(win, 64, rep({ own: 1 }, 3), 2500).m.window().samples[0].dt, 'the real time between polls').to.eq(2.5)
    })
  })

  it('reads the hero, the bar and the sub-line from the window', () => {
    cy.window().then((win) => {
      const NL = win.Monex.nodeLookups
      const { m } = run(win, 64, [{ own: 10, short: 4, long: 1, records: 52 }, { own: 20 }, { short: 6, climbed: 1, records: 48 }])
      expect(NL.total(m)).to.eq(42)
      expect(NL.recordsPerRead(m)).to.eq('8.3')
      expect(NL.heroSub(m)).to.eq('42 lookups in the last 3 sec, 71% found without reading')
      expect(NL.nowText(m)).to.eq('6.9')
      const segments = NL.segments(m)
      expect(segments.map((s) => s.css)).to.deep.eq(['nl-own', 'nl-short', 'nl-long', 'nl-over', 'nl-climbed'])
      expect(segments.map((s) => s.count)).to.deep.eq([30, 10, 1, 0, 1])
      expect(segments.map((s) => s.percentText)).to.deep.eq(['71%', '24%', '2.4%', '0%', '2.4%'])
      expect(segments.map((s) => s.showLabel), 'a label only where the segment is wide').to.deep.eq([true, true, false, false, false])
      expect(segments[1].title).to.eq('Read forward, up to 32 records: 10 lookups (24%)')
    })
  })

  it('draws an empty track in the bar slot when the window has no lookups', () => {
    cy.window().then((win) => {
      const NL = win.Monex.nodeLookups
      expect(NL.barEmpty(run(win, 64, rep({}, 3)).m)).to.eq(true)
      expect(NL.barEmpty(run(win, 64, rep({ own: 1 }, 2)).m)).to.eq(false)
      expect(NL.barEmpty(run(win, 64, rep({ short: 1, records: 3 }, 3)).m)).to.eq(false)
    })
  })

  it('shows a dash for now when the latest interval had no reads', () => {
    cy.window().then((win) => {
      const { m } = run(win, 64, [{ short: 2, records: 4 }, { short: 2, records: 4 }, { own: 5 }])
      expect(win.Monex.nodeLookups.nowText(m)).to.eq('—')
    })
  })

  it('leaves a gap when the counters are reset, and counts again from the new baseline', () => {
    cy.window().then((win) => {
      const NL = win.Monex.nodeLookups
      const r = run(win, 64, rep({ own: 5, short: 2, records: 8 }, 3))
      NL.record(r.m, payload({ own: 1, short: 0, long: 0, over: 0, climbed: 0, records: 0 }, 64), r.t + 1000)
      expect(r.m.window().samples[3].gap).to.eq(true)
      expect(r.m.window().samples[3].cost).to.eq(null)
      NL.record(r.m, payload({ own: 3, short: 1, long: 0, over: 0, climbed: 0, records: 4 }, 64), r.t + 2000)
      const x = r.m.window().samples
      expect(x).to.have.length(5)
      expect(x[4].gap).to.eq(false)
      expect(x[4].cost).to.eq(4)
    })
  })

  it('keeps 100 samples, about 2 minutes at the default poll', () => {
    cy.window().then((win) => {
      const NL = win.Monex.nodeLookups
      const { m } = run(win, 64, rep({ own: 1, short: 1, records: 3 }, 130))
      expect(m.window().samples).to.have.length(100)
      expect(m.window().own).to.eq(100)
      expect(NL.spanText(m)).to.eq('Last 2 min')
    })
  })

  it('clears the warning when the window has moved past the problem, and keeps it in the footnote', () => {
    cy.window().then((win) => {
      const NL = win.Monex.nodeLookups
      const bad = { own: 5, over: 4, records: 400 }
      const now = run(win, 64, rep(bad, 3)).m
      expect(NL.overLimit(now)).to.eq(true)
      expect(NL.advice(now)).to.contain('In the last 3 sec, 12 lookups read more than 64 records')
      expect(NL.advice(now)).to.contain('STORE')
      const later = run(win, 64, [bad, bad, bad].concat(rep({ own: 1 }, 100))).m
      expect(NL.overLimit(later), 'the problem is gone').to.eq(false)
      expect(NL.advice(later)).to.eq('')
      expect(NL.footnote(later)).to.contain('since the server started: 127 lookups, 12 beyond the limit')
    })
  })

  it('says in words what the window held', () => {
    cy.window().then((win) => {
      const NL = win.Monex.nodeLookups
      const both = run(win, 64, [{ over: 2, records: 300 }, { climbed: 1, records: 10 }, { own: 5 }]).m
      expect(NL.trendMessage(both)).to.deep.eq({ text: 'Beyond the limit for 1 sec · climbing for 1 sec', tone: 'bad' })
      expect(NL.trendMessage(run(win, 64, [{ climbed: 1, records: 10 }, { own: 5 }, { own: 5 }]).m).text).to.eq('Climbing for 1 sec')
      expect(NL.trendMessage(run(win, 64, rep({ own: 3, short: 2, records: 6 }, 3)).m)).to.deep.eq({ text: 'None over the limit', tone: 'muted' })
      expect(NL.trendMessage(run(win, 64, rep({ own: 3 }, 3)).m).text).to.eq('No lookups that had to read')
      expect(NL.trendMessage(run(win, 0, rep({ own: 3, over: 2, records: 40 }, 3)).m).text).to.eq('No climbs')
      expect(NL.trendMessage(run(win, 64, rep({ over: 1, records: 90 }, 100)).m).text).to.eq('Beyond the limit for 2 min')
      const slow = run(win, 64, [{ over: 1, records: 90 }, { over: 1, records: 90 }, { own: 1 }], 2500).m
      expect(NL.trendMessage(slow).text, 'the real time of the samples, not their number').to.eq('Beyond the limit for 5 sec')
    })
  })

  it('scales to the limit, and puts the problems on a lane of two rows', () => {
    cy.window().then((win) => {
      const NL = win.Monex.nodeLookups
      expect(NL.yMax(64, 6.2)).to.eq(64)
      expect(NL.yMax(64, 145), 'a spike expands the scale').to.eq(153)
      expect(NL.yMax(0, 6.2)).to.eq(7)
      const { m } = run(win, 64, [{ own: 1, over: 2, short: 1, records: 200 }, { own: 3 }, { climbed: 1, records: 9 }])
      const points = NL.sparkPoints(m.window().samples)
      expect(points[1].y, 'a gap, not a zero').to.eq(null)
      expect(points[0].over).to.eq(2)
      const lane = NL.lanePoints(m.window().samples, 64)
      expect(lane.over[0].y).to.deep.eq([1.1, 1.9])
      expect(lane.climbed[0].y).to.deep.eq([0.1, 0.9])
      expect(NL.lanePoints(m.window().samples, 0).over, 'no red without a limit').to.have.length(0)
    })
  })

  it('says anchors are off, and gives no warning, when the scan limit is 0', () => {
    cy.window().then((win) => {
      const NL = win.Monex.nodeLookups
      const { m } = run(win, 0, rep({ own: 2, over: 1, records: 30 }, 3))
      expect(NL.footnote(m)).to.eq('index-depth 5 · index-scan-limit 0 (no anchors) · since the server started: 9 lookups · entries ignored 0 · forward-link hops 0')
      expect(NL.anchorsOffNote(m)).to.eq(true)
      expect(NL.overLimit(m), 'every read is beyond a limit of 0').to.eq(false)
      const segments = NL.segments(m)
      expect(segments.map((s) => s.css), 'no tiers without a limit').to.deep.eq(['nl-own', 'nl-long', 'nl-climbed'])
      expect(segments[1].legend).to.eq('Read forward from an entry')
    })
  })

  it('draws the rows of the documents against the limit', () => {
    cy.window().then((win) => {
      const NL = win.Monex.nodeLookups
      const { m } = run(win, 64, rep({ own: 1 }, 3))
      expect(NL.rowWidth({ perLookup: 17.39 }, m)).to.eq('27%')
      expect(NL.rowOver({ perLookup: 80 }, m)).to.eq(true)
      expect(NL.rowWidth({ perLookup: 80 }, m), 'the bar stops at the end of its track').to.eq('100%')
    })
  })

  it('builds the window from the polls of the real bean output', () => {
    cy.window().then((win) => {
      const NL = win.Monex.nodeLookups
      jmxFromFixture(win, 'jmx-nodelookups-sample.xml').then((jmx) => {
        const st = jmx.NodeLookups.Statistics
        const vm = { nodeLookups: NL.createViewModel(null) }
        let t = 1e12
        NL.syncFromJmx(vm, jmx, t)
        for (let i = 0; i < 4; i++) {
          st.exactHits = String(parseInt(st.exactHits, 10) + 10)
          st.lookupsFromEntry = String(parseInt(st.lookupsFromEntry, 10) + 4)
          st.buckets.upToQuarter = String(parseInt(st.buckets.upToQuarter, 10) + 4)
          st.recordsScanned = String(parseInt(st.recordsScanned, 10) + 20)
          t += 1000
          NL.syncFromJmx(vm, jmx, t)
        }
        expect(NL.total(vm.nodeLookups)).to.eq(56)
        expect(NL.recordsPerRead(vm.nodeLookups)).to.eq('5.0')
        expect(NL.footnote(vm.nodeLookups)).to.contain('since the server started: ' + (110 + 1278 + 16) + ' lookups')
      })
    })
  })
})
