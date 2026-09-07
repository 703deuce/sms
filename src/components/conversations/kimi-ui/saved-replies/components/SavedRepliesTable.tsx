"use client";

import type { SavedReply } from "../types";
import { Users, User, Pencil, Trash2 } from "lucide-react";

export function SavedRepliesTable({
  replies,
  readOnly,
  onEdit,
  onDelete,
}: {
  replies: SavedReply[];
  readOnly: boolean;
  onEdit: (r: SavedReply) => void;
  onDelete: (r: SavedReply) => void;
}) {
  return (
    <div className="sr-table-shell">
      <table className="sr-table">
        <thead>
          <tr>
            <th style={{ width: "22%" }}>Name</th>
            <th style={{ width: "13%" }}>Category</th>
            <th>Preview</th>
            <th style={{ width: "14%" }}>Tags</th>
            <th style={{ width: "11%" }}>Sharing</th>
            <th style={{ width: "10%" }} className="sr-th-right">
              Updated
            </th>
            <th style={{ width: "72px" }} className="sr-th-right">
              <span className="sr-sronly">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {replies.map((r) => (
            <tr key={r.id}>
              <td>
                <button
                  className="sr-rowlink"
                  onClick={() => onEdit(r)}
                  title={`Edit ${r.name}`}
                >
                  {r.name}
                </button>
                <div className="sr-rowsub">by {r.createdBy}</div>
              </td>
              <td className="sr-muted">{r.category}</td>
              <td>
                <span className="sr-preview" title={r.body}>
                  {r.body}
                </span>
              </td>
              <td>
                <div className="sr-tags">
                  {r.tags.map((t) => (
                    <span key={t} className="sr-tag">
                      {t}
                    </span>
                  ))}
                </div>
              </td>
              <td>
                {r.shared ? (
                  <span className="sr-chip sr-chip-team">
                    <Users size={11} aria-hidden /> Team
                  </span>
                ) : (
                  <span className="sr-chip sr-chip-private">
                    <User size={11} aria-hidden /> Private
                  </span>
                )}
              </td>
              <td className="sr-muted sr-td-right">{r.updatedAt}</td>
              <td className="sr-td-right">
                <div className="sr-rowactions">
                  <button
                    className="sr-iconbtn"
                    onClick={() => onEdit(r)}
                    aria-label={`Edit ${r.name}`}
                    disabled={readOnly}
                  >
                    <Pencil size={14} aria-hidden />
                  </button>
                  <button
                    className="sr-iconbtn sr-iconbtn-danger"
                    onClick={() => onDelete(r)}
                    aria-label={`Delete ${r.name}`}
                    disabled={readOnly}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
