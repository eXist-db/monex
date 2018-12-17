package org.exist.remoteconsole;

import org.exist.console.ConsoleAdapter;
import org.exist.xquery.value.DateTimeValue;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

public class RemoteConsoleAdapter implements ConsoleAdapter {

    private RemoteConsoleServlet servlet;

    public RemoteConsoleAdapter(RemoteConsoleServlet servlet) {
        this.servlet = servlet;
    }

    @Override
    public void log(String channel, String message) {
        log(channel, false, message);
    }

    @Override
    public void log(String channel, boolean json, String message) {
        final Map<String, Object> data = new HashMap<String, Object>();
        data.put("json", json);
        data.put("message", message);
        data.put("timestamp", new DateTimeValue(new Date()));

        servlet.send(channel, data);
    }

    @Override
    public void log(String channel, String source, int line, int column, String message) {
        log(channel, source, line, column, false, message);
    }

    @Override
    public void log(String channel, String source, int line, int column, boolean json, String message) {
        final Map<String, Object> data = new HashMap<String, Object>();
        data.put("source", source);
        data.put("line", line);
        data.put("column", column);
        data.put("json", json);
        data.put("message", message);
        data.put("timestamp", new DateTimeValue(new Date()));

        servlet.send(channel, data);
    }

    @Override
    public void send(String channel, String jsonString) {
        servlet.send(channel, jsonString);
    }
}
