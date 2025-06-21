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
package org.exist.remoteconsole;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.exist.console.xquery.ConsoleModule;

import javax.annotation.Nullable;
import javax.xml.datatype.DatatypeConfigurationException;
import java.io.IOException;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Base class for the Remote Console Endpoint.
 *
 * @author <a href="mailto:adam@evolvedbinary.com">Adam Retter</a>
 *
 * @param <S> The type of the Session object. Allows us to support both javax.websocket.Session and jakarta.websocket.Session.
 */
public abstract class AbstractRemoteConsoleEndpoint<S> {
    private static final Logger LOG = LoggerFactory.getLogger(AbstractRemoteConsoleEndpoint.class);
    protected static final String DEFAULT_CHANNEL = "_default_";

    private final Map<S, String> sessions = new ConcurrentHashMap<>();

    protected AbstractRemoteConsoleEndpoint() throws DatatypeConfigurationException {
        ConsoleModule.setAdapter(new RemoteConsoleAdapter(this::sendAll, this::sendAll));

        final ScheduledExecutorService service = Executors.newSingleThreadScheduledExecutor(
                runnable -> new Thread(runnable, "global.rconsole"));
        service.scheduleAtFixedRate(this::pingAll, 500, 500, TimeUnit.MILLISECONDS);
    }

    /**
     * Receive a message for a session.
     *
     * @param message the received message.
     * @param session the session that sent the message.
     */
    protected void receiveMessageForSession(final String message, final S session) {
        final ObjectMapper objectMapper = new ObjectMapper();
        try {
            final JsonNode root = objectMapper.readTree(message);
            final JsonNode channelNode = root.get("channel");
            if (channelNode != null) {
                final String channel = channelNode.textValue();
                sessions.put(session, channel);
            }
        } catch (final IOException e) {
            LOG.error(e.getMessage(), e);
        }
    }

    /**
     * Ping all connected web sockets.
     */
    void pingAll() {
        sendAll(null, "ping");
    }

    /**
     * Send a message to all connected web sockets which are subscribed
     * to the channel.
     *
     * @param toChannel the channel of subscribed web sockets to which
     *     the message should be sent, or null if the message should
     *     be sent to all web sockets.
     * @param data data which will be serialized to JSON.
     */
    void sendAll(@Nullable final String toChannel, final Map<String, Object> data) {
        final ObjectMapper objectMapper = new ObjectMapper();
        try {
            final String json = objectMapper.writeValueAsString(data);
            sendAll(toChannel, json);
        } catch (final IOException e) {
            LOG.error(e.getMessage(), e);
        }
    }

    /**
     * Send a message to all connected web sockets which are subscribed
     * to the channel.
     *
     * @param toChannel the channel of subscribed web sockets to which
     *     the message should be sent, or null if the message should
     *     be sent to all web sockets.
     * @param message the message to send
     */
    void sendAll(@Nullable final String toChannel, final String message) {
        final Iterator<Map.Entry<S, String>> iterator = sessions.entrySet().iterator();
        while (iterator.hasNext()) {
            try {
                final Map.Entry<S, String> entry = iterator.next();
                final S session = entry.getKey();
                final String channel = entry.getValue();

                if (toChannel == null || (!channel.equals(DEFAULT_CHANNEL) && toChannel.equals(channel))) {
                    sendText(session, message);
                }

            } catch (final IOException e) {
                LOG.error("Error sending message via websocket: " + e.getMessage(), e);
            }
        }
    }

    /**
     * Add a session.
     *
     * @param session the session to add.
     */
    protected void addSession(final S session) {
        setSessionMaxIdleTimeout(session, 10000);
        sessions.put(session, DEFAULT_CHANNEL);
    }

    /**
     * Set the max idle timeout of the session.
     *
     * @param session the session to set the timeout for.
     * @param timeout the timeout to set on the session.
     */
    protected abstract void setSessionMaxIdleTimeout(S session, long timeout);

    /**
     * Send a message to a session.
     *
     * @param session the session to send the message to.
     * @param message the message to send to the session.
     */
    protected abstract void sendText(final S session, final String message) throws IOException;

    /**
     * Remove a session.
     *
     * @param session the session to remove.
     */
    protected void removeSession(final S session) {
        sessions.remove(session);
    }
}
