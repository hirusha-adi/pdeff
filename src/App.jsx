import { useEffect, useRef, useState } from "react";
import Toolbar from "./components/Toolbar.jsx";
import PdfViewer from "./components/PdfViewer.jsx";
import CommentsSidebar from "./components/CommentsSidebar.jsx";
import { createId } from "./lib/annotations/ids.js";
import { getPdfSourceInfo, sourceMatchesPdf } from "./lib/pdf/sourceInfo.js";
import { loadPdfDocument } from "./lib/pdf/loadPdf.js";
import { createEmptyPdfa } from "./lib/pdfa/createEmptyPdfa.js";
import { readPdfaFile } from "./lib/pdfa/readPdfa.js";
import { downloadPdfa, writePdfaHandle } from "./lib/pdfa/writePdfa.js";
import {
  getSidecarHandle,
  listPdfFiles,
  openWritableDirectory,
  sidecarNameForPdf,
  supportsFileSystemAccess
} from "./lib/storage/fileSystemAccess.js";
import { clearRecovery, readRecovery, writeRecovery } from "./lib/storage/indexedDbRecovery.js";

const ZOOM_STEP = 0.15;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;

function nowIso() {
  return new Date().toISOString();
}

function recoveryIsNewer(recovery, pdfa) {
  if (!recovery?.pdfa || !pdfa) return false;
  return Date.parse(recovery.pdfa.updatedAt) > Date.parse(pdfa.updatedAt);
}

