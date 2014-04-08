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
    var infoProperties = ["ExistVersion", "ExistBuild", "OperatingSystem", "DefaultEncoding", "InstanceId"];
    
    function loadJMX() {
        function getText(elem, name) {
            var node = elem.getElementsByTagNameNS(JMX_NS, name);
            if (node.length > 0) {
                var content = "";
                var child = node[0].firstChild;
                while (child) {
                    if (child.nodeType == 3) {
                        content += child.nodeValue;
                    }
                    child = child.nextSibling;
                }
                return content;
            }
            return "";
        }
        
        function find(root, element, func) {
            var nodes = root.getElementsByTagNameNS(JMX_NS, element);
            if (nodes.length > 0) {
                func.apply(nodes[0]);
            }
        }
        
        function findByName(root, element, name, func) {
            var nodes = root.getElementsByTagNameNS(JMX_NS, element);
            for (var i = 0; i < nodes.length; i++) {
                if (nodes[i].getAttribute("name") === name) { 
                    func.apply(nodes[i]);
                }
            }
        }
        
        var url = location.pathname.replace(/^(.*)\/apps\/.*$/, "$1");
        $.ajax({
            url: url + "/status?c=instances&c=processes&c=locking&c=memory&c=caches&c=system",
            type: "GET",
            success: function(xml) {
                $("#jmx-system-info").each(function() {
                    var tbody = $(this).empty();
                    $(infoProperties).each(function() {
                        var tr = document.createElement("tr");
                        var td = document.createElement("td");
                        td.appendChild(document.createTextNode(this));
                        tr.appendChild(td);
                        
                        td = document.createElement("td");
                        find(xml, this, function() {
                            td.appendChild(document.createTextNode($(this).text()));
                        });
                        tr.appendChild(td);
                        
                        tbody.append(tr);
                    });
                });
                
                find(xml, "Database", function() {
                    var status = getText(this, "ActiveBrokers") + " of " +
                        getText(this, "TotalBrokers");
                    $("#jmx-brokers").text(status);
                    
                    var uptime = parseInt(getText(this, "Uptime"));
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
                    $("#jmx-uptime").text(status);
                });
                
                $(".jmx-cache").each(function() {
                    var div = $(this);
                    var key = div.attr("data-key");
                    findByName(xml, "Cache", key, function() {
                        var hits = getText(this, "Hits");
                        var fails = getText(this, "Fails");
                        var size = getText(this, "Size");
                        var used = getText(this, "Used");
                        var percent = Math.round(used / (size / 100));
                        
                        div.find(".cache-stats").text("Size: " + size + " / " + "Used: " + used + " / Fails: " + fails + " / Hits: " + hits);
                        
                        div.find(".progress-cache").css("width", percent + "%").text(percent + "%");
                    });
                });
                
                $(".jmx-cache-manager").each(function() {
                    var div = $(this);
                    var key = div.attr("data-key");
                    findByName(xml, "CacheManager", key, function() {
                        var max = getText(this, "MaxTotal");
                        var current = getText(this, "CurrentSize");
                        var percent = Math.round(current / (max / 100));
                        
                        div.find(".cache-stats").text("Max: " + max + " / Current: " + current);
                        div.find(".progress-cache").css("width", percent + "%");
                    });
                });
                
                $("#jmx-lock-manager").each(function() {
                    var table = $(this);
                    find(xml, "LockManager", function() {
                        var rows = this.getElementsByTagNameNS(JMX_NS, "row");
                        if (rows.length == 0) {
                            table.empty().append("<tr><td colspan='5'>No waiting threads</td></tr>");
                        } else {
                            $(rows).each(function() {
                                var owner = getText(this, "owner");
                                var resource = getText(this, "id");
                                var lockMode = getText(this, "lockMode");
                                var lockType = getText(this, "lockType");
                                var waitingThread = getText(this, "waitingThread");
                                
                                var tr = document.createElement("tr");
                                var td = document.createElement("td");
                                td.appendChild(document.createTextNode(waitingThread));
                                tr.appendChild(td);
                                
                                td = document.createElement("td");
                                td.appendChild(document.createTextNode(owner));
                                tr.appendChild(td);
                                
                                td = document.createElement("td");
                                td.appendChild(document.createTextNode(resource));
                                tr.appendChild(td);
                                
                                td = document.createElement("td");
                                td.appendChild(document.createTextNode(lockMode));
                                tr.appendChild(td);
                                
                                td = document.createElement("td");
                                td.appendChild(document.createTextNode(lockType));
                                tr.appendChild(td);
                                
                                table.html(tr);
                            });
                        }
                    });
                });
                find(xml, "RunningQueries", function() {
                    var running = this.getElementsByTagNameNS(JMX_NS, "row");
                    $("#jmx-queries").text(running.length);
                    
                    var tableBody = $("#jmx-running-queries");
                    tableBody.empty();
                    
                    if (running.length == 0) {
                        tableBody.append("<tr><td colspan='5'>No running queries</td></tr>");
                    } else {
                        $(running).each(function() {
                            var id = getText(this, "id");
                            var source = getText(this, "sourceKey");
                            var type = getText(this, "sourceType");
                            var status = getText(this, "terminating");
                            status = (status == "true" ? "terminating" : "running");
                            
                            var tr = document.createElement("tr");
                            var td = document.createElement("td");
                            td.appendChild(document.createTextNode(id));
                            tr.appendChild(td);
                            
                            td = document.createElement("td");
                            var resource = source.replace(/^.*\/([^\/]+)$/, "$1");
                            var span = document.createElement("span");
                            span.setAttribute("data-toggle", "tooltip");
                            span.title = source;
                            span.appendChild(document.createTextNode(resource));
                            td.appendChild(span);
                            tr.appendChild(td);
                            $(span).tooltip();
            
                            td = document.createElement("td");
                            td.appendChild(document.createTextNode(type));
                            tr.appendChild(td);
                            td = document.createElement("td");
                            span = document.createElement("span");
                            span.className = "label label-" + (status == "running" ? "success" : "warning");
                            
                            span.appendChild(document.createTextNode(status));
                            td.appendChild(span);
                            tr.appendChild(td);
                            
                            var button = document.createElement("a");
                            button.href = "#";
                            button.title = "Terminate";
                            var icon = document.createElement("span");
                            icon.className = "glyphicon glyphicon-remove";
                            button.appendChild(icon);
                            td = document.createElement("td");
                            td.appendChild(button);
                            tr.appendChild(td);
                            
                            $(button).click(function(ev) {
                                ev.preventDefault();
                                $.ajax({
                                    url: "modules/admin.xql",
                                    data: { action: "kill", id: id },
                                    type: "POST"
                                });
                            });
                            tableBody.append(tr);
                        });
                    }
                });
                find(xml, "RecentQueryHistory", function() {
                    var running = this.getElementsByTagNameNS(JMX_NS, "row");
                    
                    var tableBody = $("#jmx-recent-queries");
                    tableBody.empty();
                    
                    if (running.length == 0) {
                        tableBody.append("<tr><td colspan='5'>No recent queries</td></tr>");
                    } else {
                        $(running).each(function() {
                            var time = getText(this, "mostRecentExecutionTime");
                            var date = new Date(parseInt(time));
                            var source = getText(this, "sourceKey");
                            var duration = getText(this, "mostRecentExecutionDuration");
                            
                            var tr = document.createElement("tr");
                            var td = document.createElement("td");
                            td.appendChild(document.createTextNode(date));
                            tr.appendChild(td);
                            
                            td = document.createElement("td");
                            var resource = source.replace(/^.*\/([^\/]+)$/, "$1");
                            var span = document.createElement("span");
                            span.setAttribute("data-toggle", "tooltip");
                            span.title = source;
                            span.appendChild(document.createTextNode(resource));
                            td.appendChild(span);
                            tr.appendChild(td);
                            $(span).tooltip();
            
                            td = document.createElement("td");
                            td.appendChild(document.createTextNode(duration));
                            tr.appendChild(td);
                            
                            tableBody.append(tr);
                        });
                    }
                });
                var waiting = 0;
                find(xml, "WaitingThreads", function() {
                    find(this, "row", function() {
                        waiting = this.length;
                    });
                });

                $("#jmx-waiting").text(waiting);
                
                find(xml, "HeapMemoryUsage", function() {
                    var used = Math.floor(parseInt(getText(this, "used")) / 1024 / 1024);
                    var committed = Math.floor(parseInt(getText(this, "committed")) / 1024 / 1024);
                    var max = Math.floor(parseInt(getText(this, "max")) / 1024 / 1024);
                    $("#jmx-memory-used").text(used + "/" + max + " M");
                    $("#jmx-memory-committed").text(committed + "/" + max + " M");
                    
                    $("#progress-memory-used").width(Math.round(used / (max / 100)) + "%");
                    $("#progress-memory-committed").width(Math.round(committed / (max / 100)) + "%");
                    
                    options.yaxis.max = max;
                    
                    if (memUsed.length > 100) {
                        memUsed.shift();
                        memCommitted.shift();
                    }
                    var now = new Date().getTime();
                    memUsed.push([now, used]);
                    memCommitted.push([now, committed]);
                    
                    $.plot("#memory-graph", dataset, options);
                });
                
                // $(xml).find("Database").each(function() {
                //     var db = $(this);
                //     var tableBody = $("#jmx-active-threads");
                //     tableBody.empty();
                    
                //     db.find("ActiveBrokersMap").find("row").each(function() {
                //         var owner = $(this).find("owner").text();
                //         var dump = $(this).find("stack").text();
                //         var tr = document.createElement("tr");
                //         var td = document.createElement("td");
                //         td.appendChild(document.createTextNode(owner));
                //         tr.appendChild(td);
                //         td = document.createElement("td");
                //         td.appendChild(document.createTextNode(dump));
                //         tr.appendChild(td);
                        
                //         tableBody.append(tr);
                //     });
                // });
                setTimeout(loadJMX, 1000);
            }
        });
    }
    
    loadJMX();
});