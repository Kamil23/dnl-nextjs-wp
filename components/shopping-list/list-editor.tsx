import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { type ListOp, type ShoppingItem } from "../../lib/shopping-list-ops";
import { newItemId } from "../../lib/shopping-list";

// Full-featured list editor ported from the old freshlist app: an
// always-focused input as the first row, inline edit, delete with confirm
// modal, checked items sink to the bottom, drag & drop reordering,
// progress bar and confetti when the whole list is in the basket. Used by
// both the local and the shared (live) list page — `dispatch` decides
// where ops go.
export default function ListEditor({
  items,
  dispatch,
  onTyping,
  typingActive = false,
}: {
  items: ShoppingItem[];
  dispatch: (op: ListOp) => void;
  onTyping?: (typing: boolean) => void;
  typingActive?: boolean;
}) {
  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);
  const allDone = items.length > 0 && checked.length === items.length;

  const [toDelete, setToDelete] = useState<ShoppingItem | null>(null);

  // Dragging covers the unchecked section only — checked items are done,
  // reordering them is pointless. The reorder op appends unlisted (checked)
  // ids at the end, preserving their order.
  function handleDragEnd(result: DropResult) {
    if (!result.destination || result.source.index === result.destination.index) return;
    const next = [...unchecked];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    dispatch({ op: "reorder", ids: next.map((i) => i.id) });
  }

  return (
    <div className="rounded-3xl border border-gray-100 bg-white shadow-bottomSmall p-4 sm:p-6">
      {allDone && (
        <div className="rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 text-sm font-semibold text-center py-3 px-4 mb-2">
          🎉 Wszystko w koszyku!
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="shopping-list">
          {(provided) => (
            <ul ref={provided.innerRef} {...provided.droppableProps}>
              {unchecked.map((item, index) => (
                <Draggable draggableId={item.id} key={item.id} index={index}>
                  {(dragProvided, dragSnapshot) => (
                    <li
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      className={`rounded-xl cursor-grab active:cursor-grabbing ${
                        dragSnapshot.isDragging ? "bg-amber-50 shadow-medium" : ""
                      }`}
                    >
                      <ItemRow
                        item={item}
                        onToggle={() =>
                          dispatch({ op: "toggleItem", id: item.id, checked: !item.checked })
                        }
                        onEdit={(title) => dispatch({ op: "updateItem", id: item.id, title })}
                        onDelete={() => setToDelete(item)}
                      />
                    </li>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>

      {/* Notes-style: the input IS the next row of the list, always right
          below the last unchecked item — new items land where it points */}
      {typingActive && <TypingDots />}
      <AddInput
        onAdd={(title) => dispatch({ op: "addItems", items: [{ id: newItemId(), title }] })}
        onTyping={onTyping}
      />

      {checked.length > 0 && (
        <ul className="border-t border-gray-50 mt-1 pt-1">
          {checked.map((item) => (
            <li key={item.id} className="rounded-xl">
              <ItemRow
                item={item}
                onToggle={() => dispatch({ op: "toggleItem", id: item.id, checked: false })}
                onEdit={(title) => dispatch({ op: "updateItem", id: item.id, title })}
                onDelete={() => setToDelete(item)}
              />
            </li>
          ))}
        </ul>
      )}

      {checked.length > 0 && !allDone && (
        <ProgressBar total={items.length} checked={checked.length} />
      )}
      {allDone && <Confetti />}

      {toDelete && (
        <ConfirmDeleteModal
          item={toDelete}
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            dispatch({ op: "removeItem", id: toDelete.id });
            setToDelete(null);
          }}
        />
      )}
    </div>
  );
}

function ItemRow({
  item,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: ShoppingItem;
  onToggle: () => void;
  onEdit: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);

  useEffect(() => setTitle(item.title), [item.title]);

  function confirmEdit() {
    const trimmed = title.trim();
    if (trimmed && trimmed !== item.title) onEdit(trimmed);
    else setTitle(item.title);
    setEditing(false);
  }

  return (
    <div className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-amber-50 transition group">
      <input
        type="checkbox"
        checked={item.checked}
        onChange={onToggle}
        className="mt-1 w-4 h-4 accent-amber-500 shrink-0 cursor-pointer"
      />
      {editing && !item.checked ? (
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmEdit();
              if (e.key === "Escape") {
                setTitle(item.title);
                setEditing(false);
              }
            }}
            className="flex-1 border-b border-amber-300 focus:outline-none text-base sm:text-[15px] text-gray-700 bg-transparent"
          />
          <button
            onClick={() => {
              setTitle(item.title);
              setEditing(false);
            }}
            aria-label="Anuluj edycję"
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
          <button
            onClick={confirmEdit}
            aria-label="Zapisz"
            className="text-green-500 hover:text-green-700 font-bold"
          >
            ✓
          </button>
        </div>
      ) : (
        <>
          <div
            className="flex-1"
            onClick={() => {
              if (!item.checked) setEditing(true);
            }}
          >
            <span
              className={`text-[15px] leading-relaxed ${
                item.checked ? "text-gray-300 line-through" : "text-gray-700"
              }`}
            >
              {item.title}
            </span>
            {item.recipe && (
              <Link
                href={item.recipe.uri}
                onClick={(e) => e.stopPropagation()}
                className={`block text-xs hover:underline ${
                  item.checked ? "text-gray-300" : "text-amber-600"
                }`}
              >
                z przepisu: {item.recipe.title}
              </Link>
            )}
          </div>
          <button
            onClick={onDelete}
            aria-label={`Usuń ${item.title}`}
            className="text-gray-300 hover:text-red-500 text-sm shrink-0 px-1 opacity-60 group-hover:opacity-100 transition"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}

// Always-visible first row: the blinking cursor invites adding right away
function AddInput({
  onAdd,
  onTyping,
}: {
  onAdd: (title: string) => void;
  onTyping?: (typing: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
    onTyping?.(false);
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-3 px-2 py-2">
      <span className="w-4 h-4 rounded border-2 border-dashed border-amber-300 shrink-0" aria-hidden />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (e.target.value) onTyping?.(true);
        }}
        placeholder="Dodaj nowy element…"
        enterKeyHint="next"
        className="flex-1 focus:outline-none placeholder-gray-300 text-base sm:text-[15px] text-gray-700 bg-transparent"
      />
      {value.trim() && (
        <button type="submit" className="text-amber-500 hover:text-amber-600 font-bold px-1" aria-label="Dodaj">
          ↵
        </button>
      )}
    </form>
  );
}

// Freshlist's "ktoś pisze…" three bouncing dots
function TypingDots() {
  return (
    <div className="flex items-center gap-2 px-2 py-2" aria-label="Ktoś dodaje pozycję">
      <span className="w-4 h-4 rounded border border-gray-200 shrink-0" aria-hidden />
      <div className="flex gap-1.5 ml-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{ animationDelay: `${i * 0.2}s` }}
            className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"
          />
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ total, checked }: { total: number; checked: number }) {
  const pct = Math.round((checked / total) * 100);
  return (
    <div className="fixed bottom-0 inset-x-0 z-10 bg-amber-50 border-t border-amber-100 px-4 py-3 flex flex-col items-center print:hidden">
      <p className="text-xs text-gray-700 mb-2">
        Masz w koszyku już{" "}
        <span className="font-semibold text-amber-600">
          {checked} z {total}
        </span>{" "}
        produktów z listy!
      </p>
      <div className="h-1 w-full max-w-md bg-gray-200 rounded relative mb-1">
        <div
          style={{ width: `${pct}%` }}
          className="h-1 absolute top-0 bg-amber-500 rounded transition-all duration-500 ease-in-out"
        />
      </div>
      <span className="text-xs font-semibold text-amber-600">{pct}%</span>
    </div>
  );
}

// Lightweight CSS confetti burst when the whole list is checked off
function Confetti() {
  const pieces = Array.from({ length: 40 });
  const colors = ["#f59e0b", "#fbbf24", "#34d399", "#60a5fa", "#f472b6"];
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden print:hidden" aria-hidden>
      {pieces.map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i * 97) % 100}%`,
            backgroundColor: colors[i % colors.length],
            animationDelay: `${(i % 10) * 0.12}s`,
            animationDuration: `${2 + ((i * 31) % 10) / 6}s`,
          }}
        />
      ))}
      <style jsx>{`
        .confetti-piece {
          position: absolute;
          top: -12px;
          width: 8px;
          height: 12px;
          border-radius: 2px;
          animation-name: dnl-confetti-fall;
          animation-timing-function: ease-in;
          animation-iteration-count: 1;
          animation-fill-mode: forwards;
        }
        @keyframes dnl-confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(105vh) rotate(540deg);
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
}

function ConfirmDeleteModal({
  item,
  onCancel,
  onConfirm,
}: {
  item: ShoppingItem;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-3xl shadow-medium p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <p className="text-gray-800 font-semibold mb-1">Usunąć pozycję?</p>
        <p className="text-sm text-gray-500 mb-5 break-words">„{item.title}"</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="rounded-full border border-gray-300 px-5 py-2 text-sm text-gray-600 hover:border-gray-500 transition"
          >
            Anuluj
          </button>
          <button
            onClick={onConfirm}
            className="rounded-full bg-red-500 text-white px-5 py-2 text-sm font-semibold hover:bg-red-600 transition"
          >
            Usuń
          </button>
        </div>
      </div>
    </div>
  );
}
