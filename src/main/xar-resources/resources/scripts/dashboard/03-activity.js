/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
Monex.activity = Monex.activity || {};

var HIDDEN_POLL_BACKOFF_MS = 10000;

function runningJobCount(jmx) {
    if (!jmx || !jmx.ProcessReport || !jmx.ProcessReport.RunningJobs) {
        return 0;
    }
    var jobs = jmx.ProcessReport.RunningJobs;
    return (ko.isObservable(jobs) ? jobs() : jobs).length || 0;
}

function waitingThreadCount(jmx) {
    if (!jmx) {
        return 0;
    }
    if (jmx.LockManager && jmx.LockManager.WaitingThreads) {
        var waiting = jmx.LockManager.WaitingThreads;
        var rows = ko.isObservable(waiting) ? waiting() : waiting;
        return rows.filter(function(row) {
            return !activityRowEnded(row);
        }).length || 0;
    }
    if (jmx.LockTable && jmx.LockTable.Attempting) {
        var attempting = jmx.LockTable.Attempting;
        return (ko.isObservable(attempting) ? attempting() : attempting).length || 0;
    }
    return 0;
}

function waitingThreadsList(jmx) {
    if (!jmx || !jmx.LockManager || !jmx.LockManager.WaitingThreads) {
        return [];
    }
    var waiting = jmx.LockManager.WaitingThreads;
    return ko.isObservable(waiting) ? waiting() : waiting;
}

function bufferedWaitingThreadCount(jmx) {
    return waitingThreadsList(jmx).length;
}

function runningQueriesList(jmx) {
    if (!jmx || !jmx.ProcessReport || !jmx.ProcessReport.RunningQueries) {
        return [];
    }
    var queries = jmx.ProcessReport.RunningQueries;
    return ko.isObservable(queries) ? queries() : queries;
}

function recentQueriesList(jmx) {
    if (!jmx || !jmx.ProcessReport || !jmx.ProcessReport.RecentQueryHistory) {
        return [];
    }
    var recent = jmx.ProcessReport.RecentQueryHistory;
    return ko.isObservable(recent) ? recent() : recent;
}

function activityRowEnded(row) {
    return JMX.util.activityRowEnded(row);
}

function activityUriHref(baseUrl, row) {
    var uri = JMX.util.activityRequestUri(row);
    if (!uri) {
        return "#";
    }
    if (/^https?:\/\//.test(uri)) {
        return uri;
    }
    return (baseUrl || "") + uri;
}

function activityUriLabel(row) {
    return JMX.util.formatActivityUri(JMX.util.activityRequestUri(row));
}

function runningQueryElapsedText(row) {
    return JMX.util.formatQueryElapsed(JMX.util.jmxFieldText(JMX.util.runningQueryField(row, "elapsed")));
}

var RUNNING_QUERY_ELAPSED_WARN_MS = 5000;
var RUNNING_QUERY_ELAPSED_CRITICAL_MS = 30000;

function runningQueryElapsedMs(row) {
    var raw = JMX.util.jmxFieldText(JMX.util.runningQueryField(row, "elapsed"));
    var parsed = parseInt(raw, 10);
    return isNaN(parsed) ? 0 : parsed;
}

function runningQueryElapsedClass(row) {
    if (activityRowEnded(row)) {
        return {};
    }
    var ms = runningQueryElapsedMs(row);
    return {
        "activity-elapsed-warn": ms >= RUNNING_QUERY_ELAPSED_WARN_MS &&
            ms < RUNNING_QUERY_ELAPSED_CRITICAL_MS,
        "activity-elapsed-critical": ms >= RUNNING_QUERY_ELAPSED_CRITICAL_MS
    };
}

function recentQueryField(row, name) {
    if (!row || !name) {
        return undefined;
    }
    if (row[name] !== undefined && row[name] !== null) {
        return ko.isObservable(row[name]) ? row[name]() : row[name];
    }
    if (row.value && row.value[name] !== undefined && row.value[name] !== null) {
        return ko.isObservable(row.value[name]) ? row.value[name]() : row.value[name];
    }
    return undefined;
}

function recentQueryElapsedText(row) {
    var formatted = JMX.util.formatQueryElapsed(recentQueryField(row, "mostRecentExecutionDuration"));
    return formatted || "—";
}

function activityUriTitle(row) {
    return JMX.util.activityUriTitle(JMX.util.activityRequestUri(row));
}

function showKillQuery(row) {
    if (activityRowEnded(row)) {
        return false;
    }
    return JMX_INSTANCE.name === "localhost" || JMX_INSTANCE.version !== 0;
}

