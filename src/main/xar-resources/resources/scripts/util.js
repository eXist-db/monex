/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
var JMX = {};

JMX.util = (function() {
    var RECENT_QUERY_MIN_DISPLAY_MS = 300000;
    var recentQueryStore = {};

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
        var configured = 120000;
        if (typeof $ !== "undefined") {
            var input = $("#history-timespan").val();
            var parsed = parseInt(input, 10);
            if (!isNaN(parsed) && parsed > 0) {
                configured = parsed;
            }
        }
        return Math.max(configured, RECENT_QUERY_MIN_DISPLAY_MS);
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

        mergeRecentQueryHistory: mergeRecentQueryHistory
    }
}());
