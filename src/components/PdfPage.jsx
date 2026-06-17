import { useEffect, useRef, useState } from "react";
import AnnotationLayer from "./AnnotationLayer.jsx";

const CANVAS_MARGIN_LEFT = 2.2;
const CANVAS_MARGIN_RIGHT = 2.2;
const CANVAS_MARGIN_TOP = 0.8;
const CANVAS_MARGIN_BOTTOM = 1.4;

export default function PdfPage({
  pdfDoc,
  pageNumber,
  zoom,
  annotations,
  commentThreads,
  tool,
  selection,
  onInkComplete,
  onHighlightComplete,
  onCommentCreate,
  onSelect
}) {
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [size, setSize] = useState({ width: 612, height: 792 });
  const workspaceBounds = {
    minX: -CANVAS_MARGIN_LEFT,
    minY: -CANVAS_MARGIN_TOP,
    width: CANVAS_MARGIN_LEFT + 1 + CANVAS_MARGIN_RIGHT,
    height: CANVAS_MARGIN_TOP + 1 + CANVAS_MARGIN_BOTTOM
  };
  const workspaceSize = {
    width: size.width * workspaceBounds.width,
    height: size.height * workspaceBounds.height
  };

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      const page = await pdfDoc.getPage(pageNumber);
      if (cancelled) return;

      renderTaskRef.current?.cancel();
      const viewport = page.getViewport({ scale: zoom });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      const pixelRatio = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      setSize({ width: viewport.width, height: viewport.height });

      const task = page.render({ canvasContext: context, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (error) {
        if (error?.name !== "RenderingCancelledException") throw error;
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [pdfDoc, pageNumber, zoom]);

  return (
    <div
      className="pdf-page"
      data-page-number={pageNumber}
      style={{
        width: `${workspaceSize.width}px`,
        height: `${workspaceSize.height}px`,
        "--pdf-left": `${CANVAS_MARGIN_LEFT * size.width}px`,
        "--pdf-top": `${CANVAS_MARGIN_TOP * size.height}px`
      }}
    >
      <canvas ref={canvasRef} />
      <AnnotationLayer
        pageNumber={pageNumber}
        tool={tool}
        annotations={annotations}
        commentThreads={commentThreads}
        workspaceBounds={workspaceBounds}
        selection={selection}
        onInkComplete={onInkComplete}
        onHighlightComplete={onHighlightComplete}
        onCommentCreate={onCommentCreate}
        onSelect={onSelect}
      />
    </div>
  );
}
