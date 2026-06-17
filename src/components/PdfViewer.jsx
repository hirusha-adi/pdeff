import { useEffect, useMemo, useRef, useState } from "react";
import PdfPage from "./PdfPage.jsx";

export default function PdfViewer({
  pdfDoc,
  pdfa,
  zoom,
  tool,
  selection,
  onInkComplete,
  onHighlightComplete,
  onCommentCreate,
  onSelect,
  onViewStateChange
}) {
  const scrollerRef = useRef(null);
  const panRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    let frame = 0;
    let timer = 0;

    function restoreView() {
      const scroller = scrollerRef.current;
      if (!scroller) return;

      const firstPage = scroller.querySelector(".pdf-page");
      const firstCanvas = scroller.querySelector(".pdf-page canvas");
      const state = pdfa?.documentState ?? {};
      const hasSavedScroll = state.scrollLeft > 0 || state.scrollTop > 0;
      const firstPageLeft = firstCanvas ? Math.max(0, firstCanvas.offsetLeft - 24) : 0;
      const firstPageTop = firstPage ? Math.max(0, firstPage.offsetTop - 20) : 0;

      scroller.scrollTo({
        left: hasSavedScroll ? state.scrollLeft : firstPageLeft,
        top: hasSavedScroll ? state.scrollTop : firstPageTop,
        behavior: "auto"
      });
    }

    frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        restoreView();
        timer = window.setTimeout(restoreView, 120);
      });
    });

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [pdfa?.source?.sha256]);

  const pages = useMemo(() => {
    if (!pdfDoc) return [];
    return Array.from({ length: pdfDoc.numPages }, (_, index) => index + 1);
  }, [pdfDoc]);

  function handleScroll(event) {
    if (!pdfa) return;
    onViewStateChange({
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop
    });
  }

  function startPan(event) {
    if (tool !== "hand" || event.button !== 0) return;
    const target = event.target;
    if (target.closest?.(".thread-card, button, textarea, select, input")) return;
    panRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: scrollerRef.current.scrollLeft,
      top: scrollerRef.current.scrollTop
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePan(event) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    scrollerRef.current.scrollLeft = pan.left - (event.clientX - pan.x);
    scrollerRef.current.scrollTop = pan.top - (event.clientY - pan.y);
  }

  function stopPan(event) {
    if (panRef.current?.pointerId !== event.pointerId) return;
    panRef.current = null;
    setIsPanning(false);
  }

  if (!pdfDoc || !pdfa) {
    return (
      <div className="viewer-panel">
        <div className="empty-state">
          <div>
            <strong>Open a folder or PDF.</strong>
            <br />
            All annotations stay local in the .pdfa sidecar.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollerRef}
      className={`viewer-panel ${tool === "hand" ? "can-pan" : ""} ${isPanning ? "is-panning" : ""}`}
      onScroll={handleScroll}
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={stopPan}
      onPointerCancel={stopPan}
    >
      <div className="pdf-stack">
        {pages.map((pageNumber) => (
          <PdfPage
            key={`${pdfa.source.sha256}-${pageNumber}`}
            pdfDoc={pdfDoc}
            pageNumber={pageNumber}
            zoom={zoom}
            annotations={pdfa.annotations.filter((annotation) => annotation.page === pageNumber)}
            commentThreads={pdfa.commentThreads.filter((thread) => thread.page === pageNumber)}
            tool={tool}
            selection={selection}
            onInkComplete={onInkComplete}
            onHighlightComplete={onHighlightComplete}
            onCommentCreate={onCommentCreate}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
