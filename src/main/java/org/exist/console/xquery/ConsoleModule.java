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
package org.exist.console.xquery;

import org.exist.console.ConsoleAdapter;
import org.exist.xquery.AbstractInternalModule;
import org.exist.xquery.FunctionDef;

import java.util.List;
import java.util.Map;

/**
 * XQuery Module providing functions to log to a local or remote console.
 */
public class ConsoleModule extends AbstractInternalModule {

    public final static String NAMESPACE_URI = "http://exist-db.org/xquery/console";
    public final static String PREFIX = "console";

    public final static FunctionDef[] functions = {
        new FunctionDef(Log.signatures[0], Log.class),
        new FunctionDef(Log.signatures[1], Log.class),
        new FunctionDef(Log.signatures[2], Log.class),
        new FunctionDef(Log.signatures[3], Log.class),
        new FunctionDef(Log.signatures[4], Log.class),
        new FunctionDef(Log.signatures[5], Log.class),
        new FunctionDef(JMXToken.signature, JMXToken.class)
    };

    private static ConsoleAdapter adapter = null;

    public static void log(final String channel, final String message) {
        log(channel, false, message);
    }

    public static void log(final String channel, final boolean json, final String message) {
        if (adapter != null) {
            adapter.log(channel, json, message);
        }
    }

    public static void log(final String channel, final String source, final int line, final int column, final String message) {
        log(channel, source, line, column, false, message);
    }

    public static void log(final String channel, final String source, final int line, final int column, final boolean json, final String message) {
        if (adapter != null) {
            adapter.log(channel, source, line, column, json, message);
        }
    }

    public static void send(final String channel, final String json) {
        if (adapter != null) {
            adapter.send(channel, json);
        }
    }

    public static boolean initialized() {
        return adapter != null;
    }

    public static void setAdapter(final ConsoleAdapter consoleAdapter) {
        adapter = consoleAdapter;
    }

    public ConsoleModule(final Map<String, List<?>> parameters) {
        super(functions, parameters, false);
    }

    @Override
    public String getNamespaceURI() {
        return NAMESPACE_URI;
    }

    @Override
    public String getDefaultPrefix() {
        return PREFIX;
    }

    @Override
    public String getDescription() {
        return "XQuery module providing functions to log values to a local or remote console.";
    }

    @Override
    public String getReleaseVersion() {
        return "2.1";
    }
}
