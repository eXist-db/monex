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

function cacheManagerPercent(current, max) {
    var used = parseInt(current, 10) || 0;
    var total = parseInt(max, 10) || 0;
    if (total <= 0) {
        return 0;
    }
    return Math.round(used / (total / 100));
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

function waitingThreadCount(jmx) {
    if (!jmx) {
        return 0;
    }
    if (jmx.LockManager && jmx.LockManager.WaitingThreads) {
        var waiting = jmx.LockManager.WaitingThreads;
        return (ko.isObservable(waiting) ? waiting() : waiting).length || 0;
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
    if (!jmx || !jmx.ProcessReport || !jmx.ProcessReport.RunningQueries) {
        return 0;
    }
    var queries = jmx.ProcessReport.RunningQueries;
    return (ko.isObservable(queries) ? queries() : queries).length || 0;
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
    $(node).find(".kill-query").on("click", function(ev) {
        ev.preventDefault();
        if (JMX_INSTANCE.version === 0) {
            $.ajax({
                url: "modules/admin.xql",
                data: { action: "kill", id: data.id() },
                type: "POST"
            });
        } else {
            JMX.connection.invoke("killQuery", "org.exist.management.exist:type=ProcessReport", [data.id()]);
        }
    });
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
    var options = {
        series: {
            lines: {
                show: true,
                lineWidth: 1.2,
                fill: true
            }
        },
        xaxis: {
            mode: "time",
            show: true,
            tickSize: [2, "second"],
            tickFormatter: function (v, axis) {
                var date = new Date(v);

                if (date.getSeconds() % 20 == 0) {
                    var hours = date.getHours() < 10 ? "0" + date.getHours() : date.getHours();
                    var minutes = date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes();
                    var seconds = date.getSeconds() < 10 ? "0" + date.getSeconds() : date.getSeconds();

                    return hours + ":" + minutes + ":" + seconds;
                } else {
                    return "";
                }
            },
            axisLabel: "Time",
            axisLabelUseCanvas: false,
            axisLabelFontSizePixels: 12,
            axisLabelFontFamily: 'Verdana, Arial',
            axisLabelPadding: 10
        },
        yaxis: {
            min: 0,
            max: 100,
            axisLabelUseCanvas: true,
            axisLabelFontSizePixels: 12,
            axisLabelFontFamily: 'Verdana, Arial',
            axisLabelPadding: 6
        },
        legend: {
            show: true,
            labelBoxBorderColor: "#fff"
        }
    };

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

    function seriesPeak(dataset) {
        var peak = 0;
        for (var i = 0; i < dataset.length; i++) {
            var points = dataset[i].data;
            for (var j = 0; j < points.length; j++) {
                if (points[j][1] > peak) {
                    peak = points[j][1];
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
        this.properties = properties;
        this.propertyMaxY = propertyMaxY;
        this.unitY = unitY || "";
        this.scaleMode = container.attr("data-scale") || "fixed";
        this.dataset = [];
        for (var i = 0; i < labels.length; i++) {
            this.dataset.push({
                label: labels[i],
                data: []
            });
        }
    };

    Constr.prototype.update = function(data) {
        var heapCap = numericValue(getProperty(data, this.propertyMaxY), this.unitY);
        if (this.dataset[0].data.length > 100) {
            for (var i = 0; i < this.dataset.length; i++) {
                this.dataset[i].data.shift();
            }
        }
        var now = new Date().getTime();
        for (var i = 0; i < this.properties.length; i++) {
            var val = numericValue(getProperty(data, this.properties[i]), this.unitY);
            this.dataset[i].data.push([now, val]);
        }

        var peak = seriesPeak(this.dataset);
        options.yaxis.max = computeYMax(this.scaleMode, this.unitY, heapCap, peak);

        $.plot(this.container, this.dataset, options);
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
        invoke: function(operation, mbean, args) {
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
                error: function(xhr, status, error) {
                    $("#connection-alert").show(400).find(".message")
                        .text("Operation '" + operation + "' failed or is not supported on this server instance.");
                    setTimeout(function() { $("#connection-alert").hide(200); }, 3000);
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
                                if (data.jmx.ProcessReport.TrackRequestURI) {
                                    $("#threshold").val(data.jmx.ProcessReport.MinTime);
                                    $("#track-uri").prop("checked", data.jmx.ProcessReport.TrackRequestURI == "true");
                                    $("#history-timespan").val(data.jmx.ProcessReport.HistoryTimespan);
                                } else {
                                    $("#configure-history").hide();
                                }
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
                                ko.mapping.fromJS(data, viewModel);
                            }
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
    JMX.connection.init(JMX_INSTANCES, JMX_ACTIVE);

    $("#configure").on("click", function(ev) {
        ev.preventDefault();
        var threshold = $("#threshold").val();
        var historyTimespan = $("#history-timespan").val();
        var trackURI = $("#track-uri").is(":checked");
        JMX.connection.invoke("configure", "org.exist.management.exist:type=ProcessReport", [threshold, historyTimespan, trackURI]);
    });
    // the following block should only be run on the main dashboard page
    $("#dashboard").each(function() {
        var charts = [];
        $(".chart").each(function() {
            var node = $(this);
            var labels = node.attr("data-labels");
            var properties = node.attr("data-properties");
            var unitY = node.attr("data-unit-y") || "";
            var max = node.attr("data-max-y");

            charts.push(new JMX.TimeSeries(node, labels.split(","), properties.split(","), max, unitY));
        });
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
            for (var i = 0; i < charts.length; i++) {
                charts[i].update(data);
            }
            $(".stack").popover({
                placement: "auto right",
                html: true,
                container: "#dashboard",
                trigger: "focus",
                template: '<div class="popover stacktrace" role="tooltip"><div class="arrow"></div><h3 class="popover-title"></h3><pre class="popover-content"></pre></div>'
            });
        });
    });

    // for (var server in JMX_INSTANCES) {
    //     JMX.connection.ping(JMX_INSTANCES[server]);
    // }
});
