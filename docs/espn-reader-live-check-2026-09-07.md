# ESPN Reader live check

Historical test of version 1.0. For current setup, use [Install ESPN Reader](espn-reader-mac-setup.md).
The installed Chrome reader passed a live practice draft check on 7 September 2026.

- ESPN room: Practice Draft for 2025, practice league `463262399`, team 2, slot 7.
- Real league `153177502` remained read only.
- The reader paired through its Chrome popup with the local assistant on port 3006.
- The initial snapshot contained 37 picks and three user players. These were ESPN auto-picks during setup, so this run is not an eight-pick recommendation evaluation.
- Two independent assistant tabs showed the same live state through the viewing link.
- The mock advanced to 41 picks. Ladd McConkey left the available pool at pick 41. The shared assistant recommended Jaylen Waddle at pick 42.
- Waddle was queued and drafted through ESPN's practice UI. Both assistant tabs then showed 47 total picks, four user players, Waddle in the WR slot, and Lamar Jackson as the next recommendation.
- ESPN remained connected and accepted the pause command. The mock was left paused at pick 48.

Screenshot: `/private/tmp/fantasy-tiers-screenshots/espn-reader-live-roster.png`.

This proves the installed reader, local relay, mapping layer, and shared assistant work together with live ESPN picks. It does not prove a deployed relay.

On the first connection, Chrome's localhost permission prompt closed the popup before pairing finished. Reopening the reader and selecting Connect assistant again completed pairing. Version 1.1 removes that manual pairing flow.
