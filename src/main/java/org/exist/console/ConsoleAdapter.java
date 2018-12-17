package org.exist.console;

public interface ConsoleAdapter {

    void log(String channel, String message);

    void log(String channel, boolean json, String message);

    void log(String channel, String source, int line, int column, String message);

    void log(String channel, String source, int line, int column, boolean json, String message);

    void send(String channel, String message);
}