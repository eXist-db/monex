/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */

/* ── Query Executor ─────────────────────────────────────────────── */

var QueryExecutor = (function() {

    var cursorId = null;
    var totalHits = 0;
    var elapsed = 0;
    var pageSize = 20;
    var currentPage = 1;
    var running = false;

    function totalPages() {
        return Math.max(1, Math.ceil(totalHits / pageSize));
    }

    function formatElapsed(ms) {
        if (ms < 1000) return ms + "ms";
        if (ms < 60000) return (ms / 1000).toFixed(1) + "s";
        return (ms / 60000).toFixed(1) + "m";
    }

    function formatHits(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + "M items";
        if (n >= 1000) return (n / 1000).toFixed(1) + "K items";
        return n + (n === 1 ? " item" : " items");
    }

    function rangeLabel() {
        if (totalHits === 0) return "";
        var start = (currentPage - 1) * pageSize + 1;
        var end = Math.min(start + pageSize - 1, totalHits);
        return start + "-" + end + " of " + formatHits(totalHits);
    }

    function updatePagination() {
        var page = currentPage;
        var pages = totalPages();
        $("#page-indicator").text(page + " / " + pages);
        $("#page-first, #page-prev").prop("disabled", page <= 1);
        $("#page-next, #page-last").prop("disabled", page >= pages);
        $("#result-meta").text(formatHits(totalHits));
        $("#result-elapsed").text(formatElapsed(elapsed));
        $("#results-title").text("Results (" + rangeLabel() + ")");
    }

    function showResults(items) {
        var output = items.join("\n\n");
        $("#results-output").text(output);
        $("#results-box").show();
        $("#error-box").hide();
        updatePagination();
    }

    function showError(data) {
        var msg = data.error || "Unknown error";
        if (data.line) {
            msg += " [line " + data.line + ", col " + data.column + "]";
        }
        $("#error-output").text(msg);
        $("#error-box").show();
        $("#results-box").hide();
    }

    function fetchPage(page) {
        if (!cursorId) return;
        var start = (page - 1) * pageSize + 1;
        $.ajax({
            url: "modules/query.xql",
            data: { action: "fetch", cursorId: cursorId, start: start, count: pageSize },
            type: "GET",
            dataType: "json",
            success: function(data) {
                if (data.error) {
                    showError(data);
                } else {
                    currentPage = page;
                    showResults(data.items);
                }
            },
            error: function(xhr) {
                showError({ error: "Request failed: " + xhr.statusText });
            }
        });
    }

    function addToHistory(query, hits, elapsedMs) {
        var history = QueryExecutor.loadHistory();
        history.unshift({
            time: new Date().toLocaleTimeString(),
            query: query,
            hits: hits,
            elapsed: elapsedMs
        });
        // Keep last 50 entries
        if (history.length > 50) history.length = 50;
        try {
            localStorage["monex.queryHistory"] = JSON.stringify(history);
        } catch(e) { /* ignore quota errors */ }
        QueryExecutor.renderHistory();
    }

    return {
        run: function(query) {
            if (running) return;
            if (!query || !query.trim()) return;
            running = true;
            $("#run-query").prop("disabled", true).find("i").attr("class", "fa fa-spinner fa-spin");

            // Close any existing cursor first
            if (cursorId) {
                $.ajax({
                    url: "modules/query.xql",
                    data: { action: "close", cursorId: cursorId },
                    type: "POST",
                    async: false
                });
                cursorId = null;
            }

            $.ajax({
                url: "modules/query.xql",
                data: { action: "eval", query: query },
                type: "POST",
                dataType: "json",
                success: function(data) {
                    running = false;
                    $("#run-query").prop("disabled", false).find("i").attr("class", "fa fa-play");
                    if (data.error) {
                        showError(data);
                        addToHistory(query, 0, 0);
                    } else {
                        cursorId = data.cursorId;
                        totalHits = data.hits;
                        elapsed = data.elapsed;
                        currentPage = 1;
                        $("#close-cursor").show();
                        addToHistory(query, totalHits, elapsed);
                        if (totalHits > 0) {
                            fetchPage(1);
                        } else {
                            showResults(["(empty result)"]);
                        }
                    }
                },
                error: function(xhr) {
                    running = false;
                    $("#run-query").prop("disabled", false).find("i").attr("class", "fa fa-play");
                    showError({ error: "Request failed: " + xhr.statusText });
                }
            });
        },

        closeCursor: function() {
            if (cursorId) {
                $.ajax({
                    url: "modules/query.xql",
                    data: { action: "close", cursorId: cursorId },
                    type: "POST"
                });
                cursorId = null;
                totalHits = 0;
                elapsed = 0;
                currentPage = 1;
                $("#close-cursor").hide();
                $("#results-box").hide();
            }
        },

        pageFirst: function() { fetchPage(1); },
        pagePrev: function() { if (currentPage > 1) fetchPage(currentPage - 1); },
        pageNext: function() { if (currentPage < totalPages()) fetchPage(currentPage + 1); },
        pageLast: function() { fetchPage(totalPages()); },

        loadHistory: function() {
            try {
                var stored = localStorage["monex.queryHistory"];
                return stored ? JSON.parse(stored) : [];
            } catch(e) {
                return [];
            }
        },

        renderHistory: function() {
            var history = QueryExecutor.loadHistory();
            var $rows = $("#history-rows");
            $rows.empty();

            if (history.length === 0) {
                $("#history-box").hide();
                return;
            }
            $("#history-box").show();

            for (var i = 0; i < history.length; i++) {
                var entry = history[i];
                var tr = document.createElement("tr");
                tr.className = "history-row";
                tr.style.cursor = "pointer";

                var td = document.createElement("td");
                td.textContent = entry.time;
                tr.appendChild(td);

                td = document.createElement("td");
                td.style.fontFamily = "monospace";
                td.style.fontSize = "12px";
                var text = entry.query.length > 80 ? entry.query.substring(0, 77) + "..." : entry.query;
                td.textContent = text;
                td.title = entry.query;
                tr.appendChild(td);

                td = document.createElement("td");
                td.textContent = entry.hits;
                tr.appendChild(td);

                td = document.createElement("td");
                td.textContent = formatElapsed(entry.elapsed);
                tr.appendChild(td);

                // Click to reload query
                (function(q) {
                    tr.addEventListener("click", function() {
                        $("#query-input").val(q);
                    });
                })(entry.query);

                $rows.append(tr);
            }
        },

        clearHistory: function() {
            try { delete localStorage["monex.queryHistory"]; } catch(e) {}
            QueryExecutor.renderHistory();
        }
    };
})();

