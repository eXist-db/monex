
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

function addKillBtn(node, data) {
    $(node).find(".kill-query").click(function(ev) {
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

var JMX = {};

JMX.util = (function() {
    
    return {
        jmx2js: function (node) {
            if (!node) {
                return null;
            }
            var parent = {};
            if (node.nodeType == Node.ELEMENT_NODE) {
                for (var i = 0; i < node.attributes.length; i++) {
                    parent[node.attributes[i].localName] = node.attributes[i].nodeValue;
                }
            }
            var child = node.firstChild;
            while (child) {
                if (child.nodeType == Node.ELEMENT_NODE) {
                    if (child.localName == "row") {
                        if (!(parent instanceof Array)) {
                            parent = [];
                        }
                        parent.push(JMX.util.jmx2js(child));
                    } else {
                        var existing = parent[child.localName];
                        if (existing) {
                            if (!(existing instanceof Array)) {
                                parent[child.localName] = [ existing ];
                                existing = parent[child.localName];
                            }
                            existing.push(JMX.util.jmx2js(child));
                        } else {
                            parent[child.localName] = JMX.util.jmx2js(child);
                        }
                    }
                } else if (node.childNodes.length == 1) {
                    return child.nodeValue;
                }
                child = child.nextSibling;
            }
            return parent;
        },
        
        fixjs: function(data) {
            if (!data) {
                return null;
            }
            if (data.jmx.ProcessReport) {
                var queries = data.jmx.ProcessReport.RunningQueries;
                if (!queries.length) {
                    data.jmx.ProcessReport.RunningQueries = [];
                }
                var jobs = data.jmx.ProcessReport.RunningJobs;
                if (!jobs || !jobs.length) {
                    data.jmx.ProcessReport.RunningJobs = [];
                }
            }
            if (data.jmx.LockManager) {
                var waiting = data.jmx.LockManager.WaitingThreads;
                if (!waiting.length) {
                    data.jmx.LockManager.WaitingThreads = [];
                }
            }
            return data;
        }
    }
}());

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
            if (prop.hasOwnProperty(components[i])) {
                prop = prop[components[i]];
            } else {
                break;
            }
        }
        return prop || 0;
    };
    
    Constr = function(container, labels, properties, propertyMaxY) {
        this.container = $(container);
        this.properties = properties;
        this.propertyMaxY = propertyMaxY;
        this.dataset = [];
        for (var i = 0; i < labels.length; i++) {
            this.dataset.push({
                label: labels[i],
                data: []
            });
        }
    };
    
    Constr.prototype.update = function(data) {
        var max = parseInt(getProperty(data, this.propertyMaxY));
        options.yaxis.max = max;
        if (this.dataset[0].data.length > 100) {
            for (var i = 0; i < this.dataset[0].data.length; i++) {
                this.dataset[i].data.shift();
            }
        }
        var now = new Date().getTime();
        for (var i = 0; i < this.properties.length; i++) {
            var val = getProperty(data, this.properties[i]);
            this.dataset[i].data.push([now, parseInt(val)]);
        }
        
        $.plot(this.container, this.dataset, options);
    };
    
    return Constr;
}());

