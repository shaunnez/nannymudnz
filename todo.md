# Todo
Loading screen 4v4 single player not great too much vertical space
Characters needs shadows like in lf2 (trailing behind, look good when jumping - i think they shrink)
Need to fix animations across the board to use new VFX (write a list of which VFX is applied to which ability)
Need to fix map screenshots (use playwright, make characters invisible so they don't show)
Need better audio across attacks (to be figured out later)
Need better audio per stage or game mode (to be provided by me)
Fix move list to use new vfx and look tidier (once aligned with 4)
Fix dossier to use new vfx and look tidier (after 8)

Run balancer again - keeping in mind cultist seems very strong. 

I want NPC ranger heroes in 4v4 (battle mode and 1v1 cpu) to run away (need to check if thats happening)

Ideally with new tests, as i add features, AI is checking relevant screen and screenshotting.

Android - not good

Add screenshots for mobile mode as well in test plan.

Bugs for Multiplayer 1v1 - player 1 is fine, player 2 is not.

Bug 0 - Choose your guild - player 2 locks in a guild, on their screen it shows they are P1

Bug 1 - Room lobby - P1 should be at top, players should be in order they joined. Currently for player 2 it shows them at top (i.e. in p1 position).

Bug 2 - MP Loading screen -  for player 2, it shows them as player 1 and on the left hand side of the screen

Bug 3 - Mp Game - P1 sees the correct header (their avatar + health) followed by P2, however P2 is flipped. On left side of screen it shows them as P1 when they should be on p2

Bug 4 - Final tally - again P1 is correct. But P2 shows "Victor P2" when it hsould be "Victor P1", and on the right stats it's also flipped for P2 and it says "P2 wins".

It's very hard to know in the screens folder which screen relates to which mode of if anything is shared.

I think if we could map it out so we know the below (keep in mind i'm making up the file names but you get the gist)

Versus -> Guild picker.tsx (or whatever it is) -> BattleFieldpicker.tsx -> Game loader.tsx -> Versus Game mode.tsx -> versus results.tsx

And then the same for stage mode, survival, and battle.

These all work FINE for the most part.

Then we need to do the same for multiplayer.

I have a feeling multiplayer and game state is a bug  jumbled, as depending on if you go multiplayer 1v1 versus 4v4 we get diff screens during game, results etc.