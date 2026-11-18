import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesModule } from './courses/courses.module.js';
import { HealthController } from './health/health.controller.js';
import { SearchModule } from './search/search.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        // Fine for a seminar. In a real project you would use migrations.
        synchronize: true,
        extra: { max: 10, idleTimeoutMillis: 30_000 },
      }),
    }),
    SearchModule,
    CoursesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
