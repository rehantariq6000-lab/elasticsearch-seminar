# Pair lab

Work in pairs. **One drives, one records.** Swap roles after task 2.

For every task, write down the IDs you **predicted** and the IDs you **got**, then explain one change.

## Setup (2 minutes)

```bash
docker compose up -d elasticsearch kibana
npm run es:setup
```

Open Kibana at <http://localhost:5601>, then Dev Tools. Paste [`starter.txt`](starter.txt).

**Sharing one Elasticsearch with other pairs?** Give your pair its own index so inserts do not change other pairs' results:

```bash
node scripts/setup.mjs --index pair-07
```

Then replace `courses` with `pair-07` in every request.

## The three tasks

The course titles you work with:

| ID | Title | ECTS |
|---|---|---|
| 8 | Web Design | 5 |
| 10 | Web Development Fundamentals | 6 |
| 11 | Game Development | 5 |
| 12 | Web Development Studio | 3 |

### Task 1: Match

Run `web development` against the title with **either word**, then require **both words**. Predict the IDs before you run each query.

### Task 2: Filter

Keep both words and require **at least 5 ECTS**. Which ID drops out, and why?

Hint: the match goes in `bool.must`, the range goes in `bool.filter`.

### Task 3: Index

Add **Advanced Web Development**, 5 ECTS, as ID 13 (code `WEB320`), then rerun the filtered search. Which conditions does the new course satisfy?

Hint: `PUT courses/_doc/13?refresh=wait_for`. The `refresh=wait_for` makes the next search see it.

## DONE WHEN

For every task you wrote down the IDs you predicted and the IDs you got, and you can explain one change.

You can check task 3 automatically:

```bash
npm run lab:check                      # your index is "courses"
npm run lab:check -- --index pair-07   # or your own index
```

Compare tasks 1 and 2 with the [answer key](answer-key.md).

## Stretch

- Add **highlighting** on `description` to your query.
- Try the typo `develpment` with `"fuzziness": "AUTO"`. Which courses come back?
- Add a `must_not` on the tag `sql`.

## Stretch, take-home: search in a NestJS app

The branch `starter` of this repository contains the example app with two methods left empty. The tests tell you what is missing.

```bash
git checkout starter
docker compose up -d elasticsearch db
cd app
cp .env.example .env
npm install
npm test            # fails: that is the starting point
```

1. Implement `SearchService.search` in `app/src/search/search.service.ts` so that `GET /search/courses?q=` returns ranked hits.
2. Index the new course in `CoursesService.create` in `app/src/courses/courses.service.ts`.
3. Run `npm test` until it is green.

**Done when:** after `POST /courses`, a `GET /search/courses?q=` with the new title returns it as the first hit, and `npm test` passes.

Bonus: delete the document from the index when a course is deleted, and look at how `POST /search/reindex` repairs drift. The finished version is on the `main` branch.