function activityRowFlyoutKey(row) {
    if (!row) {
        return "";
    }
    var parts = [
        JMX.util.jmxFieldText(JMX.util.runningQueryField(row, "id")),
        JMX.util.jmxFieldText(JMX.util.runningQueryField(row, "thread")),
        JMX.util.jmxFieldText(JMX.util.runningQueryField(row, "mostRecentExecutionTime")),
        JMX.util.jmxFieldText(JMX.util.runningQueryField(row, "sourceKey")),
        JMX.util.jmxFieldText(JMX.util.runningQueryField(row, "owner"))
    ];
    var key = "";
    var i;
    for (i = 0; i < parts.length; i++) {
        if (parts[i]) {
            key += (key ? "|" : "") + parts[i];
        }
    }
    return key;
}

function stackTraceText(row) {
    return JMX.util.jmxFieldText(row && row.stack);
}

function stackTraceTitle(row) {
    return JMX.util.jmxFieldText(row && row.owner) || "Stack trace";
}

function showTrackUriHint(jmx) {
    if (!jmx || !jmx.ProcessReport) {
        return false;
    }
    var track = jmxValue(jmx.ProcessReport.TrackRequestURI);
    if (track === true || track === "true") {
        return false;
    }
    return bufferedRunningQueryCount(jmx) > 0 || bufferedRecentQueryCount(jmx) > 0;
}

function positionFlyoutFromElement(model, el) {
    if (!el || !model) {
        return;
    }
    var maxWidth = model.type() === "stack" ? 640 : 480;
    var rect = el.getBoundingClientRect();
    var flyoutWidth = Math.min(maxWidth, window.innerWidth - 24);
    var left = Math.max(12, Math.min(rect.left, window.innerWidth - flyoutWidth - 12));
    var top = Math.min(rect.bottom + 6, window.innerHeight - 60);
    top = Math.max(50, top);
    model.left(left);
    model.top(top);
    model.width(flyoutWidth);
    model.open(true);
}

function findActivityRowByKey(rowKey) {
    if (!rowKey) {
        return null;
    }
    var rows = document.querySelectorAll("[data-activity-row-key]");
    var i;
    for (i = 0; i < rows.length; i++) {
        if (rows[i].getAttribute("data-activity-row-key") === rowKey) {
            return rows[i];
        }
    }
    return null;
}

Monex.activity.createFlyoutModel = function(options) {
    options = options || {};
    var livePoll = options.livePoll !== false;

    var model = {
        open: ko.observable(false),
        type: ko.observable("uri"),
        rowKey: ko.observable(""),
        title: ko.observable(""),
        body: ko.observable(""),
        openHref: ko.observable(""),
        top: ko.observable(12),
        left: ko.observable(12),
        width: ko.observable(480),
        close: function() {
            model.open(false);
            model.rowKey("");
        },
        copyToClipboard: function() {
            navigator.clipboard.writeText(model.body()).catch(function() {});
        },
        toggleUri: function(row, ev, baseUrl) {
            var key = activityRowFlyoutKey(row);
            if (model.open() && model.type() === "uri" && model.rowKey() === key) {
                model.close();
                return false;
            }
            model.type("uri");
            model.rowKey(key);
            model.title("");
            model.body(activityUriTitle(row));
            model.openHref(activityUriHref(ko.isObservable(baseUrl) ? baseUrl() : baseUrl, row));
            model.open(true);
            if (ev && ev.currentTarget) {
                positionFlyoutFromElement(model, ev.currentTarget);
            }
            return false;
        },
        toggleStack: function(row, ev) {
            var key = activityRowFlyoutKey(row);
            if (model.open() && model.type() === "stack" && model.rowKey() === key) {
                model.close();
                return false;
            }
            model.type("stack");
            model.rowKey(key);
            model.title(stackTraceTitle(row));
            model.body(stackTraceText(row));
            model.openHref("");
            model.open(true);
            if (ev && ev.currentTarget) {
                positionFlyoutFromElement(model, ev.currentTarget);
            }
            return false;
        },
        afterPoll: function() {
            if (!livePoll || !model.open()) {
                return;
            }
            var key = model.rowKey();
            if (!key) {
                model.close();
                return;
            }
            var rowEl = findActivityRowByKey(key);
            if (!rowEl) {
                model.close();
                return;
            }
            var anchor = rowEl.querySelector(model.type() === "uri" ? ".activity-uri-link" : ".stack");
            if (anchor) {
                positionFlyoutFromElement(model, anchor);
            }
        }
    };

    model.panelStyle = ko.computed(function() {
        var top = model.top();
        var maxHeight = Math.min(Math.max(60, window.innerHeight - top - 12), 480);
        return {
            position: "fixed",
            top: top + "px",
            left: model.left() + "px",
            width: model.width() + "px",
            maxHeight: maxHeight + "px",
            overflow: "hidden",
            zIndex: 1050
        };
    });
    model.isUri = ko.computed(function() {
        return model.type() === "uri";
    });
    model.isStack = ko.computed(function() {
        return model.type() === "stack";
    });
    model.showOpenLink = ko.computed(function() {
        var href = model.openHref();
        return model.isUri() && href && href !== "#";
    });

    return model;
};

