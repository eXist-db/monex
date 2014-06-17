package org.exist.console.xquery;

import org.exist.dom.QName;
import org.exist.storage.serializers.Serializer;
import org.exist.xquery.*;
import org.exist.xquery.value.*;
import org.xml.sax.SAXException;

import javax.xml.transform.OutputKeys;
import java.util.Properties;

/**
 * Functions for logging to a console.
 */
public class Log extends BasicFunction {

    public final static FunctionSignature signatures[] = {
        new FunctionSignature(
            new QName("log", ConsoleModule.NAMESPACE_URI, ConsoleModule.PREFIX),
            "Logs a message to the logger using the template given in the first parameter and " +
            "the 'default' channel.",
            new SequenceType[] {
                new FunctionParameterSequenceType("items", Type.ITEM, Cardinality.ZERO_OR_MORE,
                    "Values to be printed. Will be concatenated into a single string.")
            },
            new FunctionReturnSequenceType(Type.EMPTY, Cardinality.EMPTY, "Empty")
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
            new FunctionReturnSequenceType(Type.EMPTY, Cardinality.EMPTY, "Empty")
        )
    };

    private static final Properties SERIALIZATION_PROPERTIES = new Properties();
    static {
        SERIALIZATION_PROPERTIES.setProperty(OutputKeys.INDENT, "yes");
        SERIALIZATION_PROPERTIES.setProperty(OutputKeys.OMIT_XML_DECLARATION, "yes");
    }

    private Expression parent = null;

    public Log(XQueryContext context, FunctionSignature signature) {
        super(context, signature);
    }

    @Override
    public void analyze(AnalyzeContextInfo contextInfo) throws XPathException {
        super.analyze(contextInfo);
        parent = contextInfo.getParent();
    }

    @Override
    public Sequence eval(Sequence[] args, Sequence contextSequence) throws XPathException {
        final String channel = getArgumentCount() == 1 ? "default" : args[0].getStringValue();
        final Sequence params = getArgumentCount() == 1 ? args[0] : args[1];
        final StringBuilder out = new StringBuilder();
        int j = 0;
        for (SequenceIterator i = params.iterate(); i.hasNext(); j++) {
            final Item item = i.nextItem();
            if (Type.subTypeOf(item.getType(), Type.NODE)) {
                Serializer serializer = context.getBroker().getSerializer();
                serializer.reset();
                try {
                    serializer.setProperties(SERIALIZATION_PROPERTIES);
                    out.append(serializer.serialize((NodeValue)item));
                } catch (SAXException e) {
                    out.append(e.getMessage());
                }
            } else {
                out.append(item.getStringValue());
            }
        }
        final String msg = out.toString();
        if (parent == null) {
            ConsoleModule.log(channel, msg);
        } else {
            ConsoleModule.log(channel, parent.getSource().getKey(), parent.getLine(), parent.getColumn(), msg);
        }

        return Sequence.EMPTY_SEQUENCE;
    }
}
