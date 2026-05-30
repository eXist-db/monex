/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
(function($) {
    $.TimelineOptions = function() {
        return {};
    };

    $.TimelineSetup = function(container, dataset) {
        var $container = $(container);
        var existing = $container.data("chart");
        if (existing) {
            existing.destroy();
        }
        var canvas = MonexCharts.ensureCanvas($container);
        var chartData = MonexCharts.flotDatasetToChartJs(dataset);
        var chart = new Chart(canvas, {
            type: "line",
            data: chartData,
            options: MonexCharts.timelineChartOptions(function(timestamp) {
                window.open("details.html?timestamp=" + timestamp + "&instance=" + JMX_INSTANCE, "_blank");
            })
        });
        $container.data("chart", chart);
        $.TimelineFunctions(chart, $container);
    };

    $.TimelineFunctions = function(chart, container) {
        container.parent().parent().find(".zoom-out").off("click.monexChart").on("click.monexChart", function(ev) {
            ev.preventDefault();
            chart.resetZoom();
        });
    };

    var methods = {
        init: function() {
            this.each(function() {
                var container = $(this);
                var data = container.data("data");
                $.TimelineSetup(container, data);
            });
        }
    };

    $.fn.timeline = function(method) {
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === "object" || !method) {
            return methods.init.apply(this, arguments);
        } else {
            alert('Method "' + method + '" not found!');
        }
    };
})(jQuery);