/* ── Remote Console (WebSocket log viewer) ──────────────────────── */

var RemoteConsole = (function() {

    var connection;
    var bufferSize = 50;
    var currentChannel = "default";

    return {
        connect: function() {
            var rootcontext = location.pathname.slice(0, location.pathname.indexOf("/apps"));
            var proto = window.location.protocol == "https:" ? "wss" : "ws";
            var url = proto + "://" + location.host + rootcontext + "/ws";
            connection = new WebSocket(url);

            // Log errors
            connection.onerror = function (error) {
                $("#status").text("Connection error ...");
                console.log('WebSocket Error: %o', error);
            };

            connection.onclose = function() {
                $("#status").text("Disconnected.");
            };

            connection.onopen = function() {
                $("#status").text("Connected.");
                connection.send('{ "channel": "' + currentChannel + '" }');
            };

            // Log messages from the server
            connection.onmessage = function (e) {
                if (e.data == "ping") {
                    return;
                }

                $(".note").hide(300);

                var data = JSON.parse(e.data);

                var oldLines = $("#console tr");
                if (oldLines.length >= bufferSize) {
                    oldLines.get(0).remove();
                }

                var smallScreen = Modernizr.mq('(max-width: 767px)');

                var time = data.timestamp.replace(/^.*T([^\+]+).*$/, "$1");
                var tr = document.createElement("tr");
                tr.style.display = "none";
                tr.className = "message";

                var td = document.createElement("td");
                td.className = "hidden-xs";
                td.appendChild(document.createTextNode(time));
                tr.appendChild(td);

                td = document.createElement("td");
                td.className = "hidden-xs";
                if (data.source) {
                    var source = data.source.replace(/^.*\/([^\/]+)$/, "$1");
                    td.appendChild(document.createTextNode(source));
                } else {
                    td.appendChild(document.createTextNode("unknown"));
                }
                tr.appendChild(td);

                td = document.createElement("td");
                td.className = "hidden-xs";
                if (data.line) {
                    td.appendChild(document.createTextNode(data.line + " / " + data.column));
                } else {
                    td.appendChild(document.createTextNode("- / -"));
                }
                tr.appendChild(td);

                td = document.createElement("td");
                td.className = "message";
                if (data.json) {
                    var json = JSON.parse(data.message);
                    var dl = document.createElement("dl");
                    dl.className = "dl-horizontal";
                    for (var key in json) {
                        var name = document.createElement("dt");
                        name.appendChild(document.createTextNode("$" + key));
                        dl.appendChild(name);
                        var value = document.createElement("dd");
                        value.appendChild(document.createTextNode(json[key]));
                        dl.appendChild(value);
                    }
                    td.appendChild(dl);
                } else {
                    td.appendChild(document.createTextNode(data.message));
                }
                tr.appendChild(td);

                td = document.createElement("td");
                td.className = "source";
                var btn = document.createElement("button");
                btn.type = "button";
                btn.className = "btn btn-default";

                var info = document.createElement("span");
                info.className = "fa fa-info";
                btn.appendChild(info);
                td.appendChild(btn);
                btn.setAttribute("data-toggle", "tooltip");
                btn.title = data.timestamp + ": " + data.source + " [" + data.line + " / " + data.column + "]";
                $(btn).tooltip({
                    placement: "left",
                    trigger: "click"
                });
                tr.appendChild(td);

                $("#console").append(tr);

                $(tr).show(200, function() {
                    this.scrollIntoView();
                });
            };
        },

        clear: function() {
            $("#console .message").remove();
            $("#console .note").show();
        },

        showMessage: function(message) {
            var tr = document.createElement("tr");
            tr.className = "message";
            var td = document.createElement("td");
            td.setAttribute("colspan", 5);
            td.appendChild(document.createTextNode(message));
            tr.appendChild(td);
            $("#console").append(tr);
        },

        setChannel: function(channel) {
            currentChannel = channel || "default";
            connection.send('{ "channel": "' + currentChannel + '" }');
            RemoteConsole.showMessage("Channel switched to '" + currentChannel + "'.");
        },

        saveState: function() {
            if (Modernizr.localstorage) {
                localStorage["monex.channel"] = currentChannel;
            }
        },

        restoreState: function() {
            if (Modernizr.localstorage) {
                currentChannel = localStorage["monex.channel"] || "default";
                $("input[name='channel']").val(currentChannel);
            }
        }
    };
})();

