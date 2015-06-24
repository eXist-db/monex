package org.exist.remoteconsole;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.eclipse.jetty.util.ajax.JSON;
import org.eclipse.jetty.websocket.WebSocket;
import org.eclipse.jetty.websocket.WebSocketServlet;
import org.exist.console.xquery.ConsoleModule;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.*;

@WebServlet(urlPatterns = { "rconsole" })
public class RemoteConsoleServlet extends WebSocketServlet {

    private static final Logger LOG = LoggerFactory.getLogger(RemoteConsoleServlet.class);
    private static boolean started = false;

    protected Set<RemoteConsoleSocket> sockets = new CopyOnWriteArraySet<RemoteConsoleSocket>();

    @Override
    public void init() throws ServletException {
        if (started)
            throw new ServletException("RemoteConsoleServlet already started");
        started = true;
        super.init();
        System.out.println("Initializing RemoteConsole...");
        ConsoleModule.setAdapter(new RemoteConsoleAdapter(this));
        ScheduledExecutorService service = Executors.newSingleThreadScheduledExecutor();
        service.scheduleAtFixedRate(new Runnable() {
            @Override
            public void run() {
                RemoteConsoleServlet.this.send(null, "ping");
            }
        }, 5, 5, TimeUnit.SECONDS);
    }


    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        getServletContext().getNamedDispatcher("default").forward(req, resp);
    }

    @Override
    public WebSocket doWebSocketConnect(HttpServletRequest httpServletRequest, String s) {
        return new RemoteConsoleSocket();
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

    class RemoteConsoleSocket implements WebSocket.OnTextMessage {

        private Connection connection;
        private String channel = null;

        public void sendMessage(String toChannel, String data) throws IOException {
            if (toChannel == null || (channel != null && toChannel.equals(channel))) {
                connection.sendMessage(data);
            }
        }

        @Override
        public void onMessage(String message) {
            Map data = (Map) JSON.parse(message);
            String channel = (String) data.get("channel");
            if (channel != null) {
                this.channel = channel;
            }
        }

        @Override
        public void onOpen(Connection connection) {
            sockets.add(this);
            connection.setMaxIdleTime(10000);
            this.connection = connection;
        }

        @Override
        public void onClose(int code, String message) {
            sockets.remove(this);
        }
    }
}