export default function App() {
  const pdfInputRef = useRef(null);
  const pdfaInputRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const autosaveReadyRef = useRef(false);
  const dirtyRef = useRef(false);
  const pdfaRef = useRef(null);
  const pdfaHandleRef = useRef(null);
  const sourceInfoRef = useRef(null);

  const [folderHandle, setFolderHandle] = useState(null);
  const [pdfEntries, setPdfEntries] = useState([]);
  const [activePdfName, setActivePdfName] = useState("");
  const [sidecarName, setSidecarName] = useState("");
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfa, setPdfa] = useState(null);
  const [pdfaHandle, setPdfaHandle] = useState(null);
  const [sourceInfo, setSourceInfo] = useState(null);
  const [mode, setMode] = useState("idle");
  const [tool, setTool] = useState("select");
  const [selection, setSelection] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [saveStatus, setSaveStatus] = useState("Saved");
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(null);

  const hasFileSystemAccess = supportsFileSystemAccess();

  useEffect(() => {
    pdfaRef.current = pdfa;
  }, [pdfa]);

  useEffect(() => {
    pdfaHandleRef.current = pdfaHandle;
  }, [pdfaHandle]);

  useEffect(() => {
    sourceInfoRef.current = sourceInfo;
  }, [sourceInfo]);

  useEffect(() => {
    if (!pdfa || !sourceInfo) return;
    if (!autosaveReadyRef.current) return;

    dirtyRef.current = true;
    setSaveStatus("Unsaved");
    writeRecovery(sourceInfo.sha256, pdfa).catch((storageError) => {
      setWarning(`Recovery save failed: ${storageError.message}`);
    });

    window.clearTimeout(autosaveTimerRef.current);
    if (pdfaHandle) {
      autosaveTimerRef.current = window.setTimeout(() => {
        saveNow({ silentDownloadFallback: true });
      }, 1000);
    }
  }, [pdfa, sourceInfo, pdfaHandle]);

  useEffect(() => {
    function flushPending() {
      if (dirtyRef.current && pdfaHandleRef.current && pdfaRef.current) {
        saveNow({ silentDownloadFallback: true });
      }
    }

    window.addEventListener("pagehide", flushPending);
    window.addEventListener("beforeunload", flushPending);
    return () => {
      window.removeEventListener("pagehide", flushPending);
      window.removeEventListener("beforeunload", flushPending);
    };
  }, []);

  function installDocument({ doc, nextPdfa, nextSourceInfo, nextPdfaHandle, pdfName, nextSidecarName, nextMode }) {
    autosaveReadyRef.current = false;
    dirtyRef.current = false;
    window.clearTimeout(autosaveTimerRef.current);

    setPdfDoc(doc);
    setPdfa(nextPdfa);
    setSourceInfo(nextSourceInfo);
    setPdfaHandle(nextPdfaHandle ?? null);
    setActivePdfName(pdfName);
    setSidecarName(nextSidecarName);
    setMode(nextMode);
    setSelection(null);
    setZoom(nextPdfa.documentState.zoom || 1);
    setSaveStatus("Saved");

    queueMicrotask(() => {
      autosaveReadyRef.current = true;
    });
  }

  async function loadDocument({ pdfFile, nextPdfaHandle = null, importedPdfa = null, nextMode }) {
    setError("");
    setWarning("");
    setRecovery(null);

    const buffer = await pdfFile.arrayBuffer();
    const nextSourceInfo = await getPdfSourceInfo(pdfFile, buffer);
    const doc = await loadPdfDocument(buffer.slice(0));
    const nextSidecarName = sidecarNameForPdf(pdfFile.name);
    let nextPdfa = importedPdfa;

    if (nextPdfaHandle) {
      const sidecarFile = await nextPdfaHandle.getFile();
      try {
        nextPdfa = await readPdfaFile(sidecarFile);
      } catch (readError) {
        setPdfDoc(doc);
        setPdfa(null);
        setPdfaHandle(null);
        setSourceInfo(nextSourceInfo);
        setActivePdfName(pdfFile.name);
        setSidecarName(nextSidecarName);
        setMode(nextMode);
        setSaveStatus("Save failed");
        setError(`Could not load ${nextSidecarName}: ${readError.message}`);
        return;
      }

      if (!nextPdfa) {
        nextPdfa = createEmptyPdfa(nextSourceInfo);
        await writePdfaHandle(nextPdfaHandle, nextPdfa);
      }
    }

    if (!nextPdfa) {
      nextPdfa = createEmptyPdfa(nextSourceInfo);
    }

    if (!sourceMatchesPdf(nextPdfa.source, nextSourceInfo)) {
      setWarning("The .pdfa source fingerprint does not match this PDF.");
    }

    installDocument({
      doc,
      nextPdfa,
      nextSourceInfo,
      nextPdfaHandle,
      pdfName: pdfFile.name,
      nextSidecarName,
      nextMode
    });

    const savedRecovery = await readRecovery(nextSourceInfo.sha256);
    if (recoveryIsNewer(savedRecovery, nextPdfa)) {
      setRecovery(savedRecovery);
    }
  }

  async function handleOpenFolder() {
    try {
      const directoryHandle = await openWritableDirectory();
      const entries = await listPdfFiles(directoryHandle);
      setFolderHandle(directoryHandle);
      setPdfEntries(entries);
      setMode("folder");
      setError("");
      setWarning(entries.length ? "" : "No PDF files found in this folder.");
    } catch (openError) {
      setError(openError.message);
    }
  }

  async function handleFolderPdfSelect(event) {
    const name = event.target.value;
    const entry = pdfEntries.find((item) => item.name === name);
    if (!entry || !folderHandle) return;

    try {
      const pdfFile = await entry.handle.getFile();
      const nextPdfaHandle = await getSidecarHandle(folderHandle, pdfFile.name);
      await loadDocument({ pdfFile, nextPdfaHandle, nextMode: "folder" });
    } catch (openError) {
      setError(openError.message);
    }
  }

  async function handleFallbackPdf(event) {
    const pdfFile = event.target.files?.[0];
    event.target.value = "";
    if (!pdfFile) return;

    try {
      await loadDocument({ pdfFile, nextMode: "fallback" });
      setWarning("Manual mode: same-folder autosave needs File System Access API support.");
    } catch (openError) {
      setError(openError.message);
    }
  }

  async function handleFallbackPdfa(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!pdfDoc || !sourceInfo) {
      setError("Open the matching PDF before opening a .pdfa file.");
      return;
    }

    try {
      const importedPdfa = await readPdfaFile(file);
      if (!importedPdfa) {
        setError("Selected .pdfa file is empty.");
        return;
      }

      autosaveReadyRef.current = false;
      setPdfa(importedPdfa);
      setPdfaHandle(null);
      setSidecarName(file.name);
      setMode("fallback");
      setZoom(importedPdfa.documentState.zoom || 1);
      setSaveStatus("Saved");
      setError("");
      setWarning(
        sourceMatchesPdf(importedPdfa.source, sourceInfo)
          ? "Manual mode: export the .pdfa file after changes."
          : "The imported .pdfa source fingerprint does not match this PDF."
      );
      queueMicrotask(() => {
        autosaveReadyRef.current = true;
      });
    } catch (readError) {
      setError(`Could not load .pdfa: ${readError.message}`);
    }
  }

  function updatePdfa(updater) {
    setPdfa((current) => {
      if (!current) return current;
      const updatedAt = nowIso();
      return {
        ...updater(current, updatedAt),
        updatedAt
      };
    });
  }

  function handleInkComplete(page, points) {
    const createdAt = nowIso();
    updatePdfa((current) => ({
      ...current,
      documentState: { ...current.documentState, lastOpenedPage: page },
      annotations: [
        ...current.annotations,
        {
          id: createId("ink"),
          type: "ink",
          page,
          points,
          color: "#1f6feb",
          width: 0.0045,
          opacity: 0.92,
          createdAt,
          updatedAt: createdAt
        }
      ]
    }));
  }

  function handleHighlightComplete(page, rect) {
    const createdAt = nowIso();
    updatePdfa((current) => ({
      ...current,
      documentState: { ...current.documentState, lastOpenedPage: page },
      annotations: [
        ...current.annotations,
        {
          id: createId("highlight"),
          type: "highlight",
          page,
          rects: [rect],
          color: "#f6c343",
          opacity: 0.36,
          createdAt,
          updatedAt: createdAt
        }
      ]
    }));
  }

  function handleCommentCreate(page, anchor) {
    const createdAt = nowIso();
    const threadId = createId("thread");
    updatePdfa((current) => ({
      ...current,
      documentState: { ...current.documentState, lastOpenedPage: page },
      commentThreads: [
        ...current.commentThreads,
        {
          id: threadId,
          page,
          anchor,
          comments: [
            {
              id: createId("comment"),
              body: "",
              createdAt,
              updatedAt: createdAt
            }
          ],
          createdAt,
          updatedAt: createdAt
        }
      ]
    }));
    setSelection({ kind: "thread", id: threadId });
  }

  function handleChangeComment(threadId, commentId, body) {
    const updatedAt = nowIso();
    updatePdfa((current) => ({
      ...current,
      commentThreads: current.commentThreads.map((thread) => {
        if (thread.id !== threadId) return thread;
        return {
          ...thread,
          updatedAt,
          comments: thread.comments.map((comment) =>
            comment.id === commentId ? { ...comment, body, updatedAt } : comment
          )
        };
      })
    }));
  }

  function handleDeleteThread(threadId) {
    updatePdfa((current) => ({
      ...current,
      commentThreads: current.commentThreads.filter((thread) => thread.id !== threadId)
    }));
    setSelection(null);
  }

  function handleDeleteSelected() {
    if (!selection) return;
    updatePdfa((current) => {
      if (selection.kind === "annotation") {
        return {
          ...current,
          annotations: current.annotations.filter((annotation) => annotation.id !== selection.id)
        };
      }

      return {
        ...current,
        commentThreads: current.commentThreads.filter((thread) => thread.id !== selection.id)
      };
    });
    setSelection(null);
  }

  function scrollToPage(page) {
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-page-number="${page}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  function handleSelect(nextSelection) {
    setSelection(nextSelection);
    if (nextSelection?.kind === "thread") {
      const thread = pdfaRef.current?.commentThreads.find((item) => item.id === nextSelection.id);
      if (thread) scrollToPage(thread.page);
    }
  }

  function handleViewStateChange(partialState) {
    updatePdfa((current) => ({
      ...current,
      documentState: {
        ...current.documentState,
        ...partialState,
        zoom
      }
    }));
  }

  function changeZoom(direction) {
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((zoom + direction * ZOOM_STEP).toFixed(2))));
    setZoom(nextZoom);
    updatePdfa((current) => ({
      ...current,
      documentState: {
        ...current.documentState,
        zoom: nextZoom
      }
    }));
  }

  async function saveNow({ silentDownloadFallback = false } = {}) {
    const currentPdfa = pdfaRef.current;
    if (!currentPdfa) return;

    window.clearTimeout(autosaveTimerRef.current);

    if (!pdfaHandleRef.current) {
      if (!silentDownloadFallback) {
        downloadPdfa(currentPdfa, sidecarName || sidecarNameForPdf(currentPdfa.source.fileName));
        await clearRecovery(currentPdfa.source.sha256);
        dirtyRef.current = false;
        setSaveStatus("Saved");
      }
      return;
    }

    setSaveStatus("Saving...");
    try {
      await writePdfaHandle(pdfaHandleRef.current, currentPdfa);
      await clearRecovery(currentPdfa.source.sha256);
      dirtyRef.current = false;
      setSaveStatus("Saved");
      setWarning((current) => (current.startsWith("Autosave failed") ? "" : current));
    } catch (saveError) {
      setSaveStatus("Save failed");
      setWarning(`Autosave failed; local recovery copy kept. ${saveError.message}`);
    }
  }

  function exportPdfa() {
    if (!pdfa) return;
    downloadPdfa(pdfa, sidecarName || sidecarNameForPdf(pdfa.source.fileName));
  }

  async function restoreRecovery() {
    if (!recovery?.pdfa) return;
    autosaveReadyRef.current = true;
    setPdfa({
      ...recovery.pdfa,
      updatedAt: nowIso()
    });
    setZoom(recovery.pdfa.documentState.zoom || 1);
    setRecovery(null);
    setWarning("Recovered newer local changes. Save now or wait for autosave.");
  }

  async function ignoreRecovery() {
    if (sourceInfo?.sha256) await clearRecovery(sourceInfo.sha256);
    setRecovery(null);
  }

  const comments = pdfa?.commentThreads ?? [];

  return (
    <div className="app-shell">
      <Toolbar
        activeTool={tool}
        canOpenFolder={hasFileSystemAccess}
        canSave={Boolean(pdfa)}
        saveStatus={saveStatus}
        onOpenFolder={handleOpenFolder}
        onOpenPdfFallback={() => pdfInputRef.current?.click()}
        onOpenPdfaFallback={() => pdfaInputRef.current?.click()}
        onToolChange={setTool}
        onDeleteSelected={handleDeleteSelected}
        onZoomIn={() => changeZoom(1)}
        onZoomOut={() => changeZoom(-1)}
        onSaveNow={() => saveNow()}
        onExportPdfa={exportPdfa}
      />

      <section className="file-strip">
        {pdfEntries.length ? (
          <select className="file-select" value={activePdfName} onChange={handleFolderPdfSelect}>
            <option value="">Select PDF from folder...</option>
            {pdfEntries.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.name}
              </option>
            ))}
          </select>
        ) : null}

        <div className="file-meta">
          <span className="file-name-pill">PDF: {activePdfName || "none"}</span>
          <span className="file-name-pill">PDFA: {sidecarName || "none"}</span>
          <span className="file-name-pill">Zoom: {Math.round(zoom * 100)}%</span>
        </div>

        {!hasFileSystemAccess ? (
          <div className="notice-row">Same-folder autosave requires File System Access API support.</div>
        ) : null}
        {mode === "fallback" && pdfa ? (
          <div className="notice-row">Manual fallback mode: use Save now or Export .pdfa to download changes.</div>
        ) : null}
        {warning ? <div className="notice-row">{warning}</div> : null}
        {error ? <div className="notice-row error-row">{error}</div> : null}
        {recovery ? (
          <div className="recovery-panel">
            Newer unsaved recovery data exists for this PDF.
            <button type="button" onClick={restoreRecovery}>
              Restore recovery data
            </button>
            <button type="button" onClick={ignoreRecovery}>
              Ignore recovery data
            </button>
          </div>
        ) : null}
      </section>

      <main className="main-layout">
        <PdfViewer
          pdfDoc={pdfDoc}
          pdfa={pdfa}
          zoom={zoom}
          tool={tool}
          selection={selection}
          onInkComplete={handleInkComplete}
          onHighlightComplete={handleHighlightComplete}
          onCommentCreate={handleCommentCreate}
          onSelect={handleSelect}
          onViewStateChange={handleViewStateChange}
        />
        <CommentsSidebar
          threads={comments}
          selection={selection}
          onSelect={handleSelect}
          onChangeComment={handleChangeComment}
          onDeleteThread={handleDeleteThread}
        />
      </main>

      <input ref={pdfInputRef} className="hidden-input" type="file" accept="application/pdf,.pdf" onChange={handleFallbackPdf} />
      <input ref={pdfaInputRef} className="hidden-input" type="file" accept=".pdfa,application/json" onChange={handleFallbackPdfa} />
    </div>
  );
}
