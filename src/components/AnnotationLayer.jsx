import { useMemo, useRef, useState } from "react";
import { clientPointToPageUnits, isUsableRect, normalizeRect } from "../lib/pdf/coordinates.js";

function pointsToPath(points) {
  if (!points.length) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function selectionMatches(selection, kind, id) {
  return selection?.kind === kind && selection.id === id;
}

export default function AnnotationLayer({
  pageNumber,
  tool,
  annotations,
  commentThreads,
  workspaceBounds,
  selection,
  onInkComplete,
  onHighlightComplete,
  onCommentCreate,
  onSelect
}) {
  const svgRef = useRef(null);
  const [draftInk, setDraftInk] = useState(null);
  const [draftHighlight, setDraftHighlight] = useState(null);

  const className = useMemo(() => {
    const drawing = tool === "pen" || tool === "highlight" || tool === "comment";
    return `annotation-layer ${drawing ? "is-drawing" : "is-select"}`;
  }, [tool]);

  function normalizedPoint(event) {
    return clientPointToPageUnits(event, svgRef.current, workspaceBounds);
  }

  function handlePointerDown(event) {
    if (!svgRef.current) return;
    if (tool !== "pen" && tool !== "highlight" && tool !== "comment") return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = normalizedPoint(event);

    if (tool === "pen") {
      setDraftInk({ pointerId: event.pointerId, points: [point] });
    } else if (tool === "highlight") {
      setDraftHighlight({ pointerId: event.pointerId, start: point, end: point });
    } else if (tool === "comment") {
      onCommentCreate(pageNumber, point);
    }
  }

  function handlePointerMove(event) {
    if (draftInk?.pointerId === event.pointerId) {
      event.preventDefault();
      setDraftInk((draft) => ({ ...draft, points: [...draft.points, normalizedPoint(event)] }));
    }

    if (draftHighlight?.pointerId === event.pointerId) {
      event.preventDefault();
      setDraftHighlight((draft) => ({ ...draft, end: normalizedPoint(event) }));
    }
  }

  function finishPointer(event) {
    if (draftInk?.pointerId === event.pointerId) {
      event.preventDefault();
      if (draftInk.points.length > 1) onInkComplete(pageNumber, draftInk.points);
      setDraftInk(null);
    }

    if (draftHighlight?.pointerId === event.pointerId) {
      event.preventDefault();
      const rect = normalizeRect(draftHighlight.start, draftHighlight.end, workspaceBounds);
      if (isUsableRect(rect)) onHighlightComplete(pageNumber, rect);
      setDraftHighlight(null);
    }
  }

  const liveHighlight = draftHighlight ? normalizeRect(draftHighlight.start, draftHighlight.end, workspaceBounds) : null;

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={`${workspaceBounds.minX} ${workspaceBounds.minY} ${workspaceBounds.width} ${workspaceBounds.height}`}
      preserveAspectRatio="none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      style={{ touchAction: tool === "select" ? "auto" : "none" }}
    >
      {annotations.map((annotation) => {
        if (annotation.type === "ink") {
          return (
            <path
              key={annotation.id}
              d={pointsToPath(annotation.points)}
              fill="none"
              stroke={annotation.color}
              strokeWidth={annotation.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={annotation.opacity}
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelect({ kind: "annotation", id: annotation.id });
              }}
            />
          );
        }

        return annotation.rects.map((rect, index) => (
          <g key={`${annotation.id}-${index}`}>
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill={annotation.color}
              opacity={annotation.opacity}
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelect({ kind: "annotation", id: annotation.id });
              }}
            />
            {selectionMatches(selection, "annotation", annotation.id) ? (
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill="none"
                stroke="#134e4a"
                strokeWidth="0.003"
              />
            ) : null}
          </g>
        ));
      })}

      {draftInk ? (
        <path
          d={pointsToPath(draftInk.points)}
          fill="none"
          stroke="#1f6feb"
          strokeWidth="0.0045"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
      ) : null}

      {liveHighlight ? (
        <rect
          x={liveHighlight.x}
          y={liveHighlight.y}
          width={liveHighlight.width}
          height={liveHighlight.height}
          fill="#f6c343"
          opacity="0.34"
        />
      ) : null}

      {commentThreads.map((thread) => (
        <g
          key={thread.id}
          className="comment-marker"
          transform={`translate(${thread.anchor.x} ${thread.anchor.y})`}
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelect({ kind: "thread", id: thread.id });
          }}
        >
          <circle r="0.018" fill={selectionMatches(selection, "thread", thread.id) ? "#134e4a" : "#c2410c"} />
          <circle r="0.010" fill="#ffffff" />
        </g>
      ))}
    </svg>
  );
}
