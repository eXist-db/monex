/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
// util.js must be loaded first, otherwise JMX is undefined
var Monex = window.Monex || {};
window.Monex = Monex;

function jmxValue(value) {
    if (value && typeof ko !== "undefined" && ko.isObservable(value)) {
        return value();
    }
    return value;
}

/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
function findByName(nodes, name) {
    if (nodes instanceof Array) {
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].name() == name) {
                return nodes[i];
            }
        }
    }
    return null;
}

function primaryCacheManager(jmx) {
    if (!jmx || !jmx.CacheManager) {
        return null;
    }
    var managers = ko.isObservable(jmx.CacheManager) ? jmx.CacheManager() : jmx.CacheManager;
    if (managers instanceof Array) {
        return findByName(managers, "org.exist.management.exist:type=CacheManager") || managers[0];
    }
    return managers;
}

function collectionCacheManager(jmx) {
    if (!jmx || !jmx.CacheManager) {
        return null;
    }
    var managers = ko.isObservable(jmx.CacheManager) ? jmx.CacheManager() : jmx.CacheManager;
    if (managers instanceof Array) {
        return findByName(managers, "org.exist.management.exist:type=CollectionCacheManager");
    }
    return null;
}

var SHARED_POOL_PAGE_SIZE = 4096;

function sharedPoolUsedBytes(cacheManager) {
    if (!cacheManager) {
        return 0;
    }
    return parseInt(jmxValue(cacheManager.CurrentSize), 10) || 0;
}

function sharedPoolMaxBytes(jmx) {
    if (jmx && jmx.Database) {
        var cacheMem = parseInt(jmxValue(jmx.Database.CacheMem), 10);
        if (cacheMem > 0) {
            return cacheMem;
        }
    }
    var cacheManager = primaryCacheManager(jmx);
    if (cacheManager) {
        var pages = parseInt(jmxValue(cacheManager.MaxTotal), 10) || 0;
        if (pages > 0) {
            return pages * SHARED_POOL_PAGE_SIZE;
        }
    }
    return 0;
}

function sharedPoolUsedMb(cacheManager) {
    return Math.floor(sharedPoolUsedBytes(cacheManager) / 1024 / 1024);
}

function sharedPoolMaxMb(jmx) {
    return Math.floor(sharedPoolMaxBytes(jmx) / 1024 / 1024);
}

function sharedPoolUsedPercent(cacheManager, jmx) {
    var used = sharedPoolUsedBytes(cacheManager);
    var max = sharedPoolMaxBytes(jmx);
    if (max <= 0) {
        return 0;
    }
    return Math.min(100, Math.round(used / (max / 100)));
}

function sharedPoolKpiPercent(jmx) {
    return sharedPoolUsedPercent(primaryCacheManager(jmx), jmx);
}

function sharedPoolKpiVisible(jmx) {
    return sharedPoolKpiPercent(jmx) >= 70;
}

function sharedPoolKpiClass(jmx) {
    var percent = sharedPoolKpiPercent(jmx);
    return {
        "kpi-warn": percent >= 70 && percent < 90,
        "kpi-critical": percent >= 90
    };
}

var JMX_CAPACITY_THRESHOLDS = { warn: 80, critical: 90 };
var DBX_CACHE_PRESSURE_THRESHOLD = 70;
var DBX_CACHE_TOP_N = 3;

function capacityBarClass(percent) {
    var value = parseInt(percent, 10) || 0;
    if (value >= JMX_CAPACITY_THRESHOLDS.critical) {
        return "progress-bar-capacity-critical";
    }
    if (value >= JMX_CAPACITY_THRESHOLDS.warn) {
        return "progress-bar-capacity-warn";
    }
    return "progress-bar-capacity";
}

function cacheUsedPercent(used, size) {
    var u = parseInt(used, 10) || 0;
    var s = parseInt(size, 10) || 0;
    if (s <= 0) {
        return 0;
    }
    return Math.round(u / (s / 100));
}

function cacheHitRate(hits, fails) {
    var h = parseInt(hits, 10) || 0;
    var f = parseInt(fails, 10) || 0;
    if (h + f === 0) {
        return "—";
    }
    return Math.round((h / (h + f)) * 100) + "%";
}

function cacheDisplayName(mbeanName) {
    if (!mbeanName) {
        return "";
    }
    var match = mbeanName.match(/name=([^,]+),cache-type=(\w+)/);
    if (match) {
        return match[1] + " (" + match[2] + ")";
    }
    return mbeanName;
}

function dbxCaches(caches) {
    if (!caches) {
        return [];
    }
    var list = ko.isObservable(caches) ? caches() : caches;
    if (!(list instanceof Array)) {
        return [];
    }
    return list.filter(function(cache) {
        return cache.name && cache.name().indexOf(".dbx") >= 0;
    }).sort(function(a, b) {
        return cacheDisplayName(a.name()).localeCompare(cacheDisplayName(b.name()));
    });
}

function parseDbxCacheName(mbeanName) {
    if (!mbeanName) {
        return null;
    }
    var name = typeof mbeanName === "function" ? mbeanName() : mbeanName;
    var match = name.match(/name=([^,]+),cache-type=(\w+)/i);
    if (!match) {
        return null;
    }
    return { file: match[1], type: match[2].toUpperCase() };
}

function groupDbxCaches(caches) {
    var grouped = {};
    var order = [];
    dbxCaches(caches).forEach(function(cache) {
        var parsed = parseDbxCacheName(cache.name);
        if (!parsed) {
            return;
        }
        if (!grouped[parsed.file]) {
            grouped[parsed.file] = { file: parsed.file, btree: null, data: null };
            order.push(parsed.file);
        }
        if (parsed.type === "BTREE") {
            grouped[parsed.file].btree = cache;
        } else if (parsed.type === "DATA") {
            grouped[parsed.file].data = cache;
        }
    });
    return order.map(function(file) {
        return grouped[file];
    });
}

function cacheGroupMaxPercent(group) {
    var max = 0;
    if (group && group.btree) {
        max = Math.max(max, cacheUsedPercent(jmxValue(group.btree.Used), jmxValue(group.btree.Size)));
    }
    if (group && group.data) {
        max = Math.max(max, cacheUsedPercent(jmxValue(group.data.Used), jmxValue(group.data.Size)));
    }
    return max;
}

function sortedDbxCacheGroups(caches) {
    return groupDbxCaches(caches).slice().sort(function(a, b) {
        return cacheGroupMaxPercent(b) - cacheGroupMaxPercent(a);
    });
}

function dbxCacheGroupCount(caches) {
    return sortedDbxCacheGroups(caches).length;
}

function visibleDbxCacheGroups(caches, showAll) {
    var sorted = sortedDbxCacheGroups(caches);
    var expanded = ko.isObservable(showAll) ? showAll() : !!showAll;
    if (expanded) {
        return sorted;
    }
    var visible = {};
    var result = [];
    sorted.forEach(function(group) {
        if (cacheGroupMaxPercent(group) >= DBX_CACHE_PRESSURE_THRESHOLD && !visible[group.file]) {
            visible[group.file] = true;
            result.push(group);
        }
    });
    sorted.slice(0, DBX_CACHE_TOP_N).forEach(function(group) {
        if (!visible[group.file]) {
            visible[group.file] = true;
            result.push(group);
        }
    });
    return result.sort(function(a, b) {
        return cacheGroupMaxPercent(b) - cacheGroupMaxPercent(a);
    });
}

function hiddenDbxCacheCount(caches, showAll) {
    var total = dbxCacheGroupCount(caches);
    return Math.max(0, total - visibleDbxCacheGroups(caches, showAll).length);
}

