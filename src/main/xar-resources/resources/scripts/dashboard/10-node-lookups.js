/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
var Monex = window.Monex || {};
window.Monex = Monex;

/*
 * The NodeLookups bean of eXist-db 7 counts how a node is found again by its id (`..`, `ancestor::`, `util:node-by-id`,
 * field expressions of the Lucene and range indexes): by an entry of its own in the DOM index, by reading forward from the
 * nearest entry before it, or by climbing to an ancestor. Older servers do not have the bean, and the panel stays hidden.
 *
 * The bean counts since the server started, which is slow to show a change and never clears a problem after it is fixed.
 * The panel therefore shows the last samples: every poll gives the change since the previous one, and the hero, the bar,
 * the warning and the sparkline all read that window. What the bean counted since the start stays in the footnote.
 */

/** As many samples as the other time series of the dashboard keep. */
var NODE_LOOKUPS_SAMPLES = 100;
/** A window is shown from this many samples on (CHART_WARMUP_SAMPLES of 05-charts.js). */
var NODE_LOOKUPS_WARMUP = 3;

function nodeLookupsCount(value) {
    return parseInt(jmxValue(value), 10) || 0;
}

function emptyNodeLookupsPayload() {
    return {
        available: false,
        indexDepth: 0,
        indexScanLimit: 0,
        exactHits: 0,
        readForward: 0,
        climbed: 0,
        recordsScanned: 0,
        shortReads: 0,
        longReads: 0,
        beyondLimit: 0,
        rejectedEntries: 0,
        forwardLinkHops: 0,
        documentStatistics: false,
        topDocuments: []
    };
}

function jmxNodeLookupsToPayload(jmx) {
    var bean = jmx && jmx.NodeLookups;
    if (bean instanceof Array) {
        bean = bean[0];
    }
    if (!bean) {
        return emptyNodeLookupsPayload();
    }
    var statistics = bean.Statistics || {};
    var buckets = statistics.buckets || {};
    var rows = jmxValue(bean.TopDocuments);
    var topDocuments = [];
    if (rows && rows.length) {
        for (var i = 0; i < rows.length; i++) {
            var lookups = nodeLookupsCount(rows[i].lookups);
            var scanned = nodeLookupsCount(rows[i].recordsScanned);
            topDocuments.push({
                uri: jmxValue(rows[i].uri) || String(jmxValue(rows[i].documentId) || ""),
                lookups: lookups,
                recordsScanned: scanned,
                perLookup: lookups > 0 ? scanned / lookups : 0
            });
        }
    }
    var documentStatistics = jmxValue(bean.DocumentStatistics);
    return {
        available: true,
        indexDepth: nodeLookupsCount(bean.IndexDepth),
        indexScanLimit: nodeLookupsCount(bean.IndexScanLimit),
        exactHits: nodeLookupsCount(statistics.exactHits),
        readForward: nodeLookupsCount(statistics.lookupsFromEntry),
        climbed: nodeLookupsCount(statistics.ancestorFallbacks),
        recordsScanned: nodeLookupsCount(statistics.recordsScanned),
        shortReads: nodeLookupsCount(buckets.upToQuarter) + nodeLookupsCount(buckets.upToHalf),
        longReads: nodeLookupsCount(buckets.upToLimit),
        beyondLimit: nodeLookupsCount(buckets.beyondLimit),
        rejectedEntries: nodeLookupsCount(statistics.rejectedEntries),
        forwardLinkHops: nodeLookupsCount(statistics.forwardLinkHops),
        documentStatistics: documentStatistics === true || documentStatistics === "true",
        topDocuments: topDocuments
    };
}

// ---- the samples: what changed between two polls -------------------------------------------------------------------

function nodeLookupsCounters(p) {
    return {
        exact: p.exactHits,
        forward: p.readForward,
        short: p.shortReads,
        long: p.longReads,
        over: p.beyondLimit,
        climbed: p.climbed,
        records: p.recordsScanned
    };
}

