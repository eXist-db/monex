package org.exist.console.xquery;

import org.exist.dom.QName;
import org.exist.management.client.JMXServlet;
import org.exist.storage.BrokerPool;
import org.exist.util.Configuration;
import org.exist.xquery.*;
import org.exist.xquery.value.*;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

/**
 *
 */
public class JMXToken extends BasicFunction {

    public final static FunctionSignature signature =
        new FunctionSignature(
            new QName("jmx-token", ConsoleModule.NAMESPACE_URI, ConsoleModule.PREFIX),
            "Retrieves the authentication token required for access to the JMX servlet.",
            null,
            new FunctionReturnSequenceType(Type.STRING, Cardinality.ZERO_OR_ONE, "The authentication token")
        );

    public JMXToken(XQueryContext context) {
        super(context, signature);
    }

    @Override
    public Sequence eval(Sequence[] sequences, Sequence sequence) throws XPathException {
        final Configuration configuration = context.getBroker().getConfiguration();
        final String dataDir = (String) configuration.getProperty(BrokerPool.PROPERTY_DATA_DIR);
        if (dataDir == null) {
            return Sequence.EMPTY_SEQUENCE;
        }
        final File tokenFile = new File(dataDir, "jmxservlet.token");
        if (tokenFile.exists()) {
            InputStream is = null;
            try {
                is = new FileInputStream(tokenFile);
                final Properties properties = new Properties();
                properties.load(is);
                final String key = properties.getProperty("token");
                if (key != null) {
                    return new StringValue(key);
                }
            } catch (IOException ex) {
                throw new XPathException(this, "Exception while reading token file: " + ex.getMessage(), ex);
            } finally {
                try {
                    is.close();
                } catch (IOException e) {
                    // nothing to do
                }
            }
        }
        return Sequence.EMPTY_SEQUENCE;
    }
}
