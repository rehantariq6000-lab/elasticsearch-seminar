# 1. What is Elasticsearch?

Elasticsearch is a **search engine for your data**. You store JSON documents in it and ask questions over a REST API. It is built on Apache Lucene, a search library. Elasticsearch adds the distributed part (shards, replicas), the HTTP interface and the JSON layer on top.

```text
POST courses/_doc      send a JSON document in
GET  courses/_search   ask a question, get ranked hits back
```

## Where it fits

Elasticsearch does **not replace** your database. It sits next to it.

```text
                  writes, reads by id
   NestJS API ───────────────────────────▶  PostgreSQL     the source of truth
        │                                    relations, transactions, exact data
        │        index a copy, search
        └──────────────────────────────────▶  Elasticsearch   the search copy
                                              text search, ranking, typo tolerance
```

If the index is ever lost, you rebuild it from PostgreSQL. The other way round does not work.

## Three different jobs

The running example in this seminar is a university course catalog.

| Job | Question | SQL you already know | Elasticsearch |
|---|---|---|---|
| Exact lookup | Which course has code `MI150`? | `WHERE code = 'MI150'` | `term` on a `keyword` field |
| Full-text search | Which titles are relevant to "web development"? | `LIKE '%web%'` is not enough | `match` on a `text` field |
| Numeric filter | Keep only courses worth at least 5 ECTS | `WHERE ects >= 5` | `range` inside `bool.filter` |

Elasticsearch can do all three in one request.

## Words you know, new names

| PostgreSQL and SQL | Elasticsearch |
|---|---|
| Table | Index |
| Row | Document (JSON) |
| Column | Field |
| Table schema (`CREATE TABLE`) | Mapping |
| Primary key | `_id` |
| SQL | Query DSL (JSON over REST) |
| `WHERE name LIKE '%x%'` | `match` query |
| `ORDER BY` | Relevance score (`_score`) |
| B-tree index | Inverted index |
| `JOIN` | No joins: store the data flattened |
| ACID transactions | No transactions, near-real-time |
| TypeORM repository | Elasticsearch client |

## What each one is good at

| | PostgreSQL | Elasticsearch |
|---|---|---|
| Strength | Correctness | Finding |
| Relations and joins | Yes | No |
| Transactions and constraints | Yes | No |
| Exact lookups and reports | Yes | Yes |
| Free-text search | Basic (`tsvector`) | Excellent |
| Ranking by relevance | Limited | Built in (BM25) |
| Typo tolerance, highlighting | Limited | Built in |
| Aggregations over lots of text | Slower | Fast |
| Source of truth | **Yes** | **No** |

PostgreSQL has full-text search too (`tsvector`, `ts_rank`). It is a good start for small projects. Elasticsearch goes further on ranking, typo tolerance and scale.

## Why `LIKE` is not enough

1. **Typos and word forms.** `'%searching%'` never finds "searched". `'%databse%'` finds nothing.
2. **No ranking.** Every match is equal. There is no "best first".
3. **Wrong matches.** `'%ear%'` matches "year", "learn" and "search". `LIKE` sees characters, not words.
4. **Slow at scale.** A leading `%` cannot use a normal B-tree index, so every row is read.

You can see this live in the demo: [`demo/README.md`](../demo/README.md), or in the web page of the example app (compare mode).

## Where you have already met it

- The search box on Wikipedia, GitHub and online shops (typos forgiven, filters, best match first).
- Log search in tools like Kibana.
- Product search with facets: "brand (12), price, in stock".

## Glossary

| Term | Meaning |
|---|---|
| **Index** | A collection of documents with a mapping. Like a table. |
| **Document** | One JSON object. Like a row. |
| **Field** | One key in a document. Like a column. |
| **Mapping** | Declares the type of each field (`text`, `keyword`, `integer`, ...). |
| **Analyzer** | Turns text into terms: split, lowercase, remove stop words, stem. |
| **Term** | One normalized word as stored in the index. |
| **Inverted index** | Maps each term to the documents that contain it. |
| **Query DSL** | The JSON language you use to ask questions. |
| **Score (`_score`)** | How relevant a hit is. Higher is better. |
| **Shard** | A slice of an index. Each shard is a complete Lucene index. |
| **Replica** | A copy of a shard on another node, for speed and safety. |
| **Refresh** | The moment new documents become searchable (every 1 s by default). |
| **Kibana** | The web UI for Elasticsearch. Dev Tools is its query console. |

Next: [2. How search works inside](02-how-search-works.md)
