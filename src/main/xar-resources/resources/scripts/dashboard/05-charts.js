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
