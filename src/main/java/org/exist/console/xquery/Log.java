/*
 * eXist Open Source Native XML Database
 * Copyright (C) 2001-2018 The eXist Project
 * http://exist-db.org
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.
 */
package org.exist.console.xquery;

import org.exist.dom.QName;
import org.exist.storage.serializers.Serializer;
import org.exist.util.serializer.XQuerySerializer;
import org.exist.util.serializer.json.JSONWriter;
import org.exist.xquery.*;
import org.exist.xquery.value.*;
import org.xml.sax.SAXException;

import javax.xml.transform.OutputKeys;
import javax.xml.transform.TransformerException;
import java.io.StringWriter;
import java.util.HashSet;
import java.util.Map;
import java.util.Properties;
import java.util.Set;

/**
 * Functions for logging to a console.
 */
public class Log extends BasicFunction {

    public final static FunctionSignature[] signatures = {
        new FunctionSignature(
            new QName("log", ConsoleModule.NAMESPACE_URI, ConsoleModule.PREFIX),
            "Logs a message to the logger using the template given in the first parameter and " +
            "the 'default' channel.",
            new SequenceType[] {
                new FunctionParameterSequenceType("items", Type.ITEM, Cardinality.ZERO_OR_MORE,
                    "Values to be printed. Will be concatenated into a single string.")
            },
            new FunctionReturnSequenceType(Type.EMPTY_SEQUENCE, Cardinality.EMPTY_SEQUENCE, "Empty")
        ),
        new FunctionSignature(
            new QName("log", ConsoleModule.NAMESPACE_URI, ConsoleModule.PREFIX),
            "Logs a message to the logger using the template given in the first parameter.",
            new SequenceType[] {
                new FunctionParameterSequenceType("channel", Type.STRING, Cardinality.EXACTLY_ONE,
                    "The channel to print to."),
                new FunctionParameterSequenceType("items", Type.ITEM, Cardinality.ZERO_OR_MORE,
                    "Values to be printed. Will be concatenated into a single string.")
            },
            new FunctionReturnSequenceType(Type.EMPTY_SEQUENCE, Cardinality.EMPTY_SEQUENCE, "Empty")
        ),
        new FunctionSignature(
            new QName("send", ConsoleModule.NAMESPACE_URI, ConsoleModule.PREFIX),
            "Send a json message to the console",
            new SequenceType[] {
                    new FunctionParameterSequenceType("channel", Type.STRING, Cardinality.EXACTLY_ONE,
                            "The channel to print to."),
                    new FunctionParameterSequenceType("items", Type.ITEM, Cardinality.ZERO_OR_ONE,
                            "Value to be sent. Will be transformed into JSON.")
            },
            new FunctionReturnSequenceType(Type.EMPTY_SEQUENCE, Cardinality.EMPTY_SEQUENCE, "Empty")
        ),
        new FunctionSignature(
                new QName("dump", ConsoleModule.NAMESPACE_URI, ConsoleModule.PREFIX),
                "Dump the local variable stack to the console, including all variables which are visible at the " +
                "point the statement appears in the code. Only the variables matching one of the names given in parameter " +
                "$vars are dumped. All others are ignored. Use with care: might produce lots of output.",
                new SequenceType[] {
                    new FunctionParameterSequenceType("channel", Type.STRING, Cardinality.EXACTLY_ONE,
                        "The channel to print to."),
                    new FunctionParameterSequenceType("vars", Type.STRING, Cardinality.ONE_OR_MORE,
                        "The names of the variables to dump."),
                },
                new FunctionReturnSequenceType(Type.EMPTY_SEQUENCE, Cardinality.EMPTY_SEQUENCE, "Empty")
        ),
        new FunctionSignature(
            new QName("dump", ConsoleModule.NAMESPACE_URI, ConsoleModule.PREFIX),
            "Dump the local variable stack to the console, including all variables which are visible at the " +
            "point the statement appears in the code. Use with care: might produce lots of output.",
            new SequenceType[] {
                new FunctionParameterSequenceType("channel", Type.STRING, Cardinality.EXACTLY_ONE,
                    "The channel to print to.")
            },
            new FunctionReturnSequenceType(Type.EMPTY_SEQUENCE, Cardinality.EMPTY_SEQUENCE, "Empty")
        ),
        new FunctionSignature(
            new QName("dump", ConsoleModule.NAMESPACE_URI, ConsoleModule.PREFIX),
            "Dump the local variable stack to the console, including all variables which are visible at the " +
            "point the statement appears in the code. Use with care: might produce lots of output.",
            null,
            new FunctionReturnSequenceType(Type.EMPTY_SEQUENCE, Cardinality.EMPTY_SEQUENCE, "Empty")
        )
    };

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

    public Log(final XQueryContext context, final FunctionSignature signature) {
        super(context, signature);
    }

    @Override
    public void analyze(final AnalyzeContextInfo contextInfo) throws XPathException {
        super.analyze(contextInfo);
        parent = contextInfo.getParent();
    }

    @Override
    public Sequence eval(final Sequence[] args, final Sequence contextSequence) throws XPathException {
        final Properties outputProperties = new Properties(SERIALIZATION_PROPERTIES);
        if (isCalledAs("dump")) {
            final String channel = getArgumentCount() == 0 ? "default" : args[0].getStringValue();
            Set<String> varsToPrint = null;
            if (getArgumentCount() == 2) {
                varsToPrint = new HashSet<>();
                for (final SequenceIterator i = args[1].iterate(); i.hasNext(); ) {
                    varsToPrint.add(i.nextItem().getStringValue());
                }
            }
            final StringWriter writer = new StringWriter();
            final JSONWriter jsonWriter = new JSONWriter(writer);
            try {
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
                e.printStackTrace();
            }

        } else {
            final String channel = getArgumentCount() == 1 ? "default" : args[0].getStringValue();
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
        return Sequence.EMPTY_SEQUENCE;
    }

    private void printItems(final StringBuilder out, final Properties outputProperties, final boolean jsonFormat, final Sequence sequence) throws XPathException {
        for (final SequenceIterator i = sequence.iterate(); i.hasNext(); ) {
            final Item item = i.nextItem();
            if (Type.subTypeOf(item.getType(), Type.NODE)) {
                final Serializer serializer = context.getBroker().getSerializer();
                serializer.reset();
                try {
                    serializer.setProperties(outputProperties);
                    out.append(serializer.serialize((NodeValue) item));
                } catch (final SAXException e) {
                    out.append(e.getMessage());
                }
            } else if (item.getType() == Type.MAP_ITEM || item.getType() == Type.ARRAY_ITEM) {
                final StringWriter writer = new StringWriter();
                final XQuerySerializer xqSerializer = new XQuerySerializer(context.getBroker(), JSON_SERIALIZATION_PROPERTIES, writer);
                try {
                    xqSerializer.serialize(item.toSequence());
                    out.append(writer);
                } catch (final SAXException e) {
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
