# Mini ISE — the talk

Word-for-word script for the 13-slide deck. **about 13 minutes**
at a normal speaking pace (~150 wpm).

For a hard ten-minute slot, don't read slides 3 and 9 (the two demos) word for
word. Press the buttons, say one sentence per thing that happens, and let the
screen do the talking. That alone gets you under ten.

Rewrite any of this in your own words. The point is that you sound like you,
not like a script. Read it out loud twice and the phrasing starts drifting
toward how you actually talk — let it.

**Shape of the talk:** the one scaling idea that matters (2–3) → what I built
(4) → watch it decide (5) → the services and the API (6–8) → how the project
uses that idea (9–10) → watch it scale (11) → the honest limit (12) →
questions (13).

The theory comes **first**, deliberately: by the time the project appears, the
room already has the idea it demonstrates.

The slides are deliberately terse. **The wording lives here and in the
speaker notes — press `N` in the deck.**

---

## Slide 1 — Mini ISE  *(~25 seconds)*

Hi, I'm Sai. For the next ten minutes I want to show you something I built
called Mini ISE — a small version of the software that decides which laptops
and phones are allowed onto a company network.

I'm going to do this slightly backwards. First, two slides on how you actually
add capacity to a system — because there is one idea in there that decides
everything else. Then I'll show you the thing I built, and you'll see that
idea doing real work.

---

## Slide 2 — Up, or out.  *(~60 seconds)*

Before I show you anything I built, I want to set up the one idea the whole
project rests on.

Every service that gets used hits the same wall eventually: more requests
arriving than one machine can answer.

And when you need more capacity, there are only two moves.

**Up** — vertical scaling. Buy a bigger machine. More cores, more memory. The
big advantage is that your code doesn't change at all; it's close to a config
line. The disadvantages are that there's a hard ceiling — there is a biggest
machine you can rent — it gets expensive quickly at the top end, and it's
still one machine. When it dies, all of it dies.

**Out** — horizontal scaling. Buy more machines. There's no real ceiling, the
cost per unit is lower, and losing one costs you a fraction of your capacity
instead of all of it. The price is complexity: now you need a load balancer,
you need to cope with machines appearing and disappearing, and your
application has to stop caring which machine it lands on.

And the honest advice that most companies actually follow is: go **up**
first. It's simpler, and it's usually enough for longer than people expect.
Go out when you hit the ceiling, or when one machine being one outage stops
being acceptable.

---

## Slide 3 — State decides which one you can do.  *(~60 seconds)*

Except you don't always get to choose. And the thing that decides it is
**state** — whether a machine remembers anything between requests.

If your service is **stateless**, any machine can answer any request. Adding
capacity is nearly trivial: start another copy, point the load balancer at
it, done. Web servers and API servers are usually like this.

If it's **stateful**, it's a completely different problem. A specific piece
of data lives on a specific machine, and the request has to find it. That's
where the hard techniques come in — replication, so there's more than one
copy; sharding, so the data is split by key; and consensus, so the copies
agree on what's actually true.

Databases are the classic stateful thing, and this is exactly why scaling a
database is a genuinely hard problem while scaling a web tier is mostly a
config change.

So the real design move — the one that matters — is to push state *out* of
the things you want to scale, and concentrate it in as few places as you can.

---

## Slide 4 — Mini ISE, in four pieces  *(~65 seconds)*

So that's the theory. Here's the thing I built, and it has exactly that
problem.

Mini ISE is a small version of the software that decides which laptops and
phones are allowed onto a company network. The real ones are big enterprise
products — this is the same idea, small enough that I can explain all of it.

The idea it implements is **zero trust**. In an old corporate network, once
you were inside the building, you were trusted. Zero trust throws that out:
every single request gets checked, every time, and it doesn't matter that you
checked thirty seconds ago.

**Four pieces.**

The **decision service** is the one that answers. A device asks "can this
user, on this laptop, from this location, reach the finance database right
now" — and it says allow, deny or quarantine. Always with a reason, because
when someone is locked out at nine in the morning, the help desk needs to know
*which rule* did it.

The **policy API** is where the rules live, and where an admin can describe a
rule in plain English and have Claude draft it — a person still approves it
before it goes live.

The **console** is React. That's where admins write rules and watch decisions
arrive.

