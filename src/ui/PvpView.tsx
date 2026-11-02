import { useState } from "react";
import type { RelayError, RelayStatus } from "../net/relay";
import { RELAY_ERRORS } from "./PvpPanel";
import { inviteUrl } from "./usePvp";

// What the Play screen reports about its match, for this tab.
export interface PlayStatus {
  pvp: { host: boolean; friendJoined: boolean; status: RelayStatus; error: RelayError | null } | null;
  aiInProgress: boolean; // a game against the AI that starting a match would end
}

// The PvP tab: make a match link and send it to a friend (docs/MULTIPLAYER.md). The match itself is played on Play,
// and the host goes there as soon as the friend opens the link.
export function PvpView({
  available,
  room,
  play,
  onCreate,
  onLeave,
  onPlay,
}: {
  available: boolean;
  room: string | null;
  play: PlayStatus | null;
  onCreate: () => void;
  onLeave: () => void;
  onPlay: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const pvp = play?.pvp;
  const link = room ? inviteUrl(room) : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the link is selectable
    }
  };
  const canShare = typeof navigator !== "undefined" && !!navigator.share;
  const share = () => navigator.share?.({ title: "Common Ground", text: "Play me in Common Ground:", url: link }).catch(() => {});
  const create = () => {
    if (play?.aiInProgress && !window.confirm("Leave your game against the AI and start a match with a friend?")) return;
    onCreate();
  };
  const leave = () => {
    if (window.confirm("Leave this match? Your friend's link will stop working.")) onLeave();
  };

  let body;
  if (!available) body = <p className="muted">Multiplayer isn&apos;t set up on this site yet.</p>;
  else if (!room)
    body = (
      <>
        <p className="lede">
          Make a link and send it to a friend. When they open it, you both go to the board. Each round you deploy at the same time, and the
          battle starts once you have both pressed Fight.
        </p>
        <button className="primary pvp-create" onClick={create}>
          Create a match link
        </button>
        {play?.aiInProgress && <p className="muted small">This ends your game against the AI.</p>}
      </>
    );
  else if (pvp?.status === "failed")
    body = (
      <>
        <p className="warn-text">{(pvp.error && RELAY_ERRORS[pvp.error]) ?? "Couldn't join the match."}</p>
        <button className="primary" onClick={onLeave}>
          Start over
        </button>
      </>
    );
  else if (pvp?.host && !pvp.friendJoined)
    body = (
      <>
        <p className="lede">Send this link to a friend. As soon as they open it, you both go to the board.</p>
        <div className="pvp-link-row pvp-link-big">
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Match link" />
          <button className="primary" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
          {canShare && <button onClick={share}>Share</button>}
        </div>
        <p className="muted small">
          {pvp.status === "connecting" ? "Connecting to the match…" : pvp.status === "offline" ? "Connection lost. Reconnecting…" : "Waiting for your friend…"}
        </p>
        <div className="pvp-buttons">
          <button onClick={onPlay}>Start deploying while you wait</button>
          <button onClick={leave}>Cancel</button>
        </div>
      </>
    );
  else
    body = (
      <>
        <p className="lede">You&apos;re in a match with a friend.</p>
        <div className="pvp-buttons">
          <button className="primary" onClick={onPlay}>
            Back to the board
          </button>
          <button onClick={leave}>Leave match</button>
        </div>
      </>
    );

  return (
    <div className="page pvp-page">
      <h2>Play a friend</h2>
      {body}
    </div>
  );
}