JMX.connection = (function() {
    "use strict";
    
    var JMX_NS = "http://exist-db.org/jmx";
    
    var version = 0;
    
    var viewModel = null;
    
    return {
        ping: function(instance) {
            
            function updateStatus(type, status, time, responseTime) {
                var tabrow = $("#servers tr[data-server='" + instance.name + "']");
                var statusElem = "<span class='label label-" + type + "'>" + status + "</span>";
                tabrow.find("td:nth-child(1)").html(statusElem);
                tabrow.find("td:nth-child(3)").text(time);
                tabrow.find("td:nth-child(4)").text(responseTime);
                
                var cls;
                if (type == "success") {
                    cls = "fa fa-check-circle-o success";
                } else if (type == "primary") {
                    cls = "fa fa-refresh primary";
                } else {
                    cls = "fa fa-warning danger";
                }
                var notifications = $("#notifications");
                notifications.find(".menu li[data-server='" + instance.name + "'] i").attr("class", cls);
                var warnings = notifications.find(".danger").length;
                notifications.find(".label-warning").text(warnings === 0 ? "" : warnings);
            }
            
            var url;
            var name = instance.name;
            if (name == "localhost") {
                url = location.pathname.replace(/^(.*)\/apps\/.*$/, "$1") +
                    "/status?operation=ping&token=" + instance.token;
            } else {
                url = "modules/remote.xql?operation=ping&name=" + name; 
            }
            updateStatus("primary", "Checking", "", "");
            var start = new Date().getTime();
            $.ajax({
                url: url,
                type: "GET",
                timeout: 30000,
                success: function(xml) {
                    var data = JMX.util.jmx2js(xml);
                    if (!data) {
                        updateStatus("danger", "No data", "", "");
                    } else {
                        var status = data.jmx.SanityReport.Status;
                        var time = data.jmx.SanityReport.PingTime;
                        if (status == "PING_OK") {
                            updateStatus("success", status, time, (new Date().getTime() - start));
                        } else {
                            updateStatus("danger", status, time, (new Date().getTime() - start));
                        }
                    }
                    setTimeout(function() { JMX.connection.ping(instance); }, 60000);
                },
                error: function(xhr, status, errorThrown) {
                    updateStatus("danger", status, "", "");
                    setTimeout(function() { JMX.connection.ping(instance); }, 60000);
                }
            });
        },
        
        invoke: function(operation, mbean, args) {
            var url;
            if (JMX_INSTANCE.name == "localhost") {
                url = location.pathname.replace(/^(.*)\/apps\/.*$/, "$1") +
                    "/status?operation=" + operation + "&mbean=" + mbean + "&token=" + JMX_INSTANCE.token;
            } else {
                url = "modules/remote.xql?operation=" + operation + "&mbean=" + mbean + "&name=" + name;
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
            var url;
            var name = JMX_INSTANCE.name;
            if (name == "localhost") {
                url = location.pathname.replace(/^(.*)\/apps\/.*$/, "$1") +
                    "/status?c=instances&c=processes&c=locking&c=memory&c=caches&c=system&token=" + JMX_INSTANCE.token;
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
                        JMX_INSTANCE.version = data.jmx.version;
                        // console.dir(data);
                        if (!viewModel) {
                            viewModel = ko.mapping.fromJS(data);
                            viewModel.gc = function() {
                                JMX.connection.invoke("gc", "java.lang:type=Memory");
                            };
                            ko.applyBindings(viewModel, $("#dashboard")[0]);
                        } else {
                            ko.mapping.fromJS(data, viewModel);
                        }
                        if (onUpdate) {
                            onUpdate(data);
                        }
                        setTimeout(function() { JMX.connection.poll(onUpdate); }, 1000);
                    } else {
                        $("#connection-alert").show(400).find(".message").text("No response from server. Retrying ...")
                        setTimeout(function() { JMX.connection.poll(onUpdate); }, 5000);
                    }
                },
                error: function(xhr, status, error) {
                    $("#connection-alert").show(400).find(".message")
                        .text("Connection to server failed. Retrying ...");
                    setTimeout(JMX.connection.poll, 5000);
                }
            });
        }
    };
}());

$(function() {
    
    
    $("#dashboard").each(function() {
        var charts = [];
        $(".chart").each(function() {
            var node = $(this);
            var labels = node.attr("data-labels");
            var properties = node.attr("data-properties");
            var max = node.attr("data-max-y");
            
            charts.push(new JMX.TimeSeries(node, labels.split(","), properties.split(","), max));
        });
        JMX.connection.poll(function(data) {
            for (var i = 0; i < charts.length; i++) {
                charts[i].update(data);
            }
        });
    });
    
    for (var server in JMX_INSTANCES) {
        JMX.connection.ping(JMX_INSTANCES[server]);
    }
});