import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: ['http://localhost:5173'], credentials: true });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`PDKS Backend running on http://localhost:${port}`);
}
bootstrap();