And the **simulator** throws realistic device traffic at the whole thing, so
there is something to watch.

Everything there is real except the devices. Real Python, real FastAPI, real
Postgres, real Kubernetes.

---

## Slide 5 — Watch it decide  *(~50 seconds)*

Let me show you it actually working.

These requests are invented — I'm generating fake devices. But the thing
*deciding* is the real engine. It's the same rule code the pods run, compiled
to the browser, and it's tested against the same set of cases in CI, so the
two can't quietly disagree.

Watch the reasons rather than the verdicts. Every answer names the rule that
produced it.

And there's the third verdict — quarantine. That is not "we think you've been
hacked." That's a device that failed a posture check, usually an unencrypted
disk. It gets a restricted segment where it can reach the tool that fixes it,
and nothing else.

*(Press **Start traffic**. Let it run four or five rows, then pause. **Send
one** fires a single request if you want to talk over a specific verdict.)*

---

## Slide 6 — How it's put together.  *(~50 seconds)*

So, here's the architecture.

Top row: the React console, TypeScript, that's where admins live. It talks to
a policy API written in Python with FastAPI, which reads and writes policies
in Postgres.

Bottom row, completely separate: the decision service. Also Python, also
FastAPI. That's the one answering access requests. I've got a simulator
throwing realistic device traffic at it so there's something to watch.

The important thing is that those are two separate services, and that was
deliberate. The policy API is used by a handful of admins clicking buttons.
The decision service answers thousands of requests a second. They have
nothing in common in terms of load, so they shouldn't share a fate — if an
admin runs an expensive report, it should not slow down the front door.

That's the blast radius idea from two slides ago, applied.

---

## Slide 7 — Two services, eight endpoints  *(~55 seconds)*

Let me show you the actual API, because the shape of it is the design.

The decision service has **one endpoint that matters**: `POST /v1/decide`.
That's it. That is the entire hot path — a device asks, it answers.

The other two are health checks, and they are not the same question.
`/healthz` means "am I alive" — if that fails, Kubernetes restarts the pod.
`/readyz` means "should I be getting traffic" — if that fails, Kubernetes
simply stops sending it any. That second one is the readiness gate, and it is
what stops a brand new pod answering before its policies have loaded.

The policy API has everything else: create, read, update and delete policies,
the drafting endpoint where Claude turns plain English into a policy for a
person to approve, the decision log, and the stats the console charts.

And that split is the whole point. One endpoint carries all the load. Seven
do admin work for a handful of people. Which is exactly why one of these
services runs six pods and the other runs one.

---

## Slide 8 — What one request actually touches  *(~50 seconds)*

So what actually happens inside that one endpoint.

A request comes in. The service evaluates the rules against it — in memory,
in Python — and returns allow, deny or quarantine, with the reason. That is
the whole path. Under a millisecond.

And notice what is *not* on it: no database call, no cache lookup, no call to
another service.

Everything that does touch the database is off to the side, and I've drawn it
dashed. Policies come **in** on a background task every three seconds.
Decision logs go **out** buffered, in batches.

That is the only really clever thing in this project: the slow thing and the
fast thing were separated, so the fast thing stays fast even when the slow
thing is broken.

---

## Slide 9 — The decision service holds no state.  *(~60 seconds)*

And this is the design choice the whole thing rests on.

The policies live in memory, inside each pod. A background task refreshes
them every three seconds. So when a request arrives, answering it touches no
network at all — no database call, no cache lookup. It's just Python
evaluating rules against a request in memory. That's how it stays under a
millisecond.

The decision log still has to be written, obviously. But those rows get
buffered and written to Postgres in batches, off the hot path. And the buffer
is capped at ten thousand rows, so if the database goes away for an hour, the
service doesn't eat all its memory and fall over.

Two failure behaviours I want to call out, because I think they're the
interesting part. If Postgres disappears, the service keeps deciding, using
the last policies it loaded. It degrades — it doesn't stop. And if a pod
hasn't loaded its policies yet, it denies everything. It fails closed. In
security, failing *open* is how you end up in the news.

The payoff: because no pod holds anything unique, any pod can answer any
request. That’s the stateless property from the start of the talk. Which means I can
just add pods.

---

## Slide 10 — So Kubernetes just adds pods.  *(~60 seconds)*

And that's exactly what Kubernetes does.

