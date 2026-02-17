import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { text } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ADMS (iClock) endpoints live at /iclock/* — exclude from API prefix
  app.setGlobalPrefix('api/v1', {
    exclude: ['iclock/{*path}'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true });

  // ADMS devices send plain text bodies
  app.use('/iclock', text({ type: '*/*', limit: '10mb' }));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`PDKS Backend running on http://localhost:${port}`);
  console.log(`ADMS iClock endpoint: http://localhost:${port}/iclock/cdata`);
}
bootstrap();
