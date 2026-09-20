# Animal Racers — approved gameplay revision

The owner's September 20 review rejected the first version's play: graphics progressed, but the racing and fighting still felt too close to the reference implementation. This revision changes the decisions made during a match. It keeps the game simple and preserves the complete race → duel → combined championship.

## The short brief

Two animal rivals race through a western canyon, then settle their rivalry in a saloon. In the race, follow the other animal's trail, build speed and swing out to pass. In the duel, read a committed strike, make it miss and answer during recovery. A narrow race win provides a small championship cushion; a strong duel can reverse it. Both players use the same rules.

The approved primary references are **Mario Kart 8 Deluxe** for racing rivalry and **ARMS** for readable physical exchanges. **Fall Guys** informs recovery and obstacle readability; **Punch-Out!!** informs anticipation and CPU openings. These are individual design lessons, not an instruction to reproduce their full systems or assets. In particular, a two-player race cannot assume that Mario Kart's item-driven comebacks transfer automatically.

## Race: chase, leap, pass

Automatic running, left/right steering, one leap action. Drafting is earned by following the rival's visible trail; it is not a manual boost button or a hidden speed advantage granted to the loser. Stored speed can carry a pass after the follower changes line. A nearby rival occupies space, so passing requires moving alongside them. Course bends affect the running line, and a small number of clearly shaped hazards interrupt otherwise flowing sections. Low timber can be jumped; loaded wagons require steering around them.

A single ordinary collision should create a short stumble and an opportunity to recover. Repeated mistakes and consistently better lines still matter. The HUD shows the distance to the rival, progress for both animals, and slipstream charge. World-space trails show where drafting is available; sound distinguishes building speed and completing a pass.

## Duel: read, evade, answer

Movement plus two actions: **STRIKE** and **EVADE**. There is no separate jump, block, elemental-special or resource-management button in the duel. Each animal commits to an identifiable strike with a visible wind-up, a short contact interval and a recovery that leaves an opening. Strikes recoil and separate the animals to create breathing room. A well-timed evasion creates a faster reply; repeatedly holding evade does not grant permanent protection.

Fire Lion has a heavy, slower strike; Water Wolf has quicker feet and paws; Rainbow Unicorn has a more forgiving protective evasion. Element effects accompany the physical action and never imply contact beyond the actual reach. Animations must match the simulation's commitment and contact time, including the shorter wind-up of a reply after a successful evade.

The CPU uses the same actions and stats, with documented reaction time and attack spacing. It must leave readable openings and remain beatable by ordinary, deliberately timed inputs. Passing a scripted policy test alone does not establish enjoyable human play.

## Championship and evidence

The equal, bounded 50-point race pool and 50-point duel pool remain. Race normalization changes from sixteen seconds to four seconds for the new, much closer racing loop. A 1.2-second race lead yields 32.5/17.5 race points; losing the duel by 26 HP yields 18.5/31.5 duel points, leaving a 51/49 championship win. A photo finish produces a small cushion. This scale follows legal-input race comparisons, including missed leaps, poor late lines and sustained poor steering; it is still subject to human match review. Race results do not grant a second advantage through combat stats. Ties, nonfinishers, simultaneous hits, timeouts, forfeits and rematches retain regression coverage.

The fixed `f600be2` owner preview remains available as the comparison version. New verification must demonstrate an actual stumble followed by a catch/pass opportunity and a deliberately avoided attack followed by a successful reply, through ordinary controls and complete recordings. All animals, roles and matchups remain in scope. Human acceptance, real internet play on separate devices, and sustained physical iPhone performance remain separate required gates; code tests and desktop captures cannot stand in for them.
