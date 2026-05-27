/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
var MonexCharts = (function() {
    "use strict";

    var SERIES_COLORS = [
        { border: "rgb(60, 141, 188)", fill: "rgba(60, 141, 188, 0.25)" },
        { border: "rgb(243, 156, 18)", fill: "rgba(243, 156, 18, 0.25)" },
        { border: "rgb(0, 192, 239)", fill: "rgba(0, 192, 239, 0.25)" },
        { border: "rgb(221, 75, 57)", fill: "rgba(221, 75, 57, 0.25)" }
    ];

    function ensureCanvas(container) {
        var $container = container.jquery ? container : $(container);
        var existing = $container.find("canvas")[0];
        if (existing) {
            return existing;
        }
        var el = $container[0];
        if (el.tagName === "CANVAS") {
            return el;
        }
        var canvas = document.createElement("canvas");
        canvas.setAttribute("role", "img");
        $container.empty().append(canvas);
        return canvas;
    }

    function colorForIndex(index) {
        return SERIES_COLORS[index % SERIES_COLORS.length];
    }

    function flotDatasetToChartJs(flotDataset) {
        var datasets = [];
        for (var i = 0; i < flotDataset.length; i++) {
            var series = flotDataset[i];
            if (series.lines && series.lines.show === false) {
                continue;
            }
            var colors = colorForIndex(datasets.length);
            var points = [];
            for (var j = 0; j < series.data.length; j++) {
                var pt = series.data[j];
                points.push({ x: pt[0], y: pt[1] });
            }
            datasets.push({
                label: series.label,
                data: points,
                borderColor: colors.border,
                backgroundColor: colors.fill,
                borderWidth: 1.2,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: true,
                tension: 0.1
            });
        }
        return { datasets: datasets };
    }

    function formatLiveTimeTick(value) {
        var date = new Date(value);
        if (date.getSeconds() % 20 !== 0) {
            return "";
        }
        var hours = date.getHours();
        var minutes = date.getMinutes();
        var seconds = date.getSeconds();
        return (hours < 10 ? "0" : "") + hours + ":" +
            (minutes < 10 ? "0" : "") + minutes + ":" +
            (seconds < 10 ? "0" : "") + seconds;
    }

    function liveChartOptions(showLegend) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: {
                mode: "nearest",
                intersect: false
            },
            plugins: {
                legend: {
                    display: showLegend !== false
                }
            },
            scales: {
                x: {
                    type: "time",
                    time: {
                        unit: "second",
                        tooltipFormat: "HH:mm:ss"
                    },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: false,
                        callback: formatLiveTimeTick
                    },
                    title: {
                        display: true,
                        text: "Time"
                    }
                },
                y: {
                    min: 0,
                    beginAtZero: true
                }
            }
        };
    }

    function semicircleGaugeOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            rotation: -90,
            circumference: 180,
            cutout: "72%",
            animation: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            }
        };
    }

    function timelineChartOptions(onPointClick) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: {
                mode: "nearest",
                axis: "x",
                intersect: false
            },
            plugins: {
                legend: {
                    display: true
                },
                tooltip: {
                    mode: "nearest",
                    intersect: false,
                    callbacks: {
                        title: function(items) {
                            if (!items.length) {
                                return "";
                            }
                            return new Date(items[0].parsed.x).toLocaleString();
                        }
                    }
                },
                zoom: {
                    zoom: {
                        wheel: { enabled: false },
                        drag: {
                            enabled: true,
                            backgroundColor: "rgba(225,225,225,0.3)",
                            borderColor: "rgba(225,225,225,1)",
                            borderWidth: 1
                        },
                        mode: "x"
                    }
                }
            },
            onClick: function(evt, elements) {
                if (elements.length && onPointClick) {
                    var el = elements[0];
                    var point = this.data.datasets[el.datasetIndex].data[el.index];
                    onPointClick(point.x);
                }
            },
            scales: {
                x: {
                    type: "time",
                    time: {
                        tooltipFormat: "YYYY/MM/DD HH:mm:ss"
                    },
                    ticks: {
                        maxRotation: 0,
                        maxTicksLimit: 10
                    },
                    title: {
                        display: true,
                        text: "Time"
                    }
                },
                y: {
                    beginAtZero: true,
                    grace: "10%"
                }
            }
        };
    }

    return {
        ensureCanvas: ensureCanvas,
        colorForIndex: colorForIndex,
        flotDatasetToChartJs: flotDatasetToChartJs,
        liveChartOptions: liveChartOptions,
        semicircleGaugeOptions: semicircleGaugeOptions,
        timelineChartOptions: timelineChartOptions
    };
}());
