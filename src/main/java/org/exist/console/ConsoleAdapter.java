/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
package org.exist.console;

public interface ConsoleAdapter {

    void log(String channel, String message);

    void log(String channel, boolean json, String message);

    void log(String channel, String source, int line, int column, String message);

    void log(String channel, String source, int line, int column, boolean json, String message);

    void send(String channel, String message);
}