# 2. How search works inside

Every query you write later makes sense once you know the **inverted index**.

## The inverted index

Think of the index at the back of a book: you look up a word and it tells you the pages. An inverted index is exactly that, for every word in every document.

A normal table maps a **document to its words**. The inverted index inverts that: it maps a **word to its documents**. Looking up a word is fast because you never read the documents themselves.

### Worked example: four courses

| ID | Title | ECTS |
|---|---|---|
| 8 | Web Design | 5 |
| 10 | Web Development Fundamentals | 6 |
| 11 | Game Development | 5 |
| 12 | Web Development Studio | 3 |

After splitting the titles into words and lowercasing them, the inverted index for the two words we care about is:

| Term | Documents |
|---|---|
| `web` | 8, 10, 12 |
| `development` | 10, 11, 12 |

The query `web development` is just two lookups and a set operation:

- **Either word** (union, the default): 8, 10, 11, 12
- **Both words** (intersection, `"operator": "and"`): 10, 12

Try it yourself (Kibana Dev Tools):

```text
GET courses/_search
{ "query": { "match": { "title": "web development" } } }

GET courses/_search
{ "query": { "match": { "title": { "query": "web development", "operator": "and" } } } }
```

## Analyzers: from text to terms

The index does not store your text. It stores **terms**, and the **analyzer** decides what a term is. An analyzer is a small pipeline: tokenize, then run token filters.

This is the built-in `english` analyzer applied to "Searching the Databases quickly" (real output, reproduce it with `POST courses/_analyze`):

| Step | Result |
|---|---|
| Input | `Searching the Databases quickly` |
| 1 Tokenize | `Searching` `the` `Databases` `quickly` |
| 2 Lowercase | `searching` `the` `databases` `quickly` |
| 3 Drop stop words | `searching` `databases` `quickly` |
| 4 Stem | `search` `databas` `quickli` |

Notice that "quickly" becomes `quickli`. Stemming is **rule-based, not a dictionary**, so the roots can look odd. That is fine, as long as the query goes through the same steps.

In this project:

- `description` uses the **english** analyzer: stop words are dropped and words are stemmed. That is why searching "databases" also finds "database".
- `title` uses the **standard** analyzer: only split and lowercase. That is why the term lists above are so clean: `Web Development Fundamentals` becomes `web` `development` `fundamentals`.

### The query is analyzed too

When you index a document, the text goes through the analyzer and the terms are stored. When you search with `match`, your query text goes through the **same** analyzer. So `database` and `Databases` both become `databas` and find each other.

A `term` query skips the analyzer and looks for the exact string. So `{"term": {"title": "Databases"}}` looks for a stored term `Databases` with a capital D. The index only holds `databases`. Result: zero hits. This is the most common "why do I get no results" bug.

> **Rule:** stored terms and query terms must be produced the same way.

## Relevance: why one hit ranks higher

Elasticsearch scores every hit. The number is `_score`. The default algorithm is **BM25**. It boils down to three ideas:

1. **Term frequency.** The more often a word appears in a field, the higher the score, with diminishing returns.
2. **Rarity.** A rare word is worth more than a common one. "elasticsearch" beats "the".
3. **Field length.** A match in a short title beats the same match in a long text.

You do not need the formula. You do need to know that you can **steer** it. For example, `title^3` says a match in the title counts three times as much (real scores for the query "search" on our data):

| Course | No boost | `title^3` |
|---|---|---|
| Search-Driven Applications | 2.86 | 8.59 |
| Information Retrieval and Search | 2.52 | 7.57 |
| Logging and Monitoring (only in the description) | 2.01 | 2.01 |

## Mapping: the schema of an index

The mapping is Elasticsearch's version of `CREATE TABLE`. The two types you must understand:

| Type | Use it for | In our courses |
|---|---|---|
| `text` | Full-text search. Analyzed into terms. | `title`, `description` |
| `keyword` | Exact values: filters, sorting, aggregations. Matched as a whole. | `code`, `lecturer`, `tags` |
| `integer`, `date`, `boolean` | Numbers, dates, flags, range filters | `course_id`, `ects`, `max_participants` |

The full mapping is in [`seed/mapping.json`](../seed/mapping.json).

If you skip the mapping, Elasticsearch guesses (**dynamic mapping**). It usually makes every string a `text` plus a `keyword`, which wastes space and rarely matches your intent.

> You can add new fields later, but you **cannot change the type** of an existing field. If you got it wrong, create a new index and reindex.

## Indices, shards and replicas

An index is split into **shards**. Each shard is a complete Lucene index holding a slice of the documents.

```text
Index "courses": 3 primary shards, 1 replica each

 Node 1        Node 2        Node 3
 ┌─────────┐   ┌─────────┐   ┌─────────┐
 │ P0   R1 │   │ P1   R2 │   │ P2   R0 │      P = primary    R = replica
 └─────────┘   └─────────┘   └─────────┘
```

- **Primaries** split the data. **Replicas** copy it, for speed and safety if a node dies.
- A search asks every shard and merges the answers.
- In this seminar we run **one node**. Replicas cannot be placed on the same node as their primary, so the cluster health shows **yellow**. That is expected and harmless here.

## Near-real-time

When you index a document it first lands in an in-memory buffer. It becomes searchable at the next **refresh**, every **1 second** by default. So a search directly after a write can miss the new document.

- `GET courses/_doc/13` (by id) is real-time. Only **search** is delayed.
- To wait for the refresh, add `refresh=wait_for` to the write: `PUT courses/_doc/13?refresh=wait_for`. The response returns once the document is searchable. This is used in the pair lab and in the e2e tests. Do not use it blindly in production: it slows writes.

Next: [3. Query cheat sheet](03-query-cheatsheet.md)
