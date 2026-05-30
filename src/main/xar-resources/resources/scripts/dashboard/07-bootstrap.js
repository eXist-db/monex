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