Follow the diagram left to right. At normal load I'm running two pods of the
decision service. As requests arrive faster, CPU on those pods climbs. The
horizontal pod autoscaler is watching that number, and when it crosses the
target, Kubernetes starts new pods — up to six. The service spreads requests
across all of them. When traffic drops, it scales back in, because pods cost
money.

Two details that make this actually work, rather than just look good on a
slide.

First — **readiness**. A brand new pod is not ready the moment it starts; it
has to load policies first. So there's a readiness check, and Kubernetes
won't send it a single request until it passes. Without that, scaling up
would cause a burst of denials, which is worse than being slow.

Second — **self-healing**. If I delete a pod right now, and it's one command,
Kubernetes notices and starts a replacement, and traffic keeps flowing the
whole time because the other pods are still answering. That's the blast
radius payoff, live.

And you can watch all of it in the console — it shows decisions per pod, so
you literally see new pods start taking work.

---

## Slide 11 — Watch it scale  *(~60 seconds)*

I can't bring a Kubernetes cluster into this room, so this is a simulation —
and it says so on the slide. The code that really does this is in the repo,
and it's one `make` command.

Here we are at normal load: two pods, CPU comfortable.

Now I'll turn the load up. That's `make load-high`.

CPU crosses the target, and the autoscaler starts pods. Notice the new ones
come up dashed — they are **not taking traffic yet**, because they still have
to load their policies and pass the readiness check. That's the detail that
stops a scale-up causing a burst of denials.

And now let me kill one. Kubernetes notices immediately and starts a
replacement, which also has to pass readiness before it gets traffic. The
decision count on the other pods never stops climbing — that's the blast
radius idea, live.

*(**Start** → **Load: high** → wait for six pods → **Kill a pod**. **Reset**
puts it back to two if you want to run it twice.)*

---

## Slide 12 — What doesn't scale out.  *(~50 seconds)*

One honest limitation, because every system has one.

Postgres here is a single instance, and it's the only stateful thing in the
system. Which makes it, technically, a single point of failure.

What I did about it is push it off the critical path entirely. Policies are
cached in memory, so a decision never reads from it. Logs are batched, so a
decision never writes to it. The database being slow or gone does not stop
devices getting onto the network — it just means the audit log lags behind.

If traffic went up a hundred times, I'd put the decision log behind a queue,
so writes get absorbed rather than buffered in process memory, and I'd add
read replicas for the console's reporting.

I would not shard it. You shard when you have run out of other options, and I
haven't.

---

## Slide 13 — Thank you.  *(~25 seconds)*

That's Mini ISE. Python and FastAPI for the two services, React and
TypeScript for the console, Kubernetes for the scaling.

The code, and a page where you can try the policy engine yourself, are at
these links.

Happy to take questions.

---

# Questions you should be ready for

**"Why not just use one bigger machine?"** — For a while, you should — and I say so on the
"up or out" slide. I went horizontal here because this is the front door:
one big machine is also one big outage. Six pods across nodes means losing
one costs a sixth of capacity, not all of it.

**"Have you actually measured it?"** — The decision path is in-memory rule
evaluation, and the service reports per-decision latency, which the console
displays per pod. The autoscaler triggers on CPU, which is the real
constraint when nothing touches the network.

**"Where does the AI fit?"** — An admin can describe a rule in plain English
and Claude drafts the policy, but a person approves it before it goes live.
The model is never on the decision path. Decisions have to be reproducible
for audits, they can't depend on an external API being up, and device data
should never reach a prompt.

**"Why two services instead of one?"** — Different load shapes and different
blast radius. Also different scaling needs: I want six decision pods and one
policy API, and you can't express that if they're one deployment.

**"How do you know the browser demo matches the real engine?"** — Both run
the same cases from `fixtures/policy-cases.json` in CI, so they can't quietly
disagree.

**"Isn't three seconds of policy staleness a problem?"** — It's a deliberate
trade: three seconds of staleness buys a database-free hot path. If a
policy needed to take effect instantly, I'd push it to pods rather than have
them poll — but that adds a delivery system I don't need yet.

**"What would you do differently?"** — I'd add the queue in front of the
decision log earlier. Buffering in process memory works, and it's bounded, but
it means a long database outage silently drops audit rows, and audit rows are
the kind of thing people care about after the fact.
