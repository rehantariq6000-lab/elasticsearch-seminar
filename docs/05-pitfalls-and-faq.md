# 5. Pitfalls and FAQ

## Pitfalls to remember

| Pitfall | What happens | What to do |
|---|---|---|
| **Not your primary database** | No joins, no transactions. | Keep PostgreSQL as the truth and be able to rebuild the index. |
| **Near-real-time** | A search right after a write can miss it for about a second. | `refresh=wait_for` in tests; accept the delay in production. |
| **Mappings are hard to change** | You cannot change a field type in place. | Create a new index with the right mapping and reindex. |
| **`term` on a `text` field** | Zero hits, because the query is not analyzed. | Use `match` for text, `term` for keyword fields. |
| **Deep pagination** | `from + size` is capped at 10,000 and gets expensive. | Use `search_after` with a point in time. |
| **Drift** | A dual write can fail halfway. | Keep a reindex path (`POST /search/reindex`). |
| **Security switched off** | The compose file disables security for convenience. | Never expose port 9200 beyond your laptop. |

## AI check

AI assistants write plausible query DSL that is subtly wrong. Always run it and check the hits. A classic:

```text
GET courses/_search
{ "query": { "term": { "title": "Databases" } } }
```

It looks fine and returns **0 hits**. Why? `title` is a `text` field, so the index holds the lowercase term `databases`. A `term` query does not analyze and looks for the exact string `Databases`. Fix: use `match`, or filter exact values on a `keyword` field.

## FAQ

**Do I need Kibana?**
No. Everything works with `curl`, the VS Code REST Client (`demo/demo.http`) or the scripts. Kibana's Dev Tools console is just the most comfortable way to type queries. You can start without it: `docker compose up -d elasticsearch`.

**My search finds nothing. Where do I look?**
1. Is the document in the index? `GET courses/_count` and `GET courses/_doc/<id>`.
2. Did you wait for the refresh? Add `refresh=wait_for` to the write.
3. Is the field `text` or `keyword`? Use `match` for text, `term` for keyword.
4. What did the analyzer make of your query? `POST courses/_analyze { "field": "title", "text": "..." }`.

**The cluster health is yellow.**
Expected on a single node: the replica shards have no second node to live on. Check with `GET _cluster/health`. Green needs at least two nodes (or `number_of_replicas: 0`).

**Docker says the container exited, or Elasticsearch is very slow.**
Give Docker at least 4 GB of memory (Docker Desktop, Settings, Resources). The compose file already limits the Elasticsearch heap to 512 MB. Check the logs with `docker compose logs elasticsearch`.

**Port 9200 or 5432 is already in use.**
Copy `.env.example` to `.env` and change `ES_PORT` or `POSTGRES_PORT`. For the scripts, set `ELASTICSEARCH_URL=http://localhost:<port>`.

**Why does `GET` have a body?**
Elasticsearch accepts a JSON body on `GET _search`. Some HTTP tools refuse a body on `GET`. Elasticsearch treats `POST` on `_search` and `_analyze` exactly the same way, and the scripts in this repo do that for you.

**Why a different index for the tests?**
So `npm test` never changes the data you are demoing with. The tests use `courses_e2e` and delete it afterwards.

**Which versions?**
Elasticsearch and Kibana 9.5.6, PostgreSQL 17, Node.js 22 or newer, the official client `@elastic/elasticsearch` 9.5.1, NestJS 12.

**Can I use a hosted Elasticsearch instead of Docker?**
Yes, for example Elastic Cloud. Set `ELASTICSEARCH_URL` (hosted clusters also need an API key, which this seminar setup does not configure). For the live demo, Docker on your laptop is simpler.

## Further reading

- Elasticsearch documentation: <https://www.elastic.co/docs>
- Query DSL reference: <https://www.elastic.co/docs/reference/query-languages/querydsl>
- Mapping reference: <https://www.elastic.co/docs/reference/elasticsearch/mapping-reference>
- JavaScript client: <https://www.elastic.co/docs/reference/elasticsearch/clients/javascript>
