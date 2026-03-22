/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 *
 * Live Query Monitor — connects to the _monitor channel on /ws
 * and displays a real-time dashboard of all running queries.
 */
var QueryMonitor = (function() {

    var connection;
    var queries = {};       // queryId -> { user, source, phase, items, elapsed, terminating, startTime, row }
    var eventBuffer = 50;
    var elapsedTimer;

    var PHASE_COLORS = {
        "parsing":      "label-default",
        "compiling":    "label-info",
        "evaluating":   "label-primary",
        "serializing":  "label-warning"
    };

    function formatElapsed(ms) {
        if (ms < 1000) return ms + "ms";
        if (ms < 60000) return (ms / 1000).toFixed(1) + "s";
        return (ms / 60000).toFixed(1) + "m";
    }

    function formatItems(n) {
        if (n === 0) return "-";
        if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
        if (n >= 1000) return (n / 1000).toFixed(1) + "K";
        return String(n);
    }

    function truncateSource(source, max) {
        if (!source) return "(inline)";
        if (source.length <= max) return source;
        // Show the filename from the end
        var parts = source.split("/");
        var filename = parts[parts.length - 1];
        return filename.length <= max ? filename : filename.substring(0, max - 3) + "...";
    }

    function addOrUpdateQuery(queryId, data) {
        var existing = queries[queryId];
        if (existing) {
            // Update
            if (data.user) existing.user = data.user;
            if (data.source) existing.source = data.source;
            if (data.phase) existing.phase = data.phase;
            if (data.items !== undefined) existing.items = data.items;
            if (data.elapsed !== undefined) {
                existing.elapsed = data.elapsed;
                existing.lastUpdate = Date.now();
            }
            if (data.terminating !== undefined) existing.terminating = data.terminating;
            renderRow(existing);
        } else {
            // New query
            var q = {
                queryId: queryId,
                user: data.user || "",
                source: data.source || "",
                phase: data.phase || "evaluating",
                items: data.items || 0,
                elapsed: data.elapsed || 0,
                terminating: data.terminating || false,
                lastUpdate: Date.now(),
                row: null
            };
            queries[queryId] = q;
            createRow(q);
        }
        updateEmptyState();
    }

    function removeQuery(queryId) {
        var q = queries[queryId];
        if (q && q.row) {
            $(q.row).fadeOut(300, function() {
                $(this).remove();
                updateEmptyState();
            });
        }
        delete queries[queryId];
    }

    function createRow(q) {
        $("#no-queries").hide();
        var tr = document.createElement("tr");
        tr.id = "q-" + q.queryId;

        // User
        var td = document.createElement("td");
        td.className = "hidden-xs q-user";
        td.textContent = q.user;
        tr.appendChild(td);

        // Source
        td = document.createElement("td");
        td.className = "q-source";
        td.title = q.source;
        td.setAttribute("data-toggle", "tooltip");
        td.textContent = truncateSource(q.source, 40);
        tr.appendChild(td);

        // Phase
        td = document.createElement("td");
        td.className = "q-phase";
        var badge = document.createElement("span");
        badge.className = "label " + (PHASE_COLORS[q.phase] || "label-default");
        badge.textContent = q.phase;
        td.appendChild(badge);
        tr.appendChild(td);

        // Items
        td = document.createElement("td");
        td.className = "hidden-xs q-items";
        td.textContent = formatItems(q.items);
        tr.appendChild(td);

        // Elapsed
        td = document.createElement("td");
        td.className = "q-elapsed";
        td.textContent = formatElapsed(q.elapsed);
        tr.appendChild(td);

        // Kill button
        td = document.createElement("td");
        var btn = document.createElement("a");
        btn.href = "#";
        btn.className = "kill-query";
        btn.title = "Kill query";
        var icon = document.createElement("i");
        icon.className = "glyphicon glyphicon-remove text-danger";
        btn.appendChild(icon);
        btn.addEventListener("click", function(ev) {
            ev.preventDefault();
            QueryMonitor.kill(q.queryId);
        });
        td.appendChild(btn);
        tr.appendChild(td);

        q.row = tr;
        $("#query-rows").append(tr);
        $(td).find("[data-toggle='tooltip']").tooltip();
    }

    function renderRow(q) {
        if (!q.row) return;
        var $row = $(q.row);
        $row.find(".q-user").text(q.user);
        $row.find(".q-source").text(truncateSource(q.source, 40)).attr("title", q.source);
        var $badge = $row.find(".q-phase span");
        $badge.attr("class", "label " + (PHASE_COLORS[q.phase] || "label-default"));
        $badge.text(q.terminating ? "terminating" : q.phase);
        if (q.terminating) $badge.attr("class", "label label-danger");
        $row.find(".q-items").text(formatItems(q.items));
        $row.find(".q-elapsed").text(formatElapsed(q.elapsed));
    }

    function updateEmptyState() {
        var count = Object.keys(queries).length;
        if (count === 0) {
            $("#no-queries").show();
        } else {
            $("#no-queries").hide();
        }
    }

    function addEvent(event, user, source, elapsed) {
        $("#no-events").hide();
        var rows = $("#event-rows tr.event-row");
        if (rows.length >= eventBuffer) {
            rows.last().remove();
        }

        var colors = {
            "started": "text-info",
            "completed": "text-success",
            "error": "text-danger",
            "cancelled": "text-warning"
        };

        var tr = document.createElement("tr");
        tr.className = "event-row";

        // Time
        var td = document.createElement("td");
        td.textContent = new Date().toLocaleTimeString();
        tr.appendChild(td);

        // Event
        td = document.createElement("td");
        var span = document.createElement("span");
        span.className = colors[event] || "";
        span.textContent = event;
        td.appendChild(span);
        tr.appendChild(td);

        // User
        td = document.createElement("td");
        td.className = "hidden-xs";
        td.textContent = user || "";
        tr.appendChild(td);

        // Source
        td = document.createElement("td");
        td.textContent = truncateSource(source, 50);
        td.title = source || "";
        tr.appendChild(td);

        // Elapsed
        td = document.createElement("td");
        td.className = "hidden-xs";
        td.textContent = elapsed ? formatElapsed(elapsed) : "";
        tr.appendChild(td);

        // Prepend (newest first)
        var tbody = document.getElementById("event-rows");
        tbody.insertBefore(tr, tbody.firstChild);
    }

    function handleSnapshot(data) {
        // Reconcile: add/update queries from snapshot, remove those not present
        var seen = {};
        if (data.queries) {
            for (var i = 0; i < data.queries.length; i++) {
                var q = data.queries[i];
                seen[q.queryId] = true;
                addOrUpdateQuery(q.queryId, q);
            }
        }
        // Remove queries not in snapshot (they've finished)
        for (var qid in queries) {
            if (!seen[qid]) {
                removeQuery(qid);
            }
        }
    }

    function handleMonitorEvent(data) {
        switch (data.event) {
            case "snapshot":
                handleSnapshot(data);
                break;
            case "started":
                addOrUpdateQuery(data.queryId, data);
                addEvent("started", data.user, data.source, 0);
                break;
            case "progress":
                addOrUpdateQuery(data.queryId, data);
                break;
            case "completed":
                addEvent("completed", data.user, data.source, data.elapsed);
                removeQuery(data.queryId);
                break;
            case "error":
                addEvent("error", data.user, data.source, data.elapsed);
                removeQuery(data.queryId);
                break;
            case "cancelled":
                addEvent("cancelled", data.user, data.source, data.elapsed);
                removeQuery(data.queryId);
                break;
        }
    }

    // Client-side elapsed timer: update all query rows every 200ms
    function startElapsedTimer() {
        elapsedTimer = setInterval(function() {
            var now = Date.now();
            for (var qid in queries) {
                var q = queries[qid];
                if (q.lastUpdate && q.row) {
                    var currentElapsed = q.elapsed + (now - q.lastUpdate);
                    $(q.row).find(".q-elapsed").text(formatElapsed(currentElapsed));
                }
            }
        }, 200);
    }

    return {
        connect: function() {
            var rootcontext = location.pathname.slice(0, location.pathname.indexOf("/apps"));
            var proto = window.location.protocol == "https:" ? "wss" : "ws";
            var url = proto + "://" + location.host + rootcontext + "/ws";
            connection = new WebSocket(url);

            connection.onerror = function(error) {
                $("#monitor-status").text("Connection error").attr("class", "label label-danger");
            };

            connection.onclose = function() {
                $("#monitor-status").text("Disconnected").attr("class", "label label-default");
                if (elapsedTimer) clearInterval(elapsedTimer);
            };

            connection.onopen = function() {
                $("#monitor-status").text("Connected").attr("class", "label label-success");
                connection.send('{ "channel": "_monitor" }');
                startElapsedTimer();
            };

            connection.onmessage = function(e) {
                if (e.data == "ping") return;
                try {
                    var data = JSON.parse(e.data);
                    if (data.type === "monitor") {
                        handleMonitorEvent(data);
                    }
                } catch (err) {
                    console.log("Monitor parse error:", err);
                }
            };
        },

        kill: function(queryId) {
            // Use existing admin.xql endpoint (works for all query types)
            $.ajax({
                url: "modules/admin.xql",
                data: { action: "kill", id: queryId },
                type: "POST"
            });
        }
    };
})();

$(document).ready(function() {
    QueryMonitor.connect();

    $("#clear-events").on("click", function(ev) {
        ev.preventDefault();
        $("#event-rows .event-row").remove();
        $("#no-events").show();
    });
});