/** A sample that says nothing: after a reset of the counters the interval is unknown, so the line breaks. */
function nodeLookupsGap(seconds) {
    return { dt: seconds, own: 0, short: 0, long: 0, over: 0, forward: 0, climbed: 0, records: 0, reads: 0, cost: null, gap: true };
}

/**
 * The change between two polls. Null if a counter went backwards, which only a reset of the counters (or a restart) does.
 * The cost is the records read per lookup that had to read; it is null, not 0, when nothing had to read: no read
 * happened, so there is no cost to plot.
 */
function nodeLookupsInterval(previous, current, seconds) {
    var keys = ["exact", "forward", "short", "long", "over", "climbed", "records"];
    var d = {};
    for (var i = 0; i < keys.length; i++) {
        d[keys[i]] = current[keys[i]] - previous[keys[i]];
        if (d[keys[i]] < 0) {
            return null;
        }
    }
    var reads = d.forward + d.climbed;
    return {
        dt: seconds,
        own: d.exact,
        short: d.short,
        long: d.long,
        over: d.over,
        forward: d.forward,
        climbed: d.climbed,
        records: d.records,
        reads: reads,
        cost: reads > 0 ? d.records / reads : null,
        gap: false
    };
}

function nodeLookupsSummarize(samples) {
    var w = { samples: samples, own: 0, short: 0, long: 0, over: 0, forward: 0, climbed: 0, records: 0, seconds: 0 };
    for (var i = 0; i < samples.length; i++) {
        w.own += samples[i].own;
        w.short += samples[i].short;
        w.long += samples[i].long;
        w.over += samples[i].over;
        w.forward += samples[i].forward;
        w.climbed += samples[i].climbed;
        w.records += samples[i].records;
        w.seconds += samples[i].dt;
    }
    return w;
}

/** Takes the counters of one poll: the first only sets the baseline, each next one adds a sample. */
function nodeLookupsRecord(model, payload, nowMs) {
    var trend = model.trend;
    if (!payload.available) {
        trend.baseline = null;
        trend.samples = [];
        model.window(nodeLookupsSummarize(trend.samples));
        return;
    }
    var counters = nodeLookupsCounters(payload);
    if (!trend.baseline) {
        trend.baseline = { t: nowMs, counters: counters };
        return;
    }
    var seconds = (nowMs - trend.baseline.t) / 1000;
    if (seconds <= 0) {
        return;
    }
    var sample = nodeLookupsInterval(trend.baseline.counters, counters, seconds) || nodeLookupsGap(seconds);
    trend.baseline = { t: nowMs, counters: counters };
    sample.t = nowMs;
    trend.samples.push(sample);
    while (trend.samples.length > NODE_LOOKUPS_SAMPLES) {
        trend.samples.shift();
    }
    model.window(nodeLookupsSummarize(trend.samples.slice()));
}

// ---- the view model ------------------------------------------------------------------------------------------------

function createNodeLookupsViewModel(payload) {
    var p = payload || emptyNodeLookupsPayload();
    return {
        available: ko.observable(!!p.available),
        indexDepth: ko.observable(p.indexDepth),
        indexScanLimit: ko.observable(p.indexScanLimit),
        exactHits: ko.observable(p.exactHits),
        readForward: ko.observable(p.readForward),
        climbed: ko.observable(p.climbed),
        recordsScanned: ko.observable(p.recordsScanned),
        shortReads: ko.observable(p.shortReads),
        longReads: ko.observable(p.longReads),
        beyondLimit: ko.observable(p.beyondLimit),
        rejectedEntries: ko.observable(p.rejectedEntries),
        forwardLinkHops: ko.observable(p.forwardLinkHops),
        documentStatistics: ko.observable(!!p.documentStatistics),
        topDocuments: ko.observableArray(p.topDocuments),
        window: ko.observable(nodeLookupsSummarize([])),
        trend: { baseline: null, samples: [], charts: null }
    };
}