function cacheSegmentSummary(cache) {
    if (!cache) {
        return "";
    }
    var used = parseInt(jmxValue(cache.Used), 10) || 0;
    var size = parseInt(jmxValue(cache.Size), 10) || 0;
    return used + "/" + size;
}

function cacheShowHitRate(hits, fails, showAll) {
    var h = parseInt(hits, 10) || 0;
    var f = parseInt(fails, 10) || 0;
    if (h + f === 0) {
        return false;
    }
    var expanded = ko.isObservable(showAll) ? showAll() : !!showAll;
    if (expanded) {
        return true;
    }
    return (h / (h + f)) < 0.95;
}

function cacheHitRateClass(hits, fails, showAll) {
    var h = parseInt(hits, 10) || 0;
    var f = parseInt(fails, 10) || 0;
    if (h + f === 0) {
        return "hit-rate";
    }
    var expanded = ko.isObservable(showAll) ? showAll() : !!showAll;
    if (expanded) {
        return "hit-rate";
    }
    return (h / (h + f)) < 0.95 ? "hit-warn" : "hit-rate";
}

function collectionCacheBudgetMb(jmx) {
    if (!jmx || !jmx.Database) {
        return 0;
    }
    var bytes = parseInt(jmxValue(jmx.Database.CollectionCacheMem), 10) || 0;
    return Math.round(bytes / 1024 / 1024);
}

function collectionCacheBudgetVisible(jmx) {
    return collectionCacheBudgetMb(jmx) > 0;
}

Monex.caches = {
    findByName: findByName,
    primaryCacheManager: primaryCacheManager,
    collectionCacheManager: collectionCacheManager,
    sharedPoolUsedMb: sharedPoolUsedMb,
    sharedPoolMaxMb: sharedPoolMaxMb,
    sharedPoolUsedPercent: sharedPoolUsedPercent,
    sharedPoolKpiPercent: sharedPoolKpiPercent,
    sharedPoolKpiVisible: sharedPoolKpiVisible,
    sharedPoolKpiClass: sharedPoolKpiClass,
    capacityBarClass: capacityBarClass,
    cacheUsedPercent: cacheUsedPercent,
    cacheHitRate: cacheHitRate,
    cacheDisplayName: cacheDisplayName,
    sortedDbxCacheGroups: sortedDbxCacheGroups,
    visibleDbxCacheGroups: visibleDbxCacheGroups,
    hiddenDbxCacheCount: hiddenDbxCacheCount,
    cacheSegmentSummary: cacheSegmentSummary,
    cacheShowHitRate: cacheShowHitRate,
    cacheHitRateClass: cacheHitRateClass,
    collectionCacheBudgetMb: collectionCacheBudgetMb,
    collectionCacheBudgetVisible: collectionCacheBudgetVisible
};

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

