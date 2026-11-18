# Pair lab answer key

| Query | Expected course IDs |
|---|---|
| Either word (`web development`, default) | 8, 10, 11, 12 |
| Both words (`"operator": "and"`) | 10, 12 |
| Both words and at least 5 ECTS | 10 |
| Same filter after indexing ID 13 | 10, 13 |

The IDs are sets: the order on screen depends on the relevance score.

## Why

- **8** (Web Design) has `web` but not `development`. **11** (Game Development) has `development` but not `web`. Requiring both words removes them.
- **12** (Web Development Studio) matches both words but is worth only **3 ECTS**, so the range filter removes it. Matching decides who qualifies, the filter removes documents without changing the score of the others.
- **13** (Advanced Web Development) qualifies: both words in the title and 5 ECTS.

With a minimum of 3 ECTS instead of 5, courses 10 and 12 both qualify again.

## If course 13 is missing from your results

1. Did you write to the index you are searching? Check the index name in the `PUT` and in the `GET`.
2. Are the title tokens right? `POST courses/_analyze { "field": "title", "text": "Advanced Web Development" }` should give `advanced`, `web`, `development`.
3. Is `ects` the **number** 5, not the string `"5"`?
4. Is the write searchable yet? Use `refresh=wait_for` on the `PUT`, or wait a second.

`npm run lab:check` runs these checks for you.

## Stretch

- Typo `develpment` with `"fuzziness": "AUTO"` (10 letters, so up to 2 edits): finds the courses with `development` in the title.
- `<em>...</em>` tags in the response mark the matched words.
