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

import org.exist.xquery.FunctionDef;

import javax.annotation.Nullable;

/**
 * A Service that may provide functions for the {@link ConsoleModule}.
 *
 * @author <a href="mailto:adam@evolvedbinary.com">Adam Retter</a>
 */
public interface ConsoleModuleFunctionsProvider {

    /**
     * Returns the Function Defs for the Console Module.
     *
     * @param dbImplName the DB implementation name.
     * @param dbImplVersion the DB implementation version.
     *
     * @return Any function defs that are relevant for the DB Implementation, or null if no applicable functions can be provided.
     */
    @Nullable FunctionDef[] getFunctionDefs(final String dbImplName, final String dbImplVersion);
}
