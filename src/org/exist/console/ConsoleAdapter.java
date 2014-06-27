package org.exist.console;

public interface ConsoleAdapter {

    public void log(String channel, String message);

    public void log(String channel, String source, int line, int column, String message);

    public void send(String channel, String message);
}