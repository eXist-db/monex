/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
JMX.connection = (function() {
    "use strict";

    var viewModel = null;
    var instanceMap = {};
    var currentInstance;
    var onUpdateCb;
    var poll = true;
    var pollPeriod = 1000;
    var lastLiveRunningQueryCount = 0;
    var visibilityListenerAttached = false;

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

    function effectivePollDelay() {
        if (typeof document !== "undefined" && document.hidden) {
            return Math.max(pollPeriod, Monex.activity.HIDDEN_POLL_BACKOFF_MS);
        }
        return pollPeriod;
    }

    function updatePollStatus(viewModelRef, startedAt, finishedAt) {
        if (!viewModelRef || !viewModelRef.pollLastLabel) {
            return;
        }
        var latency = Math.max(0, Math.round(finishedAt - startedAt));
        var stamp = new Date(finishedAt).toLocaleTimeString();
        viewModelRef.pollLastLabel(stamp + " · " + latency + "ms");
        if (viewModelRef.pollTabIdle) {
            viewModelRef.pollTabIdle(document.hidden);
        }
    }

    function ensureVisibilityListener() {
        if (visibilityListenerAttached || typeof document === "undefined") {
            return;
        }
        visibilityListenerAttached = true;
        document.addEventListener("visibilitychange", function() {
            if (viewModel && viewModel.pollTabIdle) {
                viewModel.pollTabIdle(document.hidden);
            }
            if (!document.hidden && poll && onUpdateCb) {
                JMX.connection.poll(onUpdateCb);
            }
        });
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

        connection.onerror = function(error) {
            $("#status").text("Connection error ...");
            console.log("WebSocket Error: %o", error);
        };

        connection.onclose = function() {
            $("#status").text("Disconnected.");
        };

        connection.onopen = function() {
            $("#status").text("Connected.");
            connection.send('{ "channel": "' + channel + '" }');
        };

        connection.onmessage = function(e) {
            if (e.data == "ping") {
                return;
            }

            var data = JSON.parse(e.data);
            console.log("ping received for %s: %s", data.instance, data.status);
            callback(data);
        };
    }

    return {
        getViewModel: function() {
            return viewModel;
        },

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
            ensureVisibilityListener();

            var url;
            var name = currentInstance.name();
            if (name == "localhost") {
                url = location.pathname.replace(/^(.*?)\/(apps\/)?monex\/.*$/, "$1") +
                    "/status?c=instances&c=processes&c=locking&c=memory&c=caches&c=system&c=operatingsystem&c=vector&token=" + currentInstance.token;
            } else {
                url = "modules/remote.xql?name=" + name;
            }

            var pollStarted = performance.now();

            $.ajax({
                url: url,
                type: "GET",
                timeout: 10000,
                success: function(xml) {
                    var pollFinished = performance.now();
                    $("#connection-alert").hide(400);
                    var data = JMX.util.fixjs(JMX.util.jmx2js(xml));
                    if (data) {
                        if (!data.jmx.version) {
                            data.jmx.version = 0;
                        }
                        currentInstance.version = data.jmx.version;
                        var rootDom = document.getElementById("dashboard");
                        if (rootDom) {
                            if (!viewModel) {
                                viewModel = ko.mapping.fromJS(data);
                                Monex.activity.attachDashboardViewModel(viewModel, { livePoll: true });
                                viewModel.vector = createVectorViewModel(null);
                                viewModel.vectorStore = Monex.vector.createVectorStoreViewModel(null);
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
                            } else {
                                Monex.activity.cleanupActivityTooltips();
                                ko.mapping.fromJS(data, viewModel);
                                if (viewModel.activityFlyout) {
                                    viewModel.activityFlyout.afterPoll();
                                }
                            }
                            Monex.vector.syncVectorFromJmx(viewModel, data.jmx);
                            updatePollStatus(viewModel, pollStarted, pollFinished);
                            var liveRunning = runningQueryCount(data.jmx);
                            if (liveRunning > lastLiveRunningQueryCount) {
                                Monex.activity.revealRunningQueries(liveRunning);
                            }
                            lastLiveRunningQueryCount = liveRunning;
                        }
                        if (onUpdate) {
                            onUpdate(data);
                        }
                        setTimeout(function() { JMX.connection.poll(onUpdate); }, effectivePollDelay());
                    } else {
                        $("#connection-alert").show(400).find(".message").text("No response from server. Retrying ...");
                        setTimeout(function() { JMX.connection.poll(onUpdate); }, 5000);
                    }
                },
                error: function() {
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
            var remotesModel = new Instances(instances, schedulerActive);
            var domRoot = document.getElementById("remotes");
            if (domRoot) {
                ko.applyBindings(remotesModel, domRoot);
            }
            ko.applyBindings(remotesModel, $("#notifications")[0]);

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
