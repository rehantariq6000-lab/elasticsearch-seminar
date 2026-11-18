import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Client, estypes } from '@elastic/elasticsearch';
import { Repository } from 'typeorm';
import { Course } from '../courses/course.entity.js';
import { COURSE_MAPPING } from './course-index.js';
import { type CourseDocument, toDocument } from './course-document.js';
import { ES, ES_INDEX } from './elasticsearch.provider.js';

export interface ExploreParams {
  q?: string;
  minEcts?: number;
  tag?: string;
  page?: number;
  size?: number;
}

export interface Bucket {
  key: string | number;
  doc_count: number;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @Inject(ES) private readonly es: Client,
    @Inject(ES_INDEX) private readonly index: string,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
  ) {}

  // On startup: make sure the index exists, with our mapping.
  async onModuleInit() {
    if (!(await this.es.indices.exists({ index: this.index }))) {
      await this.es.indices.create({
        index: this.index,
        mappings: COURSE_MAPPING,
      });
      this.logger.log(
        `Created index "${this.index}". Fill it with: POST /search/reindex`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // The simple search from the slides: GET /search/courses?q=...
  // ---------------------------------------------------------------------------
  async search(q: string) {
    // TODO (stretch exercise, step 1): ask Elasticsearch.
    //   - this.es.search({ index: this.index, query: { multi_match: ... }, highlight: ... })
    //   - search "title" (boosted: title^3) and "description", with fuzziness 'AUTO'
    //   - highlight the "description" field
    //   - map each hit to { id, score, ...the document, highlight }
    // The same query, as a JSON request, is in demo/kibana-console.txt (multi_match).
    // `explore` below is a bigger version of the same idea.
    void q;
    throw new Error('TODO: implement SearchService.search');
  }

  // ---------------------------------------------------------------------------
  // The richer search behind the web page: filters, facets, highlighting, paging.
  // GET /search/explore?q=web&minEcts=5&tag=backend&page=1&size=10
  // ---------------------------------------------------------------------------
  async explore({ q = '', minEcts, tag, page = 1, size = 10 }: ExploreParams) {
    const filter: estypes.QueryDslQueryContainer[] = [];
    if (minEcts) filter.push({ range: { ects: { gte: minEcts } } });

    const result = await this.es.search<CourseDocument>({
      index: this.index,
      from: (page - 1) * size,
      size,
      query: {
        bool: {
          // Text goes in must (it scores). Yes/no conditions go in filter (no score, cached).
          must: q.trim()
            ? [
                {
                  multi_match: {
                    query: q,
                    fields: ['title^3', 'description'],
                    fuzziness: 'AUTO',
                  },
                },
              ]
            : [{ match_all: {} }],
          filter,
        },
      },
      // post_filter applies after the aggregations, so the tag facet keeps showing
      // all tags while one of them is selected. That is how shop-style facets work.
      ...(tag ? { post_filter: { term: { tags: tag } } } : {}),
      highlight: {
        pre_tags: ['<mark>'],
        post_tags: ['</mark>'],
        encoder: 'html', // escape HTML in the source text, keep only our <mark> tags
        fields: { title: { number_of_fragments: 0 }, description: {} },
      },
      aggs: {
        tags: { terms: { field: 'tags', size: 12 } },
      },
    });

    const total = result.hits.total;
    const buckets = (name: string): Bucket[] =>
      (
        (result.aggregations?.[name] as { buckets?: Bucket[] } | undefined)
          ?.buckets ?? []
      ).map(({ key, doc_count }) => ({ key, doc_count }));

    return {
      total: typeof total === 'number' ? total : (total?.value ?? 0),
      tookMs: result.took,
      page,
      size,
      hits: result.hits.hits.map((hit) => ({
        id: Number(hit._id),
        score: hit._score,
        ...(hit._source as CourseDocument),
        highlight: {
          title: hit.highlight?.title?.[0],
          description: hit.highlight?.description,
        },
      })),
      facets: { tags: buckets('tags') },
    };
  }

  // ---------------------------------------------------------------------------
  // Rebuild the whole index from PostgreSQL. This is the safety net for drift,
  // and the reason why "the index can always be rebuilt" is true.
  // POST /search/reindex
  // ---------------------------------------------------------------------------
  async reindex() {
    await this.es.indices.delete({ index: this.index }, { ignore: [404] });
    await this.es.indices.create({
      index: this.index,
      mappings: COURSE_MAPPING,
    });

    const courses = await this.courses.find({ order: { id: 'ASC' } });
    if (courses.length > 0) {
      const response = await this.es.bulk({
        refresh: true,
        operations: courses.flatMap((course) => [
          { index: { _index: this.index, _id: String(course.id) } },
          toDocument(course),
        ]),
      });
      if (response.errors) throw new Error('Bulk indexing reported errors');
    }
    this.logger.log(`Reindexed ${courses.length} courses into "${this.index}"`);
    return { index: this.index, indexed: courses.length };
  }
}
