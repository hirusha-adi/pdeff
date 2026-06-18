import { useEffect, useRef, useState } from "react";
import AnnotationLayer from "./AnnotationLayer.jsx";

const CANVAS_MARGIN_LEFT = 2.2;
const CANVAS_MARGIN_RIGHT = 2.2;
const CANVAS_MARGIN_TOP = 0.8;
const CANVAS_MARGIN_BOTTOM = 1.4;

export default function PdfPage({
  pdfDoc,
  pageNumber,
  displayZoom,
  renderZoom,
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
  const [paintedZoom, setPaintedZoom] = useState(renderZoom || 1);
  const visualScale = paintedZoom ? displayZoom / paintedZoom : 1;
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
  const displayWorkspaceSize = {
    width: workspaceSize.width * visualScale,
    height: workspaceSize.height * visualScale
  };

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      const page = await pdfDoc.getPage(pageNumber);
      if (cancelled) return;

      const viewport = page.getViewport({ scale: renderZoom });
      const pixelRatio = window.devicePixelRatio || 1;
      const nextCanvas = document.createElement("canvas");
      const context = nextCanvas.getContext("2d");

      renderTaskRef.current?.cancel();
      nextCanvas.width = Math.floor(viewport.width * pixelRatio);
      nextCanvas.height = Math.floor(viewport.height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const task = page.render({ canvasContext: context, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
        if (cancelled) return;

        const canvas = canvasRef.current;
        const visibleContext = canvas.getContext("2d");
        canvas.width = nextCanvas.width;
        canvas.height = nextCanvas.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        visibleContext.setTransform(1, 0, 0, 1, 0, 0);
        visibleContext.clearRect(0, 0, canvas.width, canvas.height);
        visibleContext.drawImage(nextCanvas, 0, 0);
        setSize({ width: viewport.width, height: viewport.height });
        setPaintedZoom(renderZoom);
      } catch (error) {
        if (error?.name !== "RenderingCancelledException") throw error;
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [pdfDoc, pageNumber, renderZoom]);

  return (
    <div
      className="pdf-page-frame"
      data-page-number={pageNumber}
      data-visual-scale={visualScale}
      style={{
        width: `${displayWorkspaceSize.width}px`,
        height: `${displayWorkspaceSize.height}px`
      }}
    >
      <div
        className="pdf-page"
        style={{
          width: `${workspaceSize.width}px`,
          height: `${workspaceSize.height}px`,
          transform: `scale(${visualScale})`,
          "--pdf-left": `${CANVAS_MARGIN_LEFT * size.width}px`,
          "--pdf-top": `${CANVAS_MARGIN_TOP * size.height}px`
        }}
      >
        <canvas ref={canvasRef} style={{ width: `${size.width}px`, height: `${size.height}px` }} />
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
    </div>
  );
}