function syncNodeLookupsFromJmx(viewModel, jmx, nowMs) {
    if (!viewModel) {
        return;
    }
    var p = jmxNodeLookupsToPayload(jmx);
    if (!viewModel.nodeLookups) {
        viewModel.nodeLookups = createNodeLookupsViewModel(p);
    }
    var model = viewModel.nodeLookups;
    model.available(p.available);
    model.indexDepth(p.indexDepth);
    model.indexScanLimit(p.indexScanLimit);
    model.exactHits(p.exactHits);
    model.readForward(p.readForward);
    model.climbed(p.climbed);
    model.recordsScanned(p.recordsScanned);
    model.shortReads(p.shortReads);
    model.longReads(p.longReads);
    model.beyondLimit(p.beyondLimit);
    model.rejectedEntries(p.rejectedEntries);
    model.forwardLinkHops(p.forwardLinkHops);
    model.documentStatistics(p.documentStatistics);
    model.topDocuments(p.topDocuments);
    nodeLookupsRecord(model, p, nowMs === undefined ? new Date().getTime() : nowMs);
    nodeLookupsRenderTrend(model);
}

function nodeLookupsValue(model, name) {
    var value = model && model[name];
    return typeof value === "function" ? value() : (value || 0);
}

function nodeLookupsWindow(model) {
    return model && model.window ? model.window() : nodeLookupsSummarize([]);
}

function nodeLookupsWindowReady(model) {
    return nodeLookupsWindow(model).samples.length >= NODE_LOOKUPS_WARMUP;
}

function nodeLookupsPanelVisible(viewModel) {
    var model = viewModel && viewModel.nodeLookups;
    return !!(model && model.available && model.available());
}

// ---- the words and numbers of the panel ----------------------------------------------------------------------------

