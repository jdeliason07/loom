# Creator outreach

The operational half of the micro-influencer plan. None of this is on the
website and none of it should be — a storefront that explains its own
acquisition strategy to its customers is a strange thing to build. The one
piece that *is* on the website is `creators.html`, and it exists because
step 3 below needs somewhere to point.

## What the site already does for this

Two things were built before this document and neither needs replacing:

- **Attribution.** `?ref=janedoe` on any link is captured by `track.js`,
  kept as first touch in `localStorage`, and carried into Stripe as
  `client_reference_id` on the payment itself. Sorting the Stripe payments
  list is how creators get paid. See "Knowing which creator sold it" in the
  README.
- **The honesty rule on the creators wall.** Every face in "Trusted by" is a
  silhouette until a real person has said we may use theirs. The optional
  portrait box on `creators.html` is how that permission arrives.

**UpPromote and Shopify Collabs do not apply here.** Both are Shopify apps
and this is a static site on a Stripe Payment Link — there is no Shopify
store for them to attach to. Adopting either means moving the storefront to
Shopify, which is a much larger decision than picking an affiliate tool. The
`?ref=` chain above already does the job the affiliate app would do; what it
does not do is generate links, mail creators their stats, or calculate
payouts, and those stay manual until the volume hurts.

## The sequence

1. **Find them.** Under 10k followers, in the neighbourhood of the product —
   people who make things and film themselves doing it. Higher engagement,
   cheaper attention, and far more likely to answer, because they get
   offered far less.

2. **Warm up first.** Before any pitch: read the profile, like the last two
   or three posts, leave a comment that could only have been written about
   that specific post. When the message lands next to a notification they
   already recognise, it is not a cold open. Skipping this is what makes an
   outreach message indistinguishable from a bot, and it is the step that
   gets dropped first when chasing volume.

3. **Message them.** Instagram or TikTok DMs, not email — a nano creator's
   inbox is a graveyard and their DMs are not. Short, and entirely about
   what they get:

   > Hey [name] — your [specific thing they made] came up and I watched the
   > whole thing, which I don't usually.
   >
   > We make one product: No. 01, a one-piece glass bottle. I'd like to send
   > you one. Free, yours, nothing owed — if it's not your thing, keep it and
   > say nothing.
   >
   > If you do end up filming it there's a link that pays you a commission on
   > anything it sells, but that's your call to make after it turns up, not a
   > condition of getting one.
   >
   > Everything's here if you want it: vates.store/creators.html

   The link is the whole point of the last line. **Do not collect mailing
   addresses in a DM thread.** An Instagram inbox full of strangers' home
   addresses is a pile of personal data with no record of who agreed to
   what, no deletion path, and nothing to show a regulator. The form exists
   so the address arrives somewhere with the consent boxes attached to it.

4. **Ship it.** No platform to sign up for, no account to create, no
   contract to read before a sample. Product first.

5. **Set up their link.** `https://vates.store/?ref=theirhandle`, sent once
   the parcel has landed rather than before — it reads as a favour after the
   fact and as an obligation before it.

6. **Follow up once.** Ask whether it arrived. If they ticked the paid-ads
   box on the form, this is when the actual terms get agreed — how long,
   which platforms, what it pays — in writing, before anything runs. Creator
   footage does tend to outperform studio footage as paid social, which is
   exactly why it is worth paying properly for rather than assuming a free
   bottle bought it.

## Disclosure is not optional

If we give someone a product and they post about it, that is a material
connection and it has to be disclosed — this is FTC law in the US and
comparable rules elsewhere, and it binds the brand as well as the creator.
The same goes for an affiliate link that pays them.

So: say it in the DM, say it on `creators.html` (there is a required
checkbox), and say it again in the follow-up. A creator who buries `#ad` at
the end of a description box has not disclosed. This is the one place in the
whole sequence where "keep it low-friction" loses, and it loses on purpose.

## On volume

The plan calls for 50–100 personalised messages a week. That number is
right, but the reason given for it is backwards: creators under 10k get
*fewer* offers, so they accept at a *higher* rate than larger accounts, not
a lower one. Volume is needed because the roster needs to be large and
rolling — most people who accept a bottle never post, and that is fine and
priced in — not because the pitch converts badly.

Watch what volume does to step 2. A hundred genuine comments a week is
several hours of actually watching people's videos. The moment the warm-up
becomes a fire emoji on the top post, the reply rate goes with it, and the
sensible move is fewer messages rather than a cheaper warm-up.
