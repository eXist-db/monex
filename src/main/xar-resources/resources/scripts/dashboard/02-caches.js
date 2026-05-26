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

function cacheShowHitRate(hits, fails) {
    var h = parseInt(hits, 10) || 0;
    var f = parseInt(fails, 10) || 0;
    if (h + f === 0) {
        return false;
    }
    return (h / (h + f)) < 0.95;
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
    cacheShowHitRate: cacheShowHitRate
};