function nodeLookupsFixed(value) {
    return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

function nodeLookupsPercentText(count, total) {
    if (total === 0) {
        return "—";
    }
    var share = 100 * count / total;
    return (share < 10 && share > 0 ? share.toFixed(1) : String(Math.round(share))) + "%";
}

function nodeLookupsDuration(seconds) {
    return seconds < 90 ? Math.round(seconds) + " sec" : Math.round(seconds / 60) + " min";
}

/** "last 2 min": the real span of the samples, since the poll period is the user's. */
function nodeLookupsWindowPhrase(model) {
    return "last " + nodeLookupsDuration(nodeLookupsWindow(model).seconds);
}

function nodeLookupsSpanText(model) {
    if (!nodeLookupsWindowReady(model)) {
        return "Collecting…";
    }
    var phrase = nodeLookupsWindowPhrase(model);
    return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/** All lookups of the window: those answered by an entry of their own, and those that had to read. */
function nodeLookupsTotal(model) {
    var w = nodeLookupsWindow(model);
    return w.own + w.forward + w.climbed;
}

/** The average number of records a lookup that had to read, read, over the window. */
function nodeLookupsRecordsPerRead(model) {
    var w = nodeLookupsWindow(model);
    var reads = w.forward + w.climbed;
    if (!nodeLookupsWindowReady(model) || reads === 0) {
        return "—";
    }
    return nodeLookupsFixed(w.records / reads);
}

/** The cost of the latest interval, or a dash if nothing had to read in it: not the last known value. */
function nodeLookupsNowText(model) {
    var samples = nodeLookupsWindow(model).samples;
    var last = samples.length ? samples[samples.length - 1] : null;
    return last && last.cost !== null ? nodeLookupsFixed(last.cost) : "—";
}

/**
 * The classes the lookups of the window fall into, cheapest first: found by an entry of their own, read forward from an
 * entry (split by the scan limit when there is one), climbed to an ancestor. The bar draws those that have lookups, the
 * legend lists all of them, so the numbers are never only in a colour.
 */
function nodeLookupsSegments(model) {
    var w = nodeLookupsWindow(model);
    var limit = nodeLookupsValue(model, "indexScanLimit");
    var half = Math.floor(limit / 2);
    var defs = [{ legend: "Found by an entry of its own", css: "nl-own", count: w.own }];
    if (limit > 0) {
        defs.push({ legend: "Read forward, up to " + half + " records", css: "nl-short", count: w.short });
        defs.push({ legend: "Read forward, up to " + limit, css: "nl-long", count: w.long });
        defs.push({ legend: "Read more than " + limit, css: "nl-over", count: w.over });
    } else {
        defs.push({ legend: "Read forward from an entry", css: "nl-long", count: w.forward });
    }
    defs.push({ legend: "Climbed to an ancestor", css: "nl-climbed", count: w.climbed });
    var total = 0;
    for (var i = 0; i < defs.length; i++) {
        total += defs[i].count;
    }
    for (var j = 0; j < defs.length; j++) {
        var d = defs[j];
        d.percent = total > 0 ? 100 * d.count / total : 0;
        d.percentText = nodeLookupsPercentText(d.count, total);
        d.countText = String(d.count);
        d.showLabel = d.percent >= 14;
        d.title = d.legend + ": " + d.count + " lookups (" + d.percentText + ")";
    }
    return defs;
}

/** True if the window has no lookups at all: the bar then draws an empty track, so that "nothing yet" is a state, not a hole. */
function nodeLookupsBarEmpty(model) {
    return nodeLookupsTotal(model) === 0;
}

function nodeLookupsBarSummary(model) {
    var segments = nodeLookupsSegments(model);
    var parts = [];
    for (var i = 0; i < segments.length; i++) {
        if (segments[i].count > 0) {
            parts.push(segments[i].title);
        }
    }
    return parts.length ? "How lookups were answered in the " + nodeLookupsWindowPhrase(model) + ". " + parts.join("; ") : "No lookups yet";
}

function nodeLookupsHeroSub(model) {
    if (!nodeLookupsWindowReady(model)) {
        return "Collecting…";
    }
    var total = nodeLookupsTotal(model);
    var phrase = nodeLookupsWindowPhrase(model);
    if (total === 0) {
        return "No lookups in the " + phrase;
    }
    return total + " lookups in the " + phrase + ", " + nodeLookupsPercentText(nodeLookupsWindow(model).own, total) + " found without reading";
}

/**
 * The result of the window in words: red if lookups read beyond the limit or climbed, muted otherwise. The durations
 * are the real time of the samples that had it, so a changed poll period does not change the message.
 */
function nodeLookupsTrendMessage(model) {
    var w = nodeLookupsWindow(model);
    if (!nodeLookupsWindowReady(model)) {
        return { text: "", tone: "muted" };
    }
    var limit = nodeLookupsValue(model, "indexScanLimit");
    var overSeconds = 0;
    var climbSeconds = 0;
    for (var i = 0; i < w.samples.length; i++) {
        if (limit > 0 && w.samples[i].over > 0) {
            overSeconds += w.samples[i].dt;
        }
        if (w.samples[i].climbed > 0) {
            climbSeconds += w.samples[i].dt;
        }
    }
    var parts = [];
    if (overSeconds > 0) {
        parts.push("Beyond the limit for " + nodeLookupsDuration(overSeconds));
    }
    if (climbSeconds > 0) {
        parts.push((parts.length ? "climbing" : "Climbing") + " for " + nodeLookupsDuration(climbSeconds));
    }
    if (parts.length) {
        return { text: parts.join(" · "), tone: "bad" };
    }
    if (w.forward + w.climbed === 0) {
        return { text: "No lookups that had to read", tone: "muted" };
    }
    return { text: limit > 0 ? "None over the limit" : "No climbs", tone: "muted" };
}

/** True if lookups of the window read more than the scan limit, which can only happen with a limit and documents that lack its anchors. */
function nodeLookupsOverLimit(model) {
    return nodeLookupsValue(model, "indexScanLimit") > 0 && nodeLookupsWindow(model).over > 0;
}

function nodeLookupsAdvice(model) {
    if (!nodeLookupsOverLimit(model)) {
        return "";
    }
    return "In the " + nodeLookupsWindowPhrase(model) + ", " + nodeLookupsWindow(model).over + " lookups read more than " +
        nodeLookupsValue(model, "indexScanLimit") + " records. The documents they belong to were stored before anchors were " +
        "switched on, or have had many updates. A reindex in STORE mode or a defragmentation adds the anchors again.";
}

function nodeLookupsAnchorsOffNote(model) {
    return nodeLookupsValue(model, "indexScanLimit") === 0 && nodeLookupsValue(model, "readForward") > 0;
}

/** The settings, and what the bean counted since the server started, which keeps the memory of rare events. */
function nodeLookupsFootnote(model) {
    var limit = nodeLookupsValue(model, "indexScanLimit");
    var total = nodeLookupsValue(model, "exactHits") + nodeLookupsValue(model, "readForward") + nodeLookupsValue(model, "climbed");
    var since = "since the server started: " + total + " lookups" +
        (limit > 0 ? ", " + nodeLookupsValue(model, "beyondLimit") + " beyond the limit" : "");
    return "index-depth " + nodeLookupsValue(model, "indexDepth") + " · " +
        (limit > 0 ? "index-scan-limit " + limit : "index-scan-limit 0 (no anchors)") +
        " · " + since +
        " · entries ignored " + nodeLookupsValue(model, "rejectedEntries") +
        " · forward-link hops " + nodeLookupsValue(model, "forwardLinkHops");
}

function nodeLookupsPerLookupText(row) {
    var perLookup = row && row.perLookup || 0;
    return nodeLookupsFixed(perLookup);
}

/** The records per lookup of a document against the scan limit, as a width; 0 without a limit. */
function nodeLookupsRowWidth(row, model) {
    var limit = nodeLookupsValue(model, "indexScanLimit");
    if (limit <= 0 || !row) {
        return "0%";
    }
    return Math.min(100, 100 * (row.perLookup || 0) / limit).toFixed(0) + "%";
}

function nodeLookupsRowOver(row, model) {
    var limit = nodeLookupsValue(model, "indexScanLimit");
    return limit > 0 && !!row && (row.perLookup || 0) > limit;
}

// ---- the sparkline and the lane ------------------------------------------------------------------------------------

/** The scale reaches the limit, so it is always in view, and a spike expands it; without a limit it follows the data. */
function nodeLookupsYMax(limit, peak) {
    var fitted = Math.ceil(peak * 1.05);
    return limit > 0 ? Math.max(limit, fitted) : Math.max(1, fitted);
}

function nodeLookupsPeak(samples) {
    var peak = 0;
    for (var i = 0; i < samples.length; i++) {
        if (samples[i].cost !== null && samples[i].cost > peak) {
            peak = samples[i].cost;
        }
    }
    return peak;
}

function nodeLookupsSparkPoints(samples) {
    var points = [];
    for (var i = 0; i < samples.length; i++) {
        var s = samples[i];
        points.push({ x: s.t, y: s.cost, reads: s.reads, over: s.over, climbed: s.climbed, dt: s.dt });
    }
    return points;
}

/** Two rows, red above orange: an interval with lookups beyond the limit, an interval with climbs. */
function nodeLookupsLanePoints(samples, limit) {
    var over = [];
    var climbed = [];
    for (var i = 0; i < samples.length; i++) {
        if (limit > 0 && samples[i].over > 0) {
            over.push({ x: samples[i].t, y: [1.1, 1.9], n: samples[i].over });
        }
        if (samples[i].climbed > 0) {
            climbed.push({ x: samples[i].t, y: [0.1, 0.9], n: samples[i].climbed });
        }
    }
    return { over: over, climbed: climbed };
}

function nodeLookupsCaptionLabel(model) {
    var message = nodeLookupsTrendMessage(model);
    return nodeLookupsSpanText(model) + ", now " + nodeLookupsNowText(model) + ". " + message.text +
        ". Peak " + nodeLookupsFixed(nodeLookupsPeak(nodeLookupsWindow(model).samples)) + " records per read.";
}

function nodeLookupsTimeTick(value) {
    var date = new Date(value);
    if (date.getSeconds() % 20 !== 0) {
        return "";
    }
    var pad = function(n) { return (n < 10 ? "0" : "") + n; };
    return pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
}

/** The limit as a hairline with its label, and the latest cost as a dot with a ring: the only two direct labels. */
var nodeLookupsSparkPlugin = {
    id: "nodeLookupsSpark",
    afterDatasetsDraw: function(chart) {
        var info = chart.$nodeLookups;
        if (!info) {
            return;
        }
        var ctx = chart.ctx;
        var area = chart.chartArea;
        var y = chart.scales.y;
        ctx.save();
        if (info.limit > 0) {
            var ly = Math.round(y.getPixelForValue(info.limit)) + 0.5;
            ctx.strokeStyle = "#c5cdd6";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(area.left, ly);
            ctx.lineTo(area.right, ly);
            ctx.stroke();
            ctx.fillStyle = "#999";
            ctx.font = "10px sans-serif";
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText("limit " + info.limit, area.left + 2, ly + 2);
        }
        if (info.last && info.last.cost !== null) {
            var px = chart.scales.x.getPixelForValue(info.last.t);
            var py = y.getPixelForValue(info.last.cost);
            ctx.fillStyle = "#3c8dbc";
            ctx.beginPath();
            ctx.arc(px, py, 4, 0, 2 * Math.PI);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#fff";
            ctx.stroke();
        }
        ctx.restore();
    }
};

function nodeLookupsTimeScale(min, max) {
    return { type: "time", min: min, max: max, display: false, grid: { display: false } };
}

function nodeLookupsCreateCharts(model) {
    var spark = $("#nl-spark");
    var lane = $("#nl-lane");
    if (!spark.length || !lane.length) {
        return null;
    }
    var sparkChart = new Chart(MonexCharts.ensureCanvas(spark), {
        type: "line",
        plugins: [nodeLookupsSparkPlugin],
        data: {
            datasets: [{
                data: [],
                borderColor: "#3c8dbc",
                backgroundColor: "rgba(60, 141, 188, 0.10)",
                fill: true,
                borderWidth: 2,
                pointRadius: 0,
                spanGaps: false,
                tension: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            layout: { padding: { top: 1, bottom: 0, left: 0, right: 5 } },
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function(items) {
                            return items.length ? new Date(items[0].parsed.x).toLocaleTimeString() : "";
                        },
                        label: function(item) {
                            return item.parsed.y === null ? "no lookups that had to read" : nodeLookupsFixed(item.parsed.y) + " records per read";
                        },
                        afterBody: function(items) {
                            var raw = items.length ? items[0].raw : null;
                            if (!raw || raw.y === null) {
                                return [];
                            }
                            var lines = [raw.reads + " reads in " + raw.dt.toFixed(1) + " s"];
                            if (raw.over > 0) {
                                lines.push(raw.over + " beyond the limit");
                            }
                            if (raw.climbed > 0) {
                                lines.push(raw.climbed + " climbed to an ancestor");
                            }
                            return lines;
                        }
                    }
                }
            },
            scales: { x: nodeLookupsTimeScale(0, 1), y: { min: 0, max: 1, display: false } }
        }
    });
    var laneChart = new Chart(MonexCharts.ensureCanvas(lane), {
        type: "bar",
        data: {
            datasets: [
                { label: "Read beyond the limit", data: [], backgroundColor: "#c23321", barThickness: 3, borderRadius: 1.5 },
                { label: "Climbed to an ancestor", data: [], backgroundColor: "#f39c12", barThickness: 3, borderRadius: 1.5 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            layout: { padding: { right: 5 } },
            interaction: { mode: "nearest", intersect: true },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function(items) {
                            return items.length ? new Date(items[0].parsed.x).toLocaleTimeString() : "";
                        },
                        label: function(item) {
                            return item.dataset.label + ": " + item.raw.n + " lookups";
                        }
                    }
                }
            },
            scales: { x: nodeLookupsTimeScale(0, 1), y: { min: 0, max: 2, display: false } }
        }
    });
    return { spark: sparkChart, lane: laneChart };
}

