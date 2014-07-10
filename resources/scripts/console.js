var RemoteConsole = (function() {
    
    var connection;
    var bufferSize = 50;
    var currentChannel = "default";
    
    return {
        connect: function() {
            var url = "ws://" + location.host + "/exist/rconsole";
            connection = new WebSocket(url);
        
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
                connection.send('{ "channel": "' + currentChannel + '" }');
            };
            
            // Log messages from the server
            connection.onmessage = function (e) {
                if (e.data == "ping") {
                    return;
                }
                
                $(".note").hide(300);
                
                var data = JSON.parse(e.data);
        
                var oldLines = $("#console tr");
                if (oldLines.length >= bufferSize) {
                    oldLines.get(0).remove();
                }
                
                var time = data.timestamp.replace(/^.*T([^\+]+).*$/, "$1");
                var tr = document.createElement("tr");
                tr.style.display = "none";
                tr.className = "message";
                var td = document.createElement("td");
                td.appendChild(document.createTextNode(time));
                tr.appendChild(td);
                
                td = document.createElement("td");
                if (data.source) {
                    var source = data.source.replace(/^.*\/([^\/]+)$/, "$1");
                    var span = document.createElement("span");
                    span.setAttribute("data-toggle", "tooltip");
                    span.title = data.source;
                    span.appendChild(document.createTextNode(source));
                    td.appendChild(span);
                    $(span).tooltip();
                } else {
                    td.appendChild(document.createTextNode("unknown"));
                }
                tr.appendChild(td);
                
                td = document.createElement("td");
                if (data.line) {
                    td.appendChild(document.createTextNode(data.line + " / " + data.column));
                } else {
                    td.appendChild(document.createTextNode("- / -"));
                }
                tr.appendChild(td);
                
                td = document.createElement("td");
                td.className = "message";
                td.appendChild(document.createTextNode(data.message));
                tr.appendChild(td);
                
                $("#console").append(tr);
                
                $(tr).show(200, function() {
                    this.scrollIntoView();
                });
            };
        },
        
        clear: function() {
            $("#console .message").remove();
            $("#console .note").show();
        },
        
        showMessage: function(message) {
            var tr = document.createElement("tr");
            tr.className = "message";
            var td = document.createElement("td");
            td.setAttribute("colspan", 5);
            td.appendChild(document.createTextNode(message));
            tr.appendChild(td);
            $("#console").append(tr);
        },
        
        setChannel: function(channel) {
            currentChannel = channel || "default";
            connection.send('{ "channel": "' + currentChannel + '" }');
            RemoteConsole.showMessage("Channel switched to '" + currentChannel + "'.");
        },
        
        saveState: function() {
            if (Modernizr.localstorage) {
                localStorage["monex.channel"] = currentChannel;
            }
        },
        
        restoreState: function() {
            if (Modernizr.localstorage) {
                currentChannel = localStorage["monex.channel"] || "default";
                $("input[name='channel']").val(currentChannel);
            }
        }
    };
})();

$(document).ready(function() {

    RemoteConsole.restoreState();
    RemoteConsole.connect();
    
    $("#clear").click(function(ev) {
        ev.preventDefault();
        
        RemoteConsole.clear();
    });
    
    $("#set-channel").click(function(ev) {
        ev.preventDefault();
        var channel = $("input[name='channel']").val();
        RemoteConsole.setChannel(channel);
    });
    
    $(window).unload(function () {
		RemoteConsole.saveState();
	});
});
