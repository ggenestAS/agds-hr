Status: in progress
Readiness: ready

# improve-ux plan

Plan to make the app functional.

General thing :

A staff member should be able to see :
-> his own self review
-> his manager's review of himself
-> all reviews (self, peer, manager) of people he manages (both local and functional, both direct and indirect)

Page /dashboard :
-> remove people in scope, review cases, decisions delivered, open appeals

Page /people :
ok

Page /people/{id} :
-> job architecture, only display the level the person is at (L1 contributor -> L4 head / principal), not the whole list.
-> display both local and functional managers
-> 3 tabs :

1. Recieved reviews :
   grouped by cycle (year), toggleable. by default only the last cycle open, the other ones closed.
   in the cycles, group by type : self first, then peers, then manager.
2. Given reviews :
   grouped by cycle (year), toggleable. then grouped by type : given as manager, then given as peer.
3. Info :
   contract type
   should be reviewed
   local and functional manager
   level, track, etc.. (all that's relevant)

Page /self-review :
good for now

Page /peer-input :
a staff member should be able to :
-> request peer inputs (to be reviewed by manager), if not already set by manager.
-> if already set or accepted by manager, just see the status of the ongoing peer reviews.
-> see requests received to peer review someone. clicking on answer a peer review request should open a page specific page with the form (follow the same best practice as the self-review form)
-> when peer reviews are submitted, see "submitted". a staff can't reopen himself a peer review he submitted. a manager of the person being reviewed can reopen.

Page /assessment :
a staff member should be able to see :
-> direct reports (local or functional) :
status of reviews.
if ready (self and peers done), possibility to start assessment.
on the assessment page, the content of self and peers should be accessible (toggleable)

-> indirect reports :
status of reviews.
if ready (self and peers done), possibility to start assessment [warning to say it should be done by direct manager].
on the assessment page, the content of self and peers should be accessible (toggleable)
