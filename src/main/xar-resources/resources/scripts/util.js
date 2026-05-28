/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
var JMX = {};

JMX.util = (function() {
    var DISPLAY_RETENTION_STORAGE_KEY = "monex.activityDisplayRetentionMs";
    var DEFAULT_DISPLAY_RETENTION_MS = 300000;

    var THRESHOLD_PRESETS = [
        { label: "100 ms", ms: 100 },
        { label: "500 ms", ms: 500 },
        { label: "1 s", ms: 1000 },
        { label: "5 s", ms: 5000 }
    ];

    var HISTORY_PRESETS = [
        { label: "1 minute", ms: 60000 },
        { label: "2 minutes", ms: 120000 },
        { label: "5 minutes", ms: 300000 },
        { label: "10 minutes", ms: 600000 }
    ];

    var DISPLAY_RETENTION_PRESETS = [
        { label: "1 minute", ms: 60000 },
        { label: "2 minutes", ms: 120000 },
        { label: "5 minutes", ms: 300000 },
        { label: "10 minutes", ms: 600000 }
    ];

    var savedThresholdMs = 100;
    var savedServerHistoryTimespanMs = 120000;
    var savedTrackUri = false;
    var savedDisplayRetentionMs = DEFAULT_DISPLAY_RETENTION_MS;
    var recentQueryFormBound = false;
    var displayRetentionFormBound = false;
    var configureStatusTimer = null;

    var runningQueryBuffer = createActivityBuffer();
    var waitingThreadBuffer = createActivityBuffer();
    var recentQueryBuffer = createActivityBuffer();

    function parsePositiveInt(value, fallback) {
        var parsed = parseInt(value, 10);
        if (isNaN(parsed) || parsed <= 0) {
            return fallback;
        }
        return parsed;
    }

    function presetValueForMs(ms, presets) {
        var parsed = parsePositiveInt(ms, -1);
        for (var i = 0; i < presets.length; i++) {
            if (presets[i].ms === parsed) {
                return String(presets[i].ms);
            }
        }
        return "custom";
    }

    function readStoredDisplayRetentionMs() {
        if (typeof window === "undefined" || !window.localStorage) {
            return DEFAULT_DISPLAY_RETENTION_MS;
        }
        try {
            return parsePositiveInt(
                window.localStorage.getItem(DISPLAY_RETENTION_STORAGE_KEY),
                DEFAULT_DISPLAY_RETENTION_MS
            );
        } catch (err) {
            return DEFAULT_DISPLAY_RETENTION_MS;
        }
    }

    function persistDisplayRetentionMs(ms) {
        savedDisplayRetentionMs = ms;
        if (typeof window !== "undefined" && window.localStorage) {
            try {
                window.localStorage.setItem(DISPLAY_RETENTION_STORAGE_KEY, String(ms));
            } catch (err) {
                // ignore quota / privacy mode
            }
        }
    }

    function dashboardDisplayRetentionMs() {
        return savedDisplayRetentionMs;
    }

    function createActivityBuffer() {
        var store = {};

        function purgeAndCollect(retentionMs, now) {
            var merged = [];
            for (var key in store) {
                if (!Object.prototype.hasOwnProperty.call(store, key)) {
                    continue;
                }
                var entry = store[key];
                var anchor = entry.activityEnded ? entry.endedAt : entry.lastSeenAt;
                if (now - anchor > retentionMs) {
                    delete store[key];
                    continue;
                }
                var out = {};
                for (var field in entry.data) {
                    if (Object.prototype.hasOwnProperty.call(entry.data, field)) {
                        out[field] = entry.data[field];
                    }
                }
                out.activityEnded = entry.activityEnded;
                merged.push(out);
            }
            return merged;
        }

        return {
            merge: function(incoming, keyFn, normalizeFn, sortFn) {
                var retentionMs = dashboardDisplayRetentionMs();
                var now = Date.now();
                var incomingKeys = {};
                var rows = incoming || [];

                for (var i = 0; i < rows.length; i++) {
                    var normalized = normalizeFn(rows[i]);
                    if (!normalized) {
                        continue;
                    }
                    var key = keyFn(normalized, rows[i]);
                    if (!key) {
                        continue;
                    }
                    incomingKeys[key] = true;
                    store[key] = {
                        data: normalized,
                        lastSeenAt: now,
                        endedAt: null,
                        activityEnded: false
                    };
                }

                for (var storeKey in store) {
                    if (!Object.prototype.hasOwnProperty.call(store, storeKey)) {
                        continue;
                    }
                    if (!incomingKeys[storeKey] && !store[storeKey].activityEnded) {
                        store[storeKey].activityEnded = true;
                        store[storeKey].endedAt = now;
                    }
                }

                var merged = purgeAndCollect(retentionMs, now);
                if (sortFn) {
                    merged.sort(sortFn);
                }
                return merged;
            },
            reset: function() {
                store = {};
            }
        };
    }

    function recentQueryKey(row) {
        return [
            row.mostRecentExecutionTime,
            row.sourceKey || "",
            row.requestURI || ""
        ].join("\0");
    }

    function jmxFieldText(value) {
        value = observableValue(value);
        if (value === undefined || value === null || value === "") {
            return "";
        }
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            return String(value);
        }
        if (typeof value === "object") {
            if (typeof value["#text"] === "string") {
                return value["#text"];
            }
            var keys = Object.keys(value);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                if (key.indexOf(":") === -1 && typeof value[key] === "string") {
                    return value[key];
                }
            }
        }
        return "";
    }

    function normalizeRecentQueryRow(row) {
        if (!row) {
            return null;
        }
        var time = jmxFieldText(runningQueryField(row, "mostRecentExecutionTime"));
        if (!time) {
            return null;
        }
        return {
            mostRecentExecutionTime: time,
            mostRecentExecutionDuration: jmxFieldText(runningQueryField(row, "mostRecentExecutionDuration")),
            sourceKey: jmxFieldText(runningQueryField(row, "sourceKey")),
            requestURI: jmxFieldText(runningQueryField(row, "requestURI"))
        };
    }

    function normalizeRunningQueryRow(row) {
        if (!row) {
            return null;
        }
        var id = runningQueryField(row, "id");
        var thread = runningQueryField(row, "thread");
        if ((id === undefined || id === null || id === "") && !thread) {
            return null;
        }
        return {
            id: id !== undefined && id !== null ? jmxFieldText(id) : "",
            thread: thread !== undefined && thread !== null ? jmxFieldText(thread) : "",
            sourceKey: jmxFieldText(runningQueryField(row, "sourceKey")),
            requestURI: jmxFieldText(runningQueryField(row, "requestURI")),
            terminating: jmxFieldText(runningQueryField(row, "terminating")) || "false",
            elapsed: jmxFieldText(runningQueryField(row, "elapsed"))
        };
    }

    function runningQueryBufferKey(normalized) {
        if (normalized.id) {
            return "rq:" + normalized.id;
        }
        if (normalized.thread) {
            return "rq:t:" + normalized.thread;
        }
        return null;
    }

    function normalizeWaitingThreadRow(row) {
        if (!row) {
            return null;
        }
        var id = row.id;
        if (id === undefined && row.value) {
            id = row.value.id;
        }
        if (id === undefined || id === null || id === "") {
            return null;
        }
        var owner = row.owner;
        if (owner === undefined && row.value) {
            owner = row.value.owner;
        }
        var waitingThread = row.waitingThread;
        if (waitingThread === undefined && row.value) {
            waitingThread = row.value.waitingThread;
        }
        return {
            id: String(id),
            owner: String(owner || ""),
            waitingThread: waitingThread !== undefined && waitingThread !== null ? String(waitingThread) : ""
        };
    }

    function waitingThreadBufferKey(normalized) {
        return normalized.id ? "wt:" + normalized.id : null;
    }

    function sortEndedRowsLiveFirst(a, b) {
        if (!!a.activityEnded !== !!b.activityEnded) {
            return a.activityEnded ? 1 : -1;
        }
        if (!a.activityEnded && !b.activityEnded) {
            var elapsedA = parseInt(a.elapsed, 10) || 0;
            var elapsedB = parseInt(b.elapsed, 10) || 0;
            if (elapsedA !== elapsedB) {
                return elapsedB - elapsedA;
            }
        }
        return String(a.id || a.thread || "").localeCompare(String(b.id || b.thread || ""));
    }

    function formatQueryElapsed(ms) {
        var n = parseInt(ms, 10);
        if (isNaN(n) || n < 0) {
            return "";
        }
        if (n < 1000) {
            return n + " ms";
        }
        if (n < 60000) {
            return (n / 1000).toFixed(1) + " s";
        }
        var mins = Math.floor(n / 60000);
        var secs = Math.floor((n % 60000) / 1000);
        return mins + "m " + secs + "s";
    }

    function sortRecentQueriesNewestFirst(a, b) {
        return parseInt(b.mostRecentExecutionTime, 10) - parseInt(a.mostRecentExecutionTime, 10);
    }

    function mergeRunningQueries(incoming) {
        return runningQueryBuffer.merge(
            incoming,
            runningQueryBufferKey,
            normalizeRunningQueryRow,
            sortEndedRowsLiveFirst
        );
    }

    function mergeWaitingThreads(incoming) {
        return waitingThreadBuffer.merge(
            incoming,
            waitingThreadBufferKey,
            normalizeWaitingThreadRow,
            sortEndedRowsLiveFirst
        );
    }

    function mergeRecentQueryHistory(incoming) {
        return recentQueryBuffer.merge(
            incoming,
            function(normalized) {
                return recentQueryKey(normalized);
            },
            normalizeRecentQueryRow,
            sortRecentQueriesNewestFirst
        );
    }

    function populatePresetSelect($select, presets) {
        $select.empty();
        for (var i = 0; i < presets.length; i++) {
            $select.append(
                $("<option/>").val(String(presets[i].ms)).text(presets[i].label)
            );
        }
        $select.append($("<option/>").val("custom").text("Custom…"));
    }

    function toggleCustomWrap($select, $wrap) {
        if ($select.val() === "custom") {
            $wrap.removeAttr("hidden");
        } else {
            $wrap.attr("hidden", "hidden");
        }
    }

    function readThresholdMs() {
        var preset = $("#threshold-preset").val();
        if (preset === "custom") {
            return parsePositiveInt($("#threshold-custom").val(), savedThresholdMs);
        }
        return parsePositiveInt(preset, savedThresholdMs);
    }

    function readHistoryTimespanMs() {
        var preset = $("#history-preset").val();
        if (preset === "custom") {
            var minutes = parsePositiveInt($("#history-custom").val(), Math.round(savedServerHistoryTimespanMs / 60000));
            return minutes * 60000;
        }
        return parsePositiveInt(preset, savedServerHistoryTimespanMs);
    }

    function readTrackUri() {
        return $("#track-uri").is(":checked");
    }

    function readDisplayRetentionMs() {
        var preset = $("#display-retention-preset").val();
        if (preset === "custom") {
            var minutes = parsePositiveInt(
                $("#display-retention-custom").val(),
                Math.round(savedDisplayRetentionMs / 60000)
            );
            return minutes * 60000;
        }
        return parsePositiveInt(preset, savedDisplayRetentionMs);
    }

    function populateDisplayRetentionForm() {
        if (typeof $ === "undefined") {
            return;
        }
        $("#display-retention-preset").val(presetValueForMs(savedDisplayRetentionMs, DISPLAY_RETENTION_PRESETS));
        if ($("#display-retention-preset").val() === "custom") {
            $("#display-retention-custom").val(Math.max(1, Math.round(savedDisplayRetentionMs / 60000)));
        }
        toggleCustomWrap($("#display-retention-preset"), $("#display-retention-custom-wrap"));
    }

    function applyDisplayRetentionFromForm() {
        persistDisplayRetentionMs(readDisplayRetentionMs());
    }

    function setConfigureStatus(message, className) {
        var $status = $("#configure-status");
        $status.removeClass("text-success text-danger text-muted");
        if (className) {
            $status.addClass(className);
        }
        $status.text(message || "");
        if (configureStatusTimer) {
            clearTimeout(configureStatusTimer);
            configureStatusTimer = null;
        }
        if (message) {
            configureStatusTimer = setTimeout(function() {
                $status.text("");
                $status.removeClass("text-success text-danger text-muted");
            }, 4000);
        }
    }

    function updateRecentQueryDirtyState() {
        var dirty =
            readThresholdMs() !== savedThresholdMs ||
            readHistoryTimespanMs() !== savedServerHistoryTimespanMs ||
            readTrackUri() !== savedTrackUri;
        if (dirty) {
            $("#configure-dirty").removeAttr("hidden");
        } else {
            $("#configure-dirty").attr("hidden", "hidden");
        }
    }

    function populateRecentQueryForm(report) {
        if (!report || typeof $ === "undefined") {
            return;
        }
        var thresholdMs = parsePositiveInt(report.MinTime, savedThresholdMs);
        var historyMs = parsePositiveInt(report.HistoryTimespan, savedServerHistoryTimespanMs);
        var trackUri = report.TrackRequestURI === "true" || report.TrackRequestURI === true;

        savedThresholdMs = thresholdMs;
        savedServerHistoryTimespanMs = historyMs;
        savedTrackUri = trackUri;

        $("#threshold-preset").val(presetValueForMs(thresholdMs, THRESHOLD_PRESETS));
        if ($("#threshold-preset").val() === "custom") {
            $("#threshold-custom").val(thresholdMs);
        }
        toggleCustomWrap($("#threshold-preset"), $("#threshold-custom-wrap"));

        $("#history-preset").val(presetValueForMs(historyMs, HISTORY_PRESETS));
        if ($("#history-preset").val() === "custom") {
            $("#history-custom").val(Math.max(1, Math.round(historyMs / 60000)));
        }
        toggleCustomWrap($("#history-preset"), $("#history-custom-wrap"));

        $("#track-uri").prop("checked", trackUri);
        updateRecentQueryDirtyState();
    }

    function syncRecentQueryFromReport(report) {
        if (!report || typeof $ === "undefined" || !$("#threshold-preset").length) {
            return;
        }
        savedServerHistoryTimespanMs = parsePositiveInt(report.HistoryTimespan, savedServerHistoryTimespanMs);
        if (typeof $ !== "undefined" && !isRecentQueryFormDirty()) {
            populateRecentQueryForm(report);
        }
    }

    function isRecentQueryFormDirty() {
        return (
            readThresholdMs() !== savedThresholdMs ||
            readHistoryTimespanMs() !== savedServerHistoryTimespanMs ||
            readTrackUri() !== savedTrackUri
        );
    }

    function markRecentQueryConfigSaved(thresholdMs, historyMs, trackUri) {
        savedThresholdMs = thresholdMs;
        savedServerHistoryTimespanMs = historyMs;
        savedTrackUri = trackUri;
        updateRecentQueryDirtyState();
    }

    function bindDisplayRetentionForm() {
        if (displayRetentionFormBound || typeof $ === "undefined") {
            return;
        }
        displayRetentionFormBound = true;

        $("#display-retention-preset").on("change", function() {
            toggleCustomWrap($("#display-retention-preset"), $("#display-retention-custom-wrap"));
            applyDisplayRetentionFromForm();
        });
        $("#display-retention-custom").on("change input", applyDisplayRetentionFromForm);
    }

    function bindRecentQueryForm() {
        if (recentQueryFormBound || typeof $ === "undefined") {
            return;
        }
        recentQueryFormBound = true;

        $("#threshold-preset").on("change", function() {
            toggleCustomWrap($("#threshold-preset"), $("#threshold-custom-wrap"));
            updateRecentQueryDirtyState();
        });
        $("#history-preset").on("change", function() {
            toggleCustomWrap($("#history-preset"), $("#history-custom-wrap"));
            updateRecentQueryDirtyState();
        });
        $("#threshold-custom, #history-custom, #track-uri").on("change input", updateRecentQueryDirtyState);

        $("#configure-history").on("submit", function(ev) {
            ev.preventDefault();
            var threshold = readThresholdMs();
            var historyTimespan = readHistoryTimespanMs();
            var trackURI = readTrackUri();
            var $btn = $("#configure");

            $btn.prop("disabled", true).text("Applying…");
            setConfigureStatus("Applying…", "text-muted");

            JMX.connection.invoke(
                "configure",
                "org.exist.management.exist:type=ProcessReport",
                [threshold, historyTimespan, trackURI],
                {
                    success: function() {
                        markRecentQueryConfigSaved(threshold, historyTimespan, trackURI);
                        $btn.prop("disabled", false).text("Set");
                        setConfigureStatus("Saved", "text-success");
                    },
                    error: function() {
                        $btn.prop("disabled", false).text("Set");
                        setConfigureStatus("Failed to save", "text-danger");
                    }
                }
            );
        });
    }

    function initActivityPanelSettings(report) {
        if (typeof $ === "undefined") {
            return;
        }
        savedDisplayRetentionMs = readStoredDisplayRetentionMs();
        populatePresetSelect($("#display-retention-preset"), DISPLAY_RETENTION_PRESETS);
        populateDisplayRetentionForm();
        bindDisplayRetentionForm();

        populatePresetSelect($("#threshold-preset"), THRESHOLD_PRESETS);
        populatePresetSelect($("#history-preset"), HISTORY_PRESETS);
        bindRecentQueryForm();

        if (report && report.TrackRequestURI !== undefined) {
            populateRecentQueryForm(report);
        } else {
            $("#configure-history-wrap").hide();
        }
    }

    function observableValue(value) {
        if (value && typeof ko !== "undefined" && ko.isObservable(value)) {
            return value();
        }
        return value;
    }

    function runningQueryField(row, name) {
        if (!row || !name) {
            return undefined;
        }
        if (row[name] !== undefined && row[name] !== null) {
            return observableValue(row[name]);
        }
        if (row.value && row.value[name] !== undefined && row.value[name] !== null) {
            return observableValue(row.value[name]);
        }
        return undefined;
    }

    function runningQueryKillId(row) {
        var id = runningQueryField(row, "id");
        if (id === undefined || id === null || id === "") {
            return null;
        }
        var parsed = parseInt(id, 10);
        return isNaN(parsed) ? null : parsed;
    }

    function formatActivityUri(uri) {
        if (!uri || uri === "#") {
            return "—";
        }
        var label = uri;
        try {
            label = decodeURIComponent(uri);
        } catch (err) {
            label = uri;
        }

        var rest = label.match(/\/(?:exist\/)?rest\/([^/?]+)(?:\?(.*))?$/);
        if (rest) {
            var collection = rest[1];
            var query = rest[2] || "";
            if (query.indexOf("_query=") !== -1) {
                return "REST · " + collection + " · XQuery";
            }
            if (query.indexOf("_xupdate=") !== -1) {
                return "REST · " + collection + " · XUpdate";
            }
            if (query.indexOf("_wrap=") !== -1) {
                return "REST · " + collection + " · wrap";
            }
            return "REST · " + collection;
        }

        label = label.replace(/^\/exist\//, "");

        if (label.length > 52) {
            return label.slice(0, 49) + "…";
        }
        return label;
    }

    function activityUriTitle(uri) {
        if (!uri || uri === "#") {
            return "";
        }
        try {
            return decodeURIComponent(uri);
        } catch (err) {
            return uri;
        }
    }

    function activityRequestUri(row) {
        return jmxFieldText(runningQueryField(row, "requestURI"));
    }

    function activityRowEnded(row) {
        if (!row) {
            return false;
        }
        var ended = row.activityEnded;
        if (ended === true) {
            return true;
        }
        if (typeof ko !== "undefined" && ko.isObservable(ended)) {
            return ended() === true;
        }
        return false;
    }

    function cpuLoadRatio(os, key) {
        if (!os) {
            return 0;
        }
        var raw = os[key];
        if (raw === undefined || raw === null) {
            return 0;
        }
        var num = parseFloat(raw);
        if (isNaN(num) || num < 0) {
            return 0;
        }
        return num;
    }

    function normalizeCpuMetrics(jmx) {
        if (!jmx) {
            return;
        }
        var os = jmx.OperatingSystemImpl || jmx.UnixOperatingSystem;
        jmx.CpuLoad = {
            ProcessCpuLoad: cpuLoadRatio(os, "ProcessCpuLoad"),
            SystemCpuLoad: cpuLoadRatio(os, "SystemCpuLoad")
        };
    }

    return {
        jmx2js: function (node) {
            if (!node) {
                return null;
            }
            if (!(node.firstChild || node.attributes.length > 0)) {
                return null;
            }
            var parent = {};
            if (node.nodeType == Node.ELEMENT_NODE) {
                for (var i = 0; i < node.attributes.length; i++) {
                    parent[node.attributes[i].localName] = node.attributes[i].nodeValue;
                }
            }
            var child = node.firstChild;
            while (child) {
                if (child.nodeType == Node.ELEMENT_NODE) {
                    if (child.localName == "row") {
                        if (!(parent instanceof Array)) {
                            parent = [];
                        }
                        parent.push(JMX.util.jmx2js(child));
                    } else {
                        var existing = parent[child.localName];
                        if (existing) {
                            if (!(existing instanceof Array)) {
                                parent[child.localName] = [ existing ];
                                existing = parent[child.localName];
                            }
                            existing.push(JMX.util.jmx2js(child));
                        } else {
                            parent[child.localName] = JMX.util.jmx2js(child);
                        }
                    }
                } else if (node.childNodes.length == 1) {
                    return child.nodeValue;
                }
                child = child.nextSibling;
            }
            return parent;
        },

        fixjs: function(data) {
            if (!data) {
                return null;
            }
            if (data.jmx.ProcessReport) {
                syncRecentQueryFromReport(data.jmx.ProcessReport);
                var queries = data.jmx.ProcessReport.RunningQueries;
                data.jmx.ProcessReport.RunningQueries = mergeRunningQueries(
                    queries && queries.length ? queries : []
                );
                var jobs = data.jmx.ProcessReport.RunningJobs;
                if (!jobs || !jobs.length) {
                    data.jmx.ProcessReport.RunningJobs = [];
                }
                var recent = data.jmx.ProcessReport.RecentQueryHistory;
                data.jmx.ProcessReport.RecentQueryHistory = mergeRecentQueryHistory(
                    recent && recent.length ? recent : []
                );
            }
            if (data.jmx.LockManager) {
                var waiting = data.jmx.LockManager.WaitingThreads;
                data.jmx.LockManager.WaitingThreads = mergeWaitingThreads(
                    waiting && waiting.length ? waiting : []
                );
            } else if (data.jmx.LockTable) {
                var attempting = data.jmx.LockTable.Attempting;
                if (!attempting || !attempting.length) {
                    data.jmx.LockTable.Attempting = [];
                }
            }
            if (data.jmx.Database) {
                var active = data.jmx.Database.ActiveBrokersMap;
                if (!active || !active.length) {
                    data.jmx.Database.ActiveBrokersMap = [];
                }
            }
            normalizeCpuMetrics(data.jmx);
            return data;
        },

        mergeRecentQueryHistory: mergeRecentQueryHistory,
        mergeRunningQueries: mergeRunningQueries,
        mergeWaitingThreads: mergeWaitingThreads,
        dashboardDisplayRetentionMs: dashboardDisplayRetentionMs,
        recentQueryDisplayRetentionMs: dashboardDisplayRetentionMs,
        setDashboardDisplayRetentionMs: persistDisplayRetentionMs,
        setRecentQueryServerHistory: function(ms) {
            savedServerHistoryTimespanMs = parsePositiveInt(ms, savedServerHistoryTimespanMs);
        },
        resetActivityBuffers: function() {
            runningQueryBuffer.reset();
            waitingThreadBuffer.reset();
            recentQueryBuffer.reset();
        },
        initActivityPanelSettings: initActivityPanelSettings,
        initRecentQueryForm: function(report) {
            initActivityPanelSettings(report);
        },
        syncRecentQueryFromReport: syncRecentQueryFromReport,
        readRecentQueryThresholdMs: readThresholdMs,
        readRecentQueryHistoryMs: readHistoryTimespanMs,
        isRecentQueryFormDirty: isRecentQueryFormDirty,
        markRecentQueryConfigSaved: markRecentQueryConfigSaved,
        activityRowEnded: activityRowEnded,
        THRESHOLD_PRESETS: THRESHOLD_PRESETS,
        HISTORY_PRESETS: HISTORY_PRESETS,
        DISPLAY_RETENTION_PRESETS: DISPLAY_RETENTION_PRESETS,
        DEFAULT_DISPLAY_RETENTION_MS: DEFAULT_DISPLAY_RETENTION_MS,
        runningQueryField: runningQueryField,
        runningQueryKillId: runningQueryKillId,
        formatActivityUri: formatActivityUri,
        formatQueryElapsed: formatQueryElapsed,
        activityUriTitle: activityUriTitle,
        activityRequestUri: activityRequestUri,
        jmxFieldText: jmxFieldText
    }
}());
