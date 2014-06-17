package org.exist.console.xquery;

import org.apache.log4j.Logger;
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
        new FunctionDef(JMXToken.signature, JMXToken.class)
    };

    private static ConsoleAdapter adapter = null;

    private static final Logger LOG = Logger.getLogger(ConsoleModule.class);

    public static void log(String channel, String message) {
        LOG.debug("Adapter: " + adapter);
        if (adapter != null) {
            adapter.log(channel, message);
        }
    }

    public static void log(String channel, String source, int line, int column, String message) {
        LOG.debug("Adapter: " + adapter);
        if (adapter != null) {
            adapter.log(channel, source, line, column, message);
        }
    }

    public static boolean initialized() {
        return adapter != null;
    }

    public static void setAdapter(ConsoleAdapter consoleAdapter) {
        adapter = consoleAdapter;
    }

    public ConsoleModule(Map<String, List<? extends Object>> parameters) {
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
