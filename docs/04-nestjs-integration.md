# 4. Search in a NestJS app

The example app in [`app/`](../app) puts everything together: **PostgreSQL is the source of truth, Elasticsearch is the search index.**

```text
POST /courses  ──▶  save in PostgreSQL  ──▶  index a copy in Elasticsearch  ──▶  201 Created

GET /search/courses?q=...  ──▶  ask Elasticsearch  ──▶  JSON hits          (PostgreSQL is not involved)
```

The PostgreSQL id is also the Elasticsearch `_id`, so the two systems always point at the same course.

## Run it

From the repo root:

```bash
docker compose up -d elasticsearch db        # add "kibana" if you also want Dev Tools
cd app
cp .env.example .env                         # on Windows (cmd): copy .env.example .env
npm install
npm run start:dev                            # creates the "course" table and the index
```

In a second terminal (also in `app/`):

```bash
npm run db:seed                              # 42 courses into PostgreSQL
curl -X POST http://localhost:3000/search/reindex     # copy them into Elasticsearch
```

Open <http://localhost:3000/>. You should see the search page with green status dots. Try `databse`, then switch to **Compare with SQL LIKE**.

If port 5432 is taken by another PostgreSQL, set `POSTGRES_PORT=5433` in the root `.env` and use `...localhost:5433/university` in `app/.env`.

## Endpoints

| Method and path | What it does |
|---|---|
| `GET /` | The search page |
| `GET /health` | Checks PostgreSQL and Elasticsearch, returns both versions |
| `GET /courses` | All courses from PostgreSQL |
| `GET /courses/:id` | One course (404 if unknown) |
| `POST /courses` | Create: saves in PostgreSQL, then indexes a copy |
| `PATCH /courses/:id` | Update: saves, then replaces the document in the index |
| `DELETE /courses/:id` | Delete from both systems |
| `GET /courses/like?q=` | The "before" picture: SQL `ILIKE`, no ranking, no typo tolerance |
| `GET /search/courses?q=` | The simple search from the slides: `multi_match`, fuzziness, highlighting |
| `GET /search/explore?q=&minEcts=&tag=&page=&size=` | The search behind the web page: filters, tag facets, paging |
| `POST /search/reindex` | Rebuild the whole index from PostgreSQL |

Example:

```bash
curl "http://localhost:3000/search/courses?q=databse"
curl "http://localhost:3000/search/explore?q=web&minEcts=5"
curl -X POST http://localhost:3000/courses -H "content-type: application/json" -d '{
  "code": "WEB320", "title": "Advanced Web Development", "ects": 5, "lecturer": "Dr. Weber",
  "description": "Build a production web application.", "maxParticipants": 30, "tags": ["web"]
}'
```

## Where the code is

| File | Job |
|---|---|
| [`src/search/elasticsearch.provider.ts`](../app/src/search/elasticsearch.provider.ts) | One Elasticsearch client, address from `ELASTICSEARCH_URL`, shared by dependency injection |
| [`src/courses/courses.service.ts`](../app/src/courses/courses.service.ts) | **Index on write**: `create`, `update` and `remove` write to PostgreSQL, then to the index |
| [`src/search/search.service.ts`](../app/src/search/search.service.ts) | `search` (the slide version), `explore` (filters, facets, highlighting), `reindex` |
| [`src/search/course-document.ts`](../app/src/search/course-document.ts) | `toDocument`: PostgreSQL row in, Elasticsearch document out |
| [`src/search/course-index.ts`](../app/src/search/course-index.ts) | The mapping (a test checks it equals `seed/mapping.json`) |
| [`src/courses/courses-search.e2e.spec.ts`](../app/src/courses/courses-search.e2e.spec.ts) | The tests, written as plain sentences in the header |
| [`public/index.html`](../app/public/index.html) | The search page: one file, no build step |

## Keeping both systems in sync

This is the hard part of using a search index next to a database.

| Strategy | How it works | The trap |
|---|---|---|
| **Dual write** (what this app does) | The code writes to both systems | The second write can fail, so they drift apart |
| **Reindex job** (`POST /search/reindex`) | Rebuild the index from PostgreSQL | Stale between runs, heavy on big tables |
| **Outbox pattern** | Save an event in the same transaction, a worker indexes it | More code, but no lost updates |
| **Change data capture** | A tool (for example Debezium) streams changes out of PostgreSQL | Extra infrastructure to run |

This app uses dual write plus a reindex endpoint as the safety net. What happens if the Elasticsearch call fails after PostgreSQL succeeded? The row exists, the index does not know it, and `POST /search/reindex` repairs it. There is a test for exactly that.

Two more details worth reading in the code:

- `refresh: 'wait_for'` on the index calls makes the HTTP response wait until the document is searchable. Perfect for tests and demos (search right after create). It slows writes, so think twice in production.
- `explore` uses `post_filter` for the tag. Facet counts are computed before it, so the tag facet keeps showing all tags while one is selected. That is how shop-style facets work.

## Tests

```bash
cd app
npm test
```

The tests start the real app against the real PostgreSQL and Elasticsearch. They use their own index (`courses_e2e`) and delete everything they create, so your demo data is untouched.

## Stretch exercise

The branch `starter` has the same app with two methods left empty: `SearchService.search` and the indexing call in `CoursesService.create`. Make `npm test` pass again. See [`lab/README.md`](../lab/README.md).

Next: [5. Pitfalls and FAQ](05-pitfalls-and-faq.md)
