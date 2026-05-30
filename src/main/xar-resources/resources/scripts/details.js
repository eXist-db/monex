/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
$(function() {
    JMX.util.resetActivityBuffers();

    var params = new URLSearchParams(window.location.search);
    var instance = params.get("instance") || "localhost";
    var timestamp = params.get("timestamp");
    $("#details-timelines-link").attr("href", "timelines.html?instance=" + encodeURIComponent(instance));

    if (!timestamp) {
        showDetailsEmptyState();
        return;
    }

    var raw = ($("#jmx-data").text() || "").trim();
    if (!raw) {
        showDetailsEmptyState();
        return;
    }

    try {
        var xml = $.parseXML(raw);
        var data = JMX.util.fixjs(JMX.util.jmx2js(xml));
        if (!data || !data.jmx) {
            showDetailsEmptyState();
            return;
        }
        var viewModel = ko.mapping.fromJS(data);
        viewModel.url = "";
        viewModel.vector = createVectorViewModel(null);
        viewModel.vectorStore = Monex.vector.createVectorStoreViewModel(null);
        Monex.vector.syncVectorFromJmx(viewModel, data.jmx);
        Monex.activity.attachDashboardViewModel(viewModel, { livePoll: false });
        Monex.activity.getDetailsFlyout = function() {
            return viewModel.activityFlyout;
        };
        ko.applyBindings(viewModel, document.getElementById("details-dashboard"));

        $(".thread").hover(function() {
            var name = $(this).text();
            $(".thread").each(function() {
                if ($(this).text() === name) {
                    $(this).addClass("bg-yellow");
                } else {
                    $(this).removeClass("bg-yellow");
                }
            });
        });
    } catch (err) {
        showDetailsEmptyState();
    }

    function showDetailsEmptyState() {
        $("#details-dashboard").hide();
        $("#details-empty-state").show();
    }
});
