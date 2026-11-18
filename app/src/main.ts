import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // The search page in public/index.html is served at http://localhost:3000/
  app.useStaticAssets(join(process.cwd(), 'public'));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
