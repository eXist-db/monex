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
