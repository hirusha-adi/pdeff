import {
  Download,
  Eraser,
  FileJson,
  FileText,
  FolderOpen,
  Highlighter,
  MessageSquarePlus,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  Save
} from "lucide-react";

const tools = [
  { id: "select", label: "Pan/Select", icon: MousePointer2 },
  { id: "pen", label: "Pen", icon: PenLine },
  { id: "highlight", label: "Highlight", icon: Highlighter },
  { id: "comment", label: "Comment", icon: MessageSquarePlus }
];

function statusClass(status) {
  if (status === "Unsaved") return "status-unsaved";
  if (status === "Saving...") return "status-saving";
  if (status === "Saved") return "status-saved";
  if (status === "Save failed") return "status-failed";
  return "";
}

export default function Toolbar({
  activeTool,
  canOpenFolder,
  canSave,
  saveStatus,
  onOpenFolder,
  onOpenPdfFallback,
  onOpenPdfaFallback,
  onToolChange,
  onDeleteSelected,
  onZoomIn,
  onZoomOut,
  onSaveNow,
  onExportPdfa
}) {
  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button className="text-button" type="button" onClick={onOpenFolder} disabled={!canOpenFolder}>
          <FolderOpen size={17} />
          Open Folder
        </button>
        <button className="text-button" type="button" onClick={onOpenPdfFallback}>
          <FileText size={17} />
          Open PDF
        </button>
        <button className="text-button" type="button" onClick={onOpenPdfaFallback}>
          <FileJson size={17} />
          Open .pdfa
        </button>
      </div>

      <div className="toolbar-group">
        {tools.map(({ id, label, icon: Icon }) => (
          <button
            aria-label={label}
            className={`icon-button ${activeTool === id ? "tool-active" : ""}`}
            key={id}
            title={label}
            type="button"
            onClick={() => onToolChange(id)}
          >
            <Icon size={18} />
          </button>
        ))}
        <button
          aria-label="Delete selected"
          className="icon-button"
          title="Delete selected"
          type="button"
          onClick={onDeleteSelected}
        >
          <Eraser size={18} />
        </button>
      </div>

      <div className="toolbar-group">
        <button aria-label="Zoom out" className="icon-button" title="Zoom out" type="button" onClick={onZoomOut}>
          <Minus size={18} />
        </button>
        <button aria-label="Zoom in" className="icon-button" title="Zoom in" type="button" onClick={onZoomIn}>
          <Plus size={18} />
        </button>
      </div>

      <div className="toolbar-group">
        <button className="text-button" type="button" onClick={onSaveNow} disabled={!canSave}>
          <Save size={17} />
          Save now
        </button>
        <button className="text-button" type="button" onClick={onExportPdfa} disabled={!canSave}>
          <Download size={17} />
          Export .pdfa
        </button>
      </div>

      <span className="spacer" />
      <span className={`status-pill ${statusClass(saveStatus)}`}>{saveStatus}</span>
    </div>
  );
}
