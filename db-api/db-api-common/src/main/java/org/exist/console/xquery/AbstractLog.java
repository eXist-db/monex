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

import org.apache.commons.io.output.StringBuilderWriter;
import org.exist.dom.QName;
import org.exist.storage.serializers.Serializer;
import org.exist.util.serializer.XQuerySerializer;
import org.exist.util.serializer.json.JSONWriter;
import org.exist.xquery.AnalyzeContextInfo;
import org.exist.xquery.BasicFunction;
import org.exist.xquery.Expression;
import org.exist.xquery.FunctionSignature;
import org.exist.xquery.Variable;
import org.exist.xquery.XPathException;
import org.exist.xquery.XQueryContext;
import org.exist.xquery.value.Item;
import org.exist.xquery.value.NodeValue;
import org.exist.xquery.value.Sequence;
import org.exist.xquery.value.SequenceIterator;
import org.exist.xquery.value.Type;
import org.xml.sax.SAXException;

import javax.annotation.Nullable;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.TransformerException;
import java.io.StringWriter;
import java.util.HashSet;
import java.util.Map;
import java.util.Properties;
import java.util.Set;

/**
 * Base class for the Log, Send, and Dump XPath Functions.
 *
 * @author <a href="mailto:adam@evolvedbinary.com">Adam Retter</a>
 */
public abstract class AbstractLog extends BasicFunction {
    protected static final String DEFAULT_CHANNEL = "default";

    private static final Properties SERIALIZATION_PROPERTIES = new Properties();
    static {
        SERIALIZATION_PROPERTIES.setProperty(OutputKeys.INDENT, "yes");
        SERIALIZATION_PROPERTIES.setProperty(OutputKeys.OMIT_XML_DECLARATION, "yes");
    }

    private static final Properties JSON_SERIALIZATION_PROPERTIES = new Properties();
    static {
        JSON_SERIALIZATION_PROPERTIES.setProperty(OutputKeys.INDENT, "yes");
        JSON_SERIALIZATION_PROPERTIES.setProperty(OutputKeys.METHOD, "json");
    }

    private Expression parent = null;

    protected AbstractLog(final XQueryContext context, final FunctionSignature signature) {
        super(context, signature);
    }

    @Override
    public void analyze(final AnalyzeContextInfo contextInfo) throws XPathException {
        super.analyze(contextInfo);
        parent = contextInfo.getParent();
    }

    @Override
    public Sequence eval(final Sequence[] args, final Sequence contextSequence) throws XPathException {
        if (isCalledAs("dump")) {
            evalDump(args);
        } else {
            evalSendLog(args);
        }
        return Sequence.EMPTY_SEQUENCE;
    }

    private void evalDump(final Sequence[] args) throws XPathException {
        final Properties outputProperties = new Properties(SERIALIZATION_PROPERTIES);
        final String channel = getArgumentCount() == 0 ? DEFAULT_CHANNEL : args[0].getStringValue();

        @Nullable final Set<String> varsToPrint;
        if (getArgumentCount() == 2) {
            varsToPrint = new HashSet<>();
            for (final SequenceIterator i = args[1].iterate(); i.hasNext(); ) {
                varsToPrint.add(i.nextItem().getStringValue());
            }
        } else {
            varsToPrint = null;
        }

        try (final StringBuilderWriter writer = new StringBuilderWriter()) {
            final JSONWriter jsonWriter = new JSONWriter(writer);
            jsonWriter.startDocument();
            jsonWriter.startElement("", "result", "result");

            final Map<QName, Variable> vars = context.getLocalVariables();
            for (final Map.Entry<QName, Variable> var: vars.entrySet()) {
                final String name = var.getKey().toString();
                if (varsToPrint == null || varsToPrint.contains(name)) {
                    jsonWriter.startElement("", name, name);
                    final StringBuilder value = new StringBuilder();
                    printItems(value, outputProperties, false, var.getValue().getValue());
                    jsonWriter.characters(value);
                    jsonWriter.endElement("", name, name);
                }
            }
            jsonWriter.endElement("", "result", "result");
            jsonWriter.endDocument();

            final String msg = writer.toString();
            if (parent == null) {
                ConsoleModule.log(channel, true, msg);
            } else {
                ConsoleModule.log(channel, parent.getSource().pathOrContentOrShortIdentifier(), parent.getLine(), parent.getColumn(), true, msg);
            }
        } catch (final TransformerException e) {
            throw new XPathException(this, e.getMessage(), e);
        }
    }

    private void evalSendLog(final Sequence[] args) throws XPathException {
        final Properties outputProperties = new Properties(SERIALIZATION_PROPERTIES);
        final String channel = getArgumentCount() == 1 ? DEFAULT_CHANNEL : args[0].getStringValue();
        final Sequence params = getArgumentCount() == 1 ? args[0] : args[1];
        final StringBuilder out = new StringBuilder();
        final boolean jsonFormat = isCalledAs("send");
        if (jsonFormat) {
            outputProperties.setProperty(OutputKeys.METHOD, "json");
        }
        printItems(out, outputProperties, jsonFormat, params);
        final String msg = out.toString();

        if (isCalledAs("send")) {
            ConsoleModule.send(channel, msg);
        } else {
            if (parent == null) {
                ConsoleModule.log(channel, msg);
            } else {
                ConsoleModule.log(channel, parent.getSource().pathOrContentOrShortIdentifier(), parent.getLine(), parent.getColumn(), msg);
            }
        }
    }

    private void printItems(StringBuilder out, Properties outputProperties, boolean jsonFormat, Sequence sequence) throws XPathException {
        for (SequenceIterator i = sequence.iterate(); i.hasNext(); ) {
            final Item item = i.nextItem();
            if (Type.subTypeOf(item.getType(), Type.NODE)) {
                final Serializer serializer = context.getBroker().getSerializer();
                serializer.reset();
                try {
                    serializer.setProperties(outputProperties);
                    out.append(serializer.serialize((NodeValue) item));
                } catch (SAXException e) {
                    out.append(e.getMessage());
                }
            } else if (item.getType() == Type.MAP || item.getType() == Type.ARRAY) {
                final StringWriter writer = new StringWriter();
                final XQuerySerializer xqSerializer = new XQuerySerializer(context.getBroker(), JSON_SERIALIZATION_PROPERTIES, writer);
                try {
                    xqSerializer.serialize(item.toSequence());
                    out.append(writer.toString());
                } catch (SAXException e) {
                    throw new XPathException(this, e.getMessage());
                }
            } else if (jsonFormat) {
                out.append('"').append(item.getStringValue()).append('"');
            } else {
                out.append(item.getStringValue());
            }
        }
    }
}
