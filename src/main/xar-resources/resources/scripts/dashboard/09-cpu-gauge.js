/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
Monex.cpuGauge = (function() {
    "use strict";

    var PROCESS_COLOR = "rgb(60, 141, 188)";
    var SYSTEM_COLOR = "rgb(243, 156, 18)";
    var TRACK_COLOR = "#eceff3";
    var gauges = [];

    function gaugePercent(jmx, key) {
        var ratio = key === "process" ?
            Monex.kpi.processCpuLoad(jmx) :
            Monex.kpi.systemCpuLoad(jmx);
        return Math.min(100, Math.max(0, ratio * 100));
    }

    function createGauge(container, color, key) {
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
            key: key
        };
    }

    function init() {
        if (gauges.length > 0) {
            return;
        }
        var processNode = document.getElementById("cpu-process-gauge");
        var systemNode = document.getElementById("cpu-system-gauge");
        if (!processNode || !systemNode) {
            return;
        }
        gauges.push(createGauge(processNode, PROCESS_COLOR, "process"));
        gauges.push(createGauge(systemNode, SYSTEM_COLOR, "system"));
    }

    function update(jmx) {
        init();
        for (var i = 0; i < gauges.length; i++) {
            var pct = gaugePercent(jmx, gauges[i].key);
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
