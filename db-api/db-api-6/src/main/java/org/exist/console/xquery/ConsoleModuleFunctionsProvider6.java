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

import org.exist.xquery.FunctionDef;

import javax.annotation.Nullable;

import static org.exist.xquery.FunctionDSL.functionDefs;

/**
 * @author <a href="mailto:adam@evolvedbinary.com">Adam Retter</a>
 */
public class ConsoleModuleFunctionsProvider6 implements ConsoleModuleFunctionsProvider {

    @Override
    public @Nullable FunctionDef[] getFunctionDefs(final String dbImplName, final String dbImplVersion) {
        final int firstSep = dbImplVersion.indexOf('.');
        final String dbImplMajorVersion = dbImplVersion.substring(0, firstSep);

        if ("6".equals(dbImplMajorVersion)) {

            return functionDefs(
                functionDefs(
                    Log6.class,
                    Log6.FS_LOG[0],
                    Log6.FS_LOG[1],
                    Log6.FS_SEND,
                    Log6.FS_DUMP[0],
                    Log6.FS_DUMP[1],
                    Log6.FS_DUMP[2]
                ),
                functionDefs(
                    JMXToken6.class,
                    JMXToken6.FS_JMX_TOKEN
                )
            );

        }
        return null;
    }
}
