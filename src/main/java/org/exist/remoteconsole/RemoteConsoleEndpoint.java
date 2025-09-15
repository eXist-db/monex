/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
package org.exist.remoteconsole;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.exist.util.ThreadUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.exist.console.xquery.ConsoleModule;

import javax.annotation.Nullable;
import javax.websocket.*;
import javax.websocket.server.ServerEndpoint;
import java.io.IOException;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * @author <a href="mailto:adam@exist-db.org">Adam Retter</a>
 */
@ServerEndpoint("/rconsole")
public class RemoteConsoleEndpoint {
    public final static String DEFAULT_CHANNEL = "_default_";

    private static final Logger LOG = LoggerFactory.getLogger(RemoteConsoleEndpoint.class);

    private static final Map<Session, String> sessions = new ConcurrentHashMap();

    public RemoteConsoleEndpoint() {
        ConsoleModule.setAdapter(new RemoteConsoleAdapter(this::sendAll, this::sendAll));
        final ScheduledExecutorService service = Executors.newSingleThreadScheduledExecutor(
                runnable -> ThreadUtils.newGlobalThread("rconsole", runnable));
        service.scheduleAtFixedRate(this::pingAll, 500, 500, TimeUnit.MILLISECONDS);
    }

    @OnOpen
    public void openSession(final Session session) {
        session.setMaxIdleTimeout(10000);
        sessions.put(session, DEFAULT_CHANNEL);
    }

    @OnClose
    public void closeSession(final Session session,
            final CloseReason closeReason) {
        sessions.remove(session);
    }

    @OnMessage
    public void recv(final String message, final Session session) {
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
    void sendAll(@Nullable final String toChannel, final Map data) {
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
        final Iterator<Map.Entry<Session, String>> iterator = sessions.entrySet().iterator();
        while (iterator.hasNext()) {
            try {
                final Map.Entry<Session, String> entry = iterator.next();
                final Session session = entry.getKey();
                final String channel = entry.getValue();

                if (toChannel == null || (!channel.equals(DEFAULT_CHANNEL) && toChannel.equals(channel))) {
                    session.getBasicRemote().sendText(message);
                }

            } catch (final IOException e) {
                LOG.error("Error sending message via websocket: " + e.getMessage(), e);
            }
        }
    }
}
