/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
var Monex = window.Monex || {};
window.Monex = Monex;

function normalizeVectorModelRow(row) {
    if (!row) {
        return null;
    }
    var source = row.value || row;
    var status = jmxValue(source.status) || jmxValue(source.Status) || "";
    var provider = jmxValue(source.provider) || jmxValue(source.Provider) || "";
    if (!provider && status === "http") {
        provider = "HTTP";
    }
    return {
        id: jmxValue(source.id) || jmxValue(source.Id) || "",
        source: jmxValue(source.source) || jmxValue(source.Source) || "",
        path: jmxValue(source.path) || jmxValue(source.Path) || "",
        dimension: parseInt(jmxValue(source.dimension) || jmxValue(source.Dimension), 10) || 0,
        status: status,
        message: jmxValue(source.message) || jmxValue(source.Message) || "",
        provider: provider
    };
}

function jmxVectorStorePayload(storeNode) {
    if (!storeNode) {
        return null;
    }
    var available = jmxValue(storeNode.Available);
    return {
        available: available === true || available === "true",
        entryCountKnown: (function() {
            var known = jmxValue(storeNode.EntryCountKnown);
            return known === true || known === "true";
        })(),
        entryCount: parseInt(jmxValue(storeNode.EntryCount), 10) || 0,
        fileSize: parseInt(jmxValue(storeNode.FileSize), 10) || 0,
        formatVersion: parseInt(jmxValue(storeNode.FormatVersion), 10) || 0,
        persistenceBackend: jmxValue(storeNode.PersistenceBackend) || "vector.dbx"
    };
}

function jmxVectorToPayload(jmx) {
    if (!jmx) {
        return {
            available: false,
            total: 0,
            ready: 0,
            models: [],
            store: null
        };
    }
    var store = jmxVectorStorePayload(jmx.VectorStore);
    if (!jmx.VectorEmbedding) {
        return {
            available: false,
            total: 0,
            ready: 0,
            models: [],
            store: store
        };
    }
    var emb = jmx.VectorEmbedding;
    var modelsRaw = jmxValue(emb.Models);
    var models = [];
    if (modelsRaw && modelsRaw.length) {
        for (var i = 0; i < modelsRaw.length; i++) {
            models.push(normalizeVectorModelRow(modelsRaw[i]));
        }
    }
    return {
        available: true,
        total: parseInt(jmxValue(emb.ModelCount), 10) || 0,
        ready: parseInt(jmxValue(emb.ReadyModelCount), 10) || 0,
        models: models,
        store: store,
        persistenceBackend: jmxValue(emb.PersistenceBackend) || "lucene",
        metrics: {
            embedCallCount: parseInt(jmxValue(emb.EmbedCallCount), 10) || 0,
            knnQueryCount: parseInt(jmxValue(emb.KnnQueryCount), 10) || 0,
            loadedProviderCount: parseInt(jmxValue(emb.LoadedProviderCount), 10) || 0,
            persistenceBackend: jmxValue(emb.PersistenceBackend) || "lucene"
        }
    };
}

function createVectorStoreViewModel(store) {
    if (!store) {
        store = {
            available: false,
            entryCountKnown: false,
            entryCount: 0,
            fileSize: 0,
            formatVersion: 0,
            persistenceBackend: "vector.dbx"
        };
    }
    return {
        available: ko.observable(!!store.available),
        entryCountKnown: ko.observable(!!store.entryCountKnown),
        entryCount: ko.observable(store.entryCount || 0),
        fileSize: ko.observable(store.fileSize || 0),
        formatVersion: ko.observable(store.formatVersion || 0),
        persistenceBackend: ko.observable(store.persistenceBackend || "vector.dbx")
    };
}

function updateVectorStoreViewModel(model, store) {
    if (!model || !store) {
        return;
    }
    if (!model.vectorStore) {
        model.vectorStore = createVectorStoreViewModel(store);
        return;
    }
    model.vectorStore.available(!!store.available);
    model.vectorStore.entryCountKnown(!!store.entryCountKnown);
    model.vectorStore.entryCount(store.entryCount || 0);
    model.vectorStore.fileSize(store.fileSize || 0);
    model.vectorStore.formatVersion(store.formatVersion || 0);
    model.vectorStore.persistenceBackend(store.persistenceBackend || "vector.dbx");
}

function ensureVectorStoreSummaryComputed(viewModel) {
    if (!viewModel || viewModel.vectorStoreSummaryText) {
        return;
    }
    viewModel.vectorStoreSummaryText = ko.pureComputed(function() {
        return Monex.vector.vectorStoreSummary(viewModel.vectorStore);
    });
}

function syncVectorFromJmx(viewModel, jmx) {
    if (!viewModel) {
        return;
    }
    var payload = jmxVectorToPayload(jmx);
    Monex.kpi.updateVectorDiagnostics(viewModel, {
        available: payload.available,
        total: payload.total,
        ready: payload.ready,
        models: payload.models,
        persistenceBackend: payload.persistenceBackend || ""
    });
    if (payload.store) {
        updateVectorStoreViewModel(viewModel, payload.store);
    } else if (viewModel.vectorStore) {
        viewModel.vectorStore.available(false);
    }
    ensureVectorStoreSummaryComputed(viewModel);
}

function formatVectorFileSize(bytes) {
    var n = parseInt(bytes, 10) || 0;
    if (n < 1024) {
        return n + " B";
    }
    if (n < 1024 * 1024) {
        return Math.round(n / 1024) + " KB";
    }
    return (n / (1024 * 1024)).toFixed(1) + " MB";
}

function vectorStoreSummary(store) {
    if (!store) {
        return "";
    }
    var available = typeof store.available === "function" ? store.available() : store.available;
    if (!available) {
        return "";
    }
    var parts = [];
    var known = typeof store.entryCountKnown === "function" ? store.entryCountKnown() : store.entryCountKnown;
    if (known) {
        var count = typeof store.entryCount === "function" ? store.entryCount() : store.entryCount;
        parts.push(count + " entries");
    }
    var size = typeof store.fileSize === "function" ? store.fileSize() : store.fileSize;
    if (size >= 0) {
        parts.push(formatVectorFileSize(size));
    }
    return parts.join(" · ");
}

Monex.vector = {
    jmxVectorToPayload: jmxVectorToPayload,
    syncVectorFromJmx: syncVectorFromJmx,
    createVectorStoreViewModel: createVectorStoreViewModel,
    formatVectorFileSize: formatVectorFileSize,
    vectorStoreSummary: vectorStoreSummary
};
