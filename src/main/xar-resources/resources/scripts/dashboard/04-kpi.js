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

function brokerPoolPercent(jmx) {
    var active = activeBrokerCount(jmx);
    var max = maxBrokerCount(jmx);
    if (max <= 0) {
        return 0;
    }
    return Math.round(active / (max / 100));
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

function vectorEmbeddingsKpiClass(vector) {
    if (!vector || !vector.available || !vector.available()) {
        return {};
    }
    var ready = vector.ready();
    var total = vector.total();
    if (total > 0 && ready === 0) {
        return { "kpi-critical": true };
    }
    if (total > 0 && ready < total) {
        return { "kpi-warn": true };
    }
    return {};
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
    brokerPoolPercent: brokerPoolPercent,
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
    readyVectorModels: readyVectorModels,
    vectorMissingCount: vectorMissingCount,
    vectorModelLabel: vectorModelLabel,
    vectorStatusClass: vectorStatusClass,
    vectorEmbeddingsKpiVisible: vectorEmbeddingsKpiVisible,
    vectorEmbeddingsKpiText: vectorEmbeddingsKpiText,
    vectorEmbeddingsKpiClass: vectorEmbeddingsKpiClass,
    vectorEntriesKpiVisible: vectorEntriesKpiVisible,
    vectorEntriesKpiText: vectorEntriesKpiText,
    createVectorViewModel: createVectorViewModel,
    updateVectorDiagnostics: updateVectorDiagnostics,
    uptime: uptime
};
