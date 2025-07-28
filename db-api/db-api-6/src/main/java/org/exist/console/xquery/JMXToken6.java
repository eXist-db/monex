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
import org.exist.xquery.value.Type;

import static org.exist.console.xquery.ConsoleModule.functionSignature;
import static org.exist.xquery.FunctionDSL.returnsOpt;

/**
 * @author <a href="mailto:adam@evolvedbinary.com">Adam Retter</a>
 */
public class JMXToken6 extends AbstractJMXToken {

    public final static FunctionSignature FS_JMX_TOKEN = functionSignature(
        "jmx-token",
        "Retrieves the authentication token required for access to the JMX servlet.",
        returnsOpt(Type.STRING, "The authentication token")
    );

    public JMXToken6(final XQueryContext context) {
        super(context, FS_JMX_TOKEN);
    }
}
