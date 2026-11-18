# Live demo

The demo runs in three layers. Use as many as the room needs.

| Layer | What | When |
|---|---|---|
| **1. Kibana Dev Tools** | [`kibana-console.txt`](kibana-console.txt): 22 requests in teaching order | The main demo |
| **2. The web page** | `app/` at <http://localhost:3000/>: search-as-you-type, highlighting, SQL-vs-Elasticsearch compare mode | The finale |
| **3. The terminal** | `npm run demo`: runs every request and checks the result | Fallback if the console fails, and a self-test before you start |

The Kibana and terminal demos use the same requests from [`requests.mjs`](requests.mjs). The web page uses the NestJS API to show similar searches on the same course catalog.

## Rehearse offline

From the repository root, run:

```bash
npm run demo -- --preview
npm run demo -- --preview --step
```

The preview prints each presenter cue, HTTP request, and expected result. With `--step`, press Enter when the class has made its prediction. Run `npm run demo` with Elasticsearch running to verify the results live.

## Follow the code in VS Code

| Open | What to look for |
|---|---|
| [`requests.mjs`](requests.mjs) | Start with `typo-plain` and the fuzzy query that follows it. The `body` is the query and `expect` tells the runner what to check. |
| [`scripts/demo.mjs`](../scripts/demo.mjs) | The loop prints each step, then previews the expectation or sends the request and checks the response. |
| [`scripts/lib.mjs`](../scripts/lib.mjs) | `es()` sends the HTTP request. It uses POST for searches with a JSON body because Node fetch disallows GET bodies. |
| [`app/public/index.html`](../app/public/index.html) | The search page calls `/search/explore` for ranked results and `/courses/like` for the SQL comparison. |
| [`search.service.ts`](../app/src/search/search.service.ts) and [`courses.service.ts`](../app/src/courses/courses.service.ts) | The search service queries Elasticsearch. The courses service uses PostgreSQL and updates the indexed copies when courses change. |

## Before the session

```bash
docker compose up -d                 # Elasticsearch, Kibana, PostgreSQL (pull the images on a fast connection first)
npm run es:setup                     # create the "courses" index and load 42 courses
npm run demo                         # self-test: every step must say OK
```

- [ ] Kibana is up at <http://localhost:5601> (it needs a minute). Open Dev Tools and paste [`kibana-console.txt`](kibana-console.txt).
- [ ] Course **13 must not exist** before the lab: `GET courses/_doc/13` answers 404. (`npm run demo` cleans up after itself.)
- [ ] For the finale: `cd app`, `cp .env.example .env`, `npm install`, `npm run start:dev`, then `npm run db:seed` and `curl -X POST localhost:3000/search/reindex`.
- [ ] A PostgreSQL console ready for the first demo (`docker compose exec db psql -U postgres -d university`), or the VS Code database view.
- [ ] Reset between runs: `npm run es:reset`.

If something is off, `npm run demo` tells you which step differs from what the slides promise.

## The flow

Slide numbers refer to `slides/Elasticsearch(RS).pptx`. **Predict first, then run** is the rule for the whole demo.

### The hook (slide 13)

1. In PostgreSQL: `SELECT title FROM course WHERE description ILIKE '%databse%';` → **0 rows**.
2. In Kibana: the *typo with fuzziness AUTO* request → **Introduction to Databases** first, 21 hits.
3. Do not explain how yet. Say: "by the end of part one you will know exactly why this works."

### Analyzers (slide 18)

Run both `_analyze` requests. The `english` analyzer turns `Searching the Databases quickly` into `search`, `databas`, `quickli`. Point out `quickli`: rules, not a dictionary. The `title` field gives `web`, `development`, `fundamentals`.

### First index and first search (slides 26 to 28)

`docker compose up -d`, `PUT courses` with the mapping, `_bulk`, then the first `match` on `description` for `databases`. Show `hits.total`, `hits.hits`, `_id`, `_score`, `_source`. The top hit is NoSQL Databases (score about 2.1). Introduction to Databases is found too: its text only says "database". That is the analyzer at work.

### Demo 1: exact lookup (slides 29 and 30)

Rehan reads the choices and takes a vote: what will a search for `MI150` return? Then: **"Sanath, run the exact lookup."** One hit: course 8, Web Design. Same job as `WHERE code = 'MI150'`. Ask: and with lowercase `mi150`? Nothing: `term` is exact and case-sensitive.

### Demo 2: either word or both (slides 32 and 33)

Run the either-word query first and show the four IDs: 8, 10, 11, 12. Pairs predict for thirty seconds: which IDs stay if both words are required? Rerun with `"operator": "and"`: **10 and 12**. Ask: which two disappear and which word is each missing? (8 lacks "development", 11 lacks "web".)

### Demo 3: the ECTS filter (slides 35 and 36)

Keep the both-words query on screen. Which match survives a minimum of 5 ECTS? Run it with the range in `bool.filter`: **10** (course 12 is worth only 3). Follow-up: what if we lower the minimum to 3? Both come back. Matching decides who qualifies, ranking orders the matches, filtering removes documents without touching the score.

### Query DSL tour (slides 37 to 41)

`multi_match` without and with `title^3` (scores 2.86 and 2.52 become 8.59 and 7.57), fuzziness, highlighting (`<em>database</em>`), aggregations (`data` 13, `backend` 12), then the **AI check**: `term` on `title` with `Databases` returns 0 hits. Ask the room why before you explain.

### Pair lab (slides 42 to 45)

See [`../lab/README.md`](../lab/README.md). The insert request for course 13 is the last step of `requests.mjs`. Run the whole thing yourself once as the model answer, then `DELETE courses/_doc/13` again before the room starts.

### The finale: the web page (slide 51)

Open <http://localhost:3000/>.

1. Type `databse`. Use the **Light / dark** button: light is easier to read on a projector. Results appear as you type, the matched words are highlighted, the tag facets on the left count the matches.
2. Click **Compare with SQL LIKE**: **0 rows** on the left, 21 ranked results on the right. This is slide 13, but as a product.
3. Try the chips: `web developmnt`, `serch engin`, `dokcer`, and the sentence `how search engines find documents`.
4. Click a tag, set **Minimum ECTS** to 5: filters combine with the text query.
5. Open **Write side**, add a course (for example title `Quantum Computing Lab`), and search for it straight away. It is findable immediately because the write waited for the refresh.
6. Click **Rebuild index from PostgreSQL**: the index is a copy and can always be rebuilt.
7. Ask: what would students see if the database title changed first? (The old title, until the index catches up.)

## If something fails on stage

| Problem | Fallback |
|---|---|
| Kibana is not up yet | Use `demo/demo.http` in VS Code (REST Client extension) or `curl` |
| Elasticsearch is unavailable | `npm run demo -- --preview --step` shows the scripted expectations, or use the slides |
| A step shows a different result | `npm run es:reset` and run the step again |
| The web page is empty | `curl -X POST localhost:3000/search/reindex` |

## Changing the demo

Edit [`requests.mjs`](requests.mjs), then regenerate the copy-paste files and check everything:

```bash
npm run demo:files     # rewrites kibana-console.txt and demo.http
npm run demo           # runs and verifies all steps
```
