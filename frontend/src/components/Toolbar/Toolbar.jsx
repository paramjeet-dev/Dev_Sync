const COLORS = ['#1f2937', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'];

export default function Toolbar({
  tool,
  setTool,
  color,
  setColor,
  lineWidth,
  setLineWidth,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClear,
}) {
  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button
          className={tool === 'pen' ? 'active' : ''}
          onClick={() => setTool('pen')}
          title="Pen"
        >
          ✏️ Pen
        </button>
        <button
          className={tool === 'eraser' ? 'active' : ''}
          onClick={() => setTool('eraser')}
          title="Eraser"
        >
          🧹 Eraser
        </button>
      </div>

      <div className="toolbar-group">
        {COLORS.map((c) => (
          <button
            key={c}
            className={`color-swatch ${color === c ? 'active' : ''}`}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
            title={c}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>

      <div className="toolbar-group">
        <label className="line-width-label">
          Size
          <input
            type="range"
            min="1"
            max="24"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="toolbar-group">
        <button onClick={onUndo} disabled={!canUndo} title="Undo">
          ↶ Undo
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="Redo">
          ↷ Redo
        </button>
        <button onClick={onClear} title="Clear canvas" className="danger">
          🗑 Clear
        </button>
      </div>
    </div>
  );
}
