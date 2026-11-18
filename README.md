# Search indexes with Elasticsearch

Seminar material for the Database course at SRH Berlin (WiSe 2026/27), by Rehan Tariq and Sanath Narayana.

PostgreSQL keeps your data correct. **Elasticsearch finds things in it**: free text, typos, ranking, filters, highlighting. This repository has everything for the seminar in one place: the concepts, a live demo you can run yourself, a pair lab, and a small NestJS app that keeps PostgreSQL and Elasticsearch in sync.

| | |
|---|---|
| **Learn** | What Elasticsearch is, how it compares with PostgreSQL and SQL, how search works inside, [five short chapters](docs/) |
| **Watch** | A [live demo](demo/README.md) in three layers: Kibana, a web page, and a terminal script that checks every result |
| **Practice** | A [pair lab](lab/README.md) with an answer key and an automatic check |
| **Build** | A [NestJS app](app/) with PostgreSQL as the source of truth, Elasticsearch as the search index, and end-to-end tests |
| **Present** | The [slides](slides/) (PowerPoint, opens in Google Slides) |

## What is Elasticsearch?

A search engine for your data. You store JSON documents and ask questions over a REST API. It sits **next to** your database, not instead of it.

```text
   NestJS API ──── writes, reads by id ────▶  PostgreSQL       the source of truth
        └──────── index a copy, search ───▶  Elasticsearch     the search copy
```

If the index is lost, you rebuild it from PostgreSQL. The other way round does not work.

The running example is a university course catalog, with three different jobs:

| Job | Question | SQL you know | Elasticsearch |
|---|---|---|---|
| Exact lookup | Which course has code `MI150`? | `WHERE code = 'MI150'` | `term` on a `keyword` field |
| Full-text search | Which titles are relevant to "web development"? | `LIKE '%web%'` is not enough | `match` on a `text` field |
| Numeric filter | Keep courses worth at least 5 ECTS | `WHERE ects >= 5` | `range` in `bool.filter` |

### Words you know, new names

| PostgreSQL and SQL | Elasticsearch |
|---|---|
| Table | Index |
| Row | Document (JSON) |
| Column | Field |
| Table schema | Mapping |
| Primary key | `_id` |
| SQL | Query DSL (JSON over REST) |
| `WHERE name LIKE '%x%'` | `match` query |
| `ORDER BY` | Relevance score (`_score`) |
| B-tree index | Inverted index |
| `JOIN` | No joins: store the data flattened |
| ACID transactions | No transactions, near-real-time |

More in [chapter 1](docs/01-what-is-elasticsearch.md).

## Before the session: setup

Please finish this **at least 2 days before the session**, so there is time to help if something does not work. It takes about 15 minutes, most of it downloading Docker images.

### 1. Install the software

- **Docker Desktop** (Windows, macOS) or Docker Engine with the Compose plugin (Linux), with at least **4 GB of memory** for Docker
- **Node.js** 22 or newer (LTS), including npm
- **Git**
- An editor, for example VS Code

### 2. Start Elasticsearch and Kibana

```bash
git clone https://github.com/rehantariq6000-lab/elasticsearch-seminar.git
cd elasticsearch-seminar
docker compose up -d
```

The first start downloads the images (about 4 GB of disk space in total). Kibana needs a minute after Elasticsearch.

### 3. Check that it works

```bash
curl http://localhost:9200
```

**Success** looks like this (the version number can differ slightly):

```json
{
  "version": { "number": "9.5.6", ... },
  "tagline": "You Know, for Search"
}
```

Then open <http://localhost:5601> (Kibana) and click **Dev Tools** in the menu. That is the console we use in the session.

### 4. Load the course data

```bash
npm run es:setup
```

```text
Created index "courses" with the course mapping.
Loaded 42 courses. The index now holds 42 documents.
```

You are ready for the session.

**If it does not work:** see the [FAQ](docs/05-pitfalls-and-faq.md). Bring your laptop anyway, you can pair with a neighbour.

## Try it in two minutes

Paste this into Kibana Dev Tools. It is the whole point of the seminar:

```text
GET courses/_search
{
  "query": {
    "match": { "description": { "query": "databse", "fuzziness": "AUTO" } }
  }
}
```

A typo goes in, **Introduction to Databases** comes out first. In PostgreSQL, `ILIKE '%databse%'` finds 0 rows.

For the full guided demo: `npm run demo` runs every request and checks the result.

## During the session

- Follow along in Kibana Dev Tools. All requests are in [`demo/kibana-console.txt`](demo/kibana-console.txt).
- The pair lab is in [`lab/`](lab/README.md).
- Fallen behind? Every slide before an exercise shows the request you need, and [`lab/solution.txt`](lab/solution.txt) has the answers.

## What is in this repository

```text
README.md              this file
docker-compose.yml     Elasticsearch, Kibana and PostgreSQL
docs/                  five short chapters: concepts, how search works, cheat sheet, NestJS, pitfalls
demo/                  the live demo: requests, Kibana and VS Code versions, presenter guide
lab/                   the pair lab: starter, solution, answer key
app/                   the NestJS example app, with web page and tests
seed/                  the 42 courses and the index mapping
scripts/               setup, demo runner, lab check (plain Node, no dependencies)
slides/                the seminar slides
```

## The example app

`app/` is a small NestJS project. PostgreSQL holds the courses, Elasticsearch holds a searchable copy, and every write goes to both. It has a search page with search-as-you-type, highlighting, tag facets and a side-by-side comparison with SQL `LIKE`.

```bash
docker compose up -d elasticsearch db
cd app
cp .env.example .env
npm install
npm run start:dev          # then open http://localhost:3000
```

In a second terminal: `npm run db:seed` and `curl -X POST http://localhost:3000/search/reindex`. Details in [chapter 4](docs/04-nestjs-integration.md).

## Useful commands

| Command | What it does |
|---|---|
| `docker compose up -d` | Start Elasticsearch, Kibana and PostgreSQL |
| `docker compose down` | Stop everything (data is kept in Docker volumes) |
| `npm run es:setup` | Create the `courses` index and load the 42 courses |
| `npm run es:reset` | Delete the index first, then load again |
| `npm run demo` | Run the whole demo and check every result |
| `npm run demo -- --step` | The same, pausing after every step |
| `npm run demo:files` | Regenerate `kibana-console.txt` and `demo.http` from `demo/requests.mjs` |
| `npm run lab:check` | Check task 3 of the pair lab |
| `cd app && npm run start:dev` | Start the example app |
| `cd app && npm test` | Run the end-to-end tests (needs Elasticsearch and PostgreSQL) |

## Versions

Elasticsearch and Kibana 9.5.6, PostgreSQL 17, Node.js 22 or newer, `@elastic/elasticsearch` 9.5.1, NestJS 12.

## License

[MIT](LICENSE)
