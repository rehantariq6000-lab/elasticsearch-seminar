import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

// Injection tokens. A Symbol is a safe name for something that is not a class.
export const ES = Symbol('ES');
export const ES_INDEX = Symbol('ES_INDEX');

// One client for the whole app, built from ELASTICSEARCH_URL in .env,
// exactly like DATABASE_URL for PostgreSQL.
export const elasticsearchProvider = {
  provide: ES,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    new Client({
      node: config.getOrThrow<string>('ELASTICSEARCH_URL'),
    }),
};

// The index name is configurable, so the e2e tests can use their own index
// and never touch the one you are demoing with.
export const indexNameProvider = {
  provide: ES_INDEX,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    config.get<string>('ELASTICSEARCH_INDEX') ?? 'courses',
};
