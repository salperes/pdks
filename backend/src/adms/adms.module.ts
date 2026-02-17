import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device, AccessLog, Personnel } from '../entities';
import { AdmsController } from './adms.controller';
import { AdmsService } from './adms.service';

@Module({
  imports: [TypeOrmModule.forFeature([Device, AccessLog, Personnel])],
  controllers: [AdmsController],
  providers: [AdmsService],
  exports: [AdmsService],
})
export class AdmsModule {}