function nodeLookupsRenderTrend(model) {
    if (typeof Chart === "undefined" || typeof MonexCharts === "undefined" || typeof $ === "undefined" ||
        !model.available() || !nodeLookupsWindowReady(model)) {
        return;
    }
    if (!model.trend.charts) {
        model.trend.charts = nodeLookupsCreateCharts(model);
        if (!model.trend.charts) {
            return;
        }
    }
    var samples = nodeLookupsWindow(model).samples;
    var limit = nodeLookupsValue(model, "indexScanLimit");
    var first = samples[0].t;
    var last = samples[samples.length - 1];
    var charts = model.trend.charts;
    charts.spark.$nodeLookups = { limit: limit, last: last };
    charts.spark.data.datasets[0].data = nodeLookupsSparkPoints(samples);
    charts.spark.options.scales.x.min = first;
    charts.spark.options.scales.x.max = last.t;
    charts.spark.options.scales.y.max = nodeLookupsYMax(limit, nodeLookupsPeak(samples));
    charts.spark.update("none");
    var lane = nodeLookupsLanePoints(samples, limit);
    charts.lane.data.datasets[0].data = lane.over;
    charts.lane.data.datasets[1].data = lane.climbed;
    charts.lane.options.scales.x.min = first;
    charts.lane.options.scales.x.max = last.t;
    charts.lane.update("none");
    var label = nodeLookupsCaptionLabel(model);
    charts.spark.canvas.setAttribute("aria-label", label);
    charts.lane.canvas.setAttribute("aria-label", "Intervals with lookups beyond the limit and with climbs. " + label);
}

