interface TagSuggestionsProps {
  query: string;
  allTags: string[];
  onSelect: (tag: string) => void;
  onClose: () => void;
}

export function TagSuggestions({ query, allTags, onSelect, onClose }: TagSuggestionsProps) {
  const filtered = allTags.filter(t => t.toLowerCase().includes(query.toLowerCase())).slice(0, 5);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute z-[100] bg-card border border-border rounded-xl shadow-2xl mt-1 w-48 overflow-hidden">
      <div className="p-2 border-b border-border bg-muted/30">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Suggested Tags</span>
      </div>
      <div className="py-1">
        {filtered.map(tag => (
          <button
            key={tag}
            onClick={() => {
              onSelect(tag);
              onClose();
            }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-primary hover:text-primary-foreground transition-colors font-medium flex items-center gap-2"
          >
            <span className="opacity-60">#</span>
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
