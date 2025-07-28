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

import org.exist.xquery.FunctionSignature;
import org.exist.xquery.XQueryContext;
import org.exist.xquery.value.FunctionParameterSequenceType;
import org.exist.xquery.value.Type;

import static org.exist.console.xquery.ConsoleModule.functionSignature;
import static org.exist.console.xquery.ConsoleModule.functionSignatures;
import static org.exist.xquery.FunctionDSL.*;

/**
 * Functions for logging to a console.
 *
 * @author <a href="mailto:adam@evolvedbinary.com">Adam Retter</a>
 */
public class Log6 extends AbstractLog {

    private static final FunctionParameterSequenceType FS_PARAM_ITEMS = optManyParam("items", Type.ITEM, "Values to be sent.");
    private static final FunctionParameterSequenceType FS_PARAM_CHANNEL = param("channel", Type.STRING, "The channel to print to.");
    private static final FunctionParameterSequenceType FS_PARAM_VARS = optManyParam("vars", Type.STRING, "The names of the variables to dump.");

    public final static FunctionSignature[] FS_LOG = functionSignatures(
        "log",
        "Logs a message to the logger using the given template. If the channel is unspecified, the 'default' channel will be used.",
        returnsNothing(),
        arities(
            arity(
                FS_PARAM_ITEMS
            ),
            arity(
                FS_PARAM_CHANNEL,
                FS_PARAM_ITEMS
            )
        )
    );

    public final static FunctionSignature FS_SEND = functionSignature(
        "send",
        "Send a json message to the console",
        returnsNothing(),
        FS_PARAM_CHANNEL,
        FS_PARAM_ITEMS
    );

    public final static FunctionSignature[] FS_DUMP = functionSignatures(
        "dump",
        "Dump the local variable stack to the console, including all variables which are visible at the " +
            "point the statement appears in the code. If the channel is unspecified, the 'default' channel will be used. " +
            "If $vars is unspecified, all variables are dumped, otherwise " +
            "only the variables matching one of the names given in parameter " +
            "$vars are dumped. Use with care: might produce lots of output.",
        returnsNothing(),
        arities(
            arity(),
            arity(
                FS_PARAM_CHANNEL
            ),
            arity(
                FS_PARAM_CHANNEL,
                FS_PARAM_VARS
            )
        )
    );

    public Log6(final XQueryContext context, final FunctionSignature signature) {
        super(context, signature);
    }
}
