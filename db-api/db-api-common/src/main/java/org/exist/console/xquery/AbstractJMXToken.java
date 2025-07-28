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

import org.exist.storage.BrokerPool;
import org.exist.util.Configuration;
import org.exist.xquery.BasicFunction;
import org.exist.xquery.FunctionSignature;
import org.exist.xquery.XPathException;
import org.exist.xquery.XQueryContext;
import org.exist.xquery.value.Sequence;
import org.exist.xquery.value.StringValue;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Properties;

/**
 * Base class for the JMX Token XPath Function.
 *
 * @author <a href="mailto:adam@evolvedbinary.com">Adam Retter</a>
 */
public abstract class AbstractJMXToken extends BasicFunction {

    protected AbstractJMXToken(final XQueryContext context, final FunctionSignature signature) {
        super(context, signature);
    }

    @Override
    public Sequence eval(final Sequence[] sequences, final Sequence sequence) throws XPathException {
        if (!context.getEffectiveUser().hasDbaRole()) {
            throw new XPathException(this, "Only a dba user is allowed to retrieve the JMX access token.");
        }

        final Configuration configuration = context.getConfiguration();
        final Object dataDirProp = configuration.getProperty(BrokerPool.PROPERTY_DATA_DIR);
        if (dataDirProp == null) {
            return Sequence.EMPTY_SEQUENCE;
        }

        final Path dataDir;
        if (dataDirProp instanceof String) {
            dataDir = Paths.get(dataDirProp.toString());
        } else {
            dataDir = (Path) dataDirProp;
        }

        final Path tokenFile = dataDir.resolve("jmxservlet.token");
        if (Files.exists(tokenFile)) {
            try (final InputStream is = Files.newInputStream(tokenFile)) {
                final Properties properties = new Properties();
                properties.load(is);
                final String key = properties.getProperty("token");
                if (key != null) {
                    return new StringValue(key);
                }
            } catch (IOException ex) {
                throw new XPathException(this, "Exception while reading token file: " + ex.getMessage(), ex);
            }
        }
        return Sequence.EMPTY_SEQUENCE;
    }
}
