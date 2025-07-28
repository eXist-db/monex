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
$(document).ready(function() {
    /* 
     * Open link or code snippet in eXide. Check if eXide is already open.
     * Include this script if you use templates:load-source.
     */
    $(".eXide-open").on("click", function(ev) {
        // try to retrieve existing eXide window
        var exide = window.open("", "eXide");
        if (exide && !exide.closed) {
            var snip = $(this).data("exide-create");
            var path = $(this).data("exide-open");
            
            // check if eXide is really available or it's an empty page
            var app = exide.eXide;
            if (app) {
                // eXide is there
                if (snip) {
                    exide.eXide.app.newDocument(snip, "xquery");
                } else {
                    exide.eXide.app.findDocument(path);
                }
                exide.focus();
                setTimeout(function() {
                    if ($.browser.msie ||
                        (typeof exide.eXide.app.hasFocus == "function" && !exide.eXide.app.hasFocus())) {
                        alert("Opened code in existing eXide window.");
                    }
                }, 200);
            } else {
                window.eXide_onload = function() {
                    if (snip) {
                        exide.eXide.app.newDocument(snip, "xquery");
                    } else {
                        exide.eXide.app.findDocument(path);
                    }
                };
                // empty page
                exide.location = this.href.substring(0, this.href.indexOf('?'));
            }
            return false;
        }
        return true;
    });
});
