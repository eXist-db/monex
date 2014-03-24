$(document).ready(function() {

    var url = "ws://" + location.host + "/rconsole";
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
        connection.send('{ "channel": "default" }');
    };
    
    // Log messages from the server
    connection.onmessage = function (e) {
        if (e.data == "ping") {
            return;
        }
        
        $(".note").hide(300);
        
        var data = JSON.parse(e.data);

        var tr = document.createElement("tr");
        tr.style.display = "none";
        var td = document.createElement("td");
        td.appendChild(document.createTextNode(data.timestamp));
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
});