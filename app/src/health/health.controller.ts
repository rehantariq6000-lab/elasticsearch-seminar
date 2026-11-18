import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Client } from '@elastic/elasticsearch';
import { DataSource } from 'typeorm';
import { ES } from '../search/elasticsearch.provider.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(ES) private readonly es: Client,
  ) {}

  // Open http://localhost:3000/health: both systems must answer.
  @Get()
  async check() {
    try {
      const [postgres] =
        await this.dataSource.query<{ version: string }[]>('SELECT version()');
      const info = await this.es.info();
      return {
        status: 'ok',
        postgres: postgres.version,
        elasticsearch: info.version.number,
      };
    } catch (error) {
      throw new ServiceUnavailableException(
        `A dependency is not reachable: ${(error as Error).message}`,
      );
    }
  }
}
