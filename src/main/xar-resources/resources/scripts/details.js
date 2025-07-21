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
$(function() { 
    var xml = $.parseXML($("#jmx-data").text());
    var data = JMX.util.fixjs(JMX.util.jmx2js(xml)); 
    var viewModel = ko.mapping.fromJS(data);
    ko.applyBindings(viewModel, document.getElementById("details"));
    $("#recentQueries").DataTable( { responsive: true } );

    $(".thread").hover(function(ev) {
        var name = $(this).text();
        $(".thread").each(function() {
            if ($(this).text() == name) {
                $(this).addClass("bg-yellow");
            } else {
                $(this).removeClass("bg-yellow");
            }
        });
    });
    
    $(".stack").popover({
        placement: "auto right",
        html: true,
        container: "#details",
        trigger: "click",
        template: '<div class="popover stacktrace" role="tooltip"><div class="arrow"></div><h3 class="popover-title"></h3><pre class="popover-content"></pre></div>'
    });
}); 
