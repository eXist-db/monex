/*
 * eXist-db Open Source Native XML Database
 * Copyright (C) 2017 The eXist-db Authors
 *
 * info@exist-db.org
 * https://www.exist-db.org
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA
 */
package org.exist.remoteconsole;

import org.exist.xquery.XPathException;
import org.exist.xquery.value.DateTimeValue;
import org.exist.console.ConsoleAdapter;

import java.util.HashMap;
import java.util.Map;
import java.util.function.BiConsumer;

public class RemoteConsoleAdapter implements ConsoleAdapter {

    private final BiConsumer<String, Map> remoteDataWriter;
    private final BiConsumer<String, String> remoteStringWriter;

    public RemoteConsoleAdapter(final BiConsumer<String, Map> remoteDataWriter,
            final BiConsumer<String, String> remoteStringWriter) {
        this.remoteDataWriter = remoteDataWriter;
        this.remoteStringWriter = remoteStringWriter;
    }

    @Override
    public void log(final String channel, final String message) {
        log(channel, false, message);
    }

    @Override
    public void log(final String channel, final boolean json, final String message) {
        final Map<String, Object> data = new HashMap<>();
        data.put("json", json);
        data.put("message", message);
        data.put("timestamp", getTimestamp());

        remoteDataWriter.accept(channel, data);
    }

    @Override
    public void log(String channel, String source, int line, int column, String message) {
        log(channel, source, line, column, false, message);
    }

    @Override
    public void log(final String channel, final String source, final int line, final int column, final boolean json,
            final String message) {
        final Map<String, Object> data = new HashMap<>();
        data.put("source", source);
        data.put("line", line);
        data.put("column", column);
        data.put("json", json);
        data.put("message", message);
        data.put("timestamp", getTimestamp());

        remoteDataWriter.accept(channel, data);
    }

    @Override
    public void send(final String channel, final String jsonString) {
        remoteStringWriter.accept(channel, jsonString);
    }

    private String getTimestamp() {
        try {
            return new DateTimeValue().getStringValue();
        } catch (XPathException e) {
            return null;
        }
    }
}
