-------------------------- MODULE ReservationExpiry --------------------------
EXTENDS Naturals, TLC

VARIABLES deadline, now, held
Ids == {1, 2}
\* A zero deadline means that the reservation was never made.
Init == /\ deadline \in [Ids -> 0..3]
        /\ now = 0
        /\ held = {id \in Ids : deadline[id] # 0}

\* Sweep reservations when the clock reaches their deadline.
Tick == /\ now < 4
        /\ now' = now + 1
        /\ held' = held \ {id \in Ids : deadline[id] = now'}
        /\ UNCHANGED deadline

Spec == Init /\ [][Tick]_<<deadline, now, held>>

\* Check the result of every sweep independently, including still-live holds.
OnlyLiveHolds == held = {id \in Ids : deadline[id] > now}
ReservedTotal == (IF 1 \in held THEN 2 ELSE 0) + (IF 2 \in held THEN 3 ELSE 0)

\* Emit TLC's expected total for the JavaScript comparison at each state.
EmitCase == PrintT(<<"expiry", deadline[1], deadline[2], now, ReservedTotal>>)
=============================================================================
