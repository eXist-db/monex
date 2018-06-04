package org.exist.remoteconsole;

import org.eclipse.jetty.util.ajax.JSON;
import org.eclipse.jetty.websocket.api.Session;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketClose;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketConnect;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketMessage;
import org.eclipse.jetty.websocket.api.annotations.WebSocket;
import org.eclipse.jetty.websocket.servlet.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.exist.console.xquery.ConsoleModule;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.*;

@WebServlet(urlPatterns = { "/rconsole" })
public class RemoteConsoleServlet extends WebSocketServlet {

    private static final Logger LOG = LoggerFactory.getLogger(RemoteConsoleServlet.class);
    private static boolean started = false;

    protected Set<RemoteConsoleSocket> sockets = new CopyOnWriteArraySet<RemoteConsoleSocket>();

    @Override
    public void configure(WebSocketServletFactory factory) {
        if (started)
            return;
        started = true;

        factory.setCreator((req, resp) -> new RemoteConsoleSocket());

        System.out.println("Initializing RemoteConsole...");
        ConsoleModule.setAdapter(new RemoteConsoleAdapter(this));
        ScheduledExecutorService service = Executors.newSingleThreadScheduledExecutor();
        service.scheduleAtFixedRate(() -> RemoteConsoleServlet.this.send(null, "ping"), 500, 500, TimeUnit.MILLISECONDS);
    }

    public void send(String channel, Map data) {
        final String json = JSON.toString(data);
        send(channel, json);
    }

    public void send(String channel, String jsonString) {
        for (RemoteConsoleSocket socket: sockets) {
            try {
                socket.sendMessage(channel, jsonString);
            } catch (IOException e) {
                LOG.error("Error sending message via websocket: " + e.getMessage(),e);
            }
        }
    }

    @WebSocket
    protected class RemoteConsoleSocket {

        private Session session;
        private String channel = null;

        public void sendMessage(String toChannel, String data) throws IOException {
            if (toChannel == null || (channel != null && toChannel.equals(channel))) {
                session.getRemote().sendString(data);
            }
        }

        @OnWebSocketMessage
        public void onMessage(Session session, String message) {
            Map data = (Map) JSON.parse(message);
            String channel = (String) data.get("channel");
            if (channel != null) {
                this.channel = channel;
            }
        }

        @OnWebSocketConnect
        public void onOpen(Session session) {
            sockets.add(this);
            session.setIdleTimeout(10000);
            this.session = session;
        }

        @OnWebSocketClose
        public void onClose(Session session, int code, String reason) {
            sockets.remove(this);
        }
    }
}
