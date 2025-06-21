/*
 * eXist-db Open Source Native XML Database
 * Copyright (C) 2014 The eXist-db Authors
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

import org.exist.Version;
import org.exist.console.ConsoleAdapter;
import org.exist.dom.QName;
import org.exist.xquery.AbstractInternalModule;
import org.exist.xquery.FunctionDSL;
import org.exist.xquery.FunctionDef;
import org.exist.xquery.FunctionSignature;
import org.exist.xquery.value.FunctionParameterSequenceType;
import org.exist.xquery.value.FunctionReturnSequenceType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.annotation.Nullable;
import java.util.*;

/**
 * XQuery Module providing functions to log to a local or remote console.
 */
public class ConsoleModule extends AbstractInternalModule {

    private static final Logger LOG = LoggerFactory.getLogger(ConsoleModule.class);

    public final static String NAMESPACE_URI = "http://exist-db.org/xquery/console";
    public final static String PREFIX = "console";

    public final static FunctionDef[] functions = loadConsoleModuleFunctions();

    private static @Nullable ConsoleAdapter adapter = null;

    /**
     * Load functions for this module via a ServiceLoader
     * so that we can have different providers for
     * supporting different API incompatible DB Implementations.
     *
     * @return the function defs for this module.
     */
    private static FunctionDef[] loadConsoleModuleFunctions() {
        @Nullable FunctionDef[] functionDefs = null;

        try {
            final String dbImplName = Version.getProductName();
            final String dbImplVersion = Version.getVersion();
            final ServiceLoader<ConsoleModuleFunctionsProvider> consoleModuleFunctionsProviderLoader = ServiceLoader.load(ConsoleModuleFunctionsProvider.class);
            final Iterator<ConsoleModuleFunctionsProvider> iterator = consoleModuleFunctionsProviderLoader.iterator();
            while (iterator.hasNext()) {
                final ConsoleModuleFunctionsProvider consoleModuleFunctionsProvider = iterator.next();
                @Nullable FunctionDef[] providedFunctionDefs = consoleModuleFunctionsProvider.getFunctionDefs(dbImplName, dbImplVersion);

                if (providedFunctionDefs != null) {
                    if (functionDefs == null) {
                        functionDefs = providedFunctionDefs;
                    } else {
                        final int functionDefsLen = functionDefs.length;
                        functionDefs = Arrays.copyOf(functionDefs, functionDefsLen + providedFunctionDefs.length);
                        System.arraycopy(providedFunctionDefs, 0, functionDefs, functionDefsLen, providedFunctionDefs.length);
                    }
                }
            }
        } catch (final ServiceConfigurationError e) {
            LOG.error("Unable to load service: {}", ConsoleModuleFunctionsProvider.class.getName(), e);
        }

        if (functionDefs == null) {
            functionDefs = new FunctionDef[0];
        }

        return functionDefs;
    }

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

    public ConsoleModule(final Map<String, List<? extends Object>> parameters) {
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

    static FunctionSignature functionSignature(final String name, final String description, final FunctionReturnSequenceType returnType, final FunctionParameterSequenceType... paramTypes) {
        return FunctionDSL.functionSignature(new QName(name, NAMESPACE_URI, PREFIX), description, returnType, paramTypes);
    }

    static FunctionSignature[] functionSignatures(final String name, final String description, final FunctionReturnSequenceType returnType, final FunctionParameterSequenceType[][] variableParamTypes) {
        return FunctionDSL.functionSignatures(new QName(name, NAMESPACE_URI, PREFIX), description, returnType, variableParamTypes);
    }
}
