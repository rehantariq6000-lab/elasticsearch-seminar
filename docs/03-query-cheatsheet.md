# 3. Query cheat sheet

Every example runs against the `courses` index from this repo (`npm run es:setup`). Paste them into Kibana Dev Tools (http://localhost:5601, Dev Tools). All of them are also checked by `npm run demo` or were run while writing this page.

## Which query for what

| You want to | SQL | Elasticsearch |
|---|---|---|
| Find an exact value | `WHERE code = 'MI150'` | `term` on a `keyword` field |
| Find any of several exact values | `WHERE tag IN ('sql', 'search')` | `terms` |
| Search words in text | `LIKE '%web%'` (weak) | `match` on a `text` field |
| Require all words | `... AND ...` | `match` with `"operator": "and"` |
| Find an exact phrase | `LIKE '%web development%'` | `match_phrase` |
| Search several fields | `a LIKE ... OR b LIKE ...` | `multi_match` |
| Numeric or date range | `WHERE ects >= 5` | `range` |
| Combine conditions | `AND` / `OR` / `NOT` | `bool`: `must`, `should`, `must_not`, `filter` |
| Forgive typos | not possible | `"fuzziness": "AUTO"` |
| Show why it matched | not possible | `highlight` |
| Count per group | `GROUP BY` | `aggs` with `terms` |
| Sort | `ORDER BY` | `sort` (default: by `_score`) |
| Paging | `LIMIT / OFFSET` | `from` + `size`, or `search_after` |

## The queries

### `term`: exact value (keyword fields)

```text
GET courses/_search
{ "query": { "term": { "code": "MI150" } } }
```

Exact and **case-sensitive**: `mi150` finds nothing. Never use `term` on a `text` field.

### `terms`: any of several exact values

```text
GET courses/_search
{ "query": { "terms": { "tags": ["sql", "search"] } } }
```

### `match`: words in a text field

```text
GET courses/_search
{ "query": { "match": { "description": "databases" } } }
```

The query text is analyzed. It finds "database" and "databases". By default **any** word is enough (`or`).

### `match` with `operator: and`: all words

```text
GET courses/_search
{
  "query": { "match": { "title": { "query": "web development", "operator": "and" } } }
}
```

Either word: IDs 8, 10, 11, 12. Both words: 10, 12.

### `match_phrase`: words next to each other, in order

```text
GET courses/_search
{ "query": { "match_phrase": { "title": "web development" } } }
```

Finds 10 and 12. `"development web"` finds nothing: the order matters.

### `multi_match`: several fields, with a boost

```text
GET courses/_search
{
  "query": {
    "multi_match": { "query": "search", "fields": ["title^3", "description"] }
  }
}
```

`title^3`: a match in the title counts three times as much.

### `range`: numbers and dates

```text
GET courses/_search
{ "query": { "range": { "ects": { "gte": 5 } } } }
```

Operators: `gt`, `gte`, `lt`, `lte`.

### `bool`: combine conditions

```text
GET courses/_search
{
  "query": {
    "bool": {
      "must":     [ { "match": { "description": "search" } } ],
      "filter":   [ { "term":  { "ects": 5 } } ],
      "must_not": [ { "term":  { "tags": "sql" } } ]
    }
  }
}
```

| Clause | Like in SQL | Affects the score? |
|---|---|---|
| `must` | `AND` | yes |
| `filter` | `AND` | no (and can be cached) |
| `should` | `OR`, or a bonus | yes |
| `must_not` | `NOT` | no |

**Habit:** put the text search in `must`, the exact yes/no conditions in `filter`.

### Fuzziness: forgive typos

```text
GET courses/_search
{
  "query": { "match": { "description": { "query": "databse", "fuzziness": "AUTO" } } }
}
```

`AUTO` picks the allowed number of single-character edits by word length:

| Word length | Edits allowed |
|---|---|
| 1 to 2 letters | 0 |
| 3 to 5 letters | 1 |
| 6 or more | 2 |

Fuzzy matching widens the net (this typo finds 21 courses, the exact word "databases" finds 8). The ranking still puts the best match first.

### Highlighting

```text
GET courses/_search
{
  "query": { "match": { "description": "databases" } },
  "highlight": { "fields": { "description": {} } }
}
```

Matched words come back wrapped in `<em>` tags. Change them with `pre_tags` and `post_tags`. When the text comes from users, also set `"encoder": "html"` so the source text is escaped.

### Aggregations: `GROUP BY` for search

```text
GET courses/_search
{
  "size": 0,
  "aggs": { "by_tag": { "terms": { "field": "tags" } } }
}
```

`size: 0` means counts only, no hits. More examples: `avg`, `range`, `date_histogram`.

```text
GET courses/_search
{ "size": 0, "aggs": { "avg_ects": { "avg": { "field": "ects" } } } }
```

### Sorting

```text
GET courses/_search
{
  "_source": ["title", "ects"],
  "query": { "match_all": {} },
  "sort": [ { "ects": "desc" }, { "code": "asc" } ]
}
```

Sort on `keyword`, number or date fields, not on analyzed `text` fields.

### Choosing which fields come back

```text
GET courses/_search
{ "_source": ["code", "title", "ects"], "query": { "match_all": {} } }
```

### Paging

```text
GET courses/_search
{ "from": 40, "size": 5, "query": { "match_all": {} } }
```

`from + size` is capped at **10,000** by default (`index.max_result_window`). For deep paging or "load more", use `search_after` with a point in time:

```text
POST courses/_pit?keep_alive=1m                  → returns an id

GET _search
{
  "size": 10,
  "query": { "match_all": {} },
  "pit": { "id": "<the id>", "keep_alive": "1m" },
  "sort": [ { "ects": "asc" }, { "_shard_doc": "asc" } ],
  "search_after": [ 3, 11 ]                      ← the "sort" values of the last hit
}
```

### Writing documents

```text
PUT courses/_doc/13?refresh=wait_for        index (or replace) one document with _id 13
{ "course_id": 13, "code": "WEB320", "title": "Advanced Web Development", "ects": 5 }

GET courses/_doc/13                         read it back (real-time)
DELETE courses/_doc/13                      delete it

POST courses/_bulk                          many operations in one request (NDJSON, one line each)
{ "index": { "_id": 8 } }
{ "course_id": 8, "code": "MI150", "title": "Web Design", "ects": 5 }
```

### Looking inside

```text
POST courses/_analyze                       what does an analyzer make of a text?
{ "field": "title", "text": "Web Development Fundamentals" }

GET courses/_mapping                        the mapping of the index
GET courses/_count                          number of documents
GET _cat/indices?v                          all indices
GET _cluster/health                         green, yellow or red
```

Next: [4. Search in a NestJS app](04-nestjs-integration.md)