Monex.nodeLookups = {
    jmxNodeLookupsToPayload: jmxNodeLookupsToPayload,
    createViewModel: createNodeLookupsViewModel,
    syncFromJmx: syncNodeLookupsFromJmx,
    panelVisible: nodeLookupsPanelVisible,
    interval: nodeLookupsInterval,
    record: nodeLookupsRecord,
    total: nodeLookupsTotal,
    recordsPerRead: nodeLookupsRecordsPerRead,
    nowText: nodeLookupsNowText,
    spanText: nodeLookupsSpanText,
    windowPhrase: nodeLookupsWindowPhrase,
    segments: nodeLookupsSegments,
    barEmpty: nodeLookupsBarEmpty,
    barSummary: nodeLookupsBarSummary,
    heroSub: nodeLookupsHeroSub,
    trendMessage: nodeLookupsTrendMessage,
    footnote: nodeLookupsFootnote,
    overLimit: nodeLookupsOverLimit,
    advice: nodeLookupsAdvice,
    anchorsOffNote: nodeLookupsAnchorsOffNote,
    perLookupText: nodeLookupsPerLookupText,
    rowWidth: nodeLookupsRowWidth,
    rowOver: nodeLookupsRowOver,
    yMax: nodeLookupsYMax,
    sparkPoints: nodeLookupsSparkPoints,
    lanePoints: nodeLookupsLanePoints
};
