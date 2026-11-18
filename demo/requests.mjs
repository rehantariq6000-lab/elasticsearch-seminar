// The live demo, as data. This file is the single source of truth:
//   - scripts/demo.mjs          runs every step and checks the expected result
//   - scripts/build-demo-files.mjs   generates demo/kibana-console.txt and demo/demo.http
//
// Each step has: id, part, title, note (what to say), method, path, optional body,
// and `expect` (what the audience should see). Edit here, then run: npm run demo:files

const bothWords = {
  match: { title: { query: 'web development', operator: 'and' } },
};

export function steps(index = 'courses') {
  return [
    // ---- Setup check -------------------------------------------------------
    {
      id: 'cluster',
      part: 'Setup',
      title: 'Is Elasticsearch running?',
      note: 'The tagline is a classic. If this answers, Docker, the port and the container all work.',
      method: 'GET',
      path: '/',
      expect: { contains: 'You Know, for Search' },
    },

    // ---- The hook ----------------------------------------------------------
    {
      id: 'typo-plain',
      part: 'The hook',
      title: 'A typo, without fuzziness',
      note: 'Run the same typo in Postgres first (ILIKE finds 0 rows, see demo/README.md). Plain match finds nothing either.',
      method: 'GET',
      path: `/${index}/_search`,
      body: { query: { match: { description: 'databse' } } },
      expect: { total: 0 },
    },
    {
      id: 'typo-fuzzy',
      part: 'The hook',
      title: 'The same typo, with fuzziness AUTO',
      note: 'One extra option and the right course comes back first. Do not explain how yet.',
      method: 'GET',
      path: `/${index}/_search`,
      body: {
        _source: ['code', 'title', 'ects'],
        query: { match: { description: { query: 'databse', fuzziness: 'AUTO' } } },
      },
      expect: { total: 21, firstTitle: 'Introduction to Databases' },
    },

    // ---- Analyzers ---------------------------------------------------------
    {
      id: 'analyze-english',
      part: 'Analyzers',
      title: 'What does the english analyzer make of a sentence?',
      note: 'Tokenize, lowercase, drop stop words, stem. Note quickly becomes quickli: rules, not a dictionary.',
      method: 'POST',
      path: `/${index}/_analyze`,
      body: { analyzer: 'english', text: 'Searching the Databases quickly' },
      expect: { tokens: ['search', 'databas', 'quickli'] },
    },
    {
      id: 'analyze-title',
      part: 'Analyzers',
      title: 'And our title field (standard analyzer)?',
      note: 'The title field only splits and lowercases. This is why the web/development term lists are so clean.',
      method: 'POST',
      path: `/${index}/_analyze`,
      body: { field: 'title', text: 'Web Development Fundamentals' },
      expect: { tokens: ['web', 'development', 'fundamentals'] },
    },

    // ---- First search ------------------------------------------------------
    {
      id: 'first-search',
      part: 'First search',
      title: 'Our first search',
      note: 'hits.total, then hits.hits with _id, _score, _source. Introduction to Databases is found too: stemming.',
      method: 'GET',
      path: `/${index}/_search`,
      body: {
        _source: ['code', 'title', 'ects'],
        query: { match: { description: 'databases' } },
      },
      expect: { total: 8, firstId: 7, firstTitle: 'NoSQL Databases' },
    },

    // ---- Demo 1: exact lookup ----------------------------------------------
    {
      id: 'exact-code',
      part: 'Demo 1: exact lookup',
      title: 'Predict: what will a search for MI150 return?',
      note: 'Take the vote first. Same job as WHERE code = \'MI150\'. term on a keyword field.',
      method: 'GET',
      path: `/${index}/_search`,
      body: { query: { term: { code: 'MI150' } } },
      expect: { total: 1, ids: [8] },
    },
    {
      id: 'exact-code-lowercase',
      part: 'Demo 1: exact lookup',
      title: 'And with lowercase mi150?',
      note: 'term is exact and case-sensitive. Nothing found.',
      method: 'GET',
      path: `/${index}/_search`,
      body: { query: { term: { code: 'mi150' } } },
      expect: { total: 0 },
    },

    // ---- Demo 2: either / both words ---------------------------------------
    {
      id: 'either-word',
      part: 'Demo 2: either word or both',
      title: 'Either word (the default)',
      note: 'Run this first and show the four IDs.',
      method: 'GET',
      path: `/${index}/_search`,
      body: {
        _source: ['code', 'title', 'ects'],
        query: { match: { title: 'web development' } },
      },
      expect: { total: 4, ids: [8, 10, 11, 12] },
    },
    {
      id: 'both-words',
      part: 'Demo 2: either word or both',
      title: 'Predict: which IDs stay when both words are required?',
      note: 'Pairs predict for thirty seconds. Only the operator changes. 8 lacks development, 11 lacks web.',
      method: 'GET',
      path: `/${index}/_search`,
      body: {
        _source: ['code', 'title', 'ects'],
        query: bothWords,
      },
      expect: { total: 2, ids: [10, 12] },
    },

    // ---- Demo 3: filter ----------------------------------------------------
    {
      id: 'filter-5',
      part: 'Demo 3: ECTS filter',
      title: 'Predict: which match survives a minimum of 5 ECTS?',
      note: 'Match goes in must, the range goes in filter. Course 12 is worth only 3 ECTS.',
      method: 'GET',
      path: `/${index}/_search`,
      body: {
        _source: ['code', 'title', 'ects'],
        query: {
          bool: {
            must: [bothWords],
            filter: [{ range: { ects: { gte: 5 } } }],
          },
        },
      },
      expect: { total: 1, ids: [10] },
    },
    {
      id: 'filter-3',
      part: 'Demo 3: ECTS filter',
      title: 'What if we lower the minimum to 3?',
      note: 'Eligibility changes, scores do not. Both courses qualify again.',
      method: 'GET',
      path: `/${index}/_search`,
      body: {
        _source: ['code', 'title', 'ects'],
        query: {
          bool: {
            must: [bothWords],
            filter: [{ range: { ects: { gte: 3 } } }],
          },
        },
      },
      expect: { total: 2, ids: [10, 12] },
    },

    // ---- Query DSL ---------------------------------------------------------
    {
      id: 'bool-full',
      part: 'Query DSL',
      title: 'bool with must, filter and must_not',
      note: 'Courses about search, exactly 5 ECTS, not tagged sql.',
      method: 'GET',
      path: `/${index}/_search`,
      body: {
        _source: ['code', 'title', 'ects', 'tags'],
        query: {
          bool: {
            must: [{ match: { description: 'search' } }],
            filter: [{ term: { ects: 5 } }],
            must_not: [{ term: { tags: 'sql' } }],
          },
        },
      },
      expect: { total: 2, ids: [5, 32] },
    },
    {
      id: 'multi-no-boost',
      part: 'Query DSL',
      title: 'multi_match over title and description',
      note: 'Write down the scores: about 2.86 and 2.52.',
      method: 'GET',
      path: `/${index}/_search`,
      body: {
        _source: ['title'],
        query: { multi_match: { query: 'search', fields: ['title', 'description'] } },
      },
      expect: { total: 6, firstId: 32 },
    },
    {
      id: 'multi-boost',
      part: 'Query DSL',
      title: 'The same query with title^3',
      note: 'A match in the title now counts three times: about 8.59 and 7.57. Courses that only mention it stay put.',
      method: 'GET',
      path: `/${index}/_search`,
      body: {
        _source: ['title'],
        query: { multi_match: { query: 'search', fields: ['title^3', 'description'] } },
      },
      expect: { total: 6, firstId: 32 },
    },
    {
      id: 'highlight',
      part: 'Query DSL',
      title: 'Highlighting: show why it matched',
      note: 'The matched words come back wrapped in em tags. Same effect as the yellow marker in the slides.',
      method: 'GET',
      path: `/${index}/_search`,
      body: {
        size: 2,
        _source: ['title'],
        query: { match: { description: 'databases' } },
        highlight: { fields: { description: {} } },
      },
      expect: { contains: '<em>database</em>' },
    },
    {
      id: 'aggs-tags',
      part: 'Query DSL',
      title: 'Aggregations: GROUP BY for search',
      note: 'size 0 means counts only, no hits. This is how you build the facets next to search results.',
      method: 'GET',
      path: `/${index}/_search`,
      body: {
        size: 0,
        aggs: { by_tag: { terms: { field: 'tags' } } },
      },
      expect: { bucket: { key: 'data', count: 13 } },
    },

    // ---- Pitfalls ----------------------------------------------------------
    {
      id: 'term-on-text',
      part: 'Pitfalls',
      title: 'AI check: why zero hits?',
      note: 'term skips the analyzer. The index holds "databases", not "Databases". Fix: use match.',
      method: 'GET',
      path: `/${index}/_search`,
      body: { query: { term: { title: 'Databases' } } },
      expect: { total: 0 },
    },
    {
      id: 'deep-paging',
      part: 'Pitfalls',
      title: 'Deep pagination has a limit',
      note: 'from + size is capped at 10,000 by default. Use search_after for next page.',
      method: 'GET',
      path: `/${index}/_search`,
      body: { from: 10000, size: 10, query: { match_all: {} } },
      expect: { status: 400, contains: 'Result window is too large' },
    },

    // ---- Near-real-time + the pair lab insert ------------------------------
    {
      id: 'insert-13',
      part: 'Writing',
      title: 'Index one more course (ID 13)',
      note: 'refresh=wait_for: the response returns once the document is searchable. This is the pair lab task 3.',
      method: 'PUT',
      path: `/${index}/_doc/13?refresh=wait_for`,
      body: {
        course_id: 13,
        code: 'WEB320',
        title: 'Advanced Web Development',
        ects: 5,
      },
      expect: { status: 201 },
      mutates: true,
    },
    {
      id: 'after-insert',
      part: 'Writing',
      title: 'Rerun the filtered search',
      note: 'Course 13 qualifies: both words in the title and 5 ECTS.',
      method: 'GET',
      path: `/${index}/_search`,
      body: {
        _source: ['code', 'title', 'ects'],
        query: {
          bool: {
            must: [bothWords],
            filter: [{ range: { ects: { gte: 5 } } }],
          },
        },
      },
      expect: { total: 2, ids: [10, 13] },
      mutates: true,
    },
    {
      id: 'cleanup-13',
      part: 'Writing',
      title: 'Remove course 13 again',
      note: 'Cleanup, so the demo can be repeated from the start.',
      method: 'DELETE',
      path: `/${index}/_doc/13?refresh=true`,
      expect: { status: 200 },
      mutates: true,
      cleanup: true,
    },
  ];
}
