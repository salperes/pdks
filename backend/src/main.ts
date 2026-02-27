import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { text } from 'express';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const basicAuth = require('express-basic-auth');
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ADMS (iClock) endpoints live at /iclock/* — exclude from API prefix
  app.setGlobalPrefix('api/v1', {
    exclude: ['iclock/{*path}'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true });

  // ADMS devices send plain text bodies
  app.use('/iclock', text({ type: '*/*', limit: '10mb' }));

  // Serve uploaded files (photos etc.)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads/' });

  // Swagger UI — protected with basic auth OR API key (?key=...)
  const swaggerUser = process.env.SWAGGER_USER || 'admin';
  const swaggerPass = process.env.SWAGGER_PASS || 'pdks2026';
  const swaggerKey = process.env.SWAGGER_KEY || 'fe1JHxiYtKpJrrSYuDuCN9Mw3Avygl0X';
  const swaggerKeyAuthed = new Set<string>();
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/docs')) return next();
    // Key in query → remember this IP
    if (req.query.key === swaggerKey) {
      swaggerKeyAuthed.add(req.ip);
      return next();
    }
    // Referer has key (sub-resources like css/js loaded by Swagger UI)
    try {
      const ref = req.headers.referer || req.headers.referrer || '';
      if (ref && new URL(ref).searchParams.get('key') === swaggerKey) {
        swaggerKeyAuthed.add(req.ip);
        return next();
      }
    } catch { /* ignore invalid referer */ }
    // Already authed by key from this IP
    if (swaggerKeyAuthed.has(req.ip)) return next();
    basicAuth({ challenge: true, users: { [swaggerUser]: swaggerPass } })(req, res, next);
  });

  const config = new DocumentBuilder()
    .setTitle('PDKS API')
    .setDescription('Personel Devam Kontrol Sistemi — REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`PDKS Backend running on http://localhost:${port}`);
  console.log(`ADMS iClock endpoint: http://localhost:${port}/iclock/cdata`);
  console.log(`Swagger UI: http://localhost:${port}/api/docs`);
}
bootstrap();
