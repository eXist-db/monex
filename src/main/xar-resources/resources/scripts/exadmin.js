/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
// util.js must be loaded first, otherwise JMX is undefined
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

function cacheShowHitRate(hits, fails) {
    var h = parseInt(hits, 10) || 0;
    var f = parseInt(fails, 10) || 0;
    if (h + f === 0) {
        return false;
    }
    return (h / (h + f)) < 0.95;
}

function brokerPoolPercent(jmx) {
    var active = activeBrokerCount(jmx);
    var max = maxBrokerCount(jmx);
    if (max <= 0) {
        return 0;
    }
    return Math.round(active / (max / 100));
}

function runningJobCount(jmx) {
    if (!jmx || !jmx.ProcessReport || !jmx.ProcessReport.RunningJobs) {
        return 0;
    }
    var jobs = jmx.ProcessReport.RunningJobs;
    return (ko.isObservable(jobs) ? jobs() : jobs).length || 0;
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
    var id = ko.isObservable(model.id) ? model.id() : model.id;
    var dimension = ko.isObservable(model.dimension) ? model.dimension() : model.dimension;
    var provider = ko.isObservable(model.provider) ? model.provider() : model.provider;
    return id + " · " + dimension + "d · " + provider;
}

function waitingThreadCount(jmx) {
    if (!jmx) {
        return 0;
    }
    if (jmx.LockManager && jmx.LockManager.WaitingThreads) {
        var waiting = jmx.LockManager.WaitingThreads;
        var rows = ko.isObservable(waiting) ? waiting() : waiting;
        return rows.filter(function(row) {
            return !JMX.util.activityRowEnded(row);
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

function activityUriTitle(row) {
    return JMX.util.activityUriTitle(JMX.util.activityRequestUri(row));
}

function showKillQuery(row) {
    if (activityRowEnded(row)) {
        return false;
    }
    return JMX_INSTANCE.name === "localhost" || JMX_INSTANCE.version !== 0;
}

function buildActivityUriFlyoutContent(fullUri, openHref) {
    var $flyout = $("#activity-uri-flyout");
    if (!$flyout.length) {
        return;
    }
    $flyout.find(".activity-uri-flyout-text").text(fullUri || "");
    var $open = $flyout.find(".activity-uri-flyout-open");
    if (openHref && openHref !== "#") {
        $open.attr("href", openHref).show();
    } else {
        $open.hide().removeAttr("href");
    }
}

function buildActivityStackFlyoutContent(title, stackText) {
    var $flyout = $("#activity-stack-flyout");
    if (!$flyout.length) {
        return;
    }
    $flyout.find(".activity-stack-flyout-title").text(title || "Stack trace");
    $flyout.find(".activity-stack-flyout-text").text(stackText || "");
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

function applyActivityRowFlyoutKeys(node, data) {
    var rowKey = activityRowFlyoutKey(data);
    if (!rowKey) {
        return;
    }
    $(node).find(".activity-uri-link").attr("data-flyout-key", "uri:" + rowKey);
    $(node).find(".stack").attr("data-flyout-key", "stack:" + rowKey);
}

function findActivityFlyoutAnchor(state) {
    if (!state || !state.key) {
        return $();
    }
    var selector = state.type === "uri" ? ".activity-uri-link" : ".stack";
    return $("#dashboard, #details").find(selector).filter(function() {
        return $(this).attr("data-flyout-key") === state.key;
    }).first();
}

var activityFlyoutState = null;
var activityFlyoutAnchors = {};
var activityFlyoutSuppressDismissUntil = 0;

function suppressActivityFlyoutDismiss() {
    activityFlyoutSuppressDismissUntil = Date.now() + 250;
}

function shouldSuppressActivityFlyoutDismiss() {
    return Date.now() < activityFlyoutSuppressDismissUntil;
}

function dismissActivityFlyouts() {
    $("#activity-uri-flyout, #activity-stack-flyout").each(function() {
        var $flyout = $(this);
        $flyout.hide().attr("aria-hidden", "true");
    });
    activityFlyoutAnchors = {};
    activityFlyoutState = null;
}

function dismissActivityUriFlyout() {
    dismissActivityFlyouts();
}

function positionActivityFlyout($flyout, $anchor) {
    if (!$flyout.length || !$anchor.length) {
        return;
    }
    var maxWidth = $flyout.hasClass("activity-stack-flyout") ? 640 : 480;
    var rect = $anchor[0].getBoundingClientRect();
    var flyoutWidth = Math.min(maxWidth, window.innerWidth - 24);
    var left = Math.max(12, Math.min(rect.left, window.innerWidth - flyoutWidth - 12));
    var top = rect.bottom + 6;
    $flyout.css({
        position: "fixed",
        left: left + "px",
        top: top + "px",
        width: flyoutWidth + "px",
        zIndex: 1050
    });
    $flyout.show().attr("aria-hidden", "false");
    var flyoutBottom = $flyout[0].getBoundingClientRect().bottom;
    if (flyoutBottom > window.innerHeight - 12) {
        top = Math.max(12, rect.top - 6 - $flyout.outerHeight());
        $flyout.css("top", top + "px");
    }
}

function isActivityFlyoutOpen($flyout, $anchor) {
    return $flyout.is(":visible") && activityFlyoutState &&
        activityFlyoutState.id === $flyout.attr("id") &&
        activityFlyoutState.key === ($anchor.attr("data-flyout-key") || "");
}

function rememberActivityFlyout($flyout, $anchor, type) {
    var key = $anchor.attr("data-flyout-key");
    if (!key) {
        key = type + ":" + ($anchor.attr("data-uri-full") || $anchor.attr("data-stack-title") || $anchor.text());
        $anchor.attr("data-flyout-key", key);
    }
    activityFlyoutState = {
        id: $flyout.attr("id"),
        type: type,
        key: key
    };
    activityFlyoutAnchors[$flyout.attr("id")] = $anchor[0];
}

function showActivityUriFlyout($anchor) {
    dismissActivityFlyouts();
    buildActivityUriFlyoutContent(
        $anchor.attr("data-uri-full") || "",
        $anchor.attr("data-uri-href") || "#"
    );
    var $flyout = $("#activity-uri-flyout");
    rememberActivityFlyout($flyout, $anchor, "uri");
    positionActivityFlyout($flyout, $anchor);
    suppressActivityFlyoutDismiss();
}

function showActivityStackFlyout($anchor) {
    dismissActivityFlyouts();
    buildActivityStackFlyoutContent(
        $anchor.attr("data-stack-title") || "",
        $anchor.attr("data-stack-text") || ""
    );
    var $flyout = $("#activity-stack-flyout");
    rememberActivityFlyout($flyout, $anchor, "stack");
    positionActivityFlyout($flyout, $anchor);
    suppressActivityFlyoutDismiss();
}

function refreshActivityFlyoutAnchors() {
    if (!activityFlyoutState) {
        return;
    }
    var $flyout = $("#" + activityFlyoutState.id);
    if (!$flyout.length || !$flyout.is(":visible")) {
        return;
    }
    var $anchor = findActivityFlyoutAnchor(activityFlyoutState);
    if (!$anchor.length) {
        dismissActivityFlyouts();
        return;
    }
    activityFlyoutAnchors[activityFlyoutState.id] = $anchor[0];
    positionActivityFlyout($flyout, $anchor);
}

function reconcileActivityFlyouts() {
    refreshActivityFlyoutAnchors();
}

function cleanupActivityOverlays() {
    reconcileActivityFlyouts();
    $(".source-key").each(function() {
        var $el = $(this);
        if ($el.data("bs.tooltip")) {
            $el.tooltip("hide");
        }
    });
    $("body > .tooltip, #dashboard .tooltip, #details .tooltip").remove();
    $("body > .popover.in, #dashboard .popover.in, #details .popover.in").remove();
}

function initActivityFlyouts() {
    if ($("body").data("activityFlyoutsInit")) {
        return;
    }
    $("body").data("activityFlyoutsInit", true);

    $(document).on("click.activityFlyout", ".activity-uri-link", function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var $anchor = $(this);
        var $flyout = $("#activity-uri-flyout");
        if (isActivityFlyoutOpen($flyout, $anchor)) {
            dismissActivityFlyouts();
        } else {
            showActivityUriFlyout($anchor);
        }
    });

    $(document).on("click.activityFlyout", ".stack", function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var $anchor = $(this);
        var $flyout = $("#activity-stack-flyout");
        if (isActivityFlyoutOpen($flyout, $anchor)) {
            dismissActivityFlyouts();
        } else {
            showActivityStackFlyout($anchor);
        }
    });

    $("#activity-uri-flyout, #activity-stack-flyout").on("click.activityFlyout", function(ev) {
        ev.stopPropagation();
    });

    $("#activity-uri-flyout").on("click.activityFlyout", ".activity-uri-flyout-close", function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        dismissActivityFlyouts();
    });

    $("#activity-stack-flyout").on("click.activityFlyout", ".activity-stack-flyout-close", function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        dismissActivityFlyouts();
    });

    $(document).on("click.activityFlyout", function(ev) {
        if (shouldSuppressActivityFlyoutDismiss()) {
            return;
        }
        if ($(ev.target).closest("#activity-uri-flyout, .activity-uri-link, #activity-stack-flyout, .stack").length) {
            return;
        }
        dismissActivityFlyouts();
    });

    $(document).on("keydown.activityFlyout", function(ev) {
        if (ev.key === "Escape") {
            dismissActivityFlyouts();
        }
    });

    $(window).on("scroll.activityFlyout resize.activityFlyout", function() {
        refreshActivityFlyoutAnchors();
    });
}

function stackTraceText(row) {
    return JMX.util.jmxFieldText(row && row.stack);
}

function stackTraceTitle(row) {
    return JMX.util.jmxFieldText(row && row.owner) || "Stack trace";
}

function initActivityRow(node, data) {
    if (data) {
        addKillBtn(node, data);
        applyActivityRowFlyoutKeys(node, data);
    }
    $(node).find(".source-key").each(function() {
        var $el = $(this);
        if ($el.data("bs.tooltip")) {
            $el.tooltip("destroy");
        }
        $el.tooltip({ container: "body", trigger: "hover" });
    });
    refreshActivityFlyoutAnchors();
}

var JMX_KPI_THRESHOLDS = {
    runningQueries: { warn: 3, critical: 10 },
    waitingThreads: { warn: 5, critical: 30 },
    activeBrokers: { warnRatio: 0.75, criticalRatio: 0.9 }
};

function jmxValue(value) {
    if (value && typeof ko !== "undefined" && ko.isObservable(value)) {
        return value();
    }
    return value;
}

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
    if (!jmx || !jmx.ProcessReport || !jmx.ProcessReport.RecentQueryHistory) {
        return 0;
    }
    var recent = jmx.ProcessReport.RecentQueryHistory;
    return (ko.isObservable(recent) ? recent() : recent).length || 0;
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

function createVectorViewModel(data) {
    var payload = data || { available: false, models: [], ready: 0, total: 0 };
    return {
        available: ko.observable(!!payload.available),
        models: ko.observableArray(payload.models || []),
        ready: ko.observable(payload.ready || 0),
        total: ko.observable(payload.total || 0)
    };
}

function updateVectorDiagnostics(model, data) {
    if (!model) {
        return;
    }
    var payload = data || { available: false, models: [], ready: 0, total: 0 };
    if (!model.vector) {
        model.vector = createVectorViewModel(payload);
        return;
    }
    model.vector.available(!!payload.available);
    model.vector.ready(payload.ready || 0);
    model.vector.total(payload.total || 0);
    model.vector.models(payload.models || []);
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

function uptime(data) {
    var uptime = parseInt(data);
    var cd = 24 * 60 * 60 * 1000,
        ch = 60 * 60 * 1000,
        d = Math.floor(uptime / cd),
        h = '0' + Math.floor( (uptime - d * cd) / ch),
        m = '0' + Math.round( (uptime - d * cd - h * ch) / 60000);
    if (d > 0) {
        status = d + "d " + h.substr(-2) + "h";
    } else {
        status = h.substr(-2) + "h " + m.substr(-2) + "m";
    }
    return status;
}

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
        var num = parseInt(value, 10) || 0;
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
        var skip = Math.min(CHART_PLOT_SKIP, len - 1);
        return this.datasets.map(function(series) {
            return $.extend({}, series, {
                data: skip > 0 ? series.data.slice(skip) : series.data.slice()
            });
        });
    };

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
            this.chart.options.scales.y.max = yMax;
            this.chart.update("none");
            return;
        }
        var options = MonexCharts.liveChartOptions(this.showLegend);
        options.scales.y.max = yMax;
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

