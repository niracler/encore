# Use one playback position for replay navigation

In the 214-Step Kyoko Replay, selecting the message at Step 28 after reaching Step 135 showed the Context Snapshot for Step 28, but pressing Play advanced to Step 136. The Player will use one Playback Position for the visible conversation, the timeline, the Context Snapshot, and resuming playback.

Clicking a message body, a point on the timeline, or a timeline label pauses the Replay at that Step and hides later Steps. From Step 28, Play reveals Step 29. Opening an image or document preview also pauses playback but preserves the Playback Position, so the viewer can inspect an earlier draft and then continue where they left off.

Each Step occupies an equal share of the timeline. The time beside the Step count shows elapsed time in the original Session, so a long break between messages is still visible in the timestamps.

Existing Frame labels and document titles supply candidates for timeline labels. The Player displays as many as fit without overlap at the available width. Every Step remains reachable along the track. This works for a plain CLI export and for an embedded Player, and authors can refine the titles during Curation.
