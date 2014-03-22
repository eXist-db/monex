$(function() {
    "use strict";
    
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
        $.ajax({
            url: "/exist/status?c=instances&c=processes&c=locking&c=memory",
            type: "GET",
            success: function(xml) {
                $(xml).find("Database").each(function() {
                    var db = $(this);
                    var status = db.find("ActiveBrokers").text() + " of " +
                        db.find("TotalBrokers").text();
                    $("#jmx-brokers").text(status);
                    
                    var uptime = parseInt(db.find("Uptime").text());
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
                $(xml).find("RunningQueries").each(function() {
                    var running = $(this).find("row").length;
                    $("#jmx-queries").text(running);
                });
                var threads = $(xml).find("WaitingThreads");
                var waiting = 0;
                if (threads && threads.length > 0) {
                    var running = threads.find("row");
                    if (running) {
                        waiting = running.length;
                    }
                }
                $("#jmx-waiting").text(waiting);
                
                $(xml).find("HeapMemoryUsage").each(function() {
                    var mem = $(this);
                    var used = Math.floor(parseInt(mem.find("used").text()) / 1024 / 1024);
                    var committed = Math.floor(parseInt(mem.find("committed").text()) / 1024 / 1024);
                    var max = Math.floor(parseInt(mem.find("max").text()) / 1024 / 1024);
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
                
                $(xml).find("Database").each(function() {
                    var db = $(this);
                    var tableBody = $("#jmx-active-threads");
                    tableBody.empty();
                    
                    db.find("ActiveBrokersMap").find("row").each(function() {
                        var owner = $(this).find("owner").text();
                        var dump = $(this).find("stack").text();
                        var tr = document.createElement("tr");
                        var td = document.createElement("td");
                        td.appendChild(document.createTextNode(owner));
                        tr.appendChild(td);
                        td = document.createElement("td");
                        td.appendChild(document.createTextNode(dump));
                        tr.appendChild(td);
                        
                        tableBody.append(tr);
                    });
                });
                setTimeout(loadJMX, 1000);
            }
        });
    }
    
    loadJMX();
});