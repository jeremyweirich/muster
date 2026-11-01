import { useState } from "react";
import type { RelayError, RelayStatus } from "../net/relay";
import { inviteUrl } from "./usePvp";

const ERRORS: Record<RelayError, string> = {
  notfound: "This match doesn't exist any more. Ask your friend for a new link.",
  full: "This match already has two players.",
  taken: "This link belongs to the other player's seat.",
  bad: "That match link isn't right.",
  replaced: "This match is open in another tab or window.",
  toolong: "This match has run out of room on the server. Start a new one.",
};

// The PvP status at the top of the sidebar: the invite, the connection and what the friend is doing.
export function PvpPanel({
  room,
  host,
  configured,
  status,
  error,
  friendJoined,
  friendOnline,
  friendReady,
  versionMismatch,
  notice,
  onDismissNotice,
}: {
  room: string;
  host: boolean;
  configured: boolean;
  status: RelayStatus;
  error: RelayError | null;
  friendJoined: boolean;
  friendOnline: boolean;
  friendReady: boolean;
  versionMismatch: boolean;
  notice: string | null;
  onDismissNotice: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const link = inviteUrl(room);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the link is selectable below
    }
  };
  if (!configured) return <div className="pvp-panel warn">Multiplayer isn&apos;t set up on this site yet.</div>;
  if (status === "failed") return <div className="pvp-panel warn">{(error && ERRORS[error]) ?? "Couldn't join the match."}</div>;
  return (
    <div className="pvp-panel">
      {host && !friendJoined && (
        <div className="pvp-invite">
          <div className="small">Send this link to a friend. They join by opening it.</div>
          <div className="pvp-link-row">
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
            <button className="small-btn" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="muted small">You can start deploying while you wait.</div>
        </div>
      )}
      <div className="pvp-status small">
        {status === "connecting" ? (
          "Connecting to the match…"
        ) : status === "offline" ? (
          <span className="warn-text">Connection lost. Reconnecting…</span>
        ) : !friendJoined ? (
          <span className="muted">Waiting for your friend to join…</span>
        ) : (
          <>
            <span className={`pvp-dot ${friendOnline ? "on" : ""}`} /> Your friend is {friendOnline ? "online" : "away"}
            {friendReady ? " · ready to fight" : " · deploying"}
          </>
        )}
      </div>
      {versionMismatch && <div className="warn-text small">Your friend has a different version of the game. Both of you should reload the page.</div>}
      {notice && (
        <div className="pvp-notice small">
          {notice}{" "}
          <button className="small-btn" onClick={onDismissNotice}>
            OK
          </button>
        </div>
      )}
    </div>
  );
}
