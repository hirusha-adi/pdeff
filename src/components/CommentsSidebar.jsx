export default function CommentsSidebar({ threads, selection, onSelect, onChangeComment, onDeleteThread }) {
  const sortedThreads = [...threads].sort((a, b) => a.page - b.page || a.createdAt.localeCompare(b.createdAt));

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Comments</h2>
      </div>
      <div className="sidebar-list">
        {sortedThreads.length === 0 ? (
          <div className="empty-state">No comments yet.</div>
        ) : (
          sortedThreads.map((thread) => {
            const selected = selection?.kind === "thread" && selection.id === thread.id;
            const firstComment = thread.comments[0];
            return (
              <article
                key={thread.id}
                className={`thread-card ${selected ? "selected" : ""}`}
                onClick={() => onSelect({ kind: "thread", id: thread.id, page: thread.page })}
              >
                <div className="thread-header">
                  <span>Page {thread.page}</span>
                  <button type="button" onClick={(event) => {
                    event.stopPropagation();
                    onDeleteThread(thread.id);
                  }}>
                    Delete
                  </button>
                </div>
                <textarea
                  value={firstComment?.body ?? ""}
                  placeholder="Type note..."
                  onChange={(event) => onChangeComment(thread.id, firstComment?.id, event.target.value)}
                  onFocus={() => onSelect({ kind: "thread", id: thread.id, page: thread.page })}
                />
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}