JMX.connection = (function() {
    "use strict";

    var JMX_NS = "http://exist-db.org/jmx";

    var version = 0;

    var viewModel = null;

    var instanceMap = {};

    var currentInstance;

    var onUpdateCb;
    var poll = true;
    var pollPeriod = 1000;
    var lastLiveRunningQueryCount = 0;

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
            connection.send('{ "channel": "' + channel + '" }');
        };

        // Log messages from the server
        connection.onmessage = function (e) {
            if (e.data == "ping") {
                return;
            }

            var data = JSON.parse(e.data);
            console.log("ping received for %s: %s", data.instance, data.status);

            callback(data);
        };
    }

    return {
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
            if (!poll) {
                return;
            }
            var url;
            var name = currentInstance.name();
            if (name == "localhost") {
                url = location.pathname.replace(/^(.*?)\/(apps\/)?monex\/.*$/, "$1") +
                    "/status?c=instances&c=processes&c=locking&c=memory&c=caches&c=system&c=operatingsystem&token=" + currentInstance.token;
            } else {
                url = "modules/remote.xql?name=" + name;
            }

            $.ajax({
                url: url,
                type: "GET",
                timeout: 10000,
                success: function(xml) {
                    $("#connection-alert").hide(400);
                    var data = JMX.util.fixjs(JMX.util.jmx2js(xml));
                    if (data) {
                        if (!data.jmx.version) {
                            data.jmx.version = 0;
                        }
                        currentInstance.version = data.jmx.version;
                        // console.dir(data);
                        var rootDom = document.getElementById("dashboard");
                        if (rootDom) {
                            if (!viewModel) {
                                viewModel = ko.mapping.fromJS(data);
                                viewModel.vector = createVectorViewModel(null);
                                viewModel.gc = function() {
                                    JMX.connection.invoke("gc", "java.lang:type=Memory");
                                };
                                viewModel.showAllCaches = ko.observable(false);
                                viewModel.expandAllCaches = function() {
                                    viewModel.showAllCaches(true);
                                };
                                JMX.util.initActivityPanelSettings(data.jmx.ProcessReport);
                                if (name == "localhost") {
                                    viewModel.url = "";
                                } else {
                                    viewModel.url = currentInstance.url().replace(/\/exist\/?$/, "");
                                }
                                ko.applyBindings(viewModel, rootDom);
                                if (name === "localhost") {
                                    $.ajax({
                                        url: "modules/vector.xql",
                                        type: "GET",
                                        dataType: "json",
                                        timeout: 10000,
                                        success: function(vectorData) {
                                            updateVectorDiagnostics(viewModel, vectorData);
                                        },
                                        error: function(xhr, status, error) {
                                            console.warn("vector diagnostics poll failed:", status, error);
                                        }
                                    });
                                }
                            } else {
                                cleanupActivityOverlays();
                                ko.mapping.fromJS(data, viewModel);
                            }
                            var liveRunning = runningQueryCount(data.jmx);
                            if (liveRunning > lastLiveRunningQueryCount) {
                                revealRunningQueries(liveRunning);
                            }
                            lastLiveRunningQueryCount = liveRunning;
                        }
                        if (onUpdate) {
                            onUpdate(data);
                        }
                        if (viewModel && name === "localhost") {
                            $.ajax({
                                url: "modules/vector.xql",
                                type: "GET",
                                dataType: "json",
                                timeout: 10000,
                                success: function(vectorData) {
                                    updateVectorDiagnostics(viewModel, vectorData);
                                },
                                error: function(xhr, status, error) {
                                    console.warn("vector diagnostics poll failed:", status, error);
                                }
                            });
                        }
                        setTimeout(function() { JMX.connection.poll(onUpdate); }, pollPeriod);
                    } else {
                        $("#connection-alert").show(400).find(".message").text("No response from server. Retrying ...");
                        setTimeout(function() { JMX.connection.poll(onUpdate); }, 5000);
                    }
                },
                error: function(xhr, status, error) {
                    $("#connection-alert").show(400).find(".message")
                        .text("Connection to server failed. Retrying ...");
                    setTimeout(JMX.connection.poll, 5000);
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
            var viewModel = new Instances(instances, schedulerActive);
            var domRoot = document.getElementById("remotes");
            if (domRoot) {
                ko.applyBindings(viewModel, domRoot);
            }
            ko.applyBindings(viewModel, $("#notifications")[0]);

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

$(function() {
    initActivityFlyouts();
    JMX.connection.init(JMX_INSTANCES, JMX_ACTIVE);

    // the following block should only be run on the main dashboard page
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
        $("#pause-btn").on("click", function(ev) {
            JMX.connection.togglePolling();
        });
        JMX.connection.poll(function(data) {
            initCharts();
            for (var i = 0; i < charts.length; i++) {
                charts[i].update(data);
            }
        });
        $("#dashboard").on("expanded.boxwidget", ".box", function() {
            redrawCharts();
        });
        $(window).on("resize.dashboardCharts", function() {
            redrawCharts();
        });
    });

    // for (var server in JMX_INSTANCES) {
    //     JMX.connection.ping(JMX_INSTANCES[server]);
    // }
});