function workloadHot(jmx) {
    return runningQueryCount(jmx) > 0 || waitingThreadCount(jmx) > 0;
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
    var top = rect.bottom + 6;
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
        return {
            position: "fixed",
            top: model.top() + "px",
            left: model.left() + "px",
            width: model.width() + "px",
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

/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
var JMX_KPI_THRESHOLDS = {
    runningQueries: { warn: 3, critical: 10 },
    waitingThreads: { warn: 5, critical: 30 },
    activeBrokers: { warnRatio: 0.75, criticalRatio: 0.9 }
};

function activeBrokerCount(jmx) {
    if (!jmx || !jmx.Database) {
        return 0;
    }
    return parseInt(jmxValue(jmx.Database.ActiveBrokers), 10) || 0;
}

function maxBrokerCount(jmx) {
    if (!jmx || !jmx.Database) {
        return 0;
    }
    var max = parseInt(jmxValue(jmx.Database.MaxBrokers), 10) || 0;
    if (max > 0) {
        return max;
    }
    return parseInt(jmxValue(jmx.Database.TotalBrokers), 10) || 0;
}

function availableBrokerCount(jmx) {
    if (!jmx || !jmx.Database) {
        return null;
    }
    var raw = jmxValue(jmx.Database.AvailableBrokers);
    if (raw === undefined || raw === null || raw === "") {
        return null;
    }
    var parsed = parseInt(raw, 10);
    return isNaN(parsed) ? null : parsed;
}

function brokerKpiSubline(jmx) {
    return brokerPoolSubline(jmx);
}

function brokerPoolSubline(jmx) {
    var idle = availableBrokerCount(jmx);
    if (idle === null) {
        return "";
    }
    return idle + " idle";
}

function brokerPoolSummaryText(jmx) {
    var active = activeBrokerCount(jmx);
    var max = maxBrokerCount(jmx);
    var idle = availableBrokerCount(jmx);
    var parts = [active + " in use"];
    if (idle !== null) {
        parts.push(idle + " idle");
    }
    parts.push(max + " configured max");
    return parts.join(" · ");
}

function brokerPoolSummaryTitle() {
    return "ActiveBrokers in use · AvailableBrokers idle · MaxBrokers configured maximum";
}

function brokerPoolPercent(jmx) {
    var active = activeBrokerCount(jmx);
    var max = maxBrokerCount(jmx);
    if (max <= 0) {
        return 0;
    }
    return Math.round(active / (max / 100));
}

function brokerInUsePercent(jmx) {
    var max = maxBrokerCount(jmx);
    if (max <= 0) {
        return 0;
    }
    return Math.round(activeBrokerCount(jmx) / max * 100);
}

function brokerIdlePercent(jmx) {
    var max = maxBrokerCount(jmx);
    var idle = availableBrokerCount(jmx);
    if (max <= 0 || idle === null) {
        return 0;
    }
    return Math.round(idle / max * 100);
}

function brokerPoolLegendText(jmx) {
    return activeBrokerCount(jmx) + " / " + maxBrokerCount(jmx);
}

function runningQueryCount(jmx) {
    var queries = runningQueriesList(jmx);
    return queries.filter(function(row) {
        return !activityRowEnded(row);
    }).length || 0;
}

function bufferedRunningQueryCount(jmx) {
    return runningQueriesList(jmx).length;
}

function bufferedRecentQueryCount(jmx) {
    return recentQueriesList(jmx).length;
}

function kpiLevel(metric, value, jmx) {
    if (metric === "activeBrokers") {
        var max = maxBrokerCount(jmx);
        if (max <= 0) {
            return "ok";
        }
        var ratio = value / max;
        if (ratio >= JMX_KPI_THRESHOLDS.activeBrokers.criticalRatio) {
            return "critical";
        }
        if (ratio >= JMX_KPI_THRESHOLDS.activeBrokers.warnRatio) {
            return "warn";
        }
        return "ok";
    }
    var thresholds = JMX_KPI_THRESHOLDS[metric];
    if (!thresholds) {
        return "ok";
    }
    if (value >= thresholds.critical) {
        return "critical";
    }
    if (value >= thresholds.warn) {
        return "warn";
    }
    return "ok";
}

function kpiIconClass(metric, value, jmx) {
    var level = kpiLevel(metric, value, jmx);
    var classes = {
        "kpi-ok": level === "ok",
        "kpi-warn": level === "warn",
        "kpi-critical": level === "critical"
    };
    if (metric === "activeBrokers") {
        classes["bg-aqua"] = true;
    } else if (metric === "runningQueries") {
        classes["bg-yellow"] = true;
    } else if (metric === "waitingThreads") {
        classes["bg-red"] = true;
    }
    return classes;
}

function kpiBoxClass(metric, value, jmx) {
    var level = kpiLevel(metric, value, jmx);
    return {
        "kpi-box-warn": level === "warn",
        "kpi-box-critical": level === "critical"
    };
}

function kpiCellClass(metric, value, jmx) {
    var level = kpiLevel(metric, value, jmx);
    return {
        "kpi-warn": level === "warn",
        "kpi-critical": level === "critical"
    };
}

function memoryUsedMb(heap) {
    if (!heap) {
        return 0;
    }
    return Math.floor(parseInt(jmxValue(heap.used), 10) / 1024 / 1024);
}

function memoryMaxMb(heap) {
    if (!heap) {
        return 0;
    }
    return Math.floor(parseInt(jmxValue(heap.max), 10) / 1024 / 1024);
}

function memoryUsedPercent(heap) {
    if (!heap) {
        return 0;
    }
    var used = parseInt(jmxValue(heap.used), 10) || 0;
    var max = parseInt(jmxValue(heap.max), 10) || 0;
    if (max <= 0) {
        return 0;
    }
    return Math.round(used / (max / 100));
}

function cpuOsNode(jmx) {
    if (!jmx) {
        return null;
    }
    if (jmx.CpuLoad) {
        return jmx.CpuLoad;
    }
    return jmx.OperatingSystemImpl || jmx.UnixOperatingSystem || null;
}

function cpuMetricsAvailable(jmx) {
    return !!cpuOsNode(jmx);
}

function cpuLoadRatio(jmx, key) {
    var node = cpuOsNode(jmx);
    if (!node) {
        return 0;
    }
    var raw = jmxValue(node[key]);
    var num = parseFloat(raw);
    if (isNaN(num) || num < 0) {
        return 0;
    }
    return num;
}

function processCpuLoad(jmx) {
    return cpuLoadRatio(jmx, "ProcessCpuLoad");
}

function systemCpuLoad(jmx) {
    return cpuLoadRatio(jmx, "SystemCpuLoad");
}

function processCpuLoadPercent(jmx) {
    return Math.min(100, Math.round(processCpuLoad(jmx) * 100));
}

function systemCpuLoadPercent(jmx) {
    return Math.min(100, Math.round(systemCpuLoad(jmx) * 100));
}

function formatCpuLoad(ratio) {
    var pct = Math.max(0, (parseFloat(ratio) || 0) * 100);
    if (pct > 0 && pct < 0.1) {
        return pct.toFixed(2) + "%";
    }
    if (pct < 10) {
        return pct.toFixed(1) + "%";
    }
    return Math.round(pct) + "%";
}

function diskUsageNode(jmx) {
    if (!jmx || !jmx.DiskUsage) {
        return null;
    }
    return jmx.DiskUsage;
}

function diskMetricsAvailable(jmx) {
    return !!diskUsageNode(jmx);
}

function diskDirectoryBytes(jmx, key) {
    var node = diskUsageNode(jmx);
    if (!node) {
        return 0;
    }
    return parseInt(jmxValue(node[key]), 10) || 0;
}

function formatDiskBytes(bytes) {
    var n = parseInt(bytes, 10) || 0;
    if (n < 1024 * 1024) {
        return Math.round(n / 1024) + " KB";
    }
    if (n < 1024 * 1024 * 1024) {
        return (n / (1024 * 1024)).toFixed(1) + " MB";
    }
    return (n / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}

function diskDirectoryUsedPercent(jmx, prefix) {
    var used = diskDirectoryBytes(jmx, prefix + "UsedSpace");
    var total = diskDirectoryBytes(jmx, prefix + "TotalSpace");
    if (total <= 0) {
        return 0;
    }
    return Math.min(100, Math.round(used / (total / 100)));
}

function dataDirectoryUsedPercent(jmx) {
    return diskDirectoryUsedPercent(jmx, "DataDirectory");
}

function journalDirectoryUsedPercent(jmx) {
    return diskDirectoryUsedPercent(jmx, "JournalDirectory");
}

function diskDirectoryLabel(jmx, prefix) {
    var used = diskDirectoryBytes(jmx, prefix + "UsedSpace");
    var total = diskDirectoryBytes(jmx, prefix + "TotalSpace");
    if (total <= 0) {
        return formatDiskBytes(used) + " used";
    }
    return formatDiskBytes(used) + " / " + formatDiskBytes(total) +
        " (" + diskDirectoryUsedPercent(jmx, prefix) + "%)";
}

function journalDiskDistinct(jmx) {
    if (!diskMetricsAvailable(jmx)) {
        return false;
    }
    return !(
        diskDirectoryBytes(jmx, "DataDirectoryUsedSpace") ===
            diskDirectoryBytes(jmx, "JournalDirectoryUsedSpace") &&
        diskDirectoryBytes(jmx, "DataDirectoryTotalSpace") ===
            diskDirectoryBytes(jmx, "JournalDirectoryTotalSpace")
    );
}

function diskKpiPercent(jmx) {
    if (!diskMetricsAvailable(jmx)) {
        return 0;
    }
    var pct = dataDirectoryUsedPercent(jmx);
    if (journalDiskDistinct(jmx)) {
        pct = Math.max(pct, journalDirectoryUsedPercent(jmx));
    }
    return pct;
}

function diskKpiVisible(jmx) {
    return diskKpiPercent(jmx) >= JMX_CAPACITY_THRESHOLDS.warn;
}

function diskKpiClass(jmx) {
    var pct = diskKpiPercent(jmx);
    return {
        "kpi-warn": pct >= JMX_CAPACITY_THRESHOLDS.warn && pct < JMX_CAPACITY_THRESHOLDS.critical,
        "kpi-critical": pct >= JMX_CAPACITY_THRESHOLDS.critical
    };
}

function databaseStatus(jmx) {
    if (!jmx || !jmx.Database) {
        return "";
    }
    return jmxValue(jmx.Database.Status) || "";
}

function databaseStatusClass(jmx) {
    var status = String(databaseStatus(jmx) || "").toUpperCase();
    return {
        "label-success": status === "OPERATIONAL",
        "label-warning": status !== "" && status !== "OPERATIONAL"
    };
}

function databaseExistHome(jmx) {
    if (!jmx || !jmx.Database) {
        return "";
    }
    return jmxValue(jmx.Database.ExistHome) || "";
}

function readyVectorModels(vector) {
    if (!vector || !vector.models) {
        return [];
    }
    var models = ko.isObservable(vector.models) ? vector.models() : vector.models;
    return models.filter(function(model) {
        var status = ko.isObservable(model.status) ? model.status() : model.status;
        return status === "available";
    });
}

function catalogVectorModels(vector) {
    if (!vector || !vector.models) {
        return [];
    }
    return ko.isObservable(vector.models) ? vector.models() : vector.models;
}

function visibleCatalogModels(viewModel, vector) {
    var models = catalogVectorModels(vector);
    var showMissing = viewModel && viewModel.showMissingVectorModels &&
        typeof viewModel.showMissingVectorModels === "function" &&
        viewModel.showMissingVectorModels();
    if (showMissing) {
        return models;
    }
    return models.filter(function(model) {
        var status = ko.isObservable(model.status) ? model.status() : model.status;
        return status === "available";
    });
}

function vectorMissingCount(vector) {
    if (!vector) {
        return 0;
    }
    var ready = typeof vector.ready === "function" ? vector.ready() : vector.ready;
    var total = typeof vector.total === "function" ? vector.total() : vector.total;
    return Math.max(0, (total || 0) - (ready || 0));
}

function vectorModelLabel(model) {
    if (!model) {
        return "";
    }
    return vectorModelName(model) + " · " + vectorModelSpec(model);
}

function vectorModelName(model) {
    if (!model) {
        return "";
    }
    return ko.isObservable(model.id) ? model.id() : model.id;
}

function vectorModelSpec(model) {
    if (!model) {
        return "";
    }
    var dimension = ko.isObservable(model.dimension) ? model.dimension() : model.dimension;
    var provider = ko.isObservable(model.provider) ? model.provider() : model.provider;
    return dimension + "d · " + provider;
}

function vectorModelStatusDotClass(model) {
    if (!model) {
        return "not-ready";
    }
    var status = ko.isObservable(model.status) ? model.status() : model.status;
    return status === "available" ? "ready" : "not-ready";
}

function vectorCatalogCountText(vector) {
    if (!vector || !vector.available || !vector.available()) {
        return "0";
    }
    return String(vector.total());
}

function vectorModelStoreSummary(viewModel) {
    if (!viewModel || !viewModel.vectorStore || !viewModel.vectorStore.available ||
        !viewModel.vectorStore.available()) {
        return "—";
    }
    if (viewModel.vectorStoreSummaryText) {
        return viewModel.vectorStoreSummaryText();
    }
    return Monex.vector.vectorStoreSummary(viewModel.vectorStore);
}

function vectorModelStoreTooltip(viewModel) {
    if (!viewModel || !viewModel.vectorStore) {
        return "";
    }
    return vectorStoreEntryTooltip(viewModel.vectorStore);
}

function vectorPanelVisible(viewModel) {
    if (!viewModel) {
        return false;
    }
    var vector = viewModel.vector;
    var store = viewModel.vectorStore;
    if (vector && typeof vector.available === "function" && vector.available()) {
        return true;
    }
    if (store && typeof store.available === "function" && store.available()) {
        return true;
    }
    return false;
}

function vectorStatusClass(status) {
    switch (status) {
        case "available":
            return "label-success";
        case "http":
            return "label-info";
        default:
            return "label-danger";
    }
}

function vectorEmbeddingsKpiVisible(viewModel) {
    return !!(viewModel && viewModel.vector && viewModel.vector.available && viewModel.vector.available());
}

function vectorEmbeddingsKpiText(vector) {
    if (!vector || !vector.available || !vector.available()) {
        return "—";
    }
    var ready = vector.ready();
    var total = vector.total();
    return ready + " / " + total;
}

function vectorEmbeddingsKpiTitle(vector) {
    if (!vector || !vector.available || !vector.available()) {
        return "";
    }
    var ready = vector.ready();
    var total = vector.total();
    return ready + " ready · " + total + " in catalog";
}

function vectorEmbeddingsKpiClass(vector) {
    if (!vector || !vector.available || !vector.available()) {
        return {};
    }
    var ready = vector.ready();
    var total = vector.total();
    if (total > 0 && ready === 0) {
        return { "kpi-critical": true };
    }
    return {};
}

function vectorCatalogPanelLine(vector) {
    if (!vector || !vector.available || !vector.available()) {
        return "";
    }
    var ready = vector.ready();
    var total = vector.total();
    if (total === 0) {
        return "";
    }
    if (ready >= total) {
        return ready + " model" + (ready === 1 ? "" : "s") + " ready";
    }
    return ready + " ready · " + total + " in catalog";
}

function vectorEntriesKpiVisible(viewModel) {
    return !!(viewModel && viewModel.vectorStore &&
        viewModel.vectorStore.available && viewModel.vectorStore.available());
}

function vectorEntriesKpiText(vectorStore) {
    if (!vectorStore || !vectorStore.entryCountKnown || !vectorStore.entryCountKnown()) {
        return "—";
    }
    return String(vectorStore.entryCount());
}

function vectorStoreEntryTooltip(store) {
    var backend = "";
    if (store && store.storageBackend) {
        backend = typeof store.storageBackend === "function" ? store.storageBackend() : store.storageBackend;
    }
    var parts = [
        "Entries stored in the vector database file (vector.dbx)",
        "Not the same as Lucene vector-field index definitions in Browse Indexes"
    ];
    if (backend) {
        parts.push("Storage backend: " + backend);
    }
    return parts.join(". ");
}

function createVectorViewModel(data) {
    var payload = data || { available: false, models: [], ready: 0, total: 0, knnBackend: "" };
    return {
        available: ko.observable(!!payload.available),
        models: ko.observableArray(payload.models || []),
        ready: ko.observable(payload.ready || 0),
        total: ko.observable(payload.total || 0),
        knnBackend: ko.observable(payload.knnBackend || "")
    };
}

function updateVectorDiagnostics(model, data) {
    if (!model) {
        return;
    }
    var payload = data || { available: false, models: [], ready: 0, total: 0, knnBackend: "" };
    if (!model.vector) {
        model.vector = createVectorViewModel(payload);
        return;
    }
    model.vector.available(!!payload.available);
    model.vector.ready(payload.ready || 0);
    model.vector.total(payload.total || 0);
    model.vector.models(payload.models || []);
    model.vector.knnBackend(payload.knnBackend || "");
}

function uptime(data) {
    var uptimeMs = parseInt(data, 10);
    var cd = 24 * 60 * 60 * 1000;
    var ch = 60 * 60 * 1000;
    var d = Math.floor(uptimeMs / cd);
    var h = "0" + Math.floor((uptimeMs - d * cd) / ch);
    var m = "0" + Math.round((uptimeMs - d * cd - h * ch) / 60000);
    if (d > 0) {
        return d + "d " + h.substr(-2) + "h";
    }
    return h.substr(-2) + "h " + m.substr(-2) + "m";
}

Monex.kpi = {
    JMX_KPI_THRESHOLDS: JMX_KPI_THRESHOLDS,
    activeBrokerCount: activeBrokerCount,
    maxBrokerCount: maxBrokerCount,
    availableBrokerCount: availableBrokerCount,
    brokerKpiSubline: brokerKpiSubline,
    brokerPoolSubline: brokerPoolSubline,
    brokerPoolSummaryText: brokerPoolSummaryText,
    brokerPoolSummaryTitle: brokerPoolSummaryTitle,
    brokerPoolPercent: brokerPoolPercent,
    brokerInUsePercent: brokerInUsePercent,
    brokerIdlePercent: brokerIdlePercent,
    brokerPoolLegendText: brokerPoolLegendText,
    runningQueryCount: runningQueryCount,
    bufferedRunningQueryCount: bufferedRunningQueryCount,
    bufferedRecentQueryCount: bufferedRecentQueryCount,
    kpiLevel: kpiLevel,
    kpiIconClass: kpiIconClass,
    kpiBoxClass: kpiBoxClass,
    kpiCellClass: kpiCellClass,
    memoryUsedMb: memoryUsedMb,
    memoryMaxMb: memoryMaxMb,
    memoryUsedPercent: memoryUsedPercent,
    cpuMetricsAvailable: cpuMetricsAvailable,
    processCpuLoad: processCpuLoad,
    systemCpuLoad: systemCpuLoad,
    processCpuLoadPercent: processCpuLoadPercent,
    systemCpuLoadPercent: systemCpuLoadPercent,
    formatCpuLoad: formatCpuLoad,
    diskMetricsAvailable: diskMetricsAvailable,
    dataDirectoryUsedPercent: dataDirectoryUsedPercent,
    journalDirectoryUsedPercent: journalDirectoryUsedPercent,
    diskDirectoryLabel: diskDirectoryLabel,
    journalDiskDistinct: journalDiskDistinct,
    diskKpiPercent: diskKpiPercent,
    diskKpiVisible: diskKpiVisible,
    diskKpiClass: diskKpiClass,
    databaseStatus: databaseStatus,
    databaseStatusClass: databaseStatusClass,
    databaseExistHome: databaseExistHome,
    readyVectorModels: readyVectorModels,
    catalogVectorModels: catalogVectorModels,
    visibleCatalogModels: visibleCatalogModels,
    vectorMissingCount: vectorMissingCount,
    vectorModelLabel: vectorModelLabel,
    vectorModelName: vectorModelName,
    vectorModelSpec: vectorModelSpec,
    vectorModelStatusDotClass: vectorModelStatusDotClass,
    vectorCatalogCountText: vectorCatalogCountText,
    vectorModelStoreSummary: vectorModelStoreSummary,
    vectorModelStoreTooltip: vectorModelStoreTooltip,
    vectorPanelVisible: vectorPanelVisible,
    vectorStatusClass: vectorStatusClass,
    vectorEmbeddingsKpiVisible: vectorEmbeddingsKpiVisible,
    vectorEmbeddingsKpiText: vectorEmbeddingsKpiText,
    vectorEmbeddingsKpiTitle: vectorEmbeddingsKpiTitle,
    vectorCatalogPanelLine: vectorCatalogPanelLine,
    vectorEmbeddingsKpiClass: vectorEmbeddingsKpiClass,
    vectorEntriesKpiVisible: vectorEntriesKpiVisible,
    vectorEntriesKpiText: vectorEntriesKpiText,
    vectorStoreEntryTooltip: vectorStoreEntryTooltip,
    createVectorViewModel: createVectorViewModel,
    updateVectorDiagnostics: updateVectorDiagnostics,
    uptime: uptime
};

/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
JMX.TimeSeries = (function() {
    var CHART_WARMUP_SAMPLES = 3;
    var CHART_PLOT_SKIP = 2;

    function getProperty(data, property) {
        if (!data) {
            return 0;
        }
        var components = property.split(".");
        var prop = data;
        for (var i = 0; i < components.length; i++) {
            if (prop && prop.hasOwnProperty(components[i])) {
                prop = prop[components[i]];
            } else {
                return 0;
            }
        }
        if (prop && typeof prop === "object" && typeof ko !== "undefined" && ko.isObservable(prop)) {
            prop = prop();
        }
        return prop || 0;
    }

    function numericValue(value, unitY) {
        var num = parseFloat(value);
        if (isNaN(num)) {
            num = parseInt(value, 10) || 0;
        }
        if (unitY === "percent") {
            return num < 0 ? 0 : num * 100;
        }
        if (unitY === "mb") {
            num = num / 1024 / 1024;
        }
        return num;
    }

    function seriesPeak(datasets) {
        var peak = 0;
        for (var i = 0; i < datasets.length; i++) {
            var points = datasets[i].data;
            for (var j = 0; j < points.length; j++) {
                if (points[j].y > peak) {
                    peak = points[j].y;
                }
            }
        }
        return peak;
    }

    function computeYMax(scaleMode, unitY, heapCap, peak) {
        if (unitY === "percent") {
            if (scaleMode === "pressure") {
                var pctHeadroom = Math.max(peak * 0.25, 0.1);
                return Math.min(100, Math.max(peak + pctHeadroom, 1));
            }
            return 100;
        }
        if (scaleMode === "pressure") {
            var headroom = Math.max(peak * 0.15, unitY === "mb" ? 256 : 1);
            var zoomed = Math.max(peak + headroom, unitY === "mb" ? 512 : 2);
            if (heapCap > 0) {
                return Math.min(heapCap, zoomed);
            }
            return zoomed;
        }
        if (heapCap > 0) {
            return heapCap;
        }
        return Math.max(peak + 1, 1);
    }

    Constr = function(container, labels, properties, propertyMaxY, unitY) {
        this.container = $(container);
        this.canvas = MonexCharts.ensureCanvas(this.container);
        this.chart = null;
        this.lastHeapCap = 0;
        this.properties = properties;
        this.propertyMaxY = propertyMaxY;
        this.unitY = unitY || "";
        this.scaleMode = container.attr("data-scale") || "fixed";
        this.showLegend = container.attr("data-legend") !== "false";
        this.compactAxis = container.attr("data-compact-axis") === "true";
        this.datasets = [];
        for (var i = 0; i < labels.length; i++) {
            var colors = MonexCharts.colorForIndex(i);
            this.datasets.push({
                label: labels[i].trim(),
                data: [],
                borderColor: colors.border,
                backgroundColor: colors.fill,
                borderWidth: 1.2,
                pointRadius: 0,
                pointHoverRadius: 3,
                fill: true,
                tension: 0.1
            });
        }
    };

    Constr.prototype.getPlotDataset = function() {
        var len = this.datasets[0].data.length;
        if (len < CHART_WARMUP_SAMPLES) {
            return null;
        }
        var skip = 0;
        if (!this.compactAxis && len > CHART_PLOT_SKIP + 1) {
            skip = CHART_PLOT_SKIP;
        }
        return this.datasets.map(function(series) {
            return $.extend({}, series, {
                data: skip > 0 ? series.data.slice(skip) : series.data.slice()
            });
        });
    };

    function applyAxisOptions(options, unitY, yMax, compactAxis) {
        options.scales.y.max = yMax;
        if (compactAxis) {
            options.scales.x.ticks.display = false;
            options.scales.x.title.display = false;
            options.scales.x.grid.display = false;
            options.scales.y.ticks.maxTicksLimit = 2;
            options.plugins.legend.display = false;
        }
        if (unitY === "percent") {
            options.scales.y.ticks.callback = function(value) {
                if (value < 1) {
                    return value.toFixed(2) + "%";
                }
                return value + "%";
            };
            if (!compactAxis) {
                options.scales.y.title = {
                    display: true,
                    text: "Load"
                };
            }
        }
        return options;
    }

    Constr.prototype.renderPlot = function(data) {
        var plotDataset = this.getPlotDataset();
        if (!plotDataset) {
            return;
        }
        var heapCap = data ?
            numericValue(getProperty(data, this.propertyMaxY), this.unitY) :
            this.lastHeapCap;
        if (data) {
            this.lastHeapCap = heapCap;
        }
        var yMax = computeYMax(this.scaleMode, this.unitY, heapCap, seriesPeak(plotDataset));
        if (this.chart) {
            for (var i = 0; i < plotDataset.length; i++) {
                this.chart.data.datasets[i].data = plotDataset[i].data;
            }
            applyAxisOptions(this.chart.options, this.unitY, yMax, this.compactAxis);
            this.chart.update("none");
            return;
        }
        var options = applyAxisOptions(MonexCharts.liveChartOptions(this.showLegend), this.unitY, yMax, this.compactAxis);
        this.chart = new Chart(this.canvas, {
            type: "line",
            data: { datasets: plotDataset },
            options: options
        });
    };

    Constr.prototype.update = function(data) {
        if (this.datasets[0].data.length > 100) {
            for (var i = 0; i < this.datasets.length; i++) {
                this.datasets[i].data.shift();
            }
        }
        var now = new Date().getTime();
        for (var i = 0; i < this.properties.length; i++) {
            var val = numericValue(getProperty(data, this.properties[i]), this.unitY);
            this.datasets[i].data.push({ x: now, y: val });
        }
        this.renderPlot(data);
    };

    Constr.prototype.replot = function() {
        if (this.chart) {
            this.chart.resize();
        }
        this.renderPlot(null);
    };

    return Constr;
}());

/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
JMX.connection = (function() {
    "use strict";

    var viewModel = null;
    var instanceMap = {};
    var currentInstance;
    var onUpdateCb;
    var poll = true;
    var pollPeriod = 1000;
    var pollInFlight = false;
    var pollTimer = null;
    var lastLiveRunningQueryCount = 0;
    var visibilityListenerAttached = false;
    var wsReconnectDelay = 1000;

    $(window).on("beforeunload", function() {
        poll = false;
        if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    });

    function Instance(config, schedulerActive) {
        this.name = ko.observable(config.name);
        this.url = ko.observable(config.url);
        this.baseURL = config.url;
        this.token = config.token;
        var status = schedulerActive ? config.status : "Stopped";
        if (status == "Checking" || status == "PING_OK" || status == "Stopped") {
            this.status = ko.observable(status);
            this.message = ko.observable("");
        } else {
            this.message = ko.observable(status);
            this.status = ko.observable("PING_ERROR");
        }
        this.elapsed = ko.observable("00:00.000");
        this.time = ko.observable("0");

        this.icon = ko.computed(function() {
            switch (this.status()) {
                case "Checking":
                    return "fa fa-refresh primary";
                case "PING_OK":
                    return "fa fa-check-circle-o success";
                default:
                    return "fa fa-warning danger";
            }
        }, this);
    }

    function Instances(instances, schedulerActive) {
        this.instances = ko.observableArray(instances);
        this.status = ko.observable(schedulerActive ? "Checking" : "Stopped");

        this.warnings = ko.computed(function() {
            var fails = 0;
            for (var i = 0; i < this.instances().length; i++) {
                var status = this.instances()[i].status();
                if (status == "PING_ERROR" ||
                    status == "Connection Error") {
                    fails++;
                }
            }
            return fails === 0 ? "" : fails;
        }, this);

        this.schedule = function() {
            var self = this;
            var newStatus = self.status() == "Stopped" ? "Checking" : "Stopped";
            self.status(newStatus);
            $.ajax({
                url: "modules/" + (newStatus == "Stopped" ? "unschedule.xql" : "schedule.xql"),
                method: "GET",
                success: function() {
                    for (var i = 0; i < self.instances().length; i++) {
                        self.instances()[i].status(newStatus);
                    }
                }
            });
        };
    }

    function effectivePollDelay() {
        if (typeof document !== "undefined" && document.hidden) {
            return Math.max(pollPeriod, Monex.activity.HIDDEN_POLL_BACKOFF_MS);
        }
        return pollPeriod;
    }

    function updatePollStatus(viewModelRef, startedAt, finishedAt) {
        if (!viewModelRef || !viewModelRef.pollLastLabel) {
            return;
        }
        var latency = Math.max(0, Math.round(finishedAt - startedAt));
        var stamp = new Date(finishedAt).toLocaleTimeString();
        viewModelRef.pollLastLabel(stamp + " · " + latency + "ms");
        if (viewModelRef.pollTabIdle) {
            viewModelRef.pollTabIdle(document.hidden);
        }
    }

    function ensureVisibilityListener() {
        if (visibilityListenerAttached || typeof document === "undefined") {
            return;
        }
        visibilityListenerAttached = true;
        document.addEventListener("visibilitychange", function() {
            if (viewModel && viewModel.pollTabIdle) {
                viewModel.pollTabIdle(document.hidden);
            }
            if (!document.hidden && poll && onUpdateCb) {
                JMX.connection.poll(onUpdateCb);
            }
        });
    }

    function connect(channel, callback) {
        if (!Modernizr.websockets) {
            $("#browser-alert").show(400);
            setTimeout(function() { $("#browser-alert").hide(200); }, 8000);
            return;
        }

        var rootcontext = location.pathname.replace(/^(.*?)\/(apps\/)?monex\/.*$/, "$1");
        var proto = window.location.protocol == "https:" ? "wss" : "ws";
        var url = proto + "://" + location.host + rootcontext + "/ws";
        var connection = new WebSocket(url);

        connection.onerror = function(error) {
            $("#status").text("Connection error ...");
            console.log("WebSocket Error: %o", error);
        };

        connection.onclose = function() {
            $("#status").text("Disconnected.");
            if (poll) {
                setTimeout(function() {
                    wsReconnectDelay = Math.min(wsReconnectDelay * 2, 30000);
                    connect(channel, callback);
                }, wsReconnectDelay);
            }
        };

        connection.onopen = function() {
            wsReconnectDelay = 1000;
            $("#status").text("Connected.");
            connection.send('{ "channel": "' + channel + '" }');
        };

        connection.onmessage = function(e) {
            if (e.data == "ping") {
                return;
            }

            var data = JSON.parse(e.data);
            console.log("ping received for %s: %s", data.instance, data.status);
            callback(data);
        };
    }

    return {
        getViewModel: function() {
            return viewModel;
        },

        invoke: function(operation, mbean, args, callbacks) {
            var url;
            if (currentInstance.name() == "localhost") {
                url = location.pathname.replace(/^(.*?)\/(apps\/)?monex\/.*$/, "$1") +
                    "/status?operation=" + operation + "&mbean=" + mbean + "&token=" + currentInstance.token;
            } else {
                url = "modules/remote.xql?operation=" + operation + "&mbean=" + mbean + "&name=" + currentInstance.name();
            }
            if (args) {
                for (var i = 0; i < args.length; i++) {
                    url += "&args=" + args[i];
                }
            }
            $.ajax({
                url: url,
                type: "GET",
                timeout: 10000,
                success: function() {
                    if (callbacks && callbacks.success) {
                        callbacks.success();
                    }
                },
                error: function(xhr, status, error) {
                    $("#connection-alert").show(400).find(".message")
                        .text("Operation '" + operation + "' failed or is not supported on this server instance.");
                    setTimeout(function() { $("#connection-alert").hide(200); }, 3000);
                    if (callbacks && callbacks.error) {
                        callbacks.error(xhr, status, error);
                    }
                }
            });
        },

        poll: function(onUpdate) {
            onUpdateCb = onUpdate;
            if (!poll || pollInFlight) {
                return;
            }
            pollInFlight = true;
            ensureVisibilityListener();

            var url;
            var name = currentInstance.name();
            if (name == "localhost") {
                url = location.pathname.replace(/^(.*?)\/(apps\/)?monex\/.*$/, "$1") +
                    "/status?c=instances&c=processes&c=locking&c=memory&c=caches&c=system&c=operatingsystem&c=disk&c=vector&token=" + currentInstance.token;
            } else {
                url = "modules/remote.xql?name=" + name;
            }

            var pollStarted = performance.now();

            $.ajax({
                url: url,
                type: "GET",
                timeout: 10000,
                success: function(xml) {
                    pollInFlight = false;
                    var pollFinished = performance.now();
                    $("#connection-alert").hide(400);
                    var data = JMX.util.fixjs(JMX.util.jmx2js(xml));
                    if (data) {
                        if (!data.jmx.version) {
                            data.jmx.version = 0;
                        }
                        currentInstance.version = data.jmx.version;
                        var rootDom = document.getElementById("dashboard");
                        if (rootDom) {
                            if (!viewModel) {
                                viewModel = ko.mapping.fromJS(data);
                                Monex.activity.attachDashboardViewModel(viewModel, { livePoll: true });
                                viewModel.vector = createVectorViewModel(null);
                                viewModel.vectorStore = Monex.vector.createVectorStoreViewModel(null);
                                viewModel.gc = function() {
                                    JMX.connection.invoke("gc", "java.lang:type=Memory");
                                };
                                viewModel.showAllCaches = ko.observable(false);
                                viewModel.toggleAllCaches = function() {
                                    viewModel.showAllCaches(!viewModel.showAllCaches());
                                };
                                JMX.util.initActivityPanelSettings(data.jmx.ProcessReport);
                                if (name == "localhost") {
                                    viewModel.url = "";
                                } else {
                                    viewModel.url = currentInstance.url().replace(/\/exist\/?$/, "");
                                }
                                ko.applyBindings(viewModel, rootDom);
                            } else {
                                Monex.activity.cleanupActivityTooltips();
                                ko.mapping.fromJS(data, viewModel);
                                if (viewModel.activityFlyout) {
                                    viewModel.activityFlyout.afterPoll();
                                }
                            }
                            Monex.vector.syncVectorFromJmx(viewModel, data.jmx);
                            updatePollStatus(viewModel, pollStarted, pollFinished);
                            var liveRunning = runningQueryCount(data.jmx);
                            if (liveRunning > lastLiveRunningQueryCount) {
                                Monex.activity.revealRunningQueries(liveRunning);
                            }
                            lastLiveRunningQueryCount = liveRunning;
                        }
                        if (onUpdate) {
                            onUpdate(data);
                        }
                        pollTimer = setTimeout(function() { JMX.connection.poll(onUpdate); }, effectivePollDelay());
                    } else {
                        $("#connection-alert").show(400).find(".message").text("No response from server. Retrying ...");
                        pollTimer = setTimeout(function() { JMX.connection.poll(onUpdate); }, 5000);
                    }
                },
                error: function() {
                    pollInFlight = false;
                    $("#connection-alert").show(400).find(".message")
                        .text("Connection to server failed. Retrying ...");
                    pollTimer = setTimeout(function() { JMX.connection.poll(onUpdate); }, 5000);
                }
            });
        },

        init: function(config, schedulerActive) {
            instanceMap = {};
            var instances = [];
            for (var i = 0; i < config.length; i++) {
                var instance = new Instance(config[i], schedulerActive);
                instanceMap[config[i].name] = instance;
                if (config[i].name == JMX_INSTANCE) {
                    currentInstance = instance;
                }
                if (config[i].url != "local") {
                    instances.push(instance);
                }
            }
            var remotesModel = new Instances(instances, schedulerActive);
            var domRoot = document.getElementById("remotes");
            if (domRoot) {
                ko.applyBindings(remotesModel, domRoot);
            }
            ko.applyBindings(remotesModel, $("#notifications")[0]);

            connect("jmx.ping", JMX.connection.ping);
        },

        ping: function(data) {
            var instance = instanceMap[data.instance];
            if (!instance) {
                console.log("instance not found: %s", data.instance);
                return;
            }
            instance.elapsed(data.elapsed);
            switch (data.status) {
                case "ok":
                    instance.status(data.SanityReport.Status);
                    instance.time(data.SanityReport.PingTime);
                    instance.message("");
                    break;
                case "pending":
                    instance.status("Checking");
                    instance.time("?");
                    instance.message("");
                    break;
                default:
                    instance.status("PING_ERROR");
                    instance.message(data.status);
                    instance.time("?");
            }
        },

        setPollPeriod: function(period) {
            pollPeriod = parseFloat(period) * 1000;
        },

        togglePolling: function() {
            if (poll) {
                poll = false;
            } else {
                poll = true;
                JMX.connection.poll(onUpdateCb);
            }
        }
    };
}());

/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
$(function() {
    Monex.activity.initFlyoutDismiss(function() {
        var vm = JMX.connection.getViewModel();
        if (vm && vm.activityFlyout) {
            return vm.activityFlyout;
        }
        if (typeof Monex.activity.getDetailsFlyout === "function") {
            return Monex.activity.getDetailsFlyout();
        }
        return null;
    });

    JMX.connection.init(JMX_INSTANCES, JMX_ACTIVE);

    $("#dashboard").each(function() {
        var charts = [];

        function initCharts() {
            if (charts.length > 0) {
                return;
            }
            $("#dashboard .chart").each(function() {
                var node = $(this);
                if (node.data("timeseries")) {
                    return;
                }
                var labels = node.attr("data-labels");
                var properties = node.attr("data-properties");
                var unitY = node.attr("data-unit-y") || "";
                var max = node.attr("data-max-y");
                var chart = new JMX.TimeSeries(node, labels.split(","), properties.split(","), max, unitY);
                node.data("timeseries", chart);
                charts.push(chart);
            });
        }

        function redrawCharts() {
            for (var i = 0; i < charts.length; i++) {
                charts[i].replot();
            }
        }

        $("#poll-period").ionRangeSlider({
            skin: "monex",
            min: 0.5,
            max: 60.0,
            from: 1.0,
            type: "single",
            step: 0.1,
            postfix: " sec",
            hasGrid: true,
            onChange: function(data) {
                JMX.connection.setPollPeriod(data.from);
            }
        });
        $("#pause-btn").on("click", function() {
            JMX.connection.togglePolling();
        });
        function redrawCpuGauges() {
            if (Monex.cpuGauge) {
                Monex.cpuGauge.resize();
            }
        }

        JMX.connection.poll(function(data) {
            initCharts();
            for (var i = 0; i < charts.length; i++) {
                charts[i].update(data);
            }
            if (Monex.cpuGauge && data && data.jmx) {
                Monex.cpuGauge.update(data.jmx);
            }
            window.requestAnimationFrame(function() {
                for (var j = 0; j < charts.length; j++) {
                    charts[j].replot();
                }
                redrawCpuGauges();
            });
        });
        $("#dashboard").on("expanded.boxwidget", ".box", function() {
            redrawCharts();
            redrawCpuGauges();
        });
        $(window).on("resize.dashboardCharts", function() {
            redrawCharts();
            redrawCpuGauges();
        });
    });
});

/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
var Monex = window.Monex || {};
window.Monex = Monex;

function normalizeVectorModelRow(row) {
    if (!row) {
        return null;
    }
    var source = row.value || row;
    var status = jmxValue(source.status) || jmxValue(source.Status) || "";
    var provider = jmxValue(source.provider) || jmxValue(source.Provider) || "";
    if (!provider && status === "http") {
        provider = "HTTP";
    }
    return {
        id: jmxValue(source.id) || jmxValue(source.Id) || "",
        source: jmxValue(source.source) || jmxValue(source.Source) || "",
        path: jmxValue(source.path) || jmxValue(source.Path) || "",
        dimension: parseInt(jmxValue(source.dimension) || jmxValue(source.Dimension), 10) || 0,
        status: status,
        message: jmxValue(source.message) || jmxValue(source.Message) || "",
        provider: provider
    };
}

function jmxVectorStorePayload(storeNode) {
    if (!storeNode) {
        return null;
    }
    var available = jmxValue(storeNode.Available);
    return {
        available: available === true || available === "true",
        entryCountKnown: (function() {
            var known = jmxValue(storeNode.EntryCountKnown);
            return known === true || known === "true";
        })(),
        entryCount: parseInt(jmxValue(storeNode.EntryCount), 10) || 0,
        fileSize: parseInt(jmxValue(storeNode.FileSize), 10) || 0,
        formatVersion: parseInt(jmxValue(storeNode.FormatVersion), 10) || 0,
        storageBackend: jmxValue(storeNode.StorageBackend) ||
            jmxValue(storeNode.PersistenceBackend) ||
            "vector.dbx"
    };
}

function jmxVectorToPayload(jmx) {
    if (!jmx) {
        return {
            available: false,
            total: 0,
            ready: 0,
            models: [],
            store: null
        };
    }
    var store = jmxVectorStorePayload(jmx.VectorStore);
    if (!jmx.VectorEmbedding) {
        return {
            available: false,
            total: 0,
            ready: 0,
            models: [],
            store: store
        };
    }
    var emb = jmx.VectorEmbedding;
    var knnBackend = jmxValue(emb.KnnBackend) ||
        jmxValue(emb.PersistenceBackend) ||
        "lucene";
    var modelsRaw = jmxValue(emb.Models);
    var models = [];
    if (modelsRaw && modelsRaw.length) {
        for (var i = 0; i < modelsRaw.length; i++) {
            models.push(normalizeVectorModelRow(modelsRaw[i]));
        }
    }
    return {
        available: true,
        total: parseInt(jmxValue(emb.ModelCount), 10) || 0,
        ready: parseInt(jmxValue(emb.ReadyModelCount), 10) || 0,
        models: models,
        store: store,
        knnBackend: knnBackend,
        metrics: {
            embedCallCount: parseInt(jmxValue(emb.EmbedCallCount), 10) || 0,
            knnQueryCount: parseInt(jmxValue(emb.KnnQueryCount), 10) || 0,
            loadedProviderCount: parseInt(jmxValue(emb.LoadedProviderCount), 10) || 0,
            knnBackend: knnBackend
        }
    };
}

function createVectorStoreViewModel(store) {
    if (!store) {
        store = {
            available: false,
            entryCountKnown: false,
            entryCount: 0,
            fileSize: 0,
            formatVersion: 0,
            storageBackend: "vector.dbx"
        };
    }
    return {
        available: ko.observable(!!store.available),
        entryCountKnown: ko.observable(!!store.entryCountKnown),
        entryCount: ko.observable(store.entryCount || 0),
        fileSize: ko.observable(store.fileSize || 0),
        formatVersion: ko.observable(store.formatVersion || 0),
        storageBackend: ko.observable(store.storageBackend || "vector.dbx")
    };
}

function updateVectorStoreViewModel(model, store) {
    if (!model || !store) {
        return;
    }
    if (!model.vectorStore) {
        model.vectorStore = createVectorStoreViewModel(store);
        return;
    }
    model.vectorStore.available(!!store.available);
    model.vectorStore.entryCountKnown(!!store.entryCountKnown);
    model.vectorStore.entryCount(store.entryCount || 0);
    model.vectorStore.fileSize(store.fileSize || 0);
    model.vectorStore.formatVersion(store.formatVersion || 0);
    model.vectorStore.storageBackend(store.storageBackend || "vector.dbx");
}

function ensureVectorStoreSummaryComputed(viewModel) {
    if (!viewModel || viewModel.vectorStoreSummaryText) {
        return;
    }
    viewModel.vectorStoreSummaryText = ko.pureComputed(function() {
        return Monex.vector.vectorStoreSummary(viewModel.vectorStore);
    });
}

function syncVectorFromJmx(viewModel, jmx) {
    if (!viewModel) {
        return;
    }
    var payload = jmxVectorToPayload(jmx);
    Monex.kpi.updateVectorDiagnostics(viewModel, {
        available: payload.available,
        total: payload.total,
        ready: payload.ready,
        models: payload.models,
        knnBackend: payload.knnBackend || ""
    });
    if (payload.store) {
        updateVectorStoreViewModel(viewModel, payload.store);
    } else if (viewModel.vectorStore) {
        viewModel.vectorStore.available(false);
    }
    ensureVectorStoreSummaryComputed(viewModel);
}

function formatVectorFileSize(bytes) {
    var n = parseInt(bytes, 10) || 0;
    if (n < 1024) {
        return n + " B";
    }
    if (n < 1024 * 1024) {
        return Math.round(n / 1024) + " KB";
    }
    return (n / (1024 * 1024)).toFixed(1) + " MB";
}

function vectorStoreSummary(store) {
    if (!store) {
        return "";
    }
    var available = typeof store.available === "function" ? store.available() : store.available;
    if (!available) {
        return "";
    }
    var parts = [];
    var known = typeof store.entryCountKnown === "function" ? store.entryCountKnown() : store.entryCountKnown;
    if (known) {
        var count = typeof store.entryCount === "function" ? store.entryCount() : store.entryCount;
        parts.push(count + " entries");
    }
    var size = typeof store.fileSize === "function" ? store.fileSize() : store.fileSize;
    if (size >= 0) {
        parts.push(formatVectorFileSize(size));
    }
    return parts.join(" · ");
}

Monex.vector = {
    jmxVectorToPayload: jmxVectorToPayload,
    syncVectorFromJmx: syncVectorFromJmx,
    createVectorStoreViewModel: createVectorStoreViewModel,
    formatVectorFileSize: formatVectorFileSize,
    vectorStoreSummary: vectorStoreSummary
};

/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
Monex.capacityGauge = (function() {
    "use strict";

var PROCESS_COLOR = "rgb(60, 141, 188)";
var SYSTEM_COLOR = "rgb(243, 156, 18)";
var DATA_DISK_COLOR = "rgb(0, 166, 90)";
var JOURNAL_DISK_COLOR = "rgb(0, 192, 239)";
var MEMORY_COLOR = "rgb(221, 75, 57)";
var TRACK_COLOR = "#eceff3";
    var gauges = [];

    function createGauge(container, color) {
        var canvas = MonexCharts.ensureCanvas(container);
        var chart = new Chart(canvas, {
            type: "doughnut",
            data: {
                datasets: [{
                    data: [0, 100],
                    backgroundColor: [color, TRACK_COLOR],
                    borderWidth: 0,
                    hoverOffset: 0
                }]
            },
            options: MonexCharts.semicircleGaugeOptions()
        });
        return {
            chart: chart,
            percent: function() {
                return 0;
            }
        };
    }

    function registerGauge(id, color, percentFn) {
        var node = document.getElementById(id);
        if (!node) {
            return;
        }
        var gauge = createGauge(node, color);
        gauge.percent = percentFn;
        gauges.push(gauge);
    }

    function init() {
        if (gauges.length > 0) {
            return;
        }
        registerGauge("cpu-process-gauge", PROCESS_COLOR, function(jmx) {
            return Monex.kpi.processCpuLoadPercent(jmx);
        });
        registerGauge("cpu-system-gauge", SYSTEM_COLOR, function(jmx) {
            return Monex.kpi.systemCpuLoadPercent(jmx);
        });
        registerGauge("disk-data-gauge", DATA_DISK_COLOR, function(jmx) {
            return Monex.kpi.dataDirectoryUsedPercent(jmx);
        });
        registerGauge("disk-journal-gauge", JOURNAL_DISK_COLOR, function(jmx) {
            return Monex.kpi.journalDirectoryUsedPercent(jmx);
        });
        registerGauge("memory-usage-gauge", MEMORY_COLOR, function(jmx) {
            if (!jmx || !jmx.MemoryImpl || !jmx.MemoryImpl.HeapMemoryUsage) {
                return 0;
            }
            return Monex.kpi.memoryUsedPercent(jmx.MemoryImpl.HeapMemoryUsage());
        });
    }

    function update(jmx) {
        init();
        for (var i = 0; i < gauges.length; i++) {
            var pct = Math.min(100, Math.max(0, gauges[i].percent(jmx) || 0));
            gauges[i].chart.data.datasets[0].data = [pct, 100 - pct];
            gauges[i].chart.update("none");
        }
    }

    function resize() {
        for (var i = 0; i < gauges.length; i++) {
            if (gauges[i].chart) {
                gauges[i].chart.resize();
            }
        }
    }

    return {
        init: init,
        update: update,
        resize: resize
    };
}());

Monex.cpuGauge = Monex.capacityGauge;
