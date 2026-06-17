import { useEffect, useMemo, useRef } from "react";
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

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !pdfa?.documentState?.scrollTop) return;
    scroller.scrollTop = pdfa.documentState.scrollTop;
  }, [pdfa?.source?.sha256]);

  const pages = useMemo(() => {
    if (!pdfDoc) return [];
    return Array.from({ length: pdfDoc.numPages }, (_, index) => index + 1);
  }, [pdfDoc]);

  function handleScroll(event) {
    if (!pdfa) return;
    onViewStateChange({ scrollTop: event.currentTarget.scrollTop });
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
    <div ref={scrollerRef} className="viewer-panel" onScroll={handleScroll}>
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
