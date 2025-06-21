/*
 * eXist-db Open Source Native XML Database
 * Copyright (C) 2014 The eXist-db Authors
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

import jakarta.websocket.CloseReason;
import jakarta.websocket.OnClose;
import jakarta.websocket.OnMessage;
import jakarta.websocket.OnOpen;
import jakarta.websocket.Session;
import jakarta.websocket.server.ServerEndpoint;
import javax.xml.datatype.DatatypeConfigurationException;
import java.io.IOException;

/**
 * @author <a href="mailto:adam@evolvedbinary.com">Adam Retter</a>
 */
@ServerEndpoint("/rconsole")
public class RemoteConsoleEndpoint7 extends AbstractRemoteConsoleEndpoint<Session> {

    public RemoteConsoleEndpoint7() throws DatatypeConfigurationException {
        super();
    }

    @OnOpen
    public void openSession(final Session session) {
        addSession(session);
    }

    @Override
    protected void setSessionMaxIdleTimeout(final Session session, final long timeout) {
        session.setMaxIdleTimeout(timeout);
    }

    @Override
    protected void sendText(final Session session, final String message) throws IOException {
        session.getBasicRemote().sendText(message);
    }

    @OnClose
    public void closeSession(final Session session, final CloseReason closeReason) {
        removeSession(session);
    }

    @OnMessage
    public void receiveMessage(final String message, final Session session) {
        receiveMessageForSession(message, session);
    }
}
