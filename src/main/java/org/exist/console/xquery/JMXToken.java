package org.exist.console.xquery;

import org.exist.dom.QName;
import org.exist.storage.BrokerPool;
import org.exist.util.Configuration;
import org.exist.xquery.*;
import org.exist.xquery.value.*;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
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
        if (!context.getEffectiveUser().hasDbaRole()) {
            throw new XPathException(this, "Only a dba user is allowed to retrieve the JMX access token.");
        }
        final Configuration configuration = context.getBroker().getConfiguration();
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