/* ── Initialization ─────────────────────────────────────────────── */

$(document).ready(function() {

    // WebSocket console
    RemoteConsole.restoreState();
    RemoteConsole.connect();

    $("#clear").on("click", function(ev) {
        ev.preventDefault();
        RemoteConsole.clear();
    });

    $("#set-channel").on("click", function(ev) {
        ev.preventDefault();
        var channel = $("input[name='channel']").val();
        RemoteConsole.setChannel(channel);
    });

    $(window).on("unload", function () {
        RemoteConsole.saveState();
    });

    // Query execution
    $("#run-query").on("click", function(ev) {
        ev.preventDefault();
        var query = $("#query-input").val();
        QueryExecutor.run(query);
    });

    // Ctrl+Enter to run
    $("#query-input").on("keydown", function(ev) {
        if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
            ev.preventDefault();
            var query = $(this).val();
            QueryExecutor.run(query);
        }
    });

    // Cursor close
    $("#close-cursor").on("click", function(ev) {
        ev.preventDefault();
        QueryExecutor.closeCursor();
    });

    // Pagination
    $("#page-first").on("click", function(ev) { ev.preventDefault(); QueryExecutor.pageFirst(); });
    $("#page-prev").on("click", function(ev) { ev.preventDefault(); QueryExecutor.pagePrev(); });
    $("#page-next").on("click", function(ev) { ev.preventDefault(); QueryExecutor.pageNext(); });
    $("#page-last").on("click", function(ev) { ev.preventDefault(); QueryExecutor.pageLast(); });

    // History
    QueryExecutor.renderHistory();
    $("#clear-history").on("click", function(ev) {
        ev.preventDefault();
        QueryExecutor.clearHistory();
    });
});
