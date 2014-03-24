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
        
        function find(root, name, func) {
            var nodes = root.getElementsByTagNameNS(JMX_NS, name);
            if (nodes.length > 0) {
                func.apply(nodes[0]);
            }
        }
        
        var url = location.pathname.replace(/^(.*)\/apps\/.*$/, "$1");
        $.ajax({
            url: url + "/status?c=instances&c=processes&c=locking&c=memory",
            type: "GET",
            success: function(xml) {
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
                            td.appendChild(document.createTextNode(source));
                            tr.appendChild(td);
                            td = document.createElement("td");
                            td.appendChild(document.createTextNode(type));
                            tr.appendChild(td);
                            td = document.createElement("td");
                            td.appendChild(document.createTextNode(status));
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