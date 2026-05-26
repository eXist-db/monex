/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
var JMX = {};

JMX.util = (function() {
    var RECENT_QUERY_MIN_DISPLAY_MS = 300000;
    var recentQueryStore = {};

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

    var savedThresholdMs = 100;
    var savedServerHistoryTimespanMs = 120000;
    var savedTrackUri = false;
    var recentQueryFormBound = false;
    var configureStatusTimer = null;

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

    function recentQueryKey(row) {
        return [
            row.mostRecentExecutionTime,
            row.sourceKey || "",
            row.requestURI || ""
        ].join("\0");
    }

    function normalizeRecentQueryRow(row) {
        if (!row) {
            return null;
        }
        var time = row.mostRecentExecutionTime;
        if (time === undefined && row.value) {
            time = row.value.mostRecentExecutionTime;
        }
        if (time === undefined || time === null || time === "") {
            return null;
        }
        return {
            mostRecentExecutionTime: String(time),
            mostRecentExecutionDuration: String(row.mostRecentExecutionDuration || (row.value && row.value.mostRecentExecutionDuration) || ""),
            sourceKey: row.sourceKey || (row.value && row.value.sourceKey) || "",
            requestURI: row.requestURI || (row.value && row.value.requestURI) || ""
        };
    }

    function recentQueryDisplayRetentionMs() {
        return Math.max(savedServerHistoryTimespanMs, RECENT_QUERY_MIN_DISPLAY_MS);
    }

    function mergeRecentQueryHistory(incoming) {
        var retention = recentQueryDisplayRetentionMs();
        var now = Date.now();
        var rows = incoming || [];
        for (var i = 0; i < rows.length; i++) {
            var normalized = normalizeRecentQueryRow(rows[i]);
            if (normalized) {
                recentQueryStore[recentQueryKey(normalized)] = normalized;
            }
        }
        var merged = [];
        for (var key in recentQueryStore) {
            if (!Object.prototype.hasOwnProperty.call(recentQueryStore, key)) {
                continue;
            }
            var entry = recentQueryStore[key];
            var executedAt = parseInt(entry.mostRecentExecutionTime, 10);
            if (isNaN(executedAt)) {
                delete recentQueryStore[key];
                continue;
            }
            if (now - executedAt <= retention) {
                merged.push(entry);
            } else {
                delete recentQueryStore[key];
            }
        }
        merged.sort(function(a, b) {
            return parseInt(b.mostRecentExecutionTime, 10) - parseInt(a.mostRecentExecutionTime, 10);
        });
        return merged;
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
        if (!report) {
            return;
        }
        var historyMs = parsePositiveInt(report.HistoryTimespan, savedServerHistoryTimespanMs);
        savedServerHistoryTimespanMs = historyMs;
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

    function initRecentQueryForm(report) {
        if (typeof $ === "undefined") {
            return;
        }
        populatePresetSelect($("#threshold-preset"), THRESHOLD_PRESETS);
        populatePresetSelect($("#history-preset"), HISTORY_PRESETS);
        populateRecentQueryForm(report);
        bindRecentQueryForm();
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
                if (!queries || !queries.length) {
                    data.jmx.ProcessReport.RunningQueries = [];
                }
                var jobs = data.jmx.ProcessReport.RunningJobs;
                if (!jobs || !jobs.length) {
                    data.jmx.ProcessReport.RunningJobs = [];
                }
                var recent = data.jmx.ProcessReport.RecentQueryHistory;
                if (!recent || !recent.length) {
                    data.jmx.ProcessReport.RecentQueryHistory = [];
                } else {
                    data.jmx.ProcessReport.RecentQueryHistory = mergeRecentQueryHistory(recent);
                }
            }
            if (data.jmx.LockManager) {
                var waiting = data.jmx.LockManager.WaitingThreads;
                if (!waiting || !waiting.length) {
                    data.jmx.LockManager.WaitingThreads = [];
                }
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
            return data;
        },

        mergeRecentQueryHistory: mergeRecentQueryHistory,
        recentQueryDisplayRetentionMs: recentQueryDisplayRetentionMs,
        initRecentQueryForm: initRecentQueryForm,
        syncRecentQueryFromReport: syncRecentQueryFromReport,
        readRecentQueryThresholdMs: readThresholdMs,
        readRecentQueryHistoryMs: readHistoryTimespanMs,
        isRecentQueryFormDirty: isRecentQueryFormDirty,
        markRecentQueryConfigSaved: markRecentQueryConfigSaved,
        setRecentQueryServerHistory: function(ms) {
            savedServerHistoryTimespanMs = parsePositiveInt(ms, savedServerHistoryTimespanMs);
        },
        THRESHOLD_PRESETS: THRESHOLD_PRESETS,
        HISTORY_PRESETS: HISTORY_PRESETS,
        RECENT_QUERY_MIN_DISPLAY_MS: RECENT_QUERY_MIN_DISPLAY_MS,
        runningQueryField: runningQueryField,
        runningQueryKillId: runningQueryKillId
    }
}());
