
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
        $.ajax({
            url: "modules/admin.xql",
            data: { action: "kill", id: data.id() },
            type: "POST"
        });
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

$(function() {
    "use strict";
    
    var JMX_NS = "http://exist-db.org/jmx";
    var memUsed = [];
    var memCommitted = [];
    var dataset = [
        { label: "Used Memory", data: memUsed },
        { label: "Commited Memory", data: memCommitted }
    ];
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
    
    function jmx2js(node) {
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
                    parent.push(jmx2js(child));
                } else {
                    var existing = parent[child.localName];
                    if (existing) {
                        if (!(existing instanceof Array)) {
                            existing = parent[child.localName] = [ existing ];
                        }
                        existing.push(jmx2js(child));
                    } else {
                        parent[child.localName] = jmx2js(child);
                    }
                }
            } else if (node.childNodes.length == 1) {
                return child.nodeValue;
            }
            child = child.nextSibling;
        }
        return parent;
    }
    
    function fixjs(data) {
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
    
    function ping(instance) {
        
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
                var data = jmx2js(xml);
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
                setTimeout(function() { ping(instance); }, 60000);
            },
            error: function(xhr, status, errorThrown) {
                updateStatus("danger", status, "", "");
                setTimeout(function() { ping(instance); }, 60000);
            }
        });
    }

    var viewModel = null;
    
    function loadJMX() {
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
                var data = fixjs(jmx2js(xml));
                if (data) {
                    //console.dir(data);
                    if (!viewModel) {
                        viewModel = ko.mapping.fromJS(data);
                        ko.applyBindings(viewModel, $("#dashboard")[0]);
                    } else {
                        ko.mapping.fromJS(data, viewModel);
                    }
                    
                    var max = parseInt(data.jmx.MemoryImpl.HeapMemoryUsage.max);
                    var used = parseInt(data.jmx.MemoryImpl.HeapMemoryUsage.used);
                    var committed = parseInt(data.jmx.MemoryImpl.HeapMemoryUsage.committed);
                    options.yaxis.max = max;
                    
                    if (memUsed.length > 100) {
                        memUsed.shift();
                        memCommitted.shift();
                    }
                    var now = new Date().getTime();
                    memUsed.push([now, used]);
                    memCommitted.push([now, committed]);
                    
                    $.plot("#memory-graph", dataset, options);
                    
                    setTimeout(loadJMX, 1000);
                } else {
                    $("#connection-alert").show(400);
                    setTimeout(loadJMX, 5000);
                }
            },
            error: function(xhr, status, error) {
                $("#connection-alert").show(400);
                setTimeout(loadJMX, 5000);
            }
        });
    }
    
    $("#dashboard").each(function() {
        loadJMX();
    });
    
    for (var server in JMX_INSTANCES) {
        ping(JMX_INSTANCES[server]);
    }
});