Monex.activity.attachDashboardViewModel = function(viewModel, options) {
    if (!viewModel || viewModel._monexDashboardAttached) {
        return viewModel;
    }
    options = options || {};
    viewModel._monexDashboardAttached = true;

    viewModel.runningQueriesForDisplay = ko.pureComputed(function() {
        return runningQueriesList(viewModel.jmx);
    });
    viewModel.recentQueriesForDisplay = ko.pureComputed(function() {
        return recentQueriesList(viewModel.jmx);
    });
    viewModel.waitingThreadsForDisplay = ko.pureComputed(function() {
        return waitingThreadsList(viewModel.jmx);
    });
    viewModel.showTrackUriHint = ko.pureComputed(function() {
        return showTrackUriHint(viewModel.jmx);
    });
    viewModel.showMissingVectorModels = ko.observable(false);
    viewModel.activityFlyout = Monex.activity.createFlyoutModel(options);

    if (options.livePoll !== false) {
        viewModel.pollLastLabel = ko.observable("—");
        viewModel.pollTabIdle = ko.observable(typeof document !== "undefined" && document.hidden);
    }

    return viewModel;
};

Monex.activity.initFlyoutDismiss = function(getFlyoutModel) {
    if ($("body").data("monexFlyoutDismissInit")) {
        return;
    }
    $("body").data("monexFlyoutDismissInit", true);

    $(document).on("click.monexFlyout", function(ev) {
        var flyout = getFlyoutModel();
        if (!flyout || !flyout.open()) {
            return;
        }
        if ($(ev.target).closest(".activity-flyout-panel, .activity-uri-link, .stack").length) {
            return;
        }
        flyout.close();
    });

    $(document).on("keydown.monexFlyout", function(ev) {
        if (ev.key === "Escape") {
            var flyout = getFlyoutModel();
            if (flyout) {
                flyout.close();
            }
        }
    });

    $(window).on("scroll.monexFlyout resize.monexFlyout", function() {
        var flyout = getFlyoutModel();
        if (flyout) {
            flyout.afterPoll();
        }
    });
};

function cleanupActivityTooltips() {
    $(".source-key").each(function() {
        var $el = $(this);
        if ($el.data("bs.tooltip")) {
            $el.tooltip("hide");
        }
    });
    $("body > .tooltip, #dashboard .tooltip, #details .tooltip").remove();
    $("body > .popover.in, #dashboard .popover.in, #details .popover.in").remove();
}

function addKillBtn(node, data) {
    if (data && activityRowEnded(data)) {
        return;
    }
    var $row = $(node);
    $row.find(".kill-query").off("click.monexKill").on("click.monexKill", function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var queryId = JMX.util.runningQueryKillId(data);
        if (queryId === null) {
            console.error("Cannot kill query: missing numeric id", data);
            return;
        }
        if (JMX_INSTANCE.version === 0) {
            $.ajax({
                url: "modules/admin.xql",
                data: { action: "kill", id: queryId },
                type: "POST"
            });
        } else {
            JMX.connection.invoke("killQuery", "org.exist.management.exist:type=ProcessReport", [queryId]);
        }
    });
    if (data && !activityRowEnded(data) && $row.find(".kill-query").length) {
        var $scroll = $row.closest(".activity-table-scroll");
        var $firstLive = $scroll.find(".running-queries tbody tr:not(.activity-row-ended)").first();
        if ($firstLive.length && $firstLive[0] === $row[0] && $row[0].scrollIntoView) {
            $row[0].scrollIntoView({ block: "nearest", inline: "nearest" });
        }
    }
}

function initActivityRow(node, data) {
    if (data) {
        addKillBtn(node, data);
    }
    $(node).find(".source-key").each(function() {
        var $el = $(this);
        if ($el.data("bs.tooltip")) {
            $el.tooltip("destroy");
        }
        $el.tooltip({ container: "body", trigger: "hover" });
    });
}

function revealRunningQueries(liveCount) {
    if (!liveCount || liveCount <= 0) {
        return;
    }
    var panelScroll = document.querySelector(".activity-panel-scroll");
    if (panelScroll) {
        panelScroll.scrollTop = 0;
    }
    var workload = document.querySelector(".workload-panel");
    if (workload && workload.scrollIntoView) {
        workload.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    var liveRow = document.querySelector(".running-queries tbody tr:not(.activity-row-ended)");
    if (liveRow && liveRow.scrollIntoView) {
        liveRow.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
}

Monex.activity.HIDDEN_POLL_BACKOFF_MS = HIDDEN_POLL_BACKOFF_MS;
Monex.activity.cleanupActivityTooltips = cleanupActivityTooltips;
Monex.activity.revealRunningQueries = revealRunningQueries;
